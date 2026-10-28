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
    echo Sila hantar ID dan Password yang dipaparkan dalam UltraViewer
    echo kepada AZOBSS melalui WhatsApp yang telah dibuka.
) else (
    echo ============================================================
    echo   PROSES BERHENTI - Error code: %RC%
    echo ============================================================
    echo.
    echo Log: %LOG%
    echo Installer log: %INSTALL_LOG%
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

:: ------------------------------------------------------------
:: 1/4 - Discover current official installer URL + download
:: ------------------------------------------------------------
echo [1/4] Mencari installer UltraViewer rasmi terkini...
set "AZOBSS_UV_PAGE=%UV_DOWNLOAD_PAGE%"
set "AZOBSS_UV_FALLBACK=%UV_FALLBACK_URL%"
set "AZOBSS_UV_TEMP=%UV_TEMP%"
set "AZOBSS_UV_URL_FILE=%UV_URL_FILE%"

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;$page=$env:AZOBSS_UV_PAGE;$fallback=$env:AZOBSS_UV_FALLBACK;$dest=$env:AZOBSS_UV_TEMP;$url=$null;try{$r=Invoke-WebRequest -UseBasicParsing -Uri $page -Headers @{'User-Agent'='Mozilla/5.0 AZOBSS-Remote-Support'};foreach($lnk in $r.Links){$h=[string]$lnk.href;if($h -match 'UltraViewer_setup_[0-9.]+_en\.exe'){if($h -match '^https?://'){$url=$h}elseif($h.StartsWith('//')){$url='https:'+$h}else{$url=(New-Object System.Uri((New-Object System.Uri($page)),$h)).AbsoluteUri};break}};if(-not $url){$m=[regex]::Match([string]$r.Content,'UltraViewer_setup_[0-9.]+_en\.exe');if($m.Success){$url='https://dl2.ultraviewer.net/'+$m.Value}}}catch{};if(-not $url){$url=$fallback};[IO.File]::WriteAllText($env:AZOBSS_UV_URL_FILE,$url,[Text.UTF8Encoding]::new($false));Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $dest -Headers @{'User-Agent'='Mozilla/5.0 AZOBSS-Remote-Support'};if(-not (Test-Path -LiteralPath $dest)){throw 'Installer tidak wujud selepas download'};$f=Get-Item -LiteralPath $dest;if($f.Length -lt 500000){throw ('Installer terlalu kecil: '+$f.Length+' bytes')};Write-Host ('[OK] '+$url);Write-Host ('[OK] Saiz: '+$f.Length+' bytes');if($f.VersionInfo.ProductVersion){Write-Host ('[OK] Product version: '+$f.VersionInfo.ProductVersion)}"
if errorlevel 1 (
    echo [FAILED] Download automatik gagal.
    echo [%date% %time%] ERROR download>>"%LOG%"
    echo Cuba buka halaman rasmi: %UV_DOWNLOAD_PAGE%
    exit /b 11
)

if not exist "%UV_TEMP%" (
    echo [FAILED] Fail installer tidak dijumpai selepas download.
    exit /b 12
)

set "UV_URL="
if exist "%UV_URL_FILE%" set /p "UV_URL="<"%UV_URL_FILE%"
if defined UV_URL echo       Sumber: %UV_URL%

:: ------------------------------------------------------------
:: 2/4 - Install/update. Installer itself requests UAC when needed.
:: ------------------------------------------------------------
echo.
echo [2/4] Memasang / mengemas kini UltraViewer...
echo       Jika Windows minta kebenaran UAC, tekan Yes.
"%UV_TEMP%" /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /LOG="%INSTALL_LOG%"
set "INSTALL_RC=%ERRORLEVEL%"
echo [%date% %time%] installer exit=%INSTALL_RC%>>"%LOG%"

:: Even if the installer returns a non-zero code, check whether UltraViewer
:: is already installed before treating it as a failure.
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

echo       UltraViewer READY.
echo       %UV_EXE%
echo [%date% %time%] UltraViewer path=%UV_EXE%>>"%LOG%"

del /q "%UV_TEMP%" >nul 2>&1
del /q "%UV_URL_FILE%" >nul 2>&1

:: ------------------------------------------------------------
:: 3/4 - Launch UltraViewer
:: ------------------------------------------------------------
echo.
echo [3/4] Membuka UltraViewer...
start "" "%UV_EXE%"
timeout /t 6 /nobreak >nul

:: ------------------------------------------------------------
:: 4/4 - Open WhatsApp with a ready-to-send template
:: ------------------------------------------------------------
echo [4/4] Membuka WhatsApp AZOBSS...
set "AZOBSS_WA_PHONE=%PHONE%"
set "AZOBSS_WA_TEXT=AZOBSS Remote Support - UltraViewer sudah dibuka. ID: [isi ID UltraViewer]  Password: [isi Password UltraViewer]"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$u='https://wa.me/'+$env:AZOBSS_WA_PHONE+'?text='+[uri]::EscapeDataString($env:AZOBSS_WA_TEXT);Start-Process $u" >nul 2>&1
if errorlevel 1 (
    echo [WARN] WhatsApp tidak dapat dibuka secara automatik.
    echo       Buka WhatsApp dan hantar ID + Password UltraViewer kepada AZOBSS.
    echo [%date% %time%] WARN WhatsApp open failed>>"%LOG%"
) else (
    echo       WhatsApp dibuka dengan template ID / Password.
)

echo [%date% %time%] DONE>>"%LOG%"
exit /b 0

:FIND_ULTRAVIEWER
set "UV_EXE="
if exist "%ProgramFiles(x86)%\UltraViewer\UltraViewer_Desktop.exe" set "UV_EXE=%ProgramFiles(x86)%\UltraViewer\UltraViewer_Desktop.exe"
if not defined UV_EXE if exist "%ProgramFiles%\UltraViewer\UltraViewer_Desktop.exe" set "UV_EXE=%ProgramFiles%\UltraViewer\UltraViewer_Desktop.exe"
if not defined UV_EXE if exist "%LOCALAPPDATA%\UltraViewer\UltraViewer_Desktop.exe" set "UV_EXE=%LOCALAPPDATA%\UltraViewer\UltraViewer_Desktop.exe"
if defined UV_EXE exit /b 0

:: Registry fallback - useful if UltraViewer changes its install folder.
set "AZOBSS_UV_PATH_FILE=%UV_PATH_FILE%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$out=$env:AZOBSS_UV_PATH_FILE;$found=$null;$roots=@('HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*','HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*','HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*');foreach($root in $roots){try{$items=Get-ItemProperty -Path $root -ErrorAction SilentlyContinue;foreach($item in $items){if(([string]$item.DisplayName) -like 'UltraViewer*'){$candidates=@();if($item.InstallLocation){$candidates+=Join-Path ([string]$item.InstallLocation) 'UltraViewer_Desktop.exe'};if($item.DisplayIcon){$icon=([string]$item.DisplayIcon).Trim('"').Split(',')[0];$candidates+=$icon};foreach($c in $candidates){if($c -and (Test-Path -LiteralPath $c)){$found=$c;break}}};if($found){break}}}catch{};if($found){break}};if($found){[IO.File]::WriteAllText($out,$found,[Text.UTF8Encoding]::new($false))}" >nul 2>&1
if exist "%UV_PATH_FILE%" set /p "UV_EXE="<"%UV_PATH_FILE%"
del /q "%UV_PATH_FILE%" >nul 2>&1
exit /b 0
