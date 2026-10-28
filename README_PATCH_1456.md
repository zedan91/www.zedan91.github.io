# AZOBSS v1456 - Quotation / Invoice / Receipt SSM Identity

Baseline: v1455.

Changes:
- Added legal business identity to the shared Quotation / Invoice / Receipt PDF generator.
- Header now shows `AZOBSS ENTERPRISE | SSM: 202603287983 (CT0171167-W)` beneath the AZOBSS website line.
- Footer now shows `AZOBSS ENTERPRISE | SSM: 202603287983 (CT0171167-W) | www.azobss.com`.
- Applies consistently to Quotation, Invoice and Receipt because all three use the same PDF renderer.
- No owner IC, residential address or other personal information is shown.
- Global badge/cache version bumped to v1456; admin PDF asset cache-bust bumped to v1456.
- All v1455 functionality remains unchanged.
