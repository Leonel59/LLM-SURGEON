#!/usr/bin/env node

import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

import { probeCpu, probeMemory, probeGpu, runMicroBenchmark } from './telemetry/hardware-probe.js';
import { probeLocalRuntimes, executeLiveModelSpeedTest } from './telemetry/runtime-detector.js';
import { SOTA_CATEGORIES, SOTA_MODELS } from './catalog/sota-models.js';
import { evaluateModelOnHardware } from './engine/inference-physics.js';
import { redactPrivacyPath, computeCodebaseIntegrity } from './security/security-guard.js';
import {
  ANSI,
  sleep,
  drawBar,
  padEndAnsi,
  printAsciiHeader,
  renderSecurityAuditPanel,
  runAnimatedDiagnosticBoot,
  renderHardwareRadiography,
  renderLocalRuntimesPanel,
  renderCuratedEvaluations,
  renderArtificialAnalysisLeaderboard,
  renderExecutiveSummaryTable
} from './ui/ascii-renderer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Devuelve los tokens de muestra adaptados a la categoria y arquitectura del modelo elegido (Cero emojis)
 */
function getSimulationTokensForModel(model, gpuName) {
  if (model.category === 'reasoning') {
    return [
      '<think>\n',
      'Analizando ', 'el ', 'problema ', 'de ', 'optimizacion ', 'en ', `${gpuName}...\n`,
      '1. ', 'Si ', 'usamos ', 'fuerza ', 'bruta ', 'tenemos ', 'O(n^2), ', 'inviable ', 'para ', 'n=10^6.\n',
      '2. ', 'Aplicando ', 'ventana ', 'deslizante ', '(Sliding ', 'Window) ', 'reducimos ', 'a ', 'O(n) ', 'en ', 'tiempo ', 'y ', 'O(1) ', 'en ', 'espacio.\n',
      '</think>\n\n',
      '[+] ', 'Solucion ', 'Optima ', 'Verificada:\n',
      'Para ', 'lograr ', 'complejidad ', 'lineal ', 'O(n), ', 'manten ', 'dos ', 'punteros ', 'dinamicos ', 'sobre ', 'el ', 'arreglo ', 'sin ', 'reasignar ', 'memoria.'
    ];
  }

  if (model.category === 'vision') {
    return [
      '[ViT ', 'mmproj: ', '576 ', 'Visual ', 'Tokens ', 'procesados ', 'desde ', 'captura ', '1920x1080]\n',
      '[VISION] ', 'Analisis ', 'de ', 'Interfaz ', 'y ', 'OCR:\n',
      '* ', 'Cabecera ', 'detectada: ', '"Dashboard ', 'Financiero ', '2026" ', '(Contraste ', 'WCAG ', 'AAA).\n',
      '* ', 'Alerta ', 'en ', 'Tabla ', '#2: ', 'Desbordamiento ', 'horizontal ', 'en ', 'resolucion ', 'movil ', '(<768px).\n',
      '* ', 'Sugerencia ', 'CSS: ', 'Aplicar ', 'grid-template-columns: ', 'repeat(auto-fit, ', 'minmax(240px, ', '1fr));'
    ];
  }

  if (model.category === 'general') {
    return [
      'Resumen ', 'Ejecutivo ', 'en ', 'Espanol:\n',
      'La ', 'arquitectura ', 'hibrida ', 'de ', 'tu ', 'portatil ', 'combina ', 'memoria ', 'VRAM ', 'de ', 'alta ', 'velocidad ',
      'con ', 'doble ', 'canal ', 'DDR5. ', 'Esto ', 'permite ', 'ejecutar ', 'asistentes ', 'locales ', 'con ', 'privacidad ', 'total, ',
      'cero ', 'latencia ', 'de ', 'red ', 'y ', 'capacidad ', 'de ', 'analisis ', 'de ', 'documentos ', 'extensos.'
    ];
  }

  if (model.isWorkloadType === 'audio') {
    return [
      '[00:00.00 ', '-> ', '00:03.40] ', 'Iniciando ', 'transcripcion ', 'neuronal ', 'en ', 'tiempo ', 'real ', 'con ', 'Whisper ', 'Large ', 'V3 ', 'Turbo.\n',
      '[00:03.40 ', '-> ', '00:07.80] ', 'Precision ', 'multilingue ', 'en ', 'espanol ', 'e ', 'ingles ', 'procesada ', '100% ', 'en ', 'los ', 'Tensor ', 'Cores ', 'de ', 'tu ', 'GPU.'
    ];
  }

  return [
    'export ', 'function ', 'binarySearch', '(arr, ', 'target) ', '{\n',
    '  let ', 'left ', '= ', '0, ', 'right ', '= ', 'arr.length ', '- ', '1;\n',
    '  while ', '(left ', '<= ', 'right) ', '{\n',
    '    const ', 'mid ', '= ', '(left ', '+ ', 'right) ', '>>> ', '1;\n',
    '    if ', '(arr[mid] ', '=== ', 'target) ', 'return ', 'mid;\n',
    '    arr[mid] ', '< ', 'target ', '? ', '(left = mid + 1) ', ': ', '(right = mid - 1);\n',
    '  }\n',
    '  return ', '-1; ', '// ', `${model.name} `, 'en ', `${gpuName}\n`, '}\n'
  ];
}

