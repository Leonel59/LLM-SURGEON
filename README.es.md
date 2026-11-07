# [LLM-SURGEON v2.0] // Diagnostico Quirurgico de IA Local en Terminal (Documentacion en Espanol)

[![Security & Zero-Trust Audit](https://github.com/Leonel59/LLM-SURGEON/actions/workflows/security-ci.yml/badge.svg)](https://github.com/Leonel59/LLM-SURGEON/actions)
![Zero Dependencies](https://img.shields.io/badge/Dependencies-0%20(100%25%20Native%20Node.js)-brightgreen)
![Zero Telemetry](https://img.shields.io/badge/Telemetry-0%20(100%25%20Offline%20%2F%20Local)-blue)
![Security Verified](https://img.shields.io/badge/Security-CWE--78%20Immune%20%7C%20No--PII-success)
![License MIT](https://img.shields.io/badge/License-MIT-yellow)

> **[ [<- Volver al README Bilingue Principal (English & Espanol)](./README.md) ]**

**`LLM-Surgeon`** es un motor quirurgico de diagnostico fisico de hardware en terminal, simulador matematico de **KV-Cache (GQA) / Partial Offloading** y banco de pruebas de velocidad en tiempo real.

---

## [01] Inspiracion: CanIRun.ai + Artificial Analysis + llmfit

- **[CanIRun.ai](https://canirun.ai/):** Organizacion limpia por secciones de uso (*Coding, Reasoning, General, Vision, Media*).
- **[llmfit](https://www.llmfit.org/):** Ejecucion nativa en terminal, pero eliminando el listado masivo de 500 modelos para mostrar solo los lideres reales por categoria.
- **[Artificial Analysis](https://artificialanalysis.ai/models/open-source):** Integracion del *Progress Index v1* y *Openness Index* a traves de las 4 escalas de modelos Open-Source: **Tiny (`<=4B`)**, **Small (`4B-40B`)**, **Medium (`40B-150B`)** y **Large (`>150B` Frontier: `Kimi K3.1 Pro`, `DeepSeek V4.1 Flash`, `GLM-5.3`, `MiMo-V2.6-Pro`)**.

---

## [02] Instalacion Paso a Paso

### Windows (PowerShell, Git Bash, CMD) / Linux / macOS
```bash
git clone https://github.com/Leonel59/LLM-SURGEON.git
cd LLM-SURGEON
npm test
npm link
llm-surgeon
```

### Comandos Rapidos
- `llm-surgeon` — Inicia el escaner completo y el Laboratorio Interactivo.
- `llm-surgeon --fast` — Imprime el diagnostico instantaneamente sin animacion.
- `llm-surgeon --simulate=1vs13` — Duelo en tiempo real entre el modelo `#1` y el `#13`.
- `llm-surgeon --inspect=k2-horizon-7b` — Muestra la tabla de 6 cuantizaciones (`Q8_0` a `Q3_K_M`).
- `llm-surgeon --security-audit` — Imprime el Certificado Zero-Trust y los hashes **SHA-256**.

