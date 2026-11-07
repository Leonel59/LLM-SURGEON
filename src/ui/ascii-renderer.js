/**
 * Motor de Renderizado ASCII Quirurgico y Minimalista de Terminal (LLM-Surgeon UI)
 * Cero Emojis: 100% caracteres geometricos ASCII/Box-Drawing de ancho fijo para alineacion perfecta.
 */

export const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  cyan: '\x1b[36m',
  brightCyan: '\x1b[96m',
  green: '\x1b[32m',
  brightGreen: '\x1b[92m',
  yellow: '\x1b[33m',
  brightYellow: '\x1b[93m',
  red: '\x1b[31m',
  brightRed: '\x1b[91m',
  magenta: '\x1b[35m',
  brightMagenta: '\x1b[95m',
  blue: '\x1b[34m',
  brightBlue: '\x1b[94m',
  white: '\x1b[97m',
  gray: '\x1b[90m',
  bgBlue: '\x1b[44m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgRed: '\x1b[41m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m'
};

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function stripAnsi(str) {
  return String(str).replace(/\x1b\[[0-9;]*m/g, '');
}

export function padEndAnsi(str, targetLen) {
  const visibleLen = stripAnsi(str).length;
  if (visibleLen >= targetLen) return str;
  return str + ' '.repeat(targetLen - visibleLen);
}

export function drawBar(pct, width = 24, fillChar = '█', emptyChar = '░') {
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = Math.round((clamped / 100) * width);
  const empty = Math.max(0, width - filled);
  let color = ANSI.brightGreen;
  if (clamped >= 92) color = ANSI.brightRed;
  else if (clamped >= 78) color = ANSI.brightYellow;
  else if (clamped >= 55) color = ANSI.brightCyan;
  return `${color}${fillChar.repeat(filled)}${ANSI.gray}${emptyChar.repeat(empty)}${ANSI.reset}`;
}

/**
 * Dibuja una barra segmentada de VRAM: [OS/Apps | Pesos Modelo | KV Cache + Buffer | Libre]
 */
export function drawSegmentedVramBar({ totalGiB, osUsedGiB, modelWeightsGiB, kvAndBufferGiB, width = 30 }) {
  const osRatio = Math.min(1, osUsedGiB / totalGiB);
  const weightsRatio = Math.min(1 - osRatio, modelWeightsGiB / totalGiB);
  const kvRatio = Math.min(1 - osRatio - weightsRatio, kvAndBufferGiB / totalGiB);

  const osChars = Math.max(1, Math.round(osRatio * width));
  const weightChars = Math.max(0, Math.round(weightsRatio * width));
  const kvChars = Math.max(0, Math.round(kvRatio * width));
  const freeChars = Math.max(0, width - osChars - weightChars - kvChars);

  return (
    `${ANSI.gray}[` +
    `${ANSI.brightRed}${'▓'.repeat(osChars)}` +
    `${ANSI.brightCyan}${'█'.repeat(weightChars)}` +
    `${ANSI.brightYellow}${'▒'.repeat(kvChars)}` +
    `${ANSI.gray}${'░'.repeat(freeChars)}]` +
    `${ANSI.reset}`
  );
}

export function formatTierBadge(tier, fitPct) {
  if (tier === 'S+') return `${ANSI.bgGreen}${ANSI.bold} TIER S+ :: ${fitPct}% FIT ${ANSI.reset}`;
  if (tier === 'S') return `${ANSI.bgCyan}${ANSI.bold} TIER S  :: ${fitPct}% FIT ${ANSI.reset}`;
  if (tier === 'A') return `${ANSI.bgBlue}${ANSI.bold} TIER A  :: ${fitPct}% FIT ${ANSI.reset}`;
  if (tier === 'B') return `${ANSI.bgYellow}${ANSI.bold} TIER B  :: ${fitPct}% FIT ${ANSI.reset}`;
  return `${ANSI.bgRed}${ANSI.bold} TIER C  :: ${fitPct}% FIT ${ANSI.reset}`;
}

export function formatSpeedColor(tokPerSec) {
  if (tokPerSec >= 50) return `${ANSI.brightGreen}${ANSI.bold}~${tokPerSec} tok/s [FAST // TIEMPO REAL]${ANSI.reset}`;
  if (tokPerSec >= 30) return `${ANSI.brightCyan}${ANSI.bold}~${tokPerSec} tok/s [FLUIDO // OPTIMO]${ANSI.reset}`;
  if (tokPerSec >= 15) return `${ANSI.brightYellow}${ANSI.bold}~${tokPerSec} tok/s [LECTURA // HIBRIDO]${ANSI.reset}`;
  return `${ANSI.brightRed}${ANSI.bold}~${tokPerSec} tok/s [PESADO // OFFLOAD]${ANSI.reset}`;
}

export function printAsciiHeader() {
  console.log(`${ANSI.brightCyan}${ANSI.bold}
  ╔════════════════════════════════════════════════════════════════════════════════════════════════════════╗
  ║   ██╗     ██╗     ███╗   ███╗      ███████╗██╗   ██╗██████╗  ██████╗ ███████╗ ██████╗ ███╗   ██╗       ║
  ║   ██║     ██║     ████╗ ████║      ██╔════╝██║   ██║██╔══██╗██╔════╝ ██╔════╝██╔═══██╗████╗  ██║       ║
  ║   ██║     ██║     ██╔████╔██║█████╗███████╗██║   ██║██████╔╝██║  ███╗█████╗  ██║   ██║██╔██╗ ██║       ║
  ║   ██║     ██║     ██║╚██╔╝██║╚════╝╚════██║██║   ██║██╔══██╗██║   ██║██╔══╝  ██║   ██║██║╚██╗██║       ║
  ║   ███████╗███████╗██║ ╚═╝ ██║      ███████║╚██████╔╝██║  ██║╚██████╔╝███████╗╚██████╔╝██║ ╚████║       ║
  ║   ╚══════╝╚══════╝╚═╝     ╚═╝      ╚══════╝ ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝ ╚═════╝ ╚═╝  ╚═══╝       ║
  ╠════════════════════════════════════════════════════════════════════════════════════════════════════════╣
  ║ ${ANSI.white}MOTOR QUIRURGICO DE TELEMETRIA FISICA, ANALISIS DE KV-CACHE Y DIAGNOSTICO DE IA LOCAL v2.0${ANSI.brightCyan}             ║
  ║ ${ANSI.white}Inspirado en CanIRun.ai + ArtificialAnalysis.ai + llmfit.org (Curado por secciones sin listas masivas)${ANSI.brightCyan} ║
  ║ ${ANSI.brightGreen}[ SECURE ZERO-TRUST ] 0 Dependencias NPM :: 0 Telemetria Externa :: 100% Solo-Lectura :: No-PII${ANSI.brightCyan}        ║
  ╚════════════════════════════════════════════════════════════════════════════════════════════════════════╝${ANSI.reset}
`);
}

/**
 * Renderiza el Certificado de Auditoria Quirurgica de Seguridad (--security-audit)
 */
export function renderSecurityAuditPanel(integrity, offlineMode = false) {
  console.log(`${ANSI.bgGreen}${ANSI.bold} [SECURITY] CERTIFICADO DE AUDITORIA QUIRURGICA DE SEGURIDAD Y PRIVACIDAD (GITHUB TRUST) ${ANSI.reset}`);
  console.log(`${ANSI.gray}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${ANSI.reset}`);
  console.log(`  ${ANSI.brightGreen}[OK] [SUPPLY-CHAIN SAFE]${ANSI.reset}   ${ANSI.bold}0 Dependencias de Terceros${ANSI.reset} en package.json (100% Node.js Nativo).`);
  console.log(`  ${ANSI.brightGreen}[OK] [NO SHELL INJECTION]${ANSI.reset}  ${ANSI.bold}0 llamadas a execSync / shell.${ANSI.reset} Todo subproceso usa execFileSync con lista blanca.`);
  console.log(
    `  ${ANSI.brightGreen}[OK] [ZERO TELEMETRY]${ANSI.reset}      ${ANSI.bold}0 trafico hacia internet.${ANSI.reset} Firewall logico restringido a loopback 127.0.0.1${offlineMode ? ' (Modo --offline ACTIVO)' : ' (Puertos 11434/1234)'}.`
  );
  console.log(`  ${ANSI.brightGreen}[OK] [PII & PRIVACY]${ANSI.reset}       ${ANSI.bold}Anonimizacion automatica${ANSI.reset} de rutas de usuario (~/), sin recolectar seriales ni MAC/IP.`);
  console.log(`  ${ANSI.brightGreen}[OK] [NON-DESTRUCTIVE]${ANSI.reset}     ${ANSI.bold}100% Solo-Lectura${ANSI.reset} sobre el sistema; corre sin privilegios de Administrador/root.`);

  console.log(`\n  ${ANSI.brightCyan}${ANSI.bold}[SHA-256] Huella Criptografica del Codigo Fuente (${integrity.totalFiles} archivos :: ${integrity.totalLines} lineas):${ANSI.reset}`);
  for (const f of integrity.fileHashes) {
    console.log(
      `     ├─ ${padEndAnsi(ANSI.white + f.relativePath + ANSI.reset, 38)} │ SHA-256: ${ANSI.brightYellow}${f.sha256}${ANSI.reset} (${f.lines} lineas)`
    );
  }
  console.log(
    `     └─ ${ANSI.bold}HASH MAESTRO COMBINADO:${ANSI.reset} ${ANSI.brightGreen}${integrity.combinedSha256}${ANSI.reset}\n`
  );
}

/**
 * Secuencia de carga animada en ASCII mientras diagnostica cada subsistema del portatil
 */
export async function runAnimatedDiagnosticBoot(steps, fastMode = false) {
  console.log(`${ANSI.brightYellow}${ANSI.bold}  ┌── [ INICIANDO ESCANER BIOMETRICO DE HARDWARE & TOPOLOGIA DE MEMORIA ] ─────────────────────────────────┐${ANSI.reset}`);

  const spinnerFrames = ['|', '/', '-', '\\', '|', '/', '-', '\\'];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const pctStart = Math.round((i / steps.length) * 100);
    const pctEnd = Math.round(((i + 1) / steps.length) * 100);

    if (!fastMode && process.stdout.isTTY) {
      for (let f = 0; f < 5; f++) {
        const curPct = Math.round(pctStart + ((pctEnd - pctStart) * (f + 1)) / 5);
        const bar = drawBar(curPct, 22);
        const frame = spinnerFrames[f % spinnerFrames.length];
        process.stdout.write(
          `\r  ${ANSI.brightCyan}[${frame}]${ANSI.reset} ${bar} ${ANSI.bold}${String(curPct).padStart(3)}%${ANSI.reset} │ ${ANSI.white}${step.title}${ANSI.reset}`
        );
        await sleep(65);
      }
    }

    const resultData = await step.action();
    const finalBar = drawBar(pctEnd, 22);
    const linePrefix = process.stdout.isTTY ? '\r' : '  ';
    console.log(
      `${linePrefix}  ${ANSI.brightGreen}[+]${ANSI.reset} ${finalBar} ${ANSI.bold}${String(pctEnd).padStart(3)}%${ANSI.reset} │ ${ANSI.white}${step.title}${ANSI.reset}`
    );
    if (resultData?.summaryLine) {
      console.log(`      ${ANSI.gray}└──>${ANSI.reset} ${resultData.summaryLine}`);
    }
  }

  console.log(`${ANSI.brightYellow}${ANSI.bold}  └────────────────────────────────────────────────────────────────────────────────────────────────────────┘${ANSI.reset}\n`);
}

