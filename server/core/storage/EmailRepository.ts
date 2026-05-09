import { getFirestoreAdmin } from '../../firebaseAdmin.js';

export class EmailRepository {
  private static getCollection() {
    return getFirestoreAdmin().collection('emails');
  }

  static async store(payload: any) {
    const coll = this.getCollection();
    const docRef = coll.doc(payload.messageId);

    const emailData = {
      id: payload.messageId,
      subject: payload.subject || 'No Subject',
      sender: payload.from,
      body: payload.bodyText,
      status: 'pending',
      received_at: payload.receivedAt || new Date().toISOString()
    };

    await docRef.set(emailData, { merge: true });

    return { id: payload.messageId, ...payload };
  }

  static async attachIntelligence(id: string, intelligence: any) {
    try {
      const coll = this.getCollection();
      const docRef = coll.doc(id);

      await docRef.update({
        summary: intelligence.aiSummary,
        action_items: intelligence.actionItems || [],
        intent: intelligence.intent?.primary || 'unknown',
        metadata: intelligence.entities || {},
        outreach_draft: intelligence.outreachDraft || null,
        status: 'integrated',
        priority: intelligence.priority || 'To Read',
        security: {
          status: intelligence.security?.status || 'Safe',
          reason: intelligence.security?.reason || null
        },
        match_score: intelligence.matchScore || null,
        vendor_intelligence: intelligence.vendorIntelligence || null
      });
    } catch(e) {
      console.error('Failed to attach intelligence to email:', id, e);
    }
  }

  static async getAll() {
    const coll = this.getCollection();
    const snapshot = await coll.orderBy('received_at', 'desc').get();
    return snapshot.docs.map(doc => doc.data());
  }
}
