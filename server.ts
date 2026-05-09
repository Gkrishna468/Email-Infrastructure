import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import path from 'path';
import { EmailRepository } from './server/core/storage/EmailRepository.js';
import { WebhookRepository } from './server/core/storage/WebhookRepository.js';

import { getAuthUrl, getOAuth2Client, saveTokens, getTokens } from './server/auth/google.js';
import { GoogleWorkspaceConnector } from './server/core/connectors/GoogleWorkspaceConnector.js';
import { OmniMailEngine } from './server/core/engine/OmniMailEngine.js';
import { getFirestoreAdmin } from './server/firebaseAdmin.js';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 8080;

  app.use(cors({
    origin: [
      "https://app.hirenestworkforce.com",
      "http://localhost:5173",
      process.env.APP_URL || ""
    ].filter(Boolean),
    credentials: true
  }));
  app.use(express.json());

  // Wait for the DB to be initialized conceptually, though better-sqlite3 is sync
  
  // Root path for basic health/operational check
  app.get('/', (_, res) => {
    res.json({
      status: "HireNestOS OmniMail API Operational",
      version: "1.0.0",
      timestamp: new Date().toISOString()
    });
  });

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date() });
  });

  // Fetch emails
  app.get('/api/emails', async (req, res) => {
    try {
      const emails = await EmailRepository.getAll();
      res.json(emails);
    } catch (err) {
      console.error("DB error", err);
      res.status(500).json({ error: "Failed to fetch emails" });
    }
  });

  // Feedback and Interaction History
  app.post('/api/emails/:id/interaction', async (req, res) => {
    try {
      const { id } = req.params;
      const { action, feedback, priority, security_status } = req.body;

      // 1. Log to history (Interactions)
      const coll = getFirestoreAdmin().collection('interactions');
      await coll.add({
        email_id: id,
        action,
        user_feedback: feedback || null,
        created_at: new Date().toISOString()
      });

      // 2. Update email if requested
      const emailRef = getFirestoreAdmin().collection('emails').doc(id);
      const updates: any = {};
      
      if (priority) updates.priority = priority;
      if (security_status) {
        updates.security = {
          status: security_status,
          reason: feedback || 'User override'
        };
      }
      
      if (Object.keys(updates).length > 0) {
        await emailRef.update(updates);
      }

      res.json({ success: true });
    } catch (err) {
      console.error('Feedback error:', err);
      res.status(500).json({ error: 'Failed to record interaction' });
    }
  });

  // The actual ingestion webhook payload (e.g. from Sendgrid / Mailgun or custom)
  app.post('/api/webhooks/ingress', async (req, res) => {
    try {
      const { subject, sender, body } = req.body;
      
      if (!sender || !body) {
        return res.status(400).json({ error: "Missing 'sender' or 'body'" });
      }

      const id = crypto.randomUUID();
      
      // Early ACK to the webhook provider
      res.status(202).json({ status: "accepted", id });

      // Process asynchronously
      setImmediate(async () => {
        try {
          const { GmailConnector } = await import('./server/core/connectors/GmailConnector.js');
          await GmailConnector.ingestWebhook({
            id,
            subject,
            sender,
            body
          });
          
          // The actual processing and webhook firing is handled down the line
          // in OmniMailEngine -> WorkflowEngine.
        } catch (dbErr) {
          console.error("Failed to process email", dbErr);
        }
      });
      
    } catch (err) {
      console.error('Ingress error:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // CRM Webhook Receiver Simulation (Priority 3)
  app.post('/api/webhooks/omnimail', (req, res) => {
    try {
      console.log('----------------------------------------------------');
      console.log('🚀 [CRM RECEIVER] Received OmniMail payload:');
      console.log(JSON.stringify(req.body, null, 2));
      console.log('----------------------------------------------------');
      res.status(200).json({ status: "success", receivedAt: new Date().toISOString() });
    } catch (err) {
      console.error('CRM Webhook error:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.get('/auth/google', (req, res) => {
    try {
      const userId = req.query.userId as string;
      const url = getAuthUrl(userId);
      res.json({ url });
    } catch (err) {
      console.error('Failed to generate auth url:', err);
      res.status(500).json({ error: 'Failed to generate auth url' });
    }
  });

  app.get('/auth/google/callback', async (req, res) => {
    try {
      const code = req.query.code as string;
      const userId = req.query.state as string;
      
      const oauth2Client = getOAuth2Client();
      const { tokens } = await oauth2Client.getToken(code);
      
      await saveTokens(tokens, userId);

      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (err) {
      console.error('OAuth callback error:', err);
      res.status(500).send('Authentication failed');
    }
  });

  app.get('/api/gmail/status', async (req, res) => {
    try {
      const userId = req.query.userId as string;
      const tokens = await getTokens(userId);
      res.json({ connected: !!tokens });
    } catch (err) {
      console.error('Failed to check Gmail status:', err);
      res.status(500).json({ error: 'Failed to check Gmail status' });
    }
  });

  app.post('/api/gmail/fetch', async (req, res) => {
    try {
      const limit = Number(req.query.limit) || 50;
      const userId = req.query.userId as string;
      const emails = await GoogleWorkspaceConnector.fetchLatestEmails(limit, userId);
      
      const firestore = getFirestoreAdmin();
      
      // Process emails via OmniMail Engine
      for (const email of emails) {
        // Quick check if email already exists
        const docRef = firestore.collection('emails').doc(email.messageId);
        const doc = await docRef.get();
        
        if (!doc.exists) {
          await OmniMailEngine.process(email);
        }
      }
      
      res.json({ success: true, count: emails.length });
    } catch (err: any) {
      console.error('Failed to fetch emails:', err);
      res.status(500).json({ error: err.message || 'Failed to fetch emails' });
    }
  });

  // Manage Webhooks
  app.get('/api/webhooks', async (req, res) => {
    try {
      const webhooks = await WebhookRepository.getAll();
      res.json(webhooks);
    } catch (err) {
      res.status(500).json({ error: "error fetching webhooks" });
    }
  });

  app.post('/api/webhooks', async (req, res) => {
    try {
      const { name, url } = req.body;
      if (!name || !url) return res.status(400).json({ error: "Missing name or url" });
      const webhook = await WebhookRepository.create(name, url);
      res.json(webhook);
    } catch (err) {
      res.status(500).json({ error: "Failed to create webhook" });
    }
  });

  app.delete('/api/webhooks/:id', async (req, res) => {
    try {
      await WebhookRepository.delete(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete webhook" });
    }
  });

  app.put('/api/webhooks/:id/toggle', async (req, res) => {
    try {
      await WebhookRepository.toggle(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to toggle webhook" });
    }
  });


  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 HireNestOS running on port ${PORT}`);
  });
}

startServer();
