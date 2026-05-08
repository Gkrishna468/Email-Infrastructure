import { OmniMailEngine } from "../engine/OmniMailEngine.js";
import { OmniMailPayload } from "../types/Email.js";

export class GmailConnector {
  static async ingestWebhook(appPayload: any): Promise<void> {
    
    // Normalize into standard OmniMailPayload
    const payload: OmniMailPayload = {
      messageId: appPayload.id || require('crypto').randomUUID(),
      subject: appPayload.subject || '',
      from: appPayload.sender || '',
      bodyText: appPayload.body || '',
      source: "webhook",
      receivedAt: new Date().toISOString()
    };

    // Hand execution to the Engine. No AI logic here.
    await OmniMailEngine.process(payload);
  }
}
