import type { NormalizedRequest, CastSet, StoryDNA, TaleDNA, SceneDirective, StoryDraft, StoryWriter, TokenUsage, AvatarMemoryCompressed } from "./types";
import { buildChapterExpansionPrompt, buildFullStoryPrompt, buildFullStoryRewritePrompt, buildStoryChapterRevisionPrompt, buildStoryTitlePrompt, resolveLengthTargets } from "./prompts";
import { buildLengthTargetsFromBudget } from "./word-budget";
import { callChatCompletion, calculateTokenCosts } from "./llm-client";
import { generateWithGemini } from "../gemini-generation";
import { runQualityGates, buildRewriteInstructions } from "./quality-gates";
import { splitContinuousStoryIntoChapters } from "./story-segmentation";
// V2: findTemplatePhraseMatches nicht mehr nötig - Template-Fixes im Rewrite enthalten

// ════════════════════════════════════════════════════════════════════════════
// OPTIMIERTE PIPELINE-KONSTANTEN (V2)
// ════════════════════════════════════════════════════════════════════════════
// Ziel: Minimale API-Calls bei maximaler Qualität
//
// Alte Pipeline (9+ Calls):
//   1× Full Story → bis zu 5× Expand → bis zu 3× Rewrite
//
// Neue Pipeline (2-3 Calls):
//   1× Full Story (mit optimiertem Prompt) → max 1× Rewrite (nur bei ERRORs)
//   + einzelne Expand-Calls nur wenn < HARD_MIN_WORDS
// ════════════════════════════════════════════════════════════════════════════

// Single rewrite pass: empirically, multiple rewrites degrade story quality.
// The first pass is typically decent (6/10); rewrites destroy warmth, stakes, and coherence.
const MAX_REWRITE_PASSES = 1;

// Hartes Minimum für Kapitel-Wörter - unter diesem Wert wird expanded
// (Niedrigerer Wert = weniger Expand-Calls)
const HARD_MIN_CHAPTER_WORDS = 150;

// Nur Rewrites bei ERRORs durchführen, WARNINGs ignorieren für Rewrites
const REWRITE_ONLY_ON_ERRORS = true;

// Mehr Spielraum fuer Expand-Calls weil fehlende Figuren oft mehrere Kapitel betreffen.
const MAX_EXPAND_CALLS = 5;

// Cost-safe quality lift: polish warning-heavy chapters without full-story rewrites.
const MAX_WARNING_POLISH_CALLS = 3;
const WARNING_POLISH_CODES = new Set([
  "RHYTHM_FLAT",
  "RHYTHM_TOO_HEAVY",
  "VOICE_INDISTINCT",
  "ROLE_LABEL_OVERUSE",
  "METAPHOR_OVERLOAD",
  "IMAGERY_DENSITY_HIGH",
  "NO_DIALOGUE",
  "TOO_FEW_DIALOGUES",
  "DIALOGUE_RATIO_LOW",
  "DIALOGUE_RATIO_HIGH",
  "META_LABEL_PHRASE",
  "POETIC_LANGUAGE_OVERLOAD",
  "TELL_PATTERN_OVERUSE",
  "GOAL_THREAD_WEAK_ENDING",
  "ENDING_TOO_SHORT",
]);

