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
set "PHONE=601135600723"
set "UV_SCREENSHOT=%TEMP%\AZOBSS_UltraViewer_Screenshot.png"
set "CAP_ERR=%TEMP%\AZOBSS_UV_Capture_Error.txt"
set "WA_ERR=%TEMP%\AZOBSS_UV_WhatsApp_Error.txt"
set "CAP_PS1=%TEMP%\AZOBSS_UV_Capture.ps1"
set "WA_PS1=%TEMP%\AZOBSS_UV_WhatsApp.ps1"

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
for %%F in ("%UV_URL_FILE%" "%UV_PATH_FILE%" "%UV_TEMP%" "%UV_SCREENSHOT%" "%CAP_ERR%" "%WA_ERR%" "%CAP_PS1%" "%WA_PS1%") do del /q %%F >nul 2>&1

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

:: 3/4 - Launch + screenshot UltraViewer
echo.
echo [3/4] Membuka UltraViewer dan mengambil screenshot...
start "" "%UV_EXE%"
echo       Menunggu ID dan Password dipaparkan...
timeout /t 7 /nobreak >nul
call :WRITE_HELPER "%CAP_PS1%" CAPTURE
set "AZOBSS_UV_SCREENSHOT=%UV_SCREENSHOT%"
set "AZOBSS_UV_CAPTURE_ERROR=%CAP_ERR%"
@powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File "%CAP_PS1%" >nul 2>>"%LOG%"
set "CAP_RC=%ERRORLEVEL%"
del /q "%CAP_PS1%" >nul 2>&1
if not "%CAP_RC%"=="0" (
    echo       [WARN] Screenshot automatik gagal.
    if exist "%CAP_ERR%" set /p "CAP_MSG="<"%CAP_ERR%"
    if defined CAP_MSG echo       %CAP_MSG%
) else (
    echo       [OK] Screenshot UltraViewer berjaya.
)

:: 4/4 - WhatsApp auto send
echo.
echo [4/4] Membuka WhatsApp AZOBSS dan menghantar screenshot...
if not "%CAP_RC%"=="0" goto WA_FALLBACK
set "AZOBSS_WA_PHONE=%PHONE%"
set "AZOBSS_WA_TEXT=AZOBSS Remote Support - Screenshot UltraViewer dilampirkan. Sila gunakan ID dan Password pada screenshot untuk sesi remote ini."
set "AZOBSS_UV_SCREENSHOT=%UV_SCREENSHOT%"
set "AZOBSS_WA_ERROR=%WA_ERR%"
call :WRITE_HELPER "%WA_PS1%" WHATSAPP
@powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File "%WA_PS1%" >nul 2>>"%LOG%"
set "WA_RC=%ERRORLEVEL%"
del /q "%WA_PS1%" >nul 2>&1
if "%WA_RC%"=="0" (
    echo       [OK] Screenshot dihantar ke WhatsApp AZOBSS.
    goto DONE_AUTO
)
echo       [WARN] Auto-send tidak berjaya.
if exist "%WA_ERR%" set /p "WA_MSG="<"%WA_ERR%"
if defined WA_MSG echo       %WA_MSG%

:WA_FALLBACK
start "" "https://web.whatsapp.com/send?phone=%PHONE%"
echo       WhatsApp Web dibuka.
if exist "%UV_SCREENSHOT%" echo       Screenshot disimpan: %UV_SCREENSHOT%
echo       Jika perlu, hantar screenshot / ID + Password secara manual.

:DONE_AUTO
echo.
echo ============================================================
echo   SELESAI - UltraViewer Remote Support sedia digunakan.
echo ============================================================
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
:WRITE_HELPER
set "HELPER_OUT=%~1"
set "HELPER_KIND=%~2"
set "HELPER_B64=%TEMP%\AZOBSS_Helper_%RANDOM%_%RANDOM%.b64"
if /I "%HELPER_KIND%"=="CAPTURE" call :PAYLOAD_CAPTURE
if /I "%HELPER_KIND%"=="WHATSAPP" call :PAYLOAD_WHATSAPP
set "AZOBSS_HELPER_B64=%HELPER_B64%"
set "AZOBSS_HELPER_OUT=%HELPER_OUT%"
@powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$s=(Get-Content -Raw $env:AZOBSS_HELPER_B64)-replace '\s','';[IO.File]::WriteAllBytes($env:AZOBSS_HELPER_OUT,[Convert]::FromBase64String($s))" >nul 2>&1
del /q "%HELPER_B64%" >nul 2>&1
exit /b 0

