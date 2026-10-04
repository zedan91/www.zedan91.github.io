@echo off
net stop wuauserv
net stop cryptSvc
net stop bits
net stop msiserver

:: Masukkan balik registry 2036
reg add "HKLM\SOFTWARE\Microsoft\WindowsUpdate\UX\Settings" /v "FlightSettingsMaxPauseDays" /t REG_DWORD /d 4000 /f
reg add "HKLM\SOFTWARE\Microsoft\WindowsUpdate\UX\Settings" /v "PauseUpdatesExpiryTime" /t REG_SZ /d "2036-05-15T10:00:00Z" /f

net start wuauserv
net start cryptSvc
net start bits
net start msiserver
echo Selesai! Sila semak Windows Update sekarang.
pause