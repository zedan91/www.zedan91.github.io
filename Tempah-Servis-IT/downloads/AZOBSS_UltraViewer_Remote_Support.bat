@echo off
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
set "CAP_B64=%TEMP%\AZOBSS_UV_Capture.b64"
set "CAP_PS1=%TEMP%\AZOBSS_UV_Capture.ps1"
set "WA_B64=%TEMP%\AZOBSS_UV_WhatsApp.b64"
set "WA_PS1=%TEMP%\AZOBSS_UV_WhatsApp.ps1"
set "CAP_ERR=%TEMP%\AZOBSS_UV_Capture_Error.txt"

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
for %%F in ("%UV_URL_FILE%" "%UV_PATH_FILE%" "%UV_TEMP%" "%UV_SCREENSHOT%" "%CAP_B64%" "%CAP_PS1%" "%WA_B64%" "%WA_PS1%" "%CAP_ERR%") do del /q %%F >nul 2>&1

:: 1/4 - Find current official installer link
echo [1/4] Menyediakan UltraViewer terkini...
set "AZOBSS_UV_PAGE=%UV_DOWNLOAD_PAGE%"
set "AZOBSS_UV_FALLBACK=%UV_FALLBACK_URL%"
set "AZOBSS_UV_URL_FILE=%UV_URL_FILE%"
@powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop';[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;$page=$env:AZOBSS_UV_PAGE;$fallback=$env:AZOBSS_UV_FALLBACK;$url=$null;try{$r=Invoke-WebRequest -UseBasicParsing -Uri $page -Headers @{'User-Agent'='Mozilla/5.0 AZOBSS-Remote-Support'};foreach($lnk in $r.Links){$h=[string]$lnk.href;if($h -match 'UltraViewer_setup_[0-9.]+_en\.exe'){if($h -match '^https?://'){$url=$h}elseif($h.StartsWith('//')){$url='https:'+$h}else{$url=(New-Object System.Uri((New-Object System.Uri($page)),$h)).AbsoluteUri};break}};if(-not $url){$m=[regex]::Match([string]$r.Content,'UltraViewer_setup_[0-9.]+_en\.exe');if($m.Success){$url='https://dl2.ultraviewer.net/'+$m.Value}}}catch{};if(-not $url){$url=$fallback};[IO.File]::WriteAllText($env:AZOBSS_UV_URL_FILE,$url,[Text.UTF8Encoding]::new($false))" >nul 2>&1
if errorlevel 1 exit /b 10
set "UV_URL="
if exist "%UV_URL_FILE%" set /p "UV_URL="<"%UV_URL_FILE%"
if not defined UV_URL set "UV_URL=%UV_FALLBACK_URL%"
echo       [OK] Sedia.

:: 2/4 - Real download progress + elapsed install progress
echo.
echo [2/4] Memuat turun UltraViewer...
set "AZOBSS_UV_URL=%UV_URL%"
set "AZOBSS_UV_TEMP=%UV_TEMP%"
@powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop';[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;$u=$env:AZOBSS_UV_URL;$o=$env:AZOBSS_UV_TEMP;$req=[Net.HttpWebRequest]::Create($u);$req.UserAgent='Mozilla/5.0 AZOBSS-Remote-Support';$resp=$req.GetResponse();$total=[int64]$resp.ContentLength;$src=$resp.GetResponseStream();$dst=[IO.File]::Open($o,[IO.FileMode]::Create,[IO.FileAccess]::Write,[IO.FileShare]::None);$buf=New-Object byte[] 65536;$done=[int64]0;try{while(($n=$src.Read($buf,0,$buf.Length)) -gt 0){$dst.Write($buf,0,$n);$done+=$n;if($total -gt 0){$pct=[math]::Min(100,[int](($done*100)/$total));$filled=[int]($pct/5);$bar=('='*$filled).PadRight(20,'.');Write-Host -NoNewline (([char]13)+'      Download ['+$bar+'] '+$pct.ToString().PadLeft(3)+'%%  '+('{0:N1}' -f ($done/1MB))+' / '+('{0:N1}' -f ($total/1MB))+' MB')}}}finally{$dst.Close();$src.Close();$resp.Close()};Write-Host '';if((Get-Item -LiteralPath $o).Length -lt 500000){throw 'Invalid installer'}" 
if errorlevel 1 exit /b 11

