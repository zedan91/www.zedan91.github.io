@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul 2>&1
title AZOBSS UltraViewer Remote Support
color 0A

set "PHONE=601135600723"
set "UV_DOWNLOAD_PAGE=https://www.ultraviewer.net/en/download.html"
set "UV_FALLBACK_URL=https://dl2.ultraviewer.net/UltraViewer_setup_6.6_en.exe"
set "UV_TEMP=%TEMP%\AZOBSS_UltraViewer_Latest.exe"
set "UV_URL_FILE=%TEMP%\AZOBSS_UltraViewer_URL.txt"
set "UV_PATH_FILE=%TEMP%\AZOBSS_UltraViewer_Path.txt"
set "UV_SCREENSHOT=%TEMP%\AZOBSS_UltraViewer_Screenshot.png"
set "INSTALL_LOG=%TEMP%\AZOBSS_UltraViewer_Install.log"
set "LOG=%TEMP%\AZOBSS_UltraViewer_Remote.log"

call :MAIN
set "RC=%ERRORLEVEL%"

echo.
if "%RC%"=="0" (
    echo ============================================================
    echo   SELESAI - UltraViewer dan WhatsApp sudah dibuka.
    echo ============================================================
    echo.
    echo Screenshot UltraViewer telah diproses untuk dihantar ke AZOBSS.
) else (
    echo ============================================================
    echo   PROSES BERHENTI - Error code: %RC%
    echo ============================================================
    echo.
    echo Log: %LOG%
    echo Installer log: %INSTALL_LOG%
    echo Screenshot: %UV_SCREENSHOT%
    echo.
    echo Tingkap ini sengaja TIDAK ditutup supaya error boleh dibaca.
)

echo.
echo Tekan mana-mana kekunci untuk tutup...
pause >nul
exit /b %RC%

:MAIN
cls
echo ============================================================
echo           AZOBSS ULTRAVIEWER REMOTE SUPPORT
echo ============================================================
echo.
> "%LOG%" echo [%date% %time%] START

del /q "%UV_URL_FILE%" >nul 2>&1
del /q "%UV_PATH_FILE%" >nul 2>&1
del /q "%UV_TEMP%" >nul 2>&1
del /q "%UV_SCREENSHOT%" >nul 2>&1

:: ------------------------------------------------------------
:: 1/4 - Discover current official installer URL only
:: ------------------------------------------------------------
echo [1/4] Mencari installer UltraViewer rasmi terkini...
set "AZOBSS_UV_PAGE=%UV_DOWNLOAD_PAGE%"
set "AZOBSS_UV_FALLBACK=%UV_FALLBACK_URL%"
set "AZOBSS_UV_URL_FILE=%UV_URL_FILE%"

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop';[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;$page=$env:AZOBSS_UV_PAGE;$fallback=$env:AZOBSS_UV_FALLBACK;$url=$null;try{$r=Invoke-WebRequest -UseBasicParsing -Uri $page -Headers @{'User-Agent'='Mozilla/5.0 AZOBSS-Remote-Support'};foreach($lnk in $r.Links){$h=[string]$lnk.href;if($h -match 'UltraViewer_setup_[0-9.]+_en\.exe'){if($h -match '^https?://'){$url=$h}elseif($h.StartsWith('//')){$url='https:'+$h}else{$url=(New-Object System.Uri((New-Object System.Uri($page)),$h)).AbsoluteUri};break}};if(-not $url){$m=[regex]::Match([string]$r.Content,'UltraViewer_setup_[0-9.]+_en\.exe');if($m.Success){$url='https://dl2.ultraviewer.net/'+$m.Value}}}catch{};if(-not $url){$url=$fallback};[IO.File]::WriteAllText($env:AZOBSS_UV_URL_FILE,$url,[Text.UTF8Encoding]::new($false));Write-Host ('[OK] '+$url)"
if errorlevel 1 (
    echo [FAILED] Gagal mencari link installer rasmi.
    echo [%date% %time%] ERROR discover URL>>"%LOG%"
    exit /b 10
)

set "UV_URL="
if exist "%UV_URL_FILE%" set /p "UV_URL="<"%UV_URL_FILE%"
if not defined UV_URL set "UV_URL=%UV_FALLBACK_URL%"
echo       Sumber: %UV_URL%

