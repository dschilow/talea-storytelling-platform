import type { CastSet, SceneDirective, StoryDraft, StoryChapterText } from "./types";
import type { WordBudget } from "./word-budget";

export interface QualityIssue {
  gate: string;
  chapter: number;
  code: string;
  message: string;
  severity: "ERROR" | "WARNING";
}

export interface QualityReport {
  issues: QualityIssue[];
  score: number;
  passedGates: string[];
  failedGates: string[];
}

// ─── Gate 1: Length & Pacing ────────────────────────────────────────────────────
function gateLengthAndPacing(draft: StoryDraft, wordBudget?: WordBudget): QualityIssue[] {
  const issues: QualityIssue[] = [];
  if (!wordBudget) return issues;

  const totalWords = draft.chapters.reduce((sum, ch) => sum + countWords(ch.text), 0);

  if (totalWords < wordBudget.minWords) {
    issues.push({
      gate: "LENGTH_PACING",
      chapter: 0,
      code: "TOTAL_TOO_SHORT",
      message: `Story total ${totalWords} words, minimum ${wordBudget.minWords}`,
      severity: "ERROR",
    });
  } else if (totalWords > wordBudget.maxWords) {
    issues.push({
      gate: "LENGTH_PACING",
      chapter: 0,
      code: "TOTAL_TOO_LONG",
      message: `Story total ${totalWords} words, maximum ${wordBudget.maxWords}`,
      severity: "ERROR",
    });
  }

  for (const ch of draft.chapters) {
    const wc = countWords(ch.text);
    if (wc < wordBudget.minWordsPerChapter) {
      issues.push({
        gate: "LENGTH_PACING",
        chapter: ch.chapter,
        code: "CHAPTER_TOO_SHORT",
        message: `Chapter ${ch.chapter}: ${wc} words, minimum ${wordBudget.minWordsPerChapter}`,
        severity: "ERROR",
      });
    } else if (wc > wordBudget.maxWordsPerChapter) {
      issues.push({
        gate: "LENGTH_PACING",
        chapter: ch.chapter,
        code: "CHAPTER_TOO_LONG",
        message: `Chapter ${ch.chapter}: ${wc} words, maximum ${wordBudget.maxWordsPerChapter}`,
        severity: "ERROR",
      });
    }
  }

  return issues;
}

// ─── Gate 2: Chapter Structure ──────────────────────────────────────────────────
function gateChapterStructure(draft: StoryDraft, language: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";

  for (const ch of draft.chapters) {
    const text = ch.text;
    const sentences = splitSentences(text);

    if (sentences.length < 5) {
      issues.push({
        gate: "CHAPTER_STRUCTURE",
        chapter: ch.chapter,
        code: "TOO_FEW_SENTENCES",
        message: isDE
          ? `Kapitel ${ch.chapter}: Nur ${sentences.length} Saetze, mindestens 5 erwartet`
          : `Chapter ${ch.chapter}: Only ${sentences.length} sentences, at least 5 expected`,
        severity: "WARNING",
      });
    }

    const hasDialogue = /[""„‟»«]/.test(text) || /^\s*[—–-]\s/m.test(text);
    if (!hasDialogue) {
      issues.push({
        gate: "CHAPTER_STRUCTURE",
        chapter: ch.chapter,
        code: "NO_DIALOGUE",
        message: isDE
          ? `Kapitel ${ch.chapter}: Kein Dialog gefunden`
          : `Chapter ${ch.chapter}: No dialogue found`,
        severity: "WARNING",
      });
    }
  }

  return issues;
}

// ─── Gate 3: Dialogue Quote ─────────────────────────────────────────────────────
function gateDialogueQuote(draft: StoryDraft, language: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";

  for (const ch of draft.chapters) {
    const dialogueCount = countDialogueLines(ch.text);
    if (dialogueCount < 2) {
      issues.push({
        gate: "DIALOGUE_QUOTE",
        chapter: ch.chapter,
        code: "TOO_FEW_DIALOGUES",
        message: isDE
          ? `Kapitel ${ch.chapter}: Nur ${dialogueCount} Dialogzeilen, mindestens 2 erwartet`
          : `Chapter ${ch.chapter}: Only ${dialogueCount} dialogue lines, min 2`,
        severity: "ERROR",
      });
    } else if (dialogueCount > 6) {
      issues.push({
        gate: "DIALOGUE_QUOTE",
        chapter: ch.chapter,
        code: "TOO_MANY_DIALOGUES",
        message: isDE
          ? `Kapitel ${ch.chapter}: ${dialogueCount} Dialogzeilen, maximal 6`
          : `Chapter ${ch.chapter}: ${dialogueCount} dialogue lines, max 6`,
        severity: "WARNING",
      });
    }
  }

  return issues;
}

