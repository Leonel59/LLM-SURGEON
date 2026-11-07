import os from 'node:os';
import { performance } from 'node:perf_hooks';
import { safeExecFile } from '../security/security-guard.js';

/**
 * Base de datos quirúrgica de especificaciones físicas de GPUs NVIDIA/AMD/Apple Silicon
 * Incluye ancho de banda real de bus (GB/s), CUDA/GPU Cores, Arquitectura, Tensor Cores y TGP típico.
 */
const GPU_SPECS_DB = [
  {
    match: /RTX 5050 Laptop/i,
    arch: 'NVIDIA Blackwell (GB207)',
    cudaCores: 2560,
    tensorGen: '5ta Gen (FP8/FP4/INT4)',
    vramType: 'GDDR7 (128-bit)',
    bandwidthGBs: 384,
    fp16Tflops: 28.5,
    typicalTgpW: 75,
    notes: 'Arquitectura Blackwell portátil con soporte nativo FlashAttention-2 y cuantización FP8/Q4 de alta eficiencia.'
  },
  {
    match: /RTX 5060 Laptop/i,
    arch: 'NVIDIA Blackwell (GB206)',
    cudaCores: 3328,
    tensorGen: '5ta Gen (FP8/FP4)',
    vramType: 'GDDR7 (128-bit)',
    bandwidthGBs: 448,
    fp16Tflops: 36.0,
    typicalTgpW: 100,
    notes: 'Excelente ancho de banda GDDR7 para modelos de 7B a 14B.'
  },
  {
    match: /RTX 5070 Ti Laptop/i,
    arch: 'NVIDIA Blackwell',
    cudaCores: 5888,
    tensorGen: '5ta Gen (FP8/FP4)',
    vramType: 'GDDR7 (192-bit)',
    bandwidthGBs: 672,
    fp16Tflops: 55.0,
    typicalTgpW: 140,
    notes: 'Gama alta portátil capaz de correr 14B-32B en VRAM.'
  },
  {
    match: /RTX 5070 Laptop/i,
    arch: 'NVIDIA Blackwell',
    cudaCores: 4608,
    tensorGen: '5ta Gen (FP8/FP4)',
    vramType: 'GDDR7 (128-bit)',
    bandwidthGBs: 448,
    fp16Tflops: 44.0,
    typicalTgpW: 115,
    notes: 'Potencia de cómputo alta limitada por bus de 128 bits.'
  },
  {
    match: /RTX 5080 Laptop/i,
    arch: 'NVIDIA Blackwell (GB203)',
    cudaCores: 7680,
    tensorGen: '5ta Gen (FP8/FP4)',
    vramType: 'GDDR7 (256-bit)',
    bandwidthGBs: 896,
    fp16Tflops: 75.0,
    typicalTgpW: 150,
    notes: 'Estación de trabajo portátil extrema.'
  },
  {
    match: /RTX 5090 Laptop/i,
    arch: 'NVIDIA Blackwell (GB203)',
    cudaCores: 10496,
    tensorGen: '5ta Gen (FP8/FP4)',
    vramType: 'GDDR7 (256-bit)',
    bandwidthGBs: 896,
    fp16Tflops: 95.0,
    typicalTgpW: 175,
    notes: 'Tope de gama portátil con 24GB GDDR7.'
  },
  {
    match: /RTX 4050 Laptop/i,
    arch: 'NVIDIA Ada Lovelace (AD107)',
    cudaCores: 2560,
    tensorGen: '4ta Gen (FP8)',
    vramType: 'GDDR6 (96-bit)',
    bandwidthGBs: 192,
    fp16Tflops: 19.0,
    typicalTgpW: 75,
    notes: 'Bus de 96 bits limita la velocidad de generación de tokens.'
  },
  {
    match: /RTX 4060 Laptop/i,
    arch: 'NVIDIA Ada Lovelace (AD107)',
    cudaCores: 3072,
    tensorGen: '4ta Gen (FP8)',
    vramType: 'GDDR6 (128-bit)',
    bandwidthGBs: 256,
    fp16Tflops: 22.5,
    typicalTgpW: 105,
    notes: 'Clásico de 8GB GDDR6 a 256 GB/s.'
  },
  {
    match: /RTX 4070 Laptop/i,
    arch: 'NVIDIA Ada Lovelace (AD106)',
    cudaCores: 4608,
    tensorGen: '4ta Gen (FP8)',
    vramType: 'GDDR6 (128-bit)',
    bandwidthGBs: 256,
    fp16Tflops: 31.0,
    typicalTgpW: 115,
    notes: 'Buen prefill pero mismo ancho de banda de memoria que la 4060.'
  },
  {
    match: /RTX 4080 Laptop/i,
    arch: 'NVIDIA Ada Lovelace (AD104)',
    cudaCores: 7424,
    tensorGen: '4ta Gen (FP8)',
    vramType: 'GDDR6 (192-bit)',
    bandwidthGBs: 432,
    fp16Tflops: 54.0,
    typicalTgpW: 150,
    notes: '12GB de VRAM a 432 GB/s.'
  },
  {
    match: /RTX 4090 Laptop/i,
    arch: 'NVIDIA Ada Lovelace (AD103)',
    cudaCores: 9728,
    tensorGen: '4ta Gen (FP8)',
    vramType: 'GDDR6 (256-bit)',
    bandwidthGBs: 576,
    fp16Tflops: 73.0,
    typicalTgpW: 175,
    notes: '16GB VRAM ideal para modelos 14B-32B.'
  },
  {
    match: /RTX 3060 Laptop/i,
    arch: 'NVIDIA Ampere (GA106)',
    cudaCores: 3840,
    tensorGen: '3ra Gen (FP16)',
    vramType: 'GDDR6 (192-bit)',
    bandwidthGBs: 336,
    fp16Tflops: 21.0,
    typicalTgpW: 115,
    notes: '6GB VRAM rápidos pero ajustados para modelos 8B.'
  },
  {
    match: /RTX 3050/i,
    arch: 'NVIDIA Ampere (GA107)',
    cudaCores: 2048,
    tensorGen: '3ra Gen (FP16)',
    vramType: 'GDDR6 (128-bit)',
    bandwidthGBs: 192,
    fp16Tflops: 12.5,
    typicalTgpW: 65,
    notes: 'Gama de entrada para modelos 3B-7B cuantizados.'
  }
];

