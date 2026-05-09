import { google } from "googleapis";
import { getOAuth2Client, getTokens } from "../../auth/google.js";

export class GoogleWorkspaceConnector {
  static async fetchLatestEmails(limit = 50, userId: string) {
    const tokens = await getTokens(userId);
    if (!tokens) {
      throw new Error("Gmail not connected. Missing OAuth tokens.");
    }

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials(tokens);

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const listRes = await gmail.users.messages.list({
      userId: "me",
      maxResults: limit
    });

    const messages = listRes.data.messages || [];
    const fullEmails = [];

    for (const msg of messages) {
      const emailRes = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!
      });
      fullEmails.push(emailRes.data);
    }

    return fullEmails;
  }
}
