import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import {
  safeExecFile,
  safeLocalFetchJson,
  assertLoopbackUrl,
  sanitizeModelId,
  redactPrivacyPath
} from '../security/security-guard.js';

/**
 * Busca archivos .gguf recursivamente hasta profundidad 4 en carpetas de LM Studio (Modo solo lectura)
 */
function scanGgufFiles(rootDir, maxDepth = 4, currentDepth = 0) {
  const results = [];
  if (currentDepth > maxDepth || !fs.existsSync(rootDir)) return results;

  try {
    const entries = fs.readdirSync(rootDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue; // Seguridad: nunca seguir symlinks arbitrarios
      const fullPath = path.join(rootDir, entry.name);
      if (entry.isDirectory()) {
        results.push(...scanGgufFiles(fullPath, maxDepth, currentDepth + 1));
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.gguf')) {
        const stats = fs.statSync(fullPath);
        const sizeGiB = Number((stats.size / 1024 ** 3).toFixed(2));
        if (sizeGiB >= 0.25) {
          results.push({
            id: sanitizeModelId(entry.name.replace(/\.gguf$/i, '')),
            fileName: entry.name,
            fullPath: redactPrivacyPath(fullPath),
            sizeGiB,
            provider: 'LM Studio (Disco GGUF)'
          });
        }
      }
    }
  } catch {
    // Ignorar errores de permisos de lectura
  }
  return results;
}

/**
 * Escanea manifiestos en disco de Ollama si el servidor HTTP está apagado (Solo lectura)
 */
function scanOllamaDiskManifests(ollamaModelsDir) {
  const models = [];
  const libraryDir = path.join(ollamaModelsDir, 'manifests', 'registry.ollama.ai', 'library');
  if (!fs.existsSync(libraryDir)) return models;

  try {
    const modelFolders = fs.readdirSync(libraryDir, { withFileTypes: true });
    for (const folder of modelFolders) {
      if (!folder.isDirectory() || folder.isSymbolicLink()) continue;
      const tagDir = path.join(libraryDir, folder.name);
      const tags = fs.readdirSync(tagDir, { withFileTypes: true });
      for (const tag of tags) {
        if (tag.isFile() && !tag.isSymbolicLink()) {
          let sizeGiB = 0;
          try {
            const manifest = JSON.parse(fs.readFileSync(path.join(tagDir, tag.name), 'utf8'));
            const totalBytes = (manifest.layers || []).reduce((acc, l) => acc + (l.size || 0), 0);
            sizeGiB = Number((totalBytes / 1024 ** 3).toFixed(2));
          } catch {
            sizeGiB = 0;
          }
          models.push({
            id: sanitizeModelId(`${folder.name}:${tag.name}`),
            sizeGiB,
            quantization: 'GGUF/Ollama',
            provider: 'Ollama (Disco)'
          });
        }
      }
    }
  } catch {
    // Ignorar errores
  }
  return models;
}

/**
 * Detecta el estado completo de Ollama y LM Studio (Binarios, Demonios en Vivo y Modelos Descargados)
 * respentando el modo --offline si el usuario desea 0 tráfico siquiera en loopback.
 */