echo       Memasang UltraViewer...
set "AZOBSS_UV_INSTALLER=%UV_TEMP%"
set "AZOBSS_UV_INSTALL_LOG=%INSTALL_LOG%"
@powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$exe=$env:AZOBSS_UV_INSTALLER;$log=$env:AZOBSS_UV_INSTALL_LOG;$q=[char]34;$args='/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /LOG='+$q+$log+$q;$p=Start-Process -FilePath $exe -ArgumentList $args -PassThru;$sw=[Diagnostics.Stopwatch]::StartNew();$frames=@('|','/','-','\');$i=0;while(-not $p.HasExited){$p.Refresh();$sec=[int]$sw.Elapsed.TotalSeconds;$frame=$frames[$i%%4];$i++;$pos=$sec%%20;$bar=('='*$pos).PadRight(20,'.');Write-Host -NoNewline (([char]13)+'      Installing ['+$bar+'] '+$frame+'  '+$sec+'s');Start-Sleep -Milliseconds 250};Write-Host '';exit $p.ExitCode"
set "INSTALL_RC=%ERRORLEVEL%"
echo [%date% %time%] installer exit=%INSTALL_RC%>>"%LOG%"

call :FIND_ULTRAVIEWER
if not defined UV_EXE (
    "%UV_TEMP%" /NORESTART /LOG="%INSTALL_LOG%" >nul 2>&1
    call :FIND_ULTRAVIEWER
)
if not defined UV_EXE exit /b 21
echo       [OK] UltraViewer siap.

del /q "%UV_TEMP%" "%UV_URL_FILE%" >nul 2>&1

:: 3/4 - Launch and capture UltraViewer window only
echo.
echo [3/4] Membuka UltraViewer...
echo       Menunggu ID dan Password dipaparkan...
start "" "%UV_EXE%"
call :WRITE_CAPTURE_PS
set "AZOBSS_UV_SCREENSHOT=%UV_SCREENSHOT%"
set "AZOBSS_UV_CAPTURE_ERROR=%CAP_ERR%"
@powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File "%CAP_PS1%" >nul 2>>"%LOG%"
set "CAP_RC=%ERRORLEVEL%"
del /q "%CAP_PS1%" >nul 2>&1
if not "%CAP_RC%"=="0" (
    echo       [WARN] Screenshot automatik tidak berjaya.
    if exist "%CAP_ERR%" set /p "CAP_MSG="<"%CAP_ERR%"
    if defined CAP_MSG echo       %CAP_MSG%
    echo [%date% %time%] capture rc=%CAP_RC%>>"%LOG%"
) else (
    echo       [OK] Screenshot UltraViewer berjaya.
)

:: 4/4 - WhatsApp
echo.
echo [4/4] Membuka WhatsApp AZOBSS...
set "AZOBSS_WA_PHONE=%PHONE%"
set "AZOBSS_WA_TEXT=AZOBSS Remote Support - Screenshot UltraViewer dilampirkan. Sila gunakan ID dan Password pada screenshot untuk sesi remote ini."
if "%CAP_RC%"=="0" (
    call :WRITE_WA_PS
    @powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File "%WA_PS1%" >nul 2>>"%LOG%"
    if errorlevel 1 (
        del /q "%WA_PS1%" >nul 2>&1
        start "" "https://wa.me/%PHONE%"
        echo       [WARN] WhatsApp dibuka. Hantar screenshot secara manual jika perlu.
    ) else (
        del /q "%WA_PS1%" >nul 2>&1
        echo       [OK] Screenshot dihantar ke WhatsApp.
    )
) else (
    start "" "https://wa.me/%PHONE%"
    echo       [OK] WhatsApp dibuka.
)

echo.
echo ============================================================
echo   SELESAI - Remote Support sedia digunakan.
echo ============================================================
echo [%date% %time%] DONE>>"%LOG%"
exit /b 0

:FIND_ULTRAVIEWER
set "UV_EXE="
if exist "%ProgramFiles(x86)%\UltraViewer\UltraViewer_Desktop.exe" set "UV_EXE=%ProgramFiles(x86)%\UltraViewer\UltraViewer_Desktop.exe"
if not defined UV_EXE if exist "%ProgramFiles%\UltraViewer\UltraViewer_Desktop.exe" set "UV_EXE=%ProgramFiles%\UltraViewer\UltraViewer_Desktop.exe"
if not defined UV_EXE if exist "%LOCALAPPDATA%\UltraViewer\UltraViewer_Desktop.exe" set "UV_EXE=%LOCALAPPDATA%\UltraViewer\UltraViewer_Desktop.exe"
exit /b 0

:WRITE_CAPTURE_PS
> "%CAP_B64%" echo(JEVycm9yQWN0aW9uUHJlZmVyZW5jZT0nU3RvcCcKQWRkLVR5cGUgLUFzc2VtYmx5TmFtZSBTeXN0ZW0uRHJhd2luZwpBZGQtVHlwZSAtQXNzZW1ibHlOYW1lIFN5c3RlbS5XaW5kb3dzLkZvcm1zCiRjb2RlPUAnCnVzaW5nIFN5c3RlbTsKdXNpbmcgU3lzdGVtLlRleHQ7CnVzaW5nIFN5c3RlbS5SdW50aW1lLkludGVyb3BTZXJ2aWNlczsKcHVibGljIHN0YXRpYyBjbGFzcyBVVk5hdGl2ZSB7CiAgcHVibGljIGRlbGVnYXRlIGJvb2wgRW51bVdpbmRvd3NQcm9jKEludFB0ciBoV25kLCBJbnRQdHIgbFBhcmFtKTsKICBbRGxsSW1wb3J0KCJ1c2VyMzIuZGxsIildIHB1YmxpYyBzdGF0aWMgZXh0ZXJuIGJvb2wgRW51bVdpbmRvd3MoRW51bVdpbmRvd3NQcm9jIGNiLCBJbnRQdHIgbHApOwogIFtEbGxJbXBvcnQoInVzZXIzMi5kbGwiKV0gcHVibGljIHN0YXRpYyBleHRlcm4gYm9vbCBJc1dpbmRvd1Zpc2libGUoSW50UHRyIGhXbmQpOwogIFtEbGxJbXBvcnQoInVzZXIzMi5kbGwiLCBDaGFyU2V0PUNoYXJTZXQuVW5pY29kZSldIHB1YmxpYyBzdGF0aWMgZXh0ZXJuIGludCBHZXRXaW5kb3dUZXh0KEludFB0ciBoV25kLCBTdHJpbmdCdWlsZGVyIHMsIGludCBuKTsKICBbRGxsSW1wb3J0KCJ1c2VyMzIuZGxsIildIHB1YmxpYyBzdGF0aWMgZXh0ZXJuIGludCBHZXRXaW5kb3dUZXh0TGVuZ3Ro
>> "%CAP_B64%" echo(KEludFB0ciBoV25kKTsKICBbRGxsSW1wb3J0KCJ1c2VyMzIuZGxsIildIHB1YmxpYyBzdGF0aWMgZXh0ZXJuIHVpbnQgR2V0V2luZG93VGhyZWFkUHJvY2Vzc0lkKEludFB0ciBoV25kLCBvdXQgdWludCBwcm9jZXNzSWQpOwogIFtEbGxJbXBvcnQoInVzZXIzMi5kbGwiKV0gcHVibGljIHN0YXRpYyBleHRlcm4gYm9vbCBHZXRXaW5kb3dSZWN0KEludFB0ciBoV25kLCBvdXQgUkVDVCByKTsKICBbRGxsSW1wb3J0KCJ1c2VyMzIuZGxsIildIHB1YmxpYyBzdGF0aWMgZXh0ZXJuIGJvb2wgU2hvd1dpbmRvdyhJbnRQdHIgaFduZCwgaW50IGNtZCk7CiAgW0RsbEltcG9ydCgidXNlcjMyLmRsbCIpXSBwdWJsaWMgc3RhdGljIGV4dGVybiBib29sIFNldEZvcmVncm91bmRXaW5kb3coSW50UHRyIGhXbmQpOwogIFtEbGxJbXBvcnQoInVzZXIzMi5kbGwiKV0gcHVibGljIHN0YXRpYyBleHRlcm4gSW50UHRyIEdldENvbnNvbGVXaW5kb3coKTsKICBbU3RydWN0TGF5b3V0KExheW91dEtpbmQuU2VxdWVudGlhbCldIHB1YmxpYyBzdHJ1Y3QgUkVDVCB7IHB1YmxpYyBpbnQgTGVmdDsgcHVibGljIGludCBUb3A7IHB1YmxpYyBpbnQgUmlnaHQ7IHB1YmxpYyBpbnQgQm90dG9tOyB9Cn0KJ0AKQWRkLVR5cGUgLVR5cGVEZWZpbml0aW9uICRjb2RlIC1MYW5ndWFnZSBDU2hhcnAKCmZ1bmN0aW9uIEdldC1V
>> "%CAP_B64%" echo(bHRyYVZpZXdlcldpbmRvdyB7CiAgJGxpc3Q9TmV3LU9iamVjdCBTeXN0ZW0uQ29sbGVjdGlvbnMuQXJyYXlMaXN0CiAgW1VWTmF0aXZlXTo6RW51bVdpbmRvd3MoewogICAgcGFyYW0oW0ludFB0cl0kaCxbSW50UHRyXSRscCkKICAgIHRyeSB7CiAgICAgIGlmKC1ub3QgW1VWTmF0aXZlXTo6SXNXaW5kb3dWaXNpYmxlKCRoKSl7IHJldHVybiAkdHJ1ZSB9CiAgICAgICRsZW49W1VWTmF0aXZlXTo6R2V0V2luZG93VGV4dExlbmd0aCgkaCkKICAgICAgJHNiPU5ldy1PYmplY3QgU3lzdGVtLlRleHQuU3RyaW5nQnVpbGRlciAoW01hdGhdOjpNYXgoMjU2LCRsZW4rMSkpCiAgICAgIFt2b2lkXVtVVk5hdGl2ZV06OkdldFdpbmRvd1RleHQoJGgsJHNiLCRzYi5DYXBhY2l0eSkKICAgICAgJHRpdGxlPSRzYi5Ub1N0cmluZygpCgogICAgICBbdWludDMyXSRwcm9jSWQ9MAogICAgICBbdm9pZF1bVVZOYXRpdmVdOjpHZXRXaW5kb3dUaHJlYWRQcm9jZXNzSWQoJGgsW3JlZl0kcHJvY0lkKQogICAgICAkcHJvYz1HZXQtUHJvY2VzcyAtSWQgKFtpbnRdJHByb2NJZCkgLUVycm9yQWN0aW9uIFNpbGVudGx5Q29udGludWUKICAgICAgJHByb2NOYW1lPWlmKCRwcm9jKXtbc3RyaW5nXSRwcm9jLlByb2Nlc3NOYW1lfWVsc2V7Jyd9CgogICAgICBpZigkdGl0bGUgLW5vdG1hdGNoICcoP2kpVWx0cmFWaWV3
>> "%CAP_B64%" echo(ZXInIC1hbmQgJHByb2NOYW1lIC1ub3RtYXRjaCAnKD9pKV5VbHRyYVZpZXdlcicpeyByZXR1cm4gJHRydWUgfQoKICAgICAgJHI9TmV3LU9iamVjdCBVVk5hdGl2ZStSRUNUCiAgICAgIGlmKC1ub3QgW1VWTmF0aXZlXTo6R2V0V2luZG93UmVjdCgkaCxbcmVmXSRyKSl7IHJldHVybiAkdHJ1ZSB9CiAgICAgICR3PSRyLlJpZ2h0LSRyLkxlZnQKICAgICAgJGh0PSRyLkJvdHRvbS0kci5Ub3AKICAgICAgaWYoJHcgLWx0IDMwMCAtb3IgJGh0IC1sdCAyMjApeyByZXR1cm4gJHRydWUgfQoKICAgICAgW3ZvaWRdJGxpc3QuQWRkKFtwc2N1c3RvbW9iamVjdF1AewogICAgICAgIEhhbmRsZT0kaDsgVGl0bGU9JHRpdGxlOyBXPSR3OyBIPSRodDsgQXJlYT0kdyokaHQ7CiAgICAgICAgTGVmdD0kci5MZWZ0OyBUb3A9JHIuVG9wOyBQcm9jZXNzPSRwcm9jTmFtZQogICAgICB9KQogICAgfSBjYXRjaCB7fQogICAgcmV0dXJuICR0cnVlCiAgfSxbSW50UHRyXTo6WmVybykgfCBPdXQtTnVsbAoKICAkbGlzdCB8IFNvcnQtT2JqZWN0IEFyZWEgLURlc2NlbmRpbmcgfCBTZWxlY3QtT2JqZWN0IC1GaXJzdCAxCn0KCiRjb25zb2xlPVtVVk5hdGl2ZV06OkdldENvbnNvbGVXaW5kb3coKQp0cnkgewogICRkZWFkbGluZT0oR2V0LURhdGUpLkFkZFNlY29uZHMoNDApCiAgJHdpbj0kbnVsbAogIHdoaWxlKC1u
>> "%CAP_B64%" echo(b3QgJHdpbiAtYW5kIChHZXQtRGF0ZSkgLWx0ICRkZWFkbGluZSl7CiAgICAkd2luPUdldC1VbHRyYVZpZXdlcldpbmRvdwogICAgaWYoLW5vdCAkd2luKXsgU3RhcnQtU2xlZXAgLU1pbGxpc2Vjb25kcyA1MDAgfQogIH0KICBpZigtbm90ICR3aW4peyB0aHJvdyAnVWx0cmFWaWV3ZXIgbWFpbiB3aW5kb3cgdGlkYWsgZGlqdW1wYWkuJyB9CgogIGlmKCRjb25zb2xlIC1uZSBbSW50UHRyXTo6WmVybyl7IFt2b2lkXVtVVk5hdGl2ZV06OlNob3dXaW5kb3coJGNvbnNvbGUsNikgfQogIFt2b2lkXVtVVk5hdGl2ZV06OlNob3dXaW5kb3coJHdpbi5IYW5kbGUsOSkKICBbdm9pZF1bVVZOYXRpdmVdOjpTZXRGb3JlZ3JvdW5kV2luZG93KCR3aW4uSGFuZGxlKQoKICAjIEdpdmUgVWx0cmFWaWV3ZXIgdGltZSB0byBwb3B1bGF0ZSBJRCBhbmQgUGFzc3dvcmQuCiAgU3RhcnQtU2xlZXAgLVNlY29uZHMgNwoKICAjIFJlZnJlc2ggZXhhY3Qgd2luZG93IHJlY3RhbmdsZSBhZnRlciByZXN0b3JlL2ZvcmVncm91bmQuCiAgJHI9TmV3LU9iamVjdCBVVk5hdGl2ZStSRUNUCiAgaWYoLW5vdCBbVVZOYXRpdmVdOjpHZXRXaW5kb3dSZWN0KCR3aW4uSGFuZGxlLFtyZWZdJHIpKXsgdGhyb3cgJ0dldFdpbmRvd1JlY3QgZ2FnYWwuJyB9CiAgJHc9JHIuUmlnaHQtJHIuTGVmdAogICRoPSRyLkJvdHRvbS0kci5U
>> "%CAP_B64%" echo(b3AKICBpZigkdyAtbHQgMzAwIC1vciAkaCAtbHQgMjIwKXsgdGhyb3cgKCdTYWl6IFVsdHJhVmlld2VyIHRpZGFrIHNhaDogJyskdysneCcrJGgpIH0KCiAgJGJtcD1OZXctT2JqZWN0IFN5c3RlbS5EcmF3aW5nLkJpdG1hcCAkdywkaCxbU3lzdGVtLkRyYXdpbmcuSW1hZ2luZy5QaXhlbEZvcm1hdF06OkZvcm1hdDMyYnBwQXJnYgogICRnPVtTeXN0ZW0uRHJhd2luZy5HcmFwaGljc106OkZyb21JbWFnZSgkYm1wKQogIHRyeSB7CiAgICAkZy5Db3B5RnJvbVNjcmVlbigkci5MZWZ0LCRyLlRvcCwwLDAsKE5ldy1PYmplY3QgU3lzdGVtLkRyYXdpbmcuU2l6ZSgkdywkaCkpLFtTeXN0ZW0uRHJhd2luZy5Db3B5UGl4ZWxPcGVyYXRpb25dOjpTb3VyY2VDb3B5KQogIH0gZmluYWxseSB7CiAgICAkZy5EaXNwb3NlKCkKICB9CgogICRibXAuU2F2ZSgkZW52OkFaT0JTU19VVl9TQ1JFRU5TSE9ULFtTeXN0ZW0uRHJhd2luZy5JbWFnaW5nLkltYWdlRm9ybWF0XTo6UG5nKQogIFtTeXN0ZW0uV2luZG93cy5Gb3Jtcy5DbGlwYm9hcmRdOjpTZXRJbWFnZSgkYm1wKQogICRibXAuRGlzcG9zZSgpCgogIGlmKC1ub3QgKFRlc3QtUGF0aCAtTGl0ZXJhbFBhdGggJGVudjpBWk9CU1NfVVZfU0NSRUVOU0hPVCkpeyB0aHJvdyAnRmFpbCBzY3JlZW5zaG90IHRpZGFrIHRlcmhhc2lsLicgfQogIGlmKChHZXQt
>> "%CAP_B64%" echo(SXRlbSAtTGl0ZXJhbFBhdGggJGVudjpBWk9CU1NfVVZfU0NSRUVOU0hPVCkuTGVuZ3RoIC1sdCAxMDAwMCl7IHRocm93ICdGYWlsIHNjcmVlbnNob3QgdGVybGFsdSBrZWNpbC4nIH0KCiAgZXhpdCAwCn0gY2F0Y2ggewogIHRyeSB7IFtJTy5GaWxlXTo6V3JpdGVBbGxUZXh0KCRlbnY6QVpPQlNTX1VWX0NBUFRVUkVfRVJST1IsJF8uRXhjZXB0aW9uLk1lc3NhZ2UpIH0gY2F0Y2gge30KICBpZigkY29uc29sZSAtbmUgW0ludFB0cl06Olplcm8peyBbdm9pZF1bVVZOYXRpdmVdOjpTaG93V2luZG93KCRjb25zb2xlLDkpIH0KICBleGl0IDMxCn0K
set "AZOBSS_HELPER_B64=%CAP_B64%"
set "AZOBSS_HELPER_PS1=%CAP_PS1%"
@powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$s=(Get-Content -Raw $env:AZOBSS_HELPER_B64) -replace '\s','';[IO.File]::WriteAllBytes($env:AZOBSS_HELPER_PS1,[Convert]::FromBase64String($s))" >nul 2>&1
del /q "%CAP_B64%" >nul 2>&1
exit /b 0

:WRITE_WA_PS
> "%WA_B64%" echo(JEVycm9yQWN0aW9uUHJlZmVyZW5jZT0nU3RvcCcKQWRkLVR5cGUgLUFzc2VtYmx5TmFtZSBTeXN0ZW0uRHJhd2luZwpBZGQtVHlwZSAtQXNzZW1ibHlOYW1lIFN5c3RlbS5XaW5kb3dzLkZvcm1zCiRjb2RlPUAnCnVzaW5nIFN5c3RlbTsKdXNpbmcgU3lzdGVtLlRleHQ7CnVzaW5nIFN5c3RlbS5SdW50aW1lLkludGVyb3BTZXJ2aWNlczsKcHVibGljIHN0YXRpYyBjbGFzcyBXQVdpbiB7CiAgcHVibGljIGRlbGVnYXRlIGJvb2wgRW51bVdpbmRvd3NQcm9jKEludFB0ciBoV25kLCBJbnRQdHIgbFBhcmFtKTsKICBbRGxsSW1wb3J0KCJ1c2VyMzIuZGxsIildIHB1YmxpYyBzdGF0aWMgZXh0ZXJuIGJvb2wgRW51bVdpbmRvd3MoRW51bVdpbmRvd3NQcm9jIGNiLCBJbnRQdHIgbHApOwogIFtEbGxJbXBvcnQoInVzZXIzMi5kbGwiKV0gcHVibGljIHN0YXRpYyBleHRlcm4gYm9vbCBJc1dpbmRvd1Zpc2libGUoSW50UHRyIGhXbmQpOwogIFtEbGxJbXBvcnQoInVzZXIzMi5kbGwiLCBDaGFyU2V0PUNoYXJTZXQuVW5pY29kZSldIHB1YmxpYyBzdGF0aWMgZXh0ZXJuIGludCBHZXRXaW5kb3dUZXh0KEludFB0ciBoV25kLCBTdHJpbmdCdWlsZGVyIHMsIGludCBuKTsKICBbRGxsSW1wb3J0KCJ1c2VyMzIuZGxsIildIHB1YmxpYyBzdGF0aWMgZXh0ZXJuIGludCBHZXRXaW5kb3dUZXh0TGVuZ3RoKElu
>> "%WA_B64%" echo(dFB0ciBoV25kKTsKICBbRGxsSW1wb3J0KCJ1c2VyMzIuZGxsIildIHB1YmxpYyBzdGF0aWMgZXh0ZXJuIGJvb2wgR2V0V2luZG93UmVjdChJbnRQdHIgaFduZCwgb3V0IFJFQ1Qgcik7CiAgW0RsbEltcG9ydCgidXNlcjMyLmRsbCIpXSBwdWJsaWMgc3RhdGljIGV4dGVybiBib29sIFNob3dXaW5kb3coSW50UHRyIGhXbmQsIGludCBjbWQpOwogIFtEbGxJbXBvcnQoInVzZXIzMi5kbGwiKV0gcHVibGljIHN0YXRpYyBleHRlcm4gYm9vbCBTZXRGb3JlZ3JvdW5kV2luZG93KEludFB0ciBoV25kKTsKICBbRGxsSW1wb3J0KCJ1c2VyMzIuZGxsIildIHB1YmxpYyBzdGF0aWMgZXh0ZXJuIGJvb2wgU2V0Q3Vyc29yUG9zKGludCBYLCBpbnQgWSk7CiAgW0RsbEltcG9ydCgidXNlcjMyLmRsbCIpXSBwdWJsaWMgc3RhdGljIGV4dGVybiB2b2lkIG1vdXNlX2V2ZW50KHVpbnQgZmxhZ3MsIHVpbnQgZHgsIHVpbnQgZHksIHVpbnQgZGF0YSwgVUludFB0ciBleHRyYSk7CiAgW1N0cnVjdExheW91dChMYXlvdXRLaW5kLlNlcXVlbnRpYWwpXSBwdWJsaWMgc3RydWN0IFJFQ1QgeyBwdWJsaWMgaW50IExlZnQ7IHB1YmxpYyBpbnQgVG9wOyBwdWJsaWMgaW50IFJpZ2h0OyBwdWJsaWMgaW50IEJvdHRvbTsgfQp9CidACkFkZC1UeXBlIC1UeXBlRGVmaW5pdGlvbiAkY29kZSAtTGFuZ3VhZ2UgQ1NoYXJwCgpm
>> "%WA_B64%" echo(dW5jdGlvbiBHZXQtV2hhdHNBcHBXaW5kb3cgewogICRsaXN0PU5ldy1PYmplY3QgU3lzdGVtLkNvbGxlY3Rpb25zLkFycmF5TGlzdAogIFtXQVdpbl06OkVudW1XaW5kb3dzKHsKICAgIHBhcmFtKFtJbnRQdHJdJGgsW0ludFB0cl0kbHApCiAgICB0cnkgewogICAgICBpZigtbm90IFtXQVdpbl06OklzV2luZG93VmlzaWJsZSgkaCkpeyByZXR1cm4gJHRydWUgfQogICAgICAkbGVuPVtXQVdpbl06OkdldFdpbmRvd1RleHRMZW5ndGgoJGgpCiAgICAgIGlmKCRsZW4gLWxlIDApeyByZXR1cm4gJHRydWUgfQogICAgICAkc2I9TmV3LU9iamVjdCBTeXN0ZW0uVGV4dC5TdHJpbmdCdWlsZGVyIChbTWF0aF06Ok1heCgyNTYsJGxlbisxKSkKICAgICAgW3ZvaWRdW1dBV2luXTo6R2V0V2luZG93VGV4dCgkaCwkc2IsJHNiLkNhcGFjaXR5KQogICAgICAkdGl0bGU9JHNiLlRvU3RyaW5nKCkKICAgICAgaWYoJHRpdGxlIC1ub3RtYXRjaCAnKD9pKVdoYXRzQXBwJyl7IHJldHVybiAkdHJ1ZSB9CiAgICAgICRyPU5ldy1PYmplY3QgV0FXaW4rUkVDVAogICAgICBpZigtbm90IFtXQVdpbl06OkdldFdpbmRvd1JlY3QoJGgsW3JlZl0kcikpeyByZXR1cm4gJHRydWUgfQogICAgICAkdz0kci5SaWdodC0kci5MZWZ0OyAkaHQ9JHIuQm90dG9tLSRyLlRvcAogICAgICBpZigkdyAtbHQgNTAwIC1vciAkaHQg
>> "%WA_B64%" echo(LWx0IDQwMCl7IHJldHVybiAkdHJ1ZSB9CiAgICAgIFt2b2lkXSRsaXN0LkFkZChbcHNjdXN0b21vYmplY3RdQHtIYW5kbGU9JGg7VGl0bGU9JHRpdGxlO0FyZWE9JHcqJGh0O0xlZnQ9JHIuTGVmdDtUb3A9JHIuVG9wO1JpZ2h0PSRyLlJpZ2h0O0JvdHRvbT0kci5Cb3R0b219KQogICAgfSBjYXRjaCB7fQogICAgcmV0dXJuICR0cnVlCiAgfSxbSW50UHRyXTo6WmVybykgfCBPdXQtTnVsbAogICRsaXN0IHwgU29ydC1PYmplY3QgQXJlYSAtRGVzY2VuZGluZyB8IFNlbGVjdC1PYmplY3QgLUZpcnN0IDEKfQoKZnVuY3Rpb24gV2FpdC1XaGF0c0FwcFdpbmRvdyhbaW50XSRzZWNvbmRzKXsKICAkZGVhZGxpbmU9KEdldC1EYXRlKS5BZGRTZWNvbmRzKCRzZWNvbmRzKQogICR3aW49JG51bGwKICB3aGlsZSgtbm90ICR3aW4gLWFuZCAoR2V0LURhdGUpIC1sdCAkZGVhZGxpbmUpewogICAgJHdpbj1HZXQtV2hhdHNBcHBXaW5kb3cKICAgIGlmKC1ub3QgJHdpbil7IFN0YXJ0LVNsZWVwIC1NaWxsaXNlY29uZHMgNTAwIH0KICB9CiAgcmV0dXJuICR3aW4KfQoKZnVuY3Rpb24gRm9jdXMtQ2hhdEJveCgkd2luKXsKICBbdm9pZF1bV0FXaW5dOjpTaG93V2luZG93KCR3aW4uSGFuZGxlLDkpCiAgW3ZvaWRdW1dBV2luXTo6U2V0Rm9yZWdyb3VuZFdpbmRvdygkd2luLkhhbmRsZSkKICBTdGFydC1TbGVl
>> "%WA_B64%" echo(cCAtTWlsbGlzZWNvbmRzIDkwMAoKICAkcj1OZXctT2JqZWN0IFdBV2luK1JFQ1QKICBpZihbV0FXaW5dOjpHZXRXaW5kb3dSZWN0KCR3aW4uSGFuZGxlLFtyZWZdJHIpKXsKICAgICR4PVtpbnRdKCgkci5MZWZ0KyRyLlJpZ2h0KS8yKQogICAgJHk9W2ludF0oJHIuQm90dG9tLTc1KQogICAgW3ZvaWRdW1dBV2luXTo6U2V0Q3Vyc29yUG9zKCR4LCR5KQogICAgW1dBV2luXTo6bW91c2VfZXZlbnQoMHgwMDAyLDAsMCwwLFtVSW50UHRyXTo6WmVybykKICAgIFtXQVdpbl06Om1vdXNlX2V2ZW50KDB4MDAwNCwwLDAsMCxbVUludFB0cl06Olplcm8pCiAgICBTdGFydC1TbGVlcCAtTWlsbGlzZWNvbmRzIDUwMAogIH0KfQoKJHBob25lPSRlbnY6QVpPQlNTX1dBX1BIT05FCiR0ZXh0PSRlbnY6QVpPQlNTX1dBX1RFWFQKJHNob3Q9JGVudjpBWk9CU1NfVVZfU0NSRUVOU0hPVAppZigtbm90IChUZXN0LVBhdGggLUxpdGVyYWxQYXRoICRzaG90KSl7IHRocm93ICdTY3JlZW5zaG90IHRpZGFrIGRpanVtcGFpLicgfQoKIyBQcmVmZXIgV2hhdHNBcHAgRGVza3RvcC4gSWYgaXQgZG9lcyBub3QgYXBwZWFyLCBmYWxsIGJhY2sgdG8gV2hhdHNBcHAgV2ViLgp0cnkgeyBTdGFydC1Qcm9jZXNzICgnd2hhdHNhcHA6Ly9zZW5kP3Bob25lPScrJHBob25lKSB9IGNhdGNoIHt9CiR3aW49V2FpdC1XaGF0c0Fw
>> "%WA_B64%" echo(cFdpbmRvdyAxMgppZigtbm90ICR3aW4pewogIFN0YXJ0LVByb2Nlc3MgKCdodHRwczovL3dlYi53aGF0c2FwcC5jb20vc2VuZD9waG9uZT0nKyRwaG9uZSkKICAkd2luPVdhaXQtV2hhdHNBcHBXaW5kb3cgMzAKfQppZigtbm90ICR3aW4peyB0aHJvdyAnVGV0aW5na2FwIFdoYXRzQXBwIHRpZGFrIGRpanVtcGFpLicgfQoKIyBQYXN0ZSBhbmQgc2VuZCBzY3JlZW5zaG90LgpGb2N1cy1DaGF0Qm94ICR3aW4KJGltZz1bU3lzdGVtLkRyYXdpbmcuSW1hZ2VdOjpGcm9tRmlsZSgkc2hvdCkKdHJ5IHsgW1N5c3RlbS5XaW5kb3dzLkZvcm1zLkNsaXBib2FyZF06OlNldEltYWdlKCRpbWcpIH0gZmluYWxseSB7ICRpbWcuRGlzcG9zZSgpIH0KU3RhcnQtU2xlZXAgLU1pbGxpc2Vjb25kcyA0MDAKJHdzPU5ldy1PYmplY3QgLUNvbU9iamVjdCBXU2NyaXB0LlNoZWxsCiR3cy5TZW5kS2V5cygnXnYnKQpTdGFydC1TbGVlcCAtU2Vjb25kcyAzCiR3cy5TZW5kS2V5cygne0VOVEVSfScpClN0YXJ0LVNsZWVwIC1TZWNvbmRzIDIKCiMgVGhlbiBzZW5kIHRoZSBzdXBwb3J0IHRleHQuCkZvY3VzLUNoYXRCb3ggJHdpbgpbU3lzdGVtLldpbmRvd3MuRm9ybXMuQ2xpcGJvYXJkXTo6U2V0VGV4dCgkdGV4dCkKJHdzLlNlbmRLZXlzKCdedicpClN0YXJ0LVNsZWVwIC1NaWxsaXNlY29uZHMgNzAwCiR3cy5TZW5k
>> "%WA_B64%" echo(S2V5cygne0VOVEVSfScpCmV4aXQgMAo=
set "AZOBSS_HELPER_B64=%WA_B64%"
set "AZOBSS_HELPER_PS1=%WA_PS1%"
@powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$s=(Get-Content -Raw $env:AZOBSS_HELPER_B64) -replace '\s','';[IO.File]::WriteAllBytes($env:AZOBSS_HELPER_PS1,[Convert]::FromBase64String($s))" >nul 2>&1
del /q "%WA_B64%" >nul 2>&1
exit /b 0
