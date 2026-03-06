import { callChatCompletion } from "./llm-client";
import type { CastSet, SceneDirective, StoryDraft, TokenUsage } from "./types";

export interface SemanticCriticIssue {
  chapter: number;
  code: string;
  severity: "ERROR" | "WARNING";
  message: string;
  patchInstruction?: string;
}

export interface SemanticCriticPatchTask {
  chapter: number;
  priority: 1 | 2 | 3;
  objective: string;
  instruction: string;
}

export interface SemanticCriticReport {
  model: string;
  overallScore: number;
  dimensionScores: {
    craft: number;
    narrative: number;
    childFit: number;
    humor: number;
    warmth: number;
  };
  releaseReady: boolean;
  summary: string;
  issues: SemanticCriticIssue[];
  patchTasks: SemanticCriticPatchTask[];
  usage?: TokenUsage;
}

export async function runSemanticCritic(input: {
  storyId: string;
  draft: StoryDraft;
  directives: SceneDirective[];
  cast: CastSet;
  language: string;
  ageRange: { min: number; max: number };
  humorLevel?: number;
  model?: string;
  targetMinScore?: number;
}): Promise<SemanticCriticReport> {
  const model = input.model || "gpt-5-mini";
  const targetMinScore = clampNumber(input.targetMinScore ?? 8.2, 0, 10);
  const humorLevel = clampNumber(input.humorLevel ?? 2, 0, 3);

  const fallback = buildFallbackReport({
    model,
    targetMinScore,
    draft: input.draft,
    language: input.language,
  });

  try {
    const castNames = [
      ...input.cast.avatars.map(a => a.displayName),
      ...input.cast.poolCharacters.map(c => c.displayName),
    ].filter(Boolean);

    const directiveSummary = input.directives.map(d => ({
      chapter: d.chapter,
      setting: d.setting,
      goal: trimText(d.goal, 96),
      conflict: trimText(d.conflict, 96),
      outcome: trimText(d.outcome, 96),
      charactersOnStage: d.charactersOnStage,
    }));

    const chapters = input.draft.chapters.map(ch => ({
      chapter: ch.chapter,
      title: ch.title,
      text: compressChapter(ch.text, 220),
    }));

    const isDE = input.language === "de";
    const systemPrompt = isDE
      ? `Du bist ein strenger Kinderbuch-Lektor. Bewerte nur die Qualität. Schreibe die Geschichte NICHT um.
Fokussiere dich auf konkrete, kapitel-lokale Fehler und umsetzbare Korrekturen.
Kein allgemeines Lob. Gib knappes JSON zurück, exakt wie angefordert.

PRÜFE GEZIELT:
1. Kapitel 1: Weiß das Kind nach 2 Absätzen WER, WO, WAS? Wenn nicht → ERROR.
2. Kapitel 3: Macht das Kind einen echten Fehler aus seiner Persönlichkeit heraus? Gibt es eine Körperreaktion? Wenn nicht → ERROR.
3. Kapitel 4: Gibt es einen echten Tiefpunkt? Kommt die Wende von INNEN (nicht von außen)? Wenn nicht → ERROR.
4. Kapitel 5: Konkreter Gewinn UND kleiner Preis? Rückbezug zu Kapitel 1? Wenn nicht → WARNING.
5. Dialog: Klingt jede Figur anders? Ist Dialog an Handlung gebunden? Mindestens 30% Dialog pro Kapitel. Pro Kapitel prüfen.
6. Vorlese-Test: Gibt es Sätze über 12 Wörter, die beim Vorlesen stolpern lassen? Zitiere sie.
7. Fehler-Wachstums-Bogen: Macht das Kind einen Fehler (Ch3), lernt daraus (Ch4), handelt anders (Ch5)?
8. Humor: Hat JEDES Kapitel mindestens einen Schmunzel-Moment? Slapstick, Missverständnis, witzige Reaktion? Wenn nur 0-1 Kapitel Humor haben → ERROR.
9. Figuren-Fokus: Maximal 2 Figuren im Vordergrund pro Kapitel. Wenn 4+ aktive Figuren → ERROR.
10. Rhythmus: Gibt es Variation? Kurz-kurz-lang? Oder nur gleichförmige mittellange Sätze? → WARNING.`
      : `You are a strict senior children's-book editor. Evaluate quality only. Never rewrite the full story.
Focus on concrete, chapter-local failures and actionable fixes.
No generic praise. Return concise JSON exactly as requested.

TARGETED CHECKS:
1. Chapter 1: After 2 paragraphs, does the child know WHO, WHERE, WHAT? If not → ERROR.
2. Chapter 3: Does the child make a genuine mistake rooted in their personality? Is there a body reaction? If not → ERROR.
3. Chapter 4: Is there a real low point? Does the turning point come from INSIDE the child (not external help)? If not → ERROR.
4. Chapter 5: Concrete win AND small price? Callback to Chapter 1? If not → WARNING.
5. Dialogue: Does each character sound distinct? Is dialogue anchored to action? At least 30% dialogue per chapter. Check per chapter.
6. Read-aloud test: Are there sentences over 12 words that would stumble when read aloud? Quote them.
7. Mistake-growth arc: Does the child make a mistake (Ch3), learn from it (Ch4), act differently (Ch5)?
8. Humor: Does EVERY chapter have at least one smile moment? Slapstick, misunderstanding, witty reaction? If only 0-1 chapters have humor → ERROR.
9. Character focus: Max 2 characters in the foreground per chapter. If 4+ active characters → ERROR.
10. Rhythm: Is there sentence length variation? Short-short-long? Or only uniform medium sentences? → WARNING.`;

    const userPayload = {
      language: input.language,
      ageRange: input.ageRange,
      humorLevel,
      targetMinScore,
      castNames,
      artifact: input.cast.artifact?.name || null,
      directiveSummary,
      chapters,
      scoringGuide: {
        craft: "style rhythm, voice clarity, line quality",
        narrative: "stakes, low point, payoff, coherence",
        childFit: "age fit, clarity, emotional safety, readability",
        humor: "child-friendly playful moments and comic beats",
        warmth: "emotional warmth, hopeful closure",
      },
      focusChecks: [
        "Ch1 orientation: after 2 paragraphs child must know WHO + WHERE + WHAT. If mid-action start → ERROR CH1_ORIENTATION_MISSING",
        "Ch3 child mistake: child must make a genuine error from their personality (not external bad luck). Body reaction required. If missing → ERROR CHILD_MISTAKE_MISSING",
        "Ch4 internal turning point: the insight must come from inside the child, not from artifact or adult. If external → ERROR EXTERNAL_RESOLUTION",
        "Ch5 concrete payoff: show what was won (concrete) + small tangible price + callback to Ch1. If abstract → WARNING",
        "mistake-growth arc: child mistakes in Ch3, learns in Ch4, acts differently in Ch5. If arc is broken → ERROR GROWTH_ARC_BROKEN",
        "voice separation: children should sound distinct in sentence rhythm and wording. If all characters sound the same → ERROR VOICE_BLEND",
        "read-aloud stumbles: flag sentences over 12 words that would stumble when read aloud → WARNING READ_ALOUD_STUMBLE",
        "chapter transitions: Ch2-5 first sentence must connect to previous chapter's last moment → WARNING CHAPTER_TRANSITION_WEAK",
        "meta-foreshadow leak: reject lines like 'soon they would know' / 'an outlook remained' → WARNING META_FORESHADOW_PHRASE",
        "rule-exposition tell: reject textbook statements about how artifacts/rules work → WARNING RULE_EXPOSITION_TELL",
        "humor per chapter: EACH chapter needs at least one playful/funny moment. If 0-1 chapters have humor → ERROR HUMOR_MISSING",
        "character focus: max 2 characters in foreground per chapter. If 4+ actively speaking/acting → ERROR CHARACTER_OVERLOAD",
        "dialogue ratio: each chapter should have 30-40% dialogue. If under 20% → ERROR DIALOGUE_TOO_LOW",
      ],
      preferredIssueCodes: [
        "CH1_ORIENTATION_MISSING",
        "CHILD_MISTAKE_MISSING",
        "EXTERNAL_RESOLUTION",
        "GROWTH_ARC_BROKEN",
        "CHAPTER_TRANSITION_WEAK",
        "READ_ALOUD_STUMBLE",
        "VOICE_BLEND",
        "VOICE_TAG_FORMULA_OVERUSE",
        "META_FORESHADOW_PHRASE",
        "META_SUMMARY_SENTENCE",
        "RULE_EXPOSITION_TELL",
        "ABRUPT_SCENE_SHIFT",
        "DIALOGUE_PROSE_IMBALANCE",
        "DIALOGUE_TOO_LOW",
        "METAPHOR_DENSITY_HIGH",
        "GIMMICK_LOOP_OVERUSE",
        "HUMOR_MISSING",
        "CHARACTER_OVERLOAD",
        "RHYTHM_MONOTONE",
      ],
      outputSchema: {
        overallScore: "number 0..10",
        dimensionScores: {
          craft: "number 0..10",
          narrative: "number 0..10",
          childFit: "number 0..10",
          humor: "number 0..10",
          warmth: "number 0..10",
        },
        releaseReady: "boolean",
        summary: "string max 140 chars",
        issues: [
          {
            chapter: "number (0 for global)",
            code: "string",
            severity: "ERROR|WARNING",
            message: "string",
            patchInstruction: "string optional",
          },
        ],
        patchTasks: [
          {
            chapter: "number",
            priority: "1|2|3",
            objective: "string",
            instruction: "string concise, chapter-local",
          },
        ],
      },
    };

    const result = await callChatCompletion({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(userPayload) },
      ],
      responseFormat: "json_object",
      maxTokens: 1800,
      reasoningEffort: "low",
      temperature: 0.2,
      context: "story-semantic-critic",
      logSource: "phase6-story-critic-llm",
      logMetadata: { storyId: input.storyId, chapters: chapters.length },
    });

    const parsed = safeJson(result.content);
    if (!parsed || typeof parsed !== "object") {
      return fallback;
    }

    const normalized = normalizeCriticReport(parsed, {
      model,
      targetMinScore,
      directives: input.directives,
      language: input.language,
    });
    normalized.usage = result.usage;
    return normalized;
  } catch (error) {
    console.warn("[semantic-critic] Critic failed, falling back to deterministic report", error);
    return fallback;
  }
}

