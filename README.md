# AZOBSS Build 184

Base: (183)-AZOBSS-TOYYIBPAY-CALLBACK-VERIFY-LOG-SAFE-FIX_20260617.zip

Patch 184 adds paid-order idempotency guards for ToyyibPay callback/verify flow. It prevents duplicate finalize, duplicate commission sync, duplicate PA/BM paid sync, and duplicate download email when callback + verify endpoint run close together.

No Firebase Rules update required.
