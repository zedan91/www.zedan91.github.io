@echo off
setlocal
cd /d "%~dp0"
echo ============================================================
echo AZOBSS v1503 - PREPARE 14 EXACT HARDWARE SHOP IMAGES
echo G1 PC Builds tidak akan diubah.
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
  echo [BELUM SIAP] Semak internet dan jalankan sekali lagi.
  pause
  exit /b %ERR%
)
echo.
echo SIAP. Gunakan ZIP yang ada perkataan HARDWARE-EXACT-LOCAL-FINAL.
echo JANGAN upload ZIP PREPARER ini terus ke GitHub.
pause
endlocal
