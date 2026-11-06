# Release 1523 — Source-price browser requests and Upgrade product images

The confirmed cause of the original-price failures on Upgrade Parts and PC Build
was the source-price handler answering browser OPTIONS preflight with 403 before
the browser could send its authenticated GET. The handler now delegates OPTIONS
to the existing global CORS responder. Actual GETs still require a verified admin.
No source cost or PDF is returned in a preflight response.

The eight products shown in the reported Upgrade Parts grid now have individually
matched, visually inspected original product images: MINIX NR660 LP, Windows 11
Home and Pro, Server 2016 Essentials, Microsoft 365 Personal, Family and Business
Standard, and Office Home 2024. The i5-12400F viewer uses an image showing that
specific CPU, not an Intel Ultra model. Images are copied unaltered; retailer logos
are not erased or cropped. Provenance and hashes are retained in Verification
outside public Source.

The Upgrade image viewer now contains only its product image, product title and
close control. The unwanted category-photo sentence and the replacement helper
paragraph are removed. PC Build image presentation is unchanged. Original Viewnet
source data, costs, IDs, option labels, selling prices, checkout and orders remain
unchanged. The previous admin-session restoration/retry fixes are retained.