:PAYLOAD_CAPTURE
> "%HELPER_B64%" echo(JEVycm9yQWN0aW9uUHJlZmVyZW5jZT0nU3RvcCcKQWRkLVR5cGUgLUFzc2VtYmx5TmFtZSBTeXN0ZW0uRHJhd2luZwpBZGQtVHlwZSAtQXNzZW1ibHlOYW1lIFN5c3RlbS5XaW5kb3dzLkZvcm1zCiRzcmM9QCcKdXNpbmcgU3lzdGVtOwp1c2luZyBTeXN0ZW0uVGV4dDsKdXNpbmcgU3lzdGVtLlJ1bnRpbWUuSW50ZXJvcFNlcnZpY2VzOwpwdWJsaWMgc3RhdGljIGNsYXNzIFVWV2luMzIgewogIHB1YmxpYyBkZWxlZ2F0ZSBib29sIEVudW1XaW5kb3dzUHJvYyhJbnRQdHIgaFduZCwgSW50UHRyIGxQYXJhbSk7CiAgW0RsbEltcG9ydCgidXNlcjMyLmRsbCIpXSBwdWJsaWMgc3RhdGljIGV4dGVybiBib29sIEVudW1XaW5kb3dzKEVudW1XaW5kb3dzUHJvYyBjYiwgSW50UHRyIGxwKTsKICBbRGxsSW1wb3J0KCJ1c2VyMzIuZGxsIildIHB1YmxpYyBzdGF0aWMgZXh0ZXJuIGJvb2wgSXNXaW5kb3dWaXNpYmxlKEludFB0ciBoV25kKTsKICBbRGxsSW1wb3J0KCJ1c2VyMzIuZGxsIildIHB1YmxpYyBzdGF0aWMgZXh0ZXJuIHVpbnQgR2V0V2luZG93VGhyZWFkUHJvY2Vzc0lkKEludFB0ciBoV25kLCBvdXQgdWludCBwcm9jZXNzSWQpOwogIFtEbGxJbXBvcnQoInVzZXIzMi5kbGwiKV0gcHVibGljIHN0YXRpYyBleHRlcm4gYm9vbCBHZXRXaW5kb3dSZWN0KEludFB0ciBoV25kLCBvdXQgUkVDVCBy
>> "%HELPER_B64%" echo(KTsKICBbRGxsSW1wb3J0KCJ1c2VyMzIuZGxsIildIHB1YmxpYyBzdGF0aWMgZXh0ZXJuIGJvb2wgU2hvd1dpbmRvdyhJbnRQdHIgaFduZCwgaW50IGNtZCk7CiAgW0RsbEltcG9ydCgidXNlcjMyLmRsbCIpXSBwdWJsaWMgc3RhdGljIGV4dGVybiBib29sIFNldEZvcmVncm91bmRXaW5kb3coSW50UHRyIGhXbmQpOwogIFtEbGxJbXBvcnQoInVzZXIzMi5kbGwiKV0gcHVibGljIHN0YXRpYyBleHRlcm4gYm9vbCBQcmludFdpbmRvdyhJbnRQdHIgaFduZCwgSW50UHRyIGhkY0JsdCwgdWludCBuRmxhZ3MpOwogIFtEbGxJbXBvcnQoInVzZXIzMi5kbGwiLCBDaGFyU2V0PUNoYXJTZXQuVW5pY29kZSldIHB1YmxpYyBzdGF0aWMgZXh0ZXJuIGludCBHZXRXaW5kb3dUZXh0KEludFB0ciBoV25kLCBTdHJpbmdCdWlsZGVyIHMsIGludCBuKTsKICBbRGxsSW1wb3J0KCJ1c2VyMzIuZGxsIildIHB1YmxpYyBzdGF0aWMgZXh0ZXJuIGludCBHZXRXaW5kb3dUZXh0TGVuZ3RoKEludFB0ciBoV25kKTsKICBbRGxsSW1wb3J0KCJ1c2VyMzIuZGxsIildIHB1YmxpYyBzdGF0aWMgZXh0ZXJuIEludFB0ciBHZXRDb25zb2xlV2luZG93KCk7CiAgW1N0cnVjdExheW91dChMYXlvdXRLaW5kLlNlcXVlbnRpYWwpXSBwdWJsaWMgc3RydWN0IFJFQ1QgeyBwdWJsaWMgaW50IExlZnQ7IHB1YmxpYyBpbnQgVG9wOyBw
>> "%HELPER_B64%" echo(dWJsaWMgaW50IFJpZ2h0OyBwdWJsaWMgaW50IEJvdHRvbTsgfQp9CidACkFkZC1UeXBlIC1UeXBlRGVmaW5pdGlvbiAkc3JjIC1MYW5ndWFnZSBDU2hhcnAKCmZ1bmN0aW9uIEdldC1VbHRyYVZpZXdlcldpbmRvdyB7CiAgJHdpbnMgPSBOZXctT2JqZWN0IFN5c3RlbS5Db2xsZWN0aW9ucy5BcnJheUxpc3QKICBbVVZXaW4zMl06OkVudW1XaW5kb3dzKHsKICAgIHBhcmFtKFtJbnRQdHJdJGgsW0ludFB0cl0kbHApCiAgICB0cnkgewogICAgICBpZigtbm90IFtVVldpbjMyXTo6SXNXaW5kb3dWaXNpYmxlKCRoKSl7IHJldHVybiAkdHJ1ZSB9CiAgICAgIFt1aW50MzJdJHByb2NJZCA9IDAKICAgICAgW3ZvaWRdW1VWV2luMzJdOjpHZXRXaW5kb3dUaHJlYWRQcm9jZXNzSWQoJGgsW3JlZl0kcHJvY0lkKQogICAgICAkcCA9IEdldC1Qcm9jZXNzIC1JZCAoW2ludF0kcHJvY0lkKSAtRXJyb3JBY3Rpb24gU2lsZW50bHlDb250aW51ZQogICAgICBpZigtbm90ICRwKXsgcmV0dXJuICR0cnVlIH0KICAgICAgJG5hbWUgPSBbc3RyaW5nXSRwLlByb2Nlc3NOYW1lCiAgICAgICRsZW49W1VWV2luMzJdOjpHZXRXaW5kb3dUZXh0TGVuZ3RoKCRoKQogICAgICAkc2I9TmV3LU9iamVjdCBTeXN0ZW0uVGV4dC5TdHJpbmdCdWlsZGVyIChbTWF0aF06Ok1heCgyNTYsJGxlbisxKSkKICAgICAgW3ZvaWRdW1VW
>> "%HELPER_B64%" echo(V2luMzJdOjpHZXRXaW5kb3dUZXh0KCRoLCRzYiwkc2IuQ2FwYWNpdHkpCiAgICAgICR0aXRsZT0kc2IuVG9TdHJpbmcoKQogICAgICBpZigkbmFtZSAtbm90bWF0Y2ggJyg/aSleVWx0cmFWaWV3ZXInIC1hbmQgJHRpdGxlIC1ub3RtYXRjaCAnKD9pKVVsdHJhVmlld2VyJyl7IHJldHVybiAkdHJ1ZSB9CiAgICAgICRyPU5ldy1PYmplY3QgVVZXaW4zMitSRUNUCiAgICAgIGlmKC1ub3QgW1VWV2luMzJdOjpHZXRXaW5kb3dSZWN0KCRoLFtyZWZdJHIpKXsgcmV0dXJuICR0cnVlIH0KICAgICAgJHc9JHIuUmlnaHQtJHIuTGVmdDsgJGh0PSRyLkJvdHRvbS0kci5Ub3AKICAgICAgaWYoJHcgLWx0IDMwMCAtb3IgJGh0IC1sdCAyMjApeyByZXR1cm4gJHRydWUgfQogICAgICBbdm9pZF0kd2lucy5BZGQoW3BzY3VzdG9tb2JqZWN0XUB7SGFuZGxlPSRoO1BpZD0kcHJvY0lkO05hbWU9JG5hbWU7VGl0bGU9JHRpdGxlO1JlY3Q9JHI7Vz0kdztIPSRodDtBcmVhPSR3KiRodH0pCiAgICB9IGNhdGNoIHt9CiAgICByZXR1cm4gJHRydWUKICB9LFtJbnRQdHJdOjpaZXJvKSB8IE91dC1OdWxsCiAgJHdpbnMgfCBTb3J0LU9iamVjdCBBcmVhIC1EZXNjZW5kaW5nIHwgU2VsZWN0LU9iamVjdCAtRmlyc3QgMQp9CgpmdW5jdGlvbiBUZXN0LUltYWdlVXNlZnVsKFtzdHJpbmddJHBhdGgpewogIHRyeSB7CiAg
>> "%HELPER_B64%" echo(ICBpZigtbm90IChUZXN0LVBhdGggLUxpdGVyYWxQYXRoICRwYXRoKSl7IHJldHVybiAkZmFsc2UgfQogICAgaWYoKEdldC1JdGVtIC1MaXRlcmFsUGF0aCAkcGF0aCkuTGVuZ3RoIC1sdCAxMjAwMCl7IHJldHVybiAkZmFsc2UgfQogICAgJGltZz1bU3lzdGVtLkRyYXdpbmcuQml0bWFwXTo6RnJvbUZpbGUoJHBhdGgpCiAgICB0cnkgewogICAgICAkcHRzPUAoW1R1cGxlXTo6Q3JlYXRlKDEwLDEwKSxbVHVwbGVdOjpDcmVhdGUoW2ludF0oJGltZy5XaWR0aC8yKSxbaW50XSgkaW1nLkhlaWdodC8yKSksW1R1cGxlXTo6Q3JlYXRlKFtNYXRoXTo6TWF4KDEsJGltZy5XaWR0aC0xMCksW01hdGhdOjpNYXgoMSwkaW1nLkhlaWdodC0xMCkpKQogICAgICAkdmFscz1AKCkKICAgICAgZm9yZWFjaCgkcHQgaW4gJHB0cyl7JGM9JGltZy5HZXRQaXhlbChbTWF0aF06Ok1pbigkaW1nLldpZHRoLTEsJHB0Lkl0ZW0xKSxbTWF0aF06Ok1pbigkaW1nLkhlaWdodC0xLCRwdC5JdGVtMikpOyR2YWxzICs9ICgkYy5SKyRjLkcrJGMuQil9CiAgICAgIHJldHVybiAoKCR2YWxzIHwgU2VsZWN0LU9iamVjdCAtVW5pcXVlKS5Db3VudCAtZ3QgMSkKICAgIH0gZmluYWxseSB7JGltZy5EaXNwb3NlKCl9CiAgfSBjYXRjaCB7IHJldHVybiAkZmFsc2UgfQp9Cgokc2hvdD0kZW52OkFaT0JTU19VVl9TQ1JFRU5TSE9U
>> "%HELPER_B64%" echo(CiRlcnI9JGVudjpBWk9CU1NfVVZfQ0FQVFVSRV9FUlJPUgokY29uc29sZT1bVVZXaW4zMl06OkdldENvbnNvbGVXaW5kb3coKQp0cnkgewogIFJlbW92ZS1JdGVtIC1MaXRlcmFsUGF0aCAkc2hvdCAtRm9yY2UgLUVycm9yQWN0aW9uIFNpbGVudGx5Q29udGludWUKICAkZGVhZGxpbmU9KEdldC1EYXRlKS5BZGRTZWNvbmRzKDQ1KQogICR3aW49JG51bGwKICB3aGlsZSgtbm90ICR3aW4gLWFuZCAoR2V0LURhdGUpIC1sdCAkZGVhZGxpbmUpeyR3aW49R2V0LVVsdHJhVmlld2VyV2luZG93O2lmKC1ub3QgJHdpbil7U3RhcnQtU2xlZXAgLU1pbGxpc2Vjb25kcyA1MDB9fQogIGlmKC1ub3QgJHdpbil7IHRocm93ICdUZXRpbmdrYXAgdXRhbWEgVWx0cmFWaWV3ZXIgdGlkYWsgZGlqdW1wYWkuJyB9CgogIGlmKCRjb25zb2xlIC1uZSBbSW50UHRyXTo6WmVybyl7W3ZvaWRdW1VWV2luMzJdOjpTaG93V2luZG93KCRjb25zb2xlLDYpfQogIFt2b2lkXVtVVldpbjMyXTo6U2hvd1dpbmRvdygkd2luLkhhbmRsZSw5KQogIFt2b2lkXVtVVldpbjMyXTo6U2V0Rm9yZWdyb3VuZFdpbmRvdygkd2luLkhhbmRsZSkKICBTdGFydC1TbGVlcCAtU2Vjb25kcyA3CgogICRyPU5ldy1PYmplY3QgVVZXaW4zMitSRUNUCiAgaWYoLW5vdCBbVVZXaW4zMl06OkdldFdpbmRvd1JlY3QoJHdpbi5IYW5kbGUsW3JlZl0k
>> "%HELPER_B64%" echo(cikpe3Rocm93ICdHYWdhbCBtZW1iYWNhIHNhaXogdGV0aW5na2FwIFVsdHJhVmlld2VyLid9CiAgJHc9JHIuUmlnaHQtJHIuTGVmdDsgJGg9JHIuQm90dG9tLSRyLlRvcAogIGlmKCR3IC1sdCAzMDAgLW9yICRoIC1sdCAyMjApe3Rocm93ICgnU2FpeiBVbHRyYVZpZXdlciB0aWRhayBzYWg6ICcrJHcrJ3gnKyRoKX0KCiAgIyAxKSBOYXRpdmUgUHJpbnRXaW5kb3c6IGNhcHR1cmVzIG9ubHkgVWx0cmFWaWV3ZXIgZXZlbiBpZiBhbm90aGVyIHdpbmRvdyBvdmVybGFwcy4KICAkYm1wPU5ldy1PYmplY3QgU3lzdGVtLkRyYXdpbmcuQml0bWFwICR3LCRoLFtTeXN0ZW0uRHJhd2luZy5JbWFnaW5nLlBpeGVsRm9ybWF0XTo6Rm9ybWF0MzJicHBBcmdiCiAgJGc9W1N5c3RlbS5EcmF3aW5nLkdyYXBoaWNzXTo6RnJvbUltYWdlKCRibXApCiAgJGhkYz0kZy5HZXRIZGMoKQogICRvaz0kZmFsc2UKICB0cnkgeyRvaz1bVVZXaW4zMl06OlByaW50V2luZG93KCR3aW4uSGFuZGxlLCRoZGMsMil9IGZpbmFsbHkgeyRnLlJlbGVhc2VIZGMoJGhkYyk7JGcuRGlzcG9zZSgpfQogICRibXAuU2F2ZSgkc2hvdCxbU3lzdGVtLkRyYXdpbmcuSW1hZ2luZy5JbWFnZUZvcm1hdF06OlBuZykKICAkYm1wLkRpc3Bvc2UoKQoKICAjIDIpIFNvbWUgYXBwbGljYXRpb25zIHJldHVybiBhIGJsYW5rIFByaW50V2luZG93
>> "%HELPER_B64%" echo(IGZyYW1lLiBGYWxsIGJhY2sgdG8gZXhhY3Qgc2NyZWVuIHJlY3RhbmdsZS4KICBpZigoLW5vdCAkb2spIC1vciAoLW5vdCAoVGVzdC1JbWFnZVVzZWZ1bCAkc2hvdCkpKXsKICAgIFt2b2lkXVtVVldpbjMyXTo6U2V0Rm9yZWdyb3VuZFdpbmRvdygkd2luLkhhbmRsZSkKICAgIFN0YXJ0LVNsZWVwIC1NaWxsaXNlY29uZHMgNzAwCiAgICAkYm1wPU5ldy1PYmplY3QgU3lzdGVtLkRyYXdpbmcuQml0bWFwICR3LCRoLFtTeXN0ZW0uRHJhd2luZy5JbWFnaW5nLlBpeGVsRm9ybWF0XTo6Rm9ybWF0MzJicHBBcmdiCiAgICAkZz1bU3lzdGVtLkRyYXdpbmcuR3JhcGhpY3NdOjpGcm9tSW1hZ2UoJGJtcCkKICAgIHRyeSB7JGcuQ29weUZyb21TY3JlZW4oJHIuTGVmdCwkci5Ub3AsMCwwLChOZXctT2JqZWN0IFN5c3RlbS5EcmF3aW5nLlNpemUoJHcsJGgpKSxbU3lzdGVtLkRyYXdpbmcuQ29weVBpeGVsT3BlcmF0aW9uXTo6U291cmNlQ29weSl9IGZpbmFsbHkgeyRnLkRpc3Bvc2UoKX0KICAgICRibXAuU2F2ZSgkc2hvdCxbU3lzdGVtLkRyYXdpbmcuSW1hZ2luZy5JbWFnZUZvcm1hdF06OlBuZykKICAgICRibXAuRGlzcG9zZSgpCiAgfQoKICBpZigtbm90IChUZXN0LUltYWdlVXNlZnVsICRzaG90KSl7dGhyb3cgJ1NjcmVlbnNob3QgVWx0cmFWaWV3ZXIgZ2FnYWwgYXRhdSBpbWVqIGtvc29uZy4n
>> "%HELPER_B64%" echo(fQogICRpbWc9W1N5c3RlbS5EcmF3aW5nLkltYWdlXTo6RnJvbUZpbGUoJHNob3QpCiAgdHJ5IHtbU3lzdGVtLldpbmRvd3MuRm9ybXMuQ2xpcGJvYXJkXTo6U2V0SW1hZ2UoJGltZyl9IGZpbmFsbHkgeyRpbWcuRGlzcG9zZSgpfQogIGV4aXQgMAp9IGNhdGNoIHsKICB0cnl7W0lPLkZpbGVdOjpXcml0ZUFsbFRleHQoJGVyciwkXy5FeGNlcHRpb24uTWVzc2FnZSxbVGV4dC5VVEY4RW5jb2RpbmddOjpuZXcoJGZhbHNlKSl9Y2F0Y2h7fQogIGlmKCRjb25zb2xlIC1uZSBbSW50UHRyXTo6WmVybyl7W3ZvaWRdW1VWV2luMzJdOjpTaG93V2luZG93KCRjb25zb2xlLDkpfQogIGV4aXQgMzEKfQo=
exit /b 0

:PAYLOAD_WHATSAPP
> "%HELPER_B64%" echo(JEVycm9yQWN0aW9uUHJlZmVyZW5jZT0nU3RvcCcKQWRkLVR5cGUgLUFzc2VtYmx5TmFtZSBTeXN0ZW0uRHJhd2luZwpBZGQtVHlwZSAtQXNzZW1ibHlOYW1lIFN5c3RlbS5XaW5kb3dzLkZvcm1zCiRzcmM9QCcKdXNpbmcgU3lzdGVtOwp1c2luZyBTeXN0ZW0uVGV4dDsKdXNpbmcgU3lzdGVtLlJ1bnRpbWUuSW50ZXJvcFNlcnZpY2VzOwpwdWJsaWMgc3RhdGljIGNsYXNzIFdBVzMyIHsKICBwdWJsaWMgZGVsZWdhdGUgYm9vbCBFbnVtV2luZG93c1Byb2MoSW50UHRyIGhXbmQsIEludFB0ciBsUGFyYW0pOwogIFtEbGxJbXBvcnQoInVzZXIzMi5kbGwiKV0gcHVibGljIHN0YXRpYyBleHRlcm4gYm9vbCBFbnVtV2luZG93cyhFbnVtV2luZG93c1Byb2MgY2IsIEludFB0ciBscCk7CiAgW0RsbEltcG9ydCgidXNlcjMyLmRsbCIpXSBwdWJsaWMgc3RhdGljIGV4dGVybiBib29sIElzV2luZG93VmlzaWJsZShJbnRQdHIgaFduZCk7CiAgW0RsbEltcG9ydCgidXNlcjMyLmRsbCIpXSBwdWJsaWMgc3RhdGljIGV4dGVybiB1aW50IEdldFdpbmRvd1RocmVhZFByb2Nlc3NJZChJbnRQdHIgaFduZCwgb3V0IHVpbnQgcHJvY2Vzc0lkKTsKICBbRGxsSW1wb3J0KCJ1c2VyMzIuZGxsIiwgQ2hhclNldD1DaGFyU2V0LlVuaWNvZGUpXSBwdWJsaWMgc3RhdGljIGV4dGVybiBpbnQgR2V0V2luZG93VGV4dChJ
>> "%HELPER_B64%" echo(bnRQdHIgaFduZCwgU3RyaW5nQnVpbGRlciBzLCBpbnQgbik7CiAgW0RsbEltcG9ydCgidXNlcjMyLmRsbCIpXSBwdWJsaWMgc3RhdGljIGV4dGVybiBpbnQgR2V0V2luZG93VGV4dExlbmd0aChJbnRQdHIgaFduZCk7CiAgW0RsbEltcG9ydCgidXNlcjMyLmRsbCIpXSBwdWJsaWMgc3RhdGljIGV4dGVybiBib29sIEdldFdpbmRvd1JlY3QoSW50UHRyIGhXbmQsIG91dCBSRUNUIHIpOwogIFtEbGxJbXBvcnQoInVzZXIzMi5kbGwiKV0gcHVibGljIHN0YXRpYyBleHRlcm4gYm9vbCBTaG93V2luZG93KEludFB0ciBoV25kLCBpbnQgY21kKTsKICBbRGxsSW1wb3J0KCJ1c2VyMzIuZGxsIildIHB1YmxpYyBzdGF0aWMgZXh0ZXJuIGJvb2wgU2V0Rm9yZWdyb3VuZFdpbmRvdyhJbnRQdHIgaFduZCk7CiAgW0RsbEltcG9ydCgidXNlcjMyLmRsbCIpXSBwdWJsaWMgc3RhdGljIGV4dGVybiBib29sIFNldEN1cnNvclBvcyhpbnQgWCwgaW50IFkpOwogIFtEbGxJbXBvcnQoInVzZXIzMi5kbGwiKV0gcHVibGljIHN0YXRpYyBleHRlcm4gdm9pZCBtb3VzZV9ldmVudCh1aW50IGZsYWdzLHVpbnQgZHgsdWludCBkeSx1aW50IGRhdGEsVUludFB0ciBleHRyYSk7CiAgW1N0cnVjdExheW91dChMYXlvdXRLaW5kLlNlcXVlbnRpYWwpXSBwdWJsaWMgc3RydWN0IFJFQ1QgeyBwdWJsaWMgaW50IExlZnQ7IHB1
>> "%HELPER_B64%" echo(YmxpYyBpbnQgVG9wOyBwdWJsaWMgaW50IFJpZ2h0OyBwdWJsaWMgaW50IEJvdHRvbTsgfQp9CidACkFkZC1UeXBlIC1UeXBlRGVmaW5pdGlvbiAkc3JjIC1MYW5ndWFnZSBDU2hhcnAKCmZ1bmN0aW9uIEZpbmQtQ2hyb21lIHsKICAkcGF0aHM9QCgiJGVudjpQcm9ncmFtRmlsZXNcR29vZ2xlXENocm9tZVxBcHBsaWNhdGlvblxjaHJvbWUuZXhlIiwiJHtlbnY6UHJvZ3JhbUZpbGVzKHg4Nil9XEdvb2dsZVxDaHJvbWVcQXBwbGljYXRpb25cY2hyb21lLmV4ZSIsIiRlbnY6TE9DQUxBUFBEQVRBXEdvb2dsZVxDaHJvbWVcQXBwbGljYXRpb25cY2hyb21lLmV4ZSIpCiAgZm9yZWFjaCgkcCBpbiAkcGF0aHMpe2lmKCRwIC1hbmQgKFRlc3QtUGF0aCAtTGl0ZXJhbFBhdGggJHApKXtyZXR1cm4gJHB9fQogIHJldHVybiAkbnVsbAp9CmZ1bmN0aW9uIEdldC1XQVdpbmRvdyB7CiAgJGxpc3Q9TmV3LU9iamVjdCBTeXN0ZW0uQ29sbGVjdGlvbnMuQXJyYXlMaXN0CiAgW1dBVzMyXTo6RW51bVdpbmRvd3Moe3BhcmFtKFtJbnRQdHJdJGgsW0ludFB0cl0kbHApCiAgICB0cnl7CiAgICAgIGlmKC1ub3QgW1dBVzMyXTo6SXNXaW5kb3dWaXNpYmxlKCRoKSl7cmV0dXJuICR0cnVlfQogICAgICBbdWludDMyXSRwcm9jSWQ9MDtbdm9pZF1bV0FXMzJdOjpHZXRXaW5kb3dUaHJlYWRQcm9jZXNzSWQoJGgsW3Jl
>> "%HELPER_B64%" echo(Zl0kcHJvY0lkKQogICAgICAkcD1HZXQtUHJvY2VzcyAtSWQgKFtpbnRdJHByb2NJZCkgLUVycm9yQWN0aW9uIFNpbGVudGx5Q29udGludWU7aWYoLW5vdCAkcCl7cmV0dXJuICR0cnVlfQogICAgICBpZigoW3N0cmluZ10kcC5Qcm9jZXNzTmFtZSkgLW5vdG1hdGNoICdeKD9pOmNocm9tZXxtc2VkZ2V8ZmlyZWZveHxicmF2ZSkkJyl7cmV0dXJuICR0cnVlfQogICAgICAkbGVuPVtXQVczMl06OkdldFdpbmRvd1RleHRMZW5ndGgoJGgpOyRzYj1OZXctT2JqZWN0IFN5c3RlbS5UZXh0LlN0cmluZ0J1aWxkZXIgKFtNYXRoXTo6TWF4KDI1NiwkbGVuKzEpKTtbdm9pZF1bV0FXMzJdOjpHZXRXaW5kb3dUZXh0KCRoLCRzYiwkc2IuQ2FwYWNpdHkpOyR0aXRsZT0kc2IuVG9TdHJpbmcoKQogICAgICBpZigkdGl0bGUgLW5vdG1hdGNoICcoP2kpV2hhdHNBcHAnKXtyZXR1cm4gJHRydWV9CiAgICAgICRyPU5ldy1PYmplY3QgV0FXMzIrUkVDVDtpZigtbm90IFtXQVczMl06OkdldFdpbmRvd1JlY3QoJGgsW3JlZl0kcikpe3JldHVybiAkdHJ1ZX07JHc9JHIuUmlnaHQtJHIuTGVmdDskaHQ9JHIuQm90dG9tLSRyLlRvcAogICAgICBpZigkdyAtbHQgNzAwIC1vciAkaHQgLWx0IDUwMCl7cmV0dXJuICR0cnVlfQogICAgICBbdm9pZF0kbGlzdC5BZGQoW3BzY3VzdG9tb2JqZWN0XUB7SGFuZGxlPSRoO1Bp
>> "%HELPER_B64%" echo(ZD0kcHJvY0lkO1JlY3Q9JHI7QXJlYT0kdyokaHQ7VGl0bGU9JHRpdGxlfSkKICAgIH1jYXRjaHt9O3JldHVybiAkdHJ1ZX0sW0ludFB0cl06Olplcm8pfE91dC1OdWxsCiAgJGxpc3R8U29ydC1PYmplY3QgQXJlYSAtRGVzY2VuZGluZ3xTZWxlY3QtT2JqZWN0IC1GaXJzdCAxCn0KZnVuY3Rpb24gV2FpdC1XQShbaW50XSRzZWNvbmRzKXskZW5kPShHZXQtRGF0ZSkuQWRkU2Vjb25kcygkc2Vjb25kcyk7JHc9JG51bGw7d2hpbGUoLW5vdCAkdyAtYW5kIChHZXQtRGF0ZSktbHQgJGVuZCl7JHc9R2V0LVdBV2luZG93O2lmKC1ub3QgJHcpe1N0YXJ0LVNsZWVwIC1NaWxsaXNlY29uZHMgNTAwfX07cmV0dXJuICR3fQpmdW5jdGlvbiBGb2N1cy1Db21wb3Nlcigkd2luKXsKICBbdm9pZF1bV0FXMzJdOjpTaG93V2luZG93KCR3aW4uSGFuZGxlLDkpO1t2b2lkXVtXQVczMl06OlNldEZvcmVncm91bmRXaW5kb3coJHdpbi5IYW5kbGUpCiAgJHNoPU5ldy1PYmplY3QgLUNvbU9iamVjdCBXU2NyaXB0LlNoZWxsO1t2b2lkXSRzaC5BcHBBY3RpdmF0ZShbaW50XSR3aW4uUGlkKTtTdGFydC1TbGVlcCAtTWlsbGlzZWNvbmRzIDgwMAogICRyPU5ldy1PYmplY3QgV0FXMzIrUkVDVDtpZigtbm90IFtXQVczMl06OkdldFdpbmRvd1JlY3QoJHdpbi5IYW5kbGUsW3JlZl0kcikpe3Rocm93ICdHYWdhbCBtZW1i
>> "%HELPER_B64%" echo(YWNhIHNhaXogV2hhdHNBcHAgV2ViLid9CiAgJHdpZHRoPSRyLlJpZ2h0LSRyLkxlZnQ7JHg9W2ludF0oJHIuTGVmdCskd2lkdGgqMC43Myk7JHk9W2ludF0oJHIuQm90dG9tLTcyKQogIFt2b2lkXVtXQVczMl06OlNldEN1cnNvclBvcygkeCwkeSk7W1dBVzMyXTo6bW91c2VfZXZlbnQoMiwwLDAsMCxbVUludFB0cl06Olplcm8pO1tXQVczMl06Om1vdXNlX2V2ZW50KDQsMCwwLDAsW1VJbnRQdHJdOjpaZXJvKTtTdGFydC1TbGVlcCAtTWlsbGlzZWNvbmRzIDYwMAogIHJldHVybiAkc2gKfQokcGhvbmU9JGVudjpBWk9CU1NfV0FfUEhPTkU7JHRleHQ9JGVudjpBWk9CU1NfV0FfVEVYVDskc2hvdD0kZW52OkFaT0JTU19VVl9TQ1JFRU5TSE9UOyRlcnI9JGVudjpBWk9CU1NfV0FfRVJST1IKdHJ5ewogIGlmKCRwaG9uZSAtbmUgJzYwMTEzNTYwMDcyMycpe3Rocm93ICgnTm9tYm9yIFdoYXRzQXBwIHRpZGFrIHNhaDogJyskcGhvbmUpfQogIGlmKC1ub3QgKFRlc3QtUGF0aCAtTGl0ZXJhbFBhdGggJHNob3QpKXt0aHJvdyAnU2NyZWVuc2hvdCBVbHRyYVZpZXdlciBiZWx1bSB3dWp1ZC4nfQogIGlmKChHZXQtSXRlbSAtTGl0ZXJhbFBhdGggJHNob3QpLkxlbmd0aCAtbHQgMTIwMDApe3Rocm93ICdTY3JlZW5zaG90IFVsdHJhVmlld2VyIHRpZGFrIHNhaC90ZXJsYWx1IGtlY2lsLid9CiAgJHVy
>> "%HELPER_B64%" echo(bD0naHR0cHM6Ly93ZWIud2hhdHNhcHAuY29tL3NlbmQ/cGhvbmU9NjAxMTM1NjAwNzIzJwogICRjaHJvbWU9RmluZC1DaHJvbWUKICBpZigkY2hyb21lKXtTdGFydC1Qcm9jZXNzIC1GaWxlUGF0aCAkY2hyb21lIC1Bcmd1bWVudExpc3QgQCgnLS1uZXctd2luZG93JywkdXJsKXxPdXQtTnVsbH1lbHNle1N0YXJ0LVByb2Nlc3MgJHVybHxPdXQtTnVsbH0KICAkd2luPVdhaXQtV0EgNDA7aWYoLW5vdCAkd2luKXt0aHJvdyAnV2hhdHNBcHAgV2ViIHRpZGFrIGRhcGF0IGRpa2VzYW4uIFBhc3Rpa2FuIGN1c3RvbWVyIHN1ZGFoIGxvZ2luIFdoYXRzQXBwIFdlYi4nfQogIFN0YXJ0LVNsZWVwIC1TZWNvbmRzIDkKICAkZnJlc2g9R2V0LVdBV2luZG93O2lmKCRmcmVzaCl7JHdpbj0kZnJlc2h9CiAgJHNoPUZvY3VzLUNvbXBvc2VyICR3aW4KCiAgIyBQdXQgaW1hZ2Ugb24gY2xpcGJvYXJkIGFuZCBwYXN0ZSBpbnRvIFdoYXRzQXBwIGNvbXBvc2VyLgogICRpbWc9W1N5c3RlbS5EcmF3aW5nLkltYWdlXTo6RnJvbUZpbGUoJHNob3QpCiAgdHJ5e1tTeXN0ZW0uV2luZG93cy5Gb3Jtcy5DbGlwYm9hcmRdOjpTZXRJbWFnZSgkaW1nKX1maW5hbGx5eyRpbWcuRGlzcG9zZSgpfQogIFN0YXJ0LVNsZWVwIC1NaWxsaXNlY29uZHMgNTAwCiAgJHNoLlNlbmRLZXlzKCdedicpCiAgU3RhcnQtU2xlZXAgLVNl
>> "%HELPER_B64%" echo(Y29uZHMgNAogICRzaC5TZW5kS2V5cygne0VOVEVSfScpCiAgU3RhcnQtU2xlZXAgLVNlY29uZHMgMwoKICAjIFN1cHBvcnRpbmcgdGV4dC4KICAkc2g9Rm9jdXMtQ29tcG9zZXIgJHdpbgogIFtTeXN0ZW0uV2luZG93cy5Gb3Jtcy5DbGlwYm9hcmRdOjpTZXRUZXh0KCR0ZXh0KQogIFN0YXJ0LVNsZWVwIC1NaWxsaXNlY29uZHMgMzAwCiAgJHNoLlNlbmRLZXlzKCdedicpO1N0YXJ0LVNsZWVwIC1NaWxsaXNlY29uZHMgNzAwOyRzaC5TZW5kS2V5cygne0VOVEVSfScpCiAgZXhpdCAwCn1jYXRjaHsKICB0cnl7W0lPLkZpbGVdOjpXcml0ZUFsbFRleHQoJGVyciwkXy5FeGNlcHRpb24uTWVzc2FnZSxbVGV4dC5VVEY4RW5jb2RpbmddOjpuZXcoJGZhbHNlKSl9Y2F0Y2h7fQogIGV4aXQgNDEKfQo=
exit /b 0
