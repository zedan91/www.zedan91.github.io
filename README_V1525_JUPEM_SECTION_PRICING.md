# Independent JUPEM section price adjustments — 1525

Admin → Users now has independent PA, BM/SBM and Syit Piawai percentages.
GPS keeps the former group field (legacy key `paBm`); Lot Kadaster/C3,
Pelan Akui Awam, Software and CAD Tools retain their own controls.

New profile keys are `pa`, `bmSbm` and `syitPiawai`, with matching direct admin
aliases. When absent, these keys inherit the previous `paBm` rate so existing
account prices remain stable. Explicit zero is an independent original-price
setting, including in the admin duplicate-profile display. Saving writes all
eight validated percentages. No existing live user profile was changed to deploy
this feature; admins can choose the rates in each user's form.

Browser cards/cart calculations, the early cart fallback and both trusted server
checkout paths classify each document by its validated product type. The server
continues to ignore client prices and category hints. Resumed pending bills and
past paid orders retain their amounts. Membership still discounts only Software
and CAD Tools. Base prices, access controls, original-source price audit and all
PC/Upgrade catalogues, photos, PDF files and encrypted records are preserved.

61 targeted tests pass, including legacy migration, separate mixed-cart charges,
save/reload, independent zero, invalid input, pending-payment preservation,
payment verification, original-price admin CORS/auth and PC commerce/publishing.