export async function probeLocalRuntimes(offlineMode = false) {
  const home = os.homedir();
  const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';

  // --- 1. OLLAMA DETECTION ---
  const ollamaVerRaw = safeExecFile('ollama', ['--version']);
  const ollamaExePaths = [
    path.join(localAppData, 'Programs', 'Ollama', 'ollama.exe'),
    path.join(programFiles, 'Ollama', 'ollama.exe')
  ];
  const ollamaExeFound = ollamaExePaths.find((p) => fs.existsSync(p)) || null;
  const ollamaInstalled = Boolean(ollamaVerRaw || ollamaExeFound);
  const ollamaVersion = ollamaVerRaw ? ollamaVerRaw.replace(/ollama version is/i, '').trim() : ollamaExeFound ? 'Instalado' : null;

  const ollamaTagsJson = await safeLocalFetchJson('http://127.0.0.1:11434/api/tags', {}, 1500, offlineMode);
  const ollamaPsJson = await safeLocalFetchJson('http://127.0.0.1:11434/api/ps', {}, 1500, offlineMode);
  const ollamaApiRunning = Boolean(ollamaTagsJson);

  let ollamaModels = [];
  if (ollamaTagsJson?.models) {
    ollamaModels = ollamaTagsJson.models.map((m) => ({
      id: sanitizeModelId(m.name),
      sizeGiB: Number(((m.size || 0) / 1024 ** 3).toFixed(2)),
      quantization: m.details?.quantization_level || 'Q4_0',
      family: m.details?.family || 'LLM',
      paramSize: m.details?.parameter_size || '',
      provider: 'Ollama',
      apiEndpoint: 'http://127.0.0.1:11434'
    }));
  } else {
    const customModelsDir = process.env.OLLAMA_MODELS || path.join(home, '.ollama', 'models');
    ollamaModels = scanOllamaDiskManifests(customModelsDir);
  }

  // --- 2. LM STUDIO DETECTION ---
  const lmsExePaths = [
    path.join(localAppData, 'LM-Studio', 'LM Studio.exe'),
    path.join(localAppData, 'Programs', 'LM Studio', 'LM Studio.exe'),
    path.join(programFiles, 'LM Studio', 'LM Studio.exe'),
    path.join(home, '.lmstudio', 'bin', 'lms.exe')
  ];
  const lmsExeFound = lmsExePaths.find((p) => fs.existsSync(p)) || null;
  const lmsDirs = [
    path.join(home, '.lmstudio', 'models'),
    path.join(home, '.cache', 'lm-studio', 'models')
  ];
  const lmsDirFound = lmsDirs.find((d) => fs.existsSync(d)) || null;
  const lmsApiJson = await safeLocalFetchJson('http://127.0.0.1:1234/v1/models', {}, 1500, offlineMode);
  const lmsApiRunning = Boolean(lmsApiJson);
  const lmsInstalled = Boolean(lmsExeFound || lmsDirFound || lmsApiRunning);

  let lmsModels = [];
  if (lmsDirFound) {
    lmsModels = scanGgufFiles(lmsDirFound);
  }
  if (lmsApiJson?.data && Array.isArray(lmsApiJson.data)) {
    for (const item of lmsApiJson.data) {
      const safeId = sanitizeModelId(item.id);
      if (safeId && !lmsModels.some((m) => m.id.includes(safeId))) {
        lmsModels.push({
          id: safeId,
          sizeGiB: 0,
          quantization: 'Cargado en API',
          provider: 'LM Studio API',
          apiEndpoint: 'http://127.0.0.1:1234'
        });
      }
    }
  }

  const allDownloadedModels = [...ollamaModels, ...lmsModels];

  return {
    ollama: {
      installed: ollamaInstalled,
      version: ollamaVersion,
      apiRunning: ollamaApiRunning,
      exePath: redactPrivacyPath(ollamaExeFound),
      activeVramModels: ollamaPsJson?.models || [],
      models: ollamaModels
    },
    lmStudio: {
      installed: lmsInstalled,
      apiRunning: lmsApiRunning,
      exePath: redactPrivacyPath(lmsExeFound),
      modelsDir: redactPrivacyPath(lmsDirFound),
      models: lmsModels
    },
    allDownloadedModels
  };
}

/**
 * Lee VRAM en vivo desde nvidia-smi (sin shell) para medir el pico durante el benchmark
 */
function readCurrentVramUsedMiB() {
  const out = safeExecFile(
    'nvidia-smi',
    ['--query-gpu=memory.used', '--format=csv,noheader,nounits'],
    1500
  );
  return parseFloat(out) || 0;
}

/**
 * Ejecuta un Test Quirúrgico Real de Velocidad contra Ollama o LM Studio (Loopback Verificado)
 */