// ─── Gate 4: Character Integration ──────────────────────────────────────────────
function gateCharacterIntegration(
  draft: StoryDraft,
  directives: SceneDirective[],
  cast: CastSet,
  language: string,
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";

  for (const directive of directives) {
    const ch = draft.chapters.find(c => c.chapter === directive.chapter);
    if (!ch) continue;

    const textLower = ch.text.toLowerCase();
    const characterSlots = directive.charactersOnStage.filter(slot => !slot.includes("ARTIFACT"));

    for (const slot of characterSlots) {
      const name = findCharacterName(cast, slot);
      if (!name) continue;

      if (!textLower.includes(name.toLowerCase())) {
        issues.push({
          gate: "CHARACTER_INTEGRATION",
          chapter: ch.chapter,
          code: "MISSING_CHARACTER",
          message: isDE ? `Figur fehlt: ${name}` : `Missing character: ${name}`,
          severity: "ERROR",
        });
        continue;
      }

      const hasAction = checkCharacterHasAction(ch.text, name);
      if (!hasAction) {
        issues.push({
          gate: "CHARACTER_INTEGRATION",
          chapter: ch.chapter,
          code: "PASSIVE_CHARACTER",
          message: isDE
            ? `${name} ist nur erwaehnt, hat aber keine aktive Handlung`
            : `${name} is only mentioned, no active action`,
          severity: "WARNING",
        });
      }
    }
  }

  const metaPhrases = [
    "gehoeren seit jeher", "gehören seit jeher",
    "ganz selbstverstaendlich dabei", "ganz selbstverständlich dabei",
    "wie in diesem maerchen", "wie in diesem märchen",
    "have always been part", "naturally belongs here",
    "always been part of this tale",
  ];

  for (const ch of draft.chapters) {
    const textLower = ch.text.toLowerCase();
    for (const phrase of metaPhrases) {
      if (textLower.includes(phrase)) {
        issues.push({
          gate: "CHARACTER_INTEGRATION",
          chapter: ch.chapter,
          code: "META_BELONGING_PHRASE",
          message: isDE
            ? `Verbotene Meta-Aussage ueber Zugehoerigkeit gefunden`
            : `Forbidden meta-belonging phrase detected`,
          severity: "ERROR",
        });
        break;
      }
    }
  }

  return issues;
}

// ─── Gate 5: Cast Lock ──────────────────────────────────────────────────────────
function gateCastLock(
  draft: StoryDraft,
  cast: CastSet,
  language: string,
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";

  const allowedNames = new Set<string>();
  for (const sheet of [...cast.avatars, ...cast.poolCharacters]) {
    allowedNames.add(sheet.displayName.toLowerCase());
    const parts = sheet.displayName.toLowerCase().split(/\s+/);
    for (const part of parts) {
      if (part.length > 2) allowedNames.add(part);
    }
  }
  if (cast.artifact?.name) {
    allowedNames.add(cast.artifact.name.toLowerCase());
  }

  const properNameRegex = /\b([A-ZÄÖÜ][a-zäöüß]{2,}(?:\s+[A-ZÄÖÜ][a-zäöüß]{2,})*)\b/g;

  for (const ch of draft.chapters) {
    const matches = ch.text.matchAll(properNameRegex);
    for (const match of matches) {
      const name = match[1].toLowerCase();
      if (isCommonWord(name, language)) continue;
      if (allowedNames.has(name)) continue;
      const parts = name.split(/\s+/);
      if (parts.some(p => allowedNames.has(p))) continue;

      issues.push({
        gate: "CAST_LOCK",
        chapter: ch.chapter,
        code: "UNLOCKED_CHARACTER",
        message: isDE
          ? `Neuer Eigenname "${match[1]}" nicht in der erlaubten Figurenliste`
          : `New proper name "${match[1]}" not in allowed character list`,
        severity: "WARNING",
      });
    }
  }

  return issues;
}