/**
 * Renderiza el Panel 1: Radiografia Quirurgica del Portatil / PC
 */
export function renderHardwareRadiography({ cpu, ram, gpu, microBench }) {
  console.log(`${ANSI.bgCyan}${ANSI.bold} [01] RADIOGRAFIA QUIRURGICA DE TU PORTATIL / PC (TELEMETRIA FISICA EN TIEMPO REAL) ${ANSI.reset}`);
  console.log(`${ANSI.gray}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${ANSI.reset}`);

  // CPU
  console.log(
    `  ${ANSI.brightCyan}[CPU] PROCESADOR:${ANSI.reset}        ${ANSI.bold}${ANSI.white}${cpu.model}${ANSI.reset}`
  );
  console.log(
    `    ├─ Topologia Fisica:   ${ANSI.brightGreen}${cpu.physicalCores} Nucleos Fisicos / ${cpu.logicalThreads} Hilos${ANSI.reset} :: Boost ${ANSI.white}${cpu.maxClockGhz} GHz${ANSI.reset} :: Cache L3: ${ANSI.white}${cpu.l3CacheMB} MB${ANSI.reset}`
  );
  console.log(
    `    └─ Aceleracion SIMD:   ${ANSI.brightYellow}${cpu.simdSupport}${ANSI.reset}`
  );

  // RAM
  console.log(
    `\n  ${ANSI.brightCyan}[RAM] MEMORIA SISTEMA:${ANSI.reset}   ${ANSI.bold}${ANSI.white}${ram.physicalHardwareGB} GB Fisicos (${ram.memType} @ ${ram.speedMTs} MT/s)${ANSI.reset} :: ${ANSI.brightGreen}${ram.channelTopology}${ANSI.reset}`
  );
  console.log(
    `    ├─ Explicacion UMA:    ${ANSI.white}${ram.osVisibleGB} GB visibles para OS${ANSI.reset} (${ANSI.brightGreen}${ram.osFreeGB} GB Libres ahora${ANSI.reset} / ${ram.osUsedGB} GB en uso)` +
      (ram.umaReservedGB > 0.3
        ? ` :: ${ANSI.brightYellow}~${ram.umaReservedGB} GB reservados por iGPU (${cpu.igpuModel || 'Radeon Graphics'})${ANSI.reset}`
        : '')
  );
  console.log(
    `    └─ Ancho de Banda RAM: ${ANSI.white}${ram.theoreticalBandwidthGBs} GB/s pico teorico${ANSI.reset} -> ${ANSI.brightCyan}~${ram.effectiveLlmBandwidthGBs} GB/s sostenibles en inferencia CPU${ANSI.reset} (Micro-test JS: ${microBench.measuredSingleThreadMemGBs} GB/s 1-hilo)`
  );

  // GPU
  console.log(
    `\n  ${ANSI.brightCyan}[GPU] TARJETA GRAFICA:${ANSI.reset}   ${ANSI.bold}${ANSI.brightGreen}${gpu.name}${ANSI.reset} ${ANSI.white}(${gpu.arch} :: Driver ${gpu.driverVersion})${ANSI.reset}`
  );
  console.log(
    `    ├─ Motor & Bus:        ${ANSI.white}${gpu.cudaCores} CUDA Cores${ANSI.reset} :: ${gpu.tensorGen} :: ${ANSI.brightCyan}${gpu.vramType} @ ~${gpu.bandwidthGBs} GB/s${ANSI.reset} (~${gpu.effectiveBandwidthGBs} GB/s efectivos)`
  );
  console.log(
    `    ├─ Interfaz & Termica: ${ANSI.white}PCIe Gen ${gpu.pcieGen} x${gpu.pcieWidth} (${gpu.pcieBandwidthGBs} GB/s)${ANSI.reset} :: Temp actual: ${ANSI.brightGreen}${gpu.tempC} C${ANSI.reset} :: Consumo actual: ${ANSI.white}${gpu.powerDrawW}W / ~${gpu.powerLimitW}W TGP${ANSI.reset}`
  );

  const usedPctLive = Math.round((gpu.usedMiB / gpu.totalMiB) * 100);
  const usedPctClean = Math.round(((gpu.totalMiB - gpu.cleanModeFreeMiB) / gpu.totalMiB) * 100);

  console.log(
    `    ├─ VRAM EN VIVO AHORA: ${drawBar(usedPctLive, 20)} ${ANSI.bold}${ANSI.brightYellow}${gpu.freeGiB} GB Libres${ANSI.reset} de ${gpu.totalGiB} GB (${ANSI.brightRed}${gpu.usedMiB} MiB ocupados por ${gpu.backgroundProcessesCount} procesos WDDM${ANSI.reset})`
  );
  console.log(
    `    └─ MODO LIMPIO IDEAL:  ${drawBar(usedPctClean, 20)} ${ANSI.bold}${ANSI.brightGreen}${gpu.cleanModeFreeGiB} GB Libres${ANSI.reset} si cierras apps de fondo (${ANSI.brightGreen}+${gpu.reclaimableMiB} MiB recuperables${ANSI.reset})`
  );

  if (gpu.closableApps.length > 0) {
    console.log(
      `       ${ANSI.brightYellow}[!] Diagnostico WDDM:${ANSI.reset} Ni CanIRun ni llmfit te avisan que ${ANSI.white}${gpu.closableApps.slice(0, 6).join(', ')}${ANSI.reset} estan restando ${ANSI.brightRed}${gpu.reclaimableMiB} MiB${ANSI.reset} a tu GPU ahora mismo.`
    );
  }
  console.log('');
}

