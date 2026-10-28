# AZOBSS v1254 — PA Table Cart Classic-Bridge Hard Fix

## Isu
Butang troli biru dalam PA > Carian Umum masih boleh ditekan tetapi `Troli Anda` kekal 0 item.

## Punca sebenar
Hard-fix v1253 masih berada di dalam `azobss-pabm-storefront.js`, iaitu ES module yang perlu menyelesaikan import Firebase dan modul pelarasan harga terlebih dahulu. Jika module itu belum siap/terhalang ketika jadual PA sudah interaktif, capture handler cart belum pernah didaftarkan. `azobss-pabm-early-bridge.js` pula hanya menunggu API module tersebut, jadi ia bukan fallback cart sebenar.

## Fix v1254
- `azobss-pabm-early-bridge.js` kini menjadi pemilik awal (classic script, bukan ES module) untuk semua butang cart table PA/BM/SBM/GPS/Syit.
- Klik ADD/REMOVE terus menulis ke localStorage cart yang sama (`azobss_pabm_store_cart_v1_*`) dan terus render `Troli Anda` tanpa menunggu Firebase/module.
- `window.azobssAddToPaBmCart()` kini ada fallback local cart sebenar serta-merta.
- Storefront module mengesan early owner dan tidak memasang handler table kedua.
- Storefront tetap mengambil alih render/price adjustment/check-out selepas module siap.
- Dynamic-import fallback dalam global auth dibump ke v1254.
- Semua cache PA/BM v1253 dibump ke v1254.

Tiada perubahan pada UI negeri, harga asas, data PA, atau flow failed/cancelled payment.