function normalizeCriticReport(
  raw: any,
  ctx: {
    model: string;
    targetMinScore: number;
    directives: SceneDirective[];
    language: string;
  },
): SemanticCriticReport {
  const chapterSet = new Set(ctx.directives.map(d => d.chapter));
  const dimRaw = raw?.dimensionScores || {};
  const craft = clampNumber(Number(dimRaw.craft ?? 0), 0, 10);
  const narrative = clampNumber(Number(dimRaw.narrative ?? 0), 0, 10);
  const childFit = clampNumber(Number(dimRaw.childFit ?? 0), 0, 10);
  const humor = clampNumber(Number(dimRaw.humor ?? 0), 0, 10);
  const warmth = clampNumber(Number(dimRaw.warmth ?? 0), 0, 10);
  const weighted = Number((craft * 0.27 + narrative * 0.27 + childFit * 0.22 + humor * 0.12 + warmth * 0.12).toFixed(2));
  const overallScore = clampNumber(Number(raw?.overallScore ?? weighted), 0, 10);

  const issues = Array.isArray(raw?.issues)
    ? raw.issues
        .map((issue: any) => {
          const chapter = normalizeChapter(issue?.chapter, chapterSet);
          const severity = issue?.severity === "ERROR" ? "ERROR" : "WARNING";
          const code = String(issue?.code || "CRITIC_ISSUE").slice(0, 80);
          const message = trimText(String(issue?.message || ""), 160);
          const patchInstruction = trimText(String(issue?.patchInstruction || ""), 160);
          if (!message) return null;
          return {
            chapter,
            code,
            severity,
            message,
            patchInstruction: patchInstruction || undefined,
          } as SemanticCriticIssue;
        })
        .filter((v: SemanticCriticIssue | null): v is SemanticCriticIssue => Boolean(v))
    : [];

  const patchTasks = Array.isArray(raw?.patchTasks)
    ? dedupePatchTasks(
        raw.patchTasks
          .map((task: any) => {
            const chapter = normalizeChapter(task?.chapter, chapterSet);
            if (chapter <= 0) return null;
            const objective = trimText(String(task?.objective || ""), 110);
            const instruction = trimText(String(task?.instruction || ""), 160);
            if (!objective || !instruction) return null;
            const priorityRaw = Number(task?.priority);
            const priority: 1 | 2 | 3 = priorityRaw === 1 ? 1 : priorityRaw === 3 ? 3 : 2;
            return { chapter, priority, objective, instruction } as SemanticCriticPatchTask;
          })
          .filter((v: SemanticCriticPatchTask | null): v is SemanticCriticPatchTask => Boolean(v)),
      )
    : [];

  const releaseReady = Boolean(raw?.releaseReady) && overallScore >= ctx.targetMinScore;
  const summary = trimText(String(raw?.summary || ""), 140) || defaultSummary(ctx.language, overallScore, releaseReady);

  return {
    model: ctx.model,
    overallScore,
    dimensionScores: { craft, narrative, childFit, humor, warmth },
    releaseReady,
    summary,
    issues,
    patchTasks,
  };
}

