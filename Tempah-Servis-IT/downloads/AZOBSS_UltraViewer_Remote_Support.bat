@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul 2>&1
title AZOBSS UltraViewer Remote Support
color 0A

set "PHONE=601135600723"
set "UV_DOWNLOAD_PAGE=https://www.ultraviewer.net/en/download.html"
set "UV_FALLBACK_URL=https://dl2.ultraviewer.net/UltraViewer_setup_6.6_en.exe"
set "UV_TEMP=%TEMP%\AZOBSS_UltraViewer_Latest.exe"
set "LOG=%TEMP%\AZOBSS_UltraViewer_Remote.log"

:: ============================================================
:: AZOBSS UltraViewer Remote Support
:: - Auto elevate to Administrator
:: - Detect official latest UltraViewer installer URL from download page
:: - Fallback to official dl2 URL if the page cannot be parsed
:: - Silent install / update UltraViewer
:: - Launch UltraViewer
:: - Capture the UltraViewer window (ID + Password) and send to AZOBSS WhatsApp
:: ============================================================

:: Elevate once
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$p=New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent());if($p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){exit 0}else{exit 1}" >nul 2>&1
if errorlevel 1 (
    if /I "%~1"=="--elevated" (
        echo [FAILED] Administrator mode tidak dapat disahkan.
        pause
        exit /b 10
    )
    powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -ArgumentList '--elevated' -Verb RunAs" >nul 2>&1
    exit /b
)

cls
echo ============================================================
echo           AZOBSS ULTRAVIEWER REMOTE SUPPORT
echo ============================================================
echo.
> "%LOG%" echo [%date% %time%] START

:: ------------------------------------------------------------
:: 1/4 - Discover latest official installer and download
:: ------------------------------------------------------------
echo [1/4] Mencari versi UltraViewer rasmi terkini...
set "AZOBSS_UV_PAGE=%UV_DOWNLOAD_PAGE%"
set "AZOBSS_UV_FALLBACK=%UV_FALLBACK_URL%"
set "AZOBSS_UV_TEMP=%UV_TEMP%"

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
"$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;" ^
"$page=$env:AZOBSS_UV_PAGE; $fallback=$env:AZOBSS_UV_FALLBACK; $dest=$env:AZOBSS_UV_TEMP; $url=$null;" ^
"try {" ^
"  $r=Invoke-WebRequest -UseBasicParsing -Uri $page -Headers @{'User-Agent'='Mozilla/5.0 AZOBSS-Remote-Support'};" ^
"  $m=[regex]::Matches([string]$r.Content,'(?i)(?:href|url)\s*=\s*[\x22\x27]([^\x22\x27]*UltraViewer_setup_[0-9.]+_en\.exe(?:\?[^\x22\x27]*)?)[\x22\x27]');" ^
"  if($m.Count -gt 0){ $u=$m[0].Groups[1].Value; if($u -match '^https?://'){ $url=$u } elseif($u.StartsWith('//')){ $url='https:'+$u } elseif($u.StartsWith('/')){ $url='https://www.ultraviewer.net'+$u } else { $url=(New-Object System.Uri((New-Object System.Uri($page)),$u)).AbsoluteUri } }" ^
"} catch { Write-Host ('[WARN] Halaman download tidak dapat dibaca: ' + $_.Exception.Message) }" ^
"if(-not $url){$url=$fallback; Write-Host ('[WARN] Menggunakan fallback rasmi: ' + $url)} else {Write-Host ('[OK] Link rasmi dikesan: ' + $url)};" ^
"Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $dest -Headers @{'User-Agent'='Mozilla/5.0 AZOBSS-Remote-Support'};" ^
"if(-not (Test-Path -LiteralPath $dest)){throw 'Fail installer UltraViewer tidak dijumpai selepas download.'};" ^
"$f=Get-Item -LiteralPath $dest; if($f.Length -lt 500000){throw ('Installer terlalu kecil / tidak sah: ' + $f.Length + ' bytes')};" ^
"$v=$f.VersionInfo.ProductVersion; if($v){Write-Host ('[OK] Product version: ' + $v)};" ^
"$sig=Get-AuthenticodeSignature -LiteralPath $dest; Write-Host ('[INFO] Digital signature: ' + $sig.Status);" ^
"[IO.File]::WriteAllText(($dest+'.url.txt'),$url,[Text.UTF8Encoding]::new($false))"
if errorlevel 1 goto ERROR_DOWNLOAD
if not exist "%UV_TEMP%" goto ERROR_DOWNLOAD