/**
 * 1. Sondeo profundo de CPU e instrucciones vectoriales (SIMD) — Sin usar shell (100% execFileSync)
 */
export function probeCpu() {
  const cpus = os.cpus();
  const modelRaw = cpus[0]?.model?.trim() || 'Generic x86_64 Processor';
  const logicalThreads = cpus.length;

  let physicalCores = Math.max(1, Math.floor(logicalThreads / 2));
  let maxClockMhz = cpus[0]?.speed || 3500;
  let l3CacheKB = 16384;

  if (process.platform === 'win32') {
    const psOut = safeExecFile('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'Get-CimInstance Win32_Processor | Select-Object Name,NumberOfCores,NumberOfLogicalProcessors,MaxClockSpeed,L3CacheSize | ConvertTo-Json -Compress'
    ]);
    if (psOut) {
      try {
        const parsed = JSON.parse(psOut);
        const cpuObj = Array.isArray(parsed) ? parsed[0] : parsed;
        if (cpuObj.NumberOfCores) physicalCores = Number(cpuObj.NumberOfCores);
        if (cpuObj.MaxClockSpeed) maxClockMhz = Number(cpuObj.MaxClockSpeed);
        if (cpuObj.L3CacheSize) l3CacheKB = Number(cpuObj.L3CacheSize);
      } catch {
        // Fallback silencioso a valores de os.cpus()
      }
    }
  } else if (process.platform === 'darwin') {
    const pCores = safeExecFile('sysctl', ['-n', 'hw.physicalcpu']);
    if (pCores) physicalCores = parseInt(pCores, 10) || physicalCores;
  }

  const isZen4Or5 = /Ryzen\s+[579]\s+(2\d\d|7\d4\d|8\d4\d|9\d\d\d|AI)/i.test(modelRaw);
  const isAppleSilicon = /Apple M[1234]/i.test(modelRaw);
  const hasAvx512 = isZen4Or5 || /i[579]-11\d{3}|Xeon/i.test(modelRaw);
  const simdSupport = isAppleSilicon
    ? 'ARM NEON + Apple AMX Matrix Co-Processor'
    : hasAvx512
      ? 'AVX-512 + AVX2 + FMA3 + VNNI (Óptimo para llama.cpp en CPU)'
      : 'AVX2 + FMA3 (Estándar x86_64)';

  const hasIntegratedGpu = /Radeon\s+\d+M|Iris|Arc|Apple M/i.test(modelRaw);
  const igpuModel = modelRaw.match(/(Radeon\s+\d+M\s*Graphics|Radeon\s+Graphics|Intel\s+Arc)/i)?.[1] || null;

  return {
    model: modelRaw,
    physicalCores,
    logicalThreads,
    maxClockGhz: Number((maxClockMhz / 1000).toFixed(2)),
    l3CacheMB: Number((l3CacheKB / 1024).toFixed(1)),
    hasAvx512,
    isAppleSilicon,
    simdSupport,
    hasIntegratedGpu,
    igpuModel,
    isLaptopCpu: /Laptop|Mobile|HS|HX|U\b|Radeon\s+\d+M|Apple M/i.test(modelRaw)
  };
}