// ─── Gate 6: Repetition Limiter ─────────────────────────────────────────────────
function gateRepetitionLimiter(draft: StoryDraft, language: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";

  const fillerWords = isDE
    ? ["plötzlich", "ploetzlich", "auf einmal", "mit einem mal", "da geschah es"]
    : ["suddenly", "all of a sudden", "in that moment", "just then"];

  const fillerCounts: Record<string, number> = {};
  for (const ch of draft.chapters) {
    const textLower = ch.text.toLowerCase();
    for (const filler of fillerWords) {
      const count = countOccurrences(textLower, filler);
      fillerCounts[filler] = (fillerCounts[filler] ?? 0) + count;
    }
  }

  for (const [filler, count] of Object.entries(fillerCounts)) {
    if (count > 3) {
      issues.push({
        gate: "REPETITION_LIMITER",
        chapter: 0,
        code: "FILLER_OVERUSE",
        message: isDE
          ? `Fuellwort "${filler}" ${count}x verwendet (max 3)`
          : `Filler "${filler}" used ${count}x (max 3)`,
        severity: "WARNING",
      });
    }
  }

  const sentences = draft.chapters.flatMap((ch, idx) =>
    splitSentences(ch.text).map(s => ({ chapter: idx + 1, text: normalizeForComparison(s) }))
  );

  for (let i = 0; i < sentences.length; i++) {
    for (let j = i + 1; j < sentences.length; j++) {
      if (sentences[i].chapter === sentences[j].chapter) continue;
      if (sentences[i].text.length < 20) continue;
      if (similarity(sentences[i].text, sentences[j].text) > 0.85) {
        issues.push({
          gate: "REPETITION_LIMITER",
          chapter: sentences[j].chapter,
          code: "DUPLICATE_SENTENCE",
          message: isDE
            ? `Kapitel ${sentences[j].chapter}: Fast identischer Satz wie in Kapitel ${sentences[i].chapter}`
            : `Chapter ${sentences[j].chapter}: Near-duplicate sentence from chapter ${sentences[i].chapter}`,
          severity: "WARNING",
        });
        break;
      }
    }
  }

  return issues;
}

// ─── Gate 7: Imagery Balance ────────────────────────────────────────────────────
function gateImageryBalance(draft: StoryDraft, language: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";

  const metaphorPatterns = isDE
    ? [/wie\s+(?:ein|eine|der|die|das)\s+\w+/gi, /als\s+(?:ob|wäre|würde)/gi]
    : [/like\s+(?:a|an|the)\s+\w+/gi, /as\s+(?:if|though)/gi];

  for (const ch of draft.chapters) {
    let metaphorCount = 0;
    for (const pattern of metaphorPatterns) {
      const matches = ch.text.match(pattern);
      metaphorCount += matches?.length ?? 0;
    }

    if (metaphorCount > 4) {
      issues.push({
        gate: "IMAGERY_BALANCE",
        chapter: ch.chapter,
        code: "METAPHOR_OVERLOAD",
        message: isDE
          ? `Kapitel ${ch.chapter}: ${metaphorCount} Metaphern/Vergleiche (max 4 pro Kapitel)`
          : `Chapter ${ch.chapter}: ${metaphorCount} metaphors/similes (max 4 per chapter)`,
        severity: "WARNING",
      });
    }
  }

  return issues;
}

// ─── Gate 8: Tension Arc ────────────────────────────────────────────────────────
function gateTensionArc(draft: StoryDraft, language: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  if (draft.chapters.length < 4) return issues;
  const isDE = language === "de";

  const chapterLengths = draft.chapters.map(ch => countWords(ch.text));
  const avgLength = chapterLengths.reduce((a, b) => a + b, 0) / chapterLengths.length;

  const secondToLast = draft.chapters[draft.chapters.length - 2];
  if (secondToLast) {
    const stl = countWords(secondToLast.text);
    if (stl < avgLength * 0.7) {
      issues.push({
        gate: "TENSION_ARC",
        chapter: secondToLast.chapter,
        code: "WEAK_CLIMAX",
        message: isDE
          ? `Vorletzes Kapitel (Hoehepunkt) ist zu kurz (${stl} Woerter vs. Durchschnitt ${Math.round(avgLength)})`
          : `Penultimate chapter (climax) is too short (${stl} words vs avg ${Math.round(avgLength)})`,
        severity: "WARNING",
      });
    }
  }

  return issues;
}

