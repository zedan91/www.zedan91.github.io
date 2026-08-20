# AZOBSS Patch 796

Baseline: patch 795.

Perubahan pada `/Tempah-Servis-IT/`:
- membetulkan panel **Ringkasan Tempahan** yang tidak benar-benar mengikut skrol pada sesetengah pelayar;
- menambah `summary-rail` yang mengekalkan ruang sidebar setinggi borang;
- menggunakan fallback JavaScript untuk menukar panel kepada `position: fixed` selepas panel sampai di bawah stickybar;
- panel akan kembali berlabuh di hujung borang supaya tidak menindih footer;
- paparan ringkasan terapung telefon daripada patch 795 dikekalkan.
