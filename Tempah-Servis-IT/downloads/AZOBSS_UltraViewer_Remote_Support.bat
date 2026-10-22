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
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop';[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;$page=$env:AZOBSS_UV_PAGE;$fallback=$env:AZOBSS_UV_FALLBACK;$url=$null;try{$r=Invoke-WebRequest -UseBasicParsing -Uri $page -Headers @{'User-Agent'='Mozilla/5.0 AZOBSS-Remote-Support'};foreach($lnk in $r.Links){$h=[string]$lnk.href;if($h -match 'UltraViewer_setup_[0-9.]+_en\.exe'){if($h -match '^https?://'){$url=$h}elseif($h.StartsWith('//')){$url='https:'+$h}else{$url=(New-Object System.Uri((New-Object System.Uri($page)),$h)).AbsoluteUri};break}};if(-not $url){$m=[regex]::Match([string]$r.Content,'UltraViewer_setup_[0-9.]+_en\.exe');if($m.Success){$url='https://dl2.ultraviewer.net/'+$m.Value}}}catch{};if(-not $url){$url=$fallback};[IO.File]::WriteAllText($env:AZOBSS_UV_URL_FILE,$url,[Text.UTF8Encoding]::new($false))" >nul 2>&1
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
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop';[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;$u=$env:AZOBSS_UV_URL;$o=$env:AZOBSS_UV_TEMP;$req=[Net.HttpWebRequest]::Create($u);$req.UserAgent='Mozilla/5.0 AZOBSS-Remote-Support';$resp=$req.GetResponse();$total=[int64]$resp.ContentLength;$src=$resp.GetResponseStream();$dst=[IO.File]::Open($o,[IO.FileMode]::Create,[IO.FileAccess]::Write,[IO.FileShare]::None);$buf=New-Object byte[] 65536;$done=[int64]0;try{while(($n=$src.Read($buf,0,$buf.Length)) -gt 0){$dst.Write($buf,0,$n);$done+=$n;if($total -gt 0){$pct=[math]::Min(100,[int](($done*100)/$total));$filled=[int]($pct/5);$bar=('='*$filled).PadRight(20,'.');Write-Host -NoNewline (([char]13)+'      Download ['+$bar+'] '+$pct.ToString().PadLeft(3)+'%%  '+('{0:N1}' -f ($done/1MB))+' / '+('{0:N1}' -f ($total/1MB))+' MB')}}}finally{$dst.Close();$src.Close();$resp.Close()};Write-Host '';if((Get-Item -LiteralPath $o).Length -lt 500000){throw 'Invalid installer'}" 
if errorlevel 1 exit /b 11

