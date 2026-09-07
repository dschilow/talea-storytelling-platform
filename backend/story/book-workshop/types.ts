/** Independent book engine. No dependency on any previous generation lane. */
export type AgeBand = "3-5" | "6-8" | "9-12" | "13+";
export interface Person {
  id: string;
  name: string;
  description: string;
  voice: string[];
  motivation: string;
  quirk: string;
  settings: string[];
  imageUrl?: string;
  appearance: string;
}
export interface Artifact {
  id: string;
  name: string;
  rule: string;
  imageUrl?: string;
  appearance: string;
  broughtBy?: string;
}
export interface BookBrief {
  seed: string;
  ageBand: AgeBand;
  language: string;
  length: "short" | "medium" | "long";
  heroes: Person[];
  candidates: Person[];
  artifacts: Artifact[];
  /** Narrative Wizard settings, including parental guidance. Never raw credentials. */
  wishes: Record<string, unknown>;
  recentPremises: string[];
  blockedTerms: string[];
}
export interface BookPlan {
  premise: string;
  childWants: string;
  whyItMatters: string;
  worldRule: string | null;
  castIds: string[];
  artifactId: string | null;
  /** Every selected avatar has a distinct contribution. */
  heroActions: Array<{ heroId: string; contribution: string }>;
  places: string[];
  beats: Array<{ page: number; place: string; action: string; cause: string; result: string }>;
  ending: string;
}
export interface Illustration {
  /** One instant visible on this page, in English. No future events. */
  scene: string;
  castIds: string[];
  artifactVisible: boolean;
}
export interface BookPage {
  order: number;
  text: string;
  illustration: Illustration;
}
export interface Manuscript {
  title: string;
  description: string;
  pages: BookPage[];
}
export interface Evidence { page: number; quote: string }
export interface ReadingAnswer {
  answer: string;
  evidence: Evidence[];
}
export interface BookReview {
  /** Answer from prose alone. Null means the text does not explain it. */
  comprehension: {
    want: ReadingAnswer | null;
    obstacle: ReadingAnswer | null;
    solution: ReadingAnswer | null;
    outcome: ReadingAnswer | null;
  };
  scores: { clarity: number; causality: number; agency: number; readAloud: number; engagement: number; humor: number };
  issues: Array<{ severity: "blocker" | "suggestion"; page: number; problem: string; fix: string }>;
  /** A reviewer checks these against the prose, not the planning notes. */
  heroActions: Array<{ heroId: string; evidence: Evidence[] }>;
  imageIssues: Array<{ page: number; problem: string }>;
  developments: Array<{ heroId: string; trait: string; change: number; description: string; evidence: Evidence[] }>;
  artifactEvidence: { discovery: Evidence; use: Evidence } | null;
}
export interface ModelPrice { inputPerMillion: number; outputPerMillion: number }
export interface CompletionRequest {
  model: string;
  price: ModelPrice;
  system: string;
  user: string;
  maxTokens: number;
  signal: AbortSignal;
}
export interface Completion {
  text: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUSD?: number;
  finishReason: string;
}
export type Transport = (request: CompletionRequest) => Promise<Completion>;
export interface StageReceipt {
  stage: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  /** Interpreted with costSource: reserved-unknown is NOT a reported charge. */
  costUSD: number;
  costSource: "provider" | "estimate" | "reserved-unknown";
  status: "received" | "failed";
  durationMs: number;
}
export interface BookResult {
  pipeline: "book-workshop-v1";
  status: "accepted" | "rejected";
  plan?: BookPlan;
  manuscript?: Manuscript;
  review?: BookReview;
  manuscriptHash?: string;
  issues: string[];
  receipts: StageReceipt[];
  /** Provider-reported charges plus labelled token estimates; excludes holds. */
  textCostUSD: number;
  providerTextCostUSD: number;
  estimatedTextCostUSD: number;
  reservedUnknownUSD: number;
  budgetCommittedUSD: number;
  accountingComplete: boolean;
}
