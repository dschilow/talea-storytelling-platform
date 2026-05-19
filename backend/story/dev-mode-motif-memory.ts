/**
 * Long-Term Motif Memory (v11 Section 3)
 *
 * The in-memory `recentStoryCount = 8` window only protects against the
 * freshest week of activity. After that, the gate forgets, and the
 * "Treppenhaus + Jahreszeiten + Frühling steckt fest" double-up that
 * triggered this whole rewrite is allowed back in.
 *
 * This module:
 *   1. records a structural fingerprint for every successful story
 *   2. exposes a similarity query against the last N (default 50) stories
 *   3. classifies any hit into core / supporting / metadata so the gate
 *      knows whether to reject or just sanitize
 *
 * It is intentionally light-weight: no embeddings, no vector DB. We use
 * keyword Jaccard plus a small set of structural fields (centralPlace,
 * magicRule, emotionalEngine, finalImage) because those are exactly the
 * fields the LLM is told to fill in the blueprint stage. If two stories
 * agree on `centralPlace` and `magicRule`, that is a core-motif reuse
 * regardless of how the prose is dressed.
 */

import { storyDB } from "./db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StoryMotifFingerprint {
  storyId: string;
  title: string;
  description: string;
  corePremise: string;
  centralObject: string;
  centralPlace: string;
  magicRule: string;
  emotionalEngine: string;
  antagonistProblem: string;
  finalImage: string;
  motifTags: string[];
  motifKeywords: string[];
}

export interface MotifMemoryRecord extends StoryMotifFingerprint {
  id: string;
  userId: string;
  createdAt: Date;
  pipelineVersion: string | null;
}

export interface MotifSimilarityHit {
  record: MotifMemoryRecord;
  similarity: number;
  similarFields: string[];
  classification: "core_reuse" | "supporting_reuse" | "incidental";
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const RECENT_LOOKBACK_LIMIT = 100;

/**
 * Record a story's motif fingerprint. Idempotent on `story_id` — re-recording
 * the same story updates the existing row.
 */
export async function recordStoryMotif(
  fingerprint: StoryMotifFingerprint,
  userId: string,
  pipelineVersion: string,
): Promise<void> {
  await storyDB.exec`
    INSERT INTO story_motif_memory (
      story_id, user_id, title, description,
      core_premise, central_object, central_place,
      magic_rule, emotional_engine, antagonist_problem, final_image,
      motif_tags, motif_keywords, pipeline_version
    ) VALUES (
      ${fingerprint.storyId}, ${userId}, ${fingerprint.title}, ${fingerprint.description},
      ${fingerprint.corePremise}, ${fingerprint.centralObject}, ${fingerprint.centralPlace},
      ${fingerprint.magicRule}, ${fingerprint.emotionalEngine}, ${fingerprint.antagonistProblem}, ${fingerprint.finalImage},
      ${fingerprint.motifTags}, ${fingerprint.motifKeywords}, ${pipelineVersion}
    )
    ON CONFLICT (story_id) DO UPDATE SET
      title              = EXCLUDED.title,
      description        = EXCLUDED.description,
      core_premise       = EXCLUDED.core_premise,
      central_object     = EXCLUDED.central_object,
      central_place      = EXCLUDED.central_place,
      magic_rule         = EXCLUDED.magic_rule,
      emotional_engine   = EXCLUDED.emotional_engine,
      antagonist_problem = EXCLUDED.antagonist_problem,
      final_image        = EXCLUDED.final_image,
      motif_tags         = EXCLUDED.motif_tags,
      motif_keywords     = EXCLUDED.motif_keywords,
      pipeline_version   = EXCLUDED.pipeline_version
  `;
}

/**
 * Load the most recent N motif fingerprints for a user. Default 50 matches
 * the spec; cap at 100 so a chatty user does not blow up the candidate
 * comparison loop.
 */
export async function loadRecentMotifs(userId: string, limit = 50): Promise<MotifMemoryRecord[]> {
  const cap = Math.min(Math.max(limit, 1), RECENT_LOOKBACK_LIMIT);
  const rows = await storyDB.queryAll<{
    id: string;
    story_id: string;
    user_id: string;
    created_at: Date;
    title: string;
    description: string | null;
    core_premise: string | null;
    central_object: string | null;
    central_place: string | null;
    magic_rule: string | null;
    emotional_engine: string | null;
    antagonist_problem: string | null;
    final_image: string | null;
    motif_tags: string[] | null;
    motif_keywords: string[] | null;
    pipeline_version: string | null;
  }>`
    SELECT id, story_id, user_id, created_at,
           title, description,
           core_premise, central_object, central_place,
           magic_rule, emotional_engine, antagonist_problem, final_image,
           motif_tags, motif_keywords, pipeline_version
    FROM story_motif_memory
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${cap}
  `;
  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    createdAt: row.created_at,
    pipelineVersion: row.pipeline_version,
    storyId: row.story_id,
    title: row.title,
    description: row.description ?? "",
    corePremise: row.core_premise ?? "",
    centralObject: row.central_object ?? "",
    centralPlace: row.central_place ?? "",
    magicRule: row.magic_rule ?? "",
    emotionalEngine: row.emotional_engine ?? "",
    antagonistProblem: row.antagonist_problem ?? "",
    finalImage: row.final_image ?? "",
    motifTags: row.motif_tags ?? [],
    motifKeywords: row.motif_keywords ?? [],
  }));
}

// ---------------------------------------------------------------------------
// Similarity
// ---------------------------------------------------------------------------

function normalize(value: string): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalize(value)
    .split(/\s+/)
    .filter((tok) => tok.length >= 4);
}

