@echo off
setlocal EnableExtensions EnableDelayedExpansion
title AnyDesk + TeamViewer + RustDesk Auto Install and Send ID
color 0A

:: ============================================================
:: AUTO INSTALL / RUN:
::   1. AnyDesk
::   2. TeamViewer
::   3. RustDesk
::
:: AUTO GET ID:
::   - AnyDesk ID
::   - TeamViewer ID
::   - RustDesk ID
::
:: Then open WhatsApp Web with all IDs filled in automatically.
:: ============================================================

:: =========================
:: ADMIN CHECK
:: =========================
net session >nul 2>&1
if %errorlevel% neq 0 (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

:: =========================
:: SETTINGS
:: =========================
set "PHONE=60192554232"

set "ANYDESK_URL=https://download.anydesk.com/AnyDesk.exe"
set "ANYDESK_TEMP=%TEMP%\AZOBSS_AnyDesk.exe"
set "ANYDESK_EXE1=C:\Program Files (x86)\AnyDesk\AnyDesk.exe"
set "ANYDESK_EXE2=C:\Program Files\AnyDesk\AnyDesk.exe"

set "TEAMVIEWER_URL=https://download.teamviewer.com/download/TeamViewer_Setup_x64.exe"
set "TEAMVIEWER_TEMP=%TEMP%\AZOBSS_TeamViewer_Setup_x64.exe"
set "TEAMVIEWER_EXE1=C:\Program Files\TeamViewer\TeamViewer.exe"
set "TEAMVIEWER_EXE2=C:\Program Files (x86)\TeamViewer\TeamViewer.exe"

set "RUSTDESK_TEMP=%TEMP%\AZOBSS_RustDesk.exe"
set "RUSTDESK_EXE1=C:\Program Files\RustDesk\rustdesk.exe"
set "RUSTDESK_EXE2=C:\Program Files (x86)\RustDesk\rustdesk.exe"

set "ANYDESK_ID="
set "TEAMVIEWER_ID="
set "RUSTDESK_ID="

cls
echo ============================================================
echo   ANYDESK + TEAMVIEWER + RUSTDESK
echo   AUTO DOWNLOAD / INSTALL / GET ID / SEND WHATSAPP
echo ============================================================
echo.

:: ============================================================
:: ANYDESK
:: ============================================================
echo [1/3] ANYDESK
echo ------------------------------------------------------------
taskkill /f /im AnyDesk.exe >nul 2>&1

if not exist "%ANYDESK_EXE1%" if not exist "%ANYDESK_EXE2%" (
    echo Downloading AnyDesk...
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri '%ANYDESK_URL%' -OutFile '%ANYDESK_TEMP%'"

    if not exist "%ANYDESK_TEMP%" (
        echo [FAILED] AnyDesk download failed.
        goto ANYDESK_GET_ID
    )

    echo Installing AnyDesk silently...
    "%ANYDESK_TEMP%" --install "C:\Program Files (x86)\AnyDesk" --silent --create-desktop-icon
    timeout /t 5 /nobreak >nul
    del /q "%ANYDESK_TEMP%" >nul 2>&1
) else (
    echo [OK] AnyDesk already installed.
)

if exist "%ANYDESK_EXE1%" (
    "%ANYDESK_EXE1%" --start-service >nul 2>&1
    start "" "%ANYDESK_EXE1%"
) else if exist "%ANYDESK_EXE2%" (
    "%ANYDESK_EXE2%" --start-service >nul 2>&1
    start "" "%ANYDESK_EXE2%"
)
timeout /t 3 /nobreak >nul

:ANYDESK_GET_ID
echo Getting AnyDesk ID...

if exist "%ANYDESK_EXE1%" (
    for /f "usebackq delims=" %%I in (`"%ANYDESK_EXE1%" --get-id 2^>nul`) do if not defined ANYDESK_ID set "ANYDESK_ID=%%I"
)
if not defined ANYDESK_ID if exist "%ANYDESK_EXE2%" (
    for /f "usebackq delims=" %%I in (`"%ANYDESK_EXE2%" --get-id 2^>nul`) do if not defined ANYDESK_ID set "ANYDESK_ID=%%I"
)

if defined ANYDESK_ID (
    for /f "tokens=* delims= " %%I in ("!ANYDESK_ID!") do set "ANYDESK_ID=%%I"
    echo [OK] AnyDesk ID: !ANYDESK_ID!
) else (
    set "ANYDESK_ID=NOT AVAILABLE"
    echo [WARNING] AnyDesk ID not available.
)

echo.

:: ============================================================
:: TEAMVIEWER
:: ============================================================
echo [2/3] TEAMVIEWER
echo ------------------------------------------------------------

if not exist "%TEAMVIEWER_EXE1%" if not exist "%TEAMVIEWER_EXE2%" (
    echo Downloading latest TeamViewer 64-bit...
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri '%TEAMVIEWER_URL%' -OutFile '%TEAMVIEWER_TEMP%'"

    if not exist "%TEAMVIEWER_TEMP%" (
        echo [FAILED] TeamViewer download failed.
        goto TEAMVIEWER_GET_ID
    )

    echo Installing TeamViewer...
    echo Trying unattended EXE install first...
    start /wait "" "%TEAMVIEWER_TEMP%" /S
    timeout /t 8 /nobreak >nul

    :: TeamViewer does not officially guarantee silent deployment for the
    :: public EXE. If /S did not install it, open the already-downloaded
    :: official installer normally and wait until installation finishes.
    if not exist "%TEAMVIEWER_EXE1%" if not exist "%TEAMVIEWER_EXE2%" (
        echo.
        echo [INFO] Silent EXE install was not completed.
        echo Opening the downloaded TeamViewer installer...
        start /wait "" "%TEAMVIEWER_TEMP%"
        timeout /t 5 /nobreak >nul
    )

    del /q "%TEAMVIEWER_TEMP%" >nul 2>&1
) else (
    echo [OK] TeamViewer already installed.
)

sc start TeamViewer >nul 2>&1
timeout /t 2 /nobreak >nul

if exist "%TEAMVIEWER_EXE1%" (
    start "" "%TEAMVIEWER_EXE1%" --Minimize
) else if exist "%TEAMVIEWER_EXE2%" (
    start "" "%TEAMVIEWER_EXE2%" --Minimize
)
timeout /t 5 /nobreak >nul

:TEAMVIEWER_GET_ID
echo Getting TeamViewer ID...

:: TeamViewer stores a reference copy of ClientID in the Windows registry.
:: PowerShell is used so large DWORD values are converted correctly.
for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$paths=@('Registry::HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\TeamViewer','Registry::HKEY_LOCAL_MACHINE\SOFTWARE\TeamViewer'); foreach($p in $paths){ try { $v=(Get-ItemProperty -Path $p -Name ClientID -ErrorAction Stop).ClientID; if($null -ne $v){ if($v -is [int]){ ([uint64]([uint32]$v)).ToString() } else { ([uint64]$v).ToString() }; break } } catch{} }"`) do (
    if not defined TEAMVIEWER_ID set "TEAMVIEWER_ID=%%I"
)

