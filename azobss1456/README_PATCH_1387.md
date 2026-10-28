# AZOBSS Website Patch v1387

## UltraViewer Remote Support — Clean Customer CMD

- Fix sebenar untuk CMD memaparkan arahan panjang dalam v1386.
- Punca: fail BAT mempunyai UTF-8 BOM sebelum `@echo off`, menyebabkan command echo kekal aktif pada sesetengah CMD/Windows Terminal.
- BAT kini disimpan UTF-8 **tanpa BOM** dengan CRLF Windows.
- Dua lapisan `@echo off` di awal fail.
- Semua panggilan PowerShell panjang turut diprefix `@` supaya command line kekal tersembunyi walaupun echo teraktif semula.
- Output customer kekal hanya tajuk, langkah 1/4–4/4, progress download/install, status screenshot dan WhatsApp.
- Flow UltraViewer, auto latest URL, screenshot window-only dan WhatsApp dari v1386 dikekalkan.
