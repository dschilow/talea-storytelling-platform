import { getBackendUrl } from "../../config";

export type CosmosSkillType =
  | "REMEMBER"
  | "UNDERSTAND"
  | "COMPARE"
  | "APPLY"
  | "TRANSFER"
  | "EXPLAIN";

export interface CosmosQuizAnswerDTO {
  questionId: string;
  skillType: CosmosSkillType;
  correct: boolean;
  difficulty: number;
}

export interface SubmitCosmosQuizPayload {
  childId?: string;
  avatarId?: string;
  profileId?: string;
  domainId: string;
  topicId?: string;
  contentId?: string;
  sourceContentId?: string;
  sourceContentType?: "doku" | "story";
  answers: CosmosQuizAnswerDTO[];
}

export interface SubmitCosmosRecallPayload {
  childId?: string;
  avatarId?: string;
  profileId?: string;
  recallTaskId: string;
  answers: Array<{ questionId: string; correct: boolean }>;
}

interface AuthOptions {
  token?: string | null;
}

function buildHeaders(token?: string | null): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function submitCosmosQuiz(
  payload: SubmitCosmosQuizPayload,
  auth: AuthOptions = {}
): Promise<{
  success: boolean;
  masteryDelta: number;
  confidenceDelta: number;
  newStage: string;
  recallScheduled: boolean;
}> {
  const response = await fetch(`${getBackendUrl()}/api/quiz/submit`, {
    method: "POST",
    headers: buildHeaders(auth.token),
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to submit cosmos quiz (${response.status}): ${text}`);
  }

  const body = (await response.json()) as {
    stage?: string;
    masteryDelta?: number;
    confidenceDelta?: number;
  };

  return {
    success: true,
    masteryDelta: Number(body.masteryDelta) || 0,
    confidenceDelta: Number(body.confidenceDelta) || 0,
    newStage: body.stage || "discovered",
    recallScheduled: true,
  };
}

export async function submitCosmosRecall(
  payload: SubmitCosmosRecallPayload,
  auth: AuthOptions = {}
): Promise<{
  success: boolean;
  confidenceDelta: number;
  masteryDelta: number;
  newStage: string;
}> {
  const response = await fetch(`${getBackendUrl()}/api/recall/submit`, {
    method: "POST",
    headers: buildHeaders(auth.token),
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to submit cosmos recall (${response.status}): ${text}`);
  }

  const body = (await response.json()) as {
    stage?: string;
    confidenceDelta?: number;
  };

  return {
    success: true,
    confidenceDelta: Number(body.confidenceDelta) || 0,
    masteryDelta: 0,
    newStage: body.stage || "discovered",
  };
}

export function inferDomainFromDokuTopic(params: {
  topic?: string;
  perspective?: string;
  title?: string;
  sectionTitle?: string;
}): string {
  const value = `${params.topic || ""} ${params.perspective || ""} ${params.title || ""} ${params.sectionTitle || ""}`.toLowerCase();
  const map: Array<{ keywords: string[]; domainId: string }> = [
    { keywords: ["astronom", "weltraum", "galax", "planet", "stern", "kosmos"], domainId: "space" },
    { keywords: ["natur", "tier", "bio", "pflanz", "zool"], domainId: "nature" },
    { keywords: ["geschichte", "kultur", "antike", "histor"], domainId: "history" },
    { keywords: ["technik", "erfind", "physik", "robot", "maschine"], domainId: "tech" },
    { keywords: ["mensch", "koerper", "korper", "medizin", "gesund"], domainId: "body" },
    { keywords: ["erde", "geografie", "geographie", "klima", "wetter", "ozean"], domainId: "earth" },
    { keywords: ["kunst", "musik", "malerei", "kompon"], domainId: "arts" },
    { keywords: ["mathe", "logik", "raetsel", "ratsel", "algorithm"], domainId: "logic" },
  ];

  for (const entry of map) {
    if (entry.keywords.some((keyword) => value.includes(keyword))) {
      return entry.domainId;
    }
  }
  return "history";
}

export function buildTopicId(params: {
  sourceContentType: "doku" | "story";
  sourceContentId: string;
  domainId: string;
  label?: string;
}): string {
  const sanitizedLabel = String(params.label || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 72);
  const suffix = sanitizedLabel || params.sourceContentId.slice(0, 12);
  const normalizedDomain = params.domainId === "art" ? "arts" : params.domainId;
  return `${normalizedDomain}_${suffix}`;
}

export function inferSkillTypeFromQuestion(question: string): CosmosSkillType {
  const value = question.toLowerCase();
  if (/(warum|weshalb|wie entsteht|ursache|folge)/.test(value)) return "UNDERSTAND";
  if (/(vergleiche|unterschied|gemeinsamkeit|einordnen)/.test(value)) return "COMPARE";
  if (/(anwenden|situation|wenn .* dann|was waere|was wäre)/.test(value)) return "APPLY";
  if (/(erklaere|erklare|in eigenen worten|begruende)/.test(value)) return "UNDERSTAND";
  return "REMEMBER";
}

export function inferDifficultyFromQuestion(question: string, optionsCount: number): number {
  const value = question.toLowerCase();
  let score = 2;
  if (/(warum|weshalb|erklaere|erklare|begruende|vergleiche|anwenden)/.test(value)) score += 1;
  if (/(in eigenen worten|transfer|hypothese|schlussfolger)/.test(value)) score += 1;
  if (optionsCount >= 4) score += 1;
  return Math.max(1, Math.min(5, score));
}

