@echo off
setlocal
title Build TaoDeThi.exe
cd /d "%~dp0"
rem Nuitka bien dich Python -> C -> .exe goc (khong dung PyInstaller vi bytecode de bi dich nguoc).
rem Chon Python 3.13 hoac 3.12: Nuitka thuong cham ho tro ban Python moi nhat (3.14). Kiem tra bang: py -0p
set "PYV="
for %%V in (3.13 3.12) do if not defined PYV py -%%V -c "import sys" >nul 2>&1 && set "PYV=%%V"
if not defined PYV (
  echo [!] Khong thay Python 3.12 hoac 3.13. Cai mot trong hai ban roi chay lai ^(python.org^).
  pause
  exit /b 1
)
echo [*] Dung Python %PYV%
py -%PYV% -m pip install --upgrade nuitka ordered-set zstandard
if errorlevel 1 ( echo [!] Khong cai duoc Nuitka & pause & exit /b 1 )
py -%PYV% -m nuitka --onefile --assume-yes-for-downloads --enable-plugin=tk-inter --windows-console-mode=force ^
  --output-dir="%~dp0..\..\dist" --output-filename=TaoDeThi.exe --company-name="" --product-name="TaoDeThi" ^
  --file-version=1.0.0.0 taodethi.py
if errorlevel 1 ( echo [!] Build that bai. Neu bao thieu trinh bien dich C, de Nuitka tu tai MinGW khi no hoi. & pause & exit /b 1 )
echo.
echo [+] Xong: %~dp0..\..\dist\TaoDeThi.exe
echo     Keo file de thi .exe tha len bieu tuong de tao file _LAN.exe.
pause
