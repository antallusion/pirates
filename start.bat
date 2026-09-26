@echo off
chcp 65001 >nul
title GRAVETIDE
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js не найден. Установите Node.js 22 LTS или новее: https://nodejs.org
  echo Node.js is not installed. Get Node.js 22 LTS or newer: https://nodejs.org
  pause
  exit /b 1
)
for /f "tokens=1 delims=." %%v in ('node -p "process.versions.node"') do set NODEMAJOR=%%v
if %NODEMAJOR% LSS 22 (
  echo Нужен Node.js 22.18 или новее, у вас:
  node -v
  echo Скачайте свежий: https://nodejs.org
  pause
  exit /b 1
)
if "%PORT%"=="" set PORT=8080
echo GRAVETIDE запускается на http://localhost:%PORT% — не закрывайте это окно.
start "" "http://localhost:%PORT%"
node --disable-warning=ExperimentalWarning server/src/main.ts
pause
