export interface OmniMailPayload {
  messageId: string;
  threadId?: string;

  subject: string;
  from: string;
  to?: string;

  bodyText: string;
  bodyHtml?: string;

  labels?: string[];

  receivedAt: string;

  source: "gmail" | "outlook" | "webhook";

  attachments?: Attachment[];
}

export interface Attachment {
  filename: string;
  mimeType: string;
  url?: string;
}
