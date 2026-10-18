// CRM domain types and enums, mirroring app/lib/{deals,contacts,interactions,
// conversations}.ts in the CRM repo. Keep them in sync when those change.

export const ACTIVE_STAGES = [
  "NEW",
  "QUALIFIED",
  "CONTACTED",
  "DISCOVERY",
  "DEMO",
  "PROPOSAL",
  "TRIAL",
  "NEGOTIATION",
] as const;
export const TERMINAL_STAGES = ["CLOSED_WON", "CLOSED_LOST", "CLOSED_DISQUALIFIED", "NURTURE"] as const;
export const STAGES = [...ACTIVE_STAGES, ...TERMINAL_STAGES] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  NEW: "New",
  QUALIFIED: "Qualified",
  CONTACTED: "Contacted",
  DISCOVERY: "Discovery",
  DEMO: "Demo",
  PROPOSAL: "Proposal",
  TRIAL: "Trial",
  NEGOTIATION: "Negotiation",
  CLOSED_WON: "Closed Won",
  CLOSED_LOST: "Closed Lost",
  CLOSED_DISQUALIFIED: "Disqualified",
  NURTURE: "Nurture",
};

export type DealType = "DIRECT" | "PARTNER";
export type CloseReason = "PRICE" | "TIMING" | "COMPETITOR" | "NO_DECISION" | "BUDGET" | "NOT_A_FIT" | "OTHER";
export type PartnerStatus = "SIGNED" | "ENABLED" | "ACTIVATED";

export type Channel = "INBOUND" | "OUTBOUND";
export type Source = "NETWORK" | "EVENT" | "LINKEDIN" | "WEBSITE" | "REFERRAL" | "CRUNCHBASE" | "APOLLO" | "OTHER";
export const SOURCES_BY_CHANNEL: Record<Channel, readonly Source[]> = {
  INBOUND: ["NETWORK", "EVENT", "LINKEDIN", "WEBSITE", "REFERRAL"],
  OUTBOUND: ["LINKEDIN", "CRUNCHBASE", "APOLLO", "OTHER", "NETWORK", "EVENT"],
};

export type InteractionType = "OUTREACH_SENT" | "CALL_HELD" | "FOLLOW_UP" | "DEMO" | "EMAIL" | "OTHER";
export type InteractionResult = "RESPONSE_RECEIVED" | "NEXT_STEP_AGREED" | "NO_RESPONSE" | "OTHER";

export type CompanyType = "DIRECT" | "CHANNEL_PARTNER";
export type TaggableType = "company" | "contact" | "deal";

/** Timestamps are unix seconds. */
export interface Company {
  id: string;
  name: string;
  type: CompanyType;
  businessType: string | null;
  website: string | null;
  notes: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  country: string | null;
  province: string | null;
  city: string | null;
  linkedinUrl: string | null;
  companyId: string | null;
  channel: Channel;
  source: Source;
  introducedByContactId: string | null;
  eventName: string | null;
  notes: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Deal {
  id: string;
  name: string;
  companyId: string | null;
  primaryContactId: string;
  stage: Stage;
  dealType: DealType;
  channel: Channel;
  source: Source;
  eventName: string | null;
  introducedByContactId: string | null;
  qualified: boolean;
  /** 0–100. */
  probability: number;
  /** Whole currency units; no currency is stored. */
  value: number | null;
  closeReason: CloseReason | null;
  partnerStatus: PartnerStatus | null;
  currentSprintId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Interaction {
  id: string;
  dealId: string;
  userId: string | null;
  occurredAt: number;
  interactionType: InteractionType;
  result: InteractionResult;
  notes: string | null;
  conversationId: string | null;
  /** System-written (e.g. a stage change); excluded from follow-up counts. */
  automated: boolean;
  createdAt: number;
}

/** The sales-conversation worksheet for a deal. All fields optional. */
export interface Worksheet {
  id?: string;
  dealId?: string;
  // before the call (checklist)
  prepReviewed?: boolean;
  prepProblemIdentified?: boolean;
  prepOutcomeDefined?: boolean;
  prepQuestionsReady?: boolean;
  prospectName?: string | null;
  icp?: string | null;
  nextStepToAsk?: string | null;
  // during the call
  problemDescribed?: string | null;
  problemImpact?: string | null;
  desiredOutcome?: string | null;
  openQuestions?: string | null;
  outcomeToLeadWith?: string | null;
  relevantSolutionAspect?: string | null;
  checkinQuestion?: string | null;
  // objections
  objectionRaised?: string | null;
  objectionBehind?: string | null;
  objectionResponse?: string | null;
  objectionResolved?: boolean;
  // close & next step
  nextStepAsked?: string | null;
  theirResponse?: string | null;
  agreedNextAction?: string | null;
  agreedNextDate?: string | null;
  // after the call (checklist)
  postPipelineUpdated?: boolean;
  postFollowupSent?: boolean;
  postNotesCaptured?: boolean;
}

export interface Sprint {
  id: string;
  number: number;
  /** YYYY-MM-DD */
  startDate: string;
  endDate: string;
  hypothesis: string | null;
  targetInteractions: number;
  channels: Channel[];
  dealType: DealType | null;
}

export interface Tag {
  id: string;
  name: string;
  color: string | null;
}

export interface SearchHit {
  type: TaggableType;
  id: string;
  title: string;
}
