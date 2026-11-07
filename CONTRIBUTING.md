# Contributing to LLM-Surgeon // Guia de Contribucion

Thank you for your interest in contributing to **`LLM-Surgeon`**. To maintain our Zero-Trust security guarantee and minimalist ASCII aesthetic, all Pull Requests must pass our automated test suite.

---

## [01] Core Architectural Rules (Mandatory)

1. **Zero External Dependencies:** Never add any package to `dependencies` or `devDependencies` in `package.json`. Everything must use native Node.js APIs.
2. **Zero Outbound Network:** No external URLs or telemetry calls may be added to `src/`.
3. **Zero Shell Execution:** Never use `execSync`, `eval()`, or `shell: true`. Use `safeExecFile` in `src/security/security-guard.js`.
4. **Zero Emojis (Minimalist ASCII Only):** Do not use Unicode emojis in `src/` or `README.md`. Use fixed-width ASCII markers (`[+]`, `[*]`, `[~]`, `[!]`, `[>]`, `[01]`) so terminal columns never misalign.

---

## [02] How to Add a New SOTA Model

1. Open [`src/catalog/sota-models.js`](./src/catalog/sota-models.js).
2. Add the model entry with its exact architectural topology (`paramsTotalB`, `paramsActiveB`, `layers`, `kvHeads`, `headDim`, `aaProgressIndex`, `aaOpennessIndex`).
3. Run the verification suite before opening a PR:
   ```bash
   npm test
   npm run security:audit
   ```

