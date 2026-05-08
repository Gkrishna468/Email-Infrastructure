import { google } from "googleapis";
import db from '../db.js';

export function getOAuth2Client() {
  const redirectUri = process.env.APP_URL ? `${process.env.APP_URL}/auth/google/callback` : process.env.GOOGLE_REDIRECT_URI;
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
}

export function getAuthUrl() {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly"
    ]
  });
}

export async function saveTokens(tokens: any) {
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  stmt.run('gmail_tokens', JSON.stringify(tokens));
}

export function getTokens() {
  const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
  const row = stmt.get('gmail_tokens') as { value: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch (e) {
    return null;
  }
}