export class LlmStoryWriter implements StoryWriter {
  async writeStory(input: {
    normalizedRequest: NormalizedRequest;
    cast: CastSet;
    dna: TaleDNA | StoryDNA;
    directives: SceneDirective[];
    strict?: boolean;
    stylePackText?: string;
    fusionSections?: Map<number, string>;
    avatarMemories?: Map<string, AvatarMemoryCompressed[]>;
  }): Promise<{ draft: StoryDraft; usage?: TokenUsage; qualityReport?: any }> {
    const { normalizedRequest, cast, dna, directives, strict, stylePackText, fusionSections, avatarMemories } = input;
    const model = normalizedRequest.rawConfig?.aiModel ?? "gpt-5-mini";
    const isGeminiModel = model.startsWith("gemini-");
    const isGemini3 = model.startsWith("gemini-3");
    const allowPostEdits = !isGeminiModel || isGemini3;
    const maxRewritePasses = allowPostEdits ? MAX_REWRITE_PASSES : 0;
    const isGerman = normalizedRequest.language === "de";
    const targetLanguage = isGerman ? "German" : normalizedRequest.language;
    const languageGuard = isGerman
      ? "WICHTIG: Antworte ausschließlich auf Deutsch. Keine englischen Wörter oder Sätze."
      : "";
    const systemPrompt = isGerman
      ? `Du bist ein Kinderbuch-Autor auf dem Niveau von Otfried Preußler ("Der Räuber Hotzenplotz"), Cornelia Funke ("Tintenherz") und Axel Scheffler/Julia Donaldson ("Der Grüffelo").

Dein Geheimnis: Du schreibst so, dass Kinder SELBER weiterlesen wollen – nicht weil Mama es sagt.

Deine Regeln:
1. Jeder erste Satz eines Kapitels muss ein Kind mitten ins Geschehen ziehen.
2. Figuren klingen KOMPLETT unterschiedlich – ein Kind erkennt am Satz, WER spricht.
3. Mindestens ein Moment pro Geschichte, bei dem ein Kind laut lacht oder den Atem anhält.
4. Du zeigst Gefühle durch Körper und Handlung, NIEMALS durch Erklärung.
5. Deine Sätze haben Rhythmus: kurz-kurz-lang, wie Musik.
6. Du schreibst bodenstaendig und konkret: keine dichten Erwachsenen-Metaphern.
7. Du schreibst NUR auf Deutsch. Kein einziges englisches Wort.`
      : `You are a children's book author on the level of Roald Dahl ("Charlie and the Chocolate Factory"), Julia Donaldson ("The Gruffalo"), and Neil Gaiman ("Coraline").

Your secret: You write so that children WANT to keep reading – not because someone tells them to.

Your rules:
1. Every chapter's first sentence must pull a child straight into the action.
2. Characters sound COMPLETELY different – a child can tell WHO speaks from the sentence alone.
3. At least one moment per story that makes a child laugh out loud or hold their breath.
4. Show emotions through body language and action, NEVER through explanation.
5. Your sentences have rhythm: short-short-long, like music.
6. Keep language concrete and child-facing: avoid dense literary metaphors.
7. Write the story in ${targetLanguage}.\n${languageGuard}`.trim();
    const editSystemPrompt = isGerman
      ? `Du bist ein erfahrener Kinderbuch-Lektor. Du erweiterst und verfeinerst Kapitel, während du Handlung, Stimme und Kontinuitaet bewahrst. Schreibe ausschliesslich auf Deutsch.`
      : `You are a senior children's book editor. You expand and polish chapters while preserving plot, voice, and continuity.\n${languageGuard}`.trim();
    const clampMaxTokens = (maxTokens?: number) => {
      const safeMax = maxTokens ?? 2000;
      if (isGemini3) return Math.min(safeMax, 65536);
      return isGeminiModel ? Math.min(safeMax, 8192) : safeMax;
    };

    const callStoryModel = async (input: {
      systemPrompt: string;
      userPrompt: string;
      responseFormat?: "json_object" | "text";
      maxTokens?: number;
      temperature?: number;
      context?: string;
      logSource?: string;
      logMetadata?: Record<string, any>;
      reasoningEffort?: "low" | "medium" | "high";
    }) => {
      if (isGeminiModel) {
        const geminiResponse = await generateWithGemini({
          systemPrompt: input.systemPrompt,
          userPrompt: input.userPrompt,
          maxTokens: clampMaxTokens(input.maxTokens),
          temperature: input.temperature,
        });
        return {
          content: geminiResponse.content,
          usage: {
            promptTokens: geminiResponse.usage.promptTokens,
            completionTokens: geminiResponse.usage.completionTokens,
            totalTokens: geminiResponse.usage.totalTokens,
            model,
          },
        };
      }

      return callChatCompletion({
        model,
        messages: [
          { role: "system", content: input.systemPrompt },
          { role: "user", content: input.userPrompt },
        ],
        responseFormat: input.responseFormat,
        maxTokens: input.maxTokens,
        temperature: input.temperature,
        reasoningEffort: input.reasoningEffort,
        context: input.context,
        logSource: input.logSource,
        logMetadata: input.logMetadata,
      });
    };

    const lengthTargets = normalizedRequest.wordBudget
      ? buildLengthTargetsFromBudget(normalizedRequest.wordBudget)
      : resolveLengthTargets({
          lengthHint: normalizedRequest.lengthHint,
          ageRange: { min: normalizedRequest.ageMin, max: normalizedRequest.ageMax },
          pacing: normalizedRequest.rawConfig?.pacing,
        });

    const totalWordTarget = normalizedRequest.wordBudget?.targetWords ?? (lengthTargets.wordMin + lengthTargets.wordMax) / 2 * directives.length;
    const totalWordMin = normalizedRequest.wordBudget?.minWords ?? lengthTargets.wordMin * directives.length;
    const totalWordMax = normalizedRequest.wordBudget?.maxWords ?? lengthTargets.wordMax * directives.length;

    let totalUsage: TokenUsage | undefined;

    // ─── Phase A: Generate full story in one call ────────────────────────────
    const prompt = buildFullStoryPrompt({
      directives,
      cast,
      dna,
      language: normalizedRequest.language,
      ageRange: { min: normalizedRequest.ageMin, max: normalizedRequest.ageMax },
      tone: normalizedRequest.requestedTone,
      totalWordTarget: Math.round(totalWordTarget),
      totalWordMin: Math.round(totalWordMin),
      totalWordMax: Math.round(totalWordMax),
      wordsPerChapter: { min: lengthTargets.wordMin, max: lengthTargets.wordMax },
      stylePackText,
      strict,
      fusionSections,
      avatarMemories,
      userPrompt: normalizedRequest.rawConfig?.customPrompt,
    });

    // Reasoning models (gpt-5-mini) burn ~60-75% of max_completion_tokens on internal thinking.
    // A medium story needs ~4000 output tokens; with reasoning overhead we need 3-4x that.
    const baseOutputTokens = Math.max(4000, Math.round(totalWordMax * 2.5));
    const reasoningMultiplier = (model.includes("gpt-5") || model.includes("o4")) ? 3 : 1;
    const maxOutputTokens = Math.min(baseOutputTokens * reasoningMultiplier, 30000);

    const result = await callStoryModel({
      systemPrompt,
      userPrompt: prompt,
      responseFormat: "json_object",
      maxTokens: maxOutputTokens,
      temperature: strict ? 0.4 : 0.7,
      reasoningEffort: "medium",  // Medium for first-pass quality → fewer expensive rewrites
      context: "story-writer-full",
      logSource: "phase6-story-llm",
      logMetadata: { storyId: normalizedRequest.storyId, step: "full" },
    });

    if (result.usage) {
      totalUsage = mergeUsage(totalUsage, result.usage, model);
    }

    let parsed = safeJson(result.content);
    let draft = sanitizeDraft(extractDraftFromAnyFormat({
      parsed,
      directives,
      language: normalizedRequest.language,
      wordsPerChapter: { min: lengthTargets.wordMin, max: lengthTargets.wordMax },
    }));

    // ─── Phase B: Quality Gates + Rewrite Passes ─────────────────────────────
    let qualityReport = runQualityGates({
      draft,
      directives,
      cast,
      language: normalizedRequest.language,
      ageRange: { min: normalizedRequest.ageMin, max: normalizedRequest.ageMax },
      wordBudget: normalizedRequest.wordBudget,
    });

    // ════════════════════════════════════════════════════════════════════════
    // OPTIMIERTE applyTargetedEdits (V2)
    // - Verwendet HARD_MIN_CHAPTER_WORDS statt dynamischen Wert
    // - Begrenzt auf MAX_EXPAND_CALLS um API-Kosten zu reduzieren
    // - Template-Fixes werden NICHT mehr separat gemacht (im Rewrite enthalten)
    // ════════════════════════════════════════════════════════════════════════
    const applyTargetedEdits = async (draftInput: StoryDraft): Promise<{ draft: StoryDraft; usage?: TokenUsage; changed: boolean }> => {
      const updatedChapters = draftInput.chapters.map(ch => ({ ...ch }));
      let changed = false;
      let usage: TokenUsage | undefined;
      let expandCallCount = 0; // Zähle Expand-Calls

      for (let i = 0; i < updatedChapters.length; i++) {
        // Stoppe wenn MAX_EXPAND_CALLS erreicht
        if (expandCallCount >= MAX_EXPAND_CALLS) {
          console.log(`[story-writer] Max expand calls (${MAX_EXPAND_CALLS}) reached, skipping remaining chapters`);
          break;
        }

        const chapter = updatedChapters[i];
        const directive = directives.find(d => d.chapter === chapter.chapter);
        if (!directive) continue;

        const wordCount = countWords(chapter.text);
        const sentenceCount = splitSentences(chapter.text).length;
        const missingCharacters = findMissingCharacters(chapter.text, directive, cast);
        const needsMissingFix = missingCharacters.length > 0;

        // V2: Nur expandieren wenn WIRKLICH zu kurz (unter hartem Minimum) oder < 3 Sätze
        // Template-Fixes werden im nächsten Rewrite-Pass erledigt, nicht separat
        const needsExpand = Boolean(wordCount < HARD_MIN_CHAPTER_WORDS || sentenceCount < 3 || needsMissingFix);

        // V2: Keine separaten Template-Fix-Calls mehr - zu teuer
        // const templateMatches = findTemplatePhraseMatches(chapter.text, normalizedRequest.language);
        // const needsTemplateFix = templateMatches.length > 0 && !needsExpand;

        if (!needsExpand) continue;

        // V2: Nur Expand-Calls, keine separaten Template-Fix-Calls mehr
        console.log(`[story-writer] Expanding chapter ${chapter.chapter}: ${wordCount} words, ${sentenceCount} sentences, missing: ${missingCharacters.join(", ") || "none"}`);

        const prevContext = i > 0 ? getEdgeContext(updatedChapters[i - 1]?.text || "", "end") : "";
        const nextContext = i < updatedChapters.length - 1 ? getEdgeContext(updatedChapters[i + 1]?.text || "", "start") : "";

        const prompt = buildChapterExpansionPrompt({
          chapter: directive,
          cast,
          dna,
          language: normalizedRequest.language,
          ageRange: { min: normalizedRequest.ageMin, max: normalizedRequest.ageMax },
          tone: normalizedRequest.requestedTone,
          lengthTargets,
          stylePackText,
          originalText: chapter.text,
          previousContext: prevContext,
          nextContext,
          requiredCharacters: missingCharacters,
        });

        // Reasoning models need ~3x tokens since reasoning consumes most of the budget.
        const baseMaxTokens = Math.round(Math.max(520, lengthTargets.wordMax * 2.2));
        const expandReasoningMultiplier = (model.includes("gpt-5") || model.includes("o4")) ? 3 : 1;
        const maxTokens = Math.min(4000, Math.max(850, baseMaxTokens * expandReasoningMultiplier));

        console.log(`[story-writer] Expand call with maxTokens: ${maxTokens} (base: ${baseMaxTokens})`);

        try {
          const result = await callStoryModel({
            systemPrompt: editSystemPrompt,
            userPrompt: prompt,
            responseFormat: "json_object",
            maxTokens,
            temperature: 0.4,
            context: `story-writer-expand-chapter-${chapter.chapter}`,
            logSource: "phase6-story-llm",
            logMetadata: { storyId: normalizedRequest.storyId, step: "expand", chapter: chapter.chapter },
            // V3: Reasoning-Effort explizit auf "low" setzen
            reasoningEffort: "low",
          });

          if (result.usage) {
            usage = mergeUsage(usage, result.usage, model);
          }

          const parsed = safeJson(result.content);
          if (parsed?.text) {
            chapter.text = sanitizeMetaStructureFromText(String(parsed.text));
            changed = true;
            expandCallCount++; // V2: Zähle erfolgreiche Expand-Calls
          }
        } catch (error) {
          console.warn(`[story-writer] Targeted edit failed for chapter ${chapter.chapter}`, error);
        }
      }

      return { draft: { ...draftInput, chapters: updatedChapters }, usage, changed };
    };

    const applyWarningPolish = async (
      draftInput: StoryDraft,
      reportInput: {
        issues: Array<{ chapter: number; code: string; message: string; severity: "ERROR" | "WARNING" }>;
      },
    ): Promise<{ draft: StoryDraft; usage?: TokenUsage; changed: boolean }> => {
      if (MAX_WARNING_POLISH_CALLS <= 0) {
        return { draft: draftInput, changed: false };
      }

      const warningIssues = (reportInput?.issues || []).filter(
        issue => issue.severity === "WARNING" && WARNING_POLISH_CODES.has(issue.code),
      );
      if (warningIssues.length === 0) {
        return { draft: draftInput, changed: false };
      }

      const chapterIssues = new Map<number, string[]>();
      for (const issue of warningIssues) {
        if (issue.chapter <= 0) continue;
        const list = chapterIssues.get(issue.chapter) ?? [];
        list.push(`[${issue.code}] ${issue.message}`);
        chapterIssues.set(issue.chapter, list);
      }
      if (chapterIssues.size === 0) {
        return { draft: draftInput, changed: false };
      }

      const ranked = [...chapterIssues.entries()]
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, MAX_WARNING_POLISH_CALLS);

      const updatedChapters = draftInput.chapters.map(ch => ({ ...ch }));
      let changed = false;
      let usage: TokenUsage | undefined;

      for (const [chapterNo, issues] of ranked) {
        const chapter = updatedChapters.find(ch => ch.chapter === chapterNo);
        const directive = directives.find(d => d.chapter === chapterNo);
        if (!chapter || !directive) continue;

        const prompt = buildStoryChapterRevisionPrompt({
          chapter: directive,
          cast,
          dna,
          language: normalizedRequest.language,
          ageRange: { min: normalizedRequest.ageMin, max: normalizedRequest.ageMax },
          tone: normalizedRequest.requestedTone,
          lengthTargets,
          stylePackText,
          issues: issues.slice(0, 4),
          originalText: chapter.text,
        });

        const baseMaxTokens = Math.round(Math.max(500, lengthTargets.wordMax * 2.0));
        const polishReasoningMultiplier = (model.includes("gpt-5") || model.includes("o4")) ? 2 : 1;
        const maxTokens = Math.min(3200, Math.max(700, baseMaxTokens * polishReasoningMultiplier));

        try {
          const result = await callStoryModel({
            systemPrompt: editSystemPrompt,
            userPrompt: prompt,
            responseFormat: "json_object",
            maxTokens,
            temperature: 0.35,
            reasoningEffort: "low",
            context: `story-writer-warning-polish-${chapterNo}`,
            logSource: "phase6-story-llm",
            logMetadata: { storyId: normalizedRequest.storyId, step: "warning-polish", chapter: chapterNo },
          });

          if (result.usage) {
            usage = mergeUsage(usage, result.usage, model);
          }

          const parsed = safeJson(result.content);
          if (parsed?.text) {
            chapter.text = sanitizeMetaStructureFromText(String(parsed.text));
            changed = true;
          }
        } catch (error) {
          console.warn(`[story-writer] Warning polish failed for chapter ${chapterNo}`, error);
        }
      }

      return { draft: { ...draftInput, chapters: updatedChapters }, usage, changed };
    };

