import { getFirestoreAdmin } from '../../firebaseAdmin.js';

export class WebhookRepository {
  private static getCollection() {
    return getFirestoreAdmin().collection('webhooks');
  }

  static async getAll() {
    const coll = this.getCollection();
    const snapshot = await coll.orderBy('created_at', 'desc').get();
    return snapshot.docs.map(doc => doc.data());
  }

  static async create(name: string, url: string) {
    const coll = this.getCollection();
    const id = crypto.randomUUID();
    const webhook = {
      id,
      name,
      url,
      active: true,
      created_at: new Date().toISOString()
    };
    await coll.doc(id).set(webhook);
    return webhook;
  }

  static async delete(id: string) {
    await this.getCollection().doc(id).delete();
  }

  static async toggle(id: string) {
    const docRef = this.getCollection().doc(id);
    const doc = await docRef.get();
    if (doc.exists) {
      const data = doc.data();
      await docRef.update({ active: !data?.active });
    }
  }

  static async getConfiguredWebhooks() {
    const coll = this.getCollection();
    const snapshot = await coll.where('active', '==', true).get();
    return snapshot.docs.map(doc => doc.data());
  }
}
