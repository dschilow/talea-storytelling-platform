import { getBackendUrl } from "../../config";

export interface TopicIslandDTO {
  topicId: string;
  topicTitle: string;
  topicKind: "canonical" | "longTail";
  stage: "discovered" | "understood" | "apply" | "retained";
  mastery: number;
  confidence: number;
  masteryLabel: string;
  confidenceLabel: string;
  lastActivityAt: string | null;
  recallDueAt: string | null;
  lat: number;
  lon: number;
  docsCount: number;
}

export interface CosmosDomainProgressDTO {
  domainId: string;
  evolutionIndex: number;
  planetLevel: number;
  stage: "discovered" | "understood" | "apply" | "retained";
  masteryScore: number;
  confidenceScore: number;
  masteryText: string;
  confidenceText: string;
  evidence: string;
  lastActivityAt: string | null;
  activeTopicCount: number;
}

export interface CosmosStateDTO {
  childId: string;
  domains: CosmosDomainProgressDTO[];
  selectedDomain?: {
    domainId: string;
    activeIslands: TopicIslandDTO[];
    moreTopicsCount: number;
  };
}

export interface DomainTopicsDTO {
  childId: string;
  domainId: string;
  activeIslands: TopicIslandDTO[];
  otherTopics: TopicIslandDTO[];
}

export interface TopicTimelineDTO {
  childId: string;
  topicId: string;
  docs: Array<{
    contentId: string;
    type: "doku" | "story";
    title: string;
    createdAt: string;
  }>;
  quizAttempts: Array<{
    id: string;
    accuracy: number;
    correctCount: number;
    totalCount: number;
    createdAt: string;
  }>;
  recallTasks: Array<{
    id: string;
    dueAt: string;
    status: string;
    score: number | null;
    doneAt: string | null;
  }>;
}

export interface ParentEvidenceHighlightDTO {
  id: string;
  domainId: string;
  eventType: string;
  summary: string;
  score: number;
  maxScore: number;
  timestamp: string;
}

export interface ParentCompetencyDTO {
  domainId: string;
  skillType: string;
  mastery: number;
  confidence: number;
  stage: string;
}

export interface CosmosParentSummaryDTO {
  highlights: ParentEvidenceHighlightDTO[];
  competencies: ParentCompetencyDTO[];
  pendingRecalls: number;
  totalEvidenceEvents: number;
}

export interface TopicSuggestionItemDTO {
  suggestionId: string;
  topicTitle: string;
  topicSlug: string;
  kind: "broaden" | "deepen" | "retention";
  difficulty: number;
  teaserKid: string;
  reasonParent: string;
  skillFocus: "remember" | "understand" | "compare" | "apply" | "transfer";
}

export interface TopicSuggestionsDTO {
  domainId: string;
  generatedAt: string;
  items: TopicSuggestionItemDTO[];
}

export interface RefreshTopicSuggestionDTO {
  item: TopicSuggestionItemDTO;
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

function appendIdentity(query: URLSearchParams, params: { childId?: string; profileId?: string; avatarId?: string }) {
  if (params.childId) query.set("childId", params.childId);
  if (params.profileId) query.set("profileId", params.profileId);
  if (params.avatarId) query.set("avatarId", params.avatarId);
}

export async function fetchCosmosState(
  params: { childId?: string; profileId?: string; avatarId?: string; domainId?: string },
  auth: AuthOptions = {}
): Promise<CosmosStateDTO> {
  const base = getBackendUrl();
  const query = new URLSearchParams();
  appendIdentity(query, params);
  if (params.domainId) query.set("domainId", params.domainId);

  const response = await fetch(`${base}/api/cosmos/state?${query.toString()}`, {
    method: "GET",
    headers: buildHeaders(auth.token),
    credentials: "include",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch cosmos state (${response.status}): ${text}`);
  }

  return (await response.json()) as CosmosStateDTO;
}

export async function fetchDomainTopics(
  params: { domainId: string; childId?: string; profileId?: string; avatarId?: string },
  auth: AuthOptions = {}
): Promise<DomainTopicsDTO> {
  const base = getBackendUrl();
  const query = new URLSearchParams();
  appendIdentity(query, params);

  const response = await fetch(
    `${base}/api/domain/${encodeURIComponent(params.domainId)}/topics?${query.toString()}`,
    {
      method: "GET",
      headers: buildHeaders(auth.token),
      credentials: "include",
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch domain topics (${response.status}): ${text}`);
  }

  return (await response.json()) as DomainTopicsDTO;
}

export async function fetchTopicTimeline(
  params: { topicId: string; childId?: string; profileId?: string; avatarId?: string },
  auth: AuthOptions = {}
): Promise<TopicTimelineDTO> {
  const base = getBackendUrl();
  const query = new URLSearchParams();
  appendIdentity(query, params);

  const response = await fetch(
    `${base}/api/topic/${encodeURIComponent(params.topicId)}/timeline?${query.toString()}`,
    {
      method: "GET",
      headers: buildHeaders(auth.token),
      credentials: "include",
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch topic timeline (${response.status}): ${text}`);
  }

  return (await response.json()) as TopicTimelineDTO;
}

export async function fetchCosmosParentSummary(
  params: { avatarId: string; profileId?: string; range?: "week" | "month" | "all" },
  auth: AuthOptions = {}
): Promise<CosmosParentSummaryDTO> {
  const base = getBackendUrl();
  const query = new URLSearchParams({ avatarId: params.avatarId });
  if (params.profileId) query.set("profileId", params.profileId);
  if (params.range) query.set("range", params.range);

  const response = await fetch(`${base}/avatar/cosmos-parent-summary?${query.toString()}`, {
    method: "GET",
    headers: buildHeaders(auth.token),
    credentials: "include",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch parent summary (${response.status}): ${text}`);
  }

  return (await response.json()) as CosmosParentSummaryDTO;
}

export async function fetchTopicSuggestions(
  params: { domainId: string; childId?: string; profileId?: string; avatarId?: string },
  auth: AuthOptions = {}
): Promise<TopicSuggestionsDTO> {
  const base = getBackendUrl();
  const query = new URLSearchParams({ domainId: params.domainId });
  appendIdentity(query, params);

  const response = await fetch(`${base}/api/suggestions?${query.toString()}`, {
    method: "GET",
    headers: buildHeaders(auth.token),
    credentials: "include",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch suggestions (${response.status}): ${text}`);
  }

  return (await response.json()) as TopicSuggestionsDTO;
}

export async function refreshTopicSuggestion(
  params: { domainId: string; childId?: string; profileId?: string; avatarId?: string },
  auth: AuthOptions = {}
): Promise<RefreshTopicSuggestionDTO> {
  const base = getBackendUrl();
  const response = await fetch(`${base}/api/suggestions/refresh-one`, {
    method: "POST",
    headers: buildHeaders(auth.token),
    credentials: "include",
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to refresh suggestion (${response.status}): ${text}`);
  }

  return (await response.json()) as RefreshTopicSuggestionDTO;
}

export async function selectTopicSuggestion(
  params: {
    domainId: string;
    topicSlug: string;
    topicTitle: string;
    childId?: string;
    profileId?: string;
    avatarId?: string;
  },
  auth: AuthOptions = {}
): Promise<{ ok: true }> {
  const base = getBackendUrl();
  const response = await fetch(`${base}/api/suggestions/select`, {
    method: "POST",
    headers: buildHeaders(auth.token),
    credentials: "include",
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to select suggestion (${response.status}): ${text}`);
  }

  return (await response.json()) as { ok: true };
}
