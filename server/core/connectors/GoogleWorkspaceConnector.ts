import { google } from "googleapis";
import { getOAuth2Client, getTokens } from "../../auth/google.js";
import { EmailNormalizer } from "../normalizers/EmailNormalizer.js";

export class GoogleWorkspaceConnector {
  static async fetchLatestEmails(maxResults = 50) {
    const tokens = getTokens();
    if (!tokens) {
      throw new Error("Gmail not connected. Missing OAuth tokens.");
    }

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials(tokens);

    const gmail = google.gmail({
      version: "v1",
      auth: oauth2Client
    });

    const listRes = await gmail.users.messages.list({
      userId: "me",
      maxResults
    });

    const messages = listRes.data.messages;
    if (!messages || messages.length === 0) {
      return [];
    }

    const normalizedEmails = [];

    for (const msg of messages) {
      if (msg.id) {
        const fullMsg = await gmail.users.messages.get({
          userId: "me",
          id: msg.id,
          format: 'full'
        });
        
        const normalized = EmailNormalizer.normalize(fullMsg.data);
        normalizedEmails.push(normalized);
      }
    }

    return normalizedEmails;
  }
}
