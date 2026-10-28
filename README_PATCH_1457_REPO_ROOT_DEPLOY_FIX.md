# AZOBSS v1457 — Repository Root Deploy Fix

- Based fully on v1456.
- No customer-facing feature changes.
- ZIP structure is flattened so `index.html`, `backend/`, `assets/`, etc. are at the archive root.
- This keeps Render Root Directory as `backend` and prevents `Root directory 'backend' does not exist`.
- Preserves v1456 SSM details on Quotation / Invoice / Receipt, v1455 website footer SSM, Liyabudun 1.0.51, Software Tools Pin Order, and PA/BM download auto-reset + anti-spam.
