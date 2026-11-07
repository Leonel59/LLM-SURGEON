@echo off
chcp 65001 >nul
title LLM-SURGEON v2.0 - Diagnostico Quirurgico de IA Local
cd /d "%~dp0"
node src/index.js
pause

