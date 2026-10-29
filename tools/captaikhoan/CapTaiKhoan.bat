@echo off
setlocal
cd /d "%~dp0..\.."
set "ROOT=%CD%"

rem Tim pythonw (khong hien cua so den) co thu vien cryptography
set "PYW="
if exist "%ROOT%\build\venv\Scripts\pythonw.exe" set "PYW=%ROOT%\build\venv\Scripts\pythonw.exe"
if not defined PYW for %%V in (3.14 3.13 3.12) do if not defined PYW py -%%V -c "import cryptography" >nul 2>&1 && set "PYW=pyw -%%V"
if not defined PYW (
  echo [!] Khong tim thay Python co thu vien cryptography.
  echo     Chay: pip install -r backend\requirements.txt
  pause
  exit /b 1
)
rem Mo giao dien web tren may nay (trinh duyet tu bat len). Dong tab thi chuong trinh tu tat.
start "" %PYW% "%ROOT%\tools\captaikhoan\captaikhoan_web.py"
exit /b 0
