@echo off
setlocal
title Build TaoDeThi.exe
cd /d "%~dp0"
rem Nuitka bien dich Python -> C -> .exe goc (khong dung PyInstaller vi bytecode de bi dich nguoc).
rem Nuitka 4.2 tro len ho tro chinh thuc Python 3.14. File nay tu tim Python 3.14, 3.13 hoac 3.12 tren may.
set "PYCMD="
for %%V in (3.14 3.13 3.12) do if not defined PYCMD py -%%V -c "import sys" >nul 2>&1 && set "PYCMD=py -%%V"
if not defined PYCMD python -c "import sys,venv;sys.exit(0 if sys.version_info>=(3,12) else 1)" >nul 2>&1 && set "PYCMD=python"
if defined PYCMD goto :co_python

echo [!] Khong tim thay Python 3.12 tro len tren may nay.
echo     ^(Thu muc portable\python di kem du an chi de chay web, khong dung de build duoc.^)
where winget >nul 2>&1
if errorlevel 1 (
  echo     Hay cai Python 3.13 tu https://www.python.org/downloads/ ^(tick "Add python.exe to PATH"^) roi chay lai file nay.
  pause
  exit /b 1
)
set /p ANS=Cai Python 3.13 bang winget ngay bay gio? (Y/N): 
if /i not "%ANS%"=="Y" exit /b 1
winget install -e --id Python.Python.3.13 --scope user --accept-package-agreements --accept-source-agreements
if errorlevel 1 (
  echo [!] Cai Python that bai. Cai tay tu python.org roi chay lai.
  pause
  exit /b 1
)
echo.
echo [+] Da cai Python. HAY DONG cua so nay, mo cua so moi va chay lai build_taodethi.bat de may nhan Python moi.
pause
exit /b 0

:co_python
echo [*] Dung: %PYCMD%
%PYCMD% --version
%PYCMD% -m pip install --upgrade nuitka zstandard
if errorlevel 1 (
  echo [!] Khong cai duoc Nuitka bang pip. Kiem tra ket noi mang roi chay lai.
  pause
  exit /b 1
)
%PYCMD% -m nuitka --onefile --assume-yes-for-downloads --enable-plugin=tk-inter --windows-console-mode=disable ^
  --output-dir="%~dp0..\..\dist" --output-filename=TaoDeThi.exe --product-name="TaoDeThi" ^
  --file-version=1.0.0.0 taodethi.py
if errorlevel 1 (
  echo.
  echo [!] Build that bai. Neu thong bao noi thieu trinh bien dich C: tra loi Yes khi Nuitka hoi tai MinGW,
  echo     hoac cai "Build Tools for Visual Studio" ^(workload C++^) roi chay lai.
  pause
  exit /b 1
)
echo.
echo [+] Xong: %~dp0..\..\dist\TaoDeThi.exe
echo     Keo file de thi .exe tha len bieu tuong de tao file _LAN.exe.
pause
