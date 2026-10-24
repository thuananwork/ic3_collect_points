@echo off
setlocal
title IC3 Manager
cd /d "%~dp0"
echo =======================================================
echo    DANG KHOI DONG IC3 MANAGER
echo =======================================================

:: Giai phong cong 5000 neu ban cu con chay
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1

:: Tim Python: uu tien ban di kem (portable), roi den venv, cuoi cung tao venv moi tu Python cai tren may
set "PY="
if exist "%~dp0portable\python\python.exe" set "PY=%~dp0portable\python\python.exe"
if not defined PY if exist "%~dp0backend\venv\Scripts\python.exe" (
  "%~dp0backend\venv\Scripts\python.exe" -c "import flask, sqlalchemy, waitress" >nul 2>&1
  if not errorlevel 1 set "PY=%~dp0backend\venv\Scripts\python.exe"
)
if not defined PY call :tao_venv
if not defined PY (
  echo.
  echo [!] Khong tim thay Python dung duoc tren may nay.
  echo     Cai Python 3 ^(python.org^) roi chay lai file nay.
  pause
  exit /b 1
)
if exist "%~dp0portable\python\python.exe" (
  rem Python nhung bo qua thu muc hien tai, nen phai khai bao thu muc backend trong file ._pth de import duoc src
  for %%f in ("%~dp0portable\python\python*._pth") do (
    findstr /l /c:"..\..\backend" "%%f" >nul 2>&1 || (echo.& echo ..\..\backend)>>"%%f"
  )
)
echo [*] Dung Python: %PY%

:: Giao dien web duoc build san trong frontend\dist, backend phuc vu luon nen khong can Node
if not exist "%~dp0frontend\dist\index.html" (
  where npm >nul 2>&1
  if not errorlevel 1 (
    echo [*] Chua co ban build giao dien, dang build ^(can Node.js va Internet^)...
    pushd "%~dp0frontend"
    call npm install
    call npm run build
    popd
  ) else (
    echo [!] Thieu frontend\dist va may khong co Node.js. Hay chep thu muc frontend\dist tu may da build.
  )
)

echo [*] Dang kiem tra va khoi tao co so du lieu...
pushd "%~dp0backend"
"%PY%" setup_database.py
popd
echo.

echo [*] Dang khoi dong he thong...
start "IC3 Manager - Backend" /d "%~dp0backend" cmd /k ""%PY%" app.py"

timeout /t 5 /nobreak >nul
echo [*] Dang mo trinh duyet: http://localhost:5000
start http://localhost:5000

echo =======================================================
echo    DA KHOI DONG XONG! Vui long khong tat cua so Backend.
echo    Hoc sinh/giao vien khac vao bang dia chi: http://IP-MAY-NAY:5000
echo =======================================================
pause
exit /b 0

:tao_venv
echo [*] Chua co moi truong Python dung duoc, dang tao moi ^(can Internet mot lan^)...
set "SYSPY="
where py >nul 2>&1
if not errorlevel 1 set "SYSPY=py -3"
if not defined SYSPY (
  where python >nul 2>&1
  if not errorlevel 1 set "SYSPY=python"
)
if not defined SYSPY goto :eof
if exist "%~dp0backend\venv" rmdir /s /q "%~dp0backend\venv"
%SYSPY% -m venv "%~dp0backend\venv"
if errorlevel 1 goto :eof
"%~dp0backend\venv\Scripts\python.exe" -m pip install -r "%~dp0backend\requirements.txt"
if errorlevel 1 goto :eof
set "PY=%~dp0backend\venv\Scripts\python.exe"
goto :eof