echo.
echo [2/4] Memasang / mengemas kini UltraViewer...
"%UV_TEMP%" /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP-
set "INSTALL_RC=!errorlevel!"
echo [%date% %time%] installer exit=!INSTALL_RC!>>"%LOG%"

call :FIND_ULTRAVIEWER
if not defined UV_EXE (
    echo       Silent install belum menghasilkan aplikasi. Cuba installer biasa...
    start /wait "" "%UV_TEMP%"
    call :FIND_ULTRAVIEWER
)
if not defined UV_EXE goto ERROR_INSTALL

del /q "%UV_TEMP%" >nul 2>&1
del /q "%UV_TEMP%.url.txt" >nul 2>&1

echo       UltraViewer READY.
echo       !UV_EXE!
echo [%date% %time%] UltraViewer path=!UV_EXE!>>"%LOG%"

:: ------------------------------------------------------------
:: 3/4 - Launch UltraViewer
:: ------------------------------------------------------------
echo.
echo [3/4] Membuka UltraViewer dan menunggu ID / Password...
taskkill /f /im UltraViewer_Desktop.exe >nul 2>&1
start "" "!UV_EXE!"
timeout /t 5 /nobreak >nul

:: ------------------------------------------------------------
:: 4/4 - Screenshot UltraViewer and send to WhatsApp
:: ------------------------------------------------------------
echo [4/4] Menyediakan ID / Password untuk WhatsApp AZOBSS...
set "AZOBSS_SELF=%~f0"
powershell.exe -STA -NoProfile -ExecutionPolicy Bypass -Command "$c=[IO.File]::ReadAllText($env:AZOBSS_SELF);$m=':__POWERSHELL_PAYLOAD__';$i=$c.LastIndexOf($m);if($i -lt 0){exit 90};$ps=$c.Substring($i+$m.Length);Invoke-Expression $ps"
set "RC=%errorlevel%"

if not "%RC%"=="0" (
    echo.
    echo [WARNING] UltraViewer sudah dibuka, tetapi penghantaran automatik ke WhatsApp tidak lengkap.
    echo           Sila hantar ID dan Password UltraViewer secara manual kepada AZOBSS.
    echo Log: %LOG%
    start "" "https://wa.me/%PHONE%?text=AZOBSS%%20Remote%%20Support%%20-%%20UltraViewer%%20sudah%%20dibuka.%%20Saya%%20akan%%20hantar%%20ID%%20dan%%20Password."
    pause
    exit /b 0
)

echo.
echo Selesai. UltraViewer sudah dibuka dan maklumat remote dihantar ke WhatsApp.
pause
exit /b 0

:: ============================================================
:: Helpers
:: ============================================================
:FIND_ULTRAVIEWER
set "UV_EXE="
for %%P in (
    "C:\Program Files (x86)\UltraViewer\UltraViewer_Desktop.exe"
    "C:\Program Files\UltraViewer\UltraViewer_Desktop.exe"
    "%LOCALAPPDATA%\UltraViewer\UltraViewer_Desktop.exe"
) do (
    if not defined UV_EXE if exist "%%~P" set "UV_EXE=%%~P"
)
if defined UV_EXE exit /b 0

for /f "usebackq delims=" %%P in (`powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$roots=@($env:ProgramFiles,${env:ProgramFiles(x86)},$env:LOCALAPPDATA) ^| Where-Object {$_ -and (Test-Path $_)}; foreach($r in $roots){$f=Get-ChildItem -Path $r -Filter 'UltraViewer_Desktop.exe' -File -Recurse -ErrorAction SilentlyContinue ^| Select-Object -First 1; if($f){$f.FullName; break}}"`) do (
    if not defined UV_EXE set "UV_EXE=%%P"
)
exit /b 0

