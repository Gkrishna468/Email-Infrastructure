import { google } from "googleapis";
import { getFirestoreAdmin } from '../firebaseAdmin.js';

const COLLECTION_NAME = 'gmail_tokens';
const DEFAULT_DOC_ID = 'primary_user'; // Using a default ID since session auth is not fully implemented on server

export function getOAuth2Client() {
  const redirectUri = process.env.APP_URL ? `${process.env.APP_URL}/auth/google/callback` : process.env.GOOGLE_REDIRECT_URI;
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
}

export function getAuthUrl(userId?: string) {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // Force consent to ensure refresh_token is provided
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly"
    ],
    state: userId // Pass userId to recovery it in callback
  });
}

export async function saveTokens(tokens: any, userId: string = DEFAULT_DOC_ID) {
  const db = getFirestoreAdmin();
  await db.collection(COLLECTION_NAME).doc(userId).set({
    ...tokens,
    updatedAt: new Date().toISOString()
  });
}

export async function getTokens(userId: string = DEFAULT_DOC_ID) {
  const db = getFirestoreAdmin();
  const doc = await db.collection(COLLECTION_NAME).doc(userId).get();
  if (!doc.exists) return null;
  return doc.data();
}
