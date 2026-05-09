import admin from 'firebase-admin';
import firebaseConfig from '../firebase-applet-config.json';

let adminApp: admin.app.App | null = null;

export function getFirebaseAdmin() {
  if (!adminApp) {
    adminApp = admin.initializeApp({
      projectId: firebaseConfig.projectId,
      // The SDK will automatically find credentials if running in a GCP environment
    });
  }
  return adminApp;
}

export function getFirestoreAdmin() {
  const app = getFirebaseAdmin();
  const firestore = admin.firestore(app);
  // In the Admin SDK, database selection is often handled by settings or by using the Firestore class directly
  // However, if the project was provisioned as the default database, it should just work.
  // If it's a named database, we might need a different approach.
  return firestore;
}

export function getAuthAdmin() {
  const app = getFirebaseAdmin();
  return admin.auth(app);
}
