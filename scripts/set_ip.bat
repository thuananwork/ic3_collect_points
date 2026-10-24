@echo off
:: ============================================================
:: 1. TU DONG NANG QUYEN ADMIN (CHAY NGAM)
:: ============================================================
net session >nul 2>&1
if %errorLevel% neq 0 (
    powershell -Command "Start-Process -FilePath '%0' -Verb RunAs"
    exit /b
)

:: ============================================================
:: 2. CAU HINH THONG SO MANG
:: ============================================================
set "interfaceName=Ethernet"
set "subnetMask=255.255.255.0"
set "gateway=192.168.50.1"

:: ============================================================
:: 3. TINH TOAN IP TU TEN MAY (PC-01 -> 101, PC-50 -> 150)
:: ============================================================
set "pcname=%COMPUTERNAME%"
set "pc_num=%pcname:~-2%"

:: Khu so 0 o dau (Vi du 01 thanh 1)
set /a "num=1%pc_num% - 100"

:: Cong thuc: 100 + so thu tu may
set /a "last_octet=100 + num"
set "finalIP=192.168.50.%last_octet%"

:: ============================================================
:: 4. THUC THI LENH (KHONG HIEN THONG BAO THUA)
:: ============================================================
netsh interface ip set address name="%interfaceName%" static %finalIP% %subnetMask% %gateway% 1 >nul 2>&1

:: Thoat luon khong can nhan phim
exit