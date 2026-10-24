@echo off
setlocal
title IC3 Manager - Che do phat trien
cd /d "%~dp0"
rem Chay backend + Vite dev server (can Node.js). Dung khi dang sua giao dien; dung binh thuong thi chay run.bat.
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1

set "PY="
if exist "%~dp0portable\python\python.exe" set "PY=%~dp0portable\python\python.exe"
if not defined PY if exist "%~dp0backend\venv\Scripts\python.exe" set "PY=%~dp0backend\venv\Scripts\python.exe"
if not defined PY (
  echo [!] Chua co Python. Hay chay run.bat truoc de tao moi truong.
  pause
  exit /b 1
)
pushd "%~dp0backend"
"%PY%" setup_database.py
popd
set "IC3_DEV=1"
start "IC3 Manager - Backend" /d "%~dp0backend" cmd /k ""%PY%" app.py"
if not exist "%~dp0frontend\node_modules\@fortawesome" (
  pushd "%~dp0frontend"
  call npm install
  popd
)
start "IC3 Manager - Frontend" /d "%~dp0frontend" cmd /k "npm run dev"
timeout /t 5 /nobreak >nul
start http://localhost:5173
exit /b 0
