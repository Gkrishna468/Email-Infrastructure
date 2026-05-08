import { convert } from 'html-to-text';

export class EmailNormalizer {
  static normalize(gmailMessage: any) {
    const payload = gmailMessage.payload;
    const headers = payload.headers;
    
    let subject = "No Subject";
    let from = "Unknown Sender";

    for (const header of headers) {
      if (header.name.toLowerCase() === 'subject') {
        subject = header.value;
      }
      if (header.name.toLowerCase() === 'from') {
        from = header.value;
      }
    }

    let bodyText = "";
    let bodyHtml = "";

    const extractBody = (part: any) => {
      if (part.mimeType === 'text/plain' && part.body && part.body.data) {
        bodyText = Buffer.from(part.body.data, 'base64').toString('utf8');
      } else if (part.mimeType === 'text/html' && part.body && part.body.data) {
        bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf8');
      } else if (part.parts) {
        part.parts.forEach(extractBody);
      }
    };

    if (payload.parts) {
      payload.parts.forEach(extractBody);
    } else if (payload.body && payload.body.data) {
      if (payload.mimeType === 'text/plain') {
        bodyText = Buffer.from(payload.body.data, 'base64').toString('utf8');
      } else if (payload.mimeType === 'text/html') {
        bodyHtml = Buffer.from(payload.body.data, 'base64').toString('utf8');
      }
    }

    // If we only have HTML, convert it to text for the AI
    if (!bodyText && bodyHtml) {
      bodyText = convert(bodyHtml, {
        wordwrap: 130,
        selectors: [
          { selector: 'a', options: { ignoreHref: true } },
          { selector: 'img', format: 'skip' }
        ]
      });
    }

    return {
      messageId: gmailMessage.id,
      threadId: gmailMessage.threadId,
      subject,
      from,
      bodyText,
      bodyHtml: bodyHtml || undefined,
      receivedAt: new Date(parseInt(gmailMessage.internalDate)).toISOString(),
      source: "gmail"
    };
  }
}