function dedupePatchTasks(tasks: SemanticCriticPatchTask[]): SemanticCriticPatchTask[] {
  const seen = new Set<string>();
  const out: SemanticCriticPatchTask[] = [];
  for (const task of tasks) {
    const key = `${task.chapter}:${task.objective.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(task);
  }
  return out
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 5);
}

function buildFallbackReport(input: {
  model: string;
  targetMinScore: number;
  draft: StoryDraft;
  language: string;
}): SemanticCriticReport {
  const text = input.draft.chapters.map(ch => ch.text).join(" ");
  const words = text.split(/\s+/).filter(Boolean).length;
  const sentenceCount = text.split(/[.!?]+/).filter(Boolean).length;
  const avgWordsPerSentence = sentenceCount > 0 ? words / sentenceCount : 0;
  const baseline = avgWordsPerSentence > 18 ? 6.8 : 7.4;
  const overallScore = clampNumber(Number(baseline.toFixed(2)), 0, 10);
  return {
    model: input.model,
    overallScore,
    dimensionScores: {
      craft: overallScore,
      narrative: overallScore,
      childFit: clampNumber(overallScore + 0.2, 0, 10),
      humor: clampNumber(overallScore - 0.2, 0, 10),
      warmth: clampNumber(overallScore + 0.1, 0, 10),
    },
    releaseReady: overallScore >= input.targetMinScore,
    summary: defaultSummary(input.language, overallScore, overallScore >= input.targetMinScore),
    issues: [],
    patchTasks: [],
  };
}

function normalizeChapter(raw: unknown, chapterSet: Set<number>): number {
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return 0;
  const chapter = Math.round(numeric);
  if (chapter <= 0) return 0;
  if (chapterSet.has(chapter)) return chapter;
  return 0;
}

function defaultSummary(language: string, score: number, releaseReady: boolean): string {
  const isDE = language === "de";
  if (isDE) {
    return releaseReady
      ? `Kritik: release-faehig (${score.toFixed(1)}/10), nur kleine lokale Feinschliffe noetig.`
      : `Kritik: unter Release-Niveau (${score.toFixed(1)}/10), gezielte lokale Ueberarbeitung empfohlen.`;
  }
  return releaseReady
    ? `Critic: release-ready (${score.toFixed(1)}/10), only minor local polish needed.`
    : `Critic: below release bar (${score.toFixed(1)}/10), targeted local revisions recommended.`;
}

function compressChapter(text: string, maxWords: number): string {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(" ");
  const lead = words.slice(0, Math.floor(maxWords * 0.7)).join(" ");
  const tail = words.slice(-Math.ceil(maxWords * 0.2)).join(" ");
  return `${lead} ... ${tail}`;
}

function safeJson(value: string): any {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function trimText(value: string, maxChars: number): string {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  return normalized.slice(0, Math.max(0, maxChars - 3)).trimEnd() + "...";
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
