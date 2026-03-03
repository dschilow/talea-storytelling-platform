/**
 * cosmos-quiz-submit.ts - Submit quiz answers and update competency
 *
 * POST /avatar/cosmos-quiz-submit
 * Processes quiz answers, creates evidence events, updates mastery/confidence,
 * and schedules recall tasks.
 */

import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { avatarDB } from "./db";

interface QuizAnswer {
  questionId: string;
  skillType: 'REMEMBER' | 'UNDERSTAND' | 'COMPARE' | 'TRANSFER' | 'EXPLAIN';
  correct: boolean;
  difficulty: number; // 1–5
}

interface QuizSubmitRequest {
  avatarId: string;
  profileId?: string;
  domainId: string;
  topicId?: string;
  sourceContentId: string;
  sourceContentType: 'doku' | 'story';
  answers: QuizAnswer[];
}

interface QuizSubmitResponse {
  success: boolean;
  masteryDelta: number;
  confidenceDelta: number;
  newStage: string;
  recallScheduled: boolean;
}

export const cosmosQuizSubmit = api<QuizSubmitRequest, QuizSubmitResponse>(
  { expose: true, method: "POST", path: "/avatar/cosmos-quiz-submit" },
  async (req) => {
    const auth = getAuthData();
    if (!auth) throw new Error("Unauthorized");

    const totalQuestions = req.answers.length;
    const correctAnswers = req.answers.filter(a => a.correct).length;
    const score = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

    // Weighted score by skill type difficulty
    const skillWeights: Record<string, number> = {
      REMEMBER: 1.0,
      UNDERSTAND: 1.5,
      COMPARE: 2.0,
      TRANSFER: 2.5,
      EXPLAIN: 3.0,
    };

    let weightedScore = 0;
    let maxWeightedScore = 0;
    for (const answer of req.answers) {
      const weight = skillWeights[answer.skillType] ?? 1;
      maxWeightedScore += weight * answer.difficulty;
      if (answer.correct) {
        weightedScore += weight * answer.difficulty;
      }
    }

    const normalizedScore = maxWeightedScore > 0
      ? (weightedScore / maxWeightedScore) * 100
      : 0;

    // Calculate deltas
    // Mastery increases more for higher skill types
    const masteryDelta = Math.round((normalizedScore / 100) * 8 * 10) / 10; // 0–8 points
    // Confidence increases less from a single quiz (need repeated measurements)
    const confidenceDelta = Math.round((score / 100) * 3 * 10) / 10; // 0–3 points

    // Upsert competency state
    const id = `cs_${req.avatarId}_${req.domainId}_${req.topicId || 'general'}_overall`;

    // Get current state
    const existing = await avatarDB.queryRow`
      SELECT mastery, confidence FROM competency_state
      WHERE avatar_id = ${req.avatarId}
        AND domain_id = ${req.domainId}
        AND COALESCE(topic_id, '') = ${req.topicId || ''}
        AND skill_type = 'REMEMBER'
    `;

    let currentMastery = 0;
    let currentConfidence = 0;
    if (existing) {
      currentMastery = Number(existing.mastery) || 0;
      currentConfidence = Number(existing.confidence) || 0;
    }

    const newMastery = Math.min(100, currentMastery + masteryDelta);
    const newConfidence = Math.min(100, currentConfidence + confidenceDelta);
    const newStage = computeStage(newMastery, newConfidence);

    // Upsert into competency_state (one row per avatar+domain for overall tracking)
    await avatarDB.exec`
      INSERT INTO competency_state (id, avatar_id, profile_id, domain_id, topic_id, skill_type, mastery, confidence, stage, topics_explored, last_activity_at, updated_at)
      VALUES (${id}, ${req.avatarId}, ${req.profileId ?? null}, ${req.domainId}, ${req.topicId ?? null}, 'REMEMBER', ${newMastery}, ${newConfidence}, ${newStage}, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (avatar_id, domain_id, COALESCE(topic_id, ''), skill_type)
      DO UPDATE SET
        mastery = LEAST(100, competency_state.mastery + ${masteryDelta}),
        confidence = LEAST(100, competency_state.confidence + ${confidenceDelta}),
        stage = ${newStage},
        topics_explored = competency_state.topics_explored + 1,
        last_activity_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    `;

    // Also upsert per skill_type for detailed tracking
    for (const answer of req.answers) {
      const skillId = `cs_${req.avatarId}_${req.domainId}_${req.topicId || 'general'}_${answer.skillType}`;
      const skillDelta = answer.correct ? (skillWeights[answer.skillType] ?? 1) * 2 : 0;

      await avatarDB.exec`
        INSERT INTO competency_state (id, avatar_id, profile_id, domain_id, topic_id, skill_type, mastery, confidence, stage, last_activity_at, updated_at)
        VALUES (${skillId}, ${req.avatarId}, ${req.profileId ?? null}, ${req.domainId}, ${req.topicId ?? null}, ${answer.skillType}, ${Math.min(100, skillDelta)}, ${answer.correct ? 2 : 0}, ${answer.correct ? 'understood' : 'discovered'}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (avatar_id, domain_id, COALESCE(topic_id, ''), skill_type)
        DO UPDATE SET
          mastery = LEAST(100, competency_state.mastery + ${skillDelta}),
          confidence = LEAST(100, competency_state.confidence + ${answer.correct ? 2 : 0}),
          last_activity_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      `;
    }

    // Create evidence event
    const eventId = `ev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const skillBreakdown = req.answers.reduce((acc, a) => {
      acc[a.skillType] = (acc[a.skillType] || 0) + (a.correct ? 1 : 0);
      return acc;
    }, {} as Record<string, number>);

    await avatarDB.exec`
      INSERT INTO evidence_events (id, avatar_id, profile_id, domain_id, topic_id, event_type, skill_type, score, max_score, payload, source_content_id, source_content_type)
      VALUES (
        ${eventId},
        ${req.avatarId},
        ${req.profileId ?? null},
        ${req.domainId},
        ${req.topicId ?? null},
        'quiz',
        'REMEMBER',
        ${score},
        ${100},
        ${JSON.stringify({ answers: req.answers.length, correct: correctAnswers, skillBreakdown, summary: `Quiz: ${correctAnswers}/${totalQuestions} richtig` })},
        ${req.sourceContentId},
        ${req.sourceContentType}
      )
    `;

    // Schedule recall task (3–7 days from now)
    const recallDays = 3 + Math.floor(Math.random() * 5); // 3–7 days
    const dueAt = new Date(Date.now() + recallDays * 24 * 60 * 60 * 1000);
    const recallId = `recall_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    await avatarDB.exec`
      INSERT INTO recall_tasks (id, avatar_id, profile_id, domain_id, topic_id, source_content_id, source_content_type, due_at)
      VALUES (${recallId}, ${req.avatarId}, ${req.profileId ?? null}, ${req.domainId}, ${req.topicId ?? null}, ${req.sourceContentId}, ${req.sourceContentType}, ${dueAt.toISOString()})
    `;

    return {
      success: true,
      masteryDelta,
      confidenceDelta,
      newStage,
      recallScheduled: true,
    };
  }
);

function computeStage(mastery: number, confidence: number): string {
  if (mastery >= 80 && confidence >= 65) return 'mastered';
  if (mastery >= 55 && confidence >= 40) return 'can_explain';
  if (mastery >= 25 && confidence >= 15) return 'understood';
  return 'discovered';
}
