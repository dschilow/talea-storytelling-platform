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

function requireUserId(): string {
  const auth = getAuthData();
  if (!auth?.userID) {
    throw APIError.unauthenticated("Unauthorized");
  }
  return auth.userID;
}

export const getCosmosStateV2 = api<CosmosStateRequest, Awaited<ReturnType<typeof getCosmosStateForChild>>>(
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

export const ingestContentPackageV2 = api<ContentIngestRequest, Awaited<ReturnType<typeof ingestContentPackage>>>(
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

export const submitQuizV2 = api<QuizSubmitRequest, Awaited<ReturnType<typeof submitQuizForCosmos>>>(
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

export const submitRecallV2 = api<RecallSubmitRequest, Awaited<ReturnType<typeof submitRecallForCosmos>>>(
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

export const getDomainTopicsV2 = api<DomainTopicsRequest, Awaited<ReturnType<typeof getDomainTopicsForChild>>>(
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

export const getTopicTimelineV2 = api<TopicTimelineRequest, Awaited<ReturnType<typeof getTopicTimelineForChild>>>(
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

