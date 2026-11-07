# Diagnostico Quirurgico de IA Local -- LLM-Surgeon v2.0
> **Inspirado en:** CanIRun.ai + ArtificialAnalysis.ai + llmfit.org | **Seguridad:** 0 Telemetria, 0 Dependencias, Rutas Anonimizadas | **Equipo:** AMD Ryzen 5 240 w/ Radeon 760M Graphics + NVIDIA GeForce RTX 5050 Laptop GPU

## 1. Radiografia Fisica del Hardware
- **CPU:** AMD Ryzen 5 240 w/ Radeon 760M Graphics (6C/12T @ 4.3 GHz, L3 16 MB, `AVX-512 + AVX2 + FMA3 + VNNI (Óptimo para llama.cpp en CPU)`)
- **RAM Fisica:** 32 GB (DDR5 @ 5600 MT/s :: Dual-Channel (2x 16GB))
- **RAM Visible en OS:** 31.31 GB (16.64 GB libres) :: Reserva iGPU UMA: ~0.69 GB
- **Ancho de Banda RAM:** 89.6 GB/s pico / ~66.3 GB/s sostenidos en inferencia CPU
- **GPU Dedicada:** NVIDIA GeForce RTX 5050 Laptop GPU (NVIDIA Blackwell (GB207), 2560 CUDA Cores, GDDR7 (128-bit) @ ~384 GB/s, PCIe Gen 4 x8)
- **VRAM en Vivo vs Limpio:** 6.53 GB libres ahora (1225 MiB ocupados por 15 procesos) -> **7.06 GB libres en Modo Quirurgico Limpio**

