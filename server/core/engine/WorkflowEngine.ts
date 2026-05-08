import db from '../../db.js';
import { ConnectorRouter } from '../routing/ConnectorRouter.js';

export class WorkflowEngine {

  static async route(email: any, intelligence: any) {

    const workflow =
      intelligence.intent?.primary || "general";

    let eventType = "general";
    let assignedTo: string | null = null;
    let workflowStatus = "pending";

    switch (workflow) {

      case "client_requirement":
      case "urgent_hiring":
        console.log(
          "Trigger CRM Requirement Workflow"
        );
        eventType = "client_requirement";
        assignedTo = "Alex Recruiter (Enterprise Team)";
        workflowStatus = "assigned";
        break;

      case "candidate_submission":
        console.log(
          "Trigger Candidate Workflow"
        );
        eventType = "candidate_submission";
        assignedTo = "Sam Sourcer (Technical)";
        workflowStatus = "assigned";
        break;

      case "vendor_outreach":
        console.log(
          "Trigger Vendor Workflow"
        );
        eventType = "vendor_outreach";
        assignedTo = "Jamie Partner (Vendor Relations)";
        workflowStatus = "assigned";
        break;

      default:
        console.log(
          "General operational workflow"
        );
        eventType = "general";
    }

    // Build the enterprise payload
    const workflowPayload = {
      eventType,
      source: "gmail",
      timestamp: new Date().toISOString(),
      email: {
        subject: email.subject || "No Subject",
        from: email.from || email.sender || "Unknown",
        threadId: email.threadId || email.id
      },
      intelligence: {
        priority: intelligence.confidence > 0.8 ? "high" : "medium",
        intent: {
          primary: intelligence.intent?.primary || "unknown",
          secondary: intelligence.intent?.secondary || null
        },
        entities: intelligence.entities || {},
        actionItems: intelligence.actionItems || [],
        confidence: intelligence.confidence || 0,
        aiSummary: intelligence.aiSummary || ""
      },
      workflow: {
        status: workflowStatus,
        assignedTo,
        routingEngine: "OmniMail"
      },
      revenueSignals: {
        estimatedMargin: "18%", // example logic
        priorityScore: Math.floor((intelligence.confidence || 0) * 100)
      }
    };

    // Get active webhooks
    const webhooks = db.prepare('SELECT * FROM webhooks WHERE active = 1').all() as any[];
    
    // Dispatch to all active webhooks
    for (const webhook of webhooks) {
      if (webhook.url) {
        await ConnectorRouter.dispatch(webhook.url, workflowPayload);
      }
    }
  }
}
