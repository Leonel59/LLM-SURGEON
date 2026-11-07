/**
 * Motor de Física Quirúrgica de Inferencia Local (LLM-Surgeon Physics Engine)
 * Calcula con precisión de arquitectura:
 * - Tamaño real de pesos según cuantización (bpw efectivo con tablas de escala GGUF)
 * - Tamaño exacto del KV Cache por GQA (2 * L * H_kv * D_h * Ctx * Bytes)
 * - Buffer de activación CUDA / Compute Graph
 * - Reparto exacto de capas (n_gpu_layers) entre VRAM GDDR7/GDDR6 y RAM DDR5 del sistema
 * - Penalización por transferencia PCIe y cuello de botella de ancho de banda en Offloading
 * - Techo exacto de ventana de contexto antes de desbordar la VRAM (con y sin Flash-Attention Q8_0)
 */

export const QUANT_PROFILES = [
  { id: 'Q8_0', bpw: 8.5, qualityRetention: 0.998, label: 'Q8_0 (Sin pérdida práctica)' },
  { id: 'Q6_K', bpw: 6.56, qualityRetention: 0.992, label: 'Q6_K (Calidad de estudio)' },
  { id: 'Q5_K_M', bpw: 5.69, qualityRetention: 0.985, label: 'Q5_K_M (Punto dulce alto)' },
  { id: 'Q4_K_M', bpw: 4.85, qualityRetention: 0.972, label: 'Q4_K_M (Estándar SOTA recomendado)' },
  { id: 'IQ4_XS', bpw: 4.25, qualityRetention: 0.960, label: 'IQ4_XS (Compresión quirúrgica con Importance Matrix)' },
  { id: 'Q3_K_M', bpw: 3.91, qualityRetention: 0.925, label: 'Q3_K_M (Compresión agresiva para caber en VRAM)' }
];

/**
 * Calcula el consumo de KV Cache en GiB para un número de tokens de contexto dado
 * bytesPerElem: 2 para FP16 estándar, 1.05 para Q8_0 (con Flash-Attention habilitado)
 */
export function calculateKvCacheGiB(model, contextTokens, bytesPerElem = 2) {
  if (!model.kvHeads || !model.headDim || !model.layers) return 0.15;
  const totalBytes = 2 * model.layers * model.kvHeads * model.headDim * contextTokens * bytesPerElem;
  return Number((totalBytes / 1024 ** 3).toFixed(3));
}

/**
 * Calcula el tamaño real en GiB de los pesos del modelo en un perfil de cuantización
 */
export function calculateWeightsGiB(model, quantProfile) {
  const baseWeightsGiB = (model.paramsTotalB * 1e9 * (quantProfile.bpw / 8)) / 1024 ** 3;
  // Overhead de metadatos GGUF, tensores de embedding y capa de salida (lm_head suele ir en Q6_K/FP16)
  const embeddingOverheadGiB = model.paramsTotalB <= 9 ? 0.22 : 0.35;
  const visionProjectorGiB = model.visionProjectorGiB || 0;
  return Number((baseWeightsGiB + embeddingOverheadGiB + visionProjectorGiB).toFixed(2));
}

/**
 * Calcula la velocidad física de generación (Decode tok/s) y lectura de prompt (Prefill tok/s)
 */