if defined TEAMVIEWER_ID (
    echo [OK] TeamViewer ID: !TEAMVIEWER_ID!
) else (
    set "TEAMVIEWER_ID=NOT AVAILABLE"
    echo [WARNING] TeamViewer ID not available yet.
)
echo.

:: ============================================================
:: RUSTDESK
:: ============================================================
echo [3/3] RUSTDESK
echo ------------------------------------------------------------

if not exist "%RUSTDESK_EXE1%" if not exist "%RUSTDESK_EXE2%" (
    echo Finding latest official RustDesk Windows x86_64 release...

    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $headers=@{'User-Agent'='AZOBSS-Installer'}; $r=Invoke-RestMethod -Headers $headers -Uri 'https://api.github.com/repos/rustdesk/rustdesk/releases/latest'; $a=$r.assets ^| Where-Object { $_.name -match '^rustdesk-[0-9].*-x86_64\.exe$' -and $_.name -notmatch 'win7|sciter' } ^| Select-Object -First 1; if(-not $a){ $a=$r.assets ^| Where-Object { $_.name -match 'x86_64\.exe$' } ^| Select-Object -First 1 }; if(-not $a){ throw 'RustDesk Windows x86_64 asset not found' }; Write-Host ('Downloading ' + $a.name + '...'); Invoke-WebRequest -UseBasicParsing -Uri $a.browser_download_url -OutFile '%RUSTDESK_TEMP%'"

    if not exist "%RUSTDESK_TEMP%" (
        echo [FAILED] RustDesk download failed.
        goto RUSTDESK_GET_ID
    )

    echo Installing RustDesk silently...
    "%RUSTDESK_TEMP%" --silent-install
    timeout /t 8 /nobreak >nul
    del /q "%RUSTDESK_TEMP%" >nul 2>&1
) else (
    echo [OK] RustDesk already installed.
)

