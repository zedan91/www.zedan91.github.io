@echo off
reg add "HKCU\Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\InprocServer32" /f /ve
powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('Selesai. Sila restart PC untuk effect Windows 10 right-click menu.', 'AZOBSS Windows Tweaks', 'OK', 'Information')"
echo Selesai. Sila restart PC untuk effect.
pause