echo       Memasang UltraViewer...
set "AZOBSS_UV_INSTALLER=%UV_TEMP%"
set "AZOBSS_UV_INSTALL_LOG=%INSTALL_LOG%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$exe=$env:AZOBSS_UV_INSTALLER;$log=$env:AZOBSS_UV_INSTALL_LOG;$q=[char]34;$args='/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /LOG='+$q+$log+$q;$p=Start-Process -FilePath $exe -ArgumentList $args -PassThru;$sw=[Diagnostics.Stopwatch]::StartNew();$frames=@('|','/','-','\');$i=0;while(-not $p.HasExited){$p.Refresh();$sec=[int]$sw.Elapsed.TotalSeconds;$frame=$frames[$i%%4];$i++;$pos=$sec%%20;$bar=('='*$pos).PadRight(20,'.');Write-Host -NoNewline (([char]13)+'      Installing ['+$bar+'] '+$frame+'  '+$sec+'s');Start-Sleep -Milliseconds 250};Write-Host '';exit $p.ExitCode"
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
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File "%CAP_PS1%" >nul 2>>"%LOG%"
set "CAP_RC=%ERRORLEVEL%"
del /q "%CAP_PS1%" >nul 2>&1
if not "%CAP_RC%"=="0" (
    echo       [WARN] Screenshot automatik tidak berjaya.
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
    powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File "%WA_PS1%" >nul 2>>"%LOG%"
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
> "%CAP_B64%" echo(JEVycm9yQWN0aW9uUHJlZmVyZW5jZT0nU3RvcCcKQWRkLVR5cGUgLUFzc2VtYmx5TmFtZSBTeXN0ZW0uRHJhd2luZwpBZGQtVHlwZSAtQXNzZW1ibHlOYW1lIFN5c3RlbS5XaW5kb3dzLkZvcm1zCiRjb2RlPUAnCnVzaW5nIFN5c3RlbTsKdXNpbmcgU3lzdGVtLlRleHQ7CnVzaW5nIFN5c3RlbS5SdW50aW1lLkludGVyb3BTZXJ2aWNlczsKcHVibGljIHN0YXRpYyBjbGFzcyBVVk5hdGl2ZSB7CiAgcHVibGljIGRlbGVnYXRlIGJvb2wgRW51bVdpbmRvd3NQcm9jKEludFB0ciBoV25kLCBJbnRQdHIgbFBhcmFtKTsKICBbRGxsSW1wb3J0KCJ1c2VyMzIuZGxsIildIHB1YmxpYyBzdGF0aWMgZXh0ZXJuIGJvb2wgRW51bVdpbmRvd3MoRW51bVdpbmRvd3NQcm9jIGNiLCBJbnRQdHIgbHApOwogIFtEbGxJbXBvcnQoInVzZXIzMi5kbGwiKV0gcHVibGljIHN0YXRpYyBleHRlcm4gYm9vbCBJc1dpbmRvd1Zpc2libGUoSW50UHRyIGhXbmQpOwogIFtEbGxJbXBvcnQoInVzZXIzMi5kbGwiLCBDaGFyU2V0PUNoYXJTZXQuVW5pY29kZSldIHB1YmxpYyBzdGF0aWMgZXh0ZXJuIGludCBHZXRXaW5kb3dUZXh0KEludFB0ciBoV25kLCBTdHJpbmdCdWlsZGVyIHMsIGludCBuKTsKICBbRGxsSW1wb3J0KCJ1c2VyMzIuZGxsIildIHB1YmxpYyBzdGF0aWMgZXh0ZXJuIGludCBHZXRXaW5kb3dUZXh0TGVuZ3RoKEludFB0ciBoV25kKTsKICBbRGxsSW1wb3J0KCJ1c2VyMzIuZGxsIildIHB1YmxpYyBzdGF0aWMgZXh0ZXJuIHVpbnQgR2V0V2luZG93VGhyZWFkUHJvY2Vzc0lkKEludFB0ciBoV25kLCBvdXQgdWludCBwaWQpOwogIFtEbGxJbXBvcnQoInVzZXIzMi5kbGwiKV0gcHVibGljIHN0YXRpYyBleHRlcm4gYm9vbCBHZXRXaW5kb3dSZWN0KEludFB0ciBoV25kLCBvdXQgUkVDVCByKTsKICBbRGxsSW1wb3J0KCJ1c2VyMzIuZGxsIildIHB1YmxpYyBzdGF0aWMgZXh0ZXJuIGJvb2wgU2hvd1dpbmRvdyhJbnRQdHIgaFduZCwgaW50IGNtZCk7CiAgW0RsbEltcG9ydCgidXNlcjMyLmRsbCIpXSBwdWJsaWMgc3RhdGljIGV4dGVybiBib29sIFNldEZvcmVncm91bmRXaW5kb3coSW50UHRyIGhXbmQpOwogIFtEbGxJbXBvcnQoInVzZXIzMi5kbGwiKV0gcHVibGljIHN0YXRpYyBleHRlcm4gSW50UHRyIEdldENvbnNvbGVXaW5kb3coKTsKICBbRGxsSW1wb3J0KCJ1c2VyMzIuZGxsIildIHB1YmxpYyBzdGF0aWMgZXh0ZXJuIGJvb2wgUHJpbnRXaW5kb3coSW50UHRyIGhXbmQsIEludFB0ciBoZGMsIHVpbnQgZmxhZ3MpOwogIFtTdHJ1Y3RMYXlvdXQoTGF5b3V0S2luZC5TZXF1ZW50aWFsKV0gcHVibGljIHN0cnVjdCBSRUNUIHsgcHVibGljIGludCBMZWZ0OyBwdWJsaWMgaW50IFRvcDsgcHVibGljIGlu
>> "%CAP_B64%" echo(dCBSaWdodDsgcHVibGljIGludCBCb3R0b207IH0KfQonQApBZGQtVHlwZSAtVHlwZURlZmluaXRpb24gJGNvZGUgLUxhbmd1YWdlIENTaGFycAoKZnVuY3Rpb24gR2V0LVVsdHJhVmlld2VyV2luZG93IHsKICAkbGlzdD1OZXctT2JqZWN0IFN5c3RlbS5Db2xsZWN0aW9ucy5BcnJheUxpc3QKICBbVVZOYXRpdmVdOjpFbnVtV2luZG93cyh7CiAgICBwYXJhbShbSW50UHRyXSRoLFtJbnRQdHJdJGxwKQogICAgdHJ5IHsKICAgICAgaWYoLW5vdCBbVVZOYXRpdmVdOjpJc1dpbmRvd1Zpc2libGUoJGgpKXsgcmV0dXJuICR0cnVlIH0KICAgICAgJGxlbj1bVVZOYXRpdmVdOjpHZXRXaW5kb3dUZXh0TGVuZ3RoKCRoKQogICAgICAkc2I9TmV3LU9iamVjdCBTeXN0ZW0uVGV4dC5TdHJpbmdCdWlsZGVyIChbTWF0aF06Ok1heCgyNTYsJGxlbisxKSkKICAgICAgW3ZvaWRdW1VWTmF0aXZlXTo6R2V0V2luZG93VGV4dCgkaCwkc2IsJHNiLkNhcGFjaXR5KQogICAgICAkdGl0bGU9JHNiLlRvU3RyaW5nKCkKICAgICAgW3VpbnQzMl0kcGlkPTA7IFt2b2lkXVtVVk5hdGl2ZV06OkdldFdpbmRvd1RocmVhZFByb2Nlc3NJZCgkaCxbcmVmXSRwaWQpCiAgICAgICRwPUdldC1Qcm9jZXNzIC1JZCAoW2ludF0kcGlkKSAtRXJyb3JBY3Rpb24gU2lsZW50bHlDb250aW51ZQogICAgICAkcG49aWYoJHApe1tzdHJpbmddJHAuUHJvY2Vzc05hbWV9ZWxzZXsnJ30KICAgICAgaWYoJHRpdGxlIC1ub3RtYXRjaCAnKD9pKVVsdHJhVmlld2VyJyAtYW5kICRwbiAtbm90bWF0Y2ggJyg/aSleVWx0cmFWaWV3ZXInKXsgcmV0dXJuICR0cnVlIH0KICAgICAgJHI9TmV3LU9iamVjdCBVVk5hdGl2ZStSRUNUCiAgICAgIGlmKC1ub3QgW1VWTmF0aXZlXTo6R2V0V2luZG93UmVjdCgkaCxbcmVmXSRyKSl7IHJldHVybiAkdHJ1ZSB9CiAgICAgICR3PSRyLlJpZ2h0LSRyLkxlZnQ7ICRodD0kci5Cb3R0b20tJHIuVG9wCiAgICAgIGlmKCR3IC1sdCAzMDAgLW9yICRodCAtbHQgMjIwKXsgcmV0dXJuICR0cnVlIH0KICAgICAgW3ZvaWRdJGxpc3QuQWRkKFtwc2N1c3RvbW9iamVjdF1Ae0hhbmRsZT0kaDtUaXRsZT0kdGl0bGU7Vz0kdztIPSRodDtBcmVhPSR3KiRodH0pCiAgICB9IGNhdGNoIHt9CiAgICByZXR1cm4gJHRydWUKICB9LFtJbnRQdHJdOjpaZXJvKSB8IE91dC1OdWxsCiAgJGxpc3QgfCBTb3J0LU9iamVjdCBBcmVhIC1EZXNjZW5kaW5nIHwgU2VsZWN0LU9iamVjdCAtRmlyc3QgMQp9CgokY29uc29sZT1bVVZOYXRpdmVdOjpHZXRDb25zb2xlV2luZG93KCkKJG9rPSRmYWxzZQp0cnkgewogICRkZWFkbGluZT0oR2V0LURhdGUpLkFkZFNlY29uZHMoMzUpCiAgJHdpbj0kbnVsbAogIHdoaWxlKC1ub3QgJHdpbiAt
>> "%CAP_B64%" echo(YW5kIChHZXQtRGF0ZSkgLWx0ICRkZWFkbGluZSl7CiAgICAkd2luPUdldC1VbHRyYVZpZXdlcldpbmRvdwogICAgaWYoLW5vdCAkd2luKXsgU3RhcnQtU2xlZXAgLU1pbGxpc2Vjb25kcyA1MDAgfQogIH0KICBpZigtbm90ICR3aW4peyB0aHJvdyAnVWx0cmFWaWV3ZXIgd2luZG93IG5vdCBmb3VuZCcgfQoKICBpZigkY29uc29sZSAtbmUgW0ludFB0cl06Olplcm8peyBbdm9pZF1bVVZOYXRpdmVdOjpTaG93V2luZG93KCRjb25zb2xlLDYpIH0KICBbdm9pZF1bVVZOYXRpdmVdOjpTaG93V2luZG93KCR3aW4uSGFuZGxlLDkpCiAgW3ZvaWRdW1VWTmF0aXZlXTo6U2V0Rm9yZWdyb3VuZFdpbmRvdygkd2luLkhhbmRsZSkKCiAgIyBBbGxvdyBVbHRyYVZpZXdlciBuZXR3b3JrL3Nlc3Npb24gZmllbGRzIChJRCArIFBhc3N3b3JkKSB0byBwb3B1bGF0ZS4KICBTdGFydC1TbGVlcCAtU2Vjb25kcyA2CgogICRyPU5ldy1PYmplY3QgVVZOYXRpdmUrUkVDVAogIGlmKC1ub3QgW1VWTmF0aXZlXTo6R2V0V2luZG93UmVjdCgkd2luLkhhbmRsZSxbcmVmXSRyKSl7IHRocm93ICdHZXRXaW5kb3dSZWN0IGZhaWxlZCcgfQogICR3PSRyLlJpZ2h0LSRyLkxlZnQ7ICRoPSRyLkJvdHRvbS0kci5Ub3AKICBpZigkdyAtbHQgMzAwIC1vciAkaCAtbHQgMjIwKXsgdGhyb3cgJ0ludmFsaWQgVWx0cmFWaWV3ZXIgd2luZG93IHNpemUnIH0KCiAgJGJtcD1OZXctT2JqZWN0IFN5c3RlbS5EcmF3aW5nLkJpdG1hcCAkdywkaCxbU3lzdGVtLkRyYXdpbmcuSW1hZ2luZy5QaXhlbEZvcm1hdF06OkZvcm1hdDMyYnBwQXJnYgogICRnPVtTeXN0ZW0uRHJhd2luZy5HcmFwaGljc106OkZyb21JbWFnZSgkYm1wKQogICRoZGM9JGcuR2V0SGRjKCkKICB0cnkgeyAkcHJpbnRlZD1bVVZOYXRpdmVdOjpQcmludFdpbmRvdygkd2luLkhhbmRsZSwkaGRjLDIpIH0gZmluYWxseSB7ICRnLlJlbGVhc2VIZGMoJGhkYykgfQogIGlmKC1ub3QgJHByaW50ZWQpewogICAgIyBGYWxsYmFjazogVWx0cmFWaWV3ZXIgaXMgZm9yZWdyb3VuZCBhbmQgQ01EIGlzIG1pbmltaXplZCwgc28gc2NyZWVuIGNvcHkgc3RpbGwgY2FwdHVyZXMgb25seSBpdHMgcmVjdGFuZ2xlLgogICAgJGcuQ29weUZyb21TY3JlZW4oJHIuTGVmdCwkci5Ub3AsMCwwLChOZXctT2JqZWN0IFN5c3RlbS5EcmF3aW5nLlNpemUoJHcsJGgpKSxbU3lzdGVtLkRyYXdpbmcuQ29weVBpeGVsT3BlcmF0aW9uXTo6U291cmNlQ29weSkKICB9CiAgJGcuRGlzcG9zZSgpCiAgJGJtcC5TYXZlKCRlbnY6QVpPQlNTX1VWX1NDUkVFTlNIT1QsW1N5c3RlbS5EcmF3aW5nLkltYWdpbmcuSW1hZ2VGb3JtYXRdOjpQbmcpCiAgW1N5c3RlbS5XaW5kb3dzLkZvcm1zLkNsaXBib2Fy
>> "%CAP_B64%" echo(ZF06OlNldEltYWdlKCRibXApCiAgJGJtcC5EaXNwb3NlKCkKICBpZigtbm90IChUZXN0LVBhdGggLUxpdGVyYWxQYXRoICRlbnY6QVpPQlNTX1VWX1NDUkVFTlNIT1QpKXsgdGhyb3cgJ1NjcmVlbnNob3QgZmlsZSBub3QgY3JlYXRlZCcgfQogICRvaz0kdHJ1ZQogIGV4aXQgMAp9IGNhdGNoIHsKICB0cnkgeyBbSU8uRmlsZV06OldyaXRlQWxsVGV4dCgkZW52OkFaT0JTU19VVl9DQVBUVVJFX0VSUk9SLCRfLkV4Y2VwdGlvbi5NZXNzYWdlKSB9IGNhdGNoIHt9CiAgaWYoJGNvbnNvbGUgLW5lIFtJbnRQdHJdOjpaZXJvKXsgW3ZvaWRdW1VWTmF0aXZlXTo6U2hvd1dpbmRvdygkY29uc29sZSw5KSB9CiAgZXhpdCAzMQp9Cg==
set "AZOBSS_HELPER_B64=%CAP_B64%"
set "AZOBSS_HELPER_PS1=%CAP_PS1%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$s=(Get-Content -Raw $env:AZOBSS_HELPER_B64) -replace '\s','';[IO.File]::WriteAllBytes($env:AZOBSS_HELPER_PS1,[Convert]::FromBase64String($s))" >nul 2>&1
del /q "%CAP_B64%" >nul 2>&1
exit /b 0

:WRITE_WA_PS
> "%WA_B64%" echo(JEVycm9yQWN0aW9uUHJlZmVyZW5jZT0nU3RvcCcKQWRkLVR5cGUgLUFzc2VtYmx5TmFtZSBTeXN0ZW0uRHJhd2luZwpBZGQtVHlwZSAtQXNzZW1ibHlOYW1lIFN5c3RlbS5XaW5kb3dzLkZvcm1zCiRwaG9uZT0kZW52OkFaT0JTU19XQV9QSE9ORQokdGV4dD0kZW52OkFaT0JTU19XQV9URVhUCiRzaG90PSRlbnY6QVpPQlNTX1VWX1NDUkVFTlNIT1QKJHdzPU5ldy1PYmplY3QgLUNvbU9iamVjdCBXU2NyaXB0LlNoZWxsCmlmKC1ub3QgKFRlc3QtUGF0aCAtTGl0ZXJhbFBhdGggJHNob3QpKXsgdGhyb3cgJ1NjcmVlbnNob3QgbWlzc2luZycgfQokaW1nPVtTeXN0ZW0uRHJhd2luZy5JbWFnZV06OkZyb21GaWxlKCRzaG90KQp0cnkgeyBbU3lzdGVtLldpbmRvd3MuRm9ybXMuQ2xpcGJvYXJkXTo6U2V0SW1hZ2UoJGltZykgfSBmaW5hbGx5IHsgJGltZy5EaXNwb3NlKCkgfQp0cnkgeyBTdGFydC1Qcm9jZXNzICgnd2hhdHNhcHA6Ly9zZW5kP3Bob25lPScrJHBob25lKSB9IGNhdGNoIHsgU3RhcnQtUHJvY2VzcyAoJ2h0dHBzOi8vd2ViLndoYXRzYXBwLmNvbS9zZW5kP3Bob25lPScrJHBob25lKSB9ClN0YXJ0LVNsZWVwIC1TZWNvbmRzIDYKJGFjdGl2YXRlZD0kZmFsc2UKZm9yZWFjaCgkbmFtZSBpbiBAKCdXaGF0c0FwcCcsJ1doYXRzQXBwIFdlYicpKXsgdHJ5IHsgaWYoJHdzLkFwcEFjdGl2YXRlKCRuYW1lKSl7ICRhY3RpdmF0ZWQ9JHRydWU7IGJyZWFrIH0gfSBjYXRjaCB7fSB9CmlmKC1ub3QgJGFjdGl2YXRlZCl7CiAgdHJ5IHsgU3RhcnQtUHJvY2VzcyAoJ2h0dHBzOi8vd2ViLndoYXRzYXBwLmNvbS9zZW5kP3Bob25lPScrJHBob25lKSB9IGNhdGNoIHt9CiAgU3RhcnQtU2xlZXAgLVNlY29uZHMgNgogIGZvcmVhY2goJG5hbWUgaW4gQCgnV2hhdHNBcHAnLCdXaGF0c0FwcCBXZWInKSl7IHRyeSB7IGlmKCR3cy5BcHBBY3RpdmF0ZSgkbmFtZSkpeyAkYWN0aXZhdGVkPSR0cnVlOyBicmVhayB9IH0gY2F0Y2gge30gfQp9CmlmKC1ub3QgJGFjdGl2YXRlZCl7IHRocm93ICdXaGF0c0FwcCB3aW5kb3cgbm90IGZvY3VzZWQnIH0KU3RhcnQtU2xlZXAgLU1pbGxpc2Vjb25kcyA2MDAKJHdzLlNlbmRLZXlzKCdedicpClN0YXJ0LVNsZWVwIC1TZWNvbmRzIDIKJHdzLlNlbmRLZXlzKCd7RU5URVJ9JykKU3RhcnQtU2xlZXAgLVNlY29uZHMgMgpbU3lzdGVtLldpbmRvd3MuRm9ybXMuQ2xpcGJvYXJkXTo6U2V0VGV4dCgkdGV4dCkKJHdzLlNlbmRLZXlzKCdedicpClN0YXJ0LVNsZWVwIC1NaWxsaXNlY29uZHMgNzAwCiR3cy5TZW5kS2V5cygne0VOVEVSfScpCmV4aXQgMAo=
set "AZOBSS_HELPER_B64=%WA_B64%"
set "AZOBSS_HELPER_PS1=%WA_PS1%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$s=(Get-Content -Raw $env:AZOBSS_HELPER_B64) -replace '\s','';[IO.File]::WriteAllBytes($env:AZOBSS_HELPER_PS1,[Convert]::FromBase64String($s))" >nul 2>&1
del /q "%WA_B64%" >nul 2>&1
exit /b 0

