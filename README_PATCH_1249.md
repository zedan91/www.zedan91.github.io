# AZOBSS v1249 - PA/BM storefront init regression fix

This patch is intentionally narrow. It keeps all v1248 Pending Payment / Tambah Semula behaviour, but removes the regression introduced when the PA/BM storefront waited for the asynchronous user price-adjustment lookup before binding its UI.

## Fixed
- `Tambah Terus ke Troli` / Add to Cart handlers are bound immediately on page init.
- The current button-grid `Pilih Negeri` UI is restored immediately; the legacy raw `<select>` is no longer left visible while price adjustment is loading.
- User price adjustment now refreshes in the background and re-renders prices/cart once ready.
- Pending Payment `Tambah Semula` / resume-payment fixes from v1248 remain unchanged.

No PA/BM product flow, state list, pricing formula, or other page layout was intentionally changed.
