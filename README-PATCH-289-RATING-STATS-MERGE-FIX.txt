(289)-AZOBSS-SHOP-CARD-RATING-STATS-MERGE-FIX

Fix:
- Downloads may come from settings/softwareStats, while existing/real rating can still live on the product item data.
- Previous patch allowed a Firestore stats entry with downloads but rating=0 to override the product rating, causing cards to show 0.0 or empty rating.
- This patch merges stats safely: use Firestore downloads, but keep product rating/ratingVotes when Firestore rating is missing/zero.
- Adds robust rating field support: ratingAverage, avgRating, averageRating, ratingAvg, ratingVotes, votes, ratingCount, reviewCount, reviews, ratingTotal, ratingSum.
- Adds data-rating-votes to dynamic cards so footer can preserve vote counts on first paint.

Scope:
- Software Tools rating/download display only.
- Does not touch PA/BM, My Purchases, Cart storage/payment, Bell/Message badge, Firebase Rules, or Render ENV.
