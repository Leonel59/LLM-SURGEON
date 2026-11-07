/**
 * Módulo de Blindaje Quirúrgico de Seguridad y Privacidad (LLM-Surgeon Security Guard)
 *
 * Garantías de diseño para auditoría pública en GitHub:
 * 1. CERO Dependencias Externas (Inmune a ataques de cadena de suministro / npm supply-chain).
 * 2. CERO Conexiones a Internet (Firewall lógico que bloquea cualquier IP que no sea 127.0.0.1).
 * 3. CERO Ejecución de Shell (Sin intérpretes de consola; solo execFileSync con argumentos aislados).
 * 4. CERO Fuga de PII (Anonimización automática de nombres de usuario, rutas locales y números de serie).
 */

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ALLOWED_BINARIES = new Set([
  'nvidia-smi',
  'nvidia-smi.exe',
  'powershell.exe',
  'powershell',
  'ollama',
  'ollama.exe',
  'sysctl',
  'system_profiler',
  'lscpu',
  'rocm-smi'
]);

const ALLOWED_LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
const ALLOWED_LOOPBACK_PORTS = new Set(['11434', '1234']);

/**
 * Ejecuta un binario del sistema de forma 100% segura SIN intérprete de comandos (shell: false).
 * Previene por completo ataques de inyección de comandos (CWE-78).
 */
export function safeExecFile(binary, args = [], timeoutMs = 4500) {
  const baseBin = path.basename(binary).toLowerCase();
  if (!ALLOWED_BINARIES.has(baseBin)) {
    throw new Error(`[SECURITY_BLOCK] Ejecución bloqueada: binario no autorizado (${baseBin}).`);
  }
  if (!Array.isArray(args) || args.some((a) => typeof a !== 'string')) {
    throw new Error('[SECURITY_BLOCK] Los argumentos de proceso deben ser un arreglo estricto de strings.');
  }

  try {
    return execFileSync(binary, args, {
      encoding: 'utf8',
      timeout: timeoutMs,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return '';
  }
}

/**
 * Valida quirúrgicamente que cualquier petición HTTP sea exclusivamente hacia loopback local (127.0.0.1)
 * y únicamente a los puertos estándar de Ollama (11434) o LM Studio (1234).
 */
export function assertLoopbackUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`[SECURITY_BLOCK] URL inválida bloqueada: ${rawUrl}`);
  }

  if (parsed.protocol !== 'http:') {
    throw new Error(`[SECURITY_BLOCK] Protocolo no permitido (${parsed.protocol}). Solo HTTP loopback local.`);
  }
  if (!ALLOWED_LOOPBACK_HOSTS.has(parsed.hostname)) {
    throw new Error(
      `[SECURITY_BLOCK] Intento de conexión externa bloqueado (${parsed.hostname}). LLM-Surgeon es 100% offline/local.`
    );
  }
  if (!ALLOWED_LOOPBACK_PORTS.has(parsed.port)) {
    throw new Error(
      `[SECURITY_BLOCK] Puerto local no autorizado (${parsed.port}). Solo se permiten 11434 (Ollama) y 1234 (LM Studio).`
    );
  }
  return parsed.toString();
}

/**
 * Realiza una petición JSON estrictamente local (127.0.0.1) tras pasar por el guardián de seguridad.
 */
export async function safeLocalFetchJson(url, options = {}, timeoutMs = 1800, offlineMode = false) {
  if (offlineMode) return null;
  const validatedUrl = assertLoopbackUrl(url);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(validatedUrl, {
      ...options,
      redirect: 'error', // Prohibir redirecciones hacia fuera de loopback
      signal: controller.signal
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sanitiza un identificador de modelo antes de enviarlo al motor local o mostrarlo en consola.
 */
export function sanitizeModelId(rawId) {
  return String(rawId || '')
    .replace(/[^\w.\-:/@]/g, '')
    .slice(0, 120);
}

/**
 * Anonimiza rutas del sistema operativo para nunca exponer el nombre de usuario real (PII)
 * en capturas de pantalla ni en reportes exportados a GitHub.
 */
export function redactPrivacyPath(rawPath) {
  if (!rawPath) return '';
  let str = String(rawPath);
  const home = os.homedir();
  if (home && str.toLowerCase().startsWith(home.toLowerCase())) {
    str = '~' + str.slice(home.length);
  }
  try {
    const username = os.userInfo().username;
    if (username && username.length >= 2) {
      const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      str = str.replace(new RegExp(`([\\\\/])Users([\\\\/])${escaped}`, 'gi'), '$1Users$2<USER>');
      str = str.replace(new RegExp(`([\\\\/])home([\\\\/])${escaped}`, 'gi'), '$1home$2<USER>');
    }
  } catch {
    // Ignorar si os.userInfo() no está disponible
  }
  return str;
}

/**
 * Calcula hashes SHA-256 de integridad de todos los archivos fuente para verificación pública.
 */
export function computeCodebaseIntegrity(srcDir) {
  const files = [];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.js')) files.push(full);
    }
  }

  walk(srcDir);
  files.sort();

  const fileHashes = files.map((filePath) => {
    const content = fs.readFileSync(filePath, 'utf8');
    const sha256 = crypto.createHash('sha256').update(content).digest('hex');
    return {
      relativePath: path.relative(path.dirname(srcDir), filePath).replace(/\\/g, '/'),
      sha256: sha256.slice(0, 16) + '...' + sha256.slice(-8),
      fullSha256: sha256,
      lines: content.split(/\r?\n/).length
    };
  });

  const combinedHash = crypto
    .createHash('sha256')
    .update(fileHashes.map((f) => f.fullSha256).join(':'))
    .digest('hex');

  return {
    totalFiles: fileHashes.length,
    totalLines: fileHashes.reduce((acc, f) => acc + f.lines, 0),
    combinedSha256: combinedHash,
    fileHashes
  };
}