/**
 * 2. Sondeo quirúrgico del subsistema de memoria RAM (Sin recolectar números de serie / PII)
 */
export function probeMemory(cpuInfo) {
  const osTotalBytes = os.totalmem();
  const osFreeBytes = os.freemem();

  let sticks = [];
  if (process.platform === 'win32') {
    // Nota de privacidad: No consultamos SerialNumber ni PartNumber para evitar huella digital de hardware
    const psRam = safeExecFile('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'Get-CimInstance Win32_PhysicalMemory | Select-Object Capacity,Speed,ConfiguredClockSpeed | ConvertTo-Json -Compress'
    ]);
    if (psRam) {
      try {
        const parsed = JSON.parse(psRam);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        sticks = arr.filter(Boolean).map((s) => ({
          capacityGB: Math.round(Number(s.Capacity || 0) / 1024 ** 3),
          speedMTs: Number(s.ConfiguredClockSpeed || s.Speed || 4800)
        }));
      } catch {
        sticks = [];
      }
    }
  }

  const physicalHardwareGB =
    sticks.length > 0
      ? sticks.reduce((acc, s) => acc + s.capacityGB, 0)
      : Math.ceil(osTotalBytes / 1024 ** 3);

  const osVisibleGB = Number((osTotalBytes / 1024 ** 3).toFixed(2));
  const osFreeGB = Number((osFreeBytes / 1024 ** 3).toFixed(2));
  const osUsedGB = Number((osVisibleGB - osFreeGB).toFixed(2));
  const umaReservedGB = Math.max(0, Number((physicalHardwareGB - osVisibleGB).toFixed(2)));

  const speedMTs = sticks[0]?.speedMTs || (cpuInfo?.isAppleSilicon ? 6400 : 4800);
  const channels = sticks.length >= 2 || cpuInfo?.isAppleSilicon ? 2 : 1;
  const memType = cpuInfo?.isAppleSilicon ? 'LPDDR5 Unified' : speedMTs >= 4400 ? 'DDR5' : 'DDR4';

  const theoreticalBandwidthGBs = cpuInfo?.isAppleSilicon
    ? 150.0
    : Number(((speedMTs * 8 * channels) / 1000).toFixed(1));
  const effectiveLlmBandwidthGBs = Number(
    (theoreticalBandwidthGBs * (cpuInfo?.hasAvx512 || cpuInfo?.isAppleSilicon ? 0.74 : 0.66)).toFixed(1)
  );

  return {
    physicalHardwareGB,
    osVisibleGB,
    osFreeGB,
    osUsedGB,
    umaReservedGB,
    sticksCount: sticks.length || 1,
    sticks,
    channels,
    channelTopology:
      channels >= 2
        ? `Dual-Channel (${sticks.length || 2}x ${sticks[0]?.capacityGB || Math.round(physicalHardwareGB / 2)}GB)`
        : 'Single-Channel (Cuello de botella)',
    memType,
    speedMTs,
    theoreticalBandwidthGBs,
    effectiveLlmBandwidthGBs
  };
}