function simulateSpeedForState({
  model,
  quantProfile,
  weightsGiB,
  kvCacheGiB,
  computeBufferGiB,
  availableVramGiB,
  gpu,
  ram,
  cpu
}) {
  // Cargas especiales (Imagen / Audio)
  if (model.isWorkloadType === 'image') {
    const totalReq = weightsGiB + 0.8;
    const fitsClean = totalReq <= gpu.cleanModeFreeGiB;
    const tokEquivalent = fitsClean ? 48 : 22;
    return {
      totalFootprintGiB: Number(totalReq.toFixed(2)),
      vramUsedGiB: Number(Math.min(availableVramGiB, totalReq).toFixed(2)),
      ramSpillGiB: Number(Math.max(0, totalReq - availableVramGiB).toFixed(2)),
      gpuLayers: fitsClean ? model.layers : Math.floor(model.layers * (availableVramGiB / totalReq)),
      totalLayers: model.layers,
      gpuLayerPct: Math.min(100, Math.round((availableVramGiB / totalReq) * 100)),
      decodeTokPerSec: tokEquivalent,
      prefillTokPerSec: 650,
      ttftSeconds: 1.8,
      metricUnit: ' ~7.2s / img 1024px',
      executionMode: fitsClean ? '100% GPU VRAM (NF4/Q4)' : 'Híbrido VRAM + T5 en RAM DDR5'
    };
  }

  if (model.isWorkloadType === 'audio') {
    return {
      totalFootprintGiB: 1.55,
      vramUsedGiB: 1.55,
      ramSpillGiB: 0,
      gpuLayers: model.layers,
      totalLayers: model.layers,
      gpuLayerPct: 100,
      decodeTokPerSec: 185,
      prefillTokPerSec: 2400,
      ttftSeconds: 0.15,
      metricUnit: '185 tok/s (~85x Real-Time)',
      executionMode: '100% GPU VRAM (FP16)'
    };
  }

  const totalFootprintGiB = Number((weightsGiB + kvCacheGiB + computeBufferGiB).toFixed(2));

  // Presupuesto de VRAM para pesos tras reservar el Compute Buffer y el KV Cache en GPU
  const vramForWeightsGiB = Math.max(0, availableVramGiB - kvCacheGiB - computeBufferGiB);

  let gpuLayerFraction = 0;
  if (vramForWeightsGiB >= weightsGiB) {
    gpuLayerFraction = 1.0;
  } else if (vramForWeightsGiB > 0) {
    gpuLayerFraction = Math.min(0.98, vramForWeightsGiB / weightsGiB);
  }

  const gpuLayers = Math.round(model.layers * gpuLayerFraction);
  const cpuLayers = model.layers - gpuLayers;
  const actualGpuFraction = gpuLayers / model.layers;
  const actualCpuFraction = 1 - actualGpuFraction;

  // En arquitecturas MoE (ej. Qwen3 30B-A3B), aunque el archivo pese 16 GB, por cada token solo se lee una fracción de los pesos (3.3B de 30.5B)
  const activeRatio = model.isMoE ? model.paramsActiveB / model.paramsTotalB : 1.0;
  // En MoE hay un pequeño overhead de enrutamiento de expertos (~1.18x)
  const moeRoutingFactor = model.isMoE ? 1.18 : 1.0;

  const activeWeightsPerStepGiB = weightsGiB * activeRatio * moeRoutingFactor;
  // Durante decode, además de los pesos activos se lee el KV Cache acumulado
  const activeGpuBytesGiB = activeWeightsPerStepGiB * actualGpuFraction + kvCacheGiB * actualGpuFraction;
  const activeCpuBytesGiB = activeWeightsPerStepGiB * actualCpuFraction + kvCacheGiB * actualCpuFraction;

  // Tiempo de lectura en GPU (segundos por token)
  // Eficiencia de kernel de descompresión en GPU según tipo de quant (Q4_K_M es el más optimizado en CUDA)
  const quantKernelEfficiency = quantProfile.id === 'Q4_K_M' || quantProfile.id === 'Q8_0' ? 0.92 : 0.87;
  const gpuEffectiveBW = gpu.effectiveBandwidthGBs * quantKernelEfficiency;
  const timeGpuSec = activeGpuBytesGiB > 0 ? activeGpuBytesGiB / gpuEffectiveBW : 0;

  // Tiempo de lectura en RAM DDR5 por CPU (segundos por token)
  const cpuEffectiveBW = ram.effectiveLlmBandwidthGBs * (cpu.hasAvx512 ? 0.95 : 0.82);
  const timeCpuSec = activeCpuBytesGiB > 0 ? activeCpuBytesGiB / cpuEffectiveBW : 0;

  // Latencia de sincronización PCIe cuando hay split GPU + CPU (Partial Offloading)
  const pcieSyncOverheadSec =
    actualCpuFraction > 0 && actualGpuFraction > 0
      ? 0.0022 + (0.015 / Math.max(8, gpu.pcieBandwidthGBs))
      : 0.00045;

  const totalTimePerTokenSec = timeGpuSec + timeCpuSec + pcieSyncOverheadSec;
  const decodeTokPerSec = Number((1 / Math.max(0.003, totalTimePerTokenSec)).toFixed(1));

  // Velocidad de Prefill (lectura de un prompt de 1500 tokens)
  const basePrefillGpu = (gpu.fp16Tflops * 48) / Math.max(1.5, model.paramsActiveB);
  const basePrefillCpu = (cpu.physicalCores * (cpu.hasAvx512 ? 18 : 11)) / Math.max(1.5, model.paramsActiveB);
  const prefillTokPerSec = Math.round(
    1 / (actualGpuFraction / Math.max(40, basePrefillGpu) + actualCpuFraction / Math.max(10, basePrefillCpu))
  );
  const ttftSeconds = Number((1024 / Math.max(25, prefillTokPerSec)).toFixed(2));

  const vramUsedGiB = Number(
    Math.min(availableVramGiB, weightsGiB * actualGpuFraction + kvCacheGiB * actualGpuFraction + computeBufferGiB).toFixed(2)
  );
  const ramSpillGiB = Number(Math.max(0, totalFootprintGiB - vramUsedGiB).toFixed(2));

  let executionMode = '100% GPU VRAM';
  if (actualGpuFraction === 1) {
    executionMode = '100% GPU VRAM (Velocidad Pura)';
  } else if (model.isMoE && actualGpuFraction > 0.25) {
    executionMode = `MoE Híbrido (${gpuLayers}/${model.layers} capas GPU + Expertos DDR5)`;
  } else if (actualGpuFraction >= 0.5) {
    executionMode = `Split GPU+RAM (${gpuLayers}/${model.layers} capas en GPU)`;
  } else {
    executionMode = `Mayoría en RAM DDR5 (${gpuLayers}/${model.layers} capas en GPU)`;
  }

  return {
    totalFootprintGiB,
    vramUsedGiB,
    ramSpillGiB,
    gpuLayers,
    cpuLayers,
    totalLayers: model.layers,
    gpuLayerPct: Math.round(actualGpuFraction * 100),
    decodeTokPerSec,
    prefillTokPerSec,
    ttftSeconds,
    metricUnit: `${decodeTokPerSec} tok/s`,
    executionMode
  };
}

