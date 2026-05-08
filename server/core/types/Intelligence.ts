export interface OmniMailIntelligence {
  workflowType: string;

  priority: "Urgent" | "Important" | "To Read" | "Archived";

  security: {
    status: "Safe" | "Spam" | "Phishing";
    reason?: string;
    confidence: number;
  };

  intent: {
    primary: string;
    secondary?: string;
  };

  entities: {
    role?: string;
    candidateName?: string;
    vendorName?: string;
    budgetLPA?: number;
    skills?: string[];
    location?: string;
  };

  actionItems: string[];

  recruiterRecommendations?: string[];

  revenueSignals?: {
    marginPotential?: string;
    priorityScore?: number;
  };

  confidence: number;

  aiSummary: string;
  
  outreachDraft?: string;
}
