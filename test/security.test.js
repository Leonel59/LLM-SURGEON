import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import {
  assertLoopbackUrl,
  safeExecFile,
  sanitizeModelId,
  redactPrivacyPath,
  computeCodebaseIntegrity
} from '../src/security/security-guard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');

function getAllJsFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...getAllJsFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.js')) results.push(full);
  }
  return results;
}

test('1. Supply-Chain Security: package.json tiene exactamente 0 dependencias externas', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
  assert.equal(Object.keys(pkg.dependencies || {}).length, 0, 'No debe existir ninguna dependencia de terceros en dependencies');
  assert.equal(Object.keys(pkg.devDependencies || {}).length, 0, 'No debe existir ninguna dependencia de terceros en devDependencies');
});

test('2. Static Code Audit: Ningún archivo en src/ usa execSync, eval, Function() ni URLs externas', () => {
  const jsFiles = getAllJsFiles(SRC_DIR);
  assert.ok(jsFiles.length >= 6, 'Deben existir los módulos fuente en src/');

  for (const file of jsFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ROOT_DIR, file);

    // Prohibir execSync o spawn con shell
    assert.equal(/\bexecSync\s*\(/.test(content), false, `Uso prohibido de execSync en ${rel}`);
    assert.equal(/\beval\s*\(/.test(content), false, `Uso prohibido de eval() en ${rel}`);
    assert.equal(/new\s+Function\s*\(/.test(content), false, `Uso prohibido de new Function() en ${rel}`);
    assert.equal(/shell\s*:\s*true/.test(content), false, `Prohibido shell: true en ${rel}`);

    // Verificar que todas las URLs http/https en el código apunten exclusivamente a 127.0.0.1
    const urlMatches = content.match(/https?:\/\/[^\s'"`)]+/g) || [];
    for (const urlStr of urlMatches) {
      assert.equal(
        urlStr.startsWith('http://127.0.0.1:11434') || urlStr.startsWith('http://127.0.0.1:1234'),
        true,
        `URL externa o no autorizada detectada en ${rel}: ${urlStr}`
      );
    }
  }
});

test('3. Firewall Lógico Loopback: assertLoopbackUrl bloquea cualquier IP/dominio externo o puerto ajeno', () => {
  assert.equal(
    assertLoopbackUrl('http://127.0.0.1:11434/api/tags'),
    'http://127.0.0.1:11434/api/tags'
  );
  assert.equal(
    assertLoopbackUrl('http://127.0.0.1:1234/v1/models'),
    'http://127.0.0.1:1234/v1/models'
  );

  // Bloqueos obligatorios
  assert.throws(() => assertLoopbackUrl('https://example.com/telemetry'), /SECURITY_BLOCK/);
  assert.throws(() => assertLoopbackUrl('http://192.168.1.10:11434/api/tags'), /SECURITY_BLOCK/);
  assert.throws(() => assertLoopbackUrl('http://127.0.0.1:8080/secret'), /SECURITY_BLOCK/);
  assert.throws(() => assertLoopbackUrl('file:///C:/Windows/System32'), /SECURITY_BLOCK/);
});

test('4. Protección Anti-Inyección de Comandos (CWE-78): safeExecFile bloquea binarios fuera de la lista blanca', () => {
  assert.throws(() => safeExecFile('cmd.exe', ['/c', 'whoami']), /SECURITY_BLOCK/);
  assert.throws(() => safeExecFile('curl.exe', ['http://evil.com']), /SECURITY_BLOCK/);
  assert.throws(() => safeExecFile('bash', ['-c', 'ls']), /SECURITY_BLOCK/);
});

test('5. Privacidad (No-PII): redactPrivacyPath anonimiza el usuario del sistema operativo', () => {
  const home = os.homedir();
  const sampleFile = path.join(home, 'Documents', 'llm-surgeon', 'DIAGNOSTICO-QUIRURGICO-IA.md');
  const redacted = redactPrivacyPath(sampleFile);

  const username = os.userInfo().username;
  assert.equal(
    redacted.toLowerCase().includes(username.toLowerCase()),
    false,
    `La ruta anonimizada (${redacted}) no debe contener el nombre de usuario (${username})`
  );
  assert.equal(redacted.startsWith('~'), true, 'La ruta en home debe comenzar con ~');
});

test('6. Sanitización de IDs de modelos y cálculo SHA-256 de integridad', () => {
  const dirty = 'qwen2.5-coder:7b; rm -rf / && calc.exe';
  const clean = sanitizeModelId(dirty);
  assert.equal(clean.includes(';'), false);
  assert.equal(clean.includes(' '), false);
  assert.equal(clean.includes('&'), false);

  const integrity = computeCodebaseIntegrity(SRC_DIR);
  assert.ok(integrity.totalFiles >= 6);
  assert.equal(integrity.combinedSha256.length, 64);
});

test('7. Estilo Minimalista ASCII: Ningún archivo en src/ ni README.md contiene emojis', () => {
  const emojiRegex = /\p{Extended_Pictographic}/u;
  const jsFiles = getAllJsFiles(SRC_DIR);
  for (const file of jsFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ROOT_DIR, file);
    assert.equal(emojiRegex.test(content), false, `Se detectó un emoji en ${rel}`);
  }
  const readmeContent = fs.readFileSync(path.join(ROOT_DIR, 'README.md'), 'utf8');
  assert.equal(emojiRegex.test(readmeContent), false, 'Se detectó un emoji en README.md');
});

