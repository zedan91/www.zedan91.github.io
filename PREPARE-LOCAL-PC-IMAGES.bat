@echo off
setlocal
cd /d "%~dp0"
echo ============================================================
echo AZOBSS v1502 - PREPARE LOCAL PC BUILD IMAGES
ECHO ============================================================
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js tidak dijumpai. Install Node.js 18+ dahulu.
  pause
  exit /b 1
)
node "tools\localize-pc-build-images-v1502.cjs"
set ERR=%ERRORLEVEL%
if not "%ERR%"=="0" (
  echo.
  echo Proses belum lengkap. Jalankan fail ini sekali lagi selepas semak internet.
  pause
  exit /b %ERR%
)
echo.
echo SIAP. Semua gambar PC Build sudah berada dalam folder website.
echo ZIP deployment v1502 telah dihasilkan satu folder di atas folder website ini.
pause
endlocal