/**
 * Simula quirurgicamente un modelo especifico (y cuantizacion opcional) en tiempo real
 */
async function simulateSingleModelRealtime(ev, hardware, quantOverrideId = null, useLiveVramState = false) {
  const chosenQuantEval =
    (quantOverrideId && ev.allQuants.find((q) => q.quant.id.toLowerCase() === quantOverrideId.toLowerCase())) ||
    ev.allQuants.find((q) => q.quant.id === ev.selectedQuant.id) ||
    ev.allQuants[0];

  const state = useLiveVramState ? chosenQuantEval.liveState : chosenQuantEval.cleanState;
  const stateLabel = useLiveVramState
    ? `ESTADO ACTUAL EN VIVO (${hardware.gpu.freeGiB} GB VRAM Libres)`
    : `MODO QUIRURGICO LIMPIO (${hardware.gpu.cleanModeFreeGiB} GB VRAM Libres)`;

  console.log(`\n  ${ANSI.bgCyan}${ANSI.bold} [SIM] SIMULADOR FISICO EN TIEMPO REAL: ${ev.model.name.toUpperCase()} (${chosenQuantEval.quant.id}) ${ANSI.reset}`);
  console.log(`  ${ANSI.white}├─ Escenario:${ANSI.reset}       ${ANSI.brightYellow}${stateLabel}${ANSI.reset}`);
  console.log(
    `  ${ANSI.white}├─ Reparto Capas:${ANSI.reset}   ${ANSI.brightGreen}${state.gpuLayers}/${ev.model.layers} capas en GPU (${state.gpuLayerPct}%)${ANSI.reset}` +
      (state.ramSpillGiB > 0
        ? ` + ${ANSI.brightYellow}${state.totalLayers - state.gpuLayers} capas en RAM DDR5 (${state.ramSpillGiB} GB spill)${ANSI.reset}`
        : ' :: 0 GB spill a RAM')
  );
  console.log(
    `  ${ANSI.white}├─ Huella Memoria:${ANSI.reset}  Pesos: ${ANSI.white}${chosenQuantEval.weightsGiB} GB${ANSI.reset} │ Total con KV(8K): ${ANSI.bold}${state.totalFootprintGiB} GB${ANSI.reset} (VRAM usada: ${state.vramUsedGiB} GB)`
  );
  console.log(
    `  ${ANSI.white}└─ Velocidad Fisica:${ANSI.reset} Decode: ${ANSI.brightGreen}${ANSI.bold}~${state.decodeTokPerSec} tok/s${ANSI.reset} (${Math.round(1000 / Math.max(1, state.decodeTokPerSec))} ms/token) │ Prefill: ~${state.prefillTokPerSec} tok/s (TTFT: ${state.ttftSeconds}s)\n`
  );

  // Caso especial: Generacion de imagen por difusion (FLUX.1)
  if (ev.model.isWorkloadType === 'image') {
    const totalSteps = 4;
    const secPerStep = state.gpuLayerPct === 100 ? 1.65 : 2.35;
    console.log(`    ${ANSI.brightMagenta}[DIFFUSION] Simulando Pipeline Rectified Flow (1024x1024 :: ${totalSteps} pasos en ${hardware.gpu.name}):${ANSI.reset}`);
    for (let step = 1; step <= totalSteps; step++) {
      const subTicks = 10;
      for (let t = 1; t <= subTicks; t++) {
        const pct = Math.round((((step - 1) * subTicks + t) / (totalSteps * subTicks)) * 100);
        process.stdout.write(
          `\r    ${ANSI.brightCyan}[>] Paso Denoising ${step}/${totalSteps}${ANSI.reset} ${drawBar(pct, 26)} ${ANSI.bold}${pct}%${ANSI.reset} │ ${(step * secPerStep * (t / subTicks)).toFixed(1)}s transcurridos`
        );
        await sleep(Math.round((secPerStep * 1000) / subTicks));
      }
    }
    console.log(`\n    ${ANSI.brightGreen}[+] Imagen 1024x1024 generada y decodificada por VAE en ~${(totalSteps * secPerStep).toFixed(1)} segundos.${ANSI.reset}\n`);
    return;
  }

  // 1) Simular pausa real de Prefill / Time-To-First-Token (TTFT)
  const ttftMs = Math.min(2200, Math.max(180, Math.round(state.ttftSeconds * 600)));
  process.stdout.write(
    `    ${ANSI.brightYellow}[...] [Fase Prefill / Lectura de Prompt]${ANSI.reset} Procesando contexto inicial a ~${state.prefillTokPerSec} tok/s (TTFT ~${state.ttftSeconds}s)...`
  );
  await sleep(ttftMs);
  process.stdout.write(`\r    ${ANSI.brightGreen}[+] [Prefill Completado en ${state.ttftSeconds}s]${ANSI.reset} Iniciando generacion token a token a ${ANSI.bold}${state.decodeTokPerSec} tok/s${ANSI.reset}:                    \n\n`);

  // 2) Streaming token por token con cadencia exacta en milisegundos
  const tokens = getSimulationTokensForModel(ev.model, hardware.gpu.name);
  const delayPerTokenMs = Math.max(6, Math.round(1000 / Math.max(1, state.decodeTokPerSec)));

  console.log(
    `    ${ANSI.gray}┌── [ Cadencia en Vivo: ~${state.decodeTokPerSec} tok/s (${delayPerTokenMs} ms/tok) :: ${state.executionMode} ] ──────────┐${ANSI.reset}`
  );
  process.stdout.write('    ');

  let insideThink = false;
  let generatedCount = 0;
  const startStream = performance.now();

  for (const tok of tokens) {
    if (tok.includes('<think>')) insideThink = true;
    const color = insideThink ? `${ANSI.dim}${ANSI.yellow}` : ANSI.brightGreen;
    process.stdout.write(`${color}${tok}${ANSI.reset}`);
    if (tok.includes('</think>')) insideThink = false;

    if (tok.includes('\n')) {
      process.stdout.write('    ');
    }
    generatedCount++;
    await sleep(delayPerTokenMs);
  }

  const totalStreamSec = ((performance.now() - startStream) / 1000).toFixed(2);
  console.log(
    `\n    ${ANSI.gray}└── [ Fin del Stream: ${generatedCount} tokens en ${totalStreamSec}s :: Promedio real: ~${state.decodeTokPerSec} tok/s ] ───────────────────┘${ANSI.reset}\n`
  );
}