const FIELD_STOPWORDS = new Set([
  "der", "die", "das", "den", "dem", "des", "ein", "eine", "und", "oder",
  "von", "zum", "zur", "ins", "mit", "ohne", "fuer", "im", "am", "auf",
  "story", "geschichte", "kapitel",
]);

function fieldOverlap(a: string, b: string): number {
  const ta = new Set(tokenize(a).filter((t) => !FIELD_STOPWORDS.has(t)));
  const tb = new Set(tokenize(b).filter((t) => !FIELD_STOPWORDS.has(t)));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Compute per-field similarity between a candidate and one historic record.
 *
 * Fields weighted by structural importance (per spec §3):
 *   centralPlace   1.4
 *   magicRule      1.4
 *   centralObject  1.2
 *   emotionalEngine 1.0
 *   finalImage     1.0
 *   corePremise    1.5  (counts twice in practice because it includes the others)
 */
const FIELD_WEIGHTS: Record<keyof StoryMotifFingerprint, number> = {
  storyId: 0,
  title: 0.5,
  description: 0.3,
  corePremise: 1.5,
  centralObject: 1.2,
  centralPlace: 1.4,
  magicRule: 1.4,
  emotionalEngine: 1.0,
  antagonistProblem: 0.6,
  finalImage: 1.0,
  motifTags: 0,
  motifKeywords: 0,
};

export function compareFingerprints(
  candidate: StoryMotifFingerprint,
  record: MotifMemoryRecord,
): { similarity: number; similarFields: string[] } {
  const similarFields: string[] = [];
  let weightedSum = 0;
  let weightTotal = 0;
  const fieldKeys: Array<keyof StoryMotifFingerprint> = [
    "title", "corePremise", "centralObject", "centralPlace",
    "magicRule", "emotionalEngine", "antagonistProblem", "finalImage",
  ];
  for (const key of fieldKeys) {
    const weight = FIELD_WEIGHTS[key];
    if (weight <= 0) continue;
    const overlap = fieldOverlap(String(candidate[key] || ""), String(record[key] || ""));
    if (overlap >= 0.45) similarFields.push(`${key}=${overlap.toFixed(2)}`);
    weightedSum += overlap * weight;
    weightTotal += weight;
  }
  const similarity = weightTotal === 0 ? 0 : weightedSum / weightTotal;
  return { similarity, similarFields };
}

/**
 * Find motif-reuse hits against the recent N stories. The classification
 * tier is decided by which fields and how many overlap; the orchestrator
 * uses this to decide whether to hard-reject a candidate or just warn.
 */
export function findMotifReuse(
  candidate: StoryMotifFingerprint,
  records: MotifMemoryRecord[],
  options?: { coreSimilarityThreshold?: number; supportingThreshold?: number },
): MotifSimilarityHit[] {
  const coreThr = options?.coreSimilarityThreshold ?? 0.72;
  const supportThr = options?.supportingThreshold ?? 0.55;
  const hits: MotifSimilarityHit[] = [];
  for (const record of records) {
    if (record.storyId === candidate.storyId) continue;
    const { similarity, similarFields } = compareFingerprints(candidate, record);

    // Strong structural overlap: two of the load-bearing fields agree
    const heavyFields = similarFields.filter((s) =>
      /^centralPlace|^magicRule|^corePremise|^centralObject/.test(s)
    );

    let classification: MotifSimilarityHit["classification"] = "incidental";
    if (similarity >= coreThr || heavyFields.length >= 2) {
      classification = "core_reuse";
    } else if (similarity >= supportThr || heavyFields.length === 1) {
      classification = "supporting_reuse";
    }

    if (classification !== "incidental") {
      hits.push({ record, similarity, similarFields, classification });
    }
  }
  hits.sort((a, b) => b.similarity - a.similarity);
  return hits;
}

/**
 * Build a fingerprint object from the data the orchestrator already has.
 * Falls back to safe defaults so partial blueprints still produce a valid
 * row.
 */
export function buildFingerprintFromBlueprint(
  storyId: string,
  blueprint: Partial<{
    title: string;
    description: string;
    storyBlurb: string;
    themeDescription: string;
    centralObject: string;
    centralPlace: string;
    wonderRule: string;
    magicRule: string;
    emotionalEngine: string;
    coreConflict: string;
    finalImage: string;
    antagonistProblem: string;
  }> & Record<string, unknown>,
  chapterTitles: string[],
): StoryMotifFingerprint {
  const keywords = new Set<string>();
  const harvest = (...values: string[]): void => {
    for (const value of values) {
      for (const tok of tokenize(value)) {
        if (tok.length >= 5 && !FIELD_STOPWORDS.has(tok)) keywords.add(tok);
      }
    }
  };
  harvest(
    blueprint.title || "",
    blueprint.description || blueprint.storyBlurb || blueprint.themeDescription || "",
    blueprint.centralObject || "",
    blueprint.centralPlace || "",
    blueprint.wonderRule || blueprint.magicRule || "",
    blueprint.emotionalEngine || "",
    chapterTitles.join(" "),
  );

  return {
    storyId,
    title: blueprint.title || "",
    description: blueprint.description || blueprint.storyBlurb || blueprint.themeDescription || "",
    corePremise: [blueprint.centralPlace, blueprint.wonderRule, blueprint.coreConflict].filter(Boolean).join(" — "),
    centralObject: blueprint.centralObject || "",
    centralPlace: blueprint.centralPlace || "",
    magicRule: blueprint.wonderRule || blueprint.magicRule || "",
    emotionalEngine: blueprint.emotionalEngine || "",
    antagonistProblem: blueprint.antagonistProblem || blueprint.coreConflict || "",
    finalImage: blueprint.finalImage || "",
    motifTags: [],
    motifKeywords: [...keywords].slice(0, 24),
  };
}
