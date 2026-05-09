import admin from 'firebase-admin';

if (!admin.apps.length) {
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  } else {
    try {
      admin.initializeApp();
    } catch (e) {
      console.warn('Firebase Admin could not initialize with default credentials.');
    }
  }
}

export const adminApp = admin.app();
export const db = admin.firestore();
