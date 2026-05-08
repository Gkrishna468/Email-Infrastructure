import db from '../../db.js';

export class EmailRepository {
  static async store(payload: any) {
    const insert = db.prepare(`
      INSERT INTO emails (id, subject, sender, body, status, received_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `);
    
    insert.run(
      payload.messageId,
      payload.subject || 'No Subject',
      payload.from,
      payload.bodyText,
      'pending',
      payload.receivedAt || new Date().toISOString()
    );

    return { id: payload.messageId, ...payload };
  }

  static async attachIntelligence(id: string, intelligence: any) {
    try {
      const update = db.prepare(`
        UPDATE emails 
        SET summary = ?, action_items = ?, intent = ?, metadata = ?, outreach_draft = ?, status = ?, priority = ?, security_status = ?, security_reason = ?
        WHERE id = ?
      `);
      
      update.run(
        intelligence.aiSummary,
        JSON.stringify(intelligence.actionItems || []),
        intelligence.intent?.primary || 'unknown',
        JSON.stringify(intelligence.entities || {}),
        intelligence.outreachDraft || null,
        'integrated',
        intelligence.priority || 'To Read',
        intelligence.security?.status || 'Safe',
        intelligence.security?.reason || null,
        id
      );
    } catch(e) {
      console.error('Failed to attach intelligence to email:', id, e);
    }
  }
}