:ERROR_DOWNLOAD
echo.
echo [FAILED] UltraViewer tidak berjaya dimuat turun dari sumber rasmi.
echo Cuba download manual: %UV_DOWNLOAD_PAGE%
echo Log: %LOG%
pause
exit /b 1

:ERROR_INSTALL
echo.
echo [FAILED] UltraViewer tidak berjaya dipasang / dikesan.
echo Installer rasmi boleh dimuat turun di: %UV_DOWNLOAD_PAGE%
echo Log: %LOG%
pause
exit /b 2

:__POWERSHELL_PAYLOAD__
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

$phone = '601135600723'
$shot  = Join-Path $env:TEMP 'AZOBSS_UltraViewer_Full.png'
$log   = Join-Path $env:TEMP 'AZOBSS_UltraViewer_Remote.log'

function Log([string]$s) {
    $line = ('{0:yyyy-MM-dd HH:mm:ss}  {1}' -f (Get-Date), $s)
    Add-Content -LiteralPath $log -Value $line -Encoding UTF8
    Write-Host $s
}

$native = @'
using System;
using System.Text;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Drawing;
using System.Drawing.Imaging;

public static class AZWinUV {
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hwnd, IntPtr hdcBlt, uint nFlags);
    [DllImport("user32.dll", SetLastError=true)] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
    [DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow();

    public static string Title(IntPtr h) {
        var b = new StringBuilder(1024); GetWindowText(h,b,b.Capacity); return b.ToString();
    }

    public static IntPtr FindUltraViewerWindow() {
        IntPtr best = IntPtr.Zero; long bestArea = 0;
        EnumWindows(delegate(IntPtr h, IntPtr l) {
            if (!IsWindowVisible(h)) return true;
            uint pid; GetWindowThreadProcessId(h, out pid); if (pid == 0) return true;
            try {
                Process p = Process.GetProcessById((int)pid);
                string n = (p.ProcessName ?? "").ToLowerInvariant();
                string t = Title(h).ToLowerInvariant();
                if (!n.Contains("ultraviewer") && !t.Contains("ultraviewer")) return true;
                RECT r; if (!GetWindowRect(h, out r)) return true;
                long w=r.Right-r.Left, ht=r.Bottom-r.Top, area=w*ht;
                if (w>=280 && ht>=220 && area>bestArea) { best=h; bestArea=area; }
            } catch { }
            return true;
        }, IntPtr.Zero);
        return best;
    }

    public static IntPtr FindVisibleTitle(string needle) {
        IntPtr found = IntPtr.Zero;
        EnumWindows(delegate(IntPtr h, IntPtr l) {
            if (IsWindowVisible(h)) {
                string t = Title(h);
                if (!String.IsNullOrWhiteSpace(t) && t.IndexOf(needle,StringComparison.OrdinalIgnoreCase)>=0) { found=h; return false; }
            }
            return true;
        }, IntPtr.Zero);
        return found;
    }

    public static bool CaptureWindow(IntPtr h, string path, out string method) {
        method=""; RECT r; if(!GetWindowRect(h,out r)) return false;
        int w=r.Right-r.Left, ht=r.Bottom-r.Top; if(w<100 || ht<100) return false;
        using(var bmp=new Bitmap(w,ht,PixelFormat.Format32bppArgb)) {
            bool ok=false;
            try { using(var g=Graphics.FromImage(bmp)){g.CopyFromScreen(r.Left,r.Top,0,0,new Size(w,ht));} ok=true; method="CopyFromScreen"; } catch { ok=false; }
            if(!ok){using(var g=Graphics.FromImage(bmp)){IntPtr hdc=g.GetHdc(); try{ok=PrintWindow(h,hdc,2);}finally{g.ReleaseHdc(hdc);}} if(ok) method="PrintWindow";}
            if(ok) bmp.Save(path,ImageFormat.Png); return ok;
        }
    }
}
'@
Add-Type -TypeDefinition $native -ReferencedAssemblies 'System.dll','System.Drawing.dll'

try { Remove-Item -LiteralPath $shot -Force -ErrorAction SilentlyContinue } catch {}
$console=[AZWinUV]::GetConsoleWindow()
$cmdWindow=[AZWinUV]::FindVisibleTitle('AZOBSS UltraViewer Remote Support')
$h=[IntPtr]::Zero
$top=$false

