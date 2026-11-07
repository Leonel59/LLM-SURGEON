# Política de Seguridad y Arquitectura Zero-Trust (`LLM-Surgeon`)

Sabemos que ejecutar una herramienta de diagnóstico de hardware en tu terminal requiere **confianza absoluta**. Por ello, `LLM-Surgeon` fue diseñado bajo una arquitectura **Quirúrgicamente Auditable y Zero-Trust** para que cualquier desarrollador pueda verificar su seguridad en menos de 2 minutos.

---

## 5 Garantías Técnicas Verificables

### 1. Cero Dependencias Externas (`0 npm packages`)
- Revisa [`package.json`](./package.json): **no existe `dependencies` ni `devDependencies`**.
- Todo el proyecto corre al 100% sobre APIs nativas de Node.js (`node:os`, `node:child_process`, `node:crypto`, `node:fs`, `node:test`).
- **Por qué importa:** Es matemáticamente inmune a ataques de cadena de suministro (*npm supply-chain attacks*), paquetes secuestrados o scripts `postinstall` maliciosos.

### 2. Cero Telemetría y Firewall Lógico Loopback (`127.0.0.1`)
- `LLM-Surgeon` **jamás realiza conexiones a internet**.
- En [`src/security/security-guard.js`](./src/security/security-guard.js), la función `assertLoopbackUrl()` bloquea por código cualquier dirección que no sea estrictamente `http://127.0.0.1:11434` (Ollama local) o `http://127.0.0.1:1234` (LM Studio local).
- Si deseas desactivar incluso la consulta local a Ollama/LM Studio, puedes ejecutar:
  ```bash
  node src/index.js --offline
  ```

### 3. Cero Ejecución de Shell (`CWE-78 Command Injection Immune`)
- Ningún archivo del proyecto utiliza `execSync`, `eval()`, ni `shell: true`.
- Todas las lecturas de hardware usan exclusivamente `execFileSync` con `shell: false` y una lista blanca estricta de binarios del sistema (`nvidia-smi`, `powershell.exe`, `sysctl`, `ollama`).

### 4. Protección Anti-Fuga de Privacidad (No-PII en Capturas y Reportes)
- Cuando compartes una captura de tu terminal o el archivo `DIAGNOSTICO-QUIRURGICO-IA.md` en redes sociales, Reddit, X o GitHub:
  - **No se recolectan números de serie** de tus memorias RAM, placa base, ni direcciones MAC/IP.
  - **Tu nombre de usuario del sistema operativo es anonimizado automáticamente** (`C:\Users\TuNombre\...` se convierte en `~\...`).
  - Los procesos de GPU solo muestran el nombre base del ejecutable (ej. `msedgewebview2.exe`), nunca rutas completas privadas.

### 5. Ejecución 100% Solo-Lectura y Sin Privilegios de Administrador
- `LLM-Surgeon` no requiere `sudo` ni consola de Administrador en Windows.
- No modifica configuraciones del sistema, registro de Windows ni variables de entorno.

---

## Cómo auditar tú mismo el repositorio en 10 segundos

Ejecuta la suite de pruebas de seguridad estática y el verificador criptográfico SHA-256 incluidos:

```bash
# 1. Ejecutar los tests automatizados de seguridad y análisis estático
npm test

# 2. Ver el certificado de seguridad y hashes SHA-256 en la terminal
npm run security:audit
```

