/**
 * Legacy compatibility endpoint for older frontend bundles.
 *
 * Route: POST /avatar/cosmos-quiz-submit
 * Internally delegates to the new MVP endpoint logic (`submitQuizForCosmos`),
 * so old clients write into the same modern tracking tables.
 */

import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { submitQuizForCosmos, type QuizAnswerInput } from "./cosmos-mvp-service";

interface QuizAnswerLegacy {
  questionId?: string;
  skillType?: "REMEMBER" | "UNDERSTAND" | "COMPARE" | "TRANSFER" | "EXPLAIN";
  correct?: boolean;
  difficulty?: number;
}

interface QuizSubmitLegacyRequest {
  childId?: string;
  avatarId?: string;
  profileId?: string;
  domainId: string;
  topicId?: string;
  topicTitle?: string;
  contentId?: string;
  sourceContentId?: string;
  sourceContentType?: "doku" | "story";
  answers: QuizAnswerLegacy[];
}

interface QuizSubmitLegacyResponse {
  success: boolean;
  masteryDelta: number;
  confidenceDelta: number;
  newStage: string;
  recallScheduled: boolean;
}

function toSkillType(value: unknown): string {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "remember") return "remember";
  if (raw === "understand") return "understand";
  if (raw === "compare") return "compare";
  if (raw === "apply") return "apply";
  if (raw === "transfer") return "transfer";
  if (raw === "explain") return "understand";
  return "remember";
}

function normalizeAnswers(answers: QuizAnswerLegacy[]): QuizAnswerInput[] {
  if (!Array.isArray(answers)) return [];
  return answers
    .map((answer, index) => ({
      questionId: String(answer?.questionId || `q_${index}`),
      skillType: toSkillType(answer?.skillType),
      correct: Boolean(answer?.correct),
      difficulty: Number.isFinite(Number(answer?.difficulty))
        ? Math.max(1, Math.min(5, Math.round(Number(answer?.difficulty))))
        : 1,
    }))
    .filter((entry) => entry.questionId.length > 0);
}

export const cosmosQuizSubmit = api<QuizSubmitLegacyRequest, QuizSubmitLegacyResponse>(
  { expose: true, method: "POST", path: "/avatar/cosmos-quiz-submit", auth: true },
  async (req) => {
    const auth = getAuthData();
    if (!auth?.userID) {
      throw APIError.unauthenticated("Unauthorized");
    }

    try {
      if (!req.domainId) {
        throw APIError.invalidArgument("domainId is required");
      }

      const answers = normalizeAnswers(req.answers || []);
      if (answers.length === 0) {
        throw APIError.invalidArgument("No quiz answers provided");
      }

      const result = await submitQuizForCosmos({
        userId: auth.userID,
        childId: req.childId,
        profileId: req.profileId,
        avatarId: req.avatarId,
        contentId: req.contentId,
        sourceContentId: req.sourceContentId || req.contentId,
        sourceContentType: req.sourceContentType || "doku",
        domainId: req.domainId,
        topicId: req.topicId,
        topicTitle: req.topicTitle,
        answers,
      });

      return {
        success: true,
        masteryDelta: result.masteryDelta,
        confidenceDelta: result.confidenceDelta,
        newStage: result.stage,
        recallScheduled: Boolean(result.recallTaskId),
      };
    } catch (error) {
      if (error instanceof APIError) throw error;
      console.error("[avatar] legacy cosmos-quiz-submit failed", {
        message: error instanceof Error ? error.message : String(error),
        domainId: req.domainId,
        topicId: req.topicId || null,
        avatarId: req.avatarId || null,
      });
      return {
        success: false,
        masteryDelta: 0,
        confidenceDelta: 0,
        newStage: "discovered",
        recallScheduled: false,
      };
    }
  }
);
