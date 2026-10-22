@echo off
@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul 2>&1
title AZOBSS UltraViewer Remote Support
color 0A

set "UV_DOWNLOAD_PAGE=https://www.ultraviewer.net/en/download.html"
set "UV_FALLBACK_URL=https://dl2.ultraviewer.net/UltraViewer_setup_6.6_en.exe"
set "UV_TEMP=%TEMP%\AZOBSS_UltraViewer_Latest.exe"
set "UV_URL_FILE=%TEMP%\AZOBSS_UltraViewer_URL.txt"
set "UV_PATH_FILE=%TEMP%\AZOBSS_UltraViewer_Path.txt"
set "INSTALL_LOG=%TEMP%\AZOBSS_UltraViewer_Install.log"
set "LOG=%TEMP%\AZOBSS_UltraViewer_Remote.log"

call :MAIN
set "RC=%ERRORLEVEL%"
if "%RC%"=="0" (
    timeout /t 2 /nobreak >nul
    exit /b 0
)

echo.
echo ============================================================
echo   Maaf, proses Remote Support tidak dapat disiapkan.
echo ============================================================
echo   Error code: %RC%
echo.
echo   UltraViewer masih boleh digunakan secara manual.
echo   Sila hantar ID dan Password UltraViewer kepada AZOBSS.
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
for %%F in ("%UV_URL_FILE%" "%UV_PATH_FILE%" "%UV_TEMP%") do del /q %%F >nul 2>&1

:: 1/3 - Find current official installer link
echo [1/3] Menyediakan UltraViewer terkini...
set "AZOBSS_UV_PAGE=%UV_DOWNLOAD_PAGE%"
set "AZOBSS_UV_FALLBACK=%UV_FALLBACK_URL%"
set "AZOBSS_UV_URL_FILE=%UV_URL_FILE%"
@powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop';[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;$page=$env:AZOBSS_UV_PAGE;$fallback=$env:AZOBSS_UV_FALLBACK;$url=$null;try{$r=Invoke-WebRequest -UseBasicParsing -Uri $page -Headers @{'User-Agent'='Mozilla/5.0 AZOBSS-Remote-Support'};foreach($lnk in $r.Links){$h=[string]$lnk.href;if($h -match 'UltraViewer_setup_[0-9.]+_en\.exe'){if($h -match '^https?://'){$url=$h}elseif($h.StartsWith('//')){$url='https:'+$h}else{$url=(New-Object System.Uri((New-Object System.Uri($page)),$h)).AbsoluteUri};break}};if(-not $url){$m=[regex]::Match([string]$r.Content,'UltraViewer_setup_[0-9.]+_en\.exe');if($m.Success){$url='https://dl2.ultraviewer.net/'+$m.Value}}}catch{};if(-not $url){$url=$fallback};[IO.File]::WriteAllText($env:AZOBSS_UV_URL_FILE,$url,[Text.UTF8Encoding]::new($false))" >nul 2>&1
if errorlevel 1 exit /b 10
set "UV_URL="
if exist "%UV_URL_FILE%" set /p "UV_URL="<"%UV_URL_FILE%"
if not defined UV_URL set "UV_URL=%UV_FALLBACK_URL%"
echo       [OK] Sedia.

:: 2/3 - Real download progress + elapsed install progress
echo.
echo [2/3] Memuat turun UltraViewer...
set "AZOBSS_UV_URL=%UV_URL%"
set "AZOBSS_UV_TEMP=%UV_TEMP%"
@powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop';[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;$u=$env:AZOBSS_UV_URL;$o=$env:AZOBSS_UV_TEMP;$req=[Net.HttpWebRequest]::Create($u);$req.UserAgent='Mozilla/5.0 AZOBSS-Remote-Support';$resp=$req.GetResponse();$total=[int64]$resp.ContentLength;$src=$resp.GetResponseStream();$dst=[IO.File]::Open($o,[IO.FileMode]::Create,[IO.FileAccess]::Write,[IO.FileShare]::None);$buf=New-Object byte[] 65536;$done=[int64]0;try{while(($n=$src.Read($buf,0,$buf.Length)) -gt 0){$dst.Write($buf,0,$n);$done+=$n;if($total -gt 0){$pct=[math]::Min(100,[int](($done*100)/$total));$filled=[int]($pct/5);$bar=('='*$filled).PadRight(20,'.');Write-Host -NoNewline (([char]13)+'      Download ['+$bar+'] '+$pct.ToString().PadLeft(3)+'%%  '+('{0:N1}' -f ($done/1MB))+' / '+('{0:N1}' -f ($total/1MB))+' MB')}}}finally{$dst.Close();$src.Close();$resp.Close()};Write-Host '';if((Get-Item -LiteralPath $o).Length -lt 500000){throw 'Invalid installer'}" 
if errorlevel 1 exit /b 11