/**
 * Renderiza el Panel 2: Estado de Ollama y LM Studio
 */
export function renderLocalRuntimesPanel(runtimes) {
  console.log(`${ANSI.bgMagenta}${ANSI.bold} [02] AUDITORIA DE MOTORES LOCALES (OLLAMA & LM STUDIO) Y MODELOS EN DISCO ${ANSI.reset}`);
  console.log(`${ANSI.gray}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${ANSI.reset}`);

  const ol = runtimes.ollama;
  const lms = runtimes.lmStudio;

  const olStatus = ol.installed
    ? `${ANSI.brightGreen}[ACTIVO] INSTALADO (${ol.version})${ANSI.reset} :: Servidor API (11434): ${ol.apiRunning ? `${ANSI.brightGreen}ONLINE${ANSI.reset}` : `${ANSI.brightYellow}OFFLINE${ANSI.reset}`}`
    : `${ANSI.brightRed}[--] NO DETECTADO EN EL SISTEMA${ANSI.reset} ${ANSI.white}(Instalar con: winget install Ollama.Ollama)${ANSI.reset}`;

  const lmsStatus = lms.installed
    ? `${ANSI.brightGreen}[ACTIVO] INSTALADO${ANSI.reset} :: Servidor Local (1234): ${lms.apiRunning ? `${ANSI.brightGreen}ONLINE${ANSI.reset}` : `${ANSI.brightYellow}OFFLINE${ANSI.reset}`}`
    : `${ANSI.brightRed}[--] NO DETECTADO EN EL SISTEMA${ANSI.reset} ${ANSI.white}(Instalar con: winget install ElementLabs.LMStudio)${ANSI.reset}`;

  console.log(`  ├─ ${ANSI.bold}Ollama Engine:${ANSI.reset}    ${olStatus}`);
  console.log(`  └─ ${ANSI.bold}LM Studio GUI:${ANSI.reset}    ${lmsStatus}`);

  if (runtimes.allDownloadedModels.length > 0) {
    console.log(`\n  ${ANSI.brightGreen}[+] Modelos Locales Descargados Detectados (${runtimes.allDownloadedModels.length}):${ANSI.reset}`);
    runtimes.allDownloadedModels.forEach((m, idx) => {
      console.log(
        `     [${idx + 1}] ${ANSI.bold}${ANSI.white}${m.id}${ANSI.reset} ${ANSI.white}(${m.provider} :: ${m.sizeGiB ? `${m.sizeGiB} GB` : m.quantization})${ANSI.reset}`
      );
    });
  } else {
    console.log(
      `\n  ${ANSI.brightYellow}[i] Estado de Modelos en Disco:${ANSI.reset} Actualmente tienes ${ANSI.bold}0 modelos GGUF descargados${ANSI.reset} en este portatil.`
    );
    console.log(
      `      ${ANSI.white}En el laboratorio final puedes simular en vivo cualquiera de los 22 modelos SOTA antes de descargarlos.${ANSI.reset}`
    );
  }
  console.log('');
}

