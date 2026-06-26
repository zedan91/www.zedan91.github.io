AZOBSS AUTH FINAL STABLE

Added:
1. Production Firestore rules with safer uid checks.
2. Verification email continue URL: after clicking verify, user can return to website login.
3. Member page protection for affiliate-shop, lucky-draw, purchase-history, member-area, members, my-account.

Important:
- Paste FIREBASE-RULES-AZOBSS-FINAL.txt into Firebase Firestore Rules and Publish.
- In Firebase Authentication > Templates > Email address verification, set Action URL / continue domain to your website if you want full custom redirect behavior.
- Authorized domains must include azobss.com, www.azobss.com, zedan91.github.io, www.zedan91.github.io.