/**
 * Calcula el techo máximo de tokens de contexto que caben 100% en VRAM sin desbordar a RAM
 */
function calculateMaxVramContextTokens(model, weightsGiB, computeBufferGiB, targetVramGiB, bytesPerKvElem = 2) {
  const remainingVramGiB = targetVramGiB - weightsGiB - computeBufferGiB;
  if (remainingVramGiB <= 0.08) return 0;
  if (!model.kvHeads || !model.headDim || !model.layers) return 32768;

  const bytesPerToken = 2 * model.layers * model.kvHeads * model.headDim * bytesPerKvElem;
  const rawMaxTokens = Math.floor((remainingVramGiB * 1024 ** 3) / bytesPerToken);
  return Math.min(model.maxNativeCtx, Math.floor(rawMaxTokens / 512) * 512);
}

/**
 * Evalúa quirúrgicamente un modelo del catálogo contra el hardware real del portátil
 */
export function evaluateModelOnHardware(model, hardware, downloadedModels = []) {
  const { cpu, ram, gpu } = hardware;
  const computeBufferGiB = model.paramsTotalB <= 9 ? 0.38 : 0.52;
  const defaultCtx = 8192;

  // Evaluar todos los perfiles de cuantización y elegir el óptimo para este portátil
  const quantEvaluations = QUANT_PROFILES.map((qp) => {
    const weightsGiB = calculateWeightsGiB(model, qp);
    const kv8kFp16GiB = calculateKvCacheGiB(model, defaultCtx, 2);
    const kv8kQ8GiB = calculateKvCacheGiB(model, defaultCtx, 1.05);

    const liveState = simulateSpeedForState({
      model,
      quantProfile: qp,
      weightsGiB,
      kvCacheGiB: kv8kFp16GiB,
      computeBufferGiB,
      availableVramGiB: gpu.freeGiB,
      gpu,
      ram,
      cpu
    });

    const cleanState = simulateSpeedForState({
      model,
      quantProfile: qp,
      weightsGiB,
      kvCacheGiB: kv8kFp16GiB,
      computeBufferGiB,
      availableVramGiB: gpu.cleanModeFreeGiB,
      gpu,
      ram,
      cpu
    });

    const maxCtxFp16Clean = calculateMaxVramContextTokens(model, weightsGiB, computeBufferGiB, gpu.cleanModeFreeGiB, 2);
    const maxCtxQ8Clean = calculateMaxVramContextTokens(model, weightsGiB, computeBufferGiB, gpu.cleanModeFreeGiB, 1.05);

    return {
      quant: qp,
      weightsGiB,
      kv8kFp16GiB,
      kv8kQ8GiB,
      computeBufferGiB,
      liveState,
      cleanState,
      maxCtxFp16Clean,
      maxCtxQ8Clean
    };
  });

  // Selección Quirúrgica del Quant Ideal:
  // 1) Si Q5_K_M o Q4_K_M entra 100% en VRAM en Vivo con al menos 8K de contexto, preferimos Q4_K_M (o Q5_K_M si sobra mucha VRAM como en 4B)
  // 2) Si en Q4_K_M se pasa por poquito pero en IQ4_XS entra 100% en Modo Limpio (caso típico de 12B), elegir IQ4_XS
  // 3) Si es un modelo grande (14B o 30B MoE), usar Q4_K_M o IQ4_XS que maximice relación calidad/velocidad
  let selectedEval = quantEvaluations.find((e) => e.quant.id === 'Q4_K_M');

  if (model.paramsTotalB <= 5.0) {
    const q6 = quantEvaluations.find((e) => e.quant.id === 'Q6_K');
    if (q6 && q6.liveState.gpuLayerPct === 100) selectedEval = q6;
  } else if (model.paramsTotalB >= 11 && !model.isMoE) {
    const q4 = quantEvaluations.find((e) => e.quant.id === 'Q4_K_M');
    const iq4 = quantEvaluations.find((e) => e.quant.id === 'IQ4_XS');
    if (q4.cleanState.gpuLayerPct < 100 && iq4) {
      selectedEval = iq4;
    }
  } else if (model.isMoE && model.paramsTotalB >= 36) {
    const iq4 = quantEvaluations.find((e) => e.quant.id === 'IQ4_XS');
    if (iq4) selectedEval = iq4;
  }

  // Simular curva de rendimiento según tamaño de ventana de contexto (4K, 8K, 16K, 32K)
  const contextCurve = [4096, 8192, 16384, 32768].map((ctxTokens) => {
    const kvFp16 = calculateKvCacheGiB(model, ctxTokens, 2);
    const sim = simulateSpeedForState({
      model,
      quantProfile: selectedEval.quant,
      weightsGiB: selectedEval.weightsGiB,
      kvCacheGiB: kvFp16,
      computeBufferGiB,
      availableVramGiB: gpu.cleanModeFreeGiB,
      gpu,
      ram,
      cpu
    });
    return {
      ctxLabel: `${ctxTokens / 1024}K`,
      ctxTokens,
      kvCacheGiB: kvFp16,
      totalGiB: sim.totalFootprintGiB,
      tokPerSec: sim.decodeTokPerSec,
      gpuLayerPct: sim.gpuLayerPct
    };
  });

  // Calcular Porcentaje Quirúrgico de Viabilidad en este Portátil (0 - 100%)
  const refSpeed = selectedEval.cleanState.decodeTokPerSec;
  const speedScore = Math.min(100, Math.round((refSpeed / 55) * 100));
  const fitScore =
    selectedEval.liveState.gpuLayerPct === 100
      ? 100
      : selectedEval.cleanState.gpuLayerPct === 100
        ? 90
        : model.isMoE
          ? 85
          : Math.max(40, selectedEval.cleanState.gpuLayerPct);
  const qualityScore = Math.round(model.sotaQualityScore * selectedEval.quant.qualityRetention);

  const surgicalFitPct = Math.min(
    99,
    Math.round(qualityScore * 0.42 + speedScore * 0.33 + fitScore * 0.25)
  );

  let tier = 'A';
  if (surgicalFitPct >= 93) tier = 'S+';
  else if (surgicalFitPct >= 88) tier = 'S';
  else if (surgicalFitPct >= 80) tier = 'A';
  else if (surgicalFitPct >= 70) tier = 'B';
  else tier = 'C';

  // Generar Diagnóstico de Comportamiento en el Portátil
  let behaviorVerdict = '';
  let optimizationTip = '';

  if (selectedEval.liveState.gpuLayerPct === 100) {
    behaviorVerdict = `ÓPTIMO EN TIEMPO REAL: Cabe 100% en tus ${gpu.freeGiB} GB de VRAM libres actuales (${selectedEval.liveState.gpuLayers}/${model.layers} capas en GPU). Sin cuellos de botella por PCIe ni RAM.`;
    if (selectedEval.maxCtxFp16Clean < 32768 && !model.isWorkloadType) {
      optimizationTip = `Soporta hasta ~${Math.round(selectedEval.maxCtxFp16Clean / 1024)}K de contexto en FP16 puro. Si activas Flash-Attention + KV Cache Q8_0, duplicas el contexto en GPU hasta ~${Math.round(selectedEval.maxCtxQ8Clean / 1024)}K tokens sin perder velocidad.`;
    } else {
      optimizationTip = `Margen térmico y de VRAM excelente en tu ${gpu.name}.`;
    }
  } else if (selectedEval.cleanState.gpuLayerPct === 100) {
    behaviorVerdict = `ALERTA DE PROCESOS EN SEGUNDO PLANO: Ahora mismo desborda ${selectedEval.liveState.ramSpillGiB} GB a RAM porque tienes ${gpu.usedGiB} GB de VRAM ocupados (${selectedEval.liveState.decodeTokPerSec} tok/s). Si cierras apps de fondo (${gpu.closableApps.slice(0, 3).join(', ')}), entra 100% en VRAM y sube a ${selectedEval.cleanState.decodeTokPerSec} tok/s.`;
    optimizationTip = `Libera los ~${gpu.reclaimableMiB} MiB de VRAM parásita antes de cargarlo o usa cuantización IQ4_XS.`;
  } else if (model.isMoE) {
    behaviorVerdict = `ARQUITECTURA MoE HÍBRIDA: Aloja ${selectedEval.cleanState.vramUsedGiB} GB en tu RTX 5050 y ${selectedEval.cleanState.ramSpillGiB} GB en tus 32GB DDR5-5600 Dual-Channel. Como solo activa ${model.paramsActiveB}B parámetros por token, vuela a ~${selectedEval.cleanState.decodeTokPerSec} tok/s pese a tener 30B totales.`;
    optimizationTip = `Aprovecha tus 2 canales DDR5-5600 (${ram.theoreticalBandwidthGBs} GB/s). Ejecuta con --n-gpu-layers ${selectedEval.cleanState.gpuLayers} y --flash-attn.`;
  } else {
    behaviorVerdict = `MODO OFFLOADING HÍBRIDO (GPU + DDR5): El modelo (${selectedEval.weightsGiB} GB) supera los 8GB físicos de tu RTX 5050. Carga ${selectedEval.cleanState.gpuLayers}/${model.layers} capas (${selectedEval.cleanState.gpuLayerPct}%) en VRAM y las ${selectedEval.cleanState.cpuLayers} restantes en tu RAM DDR5 a ~${selectedEval.cleanState.decodeTokPerSec} tok/s.`;
    optimizationTip = `Úsalo para tareas donde priorices máxima inteligencia sobre velocidad instantánea, o bájalo a Q3_K_M para meter más capas en GPU.`;
  }

  // Verificar si el usuario ya tiene este modelo descargado localmente
  const normalizedName = model.id.replace(/[^a-z0-9]/gi, '').toLowerCase();
  const matchedLocal = downloadedModels.find((dm) => {
    const dmClean = dm.id.replace(/[^a-z0-9]/gi, '').toLowerCase();
    return dmClean.includes(normalizedName) || normalizedName.includes(dmClean.split(':')[0]);
  });

  // Generar comando exacto con flags quirúrgicos para llama.cpp / Ollama
  const surgicalFlags = `--n-gpu-layers ${selectedEval.cleanState.gpuLayers} --ctx-size ${Math.min(16384, Math.max(8192, selectedEval.maxCtxQ8Clean))} --flash-attn -ctk q8_0 -ctv q8_0`;

  return {
    model,
    selectedQuant: selectedEval.quant,
    weightsGiB: selectedEval.weightsGiB,
    kv8kFp16GiB: selectedEval.kv8kFp16GiB,
    kv8kQ8GiB: selectedEval.kv8kQ8GiB,
    computeBufferGiB,
    liveState: selectedEval.liveState,
    cleanState: selectedEval.cleanState,
    maxCtxFp16Clean: selectedEval.maxCtxFp16Clean,
    maxCtxQ8Clean: selectedEval.maxCtxQ8Clean,
    contextCurve,
    surgicalFitPct,
    tier,
    behaviorVerdict,
    optimizationTip,
    surgicalFlags,
    installedLocally: Boolean(matchedLocal),
    localModelInfo: matchedLocal || null,
    allQuants: quantEvaluations
  };
}

