import { getBackendUrl } from "../../config";

export interface CosmosDomainProgressDTO {
  domainId: string;
  mastery: number;
  confidence: number;
  stage: string;
  topicsExplored: number;
  lastActivityAt: string | null;
  recentHighlight?: string;
}

export interface CosmosStateDTO {
  domains: CosmosDomainProgressDTO[];
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

interface AuthOptions {
  token?: string | null;
}

function buildHeaders(token?: string | null): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchCosmosState(
  params: { avatarId: string; profileId?: string },
  auth: AuthOptions = {}
): Promise<CosmosStateDTO> {
  const base = getBackendUrl();
  const query = new URLSearchParams({ avatarId: params.avatarId });
  if (params.profileId) query.set("profileId", params.profileId);

  const response = await fetch(`${base}/avatar/cosmos-state?${query.toString()}`, {
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
