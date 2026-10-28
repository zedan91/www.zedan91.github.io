# AZDM: adjustable 2+ PC plans

| Term | 1 PC | 2+ PCs, price per PC |
| --- | ---: | ---: |
| 1 Year | RM25 | RM20 |
| Lifetime | RM50 | RM40 |

Multi-PC plans allow 2–100 PCs. The total updates as quantity changes, and each
PC receives a separate serial via the existing verified-payment fulfilment.
The backend enforces the selected plan's minimum and trusted per-PC price.
Old purchases and legacy fixed-price bundles retain their original terms.

Admin software settings include a Minimum PC field. For a variable 2+ PC plan,
set fixed PCs to 0, minimum PCs to 2, and the price to the per-PC amount.
Single-PC plans keep fixed PCs at 1 and minimum at 1.

After the Render backend deploys, the existing AZDM offer must be saved with the
four plans above; stored offers are never silently overwritten by defaults.
No new environment variable, Worker deployment or database migration is needed.