/**
 * Renderiza el Panel 3: Catalogo Curado por Secciones (Sin el listado masivo de 493 modelos de llmfit)
 */
export function renderCuratedEvaluations(categories, evaluations, hardware) {
  console.log(`${ANSI.bgBlue}${ANSI.bold} [03] DIAGNOSTICO POR SECCIONES: MEJORES IA DEL MERCADO FRENTE A TU PORTATIL ${ANSI.reset}`);
  console.log(
    `${ANSI.white}Leyenda Barra VRAM (8 GB): [${ANSI.brightRed}▓ OS/WDDM${ANSI.white} | ${ANSI.brightCyan}█ Pesos IA${ANSI.white} | ${ANSI.brightYellow}▒ KV-Cache 8K + Buffer${ANSI.white} | ${ANSI.gray}░ VRAM Libre${ANSI.white}]${ANSI.reset}\n`
  );

  for (const cat of categories) {
    const catEvals = evaluations
      .filter((e) => e.model.category === cat.id)
      .sort((a, b) => b.surgicalFitPct - a.surgicalFitPct);

    if (catEvals.length === 0) continue;

    console.log(
      `${ANSI.brightCyan}${ANSI.bold}╔══ ${cat.icon} ${cat.title} ${'═'.repeat(Math.max(2, 86 - cat.title.length - cat.icon.length))}╗${ANSI.reset}`
    );
    console.log(`${ANSI.brightCyan}║${ANSI.reset} ${ANSI.white}${cat.subtitle}${ANSI.reset}`);
    console.log(
      `${ANSI.brightCyan}╚${'═'.repeat(92)}╝${ANSI.reset}`
    );

    for (const ev of catEvals) {
      const m = ev.model;
      const vramBar = drawSegmentedVramBar({
        totalGiB: hardware.gpu.totalGiB,
        osUsedGiB: hardware.gpu.totalGiB - hardware.gpu.cleanModeFreeGiB,
        modelWeightsGiB: Math.min(hardware.gpu.cleanModeFreeGiB, ev.weightsGiB),
        kvAndBufferGiB: ev.kv8kFp16GiB + ev.computeBufferGiB,
        width: 26
      });

      const localBadge = ev.installedLocally
        ? ` ${ANSI.bgMagenta}${ANSI.bold} [INSTALADO EN TU PC] ${ANSI.reset}`
        : '';

      const aaBadge = m.aaProgressIndex
        ? ` ${ANSI.bgCyan}${ANSI.bold} AA Progress: ${m.aaProgressIndex} ${ANSI.reset}`
        : '';

      console.log(
        `  ${formatTierBadge(ev.tier, ev.surgicalFitPct)} ${ANSI.bold}${ANSI.white}${m.name}${ANSI.reset} ${ANSI.white}(${m.provider} :: ${m.architecture})${ANSI.reset}${aaBadge} ${ANSI.brightYellow}${m.badge}${ANSI.reset}${localBadge}`
      );

      // Fila de Memoria + Quant + Capas
      console.log(
        `  ├─ ${ANSI.brightCyan}Memoria & Quant:${ANSI.reset} ${vramBar} ${ANSI.bold}${ev.selectedQuant.id}${ANSI.reset} │ Pesos: ${ANSI.white}${ev.weightsGiB} GB${ANSI.reset} + KV(8K): ${ANSI.white}${ev.kv8kFp16GiB} GB${ANSI.reset} + Buf: ${ANSI.white}${ev.computeBufferGiB} GB${ANSI.reset} = ${ANSI.bold}${ev.cleanState.totalFootprintGiB} GB Total${ANSI.reset}`
      );

      // Fila de Velocidad y Comportamiento por Estado
      const liveSpeedDiff =
        ev.liveState.decodeTokPerSec !== ev.cleanState.decodeTokPerSec
          ? ` ${ANSI.yellow}(Con apps abiertas: ~${ev.liveState.decodeTokPerSec} tok/s)${ANSI.reset}`
          : '';

      console.log(
        `  ├─ ${ANSI.brightCyan}Rendimiento:${ANSI.reset}     ${formatSpeedColor(ev.cleanState.decodeTokPerSec)}${liveSpeedDiff} │ ${ANSI.white}Prefill: ~${ev.cleanState.prefillTokPerSec} tok/s (TTFT 1K: ${ev.cleanState.ttftSeconds}s)${ANSI.reset} │ ${ANSI.brightGreen}${ev.cleanState.executionMode}${ANSI.reset}`
      );

      // Curva de Contexto (4K, 8K, 16K, 32K)
      if (!m.isWorkloadType) {
        const curveStr = ev.contextCurve
          .map((c) => {
            const color = c.gpuLayerPct === 100 ? ANSI.brightGreen : c.gpuLayerPct >= 75 ? ANSI.brightYellow : ANSI.brightRed;
            return `${ANSI.white}${c.ctxLabel}:${ANSI.reset} ${color}${c.tokPerSec} t/s${ANSI.reset} ${ANSI.white}(${c.gpuLayerPct}% GPU)${ANSI.reset}`;
          })
          .join('  ->  ');
        console.log(`  ├─ ${ANSI.brightCyan}Escala Contexto:${ANSI.reset} ${curveStr}`);
      }

      // Diagnostico Quirurgico
      console.log(`  ├─ ${ANSI.brightCyan}Analisis IA:${ANSI.reset}     ${ANSI.white}${m.surgicalSummary}${ANSI.reset}`);
      console.log(`  ├─ ${ANSI.brightCyan}En tu Portatil:${ANSI.reset}  ${ANSI.yellow}${ev.behaviorVerdict}${ANSI.reset}`);
      console.log(`  ├─ ${ANSI.brightCyan}Receta Experta:${ANSI.reset}  ${ANSI.brightGreen}${ev.optimizationTip}${ANSI.reset}`);
      console.log(
        `  └─ ${ANSI.white}Ejecutar ahora:${ANSI.reset}  ${ANSI.brightCyan}${m.ollamaCmd}${ANSI.reset}   ${ANSI.white}│ Flags: ${ev.surgicalFlags}${ANSI.reset}\n`
      );
    }
  }
}