    if (allowPostEdits) {
      const targetedBefore = await applyTargetedEdits(draft);
      if (targetedBefore.changed) {
        draft = targetedBefore.draft;
        if (targetedBefore.usage) {
          totalUsage = mergeUsage(totalUsage, targetedBefore.usage, model);
        }
        qualityReport = runQualityGates({
          draft,
          directives,
          cast,
          language: normalizedRequest.language,
          ageRange: { min: normalizedRequest.ageMin, max: normalizedRequest.ageMax },
          wordBudget: normalizedRequest.wordBudget,
        });
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // OPTIMIERTE REWRITE-LOGIK (V2)
    // - Nur bei ERRORs rewriten (REWRITE_ONLY_ON_ERRORS = true)
    // - WARNINGs werden ignoriert für Rewrites (kosten zu viel)
    // - Maximal 1 Rewrite-Pass fuer harte Qualitaetsprobleme
    // ════════════════════════════════════════════════════════════════════════
    let errorIssues = qualityReport.issues.filter(i => i.severity === "ERROR");
    if (normalizedRequest.wordBudget && canAutoTrimLengthErrors(errorIssues)) {
      const trimResult = autoTrimDraftToWordBudget({
        draft,
        maxWords: normalizedRequest.wordBudget.maxWords,
        minWordsPerChapter: Math.max(HARD_MIN_CHAPTER_WORDS, normalizedRequest.wordBudget.minWordsPerChapter),
      });
      if (trimResult.changed) {
        draft = trimResult.draft;
        qualityReport = runQualityGates({
          draft,
          directives,
          cast,
          language: normalizedRequest.language,
          ageRange: { min: normalizedRequest.ageMin, max: normalizedRequest.ageMax },
          wordBudget: normalizedRequest.wordBudget,
        });
        errorIssues = qualityReport.issues.filter(i => i.severity === "ERROR");
        console.log(`[story-writer] Applied deterministic trim before rewrite. Remaining errors: ${errorIssues.length}`);
      }
    }

    let rewriteAttempt = 0;
    while (rewriteAttempt < maxRewritePasses) {
      errorIssues = qualityReport.issues.filter(i => i.severity === "ERROR");
      // Filter out UNLOCKED_CHARACTER (non-actor) from rewrite triggers — these are mostly
      // German capitalized nouns (Nadel, Kompass, Brötchen) falsely flagged as character names.
      // Only UNLOCKED_CHARACTER_ACTOR (with active verb) and other real errors trigger rewrites.
      const actionableErrors = errorIssues.filter(i => !NOISY_CODES.has(i.code));
      const shouldRewrite = REWRITE_ONLY_ON_ERRORS
        ? actionableErrors.length > 0
        : qualityReport.failedGates.length > 0;
      if (!shouldRewrite) break;

      rewriteAttempt++;
      console.log(`[story-writer] Rewrite pass ${rewriteAttempt}/${maxRewritePasses} - ${actionableErrors.length} actionable errors (${errorIssues.length} total), failed gates: ${qualityReport.failedGates.join(", ")}`);

      // Send only actionable errors to the rewrite prompt (not CAST_LOCK noise)
      const rewriteInstructions = buildRewriteInstructions(actionableErrors, normalizedRequest.language);

      const rewritePrompt = buildFullStoryRewritePrompt({
        originalDraft: draft,
        directives,
        cast,
        dna,
        language: normalizedRequest.language,
        ageRange: { min: normalizedRequest.ageMin, max: normalizedRequest.ageMax },
        tone: normalizedRequest.requestedTone,
        totalWordMin: Math.round(totalWordMin),
        totalWordMax: Math.round(totalWordMax),
        wordsPerChapter: { min: lengthTargets.wordMin, max: lengthTargets.wordMax },
        qualityIssues: rewriteInstructions,
        stylePackText,
        userPrompt: normalizedRequest.rawConfig?.customPrompt,
      });

      let rewriteResult;
      try {
        rewriteResult = await callStoryModel({
          systemPrompt,
          userPrompt: rewritePrompt,
          responseFormat: "json_object",
          maxTokens: maxOutputTokens,
          temperature: 0.4,
          reasoningEffort: "medium",  // Medium so rewrites actually fix issues on first attempt
          context: `story-writer-rewrite-${rewriteAttempt}`,
          logSource: "phase6-story-llm",
          logMetadata: { storyId: normalizedRequest.storyId, step: "rewrite", attempt: rewriteAttempt },
        });
      } catch (error) {
        if (isGeminiModel) {
          console.warn(`[story-writer] Rewrite pass ${rewriteAttempt} failed for Gemini model, keeping current draft`, error);
          break;
        }
        throw error;
      }

      if (rewriteResult?.usage) {
        totalUsage = mergeUsage(totalUsage, rewriteResult.usage, model);
      }

      parsed = safeJson(rewriteResult.content);
      const revisedDraft = sanitizeDraft(extractDraftFromAnyFormat({
        parsed,
        directives,
        language: normalizedRequest.language,
        wordsPerChapter: { min: lengthTargets.wordMin, max: lengthTargets.wordMax },
      }));

      const revisedReport = runQualityGates({
        draft: revisedDraft,
        directives,
        cast,
        language: normalizedRequest.language,
        ageRange: { min: normalizedRequest.ageMin, max: normalizedRequest.ageMax },
        wordBudget: normalizedRequest.wordBudget,
      });

      if (isRewriteQualityBetter(qualityReport, revisedReport)) {
        draft = revisedDraft;
        qualityReport = revisedReport;
      } else {
        console.log(
          `[story-writer] Rewrite pass ${rewriteAttempt} did not improve hard quality (errors ${countErrorIssues(revisedReport)} vs ${countErrorIssues(qualityReport)}), keeping original draft for next attempt`
        );
        continue;
      }

      if (qualityReport.failedGates.length === 0) {
        console.log(`[story-writer] All quality gates passed after rewrite pass ${rewriteAttempt}`);
        break;
      }

      // Detect stale errors: if the same error codes persist after rewrite, stop wasting money.
      // The LLM is unlikely to fix them on the next attempt either.
      const newActionableErrors = qualityReport.issues
        .filter(i => i.severity === "ERROR" && !NOISY_CODES.has(i.code));
      const newErrorKeys = new Set(newActionableErrors.map(e => `${e.chapter}:${e.code}`));
      const prevErrorKeys = new Set(actionableErrors.map(e => `${e.chapter}:${e.code}`));
      const unchanged = [...newErrorKeys].filter(k => prevErrorKeys.has(k));
      if (unchanged.length > 0 && unchanged.length >= newActionableErrors.length * 0.5) {
        console.log(`[story-writer] Rewrite pass ${rewriteAttempt}: ${unchanged.length}/${newActionableErrors.length} errors unchanged, stopping rewrite loop (would waste money)`);
        break;
      }
    }

    // V2: Finaler Expand-Pass nur für kritische Probleme (nicht für TEMPLATE_PHRASE)
    // Template-Phrasen werden im Rewrite behandelt, nicht mit extra API-Calls
    if (allowPostEdits) {
      const needsFinalTargeted = qualityReport.issues.some(issue =>
        issue.code === "CHAPTER_TOO_SHORT_HARD" || issue.code === "CHAPTER_PLACEHOLDER" || issue.code === "MISSING_CHARACTER"
        // V2: TEMPLATE_PHRASE entfernt - zu teuer für extra API-Calls
      );
      if (needsFinalTargeted) {
        console.log(`[story-writer] Final targeted edit needed for: ${qualityReport.issues.filter(i => ["CHAPTER_TOO_SHORT_HARD", "CHAPTER_PLACEHOLDER", "MISSING_CHARACTER"].includes(i.code)).map(i => i.code).join(", ")}`);
        const targetedAfter = await applyTargetedEdits(draft);
        if (targetedAfter.changed) {
          draft = targetedAfter.draft;
          if (targetedAfter.usage) {
            totalUsage = mergeUsage(totalUsage, targetedAfter.usage, model);
          }
          qualityReport = runQualityGates({
            draft,
            directives,
            cast,
            language: normalizedRequest.language,
            ageRange: { min: normalizedRequest.ageMin, max: normalizedRequest.ageMax },
            wordBudget: normalizedRequest.wordBudget,
          });
        }
      }
    }

    if (allowPostEdits) {
      const warningPolish = await applyWarningPolish(draft, qualityReport);
      if (warningPolish.changed) {
        const polishedReport = runQualityGates({
          draft: warningPolish.draft,
          directives,
          cast,
          language: normalizedRequest.language,
          ageRange: { min: normalizedRequest.ageMin, max: normalizedRequest.ageMax },
          wordBudget: normalizedRequest.wordBudget,
        });

        if (isWarningPolishBetter(qualityReport, polishedReport)) {
          draft = warningPolish.draft;
          qualityReport = polishedReport;
          if (warningPolish.usage) {
            totalUsage = mergeUsage(totalUsage, warningPolish.usage, model);
          }
        } else {
          console.log("[story-writer] Warning polish did not improve measurable quality, keeping prior draft");
        }
      }
    }

    // ─── Phase C: Title generation (if AI didn't return a good one) ──────────
    // Also re-generate if AI returned the default fallback strings
    const isFallbackTitle = !draft.title || draft.title.length < 3
      || draft.title === "Neue Geschichte" || draft.title === "New Story"
      || draft.title === "Eine Geschichte" || draft.title === "A Story";
    if (isFallbackTitle) {
      const storyText = draft.chapters.map(ch => ch.text).join("\n\n");
      try {
        if (!allowPostEdits) {
          draft.title = normalizedRequest.language === "de" ? "Neue Geschichte" : "New Story";
          return {
            draft,
            usage: totalUsage,
            qualityReport: {
              score: qualityReport.score,
              passedGates: qualityReport.passedGates,
              failedGates: qualityReport.failedGates,
              issueCount: qualityReport.issues.length,
              errorCount: qualityReport.issues.filter(i => i.severity === "ERROR").length,
              warningCount: qualityReport.issues.filter(i => i.severity === "WARNING").length,
              rewriteAttempts: rewriteAttempt,
              issues: qualityReport.issues.map(i => ({
                gate: i.gate,
                chapter: i.chapter,
                code: i.code,
                message: i.message,
                severity: i.severity,
              })),
            },
          };
        }
        const titleSystem = `You summarize children's stories in ${targetLanguage}.`;
        const titlePrompt = buildStoryTitlePrompt({ storyText, language: normalizedRequest.language });
        const titleResult = await callStoryModel({
          systemPrompt: titleSystem,
          userPrompt: titlePrompt,
          responseFormat: "json_object",
          maxTokens: 2500,
          temperature: 0.6,
          context: "story-title",
          logSource: "phase6-story-llm",
          logMetadata: { storyId: normalizedRequest.storyId, step: "title" },
        });
        const titleParsed = safeJson(titleResult.content);
        if (titleParsed?.title) draft.title = titleParsed.title;
        if (titleParsed?.description) draft.description = titleParsed.description;

        if (titleResult.usage) {
          totalUsage = mergeUsage(totalUsage, titleResult.usage, model);
        }
      } catch (error) {
        console.warn("[story-writer] Failed to generate story title", error);
      }
    }

    return {
      draft,
      usage: totalUsage,
      qualityReport: {
        score: qualityReport.score,
        passedGates: qualityReport.passedGates,
        failedGates: qualityReport.failedGates,
        issueCount: qualityReport.issues.length,
        errorCount: qualityReport.issues.filter(i => i.severity === "ERROR").length,
        warningCount: qualityReport.issues.filter(i => i.severity === "WARNING").length,
        rewriteAttempts: rewriteAttempt,
        issues: qualityReport.issues.map(i => ({
          gate: i.gate,
          chapter: i.chapter,
          code: i.code,
          message: i.message,
          severity: i.severity,
        })),
      },
    };
  }
}

function extractDraftFromAnyFormat(input: {
  parsed: any;
  directives: SceneDirective[];
  language: string;
  wordsPerChapter: { min: number; max: number };
}): StoryDraft {
  const { parsed, directives, language, wordsPerChapter } = input;
  const continuous = extractContinuousStoryPayload(parsed, language);
  if (continuous?.storyText) {
    return buildDraftFromContinuousStory({
      title: continuous.title,
      description: continuous.description,
      storyText: continuous.storyText,
      directives,
      language,
      wordsPerChapter,
    });
  }
  return extractDraftFromChapterArray(parsed, directives, language);
}

function extractContinuousStoryPayload(parsed: any, language: string): {
  title: string;
  description: string;
  storyText: string;
} | null {
  if (!parsed || typeof parsed !== "object") return null;

  const title = typeof parsed.title === "string" && parsed.title.trim()
    ? parsed.title.trim()
    : language === "de" ? "Neue Geschichte" : "New Story";
  const description = typeof parsed.description === "string" ? parsed.description.trim() : "";

  const directTextFields = ["storyText", "story", "text", "content"];
  let storyText = "";
  for (const field of directTextFields) {
    const value = parsed[field];
    if (typeof value === "string" && value.trim()) {
      storyText = value.trim();
      break;
    }
  }

  if (!storyText && Array.isArray(parsed.chapters)) {
    const joined = parsed.chapters
      .map((chapter: any) => (typeof chapter?.text === "string" ? chapter.text.trim() : ""))
      .filter(Boolean)
      .join("\n\n");
    if (joined) storyText = joined;
  }

  storyText = sanitizeContinuousStoryText(storyText);
  if (!storyText) return null;

  return { title, description, storyText };
}

function buildDraftFromContinuousStory(input: {
  title: string;
  description: string;
  storyText: string;
  directives: SceneDirective[];
  language: string;
  wordsPerChapter: { min: number; max: number };
}): StoryDraft {
  const { title, description, storyText, directives, language, wordsPerChapter } = input;
  const chapters = splitContinuousStoryIntoChapters({
    storyText,
    directives,
    language,
    wordsPerChapter,
  });

  return {
    title: title || (language === "de" ? "Neue Geschichte" : "New Story"),
    description: description || storyText.slice(0, 180),
    chapters,
  };
}

function sanitizeContinuousStoryText(text: string): string {
  if (!text) return "";
  const withoutHeadings = text
    .replace(/^\s*#{1,6}\s*(Kapitel|Chapter)\s+\d+[^\n]*$/gim, "")
    .replace(/^\s*(Kapitel|Chapter)\s+\d+\s*[:.-]?\s*[^\n]*$/gim, "")
    .replace(/\n{3,}/g, "\n\n");

  return withoutHeadings.trim();
}

function extractDraftFromChapterArray(
  parsed: any,
  directives: SceneDirective[],
  language: string,
): StoryDraft {
  if (!parsed) {
    return {
      title: language === "de" ? "Neue Geschichte" : "New Story",
      description: "",
      chapters: directives.map(d => ({
        chapter: d.chapter,
        title: "",
        text: "",
      })),
    };
  }

  const title = parsed.title || (language === "de" ? "Neue Geschichte" : "New Story");
  const description = parsed.description || "";

  let chapters: StoryDraft["chapters"] = [];

  if (Array.isArray(parsed.chapters)) {
    chapters = parsed.chapters.map((ch: any, idx: number) => ({
      chapter: ch.chapter ?? idx + 1,
      title: "",
      text: ch.text || "",
    }));
  }

  if (chapters.length < directives.length) {
    for (const d of directives) {
      if (!chapters.find(ch => ch.chapter === d.chapter)) {
        chapters.push({
          chapter: d.chapter,
          title: "",
          text: "",
        });
      }
    }
    chapters.sort((a, b) => a.chapter - b.chapter);
  }

  return { title, description, chapters };
}

function sanitizeDraft(draft: StoryDraft): StoryDraft {
  const chapters = draft.chapters.map(ch => ({
    ...ch,
    title: "",
    text: sanitizeMetaStructureFromText(ch.text),
  }));
  return {
    ...draft,
    chapters: removeCrossChapterDuplicateSentences(chapters),
  };
}

/**
 * Removes sentences that appear VERBATIM in 2+ chapters.
 * Catches "Adrian spürte ein flaues Gefühl im Magen." repeated 4 times.
 * Only removes sentences that are longer than 20 chars (avoid removing short connectors).
 */
function removeCrossChapterDuplicateSentences(chapters: StoryDraft["chapters"]): StoryDraft["chapters"] {
  // Count how often each long sentence appears across all chapters
  const sentenceCounts = new Map<string, number>();
  for (const ch of chapters) {
    const sentences = splitSentences(ch.text);
    const seen = new Set<string>();
    for (const s of sentences) {
      const norm = s.trim().toLowerCase();
      if (norm.length < 20) continue;
      if (seen.has(norm)) continue;
      seen.add(norm);
      sentenceCounts.set(norm, (sentenceCounts.get(norm) ?? 0) + 1);
    }
  }

  // Sentences appearing in 2+ chapters are duplicates — keep first occurrence only
  const duplicates = new Set<string>([...sentenceCounts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([s]) => s));

  if (duplicates.size === 0) return chapters;

  const seenGlobally = new Set<string>();
  return chapters.map(ch => {
    const sentences = splitSentences(ch.text);
    const kept: string[] = [];
    for (const s of sentences) {
      const norm = s.trim().toLowerCase();
      if (duplicates.has(norm)) {
        if (seenGlobally.has(norm)) {
          // Skip - already appeared in an earlier chapter
          continue;
        }
        seenGlobally.add(norm);
      }
      kept.push(s.trim());
    }
    return { ...ch, text: kept.join(" ").trim() };
  });
}

function sanitizeMetaStructureFromText(text: string): string {
  if (!text) return text;
  const lines = text.split(/\r?\n/);
  const labelPattern = /^(?:\d+[\).]\s*)?(?:[-\u2022*]\s*)?(?:\*\*|__)?(?:(?:Der|Die|Das|The)\s+)?(Ort|Stimmung|Ziel|Hindernis|Handlung|Action|Sichtbare Aktion|Sichtbare Handlung|Visible action|Aktion fortgesetzt|Action continued|Mini[- ]?Problem|Mini[- ]?Aufl(?:oe|\u00f6)sung|Mini[- ]?resolution|Ausblick|Epilog|Hook|Scene|Mood|Goal|Obstacle|Outlook|Epilogue)(?:\*\*|__)?\s*[:\u2212\u2013\u2014-]\s*(.*)$/i;
  const sentenceLabelPattern = /^(?:\*\*|__)?(?:(?:Der|Die|Das|The)\s+)?(Ort|Stimmung|Ziel|Hindernis|Handlung|Action|Sichtbare Aktion|Sichtbare Handlung|Visible action|Aktion fortgesetzt|Action continued|Mini[- ]?Problem|Mini[- ]?Aufl(?:oe|\u00f6)sung|Mini[- ]?resolution|Ausblick|Epilog|Hook|Scene|Mood|Goal|Obstacle|Outlook|Epilogue)(?:\*\*|__)?\s*[:\u2212\u2013\u2014-]/i;

  const cleaned = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return "";

    const match = trimmed.match(labelPattern);
    if (!match) return line;

    const label = match[1].toLowerCase();
    const rest = (match[2] || "").trim();

    if (label === "epilog" || label === "epilogue") {
      return rest;
    }

    // For label-prefix patterns, keep the content after the label
    if (rest.length > 10) {
      return rest.charAt(0).toUpperCase() + rest.slice(1);
    }

    return "";
  });

  const sentenceCleaned = cleaned.map(line => {
    if (!line.trim()) return "";
    const parts = line.split(/(?<=[.!?])\s+/);
    const kept = parts.filter(part => {
      const trimmed = part.trim();
      if (!trimmed) return false;
      return !sentenceLabelPattern.test(trimmed);
    });
    return kept.join(" ").trim();
  });

  // Strip inline meta-label prefixes within sentences
  let result = sentenceCleaned
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();

  // Remove inline label prefixes (keep content after the colon)
  const inlineLabelPrefixes = [
    /Sichtbare Aktion:\s*/gi,
    /Sichtbare Handlung:\s*/gi,
    /Aktion fortgesetzt:\s*/gi,
    /(?:Der|Die|Das)\s+Ausblick\s*:\s*/gi,
    /(?:Der|Die|Das)\s+Hook\s*:\s*/gi,
    /(?:Der|Die|Das)\s+Epilog\s*:\s*/gi,
    /Ausblick\s*:\s*/gi,
    /Hook\s*:\s*/gi,
    /Epilog\s*:\s*/gi,
    /Visible action:\s*/gi,
    /Action continued:\s*/gi,
    /(?:The\s+)?Outlook\s*:\s*/gi,
    /(?:The\s+)?Hook\s*:\s*/gi,
    /(?:The\s+)?Epilogue\s*:\s*/gi,
    /Mini-Problem:\s*/gi,
    /Mini-Aufl(?:oe|ö)sung:\s*/gi,
  ];
  for (const pattern of inlineLabelPrefixes) {
    result = result.replace(pattern, "");
  }

  // Remove meta-narration sentences that describe story beats instead of telling the story
  const metaSentencePatterns = [
    /(?:^|(?<=\.\s))(?:Ihr|Das|Ein) (?:Ziel|Hindernis) war[^.!?]*[.!?]/gm,
    /(?:^|(?<=\.\s))(?:Her|The|An) (?:goal|obstacle) was[^.!?]*[.!?]/gm,
  ];
  for (const pattern of metaSentencePatterns) {
    result = result.replace(pattern, "");
  }

  // Strip content-filter placeholders (also when embedded in words like "[inhalt-gefiltert]iger")
  // Replace the entire word containing the placeholder with an ellipsis, then clean up double spaces
  result = result
    .replace(/\S*\[(?:inhalt-gefiltert|content-filtered|redacted|FILTERED|CENSORED)\]\S*/gi, "…")
    .replace(/\[(?:inhalt-gefiltert|content-filtered|redacted|FILTERED|CENSORED)\]/gi, "…")
    .replace(/\s*…\s*/g, " ")
    .replace(/\s{2,}/g, " ");

  // Remove banned filler words that LLMs consistently fail to avoid.
  // "plötzlich" is the worst offender — appears in every story despite explicit bans.
  // We remove it mid-sentence (", und plötzlich" → ", und") and sentence-initial ("Plötzlich" → next word capitalized).
  result = result
    .replace(/[,;]\s*(?:und\s+)?pl[öo]tzlich\b/gi, ",")
    .replace(/\bpl[öo]tzlich\s+/gi, "")
    .replace(/\s{2,}/g, " ");

  return result
    .replace(/\.\s*\.\s*/g, ". ")
    .replace(/^\.\s*/, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/  +/g, " ")
    .trim();
}

