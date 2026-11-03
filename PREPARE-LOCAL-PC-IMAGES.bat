@echo off
setlocal
cd /d "%~dp0"
echo ============================================================
echo AZOBSS v1504 - PREPARE FINAL HARDWARE IMAGES (WINDOWS NATIVE)
echo G1 PC Builds kekal. G2 Hardware Shop: 14 gambar exact lokal.
echo Tidak memerlukan Node.js.
echo ============================================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\prepare-hardware-images-v1504.ps1"
set ERR=%ERRORLEVEL%
if not "%ERR%"=="0" (
  echo.
  echo [BELUM SIAP] Gambar hardware belum berjaya disediakan.
  echo Semak mesej di atas kemudian jalankan BAT ini semula.
  pause
  exit /b %ERR%
)
echo.
echo SIAP. Upload ZIP yang ada perkataan HARDWARE-EXACT-LOCAL-FINAL.
echo JANGAN upload ZIP PREPARER terus ke GitHub.
pause
endlocal
