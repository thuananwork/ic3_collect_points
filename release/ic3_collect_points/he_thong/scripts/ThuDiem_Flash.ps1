<#
 Thu điểm bài thi Flash (.exe Sameshow/Wondershare) về máy giáo viên (IC3 Manager).

 File .exe (đã vá bật localcache) ghi kết quả vào Flash SharedObject (.sol) khi học sinh nộp bài.
 Script này đọc file đó, gửi điểm tới /api/save-score của máy giáo viên (giống cách file iSpring trước đây),
 rồi xoá .sol để lần thi sau bắt đầu sạch.

 -Watch : chạy nền, cứ vài giây kiểm tra một lần, thấy bài vừa nộp là gửi ngay (lay_ip.bat tự bật chế độ này).
 Không có -Watch: kiểm tra một lần rồi thoát.
#>
param(
    [string]$Server = 'http://127.0.0.1:5000',
    [int]$Scale = 0,             # 0 = giữ điểm thô của đề (mỗi câu đúng = 10 điểm); đặt 1000 để quy về thang 1000
    [int]$Interval = 2,          # giây giữa hai lần kiểm tra khi chạy -Watch
    [switch]$Watch
)
$ErrorActionPreference = 'Stop'
$root  = Join-Path $env:APPDATA 'Macromedia\Flash Player\#SharedObjects'
$state = Join-Path $env:TEMP 'ic3_thudiem_sent.txt'
$log   = Join-Path $env:TEMP 'ic3_thudiem.log'

function Log([string]$m) {
    $line = '{0} {1}' -f (Get-Date -Format 'HH:mm:ss'), $m
    try { Add-Content -Path $log -Value $line -Encoding UTF8 } catch {}
    if (-not $Watch) { Write-Host $m }
}

function Send-Result($file) {
    $bytes = $null
    try { $bytes = [System.IO.File]::ReadAllBytes($file.FullName) } catch { return 'busy' }   # Flash đang ghi dở
    $text = [System.Text.Encoding]::UTF8.GetString($bytes)
    if ($text -notmatch '<user_score>(\d+(?:\.\d+)?)</user_score>') { return 'pending' }      # chưa nộp bài
    $user = [double]$Matches[1]
    $max = 0;    if ($text -match '<quiz_score>(\d+(?:\.\d+)?)</quiz_score>') { $max = [double]$Matches[1] }
    $sec = 0;    if ($text -match '<elapsed>(\d+)</elapsed>') { $sec = [int]$Matches[1] }
    $passed = 0; if ($text -match '<passed>(\d+)</passed>') { $passed = [int]$Matches[1] }
    $code = '';  if ($text -match '<test_code>([^<]*)</test_code>') { $code = $Matches[1] }
    if (-not $code) { $code = $file.Name + '|' + $file.LastWriteTimeUtc.Ticks }
    $key = '{0}|{1}' -f $env:COMPUTERNAME, $code

    if ((Test-Path $state) -and (Select-String -Path $state -SimpleMatch -Pattern $key -Quiet)) {
        try { Remove-Item $file.FullName -Force } catch {}          # đã gửi rồi, Flash chỉ ghi lại file
        return 'dup'
    }
    $exam = $file.Directory.Name -replace '(?i)_LAN\.exe$', '' -replace '(?i)\.exe$', ''   # tên file .exe làm tên đề
    $sp = $user
    if ($Scale -gt 0 -and $max -gt 0) { $sp = [math]::Round($user / $max * $Scale) }
    $pc = [uri]::EscapeDataString($env:COMPUTERNAME)
    $body = "sp=$([int]$sp)&ut=$sec&lt=$([uri]::EscapeDataString($exam))&raw_score=$user&max_score=$max&passed=$passed&source=flash-exe&USER_NAME=$pc&pc=$pc"
    for ($i = 1; $i -le 5; $i++) {
        try {
            $r = Invoke-WebRequest -Uri ($Server.TrimEnd('/') + '/api/save-score') -Method Post -Body $body `
                 -ContentType 'application/x-www-form-urlencoded' -UseBasicParsing -TimeoutSec 15
            if ($r.Content.Trim() -eq 'OK') {
                Add-Content -Path $state -Value $key -Encoding UTF8
                try { Remove-Item $file.FullName -Force } catch {}
                Log "Da gui diem: $user/$max ($sp) - $sec giay - $exam"
                return 'sent'
            }
            Log "May chu tra loi: $($r.Content)"
        } catch { Log "Lan $i loi: $($_.Exception.Message)" }
        Start-Sleep -Seconds 2
    }
    return 'failed'
}

function Scan() {
    if (-not (Test-Path $root)) { return 'none' }
    $last = 'none'
    foreach ($f in (Get-ChildItem $root -Recurse -Filter '*.sol' -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending)) {
        $res = Send-Result $f
        if ($res -eq 'sent' -or $res -eq 'failed') { $last = $res; if (-not $Watch) { break } }
    }
    return $last
}

if ($Watch) {
    $mutex = New-Object System.Threading.Mutex($false, 'Global\IC3ThuDiemFlash')
    if (-not $mutex.WaitOne(0)) { exit 0 }                       # đã có bản khác đang chạy
    Log "Bat dau theo doi bai thi. May chu: $Server"
    while ($true) {
        try { [void](Scan) } catch { Log "Loi: $($_.Exception.Message)" }
        Start-Sleep -Seconds $Interval
    }
}
$r = Scan
switch ($r) {
    'sent'   { Write-Host 'Da gui diem.'; exit 0 }
    'failed' { Write-Host 'Khong gui duoc diem. Du lieu van duoc giu, thu lai sau.'; exit 2 }
    default  { Write-Host 'Chua thay bai da nop (chua bam Nop bai?).'; exit 3 }
}
