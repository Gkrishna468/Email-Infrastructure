import { google } from "googleapis";
import { getFirestoreAdmin } from '../firebaseAdmin.js';

const COLLECTION_NAME = 'gmail_tokens';

export function getOAuth2Client() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  return oauth2Client;
}

export function getAuthUrl(userId: string) {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", 
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly"
    ],
    state: userId
  });
}

export async function saveTokens(tokens: any, userId: string) {
  const db = getFirestoreAdmin();
  await db.collection(COLLECTION_NAME).doc(userId).set({
    ...tokens,
    updatedAt: new Date().toISOString()
  });
}

export async function getTokens(userId: string) {
  const db = getFirestoreAdmin();
  const doc = await db.collection(COLLECTION_NAME).doc(userId).get();
  if (!doc.exists) return null;
  return doc.data();
}
