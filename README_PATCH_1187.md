# AZOBSS v1187 — Shared PC Glow Reliability Fix

- Fix share-link highlight yang sebelum ini boleh berlaku ketika kad masih di luar viewport.
- Shared PC kini scroll ke tengah viewport dahulu, kemudian effect bermula apabila kad benar-benar kelihatan.
- Border cyan/blue/purple lebih terang dan persistent sepanjang `?pc=<build-id>` berada dalam URL.
- Tambah glow frame, animated halo, image light sweep, title glow dan badge `PC dari link share`.
- Effect state dikekalkan walaupun live-price refresh menyebabkan kad dirender semula.
- Fallback timer memastikan effect tetap bermula jika IntersectionObserver tidak trigger.
- `prefers-reduced-motion` masih dihormati; border/glow statik tetap kelihatan.
