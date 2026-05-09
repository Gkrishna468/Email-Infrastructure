import admin from 'firebase-admin';

let app: admin.app.App;

export function getFirebaseAdmin() {
  if (!app) {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      // For Production / Railway
      app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    } else {
      // In local/dev environment, Firebase Admin might use default credentials or a service account file
      // In AI Studio environment, we can usually use initializeApp() if it's already configured
      try {
        app = admin.initializeApp();
      } catch (e) {
        // Fallback for AI Studio preview if no env vars provided
        console.warn('Firebase Admin could not initialize with default credentials. Ingestion may fail.');
      }
    }
  }
  return app;
}

export function getFirestoreAdmin() {
  return admin.firestore(getFirebaseAdmin());
}
