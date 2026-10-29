@echo off
setlocal
title Build ic3_collect_points (ban phat hanh)
cd /d "%~dp0..\.."
set "ROOT=%CD%"
set "BUILD=%ROOT%\build"
set "OUT=%ROOT%\release\ic3_collect_points"

rem ===== 0. Dieu kien can co =====
if not exist "%ROOT%\backend\src\config\pubkey.txt" (
  echo [!] Chua co khoa cong khai backend\src\config\pubkey.txt.
  echo     Chay truoc: python tools\captaikhoan\captaikhoan.py keygen
  pause
  exit /b 1
)
where npm >nul 2>&1
if errorlevel 1 (
  echo [!] Can Node.js de build giao dien. Cai tu https://nodejs.org roi chay lai.
  pause
  exit /b 1
)

rem ===== 1. Tim Python 3.14 / 3.13 / 3.12 =====
set "PYCMD="
for %%V in (3.14 3.13 3.12) do if not defined PYCMD py -%%V -c "import sys" >nul 2>&1 && set "PYCMD=py -%%V"
if not defined PYCMD python -c "import sys,venv;sys.exit(0 if sys.version_info>=(3,12) else 1)" >nul 2>&1 && set "PYCMD=python"
if not defined PYCMD (
  echo [!] Khong tim thay Python 3.12 tro len. Chay tools\taodethi\build_taodethi.bat de duoc huong dan cai, roi chay lai file nay.
  pause
  exit /b 1
)
echo [*] Dung: %PYCMD%

rem ===== 2. Moi truong build rieng =====
if not exist "%BUILD%\venv\Scripts\python.exe" (
  %PYCMD% -m venv "%BUILD%\venv"
  if errorlevel 1 goto :loi
)
set "PY=%BUILD%\venv\Scripts\python.exe"
"%PY%" -m pip install --upgrade pip >nul
"%PY%" -m pip install -r "%ROOT%\backend\requirements.txt" nuitka zstandard
if errorlevel 1 goto :loi

rem ===== 3. Giao dien web (khong source map) =====
pushd "%ROOT%\frontend"
call npm ci
if errorlevel 1 (popd & goto :loi)
call npm run build
if errorlevel 1 (popd & goto :loi)
popd

rem ===== 4. Bien dich phan mem chinh (Nuitka, thu muc standalone) =====
if exist "%BUILD%\nuitka" rmdir /s /q "%BUILD%\nuitka"
"%PY%" -m nuitka --standalone --assume-yes-for-downloads --windows-console-mode=force ^
  --output-dir="%BUILD%\nuitka" --output-filename=ic3_collect_points_core.exe ^
  --include-package=src --include-package=sqlalchemy.dialects.sqlite --include-package=waitress ^
  --include-data-files="%ROOT%\backend\src\config\pubkey.txt=src\config\pubkey.txt" ^
  --product-name=ic3_collect_points --file-version=1.0.0.0 ^
  "%ROOT%\backend\app.py"
if errorlevel 1 goto :loi

rem ===== 5. TaoDeThi.exe (dua cho dong nghiep) =====
if exist "%BUILD%\taodethi" rmdir /s /q "%BUILD%\taodethi"
"%PY%" -m nuitka --onefile --assume-yes-for-downloads --enable-plugin=tk-inter --windows-console-mode=disable ^
  --output-dir="%BUILD%\taodethi" --output-filename=TaoDeThi.exe --product-name=TaoDeThi --file-version=1.0.0.0 ^
  "%ROOT%\tools\taodethi\taodethi.py"
if errorlevel 1 goto :loi

rem ===== 5b. ic3_collect_points.exe nho o ngoai cung (mo chuong trinh chinh trong he_thong) =====
if exist "%BUILD%\launcher" rmdir /s /q "%BUILD%\launcher"
"%PY%" -m nuitka --onefile --assume-yes-for-downloads --windows-console-mode=disable ^
  --output-dir="%BUILD%\launcher" --output-filename=ic3_collect_points.exe --product-name=ic3_collect_points --file-version=1.0.0.0 ^
  "%~dp0launcher.py"
if errorlevel 1 goto :loi

rem ===== 6. Ghep thu muc phat hanh: ngoai cung chi co 2 file exe va thu muc he_thong =====
if exist "%ROOT%\release" rmdir /s /q "%ROOT%\release"
set "SYS=%OUT%\he_thong"
mkdir "%SYS%\app" "%SYS%\ui" "%SYS%\scripts" "%SYS%\Data"
xcopy /e /i /y /q "%BUILD%\nuitka\app.dist\*" "%SYS%\app\" >nul
xcopy /e /i /y /q "%ROOT%\frontend\dist\*" "%SYS%\ui\" >nul
copy /y "%ROOT%\scripts\ThuDiem_Flash.ps1" "%SYS%\scripts\" >nul
copy /y "%ROOT%\scripts\fix_firewall.bat" "%SYS%\scripts\" >nul
copy /y "%BUILD%\launcher\ic3_collect_points.exe" "%OUT%\" >nul
copy /y "%BUILD%\taodethi\TaoDeThi.exe" "%OUT%\" >nul
copy /y "%~dp0HUONG_DAN.txt" "%SYS%\" >nul
copy /y "%~dp0LICENSE.txt" "%SYS%\" >nul

rem ===== 7. Kiem tra truoc khi phat =====
"%PY%" "%~dp0check_release.py" "%OUT%"
if errorlevel 1 (
  echo.
  echo [!] Ban phat hanh KHONG dat kiem tra. Dung gui cho ai cho den khi sua xong.
  pause
  exit /b 1
)

echo.
echo [+] Xong: %OUT%
echo     Ngoai cung chi co ic3_collect_points.exe, TaoDeThi.exe va thu muc he_thong.
echo     Nen thu mot lan tren may sach (chua cai Python) roi moi gui.
echo     Nen file thanh .zip, gui kem account.lic rieng cho tung dong nghiep ^(do CapTaiKhoan cap^).
pause
exit /b 0

:loi
echo.
echo [!] Build that bai. Doc dong loi o tren.
echo     Neu noi thieu trinh bien dich C: tra loi Yes khi Nuitka hoi tai MinGW, hoac cai "Build Tools for Visual Studio" ^(workload C++^).
pause
exit /b 1
