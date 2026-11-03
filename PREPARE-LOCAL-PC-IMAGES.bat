@echo off
setlocal
cd /d "%~dp0"
echo ============================================================
echo AZOBSS v1503 - PREPARE FINAL LOCAL IMAGES
echo G1 PC Builds dikekalkan. G2 Hardware Shop: 14 gambar exact.
echo ============================================================
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js tidak dijumpai. Install Node.js 18+ dahulu.
  pause
  exit /b 1
)
node "tools\prepare-hardware-images-v1503.cjs"
set ERR=%ERRORLEVEL%
if not "%ERR%"=="0" (
  echo.
  echo [BELUM SIAP] Semak internet dan jalankan BAT ini sekali lagi.
  pause
  exit /b %ERR%
)
echo.
echo SIAP. Upload ZIP yang ada perkataan HARDWARE-EXACT-LOCAL-FINAL.
echo JANGAN upload ZIP PREPARER terus ke GitHub.
pause
endlocal
