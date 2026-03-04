import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import {
  getCosmosStateForChild,
  getDomainTopicsForChild,
  getTopicTimelineForChild,
  ingestContentPackage,
  submitQuizForCosmos,
  submitRecallForCosmos,
  type QuizAnswerInput,
} from "./cosmos-mvp-service";

interface CosmosStateRequest {
  childId?: string;
  profileId?: string;
  avatarId?: string;
  domainId?: string;
}

interface ContentIngestRequest {
  childId?: string;
  profileId?: string;
  avatarId?: string;
  contentType?: "doku" | "story";
  contentPackage: Record<string, unknown>;
}

interface QuizSubmitRequest {
  childId?: string;
  profileId?: string;
  avatarId?: string;
  contentId?: string;
  sourceContentId?: string;
  sourceContentType?: "doku" | "story";
  domainId: string;
  topicId?: string;
  answers: QuizAnswerInput[];
}

interface RecallSubmitRequest {
  childId?: string;
  profileId?: string;
  avatarId?: string;
  recallTaskId: string;
  answers: Array<{ questionId?: string; correct?: boolean }>;
}

interface DomainTopicsRequest {
  childId?: string;
  profileId?: string;
  avatarId?: string;
  domainId: string;
}

interface TopicTimelineRequest {
  childId?: string;
  profileId?: string;
  avatarId?: string;
  topicId: string;
}

interface TopicIslandResponse {
  topicId: string;
  topicTitle: string;
  topicKind: string;
  stage: string;
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

interface CosmosDomainProgressResponse {
  domainId: string;
  evolutionIndex: number;
  planetLevel: number;
  stage: string;
  masteryScore: number;
  confidenceScore: number;
  masteryText: string;
  confidenceText: string;
  evidence: string;
  lastActivityAt: string | null;
  activeTopicCount: number;
}

interface CosmosStateResponse {
  childId: string;
  domains: CosmosDomainProgressResponse[];
  selectedDomain?: {
    domainId: string;
    activeIslands: TopicIslandResponse[];
    moreTopicsCount: number;
  };
}

interface ContentIngestResponse {
  childId: string;
  contentId: string;
  domainId: string;
  topicId: string;
  topicKind: string;
}

interface QuizSubmitResponse {
  childId: string;
  topicId: string;
  domainId: string;
  stage: string;
  mastery: number;
  confidence: number;
  masteryDelta: number;
  confidenceDelta: number;
  recallTaskId: string;
  recallDueAt: string;
  evolutionIndex: number;
  planetLevel: number;
}

interface RecallSubmitResponse {
  childId: string;
  topicId: string;
  domainId: string;
  stage: string;
  mastery: number;
  confidence: number;
  confidenceDelta: number;
  evolutionIndex: number;
  planetLevel: number;
  passed: boolean;
}

interface DomainTopicsResponse {
  childId: string;
  domainId: string;
  activeIslands: TopicIslandResponse[];
  otherTopics: TopicIslandResponse[];
}

interface TopicTimelineResponse {
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

function requireUserId(): string {
  const auth = getAuthData();
  if (!auth?.userID) {
    throw APIError.unauthenticated("Unauthorized");
  }
  return auth.userID;
}

export const getCosmosStateV2 = api<CosmosStateRequest, CosmosStateResponse>(
  { expose: true, method: "GET", path: "/api/cosmos/state", auth: true },
  async (req) => {
    const userId = requireUserId();
    return getCosmosStateForChild({
      userId,
      childId: req.childId,
      profileId: req.profileId,
      avatarId: req.avatarId,
      selectedDomainId: req.domainId,
    });
  }
);

export const ingestContentPackageV2 = api<ContentIngestRequest, ContentIngestResponse>(
  { expose: true, method: "POST", path: "/api/content/ingest", auth: true },
  async (req) => {
    const userId = requireUserId();
    if (!req.contentPackage || typeof req.contentPackage !== "object") {
      throw APIError.invalidArgument("contentPackage is required");
    }
    return ingestContentPackage({
      userId,
      childId: req.childId,
      profileId: req.profileId,
      avatarId: req.avatarId,
      contentType: req.contentType,
      contentPackage: req.contentPackage,
    });
  }
);

export const submitQuizV2 = api<QuizSubmitRequest, QuizSubmitResponse>(
  { expose: true, method: "POST", path: "/api/quiz/submit", auth: true },
  async (req) => {
    const userId = requireUserId();
    if (!req.domainId) {
      throw APIError.invalidArgument("domainId is required");
    }
    if (!Array.isArray(req.answers) || req.answers.length === 0) {
      throw APIError.invalidArgument("answers are required");
    }
    return submitQuizForCosmos({
      userId,
      childId: req.childId,
      profileId: req.profileId,
      avatarId: req.avatarId,
      contentId: req.contentId,
      sourceContentId: req.sourceContentId,
      sourceContentType: req.sourceContentType,
      domainId: req.domainId,
      topicId: req.topicId,
      answers: req.answers,
    });
  }
);

export const submitRecallV2 = api<RecallSubmitRequest, RecallSubmitResponse>(
  { expose: true, method: "POST", path: "/api/recall/submit", auth: true },
  async (req) => {
    const userId = requireUserId();
    if (!req.recallTaskId) {
      throw APIError.invalidArgument("recallTaskId is required");
    }
    if (!Array.isArray(req.answers) || req.answers.length === 0) {
      throw APIError.invalidArgument("answers are required");
    }
    return submitRecallForCosmos({
      userId,
      childId: req.childId,
      profileId: req.profileId,
      avatarId: req.avatarId,
      recallTaskId: req.recallTaskId,
      answers: req.answers,
    });
  }
);

export const getDomainTopicsV2 = api<DomainTopicsRequest, DomainTopicsResponse>(
  { expose: true, method: "GET", path: "/api/domain/:domainId/topics", auth: true },
  async (req) => {
    const userId = requireUserId();
    return getDomainTopicsForChild({
      userId,
      childId: req.childId,
      profileId: req.profileId,
      avatarId: req.avatarId,
      domainId: req.domainId,
    });
  }
);

export const getTopicTimelineV2 = api<TopicTimelineRequest, TopicTimelineResponse>(
  { expose: true, method: "GET", path: "/api/topic/:topicId/timeline", auth: true },
  async (req) => {
    const userId = requireUserId();
    return getTopicTimelineForChild({
      userId,
      childId: req.childId,
      profileId: req.profileId,
      avatarId: req.avatarId,
      topicId: req.topicId,
    });
  }
);