## 2. Matriz SOTA Frente a Tu Portatil
| # | Modelo IA | Categoria | Progress Index (AA) | Quant Ideal | Huella (8K) | Capas GPU | Velocidad | Contexto 100% GPU | Fit Score |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | **K2 Horizon 7B** | aa_frontier | 263 | `Q4_K_M` | 5.17 GB | 32/32 (100%) | **~61.7 tok/s** | 38K (73K Q8) | **S+ (97%)** |
| 2 | **Whisper Large V3 Turbo** | media | N/A | `Q6_K` | 1.55 GB | 32/32 (100%) | **~185 tok/s** | N/A | **S+ (97%)** |
| 3 | **K2 Horizon 3.7B (Tiny Leader)** | aa_frontier | 218 | `Q6_K` | 3.84 GB | 26/26 (100%) | **~80.1 tok/s** | 71K (128K Q8) | **S+ (95%)** |
| 4 | **Qwen 2.5 Coder 7B Instruct** | coding | 235 | `Q4_K_M` | 5.34 GB | 28/28 (100%) | **~59.6 tok/s** | 39K (75K Q8) | **S+ (95%)** |
| 5 | **DeepSeek R1 Distill Qwen 7B** | reasoning | 239 | `Q4_K_M` | 5.34 GB | 28/28 (100%) | **~59.6 tok/s** | 39K (75K Q8) | **S+ (95%)** |
| 6 | **Qwen 3 8B (Hybrid Thinking)** | coding | 244 | `Q4_K_M` | 6.34 GB | 36/36 (100%) | **~49.8 tok/s** | 13K (25K Q8) | **S+ (93%)** |
| 7 | **Llama 3.1 / 3.3 8B Instruct** | general | 228 | `Q4_K_M` | 6.13 GB | 32/32 (100%) | **~51.6 tok/s** | 15K (29K Q8) | **S+ (93%)** |
| 8 | **Gemma 3 4B / Qwen 3 4B (Tiny)** | general | 214 | `Q6_K` | 4.29 GB | 26/26 (100%) | **~71.2 tok/s** | 63K (119K Q8) | **S+ (93%)** |
| 9 | **MiniCPM-V 2.6 / MiniCPM 5** | vision | 241 | `Q4_K_M` | 6.16 GB | 28/28 (100%) | **~51.4 tok/s** | 25K (32K Q8) | **S+ (93%)** |
| 10 | **Qwen 3-VL 8B / Qwen 2.5-VL 7B** | vision | 249 | `Q4_K_M` | 6.72 GB | 32/32 (100%) | **~46.9 tok/s** | 13K (26K Q8) | **S (89%)** |
| 11 | **Qwen 3.6 35B-A3B (Thinking MoE)** | aa_frontier | 261 | `Q4_K_M` | 21.38 GB | 14/48 (29%) | **~26.9 tok/s** | Offload DDR5 | **B (76%)** |
| 12 | **Qwen 3 30B-A3B (MoE 3B Active)** | coding | 248 | `Q4_K_M` | 18.84 GB | 16/48 (33%) | **~26.2 tok/s** | Offload DDR5 | **B (76%)** |
| 13 | **K2 Horizon MoVA 36B-A4B (MoE)** | aa_frontier | 281 | `IQ4_XS` | 19.43 GB | 15/48 (31%) | **~24.6 tok/s** | Offload DDR5 | **B (75%)** |
| 14 | **FLUX.1 [schnell] 12B (NF4 / GGUF Q4)** | media | N/A | `IQ4_XS` | 7.09 GB | 37/38 (100%) | **~22 tok/s** | N/A | **B (74%)** |
| 15 | **G2v3-39A5B (MoE 5B Active)** | aa_frontier | 257 | `IQ4_XS` | 20.98 GB | 15/52 (29%) | **~20.1 tok/s** | Offload DDR5 | **B (72%)** |
| 16 | **Gemma 3 12B Instruct** | general | 245 | `IQ4_XS` | 8.16 GB | 33/40 (83%) | **~21.6 tok/s** | 1K (2K Q8) | **B (71%)** |
| 17 | **Qwen 2.5 Coder 14B Instruct** | coding | 251 | `IQ4_XS` | 9.64 GB | 32/48 (67%) | **~13.8 tok/s** | Offload DDR5 | **C (63%)** |
| 18 | **DeepSeek R1 Distill Qwen 14B** | reasoning | 253 | `IQ4_XS` | 9.64 GB | 32/48 (67%) | **~13.8 tok/s** | Offload DDR5 | **C (63%)** |
| 19 | **Qwen 3.6 27B (xhigh / medium)** | aa_frontier | 303 | `IQ4_XS` | 16.08 GB | 19/56 (34%) | **~5.4 tok/s** | Offload DDR5 | **C (53%)** |
| 20 | **Nanbeige 4.3-33B** | aa_frontier | 305 | `IQ4_XS` | 19.07 GB | 17/60 (28%) | **~4.3 tok/s** | Offload DDR5 | **C (53%)** |
| 21 | **Muse Glimmer 30B (high)** | aa_frontier | 267 | `IQ4_XS` | 17.46 GB | 18/56 (32%) | **~4.9 tok/s** | Offload DDR5 | **C (52%)** |
| 22 | **Gemma 4 31B Instruct** | aa_frontier | 254 | `IQ4_XS` | 18.08 GB | 18/60 (30%) | **~4.6 tok/s** | Offload DDR5 | **C (51%)** |
| 23 | **Llama 3.3 70B / DeepSeek R1 70B** | aa_heavy_frontier | 288 | `IQ4_XS` | 38.3 GB | 9/80 (11%) | **~0.4 tok/s** | Offload DDR5 | **D (31%)** |
| 24 | **Llama 4 Scout 109B-A17B (MoE)** | aa_heavy_frontier | 296 | `IQ4_XS` | 56.3 GB | 4/48 (8%) | **~0.7 tok/s** | Offload DDR5 | **D (21%)** |
| 25 | **MiMo-V2.6-Pro (Frontier MoE)** | aa_heavy_frontier | 314 | `IQ4_XS` | 73.13 GB | 4/64 (6%) | **~0.7 tok/s** | Offload DDR5 | **D (16%)** |
| 26 | **GLM-5.3 (max) (Frontier MoE)** | aa_heavy_frontier | 318 | `IQ4_XS` | 92.43 GB | 4/80 (5%) | **~0.5 tok/s** | Offload DDR5 | **D (13%)** |
| 27 | **DeepSeek V4.1 Flash 1017 (max)** | aa_heavy_frontier | 324 | `IQ4_XS` | 118.57 GB | 3/60 (5%) | **~0.6 tok/s** | Offload DDR5 | **D (10%)** |
| 28 | **Kimi K3.1 Pro (Frontier MoE)** | aa_heavy_frontier | 329 | `IQ4_XS` | 131.51 GB | 2/64 (3%) | **~0.5 tok/s** | Offload DDR5 | **D (9%)** |