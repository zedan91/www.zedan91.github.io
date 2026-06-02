const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

// AZOBSS setting:
// User yang belum verify email lebih daripada 24 jam akan dibuang.
// Nota: function ini jalan setiap 1 jam. Dalam keadaan sebenar, deletion boleh berlaku lebih kurang 24-25 jam
// bergantung pada scheduler timing, bukan tepat 24 jam tepat.
const MAX_UNVERIFIED_AGE_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 1000;

async function deleteDocsByUid(collectionName, uid) {
  const snap = await db.collection(collectionName).where('uid', '==', uid).get();
  if (snap.empty) return 0;

  const batch = db.batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  return snap.size;
}

async function deleteKnownUserDocs(userRecord) {
  const uid = userRecord.uid;
  let deletedCount = 0;

  // Delete profile docs by uid query. This works even if username doc id is unknown.
  deletedCount += await deleteDocsByUid('users', uid);
  deletedCount += await deleteDocsByUid('usernameAuthEmails', uid);

  // Optional cleanup for common AZOBSS auth-related collections.
  // These are safe because they match the same Firebase Auth UID.
  deletedCount += await deleteDocsByUid('onlineUsers', uid);
  deletedCount += await deleteDocsByUid('loginHistory', uid);

  return deletedCount;
}

exports.cleanupUnverifiedUsers = onSchedule(
  {
    schedule: 'every 60 minutes',
    timeZone: 'Asia/Kuala_Lumpur',
    region: 'asia-southeast1',
    memory: '128MiB',
    timeoutSeconds: 60,
    maxInstances: 1,
  },
  async () => {
    const now = Date.now();
    let nextPageToken;
    let scanned = 0;
    let deleted = 0;
    let skippedVerified = 0;
    let skippedTooNew = 0;

    do {
      const result = await auth.listUsers(PAGE_SIZE, nextPageToken);
      nextPageToken = result.pageToken;

      for (const userRecord of result.users) {
        scanned++;

        if (userRecord.emailVerified) {
          skippedVerified++;
          continue;
        }

        const createdAt = new Date(userRecord.metadata.creationTime).getTime();
        const ageMs = now - createdAt;

        if (ageMs < MAX_UNVERIFIED_AGE_MS) {
          skippedTooNew++;
          continue;
        }

        try {
          const firestoreDeleted = await deleteKnownUserDocs(userRecord);
          await auth.deleteUser(userRecord.uid);
          deleted++;

          logger.info('AZOBSS deleted unverified user', {
            uid: userRecord.uid,
            email: userRecord.email || null,
            ageSeconds: Math.round(ageMs / 1000),
            firestoreDeleted,
          });
        } catch (error) {
          logger.error('AZOBSS failed deleting unverified user', {
            uid: userRecord.uid,
            email: userRecord.email || null,
            error: error.message,
          });
        }
      }
    } while (nextPageToken);

    logger.info('AZOBSS cleanupUnverifiedUsers completed', {
      scanned,
      deleted,
      skippedVerified,
      skippedTooNew,
    });
  }
);

/* Logo Priority: Upload Image > Image URL > Favicon Domain > Default AZOBSS Logo */