:: ------------------------------------------------------------
:: 2/4 - Download with real percentage, then install with elapsed progress
:: ------------------------------------------------------------
echo.
echo [2/4] Muat turun dan memasang UltraViewer...
echo       Download progress sebenar akan dipaparkan di bawah.
set "AZOBSS_UV_URL=%UV_URL%"
set "AZOBSS_UV_TEMP=%UV_TEMP%"

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop';[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;$u=$env:AZOBSS_UV_URL;$o=$env:AZOBSS_UV_TEMP;$req=[Net.HttpWebRequest]::Create($u);$req.UserAgent='Mozilla/5.0 AZOBSS-Remote-Support';$resp=$req.GetResponse();$total=[int64]$resp.ContentLength;$src=$resp.GetResponseStream();$dst=[IO.File]::Open($o,[IO.FileMode]::Create,[IO.FileAccess]::Write,[IO.FileShare]::None);$buf=New-Object byte[] 65536;$done=[int64]0;try{while(($n=$src.Read($buf,0,$buf.Length)) -gt 0){$dst.Write($buf,0,$n);$done+=$n;if($total -gt 0){$pct=[math]::Min(100,[int](($done*100)/$total));$filled=[int]($pct/5);$bar=('#'*$filled).PadRight(20,'.');$mb1=$done/1MB;$mb2=$total/1MB;Write-Host -NoNewline (([char]13)+'      Download ['+$bar+'] '+$pct.ToString().PadLeft(3)+'%%  '+('{0:N1}' -f $mb1)+' / '+('{0:N1}' -f $mb2)+' MB')}else{Write-Host -NoNewline (([char]13)+'      Download '+('{0:N1}' -f ($done/1MB))+' MB')}}}finally{$dst.Close();$src.Close();$resp.Close()};Write-Host '';if(-not(Test-Path -LiteralPath $o)){throw 'Installer tidak wujud selepas download'};$f=Get-Item -LiteralPath $o;if($f.Length -lt 500000){throw ('Installer terlalu kecil: '+$f.Length+' bytes')};Write-Host ('      Download selesai: '+('{0:N1}' -f ($f.Length/1MB))+' MB');if($f.VersionInfo.ProductVersion){Write-Host ('      Product version: '+$f.VersionInfo.ProductVersion)}"
if errorlevel 1 (
    echo [FAILED] Download UltraViewer gagal.
    echo [%date% %time%] ERROR download>>"%LOG%"
    exit /b 11
)

if not exist "%UV_TEMP%" (
    echo [FAILED] Fail installer tidak dijumpai selepas download.
    exit /b 12
)

echo.
echo       Memasang UltraViewer...
echo       Jika Windows minta kebenaran UAC, tekan Yes.
set "AZOBSS_UV_INSTALLER=%UV_TEMP%"
set "AZOBSS_UV_INSTALL_LOG=%INSTALL_LOG%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop';$exe=$env:AZOBSS_UV_INSTALLER;$log=$env:AZOBSS_UV_INSTALL_LOG;$q=[char]34;$args='/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /LOG='+$q+$log+$q;$p=Start-Process -FilePath $exe -ArgumentList $args -PassThru;$sw=[Diagnostics.Stopwatch]::StartNew();$frames=@('|','/','-','\');$i=0;while(-not $p.HasExited){$p.Refresh();$sec=[int]$sw.Elapsed.TotalSeconds;$frame=$frames[$i%%$frames.Count];$i++;$pos=$sec%%20;$bar=('='*$pos).PadRight(20,'.');Write-Host -NoNewline (([char]13)+'      Installing ['+$bar+'] '+$frame+'  '+$sec+'s elapsed');Start-Sleep -Milliseconds 250};Write-Host '';Write-Host ('      Installer selesai dalam '+[int]$sw.Elapsed.TotalSeconds+' saat. Exit code: '+$p.ExitCode);exit $p.ExitCode"
set "INSTALL_RC=%ERRORLEVEL%"
echo [%date% %time%] installer exit=%INSTALL_RC%>>"%LOG%"

