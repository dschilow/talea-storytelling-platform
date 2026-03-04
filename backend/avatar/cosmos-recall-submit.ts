/**
 * cosmos-recall-submit.ts - Submit recall check answers.
 *
 * POST /avatar/cosmos-recall-submit
 * Updates confidence more strongly than mastery.
 */

import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { avatarDB } from "./db";
import { ensureCosmosTrackingSchema } from "./cosmos-schema";

interface RecallAnswer {
  questionId: string;
  correct: boolean;
}

interface RecallSubmitRequest {
  avatarId: string;
  profileId?: string;
  recallTaskId: string;
  answers: RecallAnswer[];
}

interface RecallSubmitResponse {
  success: boolean;
  confidenceDelta: number;
  masteryDelta: number;
  newStage: string;
}

export const cosmosRecallSubmit = api<RecallSubmitRequest, RecallSubmitResponse>(
  { expose: true, method: "POST", path: "/avatar/cosmos-recall-submit" },
  async (req) => {
    try {
      const auth = getAuthData();
      if (!auth) throw APIError.unauthenticated("Unauthorized");

      await ensureCosmosTrackingSchema().catch((schemaError) => {
        console.warn("[avatar] cosmos schema ensure skipped in recall submit", schemaError);
      });

      if (!req.avatarId || !req.recallTaskId) {
        throw APIError.invalidArgument("Missing required fields");
      }

      const task = await avatarDB.queryRow`
        SELECT id, domain_id, topic_id, source_content_id, source_content_type, status, created_at
        FROM recall_tasks
        WHERE id = ${req.recallTaskId} AND avatar_id = ${req.avatarId}
      `;

      if (!task) throw APIError.notFound("Recall task not found");
      if (task.status !== "pending") throw APIError.invalidArgument("Recall task already completed");

      const answers = Array.isArray(req.answers)
        ? req.answers.map((answer, index) => ({
            questionId: String(answer?.questionId || `q_${index}`),
            correct: Boolean(answer?.correct),
          }))
        : [];
      if (answers.length === 0) {
        throw APIError.invalidArgument("No recall answers provided");
      }

      const totalQuestions = answers.length;
      const correctAnswers = answers.filter((answer) => answer.correct).length;
      const score = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

      const confidenceDelta = Math.round((score / 100) * 10 * 10) / 10;
      const masteryDelta = Math.round((score / 100) * 2 * 10) / 10;

      const existing = await avatarDB.queryRow`
        SELECT mastery, confidence FROM competency_state
        WHERE avatar_id = ${req.avatarId}
          AND domain_id = ${task.domain_id}
          AND COALESCE(topic_id, '') = ${task.topic_id || ""}
          AND skill_type = 'REMEMBER'
      `;

      const currentMastery = existing ? Number(existing.mastery) : 0;
      const currentConfidence = existing ? Number(existing.confidence) : 0;
      const newMastery = Math.min(100, currentMastery + masteryDelta);
      const newConfidence = Math.min(100, currentConfidence + confidenceDelta);
      const newStage = computeStage(newMastery, newConfidence);

      const id = `cs_${req.avatarId}_${task.domain_id}_${task.topic_id || "general"}_overall`;

      await avatarDB.exec`
        INSERT INTO competency_state (id, avatar_id, profile_id, domain_id, topic_id, skill_type, mastery, confidence, stage, last_activity_at, updated_at)
        VALUES (${id}, ${req.avatarId}, ${req.profileId ?? null}, ${task.domain_id}, ${task.topic_id ?? null}, 'REMEMBER', ${newMastery}, ${newConfidence}, ${newStage}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (avatar_id, domain_id, (COALESCE(topic_id, '')), skill_type)
        DO UPDATE SET
          mastery = LEAST(100, competency_state.mastery + ${masteryDelta}),
          confidence = LEAST(100, competency_state.confidence + ${confidenceDelta}),
          stage = ${newStage},
          last_activity_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      `;

      await avatarDB.exec`
        UPDATE recall_tasks
        SET status = 'completed', completed_at = CURRENT_TIMESTAMP, score = ${score}
        WHERE id = ${req.recallTaskId}
      `;

      const eventId = `ev_recall_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await avatarDB.exec`
        INSERT INTO evidence_events (id, avatar_id, profile_id, domain_id, topic_id, event_type, skill_type, score, max_score, payload, source_content_id, source_content_type)
        VALUES (
          ${eventId},
          ${req.avatarId},
          ${req.profileId ?? null},
          ${task.domain_id},
          ${task.topic_id ?? null},
          'recall',
          'REMEMBER',
          ${score},
          ${100},
          ${JSON.stringify({
            answers: totalQuestions,
            correct: correctAnswers,
            daysAfterLearning: Math.round((Date.now() - new Date(task.created_at || Date.now()).getTime()) / 86400000),
            summary: `Recall: ${correctAnswers}/${totalQuestions}`,
          })},
          ${task.source_content_id},
          ${task.source_content_type}
        )
      `;

      return {
        success: true,
        confidenceDelta,
        masteryDelta,
        newStage,
      };
    } catch (error: any) {
      const message = error?.message || String(error);
      console.error("[avatar] cosmos-recall-submit failed", {
        avatarId: req.avatarId,
        recallTaskId: req.recallTaskId,
        message,
      });
      if (error instanceof APIError) {
        throw error;
      }
      return {
        success: false,
        confidenceDelta: 0,
        masteryDelta: 0,
        newStage: "discovered",
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
