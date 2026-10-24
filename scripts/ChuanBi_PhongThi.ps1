<#
 Chuẩn bị phòng thi bằng 1 lần bấm (chạy trên máy giáo viên): xem ChuanBi_PhongThi.bat
 1. Tìm IP máy giáo viên trong mạng LAN.
 2. Tạo lay_ip.bat (đã gắn IP này) trong thư mục scripts.
 3. Tạo bản *_LAN.exe của các file bài thi GS6*.exe trong thư mục DeThi_Flash (bật lưu kết quả).
 4. Gom lay_ip.bat + các file *_LAN.exe vào thư mục GoiHocSinh để gửi xuống máy học sinh.
#>
param([int]$UserId = 1, [string]$Ip = '')
$ErrorActionPreference = 'Stop'
$proj = Split-Path -Parent $PSScriptRoot
if (-not $Ip) {
    $cfg = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } | Select-Object -First 1
    if ($cfg) { $Ip = $cfg.IPv4Address[0].IPAddress }
}
if (-not $Ip) { Write-Host 'Khong tim thay IP may giao vien. Chay lai voi: ChuanBi_PhongThi.bat <IP>'; exit 1 }
Write-Host "IP may giao vien: $Ip"

# 2. lay_ip.bat
$base = "http://${Ip}:5000"
$lines = @(
 '@echo off',
 'set pcname=%COMPUTERNAME%',
 'set res=',
 "for /f `"delims=`" %%r in ('curl -s `"$base/nhan_ip?pc=%pcname%&user_id=$UserId`"') do set res=%%r",
 "curl -s -o `"%TEMP%\ThuDiem_Flash.ps1`" `"$base/tools/ThuDiem_Flash.ps1`"",
 "start `"`" /min powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"%TEMP%\ThuDiem_Flash.ps1`" -Watch -Server $base",
 'timeout /t 3',
 'if "%res%"=="OK" goto selfdel',
 'echo Khong gui duoc IP ve may thay. Kiem tra mang roi chay lai file nay.',
 'pause',
 'exit',
 ':selfdel',
 '(goto) 2>nul & del "%~f0" & exit')
$layIp = Join-Path $PSScriptRoot 'lay_ip.bat'
[System.IO.File]::WriteAllText($layIp, (($lines -join "`r`n") + "`r`n"), (New-Object System.Text.UTF8Encoding($false)))
Write-Host 'Da tao scripts\lay_ip.bat'

# 3. file bai thi
$py = $null
foreach ($c in @((Join-Path $proj 'portable\python\python.exe'), (Join-Path $proj 'backend\venv\Scripts\python.exe'))) {
    if (Test-Path $c) {
        try { & $c -c 'import sys' 2>$null } catch {}
        if ($LASTEXITCODE -eq 0) { $py = $c; break }
    }
}
if (-not $py) { $py = 'python' }
$out = Join-Path $proj 'GoiHocSinh'
New-Item -ItemType Directory -Force -Path $out | Out-Null
Copy-Item $layIp (Join-Path $out 'lay_ip.bat') -Force
$exes = Get-ChildItem (Join-Path $proj 'DeThi_Flash') -Filter 'GS6*.exe' -ErrorAction SilentlyContinue -File | Where-Object { $_.Name -notmatch '_LAN\.exe$' }
if (-not $exes) { Write-Host 'Khong thay file bai thi GS6*.exe trong thu muc DeThi_Flash.' }
foreach ($e in $exes) {
    $target = Join-Path $out (($e.BaseName) + '_LAN.exe')
    if ((Test-Path $target) -and ((Get-Item $target).LastWriteTime -gt $e.LastWriteTime)) { Write-Host "Giu nguyen $($e.BaseName)_LAN.exe (da co)"; continue }
    & $py (Join-Path $PSScriptRoot 'patch_sameshow_exe.py') $e.FullName --out $target
}
Write-Host ''
Write-Host "XONG. Gui ca thu muc GoiHocSinh xuong may hoc sinh: $out"
Write-Host 'Tren moi may hoc sinh: chay lay_ip.bat truoc gio thi, roi mo file *_LAN.exe de lam bai.'
Write-Host 'Neu IP may giao vien doi: chay lai file nay va chi gui lai lay_ip.bat (file bai thi khong can doi).'