call :FIND_ULTRAVIEWER
if not defined UV_EXE (
    echo       UltraViewer belum dikesan. Cuba setup biasa...
    "%UV_TEMP%" /NORESTART /LOG="%INSTALL_LOG%"
    set "INSTALL_RC=%ERRORLEVEL%"
    echo [%date% %time%] interactive installer exit=%INSTALL_RC%>>"%LOG%"
    call :FIND_ULTRAVIEWER
)

if not defined UV_EXE (
    echo [FAILED] UltraViewer masih tidak dapat dikesan selepas installation.
    exit /b 21
)

echo [OK] UltraViewer READY.
echo      %UV_EXE%
echo [%date% %time%] UltraViewer path=%UV_EXE%>>"%LOG%"

del /q "%UV_TEMP%" >nul 2>&1
del /q "%UV_URL_FILE%" >nul 2>&1

:: ------------------------------------------------------------
:: 3/4 - Launch UltraViewer and wait for its real window
:: ------------------------------------------------------------
echo.
echo [3/4] Membuka UltraViewer dan menunggu tetingkap siap...
start "" "%UV_EXE%"
set "AZOBSS_UV_SCREENSHOT=%UV_SCREENSHOT%"

powershell.exe -STA -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop';Add-Type -AssemblyName System.Drawing;Add-Type -AssemblyName System.Windows.Forms;$q=[char]34;$cs='[DllImport('+$q+'user32.dll'+$q+')] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect); [DllImport('+$q+'user32.dll'+$q+')] public static extern bool SetForegroundWindow(IntPtr hWnd); public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }';Add-Type -Namespace AZB -Name Win32 -MemberDefinition $cs;$deadline=(Get-Date).AddSeconds(25);$p=$null;do{$p=Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 -and ($_.ProcessName -like 'UltraViewer*' -or $_.MainWindowTitle -like '*UltraViewer*') } | Select-Object -First 1;if(-not $p){Write-Host -NoNewline '.';Start-Sleep -Milliseconds 500}}while(-not $p -and (Get-Date) -lt $deadline);Write-Host '';if(-not $p){throw 'Tetingkap UltraViewer tidak ditemui dalam 25 saat'};[AZB.Win32]::SetForegroundWindow($p.MainWindowHandle)|Out-Null;Start-Sleep -Milliseconds 800;$r=New-Object 'AZB.Win32+RECT';if(-not [AZB.Win32]::GetWindowRect($p.MainWindowHandle,[ref]$r)){throw 'GetWindowRect gagal'};$w=$r.Right-$r.Left;$h=$r.Bottom-$r.Top;if($w -lt 200 -or $h -lt 150){throw ('Saiz tetingkap pelik: '+$w+'x'+$h)};$bmp=New-Object Drawing.Bitmap $w,$h;$g=[Drawing.Graphics]::FromImage($bmp);try{$g.CopyFromScreen($r.Left,$r.Top,0,0,$bmp.Size);$bmp.Save($env:AZOBSS_UV_SCREENSHOT,[Drawing.Imaging.ImageFormat]::Png);[Windows.Forms.Clipboard]::SetImage($bmp);Write-Host ('[OK] Screenshot UltraViewer: '+$env:AZOBSS_UV_SCREENSHOT)}finally{$g.Dispose();$bmp.Dispose()}"
if errorlevel 1 (
    echo [WARN] Screenshot automatik gagal. UltraViewer tetap dibuka.
    echo [%date% %time%] WARN screenshot failed>>"%LOG%"
) else (
    echo [OK] Screenshot tetingkap UltraViewer berjaya diambil.
)

:: ------------------------------------------------------------
:: 4/4 - Open WhatsApp, paste screenshot and send
:: ------------------------------------------------------------
echo.
echo [4/4] Membuka WhatsApp AZOBSS dan menghantar screenshot...
set "AZOBSS_WA_PHONE=%PHONE%"
set "AZOBSS_WA_TEXT=AZOBSS Remote Support - Screenshot UltraViewer dilampirkan. Sila gunakan ID dan Password yang dipaparkan pada screenshot untuk sesi remote ini."

