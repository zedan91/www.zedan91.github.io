# AZOBSS Patch 961

## Lot Map guide label positioning

- Cross-guide labels now show only the centre-to-side distance.
- Horizontal label is placed exactly halfway from centre to the right edge and sits above the horizontal guide line.
- Vertical label is placed exactly halfway from centre to the top edge and is rendered as a complete rotated label beside the vertical guide line.
- Replaced the Leaflet tooltip implementation with a DivIcon to prevent vertical values from being clipped.
- Guide text increased to 13px bold for clearer reading.
- Works for both Petak and Bulatan.
- No backend, pricing, selection, payment or CAD converter changes.