sc start RustDesk >nul 2>&1
timeout /t 2 /nobreak >nul

if exist "%RUSTDESK_EXE1%" (
    start "" "%RUSTDESK_EXE1%"
) else if exist "%RUSTDESK_EXE2%" (
    start "" "%RUSTDESK_EXE2%"
)
timeout /t 5 /nobreak >nul

:RUSTDESK_GET_ID
echo Getting RustDesk ID...

if exist "%RUSTDESK_EXE1%" (
    for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$x = ^& '%RUSTDESK_EXE1%' --get-id ^| Out-String; $x.Trim()"`) do (
        if not defined RUSTDESK_ID set "RUSTDESK_ID=%%I"
    )
)

if not defined RUSTDESK_ID if exist "%RUSTDESK_EXE2%" (
    for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$x = ^& '%RUSTDESK_EXE2%' --get-id ^| Out-String; $x.Trim()"`) do (
        if not defined RUSTDESK_ID set "RUSTDESK_ID=%%I"
    )
)

if defined RUSTDESK_ID (
    echo [OK] RustDesk ID: !RUSTDESK_ID!
) else (
    set "RUSTDESK_ID=NOT AVAILABLE"
    echo [WARNING] RustDesk ID not available yet.
)

echo.
echo ============================================================
echo                 REMOTE SUPPORT IDs
echo ============================================================
echo AnyDesk    : !ANYDESK_ID!
echo TeamViewer : !TEAMVIEWER_ID!
echo RustDesk   : !RUSTDESK_ID!
echo ============================================================
echo.

:: =========================
:: BUILD WHATSAPP MESSAGE
:: =========================
set "MSGFILE=%TEMP%\AZOBSS_Remote_IDs.txt"
> "%MSGFILE%" (
    echo Remote Support IDs
    echo AnyDesk: !ANYDESK_ID!
    echo TeamViewer: !TEAMVIEWER_ID!
    echo RustDesk: !RUSTDESK_ID!
)

set "ENCODED_MSG="
for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$m=Get-Content -LiteralPath '%MSGFILE%' -Raw; [uri]::EscapeDataString($m)"`) do (
    set "ENCODED_MSG=%%I"
)

del /q "%MSGFILE%" >nul 2>&1

if not defined ENCODED_MSG (
    set "ENCODED_MSG=Remote%%20Support%%20IDs%%0AAnyDesk%%3A%%20!ANYDESK_ID!%%0ATeamViewer%%3A%%20!TEAMVIEWER_ID!%%0ARustDesk%%3A%%20!RUSTDESK_ID!"
)

echo Opening WhatsApp Web with all IDs...
start "" "https://web.whatsapp.com/send?phone=%PHONE%&text=!ENCODED_MSG!"

echo.
echo DONE - AnyDesk, TeamViewer and RustDesk IDs collected.
echo WhatsApp opened with all IDs.
echo.
pause
exit /b