powershell.exe -STA -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop';Add-Type -AssemblyName System.Drawing;Add-Type -AssemblyName System.Windows.Forms;$phone=$env:AZOBSS_WA_PHONE;$text=$env:AZOBSS_WA_TEXT;$shot=$env:AZOBSS_UV_SCREENSHOT;$ws=New-Object -ComObject WScript.Shell;$uri='whatsapp://send?phone='+$phone;try{Start-Process $uri}catch{};$wins=$null;for($i=0;$i -lt 20 -and -not $wins;$i++){Start-Sleep -Milliseconds 500;$wins=Get-Process -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowHandle -ne 0 -and ($_.ProcessName -like '*WhatsApp*' -or $_.MainWindowTitle -like '*WhatsApp*')} | Select-Object -First 1};if(-not $wins){Start-Process ('https://wa.me/'+$phone);Start-Sleep -Seconds 5;$wins=Get-Process -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -like '*WhatsApp*'} | Select-Object -First 1};if(-not $wins){throw 'Window WhatsApp tidak ditemui'};$ws.AppActivate($wins.Id)|Out-Null;Start-Sleep -Seconds 1;if(Test-Path -LiteralPath $shot){$img=[Drawing.Image]::FromFile($shot);try{[Windows.Forms.Clipboard]::SetImage($img)}finally{$img.Dispose()};Start-Sleep -Milliseconds 500;$ws.SendKeys('^v');Start-Sleep -Seconds 2;$ws.SendKeys('{ENTER}');Start-Sleep -Seconds 2;Write-Host '[OK] Screenshot UltraViewer dihantar.'}else{Write-Host '[WARN] Screenshot tidak dijumpai, hantar mesej teks sahaja.'};[Windows.Forms.Clipboard]::SetText($text);$ws.SendKeys('^v');Start-Sleep -Milliseconds 500;$ws.SendKeys('{ENTER}');Write-Host '[OK] Mesej AZOBSS Remote Support dihantar.'"
if errorlevel 1 (
    echo [WARN] Auto-send WhatsApp gagal.
    echo       Screenshot masih disimpan di:
    echo       %UV_SCREENSHOT%
    echo       Cuba buka WhatsApp, tekan Ctrl+V kemudian Enter.
    echo [%date% %time%] WARN WhatsApp send failed>>"%LOG%"
) else (
    echo [OK] WhatsApp telah dibuka dan proses hantar screenshot dicuba.
)

echo [%date% %time%] DONE>>"%LOG%"
exit /b 0

:FIND_ULTRAVIEWER
set "UV_EXE="
if exist "%ProgramFiles(x86)%\UltraViewer\UltraViewer_Desktop.exe" set "UV_EXE=%ProgramFiles(x86)%\UltraViewer\UltraViewer_Desktop.exe"
if not defined UV_EXE if exist "%ProgramFiles%\UltraViewer\UltraViewer_Desktop.exe" set "UV_EXE=%ProgramFiles%\UltraViewer\UltraViewer_Desktop.exe"
if not defined UV_EXE if exist "%LOCALAPPDATA%\UltraViewer\UltraViewer_Desktop.exe" set "UV_EXE=%LOCALAPPDATA%\UltraViewer\UltraViewer_Desktop.exe"
if defined UV_EXE exit /b 0

set "AZOBSS_UV_PATH_FILE=%UV_PATH_FILE%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$out=$env:AZOBSS_UV_PATH_FILE;$found=$null;$roots=@('HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*','HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*','HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*');foreach($root in $roots){try{$items=Get-ItemProperty -Path $root -ErrorAction SilentlyContinue;foreach($item in $items){if(([string]$item.DisplayName) -like 'UltraViewer*'){$candidates=@();if($item.InstallLocation){$candidates+=Join-Path ([string]$item.InstallLocation) 'UltraViewer_Desktop.exe'};if($item.DisplayIcon){$icon=([string]$item.DisplayIcon).Trim('"').Split(',')[0];$candidates+=$icon};foreach($c in $candidates){if($c -and (Test-Path -LiteralPath $c)){$found=$c;break}}};if($found){break}}}catch{};if($found){break}};if($found){[IO.File]::WriteAllText($out,$found,[Text.UTF8Encoding]::new($false))}" >nul 2>&1
if exist "%UV_PATH_FILE%" set /p "UV_EXE="<"%UV_PATH_FILE%"
del /q "%UV_PATH_FILE%" >nul 2>&1
exit /b 0