// ─── Gate 9: Artifact Arc ───────────────────────────────────────────────────────
function gateArtifactArc(
  draft: StoryDraft,
  directives: SceneDirective[],
  cast: CastSet,
  language: string,
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";
  const artifactName = cast.artifact?.name?.toLowerCase();
  if (!artifactName) return issues;

  const hasArtifactDirective = directives.some(d =>
    d.charactersOnStage.includes("SLOT_ARTIFACT_1") || d.artifactUsage?.toLowerCase().includes("artefakt")
  );
  if (!hasArtifactDirective) return issues;

  let artifactMentionCount = 0;
  let firstMention = -1;
  let lastMention = -1;

  for (const ch of draft.chapters) {
    const textLower = ch.text.toLowerCase();
    const count = countOccurrences(textLower, artifactName);
    if (count > 0) {
      artifactMentionCount += count;
      if (firstMention === -1) firstMention = ch.chapter;
      lastMention = ch.chapter;
    }
  }

  if (artifactMentionCount < 2) {
    issues.push({
      gate: "ARTIFACT_ARC",
      chapter: 0,
      code: "ARTIFACT_UNDERUSED",
      message: isDE
        ? `Artefakt "${cast.artifact.name}" nur ${artifactMentionCount}x erwaehnt (mind. 2 aktive Szenen)`
        : `Artifact "${cast.artifact.name}" only mentioned ${artifactMentionCount}x (need 2+ active scenes)`,
      severity: "ERROR",
    });
  }

  const totalChapters = draft.chapters.length;
  if (firstMention > 2 && totalChapters >= 4) {
    issues.push({
      gate: "ARTIFACT_ARC",
      chapter: firstMention,
      code: "ARTIFACT_LATE_INTRO",
      message: isDE
        ? `Artefakt erst in Kapitel ${firstMention} eingefuehrt (soll in Kapitel 1-2)`
        : `Artifact introduced in chapter ${firstMention} (should be ch 1-2)`,
      severity: "WARNING",
    });
  }

  return issues;
}

// ─── Gate 10: Ending Payoff ─────────────────────────────────────────────────────
function gateEndingPayoff(draft: StoryDraft, language: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";
  const lastChapter = draft.chapters[draft.chapters.length - 1];
  if (!lastChapter) return issues;

  const lastText = lastChapter.text;
  const wordCount = countWords(lastText);

  if (wordCount < 80) {
    issues.push({
      gate: "ENDING_PAYOFF",
      chapter: lastChapter.chapter,
      code: "ENDING_TOO_SHORT",
      message: isDE
        ? `Letztes Kapitel zu kurz (${wordCount} Woerter) fuer ein befriedigendes Ende`
        : `Last chapter too short (${wordCount} words) for a satisfying ending`,
      severity: "ERROR",
    });
  }

  const lastSentences = splitSentences(lastText);
  const lastSentence = lastSentences[lastSentences.length - 1] ?? "";

  const cliffhangerPatterns = isDE
    ? [/\?\s*$/, /\.\.\.\s*$/, /doch dann\s*$/, /was wuerde\s/, /was würde\s/]
    : [/\?\s*$/, /\.\.\.\s*$/, /but then\s*$/, /what would\s/];

  for (const pattern of cliffhangerPatterns) {
    if (pattern.test(lastSentence.trim())) {
      issues.push({
        gate: "ENDING_PAYOFF",
        chapter: lastChapter.chapter,
        code: "CLIFFHANGER_ENDING",
        message: isDE
          ? `Letztes Kapitel endet mit Cliffhanger statt warmem Abschluss`
          : `Last chapter ends with cliffhanger instead of warm resolution`,
        severity: "ERROR",
      });
      break;
    }
  }

  return issues;
}

// ─── Gate: Instruction Leak ─────────────────────────────────────────────────────
function gateInstructionLeak(draft: StoryDraft, language: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";

  const forbiddenSnippets = [
    "tie the scene", "without breaking canon", "canon anchor line",
    "kanonischer hinweis", "canon hint", "walking the same path in chapter",
    "have always been part of this tale", "scene directive", "return json",
    "final chapter:", "strict rules", "stricte regeln", "szenen-vorgabe",
    "erlaubte namen", "gib json", "kapiteltext",
  ];

  for (const ch of draft.chapters) {
    const textLower = ch.text.toLowerCase();
    for (const snippet of forbiddenSnippets) {
      if (textLower.includes(snippet)) {
        issues.push({
          gate: "INSTRUCTION_LEAK",
          chapter: ch.chapter,
          code: "INSTRUCTION_LEAK",
          message: isDE
            ? `Anweisungstext im Kapitel ${ch.chapter} gefunden`
            : `Instruction text leaked into chapter ${ch.chapter}`,
          severity: "ERROR",
        });
        break;
      }
    }

    if (isDE && /\bchapter\s+\d/i.test(ch.text)) {
      issues.push({
        gate: "INSTRUCTION_LEAK",
        chapter: ch.chapter,
        code: "ENGLISH_LEAK",
        message: `Englisches Fragment in deutschem Kapitel ${ch.chapter}`,
        severity: "ERROR",
      });
    }
  }

  return issues;
}

