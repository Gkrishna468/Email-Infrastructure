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

    let body = "";
    if (payload.parts && payload.parts.length > 0) {
      const part = payload.parts.find((p: any) => p.mimeType === 'text/plain');
      if (part && part.body && part.body.data) {
        body = Buffer.from(part.body.data, 'base64').toString('utf8');
      }
    } else if (payload.body && payload.body.data) {
      body = Buffer.from(payload.body.data, 'base64').toString('utf8');
    }

    return {
      messageId: gmailMessage.id,
      threadId: gmailMessage.threadId,
      subject,
      from,
      bodyText: body,
      receivedAt: new Date(parseInt(gmailMessage.internalDate)).toISOString(),
      source: "gmail"
    };
  }
}
