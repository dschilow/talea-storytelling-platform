/**
 * cosmos-quiz-submit.ts - Submit quiz answers and update competency
 *
 * POST /avatar/cosmos-quiz-submit
 * Processes quiz answers, creates evidence events, updates mastery/confidence,
 * and schedules recall tasks.
 */

import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { avatarDB } from "./db";
import { ensureCosmosTrackingSchema } from "./cosmos-schema";

interface QuizAnswer {
  questionId: string;
  skillType: "REMEMBER" | "UNDERSTAND" | "COMPARE" | "TRANSFER" | "EXPLAIN";
  correct: boolean;
  difficulty: number;
}

interface QuizSubmitRequest {
  avatarId: string;
  profileId?: string;
  domainId: string;
  topicId?: string;
  sourceContentId: string;
  sourceContentType: "doku" | "story";
  answers: QuizAnswer[];
}

interface QuizSubmitResponse {
  success: boolean;
  masteryDelta: number;
  confidenceDelta: number;
  newStage: string;
  recallScheduled: boolean;
}

const ALLOWED_SKILL_TYPES = new Set<QuizAnswer["skillType"]>([
  "REMEMBER",
  "UNDERSTAND",
  "COMPARE",
  "TRANSFER",
  "EXPLAIN",
]);

function clampDifficulty(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(5, Math.round(parsed)));
}

const SKILL_WEIGHTS: Record<QuizAnswer["skillType"], number> = {
  REMEMBER: 1.0,
  UNDERSTAND: 1.5,
  COMPARE: 2.0,
  TRANSFER: 2.5,
  EXPLAIN: 3.0,
};

