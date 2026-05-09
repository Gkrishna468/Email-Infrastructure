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
      if (!userId) return res.status(400).json({ error: "Missing userId" });
      
      console.log("✅ Starting OAuth for:", userId);
      const url = getAuthUrl(userId);
      res.redirect(url);
    } catch (err) {
      console.error('❌ Failed to generate auth url:', err);
      res.status(500).json({ error: 'Auth initialization failed' });
    }
  });

  app.get('/auth/google/callback', async (req, res) => {
    const appUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    try {
      console.log("✅ OAuth callback hit");
      const code = req.query.code as string;
      const userId = req.query.state as string;
      
      if (!userId) throw new Error("Missing userId in state");
      if (!code) throw new Error("Missing OAuth code");

      const oauth2Client = getOAuth2Client();
      const { tokens } = await oauth2Client.getToken(code);
      
      await saveTokens(tokens, userId);
      console.log("✅ Tokens stored in Firestore for user:", userId);

      res.redirect(`${appUrl}?gmail=connected`);
    } catch (err: any) {
      console.error('❌ OAuth callback error:', err);
      res.redirect(`${appUrl}?gmail=failed`);
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