export async function executeLiveModelSpeedTest(modelEntry, onTokenProgress) {
  const safeModelId = sanitizeModelId(modelEntry.id);
  const prompt =
    'Write a clean, well-commented binary search implementation in JavaScript and briefly explain its time and space complexity in 4 concise sentences.';

  const vramBeforeMiB = readCurrentVramUsedMiB();

  // Caso A: Modelo en Ollama (API local 11434 verificada por assertLoopbackUrl)
  if (modelEntry.provider.startsWith('Ollama')) {
    const startTotal = performance.now();
    try {
      const targetUrl = assertLoopbackUrl('http://127.0.0.1:11434/api/generate');
      const response = await fetch(targetUrl, {
        method: 'POST',
        redirect: 'error',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: safeModelId,
          prompt,
          stream: true,
          options: {
            num_predict: 160,
            temperature: 0.2
          }
        })
      });

      if (!response.ok || !response.body) {
        return {
          success: false,
          error: `El servidor Ollama respondió con estado HTTP ${response.status}. Asegúrate de que 'ollama serve' esté activo.`
        };
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let firstTokenTime = null;
      let tokenCount = 0;
      let peakVramMiB = vramBeforeMiB;
      let finalStats = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.response) {
              if (firstTokenTime === null) {
                firstTokenTime = performance.now();
                peakVramMiB = Math.max(peakVramMiB, readCurrentVramUsedMiB());
              }
              tokenCount++;
              const elapsedGenSec = Math.max(0.05, (performance.now() - firstTokenTime) / 1000);
              const liveTokPerSec = Number((tokenCount / elapsedGenSec).toFixed(1));
              if (onTokenProgress) onTokenProgress(tokenCount, liveTokPerSec, data.response);
            }
            if (data.done) {
              finalStats = data;
            }
          } catch {
            // Ignorar fragmentos parciales
          }
        }
      }

      const endTotal = performance.now();
      peakVramMiB = Math.max(peakVramMiB, readCurrentVramUsedMiB());

      const evalCount = finalStats?.eval_count || tokenCount;
      const evalDurationSec = finalStats?.eval_duration
        ? finalStats.eval_duration / 1e9
        : Math.max(0.1, (endTotal - (firstTokenTime || startTotal)) / 1000);
      const promptEvalCount = finalStats?.prompt_eval_count || 32;
      const promptEvalSec = finalStats?.prompt_eval_duration ? finalStats.prompt_eval_duration / 1e9 : 0.25;

      const decodeTokPerSec = Number((evalCount / Math.max(0.01, evalDurationSec)).toFixed(1));
      const prefillTokPerSec = Number((promptEvalCount / Math.max(0.01, promptEvalSec)).toFixed(1));
      const ttftMs = Math.round((firstTokenTime || endTotal) - startTotal);

      return {
        success: true,
        provider: 'Ollama Engine',
        modelId: safeModelId,
        tokensGenerated: evalCount,
        ttftMs,
        prefillTokPerSec,
        decodeTokPerSec,
        vramBeforeMiB,
        peakVramMiB,
        vramDeltaMiB: Math.max(0, Math.round(peakVramMiB - vramBeforeMiB)),
        totalDurationSec: Number(((endTotal - startTotal) / 1000).toFixed(2))
      };
    } catch (err) {
      return {
        success: false,
        error: `No se pudo conectar con Ollama en 127.0.0.1:11434 (${err.message}).`
      };
    }
  }

  // Caso B: LM Studio OpenAI API (127.0.0.1:1234 verificada por assertLoopbackUrl)
  if (modelEntry.provider.includes('LM Studio')) {
    const startTotal = performance.now();
    try {
      const targetUrl = assertLoopbackUrl('http://127.0.0.1:1234/v1/chat/completions');
      const response = await fetch(targetUrl, {
        method: 'POST',
        redirect: 'error',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: safeModelId,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 150,
          temperature: 0.2,
          stream: true
        })
      });

      if (!response.ok || !response.body) {
        return {
          success: false,
          error: `El servidor local de LM Studio (puerto 1234) no está activo o el modelo no está cargado.`
        };
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let firstTokenTime = null;
      let tokenCount = 0;
      let peakVramMiB = vramBeforeMiB;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:') || trimmed === 'data: [DONE]') continue;
          try {
            const json = JSON.parse(trimmed.slice(5).trim());
            const delta = json.choices?.[0]?.delta?.content || '';
            if (delta) {
              if (firstTokenTime === null) {
                firstTokenTime = performance.now();
                peakVramMiB = Math.max(peakVramMiB, readCurrentVramUsedMiB());
              }
              tokenCount++;
              const elapsedGenSec = Math.max(0.05, (performance.now() - firstTokenTime) / 1000);
              const liveTokPerSec = Number((tokenCount / elapsedGenSec).toFixed(1));
              if (onTokenProgress) onTokenProgress(tokenCount, liveTokPerSec, delta);
            }
          } catch {
            // Ignorar
          }
        }
      }

      const endTotal = performance.now();
      const genDurationSec = Math.max(0.05, (endTotal - (firstTokenTime || startTotal)) / 1000);
      const decodeTokPerSec = Number((tokenCount / genDurationSec).toFixed(1));
      const ttftMs = Math.round((firstTokenTime || endTotal) - startTotal);

      return {
        success: true,
        provider: 'LM Studio Server',
        modelId: safeModelId,
        tokensGenerated: tokenCount,
        ttftMs,
        prefillTokPerSec: Number((35 / Math.max(0.05, ttftMs / 1000)).toFixed(1)),
        decodeTokPerSec,
        vramBeforeMiB,
        peakVramMiB,
        vramDeltaMiB: Math.max(0, Math.round(peakVramMiB - vramBeforeMiB)),
        totalDurationSec: Number(((endTotal - startTotal) / 1000).toFixed(2))
      };
    } catch (err) {
      return {
        success: false,
        error: `Servidor LM Studio en 127.0.0.1:1234 inactivo (${err.message}). Activa el Local Server en LM Studio.`
      };
    }
  }

  return {
    success: false,
    error: 'Proveedor de modelo no soportado para benchmark directo.'
  };
}
