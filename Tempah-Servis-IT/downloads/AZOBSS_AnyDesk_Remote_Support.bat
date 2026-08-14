@echo off
setlocal EnableExtensions
title AnyDesk Clean Reinstall

set "DOWNLOAD_URL=https://download.anydesk.com/AnyDesk.exe"
set "INSTALLER=%TEMP%\AnyDesk-latest.exe"
set "INSTALL_DIR=%ProgramFiles(x86)%\AnyDesk"
set "DRIVER_WARNING=0"

if not defined ProgramFiles(x86) set "INSTALL_DIR=%ProgramFiles%\AnyDesk"

fltmc >nul 2>&1
if errorlevel 1 (
    echo Meminta kebenaran Administrator...
    powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo ============================================================
echo              ANYDESK CLEAN REINSTALL
echo ============================================================
echo.
echo AMARAN:
echo - AnyDesk akan dihentikan dan dibuang.
echo - Tetapan, ID dan Alias dalam %%APPDATA%%\AnyDesk akan dipadam.
echo - Semua fail yang boleh dipadam dalam %%TEMP%% akan dibuang.
echo - Jangan jalankan melalui sesi remote AnyDesk yang sedang aktif.
echo.
echo Tekan CTRL+C sekarang untuk batal.
timeout /t 8 /nobreak >nul

echo.
echo [1/8] Mengesan fail AnyDesk yang dipasang...
set "ANYDESK_EXE="
if exist "%ProgramFiles(x86)%\AnyDesk\AnyDesk.exe" set "ANYDESK_EXE=%ProgramFiles(x86)%\AnyDesk\AnyDesk.exe"
if not defined ANYDESK_EXE if exist "%ProgramFiles%\AnyDesk\AnyDesk.exe" set "ANYDESK_EXE=%ProgramFiles%\AnyDesk\AnyDesk.exe"

echo [2/8] Menghentikan process dan service AnyDesk...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
 "$ErrorActionPreference='SilentlyContinue';" ^
 "Get-Process | Where-Object { $_.ProcessName -like '*AnyDesk*' } | Stop-Process -Force;" ^
 "$names=Get-CimInstance Win32_Service | Where-Object { $_.Name -like '*AnyDesk*' -or $_.DisplayName -like '*AnyDesk*' -or $_.PathName -match 'AnyDesk' } | Select-Object -ExpandProperty Name -Unique;" ^
 "foreach($name in $names){ Stop-Service -Name $name -Force -ErrorAction SilentlyContinue }"

echo [3/8] Membuang pemasangan AnyDesk lama...
if defined ANYDESK_EXE (
    start "" /wait "%ANYDESK_EXE%" --silent --remove
) else (
    echo AnyDesk standard tidak dijumpai dalam Program Files. Langkah uninstall dilangkau.
)

timeout /t 3 /nobreak >nul
taskkill /f /im AnyDesk.exe /t >nul 2>&1
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
 "$ErrorActionPreference='SilentlyContinue';" ^
 "Get-Service | Where-Object { $_.Name -like '*AnyDesk*' -or $_.DisplayName -like '*AnyDesk*' } | Stop-Service -Force"

echo [4/8] Memadam data pengguna %%APPDATA%%\AnyDesk...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
 "$path=Join-Path $env:APPDATA 'AnyDesk';" ^
 "if(Test-Path -LiteralPath $path){ Remove-Item -LiteralPath $path -Recurse -Force -ErrorAction Stop; Write-Host ('Dipadam: '+$path) } else { Write-Host ('Tidak dijumpai: '+$path) }"
if errorlevel 1 echo AMARAN: Sebahagian data Roaming AnyDesk mungkin tidak dapat dipadam.

echo [5/8] Membuang AnyDesk print driver dan baki DriverStore...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
 "$ErrorActionPreference='Continue';" ^
 "$drivers=Get-WindowsDriver -Online | Where-Object { [IO.Path]::GetFileName($_.OriginalFileName) -ieq 'anydeskprintdriver.inf' };" ^
 "foreach($driver in $drivers){ Write-Host ('Membuang driver package: '+$driver.Driver); & pnputil.exe /delete-driver $driver.Driver /uninstall /force };" ^
 "$repo=Join-Path $env:windir 'System32\DriverStore\FileRepository';" ^
 "$folders=Get-ChildItem -LiteralPath $repo -Directory -Filter 'anydeskprintdriver.inf_amd64*' -ErrorAction SilentlyContinue;" ^
 "foreach($folder in $folders){ Write-Host ('Mengambil alih dan memadam: '+$folder.FullName); & takeown.exe /f $folder.FullName /a /r /d y | Out-Null; & icacls.exe $folder.FullName /grant '*S-1-5-32-544:(OI)(CI)F' /t /c /q | Out-Null; & attrib.exe -r ($folder.FullName+'\*') /s /d 2>$null; Remove-Item -LiteralPath $folder.FullName -Recurse -Force -ErrorAction SilentlyContinue };" ^
 "$left=Get-ChildItem -LiteralPath $repo -Directory -Filter 'anydeskprintdriver.inf_amd64*' -ErrorAction SilentlyContinue;" ^
 "if($left){ Write-Host 'AMARAN: Folder driver masih digunakan atau gagal dipadam.' -ForegroundColor Yellow; $left.FullName | ForEach-Object { Write-Host $_ }; exit 1 }"
if errorlevel 1 set "DRIVER_WARNING=1"

echo [6/8] Membersihkan kandungan %%TEMP%%...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
 "$ErrorActionPreference='SilentlyContinue';" ^
 "Get-ChildItem -LiteralPath $env:TEMP -Force | Remove-Item -Recurse -Force;" ^
 "Write-Host ('Selesai membersihkan: '+$env:TEMP)"

echo [7/8] Memuat turun AnyDesk terbaru daripada laman rasmi...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
 "$ErrorActionPreference='Stop';" ^
 "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;" ^
 "Invoke-WebRequest -Uri '%DOWNLOAD_URL%' -OutFile '%INSTALLER%';" ^
 "$signature=Get-AuthenticodeSignature -FilePath '%INSTALLER%';" ^
 "if($signature.Status -ne 'Valid'){ throw ('Tandatangan digital tidak sah: '+$signature.Status) };" ^
 "$publisher=$signature.SignerCertificate.Subject;" ^
 "if($publisher -notmatch 'AnyDesk|philandro'){ throw ('Penerbit tidak dikenali: '+$publisher) };" ^
 "Write-Host ('Tandatangan digital sah: '+$publisher)"
if errorlevel 1 goto DOWNLOAD_FAILED

echo [8/8] Memasang AnyDesk baru...
start "" /wait "%INSTALLER%" --install "%INSTALL_DIR%" --start-with-win --create-shortcuts --create-desktop-icon --silent
if errorlevel 1 goto INSTALL_FAILED

del /f /q "%INSTALLER%" >nul 2>&1
if exist "%INSTALL_DIR%\AnyDesk.exe" start "" "%INSTALL_DIR%\AnyDesk.exe"

echo.
echo ============================================================
echo BERJAYA: AnyDesk telah dibersihkan dan dipasang semula.
if "%DRIVER_WARNING%"=="1" echo AMARAN: Baki print driver mungkin memerlukan restart Windows.
echo ============================================================
pause
exit /b 0

:DOWNLOAD_FAILED
del /f /q "%INSTALLER%" >nul 2>&1
echo.
echo GAGAL: AnyDesk tidak dapat dimuat turun atau tandatangan digital gagal disahkan.
echo Semak sambungan Internet dan cuba lagi.
pause
exit /b 1

:INSTALL_FAILED
del /f /q "%INSTALLER%" >nul 2>&1
echo.
echo GAGAL: Pemasangan AnyDesk baru tidak berjaya.
pause
exit /b 1