echo       Memasang UltraViewer...
set "AZOBSS_UV_INSTALLER=%UV_TEMP%"
set "AZOBSS_UV_INSTALL_LOG=%INSTALL_LOG%"
@powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$exe=$env:AZOBSS_UV_INSTALLER;$log=$env:AZOBSS_UV_INSTALL_LOG;$argLine=@('/SP-','/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART',('/LOG='+[char]34+$log+[char]34));$p=Start-Process -FilePath $exe -ArgumentList $argLine -PassThru;$sw=[Diagnostics.Stopwatch]::StartNew();$frames=@('|','/','-','\');$i=0;while(-not $p.HasExited){$p.Refresh();$sec=[int]$sw.Elapsed.TotalSeconds;$frame=$frames[$i%%4];$i++;$pos=$sec%%20;$bar=('='*$pos).PadRight(20,'.');Write-Host -NoNewline (([char]13)+'      Installing ['+$bar+'] '+$frame+'  '+$sec+'s');Start-Sleep -Milliseconds 250};Write-Host '';exit $p.ExitCode"
set "INSTALL_RC=%ERRORLEVEL%"
echo [%date% %time%] installer exit=%INSTALL_RC%>>"%LOG%"

call :WAIT_FIND_ULTRAVIEWER
if not defined UV_EXE (
    echo       Menyelesaikan pemasangan...
    start "" /wait "%UV_TEMP%" /SP- /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /LOG="%INSTALL_LOG%" >nul 2>&1
    call :WAIT_FIND_ULTRAVIEWER
)
if not defined UV_EXE exit /b 21
echo       [OK] UltraViewer siap.

del /q "%UV_TEMP%" "%UV_URL_FILE%" >nul 2>&1

:: 3/3 - Launch UltraViewer + customer instruction popup
echo.
echo [3/3] Membuka UltraViewer...
start "" "%UV_EXE%"
echo       Menunggu ID dan Password dipaparkan...
timeout /t 6 /nobreak >nul

echo       [OK] UltraViewer dibuka.
echo       Sila ikut arahan pada popup.

@powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName PresentationFramework; $nl=[Environment]::NewLine; $m='UltraViewer sudah dibuka.'+$nl+$nl+'LANGKAH SETERUSNYA:'+$nl+'1. Tunggu ID dan Password UltraViewer muncul.'+$nl+'2. Pilih salah satu cara:'+$nl+$nl+'A) Ambil screenshot tetingkap UltraViewer yang menunjukkan ID + Password, kemudian hantar gambar kepada AZOBSS.'+$nl+$nl+'ATAU'+$nl+$nl+'B) Taip ID dan Password UltraViewer kepada AZOBSS.'+$nl+$nl+'WhatsApp AZOBSS: 011-3560 0723'+$nl+$nl+'KESELAMATAN: Jangan beri ID/Password kepada pihak lain. Tekan Accept hanya selepas juruteknik AZOBSS yang sah menghubungi kamu.'; [System.Windows.MessageBox]::Show($m,'AZOBSS Remote Support','OK','Information') | Out-Null" >nul 2>&1

echo.
echo ============================================================
echo   SELESAI - UltraViewer sedia untuk Remote Support.
echo ============================================================
echo.
echo   Hantar screenshot atau ID + Password kepada AZOBSS.
echo   WhatsApp: 011-3560 0723
echo [%date% %time%] DONE>>"%LOG%"
timeout /t 2 /nobreak >nul
exit /b 0

:WAIT_FIND_ULTRAVIEWER
set "UV_EXE="
for /L %%N in (1,1,20) do (
    call :FIND_ULTRAVIEWER
    if defined UV_EXE exit /b 0
    timeout /t 1 /nobreak >nul
)
exit /b 0

:FIND_ULTRAVIEWER
set "UV_EXE="
if exist "%ProgramFiles(x86)%\UltraViewer\UltraViewer_Desktop.exe" set "UV_EXE=%ProgramFiles(x86)%\UltraViewer\UltraViewer_Desktop.exe"
if not defined UV_EXE if exist "%ProgramFiles%\UltraViewer\UltraViewer_Desktop.exe" set "UV_EXE=%ProgramFiles%\UltraViewer\UltraViewer_Desktop.exe"
if not defined UV_EXE if exist "%LOCALAPPDATA%\UltraViewer\UltraViewer_Desktop.exe" set "UV_EXE=%LOCALAPPDATA%\UltraViewer\UltraViewer_Desktop.exe"
if defined UV_EXE exit /b 0

set "AZOBSS_UV_PATH_FILE=%UV_PATH_FILE%"
@powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$out=$env:AZOBSS_UV_PATH_FILE;$found=$null;$roots=@('HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*','HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*','HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*');foreach($root in $roots){try{$items=Get-ItemProperty -Path $root -ErrorAction SilentlyContinue;foreach($item in $items){if(([string]$item.DisplayName) -like 'UltraViewer*'){$candidates=@();if($item.InstallLocation){$candidates+=Join-Path ([string]$item.InstallLocation) 'UltraViewer_Desktop.exe'};if($item.DisplayIcon){$icon=([string]$item.DisplayIcon).Trim('"').Split(',')[0];$candidates+=$icon};foreach($c in $candidates){if($c -and (Test-Path -LiteralPath $c)){$found=$c;break}}};if($found){break}}}catch{};if($found){break}};if($found){[IO.File]::WriteAllText($out,$found,[Text.UTF8Encoding]::new($false))}" >nul 2>&1
if exist "%UV_PATH_FILE%" set /p "UV_EXE="<"%UV_PATH_FILE%"
del /q "%UV_PATH_FILE%" >nul 2>&1
exit /b 0
