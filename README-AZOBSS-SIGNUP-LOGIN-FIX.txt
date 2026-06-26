AZOBSS Signup/Login Final Fix

1. Upload all website files to GitHub.
2. Open Firebase Console > Firestore Database > Rules.
3. Copy all content from FIREBASE-RULES-AZOBSS-FINAL.txt.
4. Paste and click Publish.
5. For old broken test accounts, delete from Firebase Authentication first, then sign up again.
6. If account already exists and email verification was already sent, login once using full Gmail email instead of username. After login, the website will repair users/{username} and usernameAuthEmails/{username} automatically.

Fix included:
- Auth user is no longer auto-deleted.
- Verification email is still sent even if Firestore profile is temporarily blocked.
- Signup no longer stops at Firestore profile warning.
- Firestore rules allow authenticated profile/mapping repair.
- Username login works after usernameAuthEmails mapping is saved.
