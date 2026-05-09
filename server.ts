import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { getAuthUrl, getOAuth2Client, saveTokens, getTokens } from "./server/auth/google.js";
import { GoogleWorkspaceConnector } from "./server/core/connectors/GoogleWorkspaceConnector.js";
import { db } from "./server/firebaseAdmin.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get('/auth/google', (req, res) => {
    try {
      const userId = req.query.userId as string;
      console.log("✅ Starting OAuth for:", userId);
      if (!userId) return res.status(400).json({ error: "Missing userId" });
      const url = getAuthUrl(userId);
      res.json({ url });
    } catch (err) {
      console.error('❌ Failed to generate auth url:', err);
      res.status(500).json({ error: 'Auth initialization failed' });
    }
  });

  app.get('/auth/google/callback', async (req, res) => {
    try {
      console.log("✅ OAuth callback hit");
      const code = req.query.code as string;
      const userId = req.query.state as string;
      
      console.log("✅ User ID from state:", userId);
      console.log("✅ Auth code present:", !!code);

      if (!code) throw new Error("Missing OAuth code");
      if (!userId) throw new Error("Missing userId in state");

      const oauth2Client = getOAuth2Client();
      const { tokens } = await oauth2Client.getToken(code);
      
      console.log("✅ Tokens received result:", {
        access_token: !!tokens.access_token,
        refresh_token: !!tokens.refresh_token,
        expiry_date: tokens.expiry_date
      });

      await saveTokens(tokens, userId);
      console.log("✅ Tokens stored in Firestore for user:", userId);

      const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      
      res.send(`
        <html>
          <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc;">
            <div style="text-align: center; padding: 2rem; background: white; border-radius: 1rem; shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
              <h1 style="color: #4f46e5; margin-bottom: 0.5rem;">Connected!</h1>
              <p style="color: #64748b;">Closing this window and returning to OmniMail...</p>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ type: 'GMAIL_CONNECTED' }, '*');
                  setTimeout(() => window.close(), 1000);
                } else {
                  window.location.href = "${appUrl}?gmail=connected";
                }
              </script>
            </div>
          </body>
        </html>
      `);
    } catch (err: any) {
      console.error('❌ OAuth callback error:', err);
      const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      res.status(500).send(`
        <html>
          <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #fef2f2;">
             <div style="text-align: center; padding: 2rem; background: white; border-radius: 1rem; shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); max-width: 500px;">
              <h1 style="color: #ef4444; margin-bottom: 0.5rem;">Authentication Failed</h1>
              <p style="color: #64748b;">${err instanceof Error ? err.message : String(err)}</p>
              <a href="${appUrl}?gmail=failed" style="display: inline-block; margin-top: 1rem; color: #4f46e5; text-decoration: none; font-weight: bold;">Return to App</a>
              <pre style="text-align: left; background: #f1f5f9; padding: 1rem; border-radius: 0.5rem; margin-top: 1rem; overflow: auto; font-size: 10px;">${err?.stack || ""}</pre>
            </div>
          </body>
        </html>
      `);
    }
  });

  app.get('/api/gmail/status', async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) return res.json({ connected: false });
      const tokens = await getTokens(userId);
      res.json({ connected: !!tokens });
    } catch (err) {
      console.error('Failed to check Gmail status:', err);
      res.status(500).json({ error: 'Failed to check Gmail status' });
    }
  });

  app.post('/api/gmail/fetch', async (req, res) => {
    try {
      const limit = Number(req.query.limit) || 20;
      const userId = req.body.userId || req.query.userId;
      
      if (!userId) return res.status(400).json({ error: "Missing userId" });

      const emails = await GoogleWorkspaceConnector.fetchLatestEmails(limit, userId);
      const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
      const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });

      let count = 0;
      for (const email of emails) {
        const snippet = email.snippet || "";
        const subject = email.payload?.headers?.find((h: any) => h.name === 'Subject')?.value || "No Subject";
        const from = email.payload?.headers?.find((h: any) => h.name === 'From')?.value || "Unknown";
        const body = snippet;

        // AI Parsing
        const prompt = `Analyze this email for recruitment. Return JSON with candidateName, role, score (0-100), reasons (array of strings). Email: ${subject} - ${body}`;
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        
        let aiData = { candidateName: "Unknown", role: "Unknown", score: 0, reasons: [] };
        try {
          const jsonMatch = text.match(/\{.*\}/s);
          if (jsonMatch) aiData = JSON.parse(jsonMatch[0]);
        } catch (e) {}

        await db.collection("emails").add({
          subject,
          snippet,
          from,
          date: new Date().toISOString(),
          userId,
          match_score: {
            score: aiData.score || 50,
            reasons: aiData.reasons || []
          },
          metadata: {
            candidateName: aiData.candidateName || "Extracted Name",
            role: aiData.role || "Extracted Role"
          },
          updatedAt: new Date().toISOString(),
          priority: (aiData.score || 0) > 80 ? "Urgent" : "Normal",
          securityStatus: "Safe",
          outreachDraft: "Ready for drafting..."
        });
        count++;
      }

      res.json({ success: true, count });
    } catch (err) {
      console.error('Fetch failed:', err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