/**
 * Muestra la lista numerada de los 22 modelos SOTA para que el usuario elija cual simular o inspeccionar
 */
function printCompactModelSelectorList(sortedEvaluations) {
  console.log(`\n  ${ANSI.brightCyan}${ANSI.bold}[LISTA] CATALOGO DE MODELOS RECOMENDADOS DISPONIBLES PARA SELECCION [1 - ${sortedEvaluations.length}]:${ANSI.reset}`);
  sortedEvaluations.forEach((ev, idx) => {
    const num = String(idx + 1).padStart(2);
    const speedColor =
      ev.cleanState.decodeTokPerSec >= 45
        ? ANSI.brightGreen
        : ev.cleanState.decodeTokPerSec >= 20
          ? ANSI.brightCyan
          : ANSI.brightYellow;

    console.log(
      `    ${ANSI.brightCyan}[${num}]${ANSI.reset} ${padEndAnsi(ANSI.bold + ANSI.white + ev.model.name + ANSI.reset, 40)} │ ${padEndAnsi(ANSI.brightCyan + ev.selectedQuant.id + ANSI.reset, 15)} │ ${padEndAnsi(`${speedColor}~${ev.cleanState.decodeTokPerSec} tok/s${ANSI.reset}`, 22)} │ ${ANSI.white}${ev.cleanState.executionMode}${ANSI.reset}`
    );
  });
}

/**
 * Prueba de estres en RAM + Simulacion del modelo por defecto cuando se invoca por flag --stress
 */
async function runInteractiveSyntheticStressTest(sortedEvaluations, hardware, targetModelIndex = 0) {
  console.log(`\n${ANSI.bgCyan}${ANSI.bold} [BENCH] EJECUTANDO BENCHMARK DE ESTRES EN MEMORIA & SIMULACION DE STREAMING EN VIVO ${ANSI.reset}`);
  console.log(`${ANSI.gray}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${ANSI.reset}`);

  const blockBytes = 128 * 1024 * 1024;
  const arrA = new Float64Array(blockBytes / 8);
  const arrB = new Float64Array(blockBytes / 8);
  arrA.fill(3.14159265);

  process.stdout.write(`  ${ANSI.brightCyan}[>] Estresando bus Dual-Channel ${hardware.ram.memType}-${hardware.ram.speedMTs}...${ANSI.reset} `);
  const t0 = performance.now();
  const rounds = 12;
  for (let r = 0; r < rounds; r++) {
    arrB.set(arrA);
  }
  const elapsed = (performance.now() - t0) / 1000;
  const gbs = Number(((blockBytes * 2 * rounds) / 1024 ** 3 / elapsed).toFixed(1));
  console.log(`${ANSI.brightGreen}[+] ${gbs} GB/s medidos en hilo unico V8 (Bus Dual-Channel: ${hardware.ram.theoreticalBandwidthGBs} GB/s pico)${ANSI.reset}`);

  const chosenEv = sortedEvaluations[targetModelIndex] || sortedEvaluations[0];
  await simulateSingleModelRealtime(chosenEv, hardware);
}

/**
 * Muestra el desglose quirurgico de las 6 cuantizaciones (Q8_0 a Q3_K_M) de un modelo especifico
 */