/**
 * Renderiza el Leaderboard Oficial de Artificial Analysis (Small 4B-40B & Tiny <=4B) con ancho compacto sin saltos de linea
 */
export function renderArtificialAnalysisLeaderboard(evaluations, hardware) {
  console.log(
    `${ANSI.bgYellow}${ANSI.bold} [04] LEADERBOARD ARTIFICIAL ANALYSIS (SMALL 4B-40B & TINY <=4B) FRENTE A TUS SPECS REALES ${ANSI.reset}`
  );
  console.log(
    `${ANSI.white}Fuente: artificialanalysis.ai/models/open-source/small :: Cruzado con tu ${hardware.gpu.name} (${hardware.gpu.totalGiB}GB) + ${hardware.ram.physicalHardwareGB}GB ${hardware.ram.memType}-${hardware.ram.speedMTs}${ANSI.reset}`
  );
  console.log(`${ANSI.gray}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${ANSI.reset}`);

  const aaModels = evaluations
    .filter((e) => e.model.aaProgressIndex)
    .sort((a, b) => b.model.aaProgressIndex - a.model.aaProgressIndex);

  const header =
    `  ${padEndAnsi(ANSI.bold + 'MODELO (4B-40B / <=4B)' + ANSI.reset, 29)}` +
    `${padEndAnsi(ANSI.bold + 'ARQUITECTURA' + ANSI.reset, 16)}` +
    `${padEndAnsi(ANSI.bold + 'PROGRESS INDEX' + ANSI.reset, 18)}` +
    `${padEndAnsi(ANSI.bold + 'OPEN' + ANSI.reset, 6)}` +
    `${padEndAnsi(ANSI.bold + 'VELOCIDAD' + ANSI.reset, 15)}` +
    `${ANSI.bold}COMPORTAMIENTO EN TU PC${ANSI.reset}`;
  console.log(header);
  console.log(`  ${ANSI.gray}${'─'.repeat(110)}${ANSI.reset}`);

  for (const ev of aaModels) {
    const m = ev.model;
    const pi = m.aaProgressIndex;
    const piPct = Math.min(100, Math.round((pi / 310) * 100));
    const piBar = drawBar(piPct, 10);

    const paramTxt = m.isMoE
      ? `${ANSI.brightCyan}${m.paramsTotalB}B/${m.paramsActiveB}B MoE${ANSI.reset}`
      : `${ANSI.white}${m.paramsTotalB}B Denso${ANSI.reset}`;

    const speed = ev.cleanState.decodeTokPerSec;
    const speedStr =
      speed >= 45
        ? `${ANSI.brightGreen}[+] ~${speed} t/s${ANSI.reset}`
        : speed >= 20
          ? `${ANSI.brightCyan}[*] ~${speed} t/s${ANSI.reset}`
          : `${ANSI.brightYellow}[~] ~${speed} t/s${ANSI.reset}`;

    let specVerdict = '';
    if (ev.cleanState.gpuLayerPct === 100) {
      specVerdict = `${ANSI.brightGreen}[100% GPU] ${ev.weightsGiB}GB ${ev.selectedQuant.id}${ANSI.reset}`;
    } else if (m.isMoE) {
      specVerdict = `${ANSI.brightCyan}[MoE GPU+RAM] ${ev.cleanState.gpuLayerPct}% GPU + DDR5${ANSI.reset}`;
    } else if (ev.cleanState.totalFootprintGiB <= hardware.ram.osFreeGB + hardware.gpu.cleanModeFreeGiB) {
      specVerdict = `${ANSI.brightYellow}[SPLIT RAM] ${ev.cleanState.gpuLayerPct}% GPU + ${ev.cleanState.ramSpillGiB}GB DDR5${ANSI.reset}`;
    } else {
      specVerdict = `${ANSI.brightRed}[!] EXCEDE RAM LIBRE${ANSI.reset}`;
    }

    console.log(
      `  ${padEndAnsi(ANSI.bold + ANSI.white + m.name.slice(0, 27) + ANSI.reset, 29)}` +
        `${padEndAnsi(paramTxt, 16)}` +
        `${padEndAnsi(`${piBar} ${ANSI.bold}${ANSI.brightYellow}${pi}${ANSI.reset}`, 18)}` +
        `${padEndAnsi(`${ANSI.brightCyan}${m.aaOpennessIndex}${ANSI.reset}`, 6)}` +
        `${padEndAnsi(speedStr, 15)}` +
        `${specVerdict}`
    );
  }

  console.log(`\n  ${ANSI.brightCyan}${ANSI.bold}[LECTURA QUIRURGICA DE ARTIFICIAL ANALYSIS PARA TU PORTATIL]:${ANSI.reset}`);
  console.log(
    `  * ${ANSI.brightGreen}Velocidad pura en 8GB VRAM:${ANSI.reset} ${ANSI.bold}K2 Horizon 7B (PI: 263)${ANSI.reset} y ${ANSI.bold}Qwen 3 8B (PI: 244)${ANSI.reset} corren 100% en tu RTX 5050 a 50-62 tok/s.`
  );
  console.log(
    `  * ${ANSI.brightCyan}Maxima inteligencia fluida (>20 tok/s):${ANSI.reset} ${ANSI.bold}K2 Horizon MoVA 36B-A4B (PI: 281)${ANSI.reset} y ${ANSI.bold}Qwen 3.6 35B-A3B (PI: 261)${ANSI.reset} usan tus 32GB DDR5 + 8GB GDDR7 activando solo 3B-4B por token.`
  );
  console.log(
    `  * ${ANSI.brightYellow}Lideres #1 y #2 globales (Nanbeige 4.3-33B [PI: 305] y Qwen 3.6 27B [PI: 303]):${ANSI.reset} Caben en tus 32GB DDR5 en IQ4_XS (~16-19 GB) sin usar SSD, corriendo a ~4.3-5.4 tok/s.\n`
  );
}

