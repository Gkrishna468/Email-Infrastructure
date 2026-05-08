import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';
import crypto from 'crypto';
import path from 'path';
import db from './server/db.js';

import { getAuthUrl, getOAuth2Client, saveTokens, getTokens } from './server/auth/google.js';
import { GoogleWorkspaceConnector } from './server/core/connectors/GoogleWorkspaceConnector.js';
import { OmniMailEngine } from './server/core/engine/OmniMailEngine.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Wait for the DB to be initialized conceptually, though better-sqlite3 is sync
  
  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date() });
  });

  // Fetch emails
  app.get('/api/emails', (req, res) => {
    try {
      const stmt = db.prepare('SELECT * FROM emails ORDER BY received_at DESC');
      const emails = stmt.all();
      // Parse JSON from action_items and metadata
      const parsedEmails = emails.map((e: any) => ({
        ...e,
        action_items: e.action_items ? JSON.parse(e.action_items) : [],
        metadata: e.metadata ? JSON.parse(e.metadata) : null,
        security: {
          status: e.security_status,
          reason: e.security_reason
        }
      }));
      res.json(parsedEmails);
    } catch (err) {
      console.error("DB error", err);
      res.status(500).json({ error: "Failed to fetch emails" });
    }
  });

  // Feedback and Interaction History
  app.post('/api/emails/:id/interaction', (req, res) => {
    try {
      const { id } = req.params;
      const { action, feedback, priority, security_status } = req.body;

      // 1. Log to history
      const stmtHistory = db.prepare('INSERT INTO interaction_history (email_id, action, user_feedback) VALUES (?, ?, ?)');
      stmtHistory.run(id, action, feedback || null);

      // 2. Update email if requested
      if (priority) {
        db.prepare('UPDATE emails SET priority = ? WHERE id = ?').run(priority, id);
      }
      if (security_status) {
        db.prepare('UPDATE emails SET security_status = ? WHERE id = ?').run(security_status, id);
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
      const url = getAuthUrl();
      res.json({ url });
    } catch (err) {
      console.error('Failed to generate auth url:', err);
      res.status(500).json({ error: 'Failed to generate auth url' });
    }
  });

  app.get('/auth/google/callback', async (req, res) => {
    try {
      const code = req.query.code as string;
      const oauth2Client = getOAuth2Client();
      const { tokens } = await oauth2Client.getToken(code);
      
      await saveTokens(tokens);

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

  app.get('/api/gmail/status', (req, res) => {
    const tokens = getTokens();
    res.json({ connected: !!tokens });
  });

  app.post('/api/gmail/fetch', async (req, res) => {
    try {
      const emails = await GoogleWorkspaceConnector.fetchLatestEmails(20);
      
      // Process emails via OmniMail Engine
      for (const email of emails) {
        // Quick check if email already exists
        const stmt = db.prepare('SELECT id FROM emails WHERE id = ?');
        const exists = stmt.get(email.messageId);
        
        if (!exists) {
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
  app.get('/api/webhooks', (req, res) => {
    try {
      const stmt = db.prepare('SELECT * FROM webhooks ORDER BY created_at DESC');
      res.json(stmt.all());
    } catch (err) {
      res.status(500).json({ error: "error fetching webhooks" });
    }
  });

  app.post('/api/webhooks', (req, res) => {
    try {
      const { name, url } = req.body;
      if (!name || !url) return res.status(400).json({ error: "Missing name or url" });
      const id = crypto.randomUUID();
      const stmt = db.prepare('INSERT INTO webhooks (id, name, url) VALUES (?, ?, ?)');
      stmt.run(id, name, url);
      res.json({ id, name, url, active: 1 });
    } catch (err) {
      res.status(500).json({ error: "Failed to create webhook" });
    }
  });

  app.delete('/api/webhooks/:id', (req, res) => {
    try {
      const stmt = db.prepare('DELETE FROM webhooks WHERE id = ?');
      stmt.run(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete webhook" });
    }
  });

  app.put('/api/webhooks/:id/toggle', (req, res) => {
    try {
      const stmt = db.prepare('UPDATE webhooks SET active = NOT active WHERE id = ?');
      stmt.run(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to toggle webhook" });
    }
  });


  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