/**
 * 3. Sondeo profundo de GPU Discreta + VRAM en vivo + Procesos Parásitos WDDM (100% execFileSync)
 */
export function probeGpu() {
  const smiCsv = safeExecFile('nvidia-smi', [
    '--query-gpu=name,memory.total,memory.free,memory.used,temperature.gpu,power.draw,power.limit,clocks.gr,clocks.mem,pcie.link.gen.current,pcie.link.width.current,driver_version',
    '--format=csv,noheader,nounits'
  ]);

  if (smiCsv) {
    const firstLine = smiCsv.split(/\r?\n/)[0];
    const parts = firstLine.split(',').map((s) => s.trim());
    const name = parts[0] || 'NVIDIA GPU';
    const totalMiB = parseFloat(parts[1]) || 8192;
    const freeMiB = parseFloat(parts[2]) || 6144;
    const usedMiB = parseFloat(parts[3]) || totalMiB - freeMiB;
    const tempC = parseFloat(parts[4]) || 45;
    const powerDrawW = parseFloat(parts[5]) || 10;
    const powerLimitRaw = parseFloat(parts[6]);
    const coreClockMhz = parseFloat(parts[7]) || 2100;
    const memClockMhz = parseFloat(parts[8]) || 8000;
    const pcieGen = parseInt(parts[9], 10) || 4;
    const pcieWidth = parseInt(parts[10], 10) || 8;
    const driverVersion = parts[11] || 'Unknown';

    const dbMatch = GPU_SPECS_DB.find((entry) => entry.match.test(name));
    const bandwidthGBs = dbMatch?.bandwidthGBs || (memClockMhz > 7500 ? 384 : 256);
    const effectiveBandwidthGBs = Number((bandwidthGBs * 0.86).toFixed(1));
    const pcieBandwidthGBs = Number(((pcieGen === 5 ? 3.94 : pcieGen === 4 ? 1.97 : 0.985) * pcieWidth).toFixed(1));

    // Detectar procesos que están consumiendo VRAM ahora mismo (solo nombre base del ejecutable, nunca rutas de usuario)
    const appsRaw = safeExecFile('nvidia-smi', [
      '--query-compute-apps=pid,process_name,used_memory',
      '--format=csv,noheader'
    ]);
    const backgroundProcesses = [];
    const seenNames = new Set();

    if (appsRaw) {
      for (const line of appsRaw.split(/\r?\n/)) {
        if (!line.trim()) continue;
        const cols = line.split(',').map((c) => c.trim());
        const procPath = cols[1] || '';
        const baseName = procPath.split(/[\\/]/).pop() || procPath;
        if (baseName && !seenNames.has(baseName)) {
          seenNames.add(baseName);
          backgroundProcesses.push(baseName);
        }
      }
    }

    const closableApps = backgroundProcesses.filter((p) =>
      /WhatsApp|msedgewebview2|chrome|brave|firefox|Overlay|NitroSense|WidgetBoard|PhoneExperienceHost|SnippingTool|Discord|Spotify|Steam/i.test(p)
    );

    const minimalOsVramMiB = 680;
    const reclaimableMiB = Math.max(0, Math.round(usedMiB - minimalOsVramMiB));
    const cleanModeFreeMiB = Math.min(totalMiB - minimalOsVramMiB, freeMiB + reclaimableMiB);

    return {
      detected: true,
      vendor: 'NVIDIA',
      name,
      arch: dbMatch?.arch || 'NVIDIA RTX Architecture',
      cudaCores: dbMatch?.cudaCores || 2560,
      tensorGen: dbMatch?.tensorGen || 'Tensor Cores FP16/INT8',
      vramType: dbMatch?.vramType || 'GDDR6/GDDR7',
      totalMiB,
      freeMiB,
      usedMiB,
      totalGiB: Number((totalMiB / 1024).toFixed(2)),
      freeGiB: Number((freeMiB / 1024).toFixed(2)),
      usedGiB: Number((usedMiB / 1024).toFixed(2)),
      cleanModeFreeMiB,
      cleanModeFreeGiB: Number((cleanModeFreeMiB / 1024).toFixed(2)),
      reclaimableMiB,
      reclaimableGiB: Number((reclaimableMiB / 1024).toFixed(2)),
      tempC,
      powerDrawW,
      powerLimitW: !Number.isNaN(powerLimitRaw) ? powerLimitRaw : dbMatch?.typicalTgpW || 75,
      coreClockMhz,
      memClockMhz,
      pcieGen,
      pcieWidth,
      pcieBandwidthGBs,
      driverVersion,
      bandwidthGBs,
      effectiveBandwidthGBs,
      fp16Tflops: dbMatch?.fp16Tflops || 24.0,
      isLaptopGpu: /Laptop|Mobile|Max-Q/i.test(name),
      backgroundProcessesCount: backgroundProcesses.length,
      backgroundProcesses,
      closableApps,
      notes: dbMatch?.notes || 'Aceleración CUDA nativa disponible.'
    };
  }

  return {
    detected: false,
    vendor: 'Integrated / Unified',
    name: 'GPU Integrada Compartida (UMA)',
    arch: 'Unified System Memory',
    cudaCores: 0,
    tensorGen: 'CPU/iGPU',
    vramType: 'System DDR5 Shared',
    totalMiB: 4096,
    freeMiB: 3072,
    usedMiB: 1024,
    totalGiB: 4.0,
    freeGiB: 3.0,
    usedGiB: 1.0,
    cleanModeFreeMiB: 3500,
    cleanModeFreeGiB: 3.4,
    reclaimableMiB: 400,
    reclaimableGiB: 0.4,
    tempC: 45,
    powerDrawW: 15,
    powerLimitW: 45,
    coreClockMhz: 1800,
    memClockMhz: 2800,
    pcieGen: 4,
    pcieWidth: 8,
    pcieBandwidthGBs: 15.8,
    driverVersion: 'UMA',
    bandwidthGBs: 89.6,
    effectiveBandwidthGBs: 64.0,
    fp16Tflops: 4.5,
    isLaptopGpu: true,
    backgroundProcessesCount: 0,
    backgroundProcesses: [],
    closableApps: [],
    notes: 'Sin GPU dedicada NVIDIA detectada; inferencia basada en RAM del sistema.'
  };
}