// ─── Main Runner ────────────────────────────────────────────────────────────────
export function runQualityGates(input: {
  draft: StoryDraft;
  directives: SceneDirective[];
  cast: CastSet;
  language: string;
  wordBudget?: WordBudget;
}): QualityReport {
  const { draft, directives, cast, language, wordBudget } = input;

  const gateRunners: Array<{ name: string; fn: () => QualityIssue[] }> = [
    { name: "LENGTH_PACING", fn: () => gateLengthAndPacing(draft, wordBudget) },
    { name: "CHAPTER_STRUCTURE", fn: () => gateChapterStructure(draft, language) },
    { name: "DIALOGUE_QUOTE", fn: () => gateDialogueQuote(draft, language) },
    { name: "CHARACTER_INTEGRATION", fn: () => gateCharacterIntegration(draft, directives, cast, language) },
    { name: "CAST_LOCK", fn: () => gateCastLock(draft, cast, language) },
    { name: "REPETITION_LIMITER", fn: () => gateRepetitionLimiter(draft, language) },
    { name: "IMAGERY_BALANCE", fn: () => gateImageryBalance(draft, language) },
    { name: "TENSION_ARC", fn: () => gateTensionArc(draft, language) },
    { name: "ARTIFACT_ARC", fn: () => gateArtifactArc(draft, directives, cast, language) },
    { name: "ENDING_PAYOFF", fn: () => gateEndingPayoff(draft, language) },
    { name: "INSTRUCTION_LEAK", fn: () => gateInstructionLeak(draft, language) },
  ];

  const allIssues: QualityIssue[] = [];
  const passedGates: string[] = [];
  const failedGates: string[] = [];

  for (const gate of gateRunners) {
    const gateIssues = gate.fn();
    allIssues.push(...gateIssues);
    const hasErrors = gateIssues.some(i => i.severity === "ERROR");
    if (hasErrors) {
      failedGates.push(gate.name);
    } else {
      passedGates.push(gate.name);
    }
  }

  const errorCount = allIssues.filter(i => i.severity === "ERROR").length;
  const warningCount = allIssues.filter(i => i.severity === "WARNING").length;
  const score = Math.max(0, 10 - errorCount - warningCount * 0.5);

  return { issues: allIssues, score, passedGates, failedGates };
}

export function buildRewriteInstructions(issues: QualityIssue[], language: string): string {
  if (issues.length === 0) return "";
  const isDE = language === "de";

  const grouped = new Map<number, QualityIssue[]>();
  for (const issue of issues) {
    const ch = issue.chapter;
    if (!grouped.has(ch)) grouped.set(ch, []);
    grouped.get(ch)!.push(issue);
  }

  const lines: string[] = [];
  if (isDE) {
    lines.push("QUALITAETS-PROBLEME DIE BEHOBEN WERDEN MUESSEN:");
  } else {
    lines.push("QUALITY ISSUES TO FIX:");
  }

  for (const [chapter, chIssues] of grouped) {
    if (chapter === 0) {
      lines.push(isDE ? "\nGesamte Geschichte:" : "\nOverall story:");
    } else {
      lines.push(isDE ? `\nKapitel ${chapter}:` : `\nChapter ${chapter}:`);
    }
    for (const issue of chIssues) {
      lines.push(`  - [${issue.code}] ${issue.message}`);
    }
  }

  return lines.join("\n");
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
}

function countDialogueLines(text: string): number {
  const patterns = [
    /[""„‟»«][^""„‟»«]+[""„‟»«]/g,
    /^\s*[—–-]\s+.+$/gm,
  ];
  let count = 0;
  for (const p of patterns) {
    const matches = text.match(p);
    count += matches?.length ?? 0;
  }
  return count;
}

