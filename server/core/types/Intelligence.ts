export interface OmniMailIntelligence {
  workflowType: string;

  priority: "Urgent" | "Client Req" | "Vendor Submission" | "Interview" | "Follow-up" | "Important" | "To Read" | "Archived" | "Spam" | "Phishing";

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
    experienceYears?: number;
    noticePeriodDays?: number;
    expectedCTC?: string;
    hasResume?: boolean;
  };

  matchScore?: {
    score: number; // 0-100
    gaps: string[];
    reasoning: string;
  };

  vendorIntelligence?: {
    isKnownVendor: boolean;
    submissionQuality: "High" | "Medium" | "Low";
    spamLikelihood: number;
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