try {
    Log 'Mencari window UltraViewer...'
    for($i=0;$i -lt 60 -and $h -eq [IntPtr]::Zero;$i++) { $h=[AZWinUV]::FindUltraViewerWindow(); if($h -eq [IntPtr]::Zero){Start-Sleep -Seconds 1} }
    if($h -eq [IntPtr]::Zero){throw 'Window UltraViewer tidak dijumpai.'}

    if($console -ne [IntPtr]::Zero -and $console -ne $h){[AZWinUV]::ShowWindow($console,0)|Out-Null}
    if($cmdWindow -ne [IntPtr]::Zero -and $cmdWindow -ne $h -and $cmdWindow -ne $console){[AZWinUV]::ShowWindow($cmdWindow,0)|Out-Null}

    [AZWinUV]::ShowWindow($h,9)|Out-Null; [AZWinUV]::BringWindowToTop($h)|Out-Null; [AZWinUV]::SetForegroundWindow($h)|Out-Null
    $flags=0x0001 -bor 0x0002 -bor 0x0040
    [AZWinUV]::SetWindowPos($h,[IntPtr](-1),0,0,0,0,$flags)|Out-Null; $top=$true
    Log 'Tunggu supaya ID dan Password UltraViewer dipaparkan...'; Start-Sleep -Seconds 7

    $method=''; if(-not [AZWinUV]::CaptureWindow($h,$shot,[ref]$method)){throw 'Screenshot UltraViewer gagal.'}
    Log ('Screenshot berjaya: '+$shot)
    [AZWinUV]::SetWindowPos($h,[IntPtr](-2),0,0,0,0,$flags)|Out-Null; $top=$false

    $img=[System.Drawing.Image]::FromFile($shot)
    try {
        $clip=$false
        for($i=0;$i -lt 10 -and -not $clip;$i++){try{[System.Windows.Forms.Clipboard]::SetImage($img);$clip=$true}catch{Start-Sleep -Milliseconds 400}}
        if(-not $clip){throw 'Gagal copy screenshot ke Clipboard.'}
    } finally {$img.Dispose()}

    $text=[uri]::EscapeDataString('AZOBSS Remote Support - UltraViewer ID & Password')
    $waOpened=$false
    try {Start-Process ('whatsapp://send?phone='+$phone+'&text='+$text) -ErrorAction Stop; $waOpened=$true} catch {}
    if(-not $waOpened){Start-Process ('https://web.whatsapp.com/send?phone='+$phone+'&text='+$text)}

    $wa=[IntPtr]::Zero
    for($i=0;$i -lt 100 -and $wa -eq [IntPtr]::Zero;$i++){ $wa=[AZWinUV]::FindVisibleTitle('WhatsApp'); if($wa -eq [IntPtr]::Zero){Start-Sleep -Milliseconds 250} }
    if($wa -eq [IntPtr]::Zero){throw 'Window WhatsApp tidak dijumpai.'}

    [AZWinUV]::ShowWindow($wa,9)|Out-Null; [AZWinUV]::BringWindowToTop($wa)|Out-Null; [AZWinUV]::SetForegroundWindow($wa)|Out-Null
    Start-Sleep -Milliseconds 1600
    $ws=New-Object -ComObject WScript.Shell
    $ws.SendKeys('^v'); Start-Sleep -Milliseconds 1000; $ws.SendKeys('{ENTER}')
    Log 'Screenshot UltraViewer dihantar ke WhatsApp.'
    exit 0
}
catch {
    try{Log ('ERROR: '+$_.Exception.Message)}catch{}
    exit 1
}
finally {
    try{if($top -and $h -ne [IntPtr]::Zero){$flags=0x0001 -bor 0x0002 -bor 0x0040;[AZWinUV]::SetWindowPos($h,[IntPtr](-2),0,0,0,0,$flags)|Out-Null}}catch{}
    try{if($console -ne [IntPtr]::Zero){[AZWinUV]::ShowWindow($console,9)|Out-Null};if($cmdWindow -ne [IntPtr]::Zero -and $cmdWindow -ne $console){[AZWinUV]::ShowWindow($cmdWindow,9)|Out-Null}}catch{}
}