function checkCharacterHasAction(text: string, name: string): boolean {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const actionPatterns = [
    new RegExp(`${escapedName}\\s+\\w+(?:te|t|en|ete|ierte|te sich)\\b`, "i"),
    new RegExp(`${escapedName}\\s+(?:rief|sagte|fragte|fluesterte|flüsterte|lachte|nickte|schüttelte|griff|nahm|hob|legte|stellte|drehte|sprang|rannte|ging|lief|schaute|blickte|laechelte|lächelte|stand|setzte|zog|drueckte|drückte|oeffnete|öffnete|schloss|warf|fing|hielt)\\b`, "i"),
    new RegExp(`[""\u201E\u201C\u201D\u00BB\u00AB][^""\u201E\u201C\u201D\u00BB\u00AB]+[""\u201E\u201C\u201D\u00BB\u00AB],?\\s*(?:sagte|rief|fragte|fluesterte|flüsterte|murmelte)\\s+${escapedName}`, "i"),
    new RegExp(`${escapedName}\\s+(?:said|asked|whispered|shouted|called|laughed|nodded|grabbed|took|lifted|placed|turned|jumped|ran|walked|looked|smiled|stood|sat|pulled|pushed|opened|closed|threw|caught|held)\\b`, "i"),
  ];

  return actionPatterns.some(p => p.test(text));
}

function findCharacterName(cast: CastSet, slotKey: string): string | null {
  const sheet = cast.avatars.find(a => a.slotKey === slotKey) || cast.poolCharacters.find(c => c.slotKey === slotKey);
  return sheet?.displayName ?? null;
}

function countOccurrences(text: string, search: string): number {
  let count = 0;
  let pos = 0;
  while ((pos = text.indexOf(search, pos)) !== -1) {
    count++;
    pos += search.length;
  }
  return count;
}

function normalizeForComparison(text: string): string {
  return text.toLowerCase().replace(/[^a-zäöüß\s]/g, "").replace(/\s+/g, " ").trim();
}

function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1;
  const editDistance = levenshtein(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function isCommonWord(word: string, language: string): boolean {
  const commonDE = new Set([
    "der", "die", "das", "ein", "eine", "aber", "und", "oder", "doch", "noch", "dann",
    "dort", "hier", "jetzt", "ganz", "schon", "auch", "nur", "mehr", "sehr", "viel",
    "alle", "andere", "andere", "weil", "wenn", "wie", "was", "wer", "vom", "zum",
    "mit", "bei", "nach", "vor", "aus", "auf", "für", "über", "durch", "ohne",
    "gegen", "unter", "neben", "zwischen", "hinter", "seit", "bis", "während",
    "morgen", "abend", "nacht", "tag", "wald", "berg", "see", "fluss", "haus",
    "stadt", "dorf", "weg", "tor", "tür", "fenster", "boden", "himmel", "sonne",
    "mond", "stern", "wind", "regen", "schnee", "feuer", "wasser", "erde", "luft",
    "baum", "blume", "gras", "stein", "fels", "gold", "silber", "licht", "schatten",
    "stimme", "hand", "herz", "auge", "kopf", "freude", "angst", "mut", "kraft",
    "mama", "papa", "kind", "freund", "freundin", "bruder", "schwester",
    "koenig", "koenigin", "prinz", "prinzessin", "ritter", "hexe", "drache",
    "könig", "königin",
    "platz", "markt", "garten", "turm", "schloss", "burg",
  ]);
  const commonEN = new Set([
    "the", "and", "but", "for", "not", "you", "all", "can", "had", "her",
    "was", "one", "our", "out", "day", "get", "has", "him", "his", "how",
    "its", "may", "new", "now", "old", "see", "way", "who", "did", "got",
    "let", "say", "she", "too", "use", "dad", "mom",
    "then", "than", "when", "what", "that", "this", "with", "from", "will",
    "just", "like", "over", "back", "also", "made", "after", "first",
    "forest", "mountain", "river", "lake", "house", "castle", "garden",
    "tower", "village", "town", "path", "door", "window", "sky", "sun",
    "moon", "star", "wind", "rain", "snow", "fire", "water", "earth",
    "tree", "flower", "stone", "light", "shadow", "voice", "heart", "hand",
    "king", "queen", "prince", "princess", "knight", "witch", "dragon",
  ]);

  const set = language === "de" ? commonDE : commonEN;
  return set.has(word);
}