export const cosmosQuizSubmit = api<QuizSubmitRequest, QuizSubmitResponse>(
  { expose: true, method: "POST", path: "/avatar/cosmos-quiz-submit" },
  async (req) => {
    try {
      const auth = getAuthData();
      if (!auth) throw APIError.unauthenticated("Unauthorized");

      await ensureCosmosTrackingSchema().catch((schemaError) => {
        console.warn("[avatar] cosmos schema ensure skipped in quiz submit", schemaError);
      });

      if (!req.avatarId || !req.domainId || !req.sourceContentId || !req.sourceContentType) {
        throw APIError.invalidArgument("Missing required fields");
      }

      const answers = Array.isArray(req.answers)
        ? req.answers
            .map((answer, index) => {
              const skillType = ALLOWED_SKILL_TYPES.has(answer?.skillType)
                ? answer.skillType
                : "REMEMBER";
              return {
                questionId: String(answer?.questionId || `q_${index}`),
                skillType,
                correct: Boolean(answer?.correct),
                difficulty: clampDifficulty(answer?.difficulty),
              } as QuizAnswer;
            })
            .filter((answer) => answer.questionId.length > 0)
        : [];

      if (answers.length === 0) {
        throw APIError.invalidArgument("No quiz answers provided");
      }

      const totalQuestions = answers.length;
      const correctAnswers = answers.filter((a) => a.correct).length;
      const score = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

      let weightedScore = 0;
      let maxWeightedScore = 0;
      for (const answer of answers) {
        const weight = SKILL_WEIGHTS[answer.skillType] ?? 1;
        maxWeightedScore += weight * answer.difficulty;
        if (answer.correct) {
          weightedScore += weight * answer.difficulty;
        }
      }

      const normalizedScore = maxWeightedScore > 0 ? (weightedScore / maxWeightedScore) * 100 : 0;
      const masteryDelta = Math.round((normalizedScore / 100) * 8 * 10) / 10;
      const confidenceDelta = Math.round((score / 100) * 3 * 10) / 10;

      const overallId = `cs_${req.avatarId}_${req.domainId}_${req.topicId || "general"}_overall`;

      const existing = await avatarDB.queryRow`
        SELECT mastery, confidence FROM competency_state
        WHERE avatar_id = ${req.avatarId}
          AND domain_id = ${req.domainId}
          AND COALESCE(topic_id, '') = ${req.topicId || ""}
          AND skill_type = 'REMEMBER'
        LIMIT 1
      `;

      const currentMastery = existing ? Number(existing.mastery) || 0 : 0;
      const currentConfidence = existing ? Number(existing.confidence) || 0 : 0;
      const newMastery = Math.min(100, currentMastery + masteryDelta);
      const newConfidence = Math.min(100, currentConfidence + confidenceDelta);
      const newStage = computeStage(newMastery, newConfidence);

      await avatarDB.exec`
        INSERT INTO competency_state (
          id, avatar_id, profile_id, domain_id, topic_id, skill_type, mastery, confidence, stage, topics_explored, last_activity_at, updated_at
        )
        VALUES (
          ${overallId}, ${req.avatarId}, ${req.profileId ?? null}, ${req.domainId}, ${req.topicId ?? null}, 'REMEMBER', ${newMastery}, ${newConfidence}, ${newStage}, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT (avatar_id, domain_id, (COALESCE(topic_id, '')), skill_type)
        DO UPDATE SET
          mastery = LEAST(100, competency_state.mastery + ${masteryDelta}),
          confidence = LEAST(100, competency_state.confidence + ${confidenceDelta}),
          stage = ${newStage},
          topics_explored = competency_state.topics_explored + 1,
          last_activity_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      `;

      for (const answer of answers) {
        const skillId = `cs_${req.avatarId}_${req.domainId}_${req.topicId || "general"}_${answer.skillType}`;
        const skillDelta = answer.correct ? (SKILL_WEIGHTS[answer.skillType] ?? 1) * 2 : 0;

        await avatarDB.exec`
          INSERT INTO competency_state (
            id, avatar_id, profile_id, domain_id, topic_id, skill_type, mastery, confidence, stage, last_activity_at, updated_at
          )
          VALUES (
            ${skillId}, ${req.avatarId}, ${req.profileId ?? null}, ${req.domainId}, ${req.topicId ?? null}, ${answer.skillType}, ${Math.min(100, skillDelta)}, ${answer.correct ? 2 : 0}, ${answer.correct ? "understood" : "discovered"}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          ON CONFLICT (avatar_id, domain_id, (COALESCE(topic_id, '')), skill_type)
          DO UPDATE SET
            mastery = LEAST(100, competency_state.mastery + ${skillDelta}),
            confidence = LEAST(100, competency_state.confidence + ${answer.correct ? 2 : 0}),
            last_activity_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        `;
      }

      const skillBreakdown = answers.reduce((acc, answer) => {
        acc[answer.skillType] = (acc[answer.skillType] || 0) + (answer.correct ? 1 : 0);
        return acc;
      }, {} as Record<string, number>);

      await avatarDB.exec`
        INSERT INTO evidence_events (
          id, avatar_id, profile_id, domain_id, topic_id, event_type, skill_type, score, max_score, payload, source_content_id, source_content_type
        )
        VALUES (
          ${`ev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`},
          ${req.avatarId},
          ${req.profileId ?? null},
          ${req.domainId},
          ${req.topicId ?? null},
          'quiz',
          'REMEMBER',
          ${score},
          ${100},
          ${JSON.stringify({
            answers: answers.length,
            correct: correctAnswers,
            skillBreakdown,
            summary: `Quiz: ${correctAnswers}/${totalQuestions} richtig`,
          })},
          ${req.sourceContentId},
          ${req.sourceContentType}
        )
      `;

      const recallDays = 3 + Math.floor(Math.random() * 5);
      const dueAt = new Date(Date.now() + recallDays * 24 * 60 * 60 * 1000);

      await avatarDB.exec`
        INSERT INTO recall_tasks (
          id, avatar_id, profile_id, domain_id, topic_id, source_content_id, source_content_type, due_at
        )
        VALUES (
          ${`recall_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`},
          ${req.avatarId},
          ${req.profileId ?? null},
          ${req.domainId},
          ${req.topicId ?? null},
          ${req.sourceContentId},
          ${req.sourceContentType},
          ${dueAt.toISOString()}
        )
      `;

      return {
        success: true,
        masteryDelta,
        confidenceDelta,
        newStage,
        recallScheduled: true,
      };
    } catch (error: any) {
      const message = error?.message || String(error);
      console.error("[avatar] cosmos-quiz-submit failed", {
        avatarId: req.avatarId,
        domainId: req.domainId,
        topicId: req.topicId || null,
        answersCount: Array.isArray(req.answers) ? req.answers.length : 0,
        message,
        code: error?.code,
        stack: error?.stack?.substring(0, 500),
      });

      // Only re-throw APIError instances, not database errors
      if (error instanceof APIError) {
        throw error;
      }
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

function computeStage(mastery: number, confidence: number): string {
  if (mastery >= 80 && confidence >= 65) return "mastered";
  if (mastery >= 55 && confidence >= 40) return "can_explain";
  if (mastery >= 25 && confidence >= 15) return "understood";
  return "discovered";
}