function safeJson(text: string) {
  if (!text) return null;
  const trimmed = text.trim();

  // Strip markdown code fences if present
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    // Try to recover a JSON object from surrounding text
    const first = candidate.indexOf("{");
    const last = candidate.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) {
      const slice = candidate.slice(first, last + 1);
      try {
        return JSON.parse(slice);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function findMissingCharacters(text: string, directive: SceneDirective, cast: CastSet): string[] {
  const textLower = text.toLowerCase();
  const names = directive.charactersOnStage
    .filter(slot => !slot.includes("ARTIFACT"))
    .map(slot => findCharacterDisplayName(cast, slot))
    .filter((name): name is string => Boolean(name));

  return names.filter(name => {
    // Check full name first
    if (textLower.includes(name.toLowerCase())) return false;
    // Also check any name PART (e.g. "Mia" from "Mia Neugier")
    // so natural prose using short names still counts as character present.
    const parts = name.toLowerCase().split(/\s+/).filter(p => p.length > 2);
    if (parts.some(p => textLower.includes(p))) return false;
    return true; // truly missing
  });
}

function findCharacterDisplayName(cast: CastSet, slotKey: string): string | null {
  const sheet = cast.avatars.find(a => a.slotKey === slotKey) || cast.poolCharacters.find(c => c.slotKey === slotKey);
  return sheet?.displayName ?? null;
}

function canAutoTrimLengthErrors(errorIssues: Array<{ code: string }>): boolean {
  if (errorIssues.length === 0) return false;
  return errorIssues.every(issue => issue.code === "TOTAL_TOO_LONG");
}

function autoTrimDraftToWordBudget(input: {
  draft: StoryDraft;
  maxWords: number;
  minWordsPerChapter: number;
}): { draft: StoryDraft; changed: boolean } {
  const { draft, maxWords, minWordsPerChapter } = input;
  const chapters = draft.chapters.map(ch => ({ ...ch, text: ch.text || "" }));
  let totalWords = chapters.reduce((sum, ch) => sum + countWords(ch.text), 0);
  if (totalWords <= maxWords) return { draft, changed: false };

  let changed = false;
  let guard = 0;

  while (totalWords > maxWords && guard < 120) {
    guard++;
    const overflow = totalWords - maxWords;
    const candidates = chapters
      .map((chapter, index) => ({ index, words: countWords(chapter.text) }))
      .filter(item => item.words > minWordsPerChapter + 8)
      .sort((a, b) => b.words - a.words);

    if (candidates.length === 0) break;

    let trimmedOne = false;
    for (const candidate of candidates) {
      const currentWords = candidate.words;
      const reduceBy = Math.min(28, Math.max(8, Math.ceil(overflow / 2)));
      const targetWords = Math.max(minWordsPerChapter, currentWords - reduceBy);
      const nextText = truncateTextToWordTarget(chapters[candidate.index].text, targetWords);
      if (nextText === chapters[candidate.index].text) continue;

      chapters[candidate.index].text = nextText;
      trimmedOne = true;
      changed = true;
      break;
    }

    if (!trimmedOne) break;
    totalWords = chapters.reduce((sum, ch) => sum + countWords(ch.text), 0);
  }

  if (!changed) return { draft, changed: false };
  return { draft: { ...draft, chapters }, changed: true };
}

function truncateTextToWordTarget(text: string, targetWords: number): string {
  const cleaned = text.trim();
  if (!cleaned) return cleaned;

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length <= targetWords) return cleaned;

  const sentences = splitSentences(cleaned);
  const keptSentences: string[] = [];
  let runningWords = 0;

  for (const sentence of sentences) {
    const sentenceWords = countWords(sentence);
    if (runningWords + sentenceWords > targetWords) break;
    keptSentences.push(sentence.trim());
    runningWords += sentenceWords;
  }

  if (keptSentences.length >= 2) {
    const joined = keptSentences.join(" ").replace(/\s+/g, " ").trim();
    if (countWords(joined) >= Math.max(30, Math.floor(targetWords * 0.75))) {
      return joined;
    }
  }

  let fallback = words.slice(0, targetWords).join(" ").trim();
  fallback = fallback.replace(/[,:;!?-]+$/g, "").trim();
  if (fallback && !/[.!?]$/.test(fallback)) fallback += ".";
  return fallback;
}

// Codes excluded from rewrite quality comparison (too noisy / unreliable detection)
// Also includes structural issues that LLM rewrites fundamentally cannot fix.
const NOISY_CODES = new Set([
  "UNLOCKED_CHARACTER", "UNLOCKED_CHARACTER_ACTOR", "VOICE_INDISTINCT",
  "GLOBAL_CAST_OVERLOAD",            // Cast is determined before writing; LLM can't remove characters
]);

function countErrorIssues(report: {
  issues: Array<{ severity: "ERROR" | "WARNING"; code: string; chapter: number }>;
}): number {
  return report.issues.filter(issue => issue.severity === "ERROR" && !NOISY_CODES.has(issue.code)).length;
}

function countWarningIssues(report: {
  issues: Array<{ severity: "ERROR" | "WARNING"; code: string; chapter: number }>;
}): number {
  return report.issues.filter(issue => issue.severity === "WARNING" && !NOISY_CODES.has(issue.code)).length;
}

function collectErrorIssueKeys(report: {
  issues: Array<{ severity: "ERROR" | "WARNING"; code: string; chapter: number }>;
}): Set<string> {
  const keys = new Set<string>();
  for (const issue of report.issues) {
    if (issue.severity !== "ERROR") continue;
    if (NOISY_CODES.has(issue.code)) continue;
    keys.add(`${issue.chapter}:${issue.code}`);
  }
  return keys;
}

function isRewriteQualityBetter(
  current: {
    issues: Array<{ severity: "ERROR" | "WARNING"; code: string; chapter: number }>;
    failedGates: string[];
    score: number;
  },
  candidate: {
    issues: Array<{ severity: "ERROR" | "WARNING"; code: string; chapter: number }>;
    failedGates: string[];
    score: number;
  },
): boolean {
  const currentErrors = countErrorIssues(current);
  const candidateErrors = countErrorIssues(candidate);
  if (candidateErrors < currentErrors) return true;
  if (candidateErrors > currentErrors) return false;

  // Same error count: prefer candidate that resolves more existing hard issues
  // than it introduces.
  const currentKeys = collectErrorIssueKeys(current);
  const candidateKeys = collectErrorIssueKeys(candidate);
  let resolved = 0;
  let introduced = 0;
  for (const key of currentKeys) {
    if (!candidateKeys.has(key)) resolved++;
  }
  for (const key of candidateKeys) {
    if (!currentKeys.has(key)) introduced++;
  }
  if (resolved > introduced) return true;
  if (introduced > resolved) return false;

  const currentFailedGates = current.failedGates.length;
  const candidateFailedGates = candidate.failedGates.length;
  if (candidateFailedGates < currentFailedGates) return true;
  if (candidateFailedGates > currentFailedGates) return false;

  const currentWarnings = countWarningIssues(current);
  const candidateWarnings = countWarningIssues(candidate);
  if (candidateWarnings < currentWarnings) return true;
  if (candidateWarnings > currentWarnings) return false;

  return candidate.score >= current.score;
}

function isWarningPolishBetter(
  current: {
    issues: Array<{ severity: "ERROR" | "WARNING"; code: string; chapter: number }>;
    failedGates: string[];
    score: number;
  },
  candidate: {
    issues: Array<{ severity: "ERROR" | "WARNING"; code: string; chapter: number }>;
    failedGates: string[];
    score: number;
  },
): boolean {
  const currentErrors = countErrorIssues(current);
  const candidateErrors = countErrorIssues(candidate);
  if (candidateErrors > currentErrors) return false;
  if (candidateErrors < currentErrors) return true;

  const currentWarnings = countWarningIssues(current);
  const candidateWarnings = countWarningIssues(candidate);
  if (candidateWarnings < currentWarnings) return true;
  if (candidateWarnings > currentWarnings) return false;

  return candidate.score > current.score;
}

function mergeUsage(existing: TokenUsage | undefined, incoming: TokenUsage, model: string): TokenUsage {
  const merged = {
    promptTokens: (existing?.promptTokens ?? 0) + incoming.promptTokens,
    completionTokens: (existing?.completionTokens ?? 0) + incoming.completionTokens,
    totalTokens: (existing?.totalTokens ?? 0) + incoming.totalTokens,
    model,
  } as TokenUsage;

  const costs = calculateTokenCosts({
    promptTokens: merged.promptTokens,
    completionTokens: merged.completionTokens,
    model,
  });

  return {
    ...merged,
    inputCostUSD: costs.inputCostUSD,
    outputCostUSD: costs.outputCostUSD,
    totalCostUSD: costs.totalCostUSD,
  };
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
}

function getEdgeContext(text: string, edge: "start" | "end", maxSentences = 1): string {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return "";
  if (edge === "start") {
    return sentences.slice(0, maxSentences).join(" ");
  }
  return sentences.slice(Math.max(0, sentences.length - maxSentences)).join(" ");
}

// V2: getHardMinChapterWords entfernt - jetzt durch HARD_MIN_CHAPTER_WORDS Konstante ersetzt