/**
 * 4. Micro-Benchmark Físico en Tiempo Real (En memoria volátil aislada)
 */
export function runMicroBenchmark() {
  const byteSize = 64 * 1024 * 1024;
  const elements = byteSize / 8;
  const src = new Float64Array(elements);
  const dst = new Float64Array(elements);
  src.fill(1.000123);

  const iterations = 6;
  const t0 = performance.now();
  for (let it = 0; it < iterations; it++) {
    dst.set(src);
  }
  const t1 = performance.now();
  const elapsedSec = Math.max(0.001, (t1 - t0) / 1000);
  const totalBytesMoved = byteSize * 2 * iterations;
  const measuredSingleThreadMemGBs = Number((totalBytesMoved / 1024 ** 3 / elapsedSec).toFixed(1));

  const vecLen = 2_000_000;
  const a = new Float32Array(vecLen).fill(0.5);
  const b = new Float32Array(vecLen).fill(1.5);
  let acc = 0;
  const c0 = performance.now();
  for (let r = 0; r < 10; r++) {
    for (let i = 0; i < vecLen; i += 4) {
      acc += a[i] * b[i] + a[i + 1] * b[i + 1] + a[i + 2] * b[i + 2] + a[i + 3] * b[i + 3];
    }
  }
  const c1 = performance.now();
  const computeMs = Number((c1 - c0).toFixed(1));

  return {
    measuredSingleThreadMemGBs,
    dotProductLatencyMs: computeMs,
    checksum: acc > 0 ? 'OK' : 'WARN'
  };
}