function renderModelQuantizationDeepDive(ev) {
  console.log(`\n${ANSI.bgBlue}${ANSI.bold} [QUANTS] INSPECCION QUIRURGICA DE CUANTIZACIONES: ${ev.model.name.toUpperCase()} ${ANSI.reset}`);
  console.log(`${ANSI.gray}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${ANSI.reset}`);
  console.log(
    `  ${padEndAnsi(ANSI.bold + 'QUANT' + ANSI.reset, 10)}` +
      `${padEndAnsi(ANSI.bold + 'BPW' + ANSI.reset, 8)}` +
      `${padEndAnsi(ANSI.bold + 'PESOS' + ANSI.reset, 10)}` +
      `${padEndAnsi(ANSI.bold + 'TOTAL(8K)' + ANSI.reset, 12)}` +
      `${padEndAnsi(ANSI.bold + 'CAPAS GPU' + ANSI.reset, 16)}` +
      `${padEndAnsi(ANSI.bold + 'VELOCIDAD' + ANSI.reset, 15)}` +
      `${padEndAnsi(ANSI.bold + 'CTX MAX GPU' + ANSI.reset, 16)}` +
      `${ANSI.bold}CALIDAD RETENIDA${ANSI.reset}`
  );
  console.log(`  ${ANSI.gray}${'─'.repeat(106)}${ANSI.reset}`);

  for (const qEval of ev.allQuants) {
    const isSelected = qEval.quant.id === ev.selectedQuant.id;
    const prefix = isSelected ? `${ANSI.brightGreen}* ` : '  ';
    const layersStr =
      qEval.cleanState.gpuLayerPct === 100
        ? `${ANSI.brightGreen}${qEval.cleanState.gpuLayers}/${ev.model.layers} (100%)${ANSI.reset}`
        : `${ANSI.brightYellow}${qEval.cleanState.gpuLayers}/${ev.model.layers} (${qEval.cleanState.gpuLayerPct}%)${ANSI.reset}`;

    const ctxStr =
      qEval.maxCtxFp16Clean >= 1024
        ? `${Math.round(qEval.maxCtxFp16Clean / 1024)}K (${Math.round(qEval.maxCtxQ8Clean / 1024)}K Q8)`
        : 'Spill a RAM';

    console.log(
      `${prefix}${padEndAnsi(ANSI.bold + qEval.quant.id + ANSI.reset, 8)}` +
        `${padEndAnsi(`${qEval.quant.bpw}`, 8)}` +
        `${padEndAnsi(`${qEval.weightsGiB} GB`, 10)}` +
        `${padEndAnsi(`${qEval.cleanState.totalFootprintGiB} GB`, 12)}` +
        `${padEndAnsi(layersStr, 16)}` +
        `${padEndAnsi(`~${qEval.cleanState.decodeTokPerSec} tok/s`, 15)}` +
        `${padEndAnsi(ctxStr, 16)}` +
        `${(qEval.quant.qualityRetention * 100).toFixed(1)}% ${isSelected ? `${ANSI.brightGreen}[OPTIMO PARA TU PC]${ANSI.reset}` : ''}`
    );
  }
  console.log('');
}

/**
 * Exporta el diagnostico completo a un archivo Markdown limpio y libre de PII (sin usuarios ni seriales)
 */