/**
 * Renderiza el Panel 5: Tabla Resumen Ejecutiva + Podio Quirurgico para este Portatil
 */
export function renderExecutiveSummaryTable(evaluations, hardware) {
  console.log(`${ANSI.bgGreen}${ANSI.bold} [05] MATRIZ COMPARATIVA DIRECTA Y PODIO QUIRURGICO PARA TU ${hardware.gpu.name.toUpperCase()} ${ANSI.reset}`);
  console.log(`${ANSI.gray}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${ANSI.reset}`);

  const header =
    `  ${padEndAnsi(ANSI.bold + '#' + ANSI.reset, 5)}` +
    `${padEndAnsi(ANSI.bold + 'MODELO SOTA' + ANSI.reset, 31)}` +
    `${padEndAnsi(ANSI.bold + 'QUANT' + ANSI.reset, 9)}` +
    `${padEndAnsi(ANSI.bold + 'PESO+KV' + ANSI.reset, 11)}` +
    `${padEndAnsi(ANSI.bold + 'CAPAS GPU' + ANSI.reset, 14)}` +
    `${padEndAnsi(ANSI.bold + 'VELOCIDAD' + ANSI.reset, 15)}` +
    `${padEndAnsi(ANSI.bold + 'CTX 100% GPU' + ANSI.reset, 15)}` +
    `${ANSI.bold}FIT SCORE${ANSI.reset}`;
  console.log(header);
  console.log(`  ${ANSI.gray}${'─'.repeat(110)}${ANSI.reset}`);

  const sorted = [...evaluations].sort((a, b) => b.surgicalFitPct - a.surgicalFitPct);
  sorted.forEach((ev, idx) => {
    const m = ev.model;
    const numTag = `${ANSI.brightCyan}[${String(idx + 1).padStart(2)}]${ANSI.reset}`;
    const layersTxt =
      ev.cleanState.gpuLayerPct === 100
        ? `${ANSI.brightGreen}${ev.cleanState.gpuLayers}/${m.layers} (100%)${ANSI.reset}`
        : `${ANSI.brightYellow}${ev.cleanState.gpuLayers}/${m.layers} (${ev.cleanState.gpuLayerPct}%)${ANSI.reset}`;

    const ctxTxt = m.isWorkloadType
      ? `${ANSI.white}N/A (Media)${ANSI.reset}`
      : ev.maxCtxQ8Clean >= 1024
        ? `${ANSI.white}${Math.round(ev.maxCtxFp16Clean / 1024)}K${ANSI.reset} ${ANSI.brightCyan}(${Math.round(ev.maxCtxQ8Clean / 1024)}K Q8)${ANSI.reset}`
        : `${ANSI.brightRed}Offload DDR5${ANSI.reset}`;

    const speedTxt =
      ev.cleanState.decodeTokPerSec >= 45
        ? `${ANSI.brightGreen}~${ev.cleanState.decodeTokPerSec} tok/s${ANSI.reset}`
        : ev.cleanState.decodeTokPerSec >= 20
          ? `${ANSI.brightCyan}~${ev.cleanState.decodeTokPerSec} tok/s${ANSI.reset}`
          : `${ANSI.brightYellow}~${ev.cleanState.decodeTokPerSec} tok/s${ANSI.reset}`;

    const fitTxt = `${ANSI.bold}${ev.tier} (${ev.surgicalFitPct}%)${ANSI.reset}`;

    console.log(
      `  ${padEndAnsi(numTag, 5)}` +
        `${padEndAnsi(ANSI.white + m.name.slice(0, 28) + ANSI.reset, 31)}` +
        `${padEndAnsi(ANSI.brightCyan + ev.selectedQuant.id + ANSI.reset, 9)}` +
        `${padEndAnsi(`${ev.cleanState.totalFootprintGiB} GB`, 11)}` +
        `${padEndAnsi(layersTxt, 14)}` +
        `${padEndAnsi(speedTxt, 15)}` +
        `${padEndAnsi(ctxTxt, 15)}` +
        `${fitTxt}`
    );
  });

  console.log(`\n  ${ANSI.brightYellow}${ANSI.bold}[PODIO QUIRURGICO DEFINITIVO PARA TU PORTATIL]:${ANSI.reset}`);
  console.log(
    `  [1] ${ANSI.brightGreen}${ANSI.bold}Mejor 100% en tus 8GB VRAM:${ANSI.reset} ${ANSI.white}K2 Horizon 7B (PI: 263)${ANSI.reset} y ${ANSI.white}Qwen 2.5 Coder 7B (Q4_K_M)${ANSI.reset} -> ~60 tok/s con hasta 73K-75K de contexto en Q8_0.`
  );
  console.log(
    `  [2] ${ANSI.brightCyan}${ANSI.bold}Mejor Hibrido MoE (GPU + 32GB DDR5):${ANSI.reset} ${ANSI.white}K2 Horizon MoVA 36B-A4B (PI: 281)${ANSI.reset} y ${ANSI.white}Qwen 3.6 35B-A3B (PI: 261)${ANSI.reset} -> Inteligencia de 35B-36B corriendo a ~25-27 tok/s.`
  );
  console.log(
    `  [3] ${ANSI.brightMagenta}${ANSI.bold}Mejor Multimodal / Vision:${ANSI.reset} ${ANSI.white}Qwen 3-VL 8B / Qwen 2.5-VL 7B${ANSI.reset} -> Entra completo (modelo + proyector ViT) en tus 8GB de VRAM a ~47 tok/s.\n`
  );
  return sorted;
}
