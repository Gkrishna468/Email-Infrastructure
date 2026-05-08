import { GoogleGenAI } from "@google/genai";
import { OmniMailPayload } from "../types/Email.js";
import { OmniMailIntelligence } from "../types/Intelligence.js";
import db from '../../db.js';

// Lazy initialize the AI client
let ai: GoogleGenAI | null = null;
function getAIClient() {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return ai;
}

export class GeminiParser {
  static async getInteractionHistory() {
    try {
      const history = db.prepare(`
        SELECT action, user_feedback, emails.subject, emails.sender
        FROM interaction_history
        JOIN emails ON interaction_history.email_id = emails.id
        ORDER BY interaction_history.created_at DESC
        LIMIT 10
      `).all();
      return JSON.stringify(history);
    } catch (e) {
      return "[]";
    }
  }

  static async analyzeEmail(
    payload: OmniMailPayload
  ): Promise<OmniMailIntelligence> {
    const history = await this.getInteractionHistory();

    const prompt = `
You are OmniMail Intelligence Middleware inside HireNestOS.
Your task is to provide ADVANCED email filtering and security analysis.

Analyze this email accurately based on content, sender, and historical user interaction patterns.

CATEGORIZATION RULES:
- Urgent: Requires immediate response or action (e.g., final round interview scheduling, urgent hiring requests).
- Important: High business value but maybe not time-sensitive (e.g., quality candidates, new RFPs).
- To Read: General info, news, or low-priority updates.
- Archived: Newsletter, automated bot mails, or promotional content.

SECURITY RULES:
- Flag as 'Phishing' if the sender looks suspicious, asks for sensitive info, or contains deceptive links.
- Flag as 'Spam' if it is unsolicited bulk commercial content.
- Flag as 'Safe' otherwise.
- Provide a clear 'reason' for security flags.

USER INTERACTION HISTORY:
${history}

EMAIL TO ANALYZE:
Subject: ${payload.subject}
From: ${payload.from}
Body:
${payload.bodyText}

Return VALID JSON ONLY.

Return format:
{
  "workflowType": "recruitment | business | support | other",
  "priority": "Urgent | Important | To Read | Archived",
  "security": {
    "status": "Safe | Spam | Phishing",
    "reason": "Detailed justification for the status",
    "confidence": 0.0 to 1.0
  },
  "intent": {
    "primary": "main reason for the email",
    "secondary": "any side effect/intent"
  },
  "entities": {
    "role": "job title",
    "candidateName": "name of candidate",
    "vendorName": "company/agency name",
    "budgetLPA": 0,
    "skills": ["skill1", "skill2"],
    "location": "office/city"
  },
  "actionItems": [
    "action 1",
    "action 2"
  ],
  "confidence": 0.0 to 1.0,
  "aiSummary": "Concise executive summary",
  "outreachDraft": "Strategic professional response draft"
}
`;

    try {
      const client = getAIClient();
      const response = await client.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      if (response.text) {
        return JSON.parse(response.text);
      }
    } catch (e: any) {
      console.error('Gemini extraction failed:', e.message || e);
    }
    
    // Default fallback
    return {
      workflowType: "unknown",
      priority: "To Read",
      security: { status: "Safe", confidence: 0.5 },
      intent: { primary: "unknown" },
      entities: {},
      actionItems: [],
      confidence: 0,
      aiSummary: 'Failed to process email',
      outreachDraft: null
    };
  }
}