function exportMarkdownReport(hardware, runtimes, evaluations, outPath) {
  const lines = [
    `# Diagnostico Quirurgico de IA Local -- LLM-Surgeon v2.0`,
    `> **Inspirado en:** CanIRun.ai + ArtificialAnalysis.ai + llmfit.org | **Seguridad:** 0 Telemetria, 0 Dependencias, Rutas Anonimizadas | **Equipo:** ${hardware.cpu.model} + ${hardware.gpu.name}`,
    ``,
    `## 1. Radiografia Fisica del Hardware`,
    `- **CPU:** ${hardware.cpu.model} (${hardware.cpu.physicalCores}C/${hardware.cpu.logicalThreads}T @ ${hardware.cpu.maxClockGhz} GHz, L3 ${hardware.cpu.l3CacheMB} MB, \`${hardware.cpu.simdSupport}\`)`,
    `- **RAM Fisica:** ${hardware.ram.physicalHardwareGB} GB (${hardware.ram.memType} @ ${hardware.ram.speedMTs} MT/s :: ${hardware.ram.channelTopology})`,
    `- **RAM Visible en OS:** ${hardware.ram.osVisibleGB} GB (${hardware.ram.osFreeGB} GB libres) :: Reserva iGPU UMA: ~${hardware.ram.umaReservedGB} GB`,
    `- **Ancho de Banda RAM:** ${hardware.ram.theoreticalBandwidthGBs} GB/s pico / ~${hardware.ram.effectiveLlmBandwidthGBs} GB/s sostenidos en inferencia CPU`,
    `- **GPU Dedicada:** ${hardware.gpu.name} (${hardware.gpu.arch}, ${hardware.gpu.cudaCores} CUDA Cores, ${hardware.gpu.vramType} @ ~${hardware.gpu.bandwidthGBs} GB/s, PCIe Gen ${hardware.gpu.pcieGen} x${hardware.gpu.pcieWidth})`,
    `- **VRAM en Vivo vs Limpio:** ${hardware.gpu.freeGiB} GB libres ahora (${hardware.gpu.usedMiB} MiB ocupados por ${hardware.gpu.backgroundProcessesCount} procesos) -> **${hardware.gpu.cleanModeFreeGiB} GB libres en Modo Quirurgico Limpio**`,
    ``,
    `## 2. Matriz SOTA Frente a Tu Portatil`,
    `| # | Modelo IA | Categoria | Progress Index (AA) | Quant Ideal | Huella (8K) | Capas GPU | Velocidad | Contexto 100% GPU | Fit Score |`,
    `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |`
  ];

  const sorted = [...evaluations].sort((a, b) => b.surgicalFitPct - a.surgicalFitPct);
  sorted.forEach((ev, idx) => {
    const ctxTxt = ev.model.isWorkloadType
      ? 'N/A'
      : ev.maxCtxQ8Clean >= 1024
        ? `${Math.round(ev.maxCtxFp16Clean / 1024)}K (${Math.round(ev.maxCtxQ8Clean / 1024)}K Q8)`
        : 'Offload DDR5';
    const aaScore = ev.model.aaProgressIndex || 'N/A';
    lines.push(
      `| ${idx + 1} | **${ev.model.name}** | ${ev.model.category} | ${aaScore} | \`${ev.selectedQuant.id}\` | ${ev.cleanState.totalFootprintGiB} GB | ${ev.cleanState.gpuLayers}/${ev.model.layers} (${ev.cleanState.gpuLayerPct}%) | **~${ev.cleanState.decodeTokPerSec} tok/s** | ${ctxTxt} | **${ev.tier} (${ev.surgicalFitPct}%)** |`
    );
  });

  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--version') || args.includes('-v')) {
    console.log('llm-surgeon v2.0.0 (Zero-Dependency Surgical AI Hardware Diagnostic CLI)');
    return;
  }

  if (args.includes('--help') || args.includes('-h')) {
    printAsciiHeader();
    console.log(`  ${ANSI.bold}${ANSI.brightCyan}USO GLOBAL EN TERMINAL:${ANSI.reset}`);
    console.log(`    ${ANSI.brightGreen}llm-surgeon${ANSI.reset}                        Inicia el escaner completo + Laboratorio Interactivo`);
    console.log(`    ${ANSI.brightGreen}llm-surgeon --fast${ANSI.reset}                 Diagnostico instantaneo sin animacion de carga`);
    console.log(`    ${ANSI.brightGreen}llm-surgeon --simulate=1vs13${ANSI.reset}       Simula en vivo el modelo #1 contra el #13`);
    console.log(`    ${ANSI.brightGreen}llm-surgeon --inspect=k2-horizon-7b${ANSI.reset} Muestra las 6 cuantizaciones (Q8_0 a Q3_K_M)`);
    console.log(`    ${ANSI.brightGreen}llm-surgeon --security-audit${ANSI.reset}       Muestra el Certificado Zero-Trust y firmas SHA-256`);
    console.log(`    ${ANSI.brightGreen}llm-surgeon --offline${ANSI.reset}              Desactiva incluso las consultas locales 127.0.0.1`);
    console.log(`    ${ANSI.brightGreen}llm-surgeon --export${ANSI.reset}               Exporta DIAGNOSTICO-QUIRURGICO-IA.md en la carpeta actual\n`);
    return;
  }

  const fastMode = args.includes('--fast');
  const offlineMode = args.includes('--offline');
  const securityAuditFlag = args.includes('--security-audit') || args.includes('--verify');
  const explicitExport = args.includes('--export');
  const noExport = args.includes('--no-export');
  const nonInteractive = args.includes('--no-prompt') || !process.stdin.isTTY;
  const runStressFlag = args.includes('--stress') || args.includes('--bench');
  const inspectModelArg = args.find((a) => a.startsWith('--inspect='))?.split('=')[1];
  const simulateModelArg = args.find((a) => a.startsWith('--simulate='))?.split('=')[1];

  printAsciiHeader();

  const integrity = computeCodebaseIntegrity(__dirname);
  if (securityAuditFlag) {
    renderSecurityAuditPanel(integrity, offlineMode);
    if (args.includes('--only-audit')) return;
  }

  let cpu;
  let ram;
  let gpu;
  let microBench;
  let runtimes;
  let evaluations = [];

  const bootSteps = [
    {
      title: 'Sondeando Topologia de CPU, Cache L3 & Set de Instrucciones Vectoriales (AVX-512/AVX2)...',
      action: async () => {
        cpu = probeCpu();
        return {
          summaryLine: `${ANSI.brightGreen}${cpu.model}${ANSI.reset} (${cpu.physicalCores}C/${cpu.logicalThreads}T :: L3 ${cpu.l3CacheMB}MB :: ${cpu.hasAvx512 ? 'AVX-512 Activo' : 'AVX2 Activo'})`
        };
      }
    },
    {
      title: 'Auditando Modulos DIMM Fisicos, Canales DDR5 y Reserva UMA de Graficos Integrados...',
      action: async () => {
        ram = probeMemory(cpu);
        return {
          summaryLine: `${ANSI.brightGreen}${ram.physicalHardwareGB} GB ${ram.memType}-${ram.speedMTs} ${ram.channelTopology}${ANSI.reset} (${ram.theoreticalBandwidthGBs} GB/s pico :: ${ram.osVisibleGB} GB visibles OS + ${ram.umaReservedGB} GB UMA iGPU)`
        };
      }
    },
    {
      title: 'Inspeccionando Bus PCIe, GPU Dedicada (NVML) y Procesos WDDM Consumidores de VRAM...',
      action: async () => {
        gpu = probeGpu();
        return {
          summaryLine: `${ANSI.brightGreen}${gpu.name}${ANSI.reset} :: Bus ~${gpu.bandwidthGBs} GB/s :: VRAM Libre: ${ANSI.brightYellow}${gpu.freeGiB} GB ahora${ANSI.reset} (${ANSI.brightGreen}${gpu.cleanModeFreeGiB} GB en Modo Limpio${ANSI.reset} tras cerrar ${gpu.closableApps.length} apps)`
        };
      }
    },
    {
      title: 'Ejecutando Micro-Benchmark Fisico de Ancho de Banda en Memoria y Latencia FMA...',
      action: async () => {
        microBench = runMicroBenchmark();
        return {
          summaryLine: `Streaming en RAM (1-hilo): ${ANSI.brightCyan}${microBench.measuredSingleThreadMemGBs} GB/s${ANSI.reset} :: Latencia Tensor Dot-Product: ${ANSI.brightGreen}${microBench.dotProductLatencyMs} ms [${microBench.checksum}]${ANSI.reset}`
        };
      }
    },
    {
      title: 'Rastreando Motores Locales (Ollama API/Disco & LM Studio Server/GGUF)...',
      action: async () => {
        runtimes = await probeLocalRuntimes(offlineMode);
        return {
          summaryLine: `Ollama: ${runtimes.ollama.installed ? ANSI.brightGreen + 'INSTALADO' + ANSI.reset : ANSI.brightYellow + 'No instalado' + ANSI.reset} :: LM Studio: ${runtimes.lmStudio.installed ? ANSI.brightGreen + 'INSTALADO' + ANSI.reset : ANSI.brightYellow + 'No instalado' + ANSI.reset} :: Modelos en disco: ${ANSI.bold}${runtimes.allDownloadedModels.length}${ANSI.reset}`
        };
      }
    },
    {
      title: 'Calculando Ecuaciones de KV-Cache (GQA), Capas GPU y Curvas de Contexto (4K-32K)...',
      action: async () => {
        const hardware = { cpu, ram, gpu, microBench };
        evaluations = SOTA_MODELS.map((m) =>
          evaluateModelOnHardware(m, hardware, runtimes.allDownloadedModels)
        );
        return {
          summaryLine: `${ANSI.brightGreen}${evaluations.length} Modelos SOTA Elite simulados quirurgicamente${ANSI.reset} a traves de 6 cuantizaciones (Q8_0 a Q3_K_M).`
        };
      }
    }
  ];

  await runAnimatedDiagnosticBoot(bootSteps, fastMode);

  const hardware = { cpu, ram, gpu, microBench };

  renderHardwareRadiography(hardware);
  renderLocalRuntimesPanel(runtimes);
  renderCuratedEvaluations(SOTA_CATEGORIES, evaluations, hardware);
  renderArtificialAnalysisLeaderboard(evaluations, hardware);
  const sortedEvaluations = renderExecutiveSummaryTable(evaluations, hardware);

  if (!noExport) {
    const targetDir = explicitExport ? process.cwd() : path.resolve(__dirname, '..');
    const reportPath = path.join(targetDir, 'DIAGNOSTICO-QUIRURGICO-IA.md');
    exportMarkdownReport(hardware, runtimes, evaluations, reportPath);
    console.log(
      `  ${ANSI.white}[FILE] Reporte quirurgico (anonimizado sin PII) exportado a:${ANSI.reset} ${ANSI.brightCyan}${redactPrivacyPath(reportPath)}${ANSI.reset}\n`
    );
  }

  if (inspectModelArg) {
    const found = sortedEvaluations.find((e) => e.model.id.includes(inspectModelArg.toLowerCase()));
    if (found) renderModelQuantizationDeepDive(found);
  }

  if (simulateModelArg) {
    const simParts = simulateModelArg
      .split(/vs|,/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const part of simParts) {
      const idx = parseInt(part, 10);
      const found =
        !Number.isNaN(idx) && idx >= 1 && idx <= sortedEvaluations.length
          ? sortedEvaluations[idx - 1]
          : sortedEvaluations.find((e) => e.model.id.includes(part.toLowerCase()));
      if (found) await simulateSingleModelRealtime(found, hardware);
    }
  }

  if (runStressFlag) {
    await runInteractiveSyntheticStressTest(sortedEvaluations, hardware, 0);
  }

  if (!nonInteractive) {
    const rl = readline.createInterface({ input, output });
    try {
      console.log(`${ANSI.bgMagenta}${ANSI.bold} [06] LABORATORIO INTERACTIVO DE SIMULACION DE MODELOS, CUANTIZACION Y BENCHMARK ${ANSI.reset}`);

      while (true) {
        console.log(
          `\n  ${ANSI.brightCyan}┌── MENU DEL LABORATORIO QUIRURGICO ────────────────────────────────────────────────────────────────────┐${ANSI.reset}`
        );
        console.log(
          `  ${ANSI.brightCyan}│${ANSI.reset}  ${ANSI.bold}${ANSI.brightGreen}[s]${ANSI.reset} Simular en Vivo CUALQUIER Modelo del Catalogo [1-${sortedEvaluations.length}] (o duelo ej: 1 vs 13)                   ${ANSI.brightCyan}│${ANSI.reset}`
        );
        console.log(
          `  ${ANSI.brightCyan}│${ANSI.reset}  ${ANSI.bold}${ANSI.brightYellow}[q]${ANSI.reset} Inspeccionar Tabla de 6 Cuantizaciones (Q8_0 a Q3_K_M) del modelo que elijas                   ${ANSI.brightCyan}│${ANSI.reset}`
        );
        console.log(
          `  ${ANSI.brightCyan}│${ANSI.reset}  ${ANSI.bold}${ANSI.brightCyan}[l]${ANSI.reset} Ver Leaderboard Artificial Analysis (Small 4B-40B & Tiny <=4B) frente a tu Portatil            ${ANSI.brightCyan}│${ANSI.reset}`
        );
        console.log(
          `  ${ANSI.brightCyan}│${ANSI.reset}  ${ANSI.bold}${ANSI.brightMagenta}[b]${ANSI.reset} Benchmark Fisico de Estres del Bus Dual-Channel DDR5-5600                                     ${ANSI.brightCyan}│${ANSI.reset}`
        );
        if (runtimes.allDownloadedModels.length > 0) {
          console.log(
            `  ${ANSI.brightCyan}│${ANSI.reset}  ${ANSI.bold}${ANSI.brightCyan}[r]${ANSI.reset} Ejecutar Test de Velocidad REAL sobre tus ${runtimes.allDownloadedModels.length} modelo(s) descargados en Ollama/LM Studio        ${ANSI.brightCyan}│${ANSI.reset}`
          );
        }
        console.log(
          `  ${ANSI.brightCyan}│${ANSI.reset}  ${ANSI.bold}${ANSI.white}[a]${ANSI.reset} Ver Certificado de Seguridad Zero-Trust y Hashes SHA-256                                      ${ANSI.brightCyan}│${ANSI.reset}`
        );
        console.log(
          `  ${ANSI.brightCyan}│${ANSI.reset}  ${ANSI.bold}${ANSI.gray}[Enter / 0]${ANSI.reset} Salir del Laboratorio                                                                 ${ANSI.brightCyan}│${ANSI.reset}`
        );
        console.log(
          `  ${ANSI.brightCyan}└───────────────────────────────────────────────────────────────────────────────────────────────────────┘${ANSI.reset}`
        );

        const mainChoice = (
          await rl.question(`  ${ANSI.brightYellow}[>] Selecciona una opcion (o escribe directamente el numero [1-${sortedEvaluations.length}] de un modelo para simularlo): ${ANSI.reset}`)
        )
          .trim()
          .toLowerCase();

        if (!mainChoice || mainChoice === '0' || mainChoice === 'exit' || mainChoice === 'salir') {
          console.log(`\n  ${ANSI.brightGreen}[+] Cerrando LLM-Surgeon. Sesion finalizada.${ANSI.reset}\n`);
          break;
        }

        const directNum = parseInt(mainChoice, 10);
        if (!Number.isNaN(directNum) && directNum >= 1 && directNum <= sortedEvaluations.length && !mainChoice.includes('vs')) {
          await simulateSingleModelRealtime(sortedEvaluations[directNum - 1], hardware);
          continue;
        }

        if (mainChoice === 's' || mainChoice.includes('vs')) {
          let modelInput = mainChoice;
          if (mainChoice === 's') {
            printCompactModelSelectorList(sortedEvaluations);
            modelInput = (
              await rl.question(
                `\n  ${ANSI.brightYellow}[>] Que modelo [1-${sortedEvaluations.length}] quieres simular en vivo? (Tip: escribe "1 vs 13" o "4 vs 17" para comparar dos seguidos): ${ANSI.reset}`
              )
            )
              .trim()
              .toLowerCase();
          }

          if (!modelInput) continue;

          const parts = modelInput
            .split(/vs|,|-/)
            .map((p) => parseInt(p.trim(), 10))
            .filter((n) => !Number.isNaN(n) && n >= 1 && n <= sortedEvaluations.length);

          if (parts.length >= 2) {
            console.log(
              `\n  ${ANSI.bgMagenta}${ANSI.bold} [VS] MODO DUELO QUIRURGICO: [${parts[0]}] ${sortedEvaluations[parts[0] - 1].model.name}  VS  [${parts[1]}] ${sortedEvaluations[parts[1] - 1].model.name} ${ANSI.reset}`
            );
            await simulateSingleModelRealtime(sortedEvaluations[parts[0] - 1], hardware);
            await simulateSingleModelRealtime(sortedEvaluations[parts[1] - 1], hardware);
          } else if (parts.length === 1) {
            const chosenEv = sortedEvaluations[parts[0] - 1];
            const modeAns = (
              await rl.question(
                `  ${ANSI.white}En que condicion quieres simular ${ANSI.brightCyan}${chosenEv.model.name}${ANSI.white}? [Enter = Quant Optimo ${chosenEv.selectedQuant.id} Limpio | "live" = Con apps abiertas | o Q8_0, Q6_K, Q5_K_M, Q4_K_M, IQ4_XS, Q3_K_M]: ${ANSI.reset}`
              )
            )
              .trim()
              .toUpperCase();

            const useLive = modeAns === 'LIVE';
            const customQuant = ['Q8_0', 'Q6_K', 'Q5_K_M', 'Q4_K_M', 'IQ4_XS', 'Q3_K_M'].includes(modeAns)
              ? modeAns
              : null;

            await simulateSingleModelRealtime(chosenEv, hardware, customQuant, useLive);
          } else {
            console.log(`  ${ANSI.brightRed}[!] Numero de modelo no valido. Elige entre 1 y ${sortedEvaluations.length}.${ANSI.reset}`);
          }
          continue;
        }

        if (mainChoice === 'q') {
          printCompactModelSelectorList(sortedEvaluations);
          const qInput = (
            await rl.question(
              `\n  ${ANSI.brightYellow}[>] De que modelo [1-${sortedEvaluations.length}] quieres ver la tabla de las 6 cuantizaciones (Q8_0 a Q3_K_M)? ${ANSI.reset}`
            )
          ).trim();
          const qIdx = parseInt(qInput, 10);
          if (!Number.isNaN(qIdx) && qIdx >= 1 && qIdx <= sortedEvaluations.length) {
            renderModelQuantizationDeepDive(sortedEvaluations[qIdx - 1]);
          } else {
            console.log(`  ${ANSI.brightRed}[!] Seleccion invalida.${ANSI.reset}`);
          }
          continue;
        }

        if (mainChoice === 'l') {
          renderArtificialAnalysisLeaderboard(evaluations, hardware);
          continue;
        }

        if (mainChoice === 'b') {
          await runInteractiveSyntheticStressTest(sortedEvaluations, hardware, 0);
          continue;
        }

        if (mainChoice === 'a') {
          renderSecurityAuditPanel(integrity, offlineMode);
          continue;
        }

        if (mainChoice === 'r' && runtimes.allDownloadedModels.length > 0) {
          console.log(`\n  ${ANSI.brightGreen}[+] Modelos descargados en tu PC:${ANSI.reset}`);
          runtimes.allDownloadedModels.forEach((m, i) => {
            console.log(`    [${i + 1}] ${ANSI.bold}${m.id}${ANSI.reset} (${m.provider})`);
          });
          const rInput = (
            await rl.question(`  ${ANSI.brightYellow}[>] Elige el modelo descargado [1-${runtimes.allDownloadedModels.length}]: ${ANSI.reset}`)
          ).trim();
          const rIdx = parseInt(rInput, 10);
          if (!Number.isNaN(rIdx) && rIdx >= 1 && rIdx <= runtimes.allDownloadedModels.length) {
            const chosen = runtimes.allDownloadedModels[rIdx - 1];
            console.log(
              `\n  ${ANSI.brightCyan}[>] Iniciando Test de Velocidad Real contra ${ANSI.bold}${chosen.id}${ANSI.reset} (${chosen.provider})...`
            );
            const result = await executeLiveModelSpeedTest(chosen, (tokCount, liveSpeed, tokenText) => {
              process.stdout.write(
                `\r  ${ANSI.brightGreen}[STREAM] Generando:${ANSI.reset} ${tokCount} tokens │ Velocidad en vivo: ${ANSI.bold}${ANSI.brightCyan}${liveSpeed} tok/s${ANSI.reset} │ Ultimo token: ${JSON.stringify(tokenText.slice(0, 12))}   `
              );
            });
            console.log('');
            if (result.success) {
              console.log(`\n  ${ANSI.bgGreen}${ANSI.bold} [RESULTADO DEL TEST DE VELOCIDAD FISICO :: ${result.modelId}] ${ANSI.reset}`);
              console.log(`  ├─ Velocidad de Generacion (Decode): ${ANSI.brightGreen}${ANSI.bold}${result.decodeTokPerSec} tok/s${ANSI.reset}`);
              console.log(`  ├─ Velocidad de Lectura (Prefill):   ${ANSI.brightCyan}${result.prefillTokPerSec} tok/s${ANSI.reset} (TTFT: ${result.ttftMs} ms)`);
              console.log(`  └─ Pico de VRAM Medido:              ${ANSI.white}${result.peakVramMiB} MiB${ANSI.reset} (+${result.vramDeltaMiB} MiB durante inferencia)\n`);
            } else {
              console.log(`\n  ${ANSI.brightRed}[ERROR] Fallo en el test en vivo:${ANSI.reset} ${result.error}\n`);
            }
          }
          continue;
        }

        console.log(`  ${ANSI.brightRed}[!] Opcion no reconocida. Usa [s], [q], [l], [b], [a], un numero [1-${sortedEvaluations.length}] o [Enter] para salir.${ANSI.reset}`);
      }
    } finally {
      rl.close();
    }
  }
}

main().catch((err) => {
  console.error(`${ANSI.brightRed}[FATAL] Error en LLM-Surgeon:${ANSI.reset}`, err);
  process.exit(1);
});
