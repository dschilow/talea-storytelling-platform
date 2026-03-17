import type { CastSet, SceneDirective, StoryDraft, ArtifactArcPlan } from "./types";
import type { WordBudget } from "./word-budget";
import { ALL_BANNED_PHRASES } from "./canon-fusion";
import { findTemplatePhraseMatches } from "./template-phrases";
import { getChildFocusNames, getCoreChapterCharacterNames, isLikelyChildCharacter } from "./character-focus";

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
  const hardMin = getHardMinChapterWords(draft, wordBudget);

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
    if (hardMin && wc < hardMin) {
      issues.push({
        gate: "LENGTH_PACING",
        chapter: ch.chapter,
        code: "CHAPTER_TOO_SHORT_HARD",
        message: `Chapter ${ch.chapter}: ${wc} words, hard minimum ${hardMin}`,
        severity: "ERROR",
      });
    } else if (wc < wordBudget.minWordsPerChapter) {
      issues.push({
        gate: "LENGTH_PACING",
        chapter: ch.chapter,
        code: "CHAPTER_TOO_SHORT",
        message: `Chapter ${ch.chapter}: ${wc} words, minimum ${wordBudget.minWordsPerChapter}`,
        severity: "WARNING",
      });
    } else if (wc > wordBudget.maxWordsPerChapter) {
      issues.push({
        gate: "LENGTH_PACING",
        chapter: ch.chapter,
        code: "CHAPTER_TOO_LONG",
        message: `Chapter ${ch.chapter}: ${wc} words, maximum ${wordBudget.maxWordsPerChapter}`,
        severity: "WARNING",
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

    if (sentences.length < 3) {
      issues.push({
        gate: "CHAPTER_STRUCTURE",
        chapter: ch.chapter,
        code: "CHAPTER_PLACEHOLDER",
        message: isDE
          ? `Kapitel ${ch.chapter}: Nur ${sentences.length} Saetze, Kapitel wirkt wie Platzhalter`
          : `Chapter ${ch.chapter}: Only ${sentences.length} sentences, chapter reads like a placeholder`,
        severity: "ERROR",
      });
    } else if (sentences.length < 5) {
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

    const hasDialogue = /[""„‟»«\u201C\u201D\u201E\u201A\u2018\u2019]/.test(text) || /^\s*[—–-]\s/m.test(text);
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
function gateDialogueQuote(
  draft: StoryDraft,
  language: string,
  ageRange?: { min: number; max: number },
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";
  const ageMax = ageRange?.max ?? 12;
  const minDialogueLines = ageMax <= 8 ? 2 : 2;
  const minDialogueRatio = ageMax <= 8 ? 0.22 : 0.20;
  const maxDialogueRatio = ageMax <= 8 ? 0.55 : 0.75;
  const criticalDialogueRatio = ageMax <= 8 ? 0.14 : 0.14;
  const extremeHighDialogueRatio = ageMax <= 8 ? 0.68 : 0.84;

  for (const ch of draft.chapters) {
    const sentenceCount = Math.max(1, splitSentences(ch.text).length);
    const dialogueCount = countDialogueLines(ch.text);
    const dialogueRatio = dialogueCount / sentenceCount;

    if (dialogueCount < minDialogueLines) {
      issues.push({
        gate: "DIALOGUE_QUOTE",
        chapter: ch.chapter,
        code: "TOO_FEW_DIALOGUES",
        message: isDE
          ? `Kapitel ${ch.chapter}: Nur ${dialogueCount} Dialogzeilen, mindestens ${minDialogueLines} erwartet`
          : `Chapter ${ch.chapter}: Only ${dialogueCount} dialogue lines, min ${minDialogueLines}`,
        severity: "WARNING",
      });
    }

    if (sentenceCount >= 8 && dialogueRatio < criticalDialogueRatio) {
      // Critical subsumes LOW — only emit one issue per chapter to avoid double-counting
      issues.push({
        gate: "DIALOGUE_QUOTE",
        chapter: ch.chapter,
        code: "DIALOGUE_RATIO_CRITICAL",
        message: isDE
          ? `Kapitel ${ch.chapter}: Dialoganteil kritisch niedrig (${Math.round(dialogueRatio * 100)}%, mindestens ${Math.round(criticalDialogueRatio * 100)}% noetig)`
          : `Chapter ${ch.chapter}: critically low dialogue ratio (${Math.round(dialogueRatio * 100)}%, need at least ${Math.round(criticalDialogueRatio * 100)}%)`,
        severity: "ERROR",
      });
    } else if (sentenceCount >= 8 && dialogueRatio < minDialogueRatio) {
      issues.push({
        gate: "DIALOGUE_QUOTE",
        chapter: ch.chapter,
        code: "DIALOGUE_RATIO_LOW",
        message: isDE
          ? `Kapitel ${ch.chapter}: Dialoganteil zu niedrig (${Math.round(dialogueRatio * 100)}%, Ziel mindestens ${Math.round(minDialogueRatio * 100)}%)`
          : `Chapter ${ch.chapter}: dialogue ratio too low (${Math.round(dialogueRatio * 100)}%, target at least ${Math.round(minDialogueRatio * 100)}%)`,
        severity: "WARNING",
      });
    }

    if (sentenceCount >= 8 && dialogueRatio > maxDialogueRatio) {
      issues.push({
        gate: "DIALOGUE_QUOTE",
        chapter: ch.chapter,
        code: "DIALOGUE_RATIO_HIGH",
        message: isDE
          ? `Kapitel ${ch.chapter}: Dialoganteil zu hoch (${Math.round(dialogueRatio * 100)}%, max ${Math.round(maxDialogueRatio * 100)}%)`
          : `Chapter ${ch.chapter}: dialogue ratio too high (${Math.round(dialogueRatio * 100)}%, max ${Math.round(maxDialogueRatio * 100)}%)`,
        severity: "WARNING",
      });
    }

    if (sentenceCount >= 8 && dialogueRatio > extremeHighDialogueRatio) {
      issues.push({
        gate: "DIALOGUE_QUOTE",
        chapter: ch.chapter,
        code: "DIALOGUE_RATIO_EXTREME",
        message: isDE
          ? `Kapitel ${ch.chapter}: Dialoganteil extrem hoch (${Math.round(dialogueRatio * 100)}%, max ${Math.round(extremeHighDialogueRatio * 100)}%)`
          : `Chapter ${ch.chapter}: dialogue ratio extremely high (${Math.round(dialogueRatio * 100)}%, max ${Math.round(extremeHighDialogueRatio * 100)}%)`,
        severity: "WARNING",
      });
    }
  }

  // Aggregate check: if 3+ chapters have low dialogue, escalate to ERROR
  const lowDialogueChapters = issues.filter(i => i.code === "DIALOGUE_RATIO_LOW" || i.code === "DIALOGUE_RATIO_CRITICAL").length;
  const aggregateLowDialogueThreshold = ageMax <= 8 ? 4 : 3;
  if (lowDialogueChapters >= aggregateLowDialogueThreshold) {
    issues.push({
      gate: "DIALOGUE_QUOTE",
      chapter: 0,
      code: "DIALOGUE_RATIO_PERSISTENTLY_LOW",
      message: isDE
        ? `${lowDialogueChapters} von ${draft.chapters.length} Kapiteln haben zu wenig Dialog. Die Geschichte braucht insgesamt mehr Gespraeche.`
        : `${lowDialogueChapters} of ${draft.chapters.length} chapters have low dialogue. The story needs more conversations overall.`,
      severity: "ERROR",
    });
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
    const coreNames = new Set(getCoreChapterCharacterNames({ directive, cast, ageMax: 8 }));

    for (const slot of characterSlots) {
      const name = findCharacterName(cast, slot);
      const sheet = cast.avatars.find(a => a.slotKey === slot) || cast.poolCharacters.find(c => c.slotKey === slot);
      if (!name || !sheet) continue;

      // Check full name first, then individual name parts (e.g. "Mia" from "Mia Neugier")
      const nameLower = name.toLowerCase();
      const nameParts = nameLower.split(/\s+/).filter(p => p.length > 2);
      const found = textLower.includes(nameLower) || nameParts.some(p => textLower.includes(p));
      const isAvatarSlot = slot.includes("AVATAR") || slot.includes("PROTAGONIST");
      const isCoreCharacter = coreNames.has(name);
      const isChildFocus = isLikelyChildCharacter(sheet);
      const shouldHardRequire = isCoreCharacter || isChildFocus;

      if (!found) {
        issues.push({
          gate: shouldHardRequire ? "CHARACTER_INTEGRATION" : "ACTIVE_PRESENCE",
          chapter: ch.chapter,
          code: "MISSING_CHARACTER",
          message: isDE ? `Figur fehlt: ${name}` : `Missing character: ${name}`,
          severity: shouldHardRequire ? "ERROR" : "WARNING",
        });
        continue;
      }

      // Check action/dialogue using any matching name form (full name or individual parts)
      const nameVariants = [name, ...nameParts.map(part => part.charAt(0).toUpperCase() + part.slice(1))];
      const hasAction = nameVariants.some(variant => checkCharacterHasAction(ch.text, variant));
      const hasDialogue = nameVariants.some(variant => hasAttributedDialogueForCharacter(ch.text, variant, language));
      // Only chapter-core / child-focus characters are hard-required.
      // Brief support mentions are acceptable and shouldn't trigger heavy rewrites.
      if (
        !hasAction
        && !hasDialogue
        && !nameVariants.some(variant => checkCharacterHasAction(ch.text, variant) || hasAttributedDialogueForCharacter(ch.text, variant, language))
      ) {
        issues.push({
          gate: shouldHardRequire ? "CHARACTER_INTEGRATION" : "ACTIVE_PRESENCE",
          chapter: ch.chapter,
          code: "PASSIVE_CHARACTER",
          message: isDE
            ? `${name} ${shouldHardRequire ? "ist nur erwaehnt, hat aber keine aktive Handlung" : `in Kapitel ${ch.chapter}: keine aktive Handlung und kein Dialog`}`
            : `${name} ${shouldHardRequire ? "is only mentioned, no active action" : `in chapter ${ch.chapter}: no active action or dialogue`}`,
          severity: shouldHardRequire ? "ERROR" : "WARNING",
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

  // German pronouns, adverbs, adjectives, common verbs — NEVER character names
  const germanNonNames = new Set([
    // pronouns & determiners
    "sie", "ich", "wir", "ihr", "ihm", "ihn", "mir", "dir", "uns",
    "sich", "selbst", "alle", "alles", "andere", "einige",
    "jemand", "niemand", "etwas", "nichts", "manches", "jeder", "jede",
    "dieser", "diese", "dieses", "welcher", "welche", "solche",
    // adverbs (time, place, manner, sentence starters)
    "dort", "hier", "jetzt", "dann", "noch", "schon", "auch", "aber",
    "doch", "ganz", "sehr", "viel", "mehr", "nur", "immer", "wieder",
    "heute", "gestern", "morgen", "oben", "unten", "vorne", "hinten",
    "außerdem", "allerdings", "trotzdem", "deshalb", "darum", "dennoch",
    // interrogative adverbs (capitalized at sentence start)
    "wohin", "warum", "woher", "wieso", "weshalb", "wann", "wozu",
    "wobei", "dahin", "daher", "dorthin",
    "natürlich", "vielleicht", "wahrscheinlich", "tatsächlich",
    "gemeinsam", "zusammen", "langsam", "schnell", "leise", "laut",
    "plötzlich", "sofort", "gleich", "endlich", "schließlich", "zunächst",
    "zuerst", "danach", "daraufhin", "inzwischen", "mittlerweile",
    "offenbar", "anscheinend", "vermutlich", "hoffentlich", "bestimmt",
    "eigentlich", "überhaupt", "jedenfalls", "irgendwie", "irgendwo",
    "bereits", "beinahe", "fast", "kaum", "ziemlich",
    "draußen", "drinnen", "drüben", "links", "rechts", "geradeaus",
    "nachts", "tagsüber", "manchmal", "niemals", "stets", "soeben",
    "vorsichtig", "behutsam", "sorgfältig", "hastig", "eilig",
    "aufgeregt", "erschrocken", "erstaunt", "erleichtert", "entschlossen",
    // common adjectives at sentence start
    "klein", "groß", "alt", "neu", "jung", "kurz", "lang",
    "warm", "kalt", "heiß", "dunkel", "hell", "still", "ruhig",
    // common verbs at sentence start (conjugated forms)
    "kann", "konnte", "muss", "musste", "soll", "sollte", "will", "wollte",
    "darf", "durfte", "wird", "wurde", "hat", "hatte", "ist", "war",
    "geht", "ging", "kommt", "kam", "steht", "stand", "liegt", "lag",
    "sitzt", "saß", "gibt", "gab", "macht", "machte", "nimmt", "nahm",
    "hält", "hielt", "lässt", "ließ", "bleibt", "blieb", "trägt", "trug",
    "fällt", "fiel", "schläft", "schlief", "ruft", "rief", "läuft", "lief",
    "zieht", "zog", "sagt", "sagte", "fragt", "fragte", "meint", "meinte",
    "weiß", "wusste", "kennt", "kannte", "sieht", "sah", "hört", "hörte",
    "denkt", "dachte", "glaubt", "glaubte", "spürt", "spürte",
    "scheint", "schien", "klingt", "klang", "riecht", "roch",
    "beginnt", "begann", "endet", "endete", "öffnet", "schloss",
    // imperative verb forms (capitalized at sentence start)
    "sag", "denk", "schau", "komm", "geh", "lauf", "nimm", "gib",
    "hilf", "ruf", "hör", "sieh", "pass", "warte", "bleib", "mach",
    "lass", "zeig", "stell", "leg", "setz", "zieh", "dreh", "spring",
    "fang", "wirf", "lies", "iss", "trink", "flieg", "schwimm",
    "sei", "seht", "seid", "wart",
    // past participles at sentence start
    "erschöpft", "überrascht", "verwundert", "begeistert",
    "verwirrt", "erfreut", "beruhigt", "gespannt", "erstarrt",
    // relative / connective
    "dessen", "deren", "denen", "jedoch", "hingegen", "obwohl", "sobald",
    "nachdem", "bevor", "während", "damit", "sodass", "weshalb",
    // interjections
    "mist", "mensch", "herrje", "donnerwetter", "hoppla",
  ]);

  // Multi-word patterns that are NEVER character names (possessive + noun, article + noun, etc.)
  const germanNonNamePatterns = language === "de" ? [
    // Possessive pronoun + Noun: "Seine Stimme", "Ihre Hände", "Sein Puls"
    /^(?:sein|seine|seinen|seinem|seiner|ihr|ihre|ihren|ihrem|ihrer|mein|meine|meinen|meinem|meiner|unser|unsere|unseren|unserem|unserer|euer|eure|euren|eurem|eurer)\s+/i,
    // Article + Noun: "Der Basar", "Die Kinder", "Das Amulett", "Ein Tor"
    /^(?:der|die|das|den|dem|des|ein|eine|einen|einem|einer|eines|kein|keine|keinen|keinem|keiner)\s+/i,
    // Demonstrative + Noun: "Diese Vorstellung", "Jeder Herzschlag"
    /^(?:dies|diese|dieser|dieses|diesen|diesem|jeder|jede|jedes|jeden|jedem|jener|jene|jenes|jenen|jenem|welch|welche|welcher|welches|welchen|welchem|solch|solche|solcher|solches|manch|manche|mancher|manches)\s+/i,
    // Quantifier + Noun: "Zehn Grad", "Drei Kinder", "Minuten Zeitverschwendung"
    /^(?:ein|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf|hundert|tausend|viele|wenige|einige|mehrere|alle|beide|halb|ganz|minuten?|stunden?|tage?)\s+/i,
    // Genitive possessive: "Omas Küche", "Vaters Stuhl", "Brunos Laden"
    /^\w+s\s+(?:küche|haus|zimmer|laden|werkstatt|garten|stimme|hand|hände|kopf|nase|augen|finger|tasche|schulter|stube|tür|keller|dach|auto|magen|schal|lieblingsschal|bilder?|jacke|ärmel|aermel|schuh|schuhe|knie|bein|beine|stirn|rücken|ruecken)$/i,
  ] : [];

  for (const ch of draft.chapters) {
    const matches = ch.text.matchAll(properNameRegex);
    for (const match of matches) {
      const matchIndex = typeof match.index === "number" ? match.index : 0;
      const name = match[1].toLowerCase();
      if (isCommonWord(name, language)) continue;
      if (allowedNames.has(name)) continue;
      const parts = name.split(/\s+/);
      if (parts.some(p => allowedNames.has(p))) continue;
      if (language === "de" && germanNonNames.has(name)) continue;
      // German adjectives/adverbs ending in these suffixes are NEVER character names
      if (language === "de" && /(?:lich|ig|isch|sam|bar|haft|los|voll|weise|wärts)$/.test(name)) continue;
      // Multi-word German non-name patterns (possessives, articles, quantifiers + noun)
      if (language === "de" && germanNonNamePatterns.some(p => p.test(match[1]))) continue;
      if (language === "de" && isLikelyQuotedSpeechPhrase(ch.text, match[1], matchIndex)) continue;
      if (language === "de" && isLikelyGermanSignPhrase(ch.text, match[1], matchIndex)) continue;
      // Single German common nouns: check if ALL words in the match are common nouns
      if (language === "de" && parts.length >= 2 && parts.every(p => isCommonWord(p, language) || germanNonNames.has(p))) continue;
      if (language === "de" && isLikelyGermanGenitiveNounPhrase(parts)) continue;
      if (language === "de" && parts.length >= 2 && isLikelyGermanDescriptivePhrase(match[1])) continue;
      if (language === "de" && isGermanCommonNounContext(ch.text, matchIndex)) continue;
      if (language === "de" && parts.length === 1 && !isLikelyGermanNameCandidate(ch.text, match[1], matchIndex)) continue;
      if (!shouldFlagUnlockedName(ch.text, match[1], matchIndex, language)) continue;

      const isActor = isLikelyCharacterAction(ch.text, match[1], matchIndex);
      issues.push({
        gate: "CAST_LOCK",
        chapter: ch.chapter,
        code: isActor ? "UNLOCKED_CHARACTER_ACTOR" : "UNLOCKED_CHARACTER",
        message: isDE
          ? `Neuer Eigenname "${match[1]}" nicht in der erlaubten Figurenliste`
          : `New proper name "${match[1]}" not in allowed character list`,
        severity: isActor ? "ERROR" : "WARNING",
      });
    }
  }

  return issues;
}

// ─── Gate 6: Repetition Limiter ─────────────────────────────────────────────────
function gateRepetitionLimiter(
  draft: StoryDraft,
  language: string,
  ageRange?: { min: number; max: number },
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";
  const ageMax = ageRange?.max ?? 12;

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

  const bannedWordPatterns = isDE
    ? [
      { token: "plötzlich", regex: /\bpl(?:ö|oe|o)tzlich\b/gi, maxPerChapter: 0, hard: true },
      { token: "irgendwie", regex: /\birgendwie\b/gi, maxPerChapter: 0, hard: false },
      { token: "ein bisschen", regex: /\bein\s+bisschen\b/gi, maxPerChapter: 1, hard: false },
      { token: "ziemlich", regex: /\bziemlich\b/gi, maxPerChapter: 1, hard: false },
      { token: "wirklich", regex: /\bwirklich\b/gi, maxPerChapter: 2, hard: false },
      { token: "sehr", regex: /\bsehr\b/gi, maxPerChapter: 2, hard: false },
      { token: "Es war einmal", regex: /\bes\s+war\s+einmal\b/gi, maxPerChapter: 0, hard: true },
    ]
    : [
      { token: "suddenly", regex: /\bsuddenly\b/gi, maxPerChapter: 0, hard: false },
      { token: "really", regex: /\breally\b/gi, maxPerChapter: 2, hard: false },
    ];

  for (const ch of draft.chapters) {
    for (const banned of bannedWordPatterns) {
      banned.regex.lastIndex = 0;
      const count = (ch.text.match(banned.regex) ?? []).length;
      if (count <= banned.maxPerChapter) continue;
      const overflow = count - banned.maxPerChapter;
      const severeOverflow = overflow >= 2;
      issues.push({
        gate: "REPETITION_LIMITER",
        chapter: ch.chapter,
        code: "BANNED_WORD_USED",
        message: isDE
          ? `Kapitel ${ch.chapter}: verbotenes Fuellwort "${banned.token}" ${count}x verwendet`
          : `Chapter ${ch.chapter}: banned filler "${banned.token}" used ${count}x`,
        severity: (banned.hard && ageMax <= 10) || (ageMax <= 8 && severeOverflow) ? "ERROR" : "WARNING",
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

// Gate 7.5: Template Phrase Ban
function gateTemplatePhrases(draft: StoryDraft, language: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";

  for (const ch of draft.chapters) {
    const matches = findTemplatePhraseMatches(ch.text, language);
    if (matches.length === 0) continue;
    const labels = matches.map(m => m.label).join(", ");
    issues.push({
      gate: "TEMPLATE_PHRASES",
      chapter: ch.chapter,
      code: "TEMPLATE_PHRASE",
      message: isDE
        ? `Template-Phrasen gefunden: ${labels}`
        : `Template phrases detected: ${labels}`,
      severity: "ERROR",
    });
  }

  return issues;
}

// ─── Gate 7: Imagery Balance ────────────────────────────────────────────────────
function gateReadabilityComplexity(
  draft: StoryDraft,
  language: string,
  ageRange?: { min: number; max: number },
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";
  if (!ageRange) return issues;

  const ageMax = ageRange.max;
  const longSentenceThreshold = ageMax <= 5 ? 13 : ageMax <= 8 ? 20 : 26;
  const maxAvgSentenceWords = ageMax <= 5 ? 10 : ageMax <= 8 ? 14 : 19;
  const maxLongSentenceRatio = ageMax <= 5 ? 0.1 : ageMax <= 8 ? 0.22 : 0.28;

  for (const ch of draft.chapters) {
    const sentences = splitSentences(ch.text);
    if (sentences.length === 0) continue;

    const sentenceWordCounts = sentences.map(s => countWords(s)).filter(n => n > 0);
    if (sentenceWordCounts.length === 0) continue;

    const totalSentenceWords = sentenceWordCounts.reduce((a, b) => a + b, 0);
    const avgSentenceWords = totalSentenceWords / sentenceWordCounts.length;
    const longSentenceCount = sentenceWordCounts.filter(n => n > longSentenceThreshold).length;
    const longSentenceRatio = longSentenceCount / sentenceWordCounts.length;
    const veryLongSentenceThreshold = longSentenceThreshold + (ageMax <= 8 ? 10 : 8);
    const hasVeryLongSentence = sentenceWordCounts.some(n => n >= veryLongSentenceThreshold);

    if (avgSentenceWords > maxAvgSentenceWords) {
      issues.push({
        gate: "READABILITY_COMPLEXITY",
        chapter: ch.chapter,
        code: "SENTENCE_COMPLEXITY_HIGH",
        message: isDE
          ? `Kapitel ${ch.chapter}: Satzlaenge zu hoch (${avgSentenceWords.toFixed(1)} Woerter im Schnitt, max ${maxAvgSentenceWords})`
          : `Chapter ${ch.chapter}: sentence complexity too high (${avgSentenceWords.toFixed(1)} words avg, max ${maxAvgSentenceWords})`,
        severity: "WARNING",
      });
    }

    if (longSentenceRatio > maxLongSentenceRatio) {
      issues.push({
        gate: "READABILITY_COMPLEXITY",
        chapter: ch.chapter,
        code: "LONG_SENTENCE_OVERUSE",
        message: isDE
          ? `Kapitel ${ch.chapter}: zu viele lange Saetze (${Math.round(longSentenceRatio * 100)}%, max ${Math.round(maxLongSentenceRatio * 100)}%)`
          : `Chapter ${ch.chapter}: too many long sentences (${Math.round(longSentenceRatio * 100)}%, max ${Math.round(maxLongSentenceRatio * 100)}%)`,
        severity: "WARNING",
      });
    }

    if (hasVeryLongSentence) {
      issues.push({
        gate: "READABILITY_COMPLEXITY",
        chapter: ch.chapter,
        code: "VERY_LONG_SENTENCE",
        message: isDE
          ? `Kapitel ${ch.chapter}: mindestens ein sehr langer Satz erkannt`
          : `Chapter ${ch.chapter}: at least one very long sentence detected`,
        severity: "WARNING",
      });
    }
  }

  return issues;
}

function gateCharacterVoiceDistinctness(
  draft: StoryDraft,
  directives: SceneDirective[],
  cast: CastSet,
  language: string,
  ageRange?: { min: number; max: number },
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";
  const ageMax = ageRange?.max ?? 12;

  for (const directive of directives) {
    const chapter = draft.chapters.find(ch => ch.chapter === directive.chapter);
    if (!chapter) continue;

    const characterNames = directive.charactersOnStage
      .filter(slot => !slot.includes("ARTIFACT"))
      .map(slot => findCharacterName(cast, slot))
      .filter((name): name is string => Boolean(name));

    if (characterNames.length < 2) continue;

    const speakingCharacters = characterNames.filter(name => {
      // Check full name first, then individual name parts (e.g. "Mia" from "Mia Neugier")
      if (hasAttributedDialogueForCharacter(chapter.text, name, language)) return true;
      const parts = name.split(/\s+/).filter(p => p.length > 2);
      return parts.some(part => hasAttributedDialogueForCharacter(chapter.text, part, language));
    });

    if (speakingCharacters.length < 2) {
      issues.push({
        gate: "CHARACTER_VOICE",
        chapter: chapter.chapter,
        code: "VOICE_INDISTINCT",
        message: isDE
          ? `Kapitel ${chapter.chapter}: zu wenig klar unterscheidbare Sprecher (${speakingCharacters.length}/${characterNames.length})`
          : `Chapter ${chapter.chapter}: not enough clearly distinct speakers (${speakingCharacters.length}/${characterNames.length})`,
        severity: "WARNING",
      });
    }

    const roleLabelThreshold = ageMax <= 8 ? 2 : 4;
    const roleLabelCount = countRoleLabelNamePairs(chapter.text);
    if (roleLabelCount > roleLabelThreshold) {
      issues.push({
        gate: "CHARACTER_VOICE",
        chapter: chapter.chapter,
        code: "ROLE_LABEL_OVERUSE",
        message: isDE
          ? `Kapitel ${chapter.chapter}: Rollenbezeichnungen mit Namen zu oft wiederholt (${roleLabelCount}x, max ${roleLabelThreshold})`
          : `Chapter ${chapter.chapter}: role labels repeated with names too often (${roleLabelCount}x, max ${roleLabelThreshold})`,
        severity: "WARNING",
      });
    }

    // Detect repeated "voice tag formulas" like "sagte ... kurz/knapp/leise"
    // that flatten speaker identity across characters.
    const voiceTagFormulaPattern = isDE
      ? /(?:sagte|fragte|antwortete|meinte|fluesterte|fl[uü]sterte|murmelte)[^.!?\n]{0,28}\b(?:kurz|knapp|leise|ruhig|klar|fest|sachlich)\b/gi
      : /(?:said|asked|answered|replied|whispered|muttered)[^.!?\n]{0,28}\b(?:short|brief|quiet|calm|firm)\b/gi;
    const voiceLabelSentencePattern = isDE
      ? /\b(?:seine|seiner|seinem|seinen|ihre|ihrer|ihrem|ihren|die)\s+stimme\s+war\s+(?:kurz|knapp|leise|ruhig|klar|fest|sachlich)\b/gi
      : /\b(?:his|her|their|the)\s+voice\s+was\s+(?:short|brief|quiet|calm|firm)\b/gi;

    const formulaHits =
      (chapter.text.match(voiceTagFormulaPattern)?.length ?? 0) +
      (chapter.text.match(voiceLabelSentencePattern)?.length ?? 0);

    const maxFormulaHits = ageMax <= 8 ? 2 : 3;
    if (formulaHits > maxFormulaHits) {
      issues.push({
        gate: "CHARACTER_VOICE",
        chapter: chapter.chapter,
        code: "VOICE_TAG_FORMULA_OVERUSE",
        message: isDE
          ? `Kapitel ${chapter.chapter}: zu viele wiederholte Sprach-Formeln fuer Sprecher (${formulaHits}x, max ${maxFormulaHits}).`
          : `Chapter ${chapter.chapter}: too many repeated speaker-tag formulas (${formulaHits}, max ${maxFormulaHits}).`,
        severity: "WARNING",
      });
    }
  }

  return issues;
}

function gateImageryBalance(
  draft: StoryDraft,
  language: string,
  ageRange?: { min: number; max: number },
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";
  const ageMax = ageRange?.max ?? 12;
  const chapterMaxComparisons = ageMax <= 8 ? 3 : 4;
  const paragraphMaxComparisons = ageMax <= 8 ? 1 : 2;

  const metaphorPatterns = isDE
    ? [/wie\s+(?:ein|eine|der|die|das)\s+\w+/gi, /als\s+(?:ob|wäre|würde)/gi]
    : [/like\s+(?:a|an|the)\s+\w+/gi, /as\s+(?:if|though)/gi];

  for (const ch of draft.chapters) {
    let metaphorCount = 0;
    const paragraphs = ch.text
      .split(/\n\s*\n+/)
      .map(p => p.trim())
      .filter(Boolean);

    for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
      const paragraph = paragraphs[pIdx];
      let paragraphComparisons = 0;
      for (const pattern of metaphorPatterns) {
        pattern.lastIndex = 0;
        paragraphComparisons += paragraph.match(pattern)?.length ?? 0;
      }
      if (paragraphComparisons > paragraphMaxComparisons) {
        // Only ERROR if severely over limit (3+), otherwise WARNING to avoid excessive rewrite triggers
        const severeCluster = paragraphComparisons >= 3;
        issues.push({
          gate: "IMAGERY_BALANCE",
          chapter: ch.chapter,
          code: "COMPARISON_CLUSTER",
          message: isDE
            ? `Kapitel ${ch.chapter}: Absatz ${pIdx + 1} hat zu viele Vergleiche (${paragraphComparisons}, max ${paragraphMaxComparisons}).`
            : `Chapter ${ch.chapter}: paragraph ${pIdx + 1} has too many comparisons (${paragraphComparisons}, max ${paragraphMaxComparisons}).`,
          severity: severeCluster ? "ERROR" : "WARNING",
        });
      }
    }

    for (const pattern of metaphorPatterns) {
      pattern.lastIndex = 0;
      const matches = ch.text.match(pattern);
      metaphorCount += matches?.length ?? 0;
    }

    if (metaphorCount > chapterMaxComparisons) {
      issues.push({
        gate: "IMAGERY_BALANCE",
        chapter: ch.chapter,
        code: "METAPHOR_OVERLOAD",
        message: isDE
          ? `Kapitel ${ch.chapter}: ${metaphorCount} Metaphern/Vergleiche (max ${chapterMaxComparisons} pro Kapitel)`
          : `Chapter ${ch.chapter}: ${metaphorCount} metaphors/similes (max ${chapterMaxComparisons} per chapter)`,
        severity: "WARNING",
      });
    }
  }

  return issues;
}

function gatePoeticDensity(
  draft: StoryDraft,
  language: string,
  ageRange?: { min: number; max: number },
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";
  const ageMax = ageRange?.max ?? 12;

  const poeticPatterns = isDE
    ? [
      /\b(?:ruine|nacht|stille|zeit|schatten|licht|wald|haus)\s+atmete\b/gi,
      /\b(?:schuld|angst|stille|zeit)\s+lag\s+wie\b/gi,
      /\b(?:loch|schatten)\s+starrte\b/gi,
      /\bstimme\s+(?:fiel|schnitt)\b/gi,
      /\b(?:wald|nacht|ruine|stille)\s+hielt\s+den\s+atem\b/gi,
      /\b(?:moment|zeit|stille)\s+(?:war|wurde)\s+schwer\s+wie\b/gi,
      /\b(?:schuld|zweifel|angst)\s+wie\s+(?:ein|eine)\s+(?:jacke|kiesel|stein|last)\b/gi,
      /\bwie\s+(?:ein|eine|der|die|das)\s+(?:kiesel|garn|stahl|klinge|asche|gesetz)\b/gi,
      // Personifizierung von Natur/Objekten
      /\b(?:wasser|wind|wald|nacht|stille|sonne|mond|regen|bach|fluss|see)\s+(?:kicherte?|lachte|sang|fl[üu]sterte|rief|tanzte|seufzte|weinte|l[äa]chelte|nickte|summte|murmelte)\b/gi,
      // "klangen nervös/traurig" = Synästhesie
      /\b\w+(?:spiele?|glocken?|t[öo]ne?|stimmen?)\s+klangen?\s+(?:nerv[öo]s|traurig|fr[öo]hlich|m[üu]de|[äa]ngstlich|einsam|leise)\b/gi,
      // Meta-Narration
      /\b(?:die\s+)?(?:geschichte|szene|handlung|erz[äa]hlung)\s+(?:schlie[ßs]t|endet|schloss|endete|begann)\s+mit\b/gi,
      // Lehrsätze im Dialog
      /\b(?:wir\s+haben\s+gelernt|wir\s+haben\s+verstanden|das\s+bedeutet\s+dass|die\s+lektion|das\s+lehrt\s+uns)\b/gi,
      // Atmosphärische Füllung: "roch nach feuchtem/nassem..."
      /\broch\s+(?:es\s+)?nach\s+(?:feuchtem?|nassem?|altem?|s[üu][ßs]em?|frischem?)\s+\w+/gi,
      // "Der Wind trug..."
      /\b(?:der\s+)?wind\s+trug\b/gi,
    ]
    : [
      /\b(?:night|silence|time|shadow|light|house|forest)\s+breathed\b/gi,
      /\b(?:guilt|fear|silence|time)\s+lay\s+like\b/gi,
      /\b(?:hole|shadow)\s+stared\b/gi,
      /\bvoice\s+(?:fell|cut)\b/gi,
      /\b(?:forest|night|ruin|silence)\s+held\s+its\s+breath\b/gi,
      /\b(?:moment|time|silence)\s+(?:was|became)\s+heavy\s+as\b/gi,
      /\blike\s+(?:a|an|the)\s+(?:blade|steel|ash|law)\b/gi,
      // Personification of nature/objects
      /\b(?:water|wind|forest|night|silence|sun|moon|rain)\s+(?:giggled|laughed|sang|whispered|called|danced|sighed|wept|smiled|nodded|hummed)\b/gi,
      // Meta-narration
      /\b(?:the\s+)?(?:story|scene|narrative)\s+(?:closes|ends|ended|closed)\s+with\b/gi,
      // Teaching sentences in dialogue
      /\b(?:we\s+(?:have\s+)?learned|we\s+(?:have\s+)?understood|the\s+lesson|this\s+teaches\s+us)\b/gi,
    ];

  const maxPoeticHits = ageMax <= 8 ? 2 : 3;
  for (const ch of draft.chapters) {
    let hitCount = 0;
    for (const pattern of poeticPatterns) {
      pattern.lastIndex = 0;
      hitCount += ch.text.match(pattern)?.length ?? 0;
    }
    if (hitCount >= maxPoeticHits) {
      issues.push({
        gate: "POETIC_DENSITY",
        chapter: ch.chapter,
        code: "POETIC_LANGUAGE_OVERLOAD",
        message: isDE
          ? `Kapitel ${ch.chapter}: zu poetisch-dichte Formulierungen (${hitCount} Treffer, max ${maxPoeticHits - 1}). Fuer 6-8 klarer und konkreter schreiben.`
          : `Chapter ${ch.chapter}: poetic language is too dense (${hitCount} hits, max ${maxPoeticHits - 1}). Use clearer, more concrete language for ages 6-8.`,
        severity: "WARNING",
      });
    }
  }

  return issues;
}

function gateTellPatternOveruse(
  draft: StoryDraft,
  language: string,
  ageRange?: { min: number; max: number },
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";
  const ageMax = ageRange?.max ?? 12;
  const fullText = draft.chapters.map(ch => ch.text).join(" ");

  // 10/10 Quality: Strict ban on emotion labels ("Somatic Marker" Enforcement)
  const tellPatterns = isDE
    ? [
      /\b(?:er|sie|es|man)\s+sp(?:u|ue)rte\b/gi,
      /\b(?:er|sie|es|man)\s+f(?:ue|u)hlte\s+sich\b/gi,
      /\bwar\s+(?:traurig|gl(?:ue|u)cklich|w(?:ue|u)tend|froh|nerv(?:oe|o)s|fr(?:oe|o)hlich|begeistert|stolz|entt(?:ae|a)uscht)\b/gi,
      /\bwurde\s+(?:traurig|gl(?:ue|u)cklich|w(?:ue|u)tend|froh|nerv(?:oe|o)s)\b/gi,
      /\binnerlich\s+(?:zog|machte|wurde)\b/gi,
      /\bstille\s+fiel\b/gi,
      /\b(?:er|sie|es|man)\s+merkte\b/gi,
      /\bherz\s+(?:klopfte|pochte|haemmerte)\s+wild\b/gi, // Cliché
      /\b(?:traurig|w(?:ue|u)tend|nerv(?:oe|o)s|gl(?:ue|u)cklich)\s+(?:sagte|rief|fragte|antwortete)\b/gi, // Adverb tells
      /\bpl(?:oe|o)tzlich\b/gi, // Ban "suddenly"
      /\bauf\s+einmal\b/gi,
    ]
    : [
      /\b(?:he|she|it|they)\s+felt\b/gi,
      /\b(?:he|she|it|they)\s+was\s+(?:sad|happy|angry|glad|nervous|excited|proud|disappointed|scared)\b/gi,
      /\b(?:he|she|it|they)\s+became\s+(?:sad|happy|angry|nervous)\b/gi,
      /\binside\s+(?:him|her|them)\s+(?:something\s+)?(?:tightened|pressed|pulled)\b/gi,
      /\bsilence\s+fell\b/gi,
      /\b(?:he|she|it|they)\s+noticed\b/gi,
      /\bheart\s+(?:pounded|raced|thumped)\b/gi, // Cliché
      /\b(?:sadly|happily|angrily|nervously|excitedly)\s+(?:said|asked|shouted)\b/gi, // Adverb tells
      /\bsuddenly\b/gi, // Ban "suddenly"
      /\ball\s+of\s+a\s+sudden\b/gi,
    ];

  let repeatedTellHits = 0;
  let hitExamples: string[] = [];

  for (const pattern of tellPatterns) {
    pattern.lastIndex = 0;
    const matches = fullText.match(pattern);
    if (matches) {
      repeatedTellHits += matches.length;
      if (hitExamples.length < 3) hitExamples.push(matches[0]);
    }
  }

  // Stricter Threshold for "10/10" Quality (max 3 "tells" allowed in whole story)
  if (repeatedTellHits >= 3) {
    issues.push({
      gate: "TELL_PATTERN",
      chapter: 0,
      code: "TELL_PATTERN_OVERUSE",
      message: isDE
        ? `Zu viele "Tell"-Konstruktionen (${repeatedTellHits} Treffer: "${hitExamples.join('", "')}"). Zeige Gefuehle durch Koerpersprache (Somatic Markers) ("Schultern sackten ab" statt "war traurig").`
        : `Too many "Tell" constructions (${repeatedTellHits} hits: "${hitExamples.join('", "')}"). Show emotions via Somatic Markers ("shoulders stumped" instead of "was sad").`,
      severity: "ERROR", // Always ERROR to force Rewrite
    });
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
      severity: "WARNING",
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
function gateEndingPayoff(
  draft: StoryDraft,
  directives: SceneDirective[],
  language: string,
  ageRange?: { min: number; max: number },
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";
  const ageMax = ageRange?.max ?? 12;
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
      severity: "WARNING",
    });
  }

  const lastSentences = splitSentences(lastText);
  const lastSentence = lastSentences[lastSentences.length - 1] ?? "";

  const cliffhangerPatterns = isDE
    ? [
      /\?\s*$/,          // endet mit Frage
      /\.\.\.\s*$/,      // endet mit ...
      /doch dann\s*$/,
      /was w[uü]rde\s/,
      // Offene Spannungs-Sätze ohne Auflösung
      /war greifbar\.?\s*$/i,
      /lag im raum\.?\s*$/i,
      /blieb unklar\.?\s*$/i,
      /schien unm[öo]glich\.?\s*$/i,
      /\bein falscher schritt\b/i,
      /\bwürde ihren untergang\b/i,
      /\bwerdet ihr zu stein\b/i,
      /\bschatten wurden l[äa]nger\b/i,
    ]
    : [
      /\?\s*$/,
      /\.\.\.\s*$/,
      /but then\s*$/,
      /what would\s/,
      /\bwas palpable\.?\s*$/i,
      /\bone wrong move\b/i,
      /\btheir doom\b/i,
    ];

  for (const pattern of cliffhangerPatterns) {
    if (pattern.test(lastSentence.trim())) {
      issues.push({
        gate: "ENDING_PAYOFF",
        chapter: lastChapter.chapter,
        code: "CLIFFHANGER_ENDING",
        message: isDE
          ? `Letztes Kapitel endet mit Cliffhanger statt warmem Abschluss`
          : `Last chapter ends with cliffhanger instead of warm resolution`,
        severity: "WARNING",
      });
      break;
    }
  }

  const endingUnresolvedPatterns = isDE
    ? [
      /\bungewiss\b/i,
      /\bunbekannt\b/i,
      /\boffen\b/i,
      /\bam naechsten morgen\b/i,
      /\bam nächsten morgen\b/i,
      /\bneue[nr]?\s+r[aä]tsel\b/i,
      /\bbald\b/i,
    ]
    : [
      /\buncertain\b/i,
      /\bunknown\b/i,
      /\bopen\b/i,
      /\bnext morning\b/i,
      /\bnew puzzle\b/i,
      /\bsoon\b/i,
    ];

  const closingWindow = lastSentences.slice(Math.max(0, lastSentences.length - 3)).join(" ");
  if (endingUnresolvedPatterns.some(pattern => pattern.test(closingWindow))) {
    issues.push({
      gate: "ENDING_PAYOFF",
      chapter: lastChapter.chapter,
      code: "ENDING_UNRESOLVED",
      message: isDE
        ? "Letzter Abschnitt oeffnet neue Unsicherheit statt klaren warmen Abschluss."
        : "Final section opens new uncertainty instead of a clear warm closure.",
      severity: "WARNING",
    });
  }

  const warmClosurePatterns = isDE
    ? [/\bzu hause\b/i, /\bsicher\b/i, /\bgeschafft\b/i, /\bgeborgen\b/i, /\bfriedlich\b/i, /\bzusammen\b/i]
    : [/\bhome\b/i, /\bsafe\b/i, /\bwe did it\b/i, /\btogether\b/i, /\bpeaceful\b/i];

  if (!warmClosurePatterns.some(pattern => pattern.test(lastText))) {
    issues.push({
      gate: "ENDING_PAYOFF",
      chapter: lastChapter.chapter,
      code: "ENDING_WARMTH_MISSING",
      message: isDE
        ? "Im Schluss fehlt ein klarer warmer Anker (z. B. sicher/zu Hause/zusammen)."
        : "Ending lacks a clear warm anchor (e.g., safe/home/together).",
      severity: "WARNING",
    });
  }

  const openingIntentText = directives
    .slice(0, 2)
    .map(d => `${d.goal} ${d.conflict} ${d.outcome || ""}`)
    .join(" ");
  const goalKeywords = extractGoalKeywords(openingIntentText, language);
  if (goalKeywords.length > 0) {
    const finalNorm = ` ${normalizeForComparison(lastText)} `;
    const hasGoalEcho = goalKeywords.some(keyword => finalNorm.includes(` ${keyword} `));
    if (!hasGoalEcho) {
      issues.push({
        gate: "ENDING_PAYOFF",
        chapter: lastChapter.chapter,
        code: "GOAL_THREAD_WEAK_ENDING",
        message: isDE
          ? "Das Ende greift das Anfangsziel kaum wieder auf. Leitfaden wirkt abgerissen."
          : "Ending barely reconnects to the initial goal. Main thread feels dropped.",
        severity: "WARNING",
      });
    }
  }

  const payoffVerbPattern = isDE
    ? /\b(geschafft|gerettet|gefunden|geloest|repariert|befreit|erreicht|zurueckgebracht|sicher|gesichert|bewahrt|wiederhergestellt)\b/i
    : /\b(done|saved|found|solved|repaired|freed|reached|brought\s+back|safe)\b/i;
  const payoffConcreteNounPattern = isDE
    ? /\b(amulett|kugel|karte|kompass|schluessel|tor|weg|pfad|zuhause|dorf|freund|team|gruppe|schatz|ziel|erbe|m(?:u|ü)hle|feder|kiste|schloss)\b/i
    : /\b(artifact|orb|map|compass|key|gate|path|home|village|friend|team|group|treasure|goal)\b/i;
  const payoffWindow = lastSentences.slice(Math.max(0, lastSentences.length - 5)).join(" ");
  const hasConcretePayoff = payoffVerbPattern.test(payoffWindow) && payoffConcreteNounPattern.test(payoffWindow);
  if (!hasConcretePayoff) {
    issues.push({
      gate: "ENDING_PAYOFF",
      chapter: lastChapter.chapter,
      code: "ENDING_PAYOFF_ABSTRACT",
      message: isDE
        ? "Finale bleibt zu abstrakt. Zeige konkret, was gesichert/gewonnen wurde."
        : "Ending payoff is too abstract. Show concretely what was secured or won.",
      severity: "WARNING",
    });
  }

  const pricePattern = isDE
    ? /\b(aber|doch|kostete|preis|verzichtete|musste|mussten|gaben|gab|tauschte|erschoepft|mued[e]?|fehlte|riss|kaputt|flick|zerriss)\b/i
    : /\b(but|cost|price|gave\s+up|had\s+to|sacrificed|traded|tired)\b/i;
  if (!pricePattern.test(payoffWindow)) {
    issues.push({
      gate: "ENDING_PAYOFF",
      chapter: lastChapter.chapter,
      code: "ENDING_PRICE_MISSING",
      message: isDE
        ? "Finale ohne spuerbaren Preis/Kompromiss. Fuege eine kleine, konkrete Folgekosten-Zeile hinzu."
        : "Ending has no tangible price/tradeoff. Add a small concrete cost line.",
      severity: "WARNING",
    });
  }

  return issues;
}

// ─── Gate: Instruction Leak ─────────────────────────────────────────────────────
function gateTextArtifacts(
  draft: StoryDraft,
  language: string,
  ageRange?: { min: number; max: number },
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";
  const ageMax = ageRange?.max ?? 12;

  const controlCharPattern = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;
  const mojibakePattern = /(?:\u00C3[\u0080-\u00BF]|\u00C2[\u0080-\u00BF]|\u00E2[\u0080-\u00BF]{2}|\uFFFD)/;
  const spacedTokenPattern = /\b(?:[A-Za-z]\s+){4,}[A-Za-z]\b/;
  const asciiUmlautPattern = /\b(?:fuer|uber|ueber|zurueck|waehrend|wuerde|wuerden|waere|waeren|koennen|koennte|koennten|moeglich|moeglichkeit|schluessel|gefuehl|gefuehle|fuehlt|fuehlte|spuert|spuerte|hoeren|hoert|gehoert|gehoeren|schoen|groesser|groesste|loesung|loesen)\b/gi;

  for (const chapter of draft.chapters) {
    const text = chapter.text || "";

    if (controlCharPattern.test(text)) {
      issues.push({
        gate: "TEXT_ARTIFACTS",
        chapter: chapter.chapter,
        code: "TEXT_CONTROL_CHARS",
        message: isDE
          ? `Kapitel ${chapter.chapter}: unsichtbare Steuerzeichen im Text gefunden.`
          : `Chapter ${chapter.chapter}: invisible control characters detected in text.`,
        severity: "ERROR",
      });
    }

    if (mojibakePattern.test(text)) {
      issues.push({
        gate: "TEXT_ARTIFACTS",
        chapter: chapter.chapter,
        code: "TEXT_MOJIBAKE",
        message: isDE
          ? `Kapitel ${chapter.chapter}: fehlerhafte Zeichenkodierung (Mojibake) erkannt.`
          : `Chapter ${chapter.chapter}: broken character encoding (mojibake) detected.`,
        severity: ageMax <= 8 ? "ERROR" : "WARNING",
      });
    }

    if (spacedTokenPattern.test(text)) {
      issues.push({
        gate: "TEXT_ARTIFACTS",
        chapter: chapter.chapter,
        code: "TEXT_SPACED_TOKEN",
        message: isDE
          ? `Kapitel ${chapter.chapter}: auseinandergezogene Woerter erkannt (z. B. "T e l e p o r t").`
          : `Chapter ${chapter.chapter}: spaced-out broken token detected (e.g. "T e l e p o r t").`,
        severity: ageMax <= 8 ? "ERROR" : "WARNING",
      });
    }

    const asciiUmlautHits = text.match(asciiUmlautPattern)?.length ?? 0;
    if (asciiUmlautHits >= 3) {
      issues.push({
        gate: "TEXT_ARTIFACTS",
        chapter: chapter.chapter,
        code: "TEXT_ASCII_UMLAUT",
        message: isDE
          ? `Kapitel ${chapter.chapter}: zu viele ASCII-Umschriften statt Umlaute (${asciiUmlautHits} Treffer).`
          : `Chapter ${chapter.chapter}: too many ASCII substitutions instead of umlauts (${asciiUmlautHits} hits).`,
        severity: ageMax <= 8 ? "ERROR" : "WARNING",
      });
    }
  }

  return issues;
}

function gateInstructionLeak(draft: StoryDraft, language: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";

  const forbiddenSnippets = [
    "tie the scene", "without breaking canon", "canon anchor line",
    "kanonischer hinweis", "canon hint", "walking the same path in chapter",
    "have always been part of this tale", "scene directive", "return json",
    "final chapter:", "strict rules", "stricte regeln", "szenen-vorgabe",
    "erlaubte namen", "gib json", "kapiteltext",
    "sichtbare aktion:", "sichtbare handlung:", "aktion fortgesetzt:",
    "visible action:", "action continued:",
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

    // Check for meta-narration sentence starters (structural beat labels as prose)
    const metaNarrationPatterns = isDE
      ? [/\b(?:Ihr|Das|Ein)\s+(?:Ziel|Hindernis)\s+war\b/i, /\bMini-Problem:/i]
      : [/\b(?:Her|The|An)\s+(?:goal|obstacle)\s+was\b/i, /\bMini-problem:/i];
    for (const pattern of metaNarrationPatterns) {
      if (pattern.test(ch.text)) {
        issues.push({
          gate: "INSTRUCTION_LEAK",
          chapter: ch.chapter,
          code: "META_NARRATION",
          message: isDE
            ? `Meta-Erzählung in Kapitel ${ch.chapter}: Strukturelle Labels als Prosa`
            : `Meta-narration in chapter ${ch.chapter}: structural labels as prose`,
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

    const filteredPlaceholderPatterns = isDE
      ? [/\[[^\]]*gefiltert[^\]]*\]/i, /\binhalt[-\s]?gefiltert\b/i, /\[redacted\]/i]
      : [/\[[^\]]*filtered[^\]]*\]/i, /\bcontent[-\s]?filtered\b/i, /\[redacted\]/i];
    if (filteredPlaceholderPatterns.some(pattern => pattern.test(ch.text))) {
      issues.push({
        gate: "INSTRUCTION_LEAK",
        chapter: ch.chapter,
        code: "FILTER_PLACEHOLDER",
        message: isDE
          ? `Kapitel ${ch.chapter}: Filter-/Redaktionsplatzhalter im Fliesstext gefunden`
          : `Chapter ${ch.chapter}: filter/redaction placeholder found in narrative text`,
        severity: "ERROR",
      });
    }

    const draftNoteLeakPattern = /(?:\(|\[)[^)\]]*\b(?:lachmoment|humormoment|meta|regie|anmerkung|notiz|draft|placeholder|todo|stage\s*direction|insert)\b[^)\]]*(?:\)|\])/i;
    if (draftNoteLeakPattern.test(ch.text)) {
      issues.push({
        gate: "INSTRUCTION_LEAK",
        chapter: ch.chapter,
        code: "DRAFT_NOTE_LEAK",
        message: isDE
          ? `Kapitel ${ch.chapter}: redaktionelle Notiz/Meta-Klammer im Fliesstext erkannt.`
          : `Chapter ${ch.chapter}: editorial note/meta marker leaked into narrative text.`,
        severity: "ERROR",
      });
    }

    const metaLabelPhrasePattern = isDE
      ? /\b(?:Der|Die|Das)?\s*(?:Ausblick|Hook|Epilog)\s*[:\u2212\u2013\u2014-]\s*/i
      : /\b(?:The)?\s*(?:Outlook|Hook|Epilogue)\s*[:\u2212\u2013\u2014-]\s*/i;
    if (metaLabelPhrasePattern.test(ch.text)) {
      issues.push({
        gate: "INSTRUCTION_LEAK",
        chapter: ch.chapter,
        code: "META_LABEL_PHRASE",
        message: isDE
          ? `Kapitel ${ch.chapter}: Meta-Label im Fliesstext erkannt (z. B. "Der Ausblick:")`
          : `Chapter ${ch.chapter}: meta label leaked into narrative text (e.g. "The Outlook:")`,
        severity: "WARNING",
      });
    }
  }

  return issues;
}

// ─── Gate 12: Canon Fusion Check ────────────────────────────────────────────────
function gateMetaForeshadowPhrases(
  draft: StoryDraft,
  language: string,
  _ageRange?: { min: number; max: number },
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";

  const patterns = isDE
    ? [
      /\bbald\s+w(?:u|ue|ü)rden?\s+(?:sie|er|es)\s+(?:wissen|erfahren|sehen|verstehen|merken|begreifen)\b/i,
      /\bein\s+(?:leiser\s+)?ausblick\s+blieb\b/i,
      /\b(?:der|ein)\s+ausblick\s+blieb\b/i,
      /\bnoch\s+wussten\s+sie\s+nicht\b/i,
    ]
    : [
      /\bsoon\s+(?:they|he|she)\s+would\s+(?:know|learn|see|understand|realize)\b/i,
      /\ba\s+quiet\s+outlook\s+remained\b/i,
      /\ban?\s+outlook\s+remained\b/i,
      /\bthey\s+did\s+not\s+yet\s+know\b/i,
    ];

  for (const chapter of draft.chapters) {
    if (!patterns.some(pattern => pattern.test(chapter.text))) continue;
    issues.push({
      gate: "META_FORESHADOW",
      chapter: chapter.chapter,
      code: "META_FORESHADOW_PHRASE",
      message: isDE
        ? `Kapitel ${chapter.chapter}: Meta-Ausblick statt immersiver Szeneformulierung erkannt.`
        : `Chapter ${chapter.chapter}: meta foreshadow phrasing detected instead of immersive scene prose.`,
      severity: "WARNING",
    });
  }

  return issues;
}

function gateRuleExpositionTell(
  draft: StoryDraft,
  language: string,
  ageRange?: { min: number; max: number },
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";
  const ageMax = ageRange?.max ?? 12;

  const sentencePatterns = isDE
    ? [
      /\bzeigt\s+m(?:oe|ö)gliche[nr]?\s+\w+/i,
      /\bbedeutet\s*,?\s*dass\b/i,
      /\b(?:regel|gesetz)\s+(?:lautet|ist)\b/i,
      /\bfunktioniert\s+so\b/i,
      /^(?:das|der|die)\s+[a-zäöüß\-]{3,}\s+(?:zeigt|bedeutet|kann|funktioniert)\b[^.!?]{0,80}\b(?:dass|wenn|immer|nur|m(?:oe|ö)glich|regel|hei(?:ss|ß)t)\b/i,
    ]
    : [
      /\bshows?\s+possible\s+\w+/i,
      /\bmeans?\s+that\b/i,
      /\bthe\s+rule\s+is\b/i,
      /\bworks?\s+like\s+this\b/i,
      /^(?:the|this)\s+[a-z\-]{3,}\s+(?:shows?|means?|can|works?)\b[^.!?]{0,80}\b(?:that|when|always|only|rule)\b/i,
    ];

  for (const chapter of draft.chapters) {
    const sentences = splitSentences(chapter.text);
    const expositionHits = sentences.filter(sentence =>
      sentencePatterns.some(pattern => pattern.test(sentence.trim())),
    );
    if (expositionHits.length === 0) continue;
    issues.push({
      gate: "SHOW_DONT_TELL_EXPOSITION",
      chapter: chapter.chapter,
      code: "RULE_EXPOSITION_TELL",
      message: isDE
        ? `Kapitel ${chapter.chapter}: erklaerende Regel-Prosa erkannt. Wirkung als Handlung/Dialog zeigen statt erklaeren.`
        : `Chapter ${chapter.chapter}: explanatory rule prose detected. Show the effect via action/dialogue instead.`,
      severity: "WARNING",
    });
  }

  return issues;
}

function gateNarrativeSummaryMeta(
  draft: StoryDraft,
  language: string,
  ageRange?: { min: number; max: number },
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";
  const ageMax = ageRange?.max ?? 12;

  const summaryPatterns = isDE
    ? [
      /\bdie\s+konsequenz\s+war\s+klar\b/i,
      /\bder\s+preis\?\b/i,
      /\bder\s+gewinn\?\b/i,
      /\bkurz\s+gesagt\b/i,
      /\bdie\s+frage\s+war\b/i,
    ]
    : [
      /\bthe\s+consequence\s+was\s+clear\b/i,
      /\bthe\s+price\?\b/i,
      /\bthe\s+gain\?\b/i,
      /\bin\s+short\b/i,
      /\bthe\s+question\s+was\b/i,
    ];

  for (const chapter of draft.chapters) {
    const hasSummaryMeta = summaryPatterns.some(pattern => pattern.test(chapter.text));
    if (!hasSummaryMeta) continue;
    issues.push({
      gate: "NARRATIVE_META",
      chapter: chapter.chapter,
      code: "META_SUMMARY_SENTENCE",
      message: isDE
        ? `Kapitel ${chapter.chapter}: zusammenfassende Meta-Formulierung statt Szene erkannt (z. B. "Die Konsequenz war klar", "Der Preis?").`
        : `Chapter ${chapter.chapter}: summary-like meta phrasing detected instead of scene writing (e.g., "The consequence was clear", "The price?").`,
      severity: "WARNING",
    });
  }

  return issues;
}

function gateNarrativeNaturalness(
  draft: StoryDraft,
  language: string,
  _ageRange?: { min: number; max: number },
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";

  const protocolMetaPatterns = isDE
    ? [
      /\bdie\s+szene\s+endete\b/i,
      /\bdie\s+szenerie\s+endete\b/i,
      /\bdie\s+handlung\s+r(?:ue|ü)ckte\s+vor\b/i,
      /\bnichts\s+mit\s+konflikt\b/i,
      /\bkeine\s+konflikt\b/i,
      /\bwir\s+ersetzen\s+es\b/i,
      /\bich\s+idee\b/i,
      /\bein\s+warmes?\s+ende\s+folgte\b/i,
    ]
    : [
      /\bthe\s+scene\s+ended\b/i,
      /\bthe\s+action\s+moved\s+forward\b/i,
      /\bno\s+conflict\b/i,
      /\bwe\s+replace\s+it\b/i,
      /\ba\s+warm\s+ending\s+followed\b/i,
    ];

  const reportSentencePattern = isDE
    ? /^(?:wir|sie|er|die\s+kinder|[A-ZÄÖÜ][a-zäöüß]+)\s+(?:ging(?:en)?|lief(?:en)?|stand(?:en)?|war(?:en)?|hatte(?:n)?|machte(?:n)?|nahm(?:en)?|legte(?:n)?|zeigte(?:n)?|sagte(?:n)?|fragte(?:n)?|nickte(?:n)?|blieb(?:en)?)\b/i
    : /^(?:we|they|he|she|the\s+children|[A-Z][a-z]+)\s+(?:went|walked|ran|stood|was|were|had|made|took|put|said|asked|nodded|stayed)\b/i;

  for (const chapter of draft.chapters) {
    const text = chapter.text || "";
    const metaHits = protocolMetaPatterns.filter(pattern => pattern.test(text)).length;
    if (metaHits > 0) {
      issues.push({
        gate: "NARRATIVE_NATURALNESS",
        chapter: chapter.chapter,
        code: "PROTOCOL_STYLE_META",
        message: isDE
          ? `Kapitel ${chapter.chapter}: protokollartige Meta-Prosa erkannt (z. B. "Die Szene endete").`
          : `Chapter ${chapter.chapter}: protocol-like meta prose detected (e.g. "The scene ended").`,
        severity: "WARNING",
      });
    }

    const sentences = splitSentences(text);
    if (sentences.length >= 10) {
      const reportLikeCount = sentences.filter(sentence => {
        if (/[""„“”»«]/.test(sentence)) return false;
        return reportSentencePattern.test(sentence.trim());
      }).length;
      const reportLikeRatio = reportLikeCount / sentences.length;
      if (reportLikeRatio >= 0.58) {
        issues.push({
          gate: "NARRATIVE_NATURALNESS",
          chapter: chapter.chapter,
          code: "REPORT_STYLE_OVERUSE",
          message: isDE
            ? `Kapitel ${chapter.chapter}: zu viele protokollartige Erzaehlsaetze (${Math.round(reportLikeRatio * 100)}%).`
            : `Chapter ${chapter.chapter}: too many report-like narration sentences (${Math.round(reportLikeRatio * 100)}%).`,
          severity: "WARNING",
        });
      }
    }

    const paragraphs = text
      .split(/\n\s*\n+/)
      .map(p => p.trim())
      .filter(Boolean);
    if (paragraphs.length >= 5) {
      const singleSentenceParagraphs = paragraphs.filter(p => splitSentences(p).length <= 1).length;
      const choppedRatio = singleSentenceParagraphs / paragraphs.length;
      if (choppedRatio >= 0.62) {
        issues.push({
          gate: "NARRATIVE_NATURALNESS",
          chapter: chapter.chapter,
          code: "PARAGRAPH_CHOPPY",
          message: isDE
            ? `Kapitel ${chapter.chapter}: Absatzfluss zu abgehackt (${singleSentenceParagraphs}/${paragraphs.length} Ein-Satz-Absaetze).`
            : `Chapter ${chapter.chapter}: paragraph flow too choppy (${singleSentenceParagraphs}/${paragraphs.length} one-sentence paragraphs).`,
          severity: "WARNING",
        });
      }
    }
  }

  return issues;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function gateAppearanceContinuity(
  draft: StoryDraft,
  cast: CastSet,
  language: string,
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";
  const smellOpenerPattern = isDE
    ? /^\s*(?:am|im|in|auf|vor|hinter|zwischen)?[^.!?]{0,120}\broch\s+(?:es\s+)?nach\b/i
    : /^\s*(?:at|in|on|near|inside|outside)?[^.!?]{0,120}\bsmelled\s+of\b/i;

  for (const chapter of draft.chapters) {
    const firstSentence = splitSentences(chapter.text || "")[0]?.trim() || "";
    if (firstSentence && smellOpenerPattern.test(firstSentence)) {
      issues.push({
        gate: "APPEARANCE_CONTINUITY",
        chapter: chapter.chapter,
        code: "SMELL_OPENER_CLICHE",
        message: isDE
          ? `Kapitel ${chapter.chapter}: Kapitelbeginn mit Geruchs-Klischee ("roch nach ..."). Besser mit Handlung, Stimme oder sichtbarem Problem beginnen.`
          : `Chapter ${chapter.chapter}: chapter opens with a smell cliché ("smelled of ..."). Start with action, voice, or a visible problem instead.`,
        severity: "WARNING",
      });
    }
  }

  const characters = [...cast.avatars, ...cast.poolCharacters];
  const accessoryChecks = [
    { key: "glasses", pattern: isDE ? /\bbrille\b/i : /\bglasses\b/i, allowPattern: /\b(brille|glasses)\b/i },
    { key: "cap", pattern: isDE ? /\b(?:m[uü]tze|kappe|hut)\b/i : /\b(?:cap|hat)\b/i, allowPattern: /\b(?:m[uü]tze|kappe|hut|cap|hat)\b/i },
    { key: "scarf", pattern: isDE ? /\bschal\b/i : /\bscarf\b/i, allowPattern: /\b(?:schal|scarf)\b/i },
  ];

  for (const character of characters) {
    const name = String(character.displayName || "").trim();
    if (!name) continue;

    const lockText = [
      ...(character.visualSignature || []),
      ...(character.outfitLock || []),
      ...(character.faceLock || []),
    ].join(" ");

    const namePattern = new RegExp(`\\b${escapeRegExp(name)}\\b`, "i");

    for (const chapter of draft.chapters) {
      const sentences = splitSentences(chapter.text || "");
      for (const sentence of sentences) {
        if (!namePattern.test(sentence)) continue;

        for (const check of accessoryChecks) {
          if (!check.pattern.test(sentence)) continue;
          if (check.allowPattern.test(lockText)) continue;

          issues.push({
            gate: "APPEARANCE_CONTINUITY",
            chapter: chapter.chapter,
            code: "INVENTED_APPEARANCE_DETAIL",
            message: isDE
              ? `Kapitel ${chapter.chapter}: ${name} bekommt ein erfundenes Merkmal (${check.key}), das im Cast nicht bestaetigt ist.`
              : `Chapter ${chapter.chapter}: ${name} gets an invented appearance detail (${check.key}) not confirmed in the cast locks.`,
            severity: "WARNING",
          });
          break;
        }
      }
    }
  }

  return issues;
}

function gateSceneContinuity(
  draft: StoryDraft,
  language: string,
  ageRange?: { min: number; max: number },
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";
  if (draft.chapters.length < 2) return issues;

  const transitionPattern = isDE
    ? /\b(dann|spaeter|später|kurz\s+darauf|wenig\s+spaeter|wenig\s+später|am\s+naechsten|am\s+nächsten|inzwischen|waehrenddessen|währenddessen|nachdem|bevor|auf\s+dem\s+weg|als\s+sie|als\s+er|als\s+die|zurueck|zurück|wieder)\b/i
    : /\b(then|later|shortly\s+after|meanwhile|afterward|before|on\s+the\s+way|as\s+they|as\s+he|as\s+she|back|again)\b/i;

  const settingTerms = isDE
    ? [
      "zimmer", "kammer", "truhe", "keller", "dachboden", "werkstatt", "uhr", "lavendel",
      "wald", "markt", "fest", "platz", "hof", "kueche", "küche", "tor", "bruecke", "brücke",
      "halle", "saal", "schloss", "schlafzimmer", "speisesaal", "brunnen", "fluss", "ufer",
      "muehle", "mühle", "garten", "thronsaal", "flur", "treppe",
    ]
    : [
      "room", "chamber", "chest", "cellar", "attic", "workshop", "clock", "lavender",
      "forest", "market", "festival", "square", "yard", "kitchen", "gate", "bridge",
      "hall", "castle", "bedroom", "dining hall", "well", "river", "shore", "mill", "garden", "stair",
    ];
  const hardLocationOpening = isDE
    ? /\b(?:im|in der|in den|in einem|am|auf dem)\s+(?:schloss|saal|thronsaal|halle|zimmer|schlafzimmer|speisesaal|keller|brunnen|fluss|ufer|markt|wald|hof|muehle|mühle|garten|flur)\b/i
    : /\b(?:in|at|inside|on)\s+(?:the\s+)?(?:castle|hall|room|bedroom|dining\s+hall|cellar|well|river|shore|market|forest|yard|mill|garden|corridor)\b/i;

  for (let idx = 1; idx < draft.chapters.length; idx++) {
    const previous = draft.chapters[idx - 1];
    const current = draft.chapters[idx];
    const previousTail = splitSentences(previous.text).slice(-2).join(" ").toLowerCase();
    const currentStart = splitSentences(current.text).slice(0, 2).join(" ").toLowerCase();
    if (!currentStart) continue;
    if (transitionPattern.test(currentStart)) continue;

    const startHits = settingTerms.filter(term => currentStart.includes(term));
    const newSettingHits = startHits.filter(term => !previousTail.includes(term));
    const abruptByCount = newSettingHits.length >= 2;
    const abruptByOpening = hardLocationOpening.test(currentStart) && newSettingHits.length >= 1;
    if (!abruptByCount && !abruptByOpening) continue;

    issues.push({
      gate: "SCENE_CONTINUITY",
      chapter: current.chapter,
      code: "ABRUPT_SCENE_SHIFT",
      message: isDE
        ? `Kapitel ${current.chapter}: harter Szenenwechsel ohne Uebergang (${newSettingHits.slice(0, 3).join(", ")}).`
        : `Chapter ${current.chapter}: abrupt scene shift without transition (${newSettingHits.slice(0, 3).join(", ")}).`,
      severity: "WARNING",
    });
  }

  return issues;
}

function gateCanonFusion(draft: StoryDraft, cast: CastSet, language: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";

  for (const chapter of draft.chapters) {
    const textLower = chapter.text.toLowerCase();
    for (const phrase of ALL_BANNED_PHRASES) {
      if (textLower.includes(phrase.toLowerCase())) {
        issues.push({
          gate: "CANON_FUSION",
          chapter: chapter.chapter,
          code: "META_PHRASE_DETECTED",
          message: isDE
            ? `Verbotene Meta-Phrase: "${phrase}"`
            : `Forbidden meta-phrase: "${phrase}"`,
          severity: "ERROR",
        });
      }
    }
  }

  // Extra regex patterns for belonging language
  const extraPatterns = isDE
    ? [
      /als\s+(?:ob|wäre|hätte)\s+(?:er|sie|es)\s+schon\s+immer/gi,
      /geh[öo]r(?:te|en)\s+(?:schon|seit)\s+(?:immer|jeher|langem)/gi,
    ]
    : [
      /as\s+(?:if|though)\s+(?:they|he|she)\s+had\s+always/gi,
      /belonged?\s+here\s+(?:since|from\s+the\s+start)/gi,
    ];

  for (const chapter of draft.chapters) {
    for (const pattern of extraPatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(chapter.text)) {
        issues.push({
          gate: "CANON_FUSION",
          chapter: chapter.chapter,
          code: "META_BELONGING_PATTERN",
          message: isDE
            ? `Meta-Zugehoerigkeitsmuster in Kapitel ${chapter.chapter} erkannt`
            : `Meta-belonging pattern in chapter ${chapter.chapter}`,
          severity: "WARNING",
        });
        break;
      }
    }
  }

  return issues;
}

// ─── Gate 13: Active Character Presence ─────────────────────────────────────────
function gateActivePresence(
  draft: StoryDraft,
  directives: SceneDirective[],
  cast: CastSet,
  language: string,
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";

  const actionVerbsDE = [
    "sagte", "rief", "fragte", "flüsterte", "lachte", "nickte",
    "griff", "nahm", "hob", "legte", "stellte", "drehte", "sprang",
    "rannte", "ging", "lief", "schaute", "blickte", "lächelte",
    "stand", "setzte", "zog", "drückte", "öffnete", "schloss",
    "warf", "fing", "hielt", "gab", "zeigte", "kletterte",
    "seufzte", "brummte", "kicherte", "jubelte", "staunte",
    "beschloss", "entschied", "entdeckte", "bemerkte", "sang",
    "tanzte", "hüpfte", "stolperte", "schrie",
  ];

  const actionVerbsEN = [
    "said", "called", "asked", "whispered", "laughed", "nodded",
    "grabbed", "took", "lifted", "placed", "turned", "jumped",
    "ran", "walked", "looked", "smiled", "stood", "sat", "pulled",
    "pushed", "opened", "closed", "threw", "caught", "held",
    "gave", "showed", "climbed", "sighed", "grumbled", "giggled",
    "cheered", "decided", "discovered", "noticed", "sang", "danced",
    "hopped", "stumbled", "shouted",
  ];

  const actionVerbs = isDE ? actionVerbsDE : actionVerbsEN;

  for (const directive of directives) {
    const ch = draft.chapters.find(c => c.chapter === directive.chapter);
    if (!ch) continue;

    const characterSlots = directive.charactersOnStage.filter(slot => !slot.includes("ARTIFACT"));

    for (const slot of characterSlots) {
      const name = findCharacterName(cast, slot);
      if (!name) continue;

      const textLower = ch.text.toLowerCase();
      const nameLower = name.toLowerCase();
      const nameParts = nameLower.split(/\s+/).filter(p => p.length > 2);
      // Check if character appears by full name or any name part
      const namePresent = textLower.includes(nameLower) || nameParts.some(p => textLower.includes(p));
      if (!namePresent) continue;

      // Use the name form that actually appears in the text for action/dialogue detection
      const nameVariants = [name, ...nameParts.map(p => p.charAt(0).toUpperCase() + p.slice(1))];

      const hasAction = nameVariants.some(n => {
        const escapedN = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return actionVerbs.some(verb => {
          const pattern = new RegExp(`${escapedN}[^.!?]{0,40}${verb}`, "i");
          return pattern.test(ch.text);
        });
      });

      const hasDialogue = nameVariants.some(n => {
        const escapedN = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const dialoguePattern = new RegExp(
          `[""„‟»«][^""„‟»«]{3,}[""„‟»«][^.!?]{0,30}${escapedN}|${escapedN}[^.!?]{0,30}[""„‟»«]`,
          "i"
        );
        return dialoguePattern.test(ch.text);
      });

      if (!hasAction && !hasDialogue) {
        issues.push({
          gate: "ACTIVE_PRESENCE",
          chapter: ch.chapter,
          code: "PASSIVE_CHARACTER",
          message: isDE
            ? `${name} in Kapitel ${ch.chapter}: keine aktive Handlung und kein Dialog`
            : `${name} in chapter ${ch.chapter}: no active action and no dialogue`,
          severity: "WARNING",
        });
      }
    }
  }

  return issues;
}

// ─── Additional 10.0 Gates ──────────────────────────────────────────────────────
function gateCharacterFocusLoad(
  draft: StoryDraft,
  directives: SceneDirective[],
  cast: CastSet,
  language: string,
  ageRange?: { min: number; max: number },
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";
  const maxActive = (ageRange?.max ?? 12) <= 8 ? 4 : 4;
  const idealActive = (ageRange?.max ?? 12) <= 8 ? 2 : 3;

  for (const directive of directives) {
    const chapter = draft.chapters.find(ch => ch.chapter === directive.chapter);
    if (!chapter) continue;

    const chapterText = chapter.text;
    const characterNames = directive.charactersOnStage
      .filter(slot => !slot.includes("ARTIFACT"))
      .map(slot => findCharacterName(cast, slot))
      .filter((name): name is string => Boolean(name));

    if (characterNames.length === 0) continue;

    const activeNames = characterNames.filter(name => {
      if (!chapterText.toLowerCase().includes(name.toLowerCase())) return false;
      return checkCharacterHasAction(chapterText, name) || hasAttributedDialogueForCharacter(chapterText, name, language);
    });

    if (activeNames.length > maxActive) {
      issues.push({
        gate: "CHARACTER_FOCUS",
        chapter: chapter.chapter,
        code: "TOO_MANY_ACTIVE_CHARACTERS",
        message: isDE
          ? `Kapitel ${chapter.chapter}: ${activeNames.length} aktive Figuren (max ${maxActive}). Fokus enger setzen: ${activeNames.join(", ")}`
          : `Chapter ${chapter.chapter}: ${activeNames.length} active characters (max ${maxActive}). Tighten focus: ${activeNames.join(", ")}`,
        severity: "ERROR",
      });
    } else if (activeNames.length === maxActive) {
      issues.push({
        gate: "CHARACTER_FOCUS",
        chapter: chapter.chapter,
        code: "FOCUS_DENSITY_HIGH",
        message: isDE
          ? `Kapitel ${chapter.chapter}: ${maxActive} aktive Figuren. Ideal sind meist ${idealActive}-${maxActive}.`
          : `Chapter ${chapter.chapter}: ${maxActive} active characters. Ideal is usually ${idealActive}-${maxActive}.`,
        severity: "WARNING",
      });
    }
  }

  return issues;
}

function gateGlobalCharacterLoad(
  draft: StoryDraft,
  directives: SceneDirective[],
  cast: CastSet,
  language: string,
  ageRange?: { min: number; max: number },
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";
  const ageMax = ageRange?.max ?? 12;
  if (ageMax > 8) return issues;

  const maxDistinctActive = 4;
  const activeByName = new Map<string, Set<number>>();

  for (const directive of directives) {
    const chapter = draft.chapters.find(ch => ch.chapter === directive.chapter);
    if (!chapter) continue;

    const chapterNames = directive.charactersOnStage
      .filter(slot => !slot.includes("ARTIFACT"))
      .map(slot => findCharacterName(cast, slot))
      .filter((name): name is string => Boolean(name));

    for (const name of chapterNames) {
      if (!chapter.text.toLowerCase().includes(name.toLowerCase())) continue;
      const isActive =
        checkCharacterHasAction(chapter.text, name) ||
        hasAttributedDialogueForCharacter(chapter.text, name, language);
      if (!isActive) continue;

      if (!activeByName.has(name)) activeByName.set(name, new Set<number>());
      activeByName.get(name)!.add(chapter.chapter);
    }
  }

  const distinctActive = Array.from(activeByName.keys());
  if (distinctActive.length > maxDistinctActive) {
    issues.push({
      gate: "GLOBAL_CHARACTER_LOAD",
      chapter: 0,
      code: "GLOBAL_CAST_OVERLOAD",
      message: isDE
        ? `Zu viele aktiv erkennbare Figuren fuer 6-8 Jahre (${distinctActive.length}, max ${maxDistinctActive}): ${distinctActive.join(", ")}`
        : `Too many actively distinct characters for age 6-8 (${distinctActive.length}, max ${maxDistinctActive}): ${distinctActive.join(", ")}`,
      severity: "ERROR",
    });
  }

  return issues;
}

function gateStakesAndLowpoint(
  draft: StoryDraft,
  language: string,
  ageRange?: { min: number; max: number },
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";
  const ageMax = ageRange?.max ?? 12;
  if (draft.chapters.length === 0) return issues;

  const firstTwoText = draft.chapters
    .filter(ch => ch.chapter <= 2)
    .map(ch => ch.text)
    .join(" ");

  const stakesPatterns = isDE
    ? [
      /wenn\s+wir[^.!?]{0,90}(dann|verlieren|verpassen|zu\s+sp(?:ae|ä)t|schaffen)/i,
      /wenn\s+wir[^.!?]{0,90}(schlafen|bleiben|landen|st(?:u|ü)rzen|unter\s+tr(?:u|ü)mmern)/i,
      /wenn\s+[^.!?]{0,80}nicht\s+schaff/i,
      /wenn\s+[^.!?]{0,90}(einst(?:u|ü)rzt|zusammenbricht|kaputtgeht|zerbricht)/i,
      /sonst[^.!?]{0,80}(verlieren|bleiben|schaffen|geht|schlie(?:s|ß)t)/i,
      /\bverlieren\s+wir\b/i,
      /\bdroht\b[^.!?]{0,70}\b(verlust|zu\s+sp(?:ae|ä)t|weg|gefangen)\b/i,
    ]
    : [
      /if\s+we[^.!?]{0,90}then/i,
      /if\s+we[^.!?]{0,80}don't\s+(make|reach|find|solve)/i,
      /otherwise[^.!?]{0,80}(lose|miss|fail|stuck)/i,
    ];
  const stakesConnectorPattern = isDE
    ? /\b(wenn|falls|sonst|ohne|bevor|damit|droht)\b/i
    : /\b(if|otherwise|unless|without|before|or\s+else|at\s+risk)\b/i;
  const stakesConsequencePattern = isDE
    ? /\b(verlieren|verpasst?|bleibt?|verschwind|zerbricht|geht\s+kaputt|gefangen|zu\s+spaet|allein|verlust|keine?\s+chance|kein\s+zuhause|fuer\s+immer|unter\s+tr(?:u|ü)mmern|einst(?:u|ü)rzt|zusammenbricht|klaut|stiehlt|pl(?:u|ü)ndert|raubt)\b/i
    : /\b(lose|miss|stuck|trapped|too\s+late|breaks?|gone|alone|no\s+chance|no\s+home|forever|steals?|robs?|loots?)\b/i;
  const stakesConcreteNounPattern = isDE
    ? /\b(amulett|kugel|karte|kompass|schluessel|tor|weg|pfad|zuhause|dorf|dorfspeicher|speicher|vorrat|proviant|freund|team|gruppe|schatz|ziel|licht|bruecke|m(?:u|ü)hle|feder|kiste|erbe)\b/i
    : /\b(artifact|orb|map|compass|key|gate|path|home|village|storehouse|supplies|food|friend|team|group|treasure|goal|bridge)\b/i;
  const openingSentences = splitSentences(firstTwoText).slice(0, 16);

  const hasSentenceLevelConsequence = openingSentences.some(sentence =>
    stakesConnectorPattern.test(sentence) && stakesConsequencePattern.test(sentence),
  );
  const hasCrossSentenceConsequence = openingSentences.some((sentence, index) => {
    if (!stakesConnectorPattern.test(sentence)) return false;
    const next = openingSentences[index + 1] || "";
    return stakesConsequencePattern.test(`${sentence} ${next}`);
  });
  const hasExplicitStakes =
    stakesPatterns.some(pattern => pattern.test(firstTwoText)) ||
    hasSentenceLevelConsequence ||
    hasCrossSentenceConsequence;
  if (!hasExplicitStakes) {
    issues.push({
      gate: "STAKES_LOWPOINT",
      chapter: 1,
      code: "MISSING_EXPLICIT_STAKES",
      message: isDE
        ? "Fruehe Stakes fehlen: in Kapitel 1-2 klar zeigen, was bei Scheitern passiert."
        : "Early stakes missing: in chapters 1-2, clearly show what happens if they fail.",
      severity: "ERROR",
    });
  } else {
    const hasConcreteStake = openingSentences.some((sentence, index) => {
      const next = openingSentences[index + 1] || "";
      const window = `${sentence} ${next}`;
      return stakesConsequencePattern.test(window) && stakesConcreteNounPattern.test(window);
    });
    if (!hasConcreteStake) {
      issues.push({
        gate: "STAKES_LOWPOINT",
        chapter: 1,
        code: "STAKES_TOO_ABSTRACT",
        message: isDE
          ? "Stakes sind vorhanden, aber zu abstrakt. Benenne frueh konkret, was genau verloren geht."
          : "Stakes exist but are too abstract. Name early what concrete thing will be lost.",
        severity: "WARNING",
      });
    }
  }

  const lowpointCandidates = draft.chapters.filter(ch => ch.chapter === 3 || ch.chapter === 4);
  const setbackPatterns = isDE
    ? [
      /scheiter|fehl(?!erlos)|falsch|verlor|blockier|geschlossen|schlie(?:s|ß)t|bricht|sackgasse|nicht\s+weiter|zu\s+sp(?:ae|ä)t/i,
      /steckte?\s+fest|gefangen|versperrt|kein(?:en?)?\s+ausweg|hilflos|ohnm(?:ae|ä)chtig|aussichtslos|hoffnungslos|vergeblich|umsonst/i,
      /fiel(?:en?)?\s+(?:hin|um|herunter)|rutschte|stürzte|krachte|knackte|riss|zerbrach|schmolz/i,
      /konnte\s+nicht|schaffte?\s+es\s+nicht|war\s+zu\s+(?:schwer|spät|dunkel|weit)|gab\s+nach/i,
    ]
    : [
      /fail|wrong|lost|blocked|closed|collapse|dead\s*end|can't\s+go\s+on|too\s+late/i,
      /stuck|trapped|no\s+way\s+out|helpless|hopeless|useless|impossible/i,
      /fell|slipped|crashed|cracked|broke|shattered|crumbled/i,
      /couldn't|wasn't\s+able|too\s+(?:heavy|late|dark|far)|gave\s+way/i,
    ];
  const emotionPatterns = isDE
    ? [
      /zitter|schluck|magen|bauch|traute?\s+sich\s+nicht|zweifel|angst|herz/i,
      /kehle|tr(?:ae|ä)nen|weinte|biss\s+sich|presste|krallte|verkrampfte|erstarrte|stockte/i,
      /klopfte|h(?:ae|ä)mmerte|pochte|brannte|kribbelte|sackte|sackten|schwer\s+wie\s+blei/i,
      /konnte\s+kaum\s+(?:atmen|sprechen|schlucken)|wurde?\s+(?:blass|bleich|rot|still)/i,
    ]
    : [
      /trembl|swallow|stomach|doubt|fear|heart/i,
      /throat|tears|cried|bit\s+(?:his|her)|pressed|gripped|clenched|froze|stumbled/i,
      /pounding|hammering|burning|tingling|sank|heavy\s+as\s+lead/i,
      /could\s+barely\s+(?:breathe|speak|swallow)|turned?\s+(?:pale|white|red|quiet)/i,
    ];

  let lowpointChapter: StoryDraft["chapters"][number] | null = null;
  let lowpointHasEmotion = false;
  for (const chapter of lowpointCandidates) {
    const hasSetback = setbackPatterns.some(pattern => pattern.test(chapter.text));
    if (!hasSetback) continue;
    lowpointChapter = chapter;
    lowpointHasEmotion = emotionPatterns.some(pattern => pattern.test(chapter.text));
    break;
  }

  if (!lowpointChapter) {
    issues.push({
      gate: "STAKES_LOWPOINT",
      chapter: 4,
      code: "MISSING_LOWPOINT",
      message: isDE
        ? "Kapitel 3/4 hat keinen klaren Tiefpunkt mit echtem Rueckschlag."
        : "Chapter 3/4 has no clear low point with a real setback.",
      severity: "ERROR",
    });
  } else if (!lowpointHasEmotion) {
    issues.push({
      gate: "STAKES_LOWPOINT",
      chapter: lowpointChapter.chapter,
      code: "LOWPOINT_EMOTION_THIN",
      message: isDE
        ? `Kapitel ${lowpointChapter.chapter}: Rueckschlag vorhanden, aber innere Gefuehlsreaktion zu schwach.`
        : `Chapter ${lowpointChapter.chapter}: setback present, but internal emotional reaction is too weak.`,
      severity: "WARNING",
    });
  }

  if (lowpointChapter) {
    const lowpointSoftenerPatterns = isDE
      ? [
        /\bkein(?:e|en)?\s+katastrophe\b/i,
        /\bnur\s+ein\s+kleiner\s+schreck\b/i,
        /\bnichts\s+schlimmes\b/i,
        /\bohne\s+echte\s+folgen\b/i,
        /\bnur\s+eine?\s+kleine?\s+verzoegerung\b/i,
        /\bnur\s+eine?\s+kleine?\s+verzögerung\b/i,
      ]
      : [
        /\bnot\s+a\s+disaster\b/i,
        /\bjust\s+a\s+small\s+scare\b/i,
        /\bnothing\s+serious\b/i,
        /\bwithout\s+real\s+consequences\b/i,
        /\bjust\s+a\s+small\s+delay\b/i,
      ];

    if (lowpointSoftenerPatterns.some(pattern => pattern.test(lowpointChapter.text))) {
      issues.push({
        gate: "STAKES_LOWPOINT",
        chapter: lowpointChapter.chapter,
        code: "LOWPOINT_TOO_SOFT",
        message: isDE
          ? `Kapitel ${lowpointChapter.chapter}: Tiefpunkt wird sofort verharmlost; fuege einen echten Preis/Verlust ein.`
          : `Chapter ${lowpointChapter.chapter}: low point is immediately softened; add a real cost/loss.`,
        severity: "WARNING",
      });
    }
  }

  return issues;
}

function gateRhythmVariation(
  draft: StoryDraft,
  language: string,
  ageRange?: { min: number; max: number },
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";

  for (const chapter of draft.chapters) {
    const sentences = splitSentences(chapter.text);
    if (sentences.length < 6) continue;

    const lengths = sentences.map(sentence => countWords(sentence)).filter(n => n > 0);
    const shortCount = lengths.filter(n => n <= 7).length;
    const mediumCount = lengths.filter(n => n >= 8 && n <= 14).length;
    const longCount = lengths.filter(n => n >= 15).length;

    if (shortCount === 0 || mediumCount === 0) {
      issues.push({
        gate: "RHYTHM_VARIATION",
        chapter: chapter.chapter,
        code: "RHYTHM_FLAT",
        message: isDE
          ? `Kapitel ${chapter.chapter}: Satzrhythmus zu gleichfoermig (kurze und mittlere Saetze mischen).`
          : `Chapter ${chapter.chapter}: sentence rhythm too flat (mix short and medium sentences).`,
        severity: "WARNING",
      });
    }

    if ((ageRange?.max ?? 12) <= 8 && longCount > Math.ceil(lengths.length * 0.34)) {
      issues.push({
        gate: "RHYTHM_VARIATION",
        chapter: chapter.chapter,
        code: "RHYTHM_TOO_HEAVY",
        message: isDE
          ? `Kapitel ${chapter.chapter}: zu viele laengere Saetze fuer 6-8 Jahre.`
          : `Chapter ${chapter.chapter}: too many longer sentences for age 6-8.`,
        severity: "WARNING",
      });
    }

    const comparisonPatterns = isDE
      ? [/\bwie\s+(?:ein|eine|der|die|das)\b/gi, /\bals\s+ob\b/gi]
      : [/\blike\s+(?:a|an|the)\b/gi, /\bas\s+if\b/gi];
    let comparisonCount = 0;
    for (const pattern of comparisonPatterns) {
      pattern.lastIndex = 0;
      comparisonCount += chapter.text.match(pattern)?.length ?? 0;
    }

    if (comparisonCount > Math.ceil(sentences.length / 3)) {
      issues.push({
        gate: "RHYTHM_VARIATION",
        chapter: chapter.chapter,
        code: "IMAGERY_DENSITY_HIGH",
        message: isDE
          ? `Kapitel ${chapter.chapter}: Bildsprache zu dicht (${comparisonCount} Vergleiche bei ${sentences.length} Saetzen).`
          : `Chapter ${chapter.chapter}: imagery too dense (${comparisonCount} comparisons for ${sentences.length} sentences).`,
        severity: "WARNING",
      });
    }
  }

  return issues;
}

function gateChildEmotionArc(
  draft: StoryDraft,
  cast: CastSet,
  language: string,
  ageRange?: { min: number; max: number },
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";
  const ageMax = ageRange?.max ?? 12;
  const childFocusNames = getChildFocusNames(cast);
  if (childFocusNames.length === 0) return issues;

  const fullText = draft.chapters.map(ch => ch.text).join(" ");
  const innerMarkers = isDE
    ? "(?:denkt|dachte|f[üu]hlt|f[üu]hlte|sp[üu]rt|sp[üu]rte|fragt\\s+sich|fragte\\s+sich|zweifelt|zweifelte|zittert|zitterte|schluckt|schluckte|hat\\s+Angst|hatte\\s+Angst|mutig|[üu]berlegt|[üu]berlegte|gr[üu]belt|gr[üu]belte|erschrickt|erschrak|erstarrt|erstarrte|atmet|atmete|Atem\\s+holte|Herz\\s+(?:h[äa]mmert|klopft|schlug|pochte|raste)|Magen\\s+(?:zieht|drehte)|Knie\\s+(?:zitter|wackel|weich)|Atem\\s+(?:stock|angehalten)|F[äa]uste\\s+ballte|schluck|Tr[äa]nen|weint|weinte|bang|beklommen|aufgeregt|nerv[öo]s)"
    : "(?:thinks|thought|feels|felt|wonders|wondered|doubts|doubted|trembles|trembled|swallows|swallowed|is\\s+afraid|was\\s+afraid|brave)";
  const mistakeMarkers = isDE
    ? "(?:Fehler|falsch|falsche\\s+karte|stolper|scheiter|zu\\s+schnell|zu\\s+fr[üu]h|verga[ßs]|versagt|vermasselt|[üu]bersehen|verwechselt|nicht\\s+aufgepasst|h[äa]tte\\s+nicht|fehlentscheidung|irrweg)"
    : "(?:mistake|wrong|stumble|fail|too\\s+fast|too\\s+early|forgot)";
  const repairMarkers = isDE
    ? "(?:korrigier|umplan|macht\\s+es\\s+besser|versucht\\s+es\\s+anders|hilft|rettet|entscheidet|entschied|reparier|wieder\\s+gut|entschuldig|traut\\s+sich|[üu]berwind|fasst\\s+Mut|neuen\\s+Anlauf|noch\\s+einmal|versucht\\s+es\\s+erneut|neuer\\s+plan|anderen\\s+weg)"
    : "(?:correct|does\\s+it\\s+better|tries\\s+another\\s+way|helps|saves|decides|decided)";

  let hasChildErrorCorrectionArc = false;

  for (const name of childFocusNames) {
    // Try full name AND individual name parts (e.g. "Adrian" from "Adrian Mutig")
    const nameParts = [name, ...name.split(/\s+/).filter(p => p.length > 2)];
    const uniqueParts = [...new Set(nameParts)];

    let hasInnerMoment = false;
    for (const part of uniqueParts) {
      const escapedPart = part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (
        new RegExp(`${escapedPart}[^.!?]{0,90}${innerMarkers}`, "i").test(fullText) ||
        new RegExp(`${innerMarkers}[^.!?]{0,90}${escapedPart}`, "i").test(fullText)
      ) {
        hasInnerMoment = true;
        break;
      }
    }
    if (!hasInnerMoment) {
      hasInnerMoment = draft.chapters.some(ch => {
        const text = ch.text || "";
        const lower = text.toLowerCase();
        const hasName = uniqueParts.some(part => lower.includes(part.toLowerCase()));
        if (!hasName) return false;
        return new RegExp(innerMarkers, "i").test(text);
      });
    }

    if (!hasInnerMoment) {
      issues.push({
        gate: "CHILD_EMOTION_ARC",
        chapter: 0,
        code: "MISSING_INNER_CHILD_MOMENT",
        message: isDE
          ? `Innere Perspektive fuer ${name} fehlt oder ist zu schwach.`
          : `Inner perspective for ${name} is missing or too weak.`,
        severity: "WARNING",
      });
    }

    for (const part of uniqueParts) {
      const partLower = part.toLowerCase();
      let hasMistake = false;
      let hasRepair = false;
      for (const chapter of draft.chapters) {
        const text = chapter.text || "";
        const lower = text.toLowerCase();
        if (!lower.includes(partLower)) continue;
        if (new RegExp(mistakeMarkers, "i").test(text)) hasMistake = true;
        if (new RegExp(repairMarkers, "i").test(text)) hasRepair = true;
      }
      if (hasMistake && hasRepair) {
        hasChildErrorCorrectionArc = true;
        break;
      }
    }
  }

  if (!hasChildErrorCorrectionArc) {
    issues.push({
      gate: "CHILD_EMOTION_ARC",
      chapter: 0,
      code: "NO_CHILD_ERROR_CORRECTION_ARC",
      message: isDE
        ? "Fehler-und-Korrektur-Bogen eines Kindes fehlt (Fehlentscheidung -> aktive Korrektur)."
        : "Missing child error-correction arc (bad decision -> active correction).",
      severity: "WARNING",
    });
  }

  return issues;
}

// ─── Gate 14: Artifact Mini-Arc ─────────────────────────────────────────────────
function gateHumorPresence(
  draft: StoryDraft,
  language: string,
  ageRange?: { min: number; max: number },
  humorLevel?: number,
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";
  const ageMax = ageRange?.max ?? 12;
  const level = Math.max(0, Math.min(3, Number.isFinite(humorLevel as number) ? Number(humorLevel) : 2));
  if (level <= 0) return issues;

  const minHumorMoments = level >= 3 ? 3 : level >= 2 ? 2 : 1;
  const humorPatterns = isDE
    ? [
      /\b(lacht|lachen|lachte|kichert|kicherte|kichernd|grinst|grinste|prustet|prustete|schmunzelt|schmunzelte|gluckste|glucksen)\b/i,
      /\b(hihi|haha|hehe|kicher|prust|mmphf|peng|platsch|schwupps|plumps|knacks|hoppla|ups)\b/i,
      /\b(witz|scherz|komisch|lustig|albern|quatsch|blödsinn|kichernd|witzig)\b/i,
      /\b(stolperte|rutschte|fiel|purzelte|kullerte|plumpste)[^.!?]{0,60}(lach|grinst|kicher|prust)/i,
      /\b(verdrehte\s+die\s+augen|schnitt\s+eine?\s+grimasse|zog\s+eine?\s+schnute|streckte\s+die\s+zunge|machte\s+große\s+augen)\b/i,
      /\b(kr(?:ue|ü)mel\s+fl|stopfte\s+sich|mund\s+voll|verschluckte\s+sich|nieste|hickste|hicksen|rülpste)\b/i,
    ]
    : [
      /\b(laugh|laughed|giggle|giggled|grin|grinned|snort|snorted|chuckle|chuckled|smirk|smirked)\b/i,
      /\b(ha-ha|haha|hehe|teehee|oops|whoops|splat|splash|thud|bonk|pop)\b/i,
      /\b(joke|funny|playful|comical|silly|nonsense|ridiculous)\b/i,
      /\b(stumbled|slipped|tripped|tumbled|rolled)[^.!?]{0,60}(laugh|grin|giggl|chuckl)/i,
      /\b(rolled\s+(?:his|her|their)\s+eyes|made\s+a\s+face|stuck\s+out\s+(?:his|her|their)\s+tongue|wide\s+eyes)\b/i,
      /\b(crumbs\s+fl|stuffed|mouth\s+full|choked\s+on|sneezed|hiccup)/i,
    ];

  let humorChapterHits = 0;
  for (const chapter of draft.chapters) {
    const hasHumor = humorPatterns.some(pattern => pattern.test(chapter.text));
    if (hasHumor) humorChapterHits += 1;
  }

  if (humorChapterHits < minHumorMoments) {
    issues.push({
      gate: "HUMOR_PRESENCE",
      chapter: 0,
      code: "HUMOR_TOO_LOW",
      message: isDE
        ? `Humor-Level zu niedrig: ${humorChapterHits} humorvolle Kapitel, Ziel mindestens ${minHumorMoments}.`
        : `Humor level too low: ${humorChapterHits} humorous chapters, target at least ${minHumorMoments}.`,
      severity: "WARNING",
    });
  }

  return issues;
}

function gateGimmickLoopOveruse(
  draft: StoryDraft,
  cast: CastSet,
  language: string,
  ageRange?: { min: number; max: number },
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";
  const ageMax = ageRange?.max ?? 12;

  const soundTokenRegex = isDE
    ? /(quak|wuff|miau|piep|kicher|brumm|grmpf|haha|hihi|hehe)/i
    : /(croak|woof|meow|beep|giggle|grr|haha|hehe)/i;
  const seedTokens = new Set<string>();

  const allCharacters = [...cast.avatars, ...cast.poolCharacters];
  for (const character of allCharacters) {
    const nameParts = String(character.displayName || "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    for (const part of nameParts) {
      const match = part.match(soundTokenRegex);
      if (match?.[1]) seedTokens.add(match[1].toLowerCase());
    }

    const hints = character.speechStyleHints ?? [];
    for (const hint of hints) {
      const lowerHint = String(hint || "").toLowerCase();
      if (isDE) {
        if (lowerHint.includes("croak") || lowerHint.includes("quak")) seedTokens.add("quak");
      } else if (lowerHint.includes("croak") || lowerHint.includes("quak")) {
        seedTokens.add("croak");
      }
    }

    const catchphraseWords = String(character.catchphrase || "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    for (const word of catchphraseWords) {
      const match = word.match(soundTokenRegex);
      if (match?.[1]) seedTokens.add(match[1].toLowerCase());
    }
  }

  if (seedTokens.size === 0) return issues;

  const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const chapterMax = ageMax <= 8 ? 6 : 8;
  const storyMax = ageMax <= 8 ? 14 : 18;

  for (const token of seedTokens) {
    const stemPattern = new RegExp(`\\b${escapeRegex(token)}(?:[a-z]{0,4})\\b`, "gi");
    let storyHits = 0;

    for (const chapter of draft.chapters) {
      stemPattern.lastIndex = 0;
      const hits = chapter.text.match(stemPattern)?.length ?? 0;
      storyHits += hits;
      if (hits > chapterMax) {
        issues.push({
          gate: "GIMMICK_LOOP",
          chapter: chapter.chapter,
          code: "GIMMICK_LOOP_CHAPTER",
          message: isDE
            ? `Kapitel ${chapter.chapter}: Running-Gag "${token}" zu oft wiederholt (${hits}x, max ${chapterMax}).`
            : `Chapter ${chapter.chapter}: running gag "${token}" repeated too often (${hits}, max ${chapterMax}).`,
          severity: "WARNING",
        });
      }
    }

    if (storyHits > storyMax) {
      issues.push({
        gate: "GIMMICK_LOOP",
        chapter: 0,
        code: "GIMMICK_LOOP_OVERUSE",
        message: isDE
          ? `Running-Gag "${token}" in der Geschichte uebernutzt (${storyHits}x, max ${storyMax}).`
          : `Running gag "${token}" overused across the story (${storyHits}, max ${storyMax}).`,
        severity: "WARNING",
      });
    }

  }

  const burstPattern = isDE
    ? /\b(quak|wuff|miau|piep|haha|hihi|hehe)(?:\s*[,!.\-]?\s*\1){2,}\b/gi
    : /\b(croak|woof|meow|beep|haha|hehe)(?:\s*[,!.\-]?\s*\1){2,}\b/gi;
  for (const chapter of draft.chapters) {
    burstPattern.lastIndex = 0;
    const bursts = chapter.text.match(burstPattern)?.length ?? 0;
    if (bursts <= 0) continue;
    issues.push({
      gate: "GIMMICK_LOOP",
      chapter: chapter.chapter,
      code: "GIMMICK_LOOP_BURST",
      message: isDE
        ? `Kapitel ${chapter.chapter}: Lautmalerei-Schleife erkannt (${bursts}x). Einmal reicht oft.`
        : `Chapter ${chapter.chapter}: onomatopoeia loop detected (${bursts}). Once is often enough.`,
      severity: "WARNING",
    });
  }

  return issues;
}

function gateArtifactMiniArc(
  draft: StoryDraft,
  cast: CastSet,
  language: string,
  artifactArc?: ArtifactArcPlan,
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";
  const artifactName = cast.artifact?.name?.toLowerCase();

  if (!artifactName || !artifactArc) return issues;

  const chapterMentions: Map<number, number> = new Map();
  for (const ch of draft.chapters) {
    const count = countOccurrences(ch.text.toLowerCase(), artifactName);
    if (count > 0) chapterMentions.set(ch.chapter, count);
  }

  const totalMentions = Array.from(chapterMentions.values()).reduce((a, b) => a + b, 0);

  if (!chapterMentions.has(artifactArc.discoveryChapter)) {
    issues.push({
      gate: "ARTIFACT_MINI_ARC",
      chapter: artifactArc.discoveryChapter,
      code: "MISSING_DISCOVERY",
      message: isDE
        ? `Artefakt "${cast.artifact.name}" fehlt in Entdeckungs-Kapitel ${artifactArc.discoveryChapter}`
        : `Artifact "${cast.artifact.name}" missing from discovery chapter ${artifactArc.discoveryChapter}`,
      severity: "WARNING",
    });
  }

  if (!chapterMentions.has(artifactArc.successChapter)) {
    issues.push({
      gate: "ARTIFACT_MINI_ARC",
      chapter: artifactArc.successChapter,
      code: "MISSING_SUCCESS",
      message: isDE
        ? `Artefakt "${cast.artifact.name}" fehlt in Erfolgs-Kapitel ${artifactArc.successChapter}`
        : `Artifact "${cast.artifact.name}" missing from success chapter ${artifactArc.successChapter}`,
      severity: "WARNING",
    });
  }

  const activeAppearances = artifactArc.activeChapters.filter(ch => chapterMentions.has(ch));
  if (activeAppearances.length < 2) {
    issues.push({
      gate: "ARTIFACT_MINI_ARC",
      chapter: 0,
      code: "INSUFFICIENT_ACTIVE_CHAPTERS",
      message: isDE
        ? `Artefakt nur in ${activeAppearances.length} aktiven Kapiteln (mind. 2)`
        : `Artifact only in ${activeAppearances.length} active chapters (need 2+)`,
      severity: "WARNING",
    });
  }

  if (totalMentions < 3) {
    issues.push({
      gate: "ARTIFACT_MINI_ARC",
      chapter: 0,
      code: "ARTIFACT_UNDERMENTIONED",
      message: isDE
        ? `Artefakt nur ${totalMentions}x erwaehnt (mind. 3 fuer Mini-Arc)`
        : `Artifact only ${totalMentions}x mentioned (need 3+ for mini-arc)`,
      severity: "WARNING",
    });
  }

  return issues;
}

// ─── Main Runner ────────────────────────────────────────────────────────────────
// ─── Gate V7a: Child Mistake Arc ──────────────────────────────────────────────
// Checks that Chapter 3 contains a genuine child mistake + body reaction
function gateChildMistakeArc(
  draft: StoryDraft,
  cast: CastSet,
  language: string,
  ageRange?: { min: number; max: number },
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";
  const ageMax = ageRange?.max ?? 12;
  if (draft.chapters.length < 4) return issues;

  // Chapter 3 (index 2) should contain the mistake
  const ch3 = draft.chapters[2];
  if (!ch3) return issues;
  const text = ch3.text;

  // Check for mistake indicators
  const mistakePatterns = isDE
    ? [
      /\b(?:fehler|falsch|verschuldet|schuld|dummer?|dummerweise|hätte\s+nicht|sollte\s+nicht|warum\s+(?:nur|hab|habe)|zu\s+schnell|zu\s+ungeduldig|ohne\s+nachzudenken|voreilig|übermütig)\b/i,
      /\b(?:kaputt|zerbrochen|zerriss|verloren|vergessen|verschüttet|umgeworfen|fallen\s+gelassen|zerstört|ruiniert)\b/i,
      /\b(?:verschenkt|eingetauscht|weggegeben|hergegeben|verraten|getauscht|abgegeben|preisgegeben)\b/i,
      /\b(?:nicht\s+(?:zuhören|aufpassen|nachdenken)|ignoriert|übersehen|überhört|missachtet)\b/i,
    ]
    : [
      /\b(?:mistake|wrong|fault|shouldn't\s+have|shouldn't\s+have|why\s+did\s+I|too\s+fast|too\s+impatient|without\s+thinking|reckless|overconfident)\b/i,
      /\b(?:broke|broken|tore|lost|forgot|spilled|knocked\s+over|dropped|destroyed|ruined)\b/i,
      /\b(?:gave\s+away|traded|handed\s+over|betrayed|swapped|surrendered)\b/i,
      /\b(?:didn't\s+(?:listen|pay\s+attention|think)|ignored|overlooked|missed)\b/i,
    ];

  const hasMistakeIndicator = mistakePatterns.some(p => p.test(text));

  // Check for body reaction
  const bodyReactionPatterns = isDE
    ? [
      /\b(?:magen|bauch|kehle|hals|finger|hände|knie|beine|schultern|herz|brust)\b/i,
      /\b(?:schluckte|zitterte|erstarrte|stockte|krallte|presste|sackte|sackten|drückte|ballte|verkrampfte)\b/i,
    ]
    : [
      /\b(?:stomach|belly|throat|fingers|hands|knees|legs|shoulders|heart|chest)\b/i,
      /\b(?:swallowed|trembled|froze|stumbled|gripped|pressed|slumped|clenched|tightened)\b/i,
    ];

  const hasBodyReaction = bodyReactionPatterns.some(p => p.test(text));

  if (!hasMistakeIndicator) {
    issues.push({
      gate: "CHILD_MISTAKE_ARC",
      chapter: ch3.chapter,
      code: "CHILD_MISTAKE_MISSING",
      message: isDE
        ? `Kapitel ${ch3.chapter}: Kein erkennbarer Kinderfehler. Das Kind muss einen echten Fehler machen (aus Ungeduld, Stolz oder Angst), nicht nur Pech haben.`
        : `Chapter ${ch3.chapter}: No recognizable child mistake. The child must make a genuine error (from impatience, pride, or fear), not just bad luck.`,
      severity: ageMax <= 8 ? "ERROR" : "WARNING",
    });
  }

  if (!hasBodyReaction) {
    issues.push({
      gate: "CHILD_MISTAKE_ARC",
      chapter: ch3.chapter,
      code: "MISTAKE_BODY_REACTION_MISSING",
      message: isDE
        ? `Kapitel ${ch3.chapter}: Fehlende Körperreaktion auf den Fehler. Zeige wie der Körper reagiert (Magen zieht sich zusammen, Kehle wird eng, Hände zittern).`
        : `Chapter ${ch3.chapter}: Missing body reaction to the mistake. Show how the body reacts (stomach drops, throat tightens, hands shake).`,
      severity: "WARNING",
    });
  }

  // Check Ch4 for internal turning point (not external rescue)
  const ch4 = draft.chapters[3];
  if (ch4) {
    const ch4Text = ch4.text;
    const externalRescuePatterns = isDE
      ? [
        /\b(?:rettete\s+(?:sie|ihn|ihm|ihr)|kam\s+(?:ihr|ihm)\s+zu\s+hilfe|erschien\s+(?:ein|eine|der|die)\s+\w+\s+und\s+rettete)\b/i,
      ]
      : [
        /\b(?:rescued\s+(?:them|her|him)|came\s+to\s+(?:their|her|his)\s+rescue|appeared\s+and\s+saved)\b/i,
      ];

    const internalTurnPatterns = isDE
      ? [
        /\b(?:verstand|begriff|erkannte|merkte|wusste|beschloss|entschied|versuchte?\s+es\s+anders|diesmal|auf\s+eine\s+andere\s+(?:art|weise))\b/i,
        /\b(?:erinnerte\s+sich|fiel\s+(?:ihm|ihr)\s+ein|da\s+(?:fiel|kam))\b/i,
      ]
      : [
        /\b(?:understood|realized|knew|decided|tried\s+(?:differently|another\s+way)|this\s+time)\b/i,
        /\b(?:remembered|it\s+came\s+(?:to\s+(?:him|her)|back))\b/i,
      ];

    const hasInternalTurn = internalTurnPatterns.some(p => p.test(ch4Text));
    if (!hasInternalTurn) {
      issues.push({
        gate: "CHILD_MISTAKE_ARC",
        chapter: ch4.chapter,
        code: "INTERNAL_TURN_MISSING",
        message: isDE
          ? `Kapitel ${ch4.chapter}: Keine erkennbare innere Wende. Das Kind muss selbst eine Erkenntnis haben oder sich an etwas erinnern — nicht von außen gerettet werden.`
          : `Chapter ${ch4.chapter}: No recognizable internal turning point. The child must have their own insight or memory — not be rescued externally.`,
        severity: "WARNING",
      });
    }
  }

  return issues;
}

// ─── Gate V7b: Chapter Transitions ───────────────────────────────────────────
// Checks that Ch2-5 opening connects to the previous chapter's ending
function gateChapterTransitions(
  draft: StoryDraft,
  language: string,
  ageRange?: { min: number; max: number },
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";
  const ageMax = ageRange?.max ?? 12;

  for (let i = 1; i < draft.chapters.length; i++) {
    const prevChapter = draft.chapters[i - 1];
    const currChapter = draft.chapters[i];
    if (!prevChapter || !currChapter) continue;

    // Get last 2 sentences of previous chapter
    const prevSentences = splitSentences(prevChapter.text);
    const lastSentences = prevSentences.slice(-2).join(" ").toLowerCase();

    // Get first 2 sentences of current chapter
    const currSentences = splitSentences(currChapter.text);
    const firstSentences = currSentences.slice(0, 2).join(" ").toLowerCase();

    if (!lastSentences || !firstSentences) continue;

    // Check for any connection between chapters:
    // 1. Shared words (names, objects, places)
    // 2. Temporal connectors
    // 3. Continuation indicators

    const prevWords = new Set(
      lastSentences
        .replace(/[^a-zäöüß\s]/gi, "")
        .split(/\s+/)
        .filter(w => w.length > 3),
    );
    const currWords = firstSentences
      .replace(/[^a-zäöüß\s]/gi, "")
      .split(/\s+/)
      .filter(w => w.length > 3);

    const sharedWords = currWords.filter(w => prevWords.has(w));

    // Temporal/continuation patterns
    const transitionPatterns = isDE
      ? [
        /^(?:da|dann|danach|daraufhin|als|noch|immer\s+noch|kaum|plötzlich|in\s+diesem|am\s+nächsten|wenig\s+später|kurz\s+darauf)\b/i,
        // Pronoun continuations
        /^(?:er|sie|es|sie)\s+/i,
      ]
      : [
        /^(?:then|when|as|still|just|meanwhile|later|the\s+next|moments?\s+later|shortly\s+after)\b/i,
        /^(?:he|she|it|they)\s+/i,
      ];

    const hasTransition = transitionPatterns.some(p => p.test(firstSentences.trim()));
    const hasSharedContext = sharedWords.length >= 1;

    if (!hasTransition && !hasSharedContext) {
      issues.push({
        gate: "CHAPTER_TRANSITION",
        chapter: currChapter.chapter,
        code: "CHAPTER_TRANSITION_WEAK",
        message: isDE
          ? `Kapitel ${currChapter.chapter}: Schwacher Übergang vom vorherigen Kapitel. Der erste Satz sollte an den letzten Moment des vorherigen Kapitels anknüpfen.`
          : `Chapter ${currChapter.chapter}: Weak transition from previous chapter. The first sentence should connect to the last moment of the previous chapter.`,
        severity: ageMax <= 8 ? "WARNING" : "WARNING",
      });
    }
  }

  return issues;
}

// ─── Gate V7c: Chapter 1 Orientation Check ───────────────────────────────────
// Validates that Chapter 1 is genuinely an orientation chapter, not in-medias-res
function gateCh1Orientation(
  draft: StoryDraft,
  cast: CastSet,
  language: string,
  ageRange?: { min: number; max: number },
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const isDE = language === "de";
  const ageMax = ageRange?.max ?? 12;

  const ch1 = draft.chapters[0];
  if (!ch1) return issues;
  const text = ch1.text;
  const sentences = splitSentences(text);
  if (sentences.length < 3) return issues;
  const firstSentence = sentences[0] || "";

  // Check first 3 sentences for action-heavy verbs that suggest in-medias-res
  const first3 = sentences.slice(0, 3).join(" ");
  const actionHeavyPatterns = isDE
    ? [
      /\b(?:rannte|floh|kämpfte|schrie|stürmte|jagte|hetzte|raste|hastete|flüchtete)\b/i,
    ]
    : [
      /\b(?:ran|fled|fought|screamed|stormed|chased|rushed|raced|hurried|escaped)\b/i,
    ];

  const isActionOpening = actionHeavyPatterns.some(p => p.test(first3));

  // Check if characters are introduced (names mentioned in first half)
  const firstHalf = sentences.slice(0, Math.ceil(sentences.length / 2)).join(" ");
  const focusNames = getChildFocusNames(cast).length > 0
    ? getChildFocusNames(cast)
    : cast.avatars.map(a => a.displayName).filter(Boolean);
  const avatarsIntroduced = focusNames.filter(name => {
    const parts = name.toLowerCase().split(/\s+/).filter(p => p.length > 2);
    return parts.some(p => firstHalf.toLowerCase().includes(p));
  });
  const focusNameParts = focusNames
    .flatMap(name => name.toLowerCase().split(/\s+/))
    .filter(part => part.length > 2);
  const firstSentenceLower = firstSentence.toLowerCase();
  const firstSentenceHasFocusChild = focusNameParts.some(part => firstSentenceLower.includes(part));
  const firstSentenceHasDialogue = /^\s*(?:[""„«»“”'‘’]|[—–-]\s)/.test(firstSentence);
  const scenicOpeningPattern = isDE
    ? /^(?:vor dem|vor der|hinter dem|hinter der|im |in der |am |auf dem|auf der|zwischen|neben|unter|über dem|ueber dem|dort|da)\b/i
    : /^(?:in the|at the|by the|near the|behind the|before the|under the|over the|between|there)\b/i;
  const staticSceneVerbPattern = isDE
    ? /\b(?:lag|lagen|stand|standen|war|waren|begann|begannen|hing|hingen)\b/i
    : /\b(?:lay|stood|was|were|began|hung)\b/i;

  if (isActionOpening && avatarsIntroduced.length < focusNames.length) {
    issues.push({
      gate: "CH1_ORIENTATION",
      chapter: ch1.chapter,
      code: "CH1_IN_MEDIAS_RES",
      message: isDE
        ? `Kapitel 1 beginnt mitten in der Aktion, bevor die Figuren vorgestellt wurden. Kapitel 1 muss zuerst WER und WO etablieren.`
        : `Chapter 1 starts mid-action before characters are introduced. Chapter 1 must first establish WHO and WHERE.`,
      severity: ageMax <= 8 ? "ERROR" : "WARNING",
    });
  }

  if (
    scenicOpeningPattern.test(firstSentenceLower)
    && staticSceneVerbPattern.test(firstSentence)
    && !firstSentenceHasFocusChild
    && !firstSentenceHasDialogue
  ) {
    issues.push({
      gate: "CH1_ORIENTATION",
      chapter: ch1.chapter,
      code: "CH1_STATIC_SCENIC_OPENING",
      message: isDE
        ? "Kapitel 1 beginnt mit einer statischen Kulisse ohne Kind-Anker. Fuer 6-8 jaehrige Leser darf der Auftakt ruhig sein, muss aber sofort zum Kind oder zum sichtbaren Problem fuehren."
        : "Chapter 1 opens with static scenery and no child anchor. For ages 6-8 the opening may be calm, but it must immediately point to the child or the visible problem.",
      severity: ageMax <= 8 ? "WARNING" : "WARNING",
    });
  }

  // Check if location/world is established (sensory words in first 5 sentences)
  const first5 = sentences.slice(0, 5).join(" ");
  const sensoryPatterns = isDE
    ? /\b(?:roch|duftete|klang|leuchtete|glänzte|schimmerte|warm|kalt|dunkel|hell|still|laut|weich|rau|feucht|trocken|klein|groß|alt|neu|Haus|Hütte|Dorf|Stadt|Wald|Garten|Zimmer|Küche|Straße|Weg|Wiese)\b/i
    : /\b(?:smelled|sounded|glowed|shone|warm|cold|dark|bright|quiet|loud|soft|rough|damp|dry|small|big|old|new|house|cottage|village|town|forest|garden|room|kitchen|street|path|meadow)\b/i;
  const groundedWorldCuePattern = isDE
    ? /\b(?:Huette|Hütte|Kueche|Küche|Straße|Tuer|Tür|Brunnen|Tisch|Feuer|Fenster|Licht|Schatten)\b/i
    : /\b(?:door|window|table|fire|light|shadow|bridge|well)\b/i;
  const hasGroundedWorldCue = sensoryPatterns.test(first5) || groundedWorldCuePattern.test(first5);
  const worldGroundingMessage = isDE
    ? "Kapitel 1: Die Welt/der Ort wird nicht klar genug verankert. Fuege 1-2 konkrete Ortsanker hinzu, am besten Klang, Licht, Oberflaeche oder ein sichtbares Problem statt Geruch."
    : "Chapter 1: The world/setting is not grounded clearly enough. Add 1-2 concrete place cues, preferably sound, light, texture, or a visible problem instead of smell.";

  if (!hasGroundedWorldCue) {
    issues.push({
      gate: "CH1_ORIENTATION",
      chapter: ch1.chapter,
      code: "CH1_WORLD_MISSING",
      message: worldGroundingMessage || (isDE
        ? `Kapitel 1: Die Welt/der Ort wird nicht sinnlich beschrieben. Füge mindestens 1-2 Sinnesdetails hinzu (Geruch, Klang, Temperatur).`
        : `Chapter 1: The world/setting is not sensorily described. Add at least 1-2 sensory details (smell, sound, temperature).`),
      severity: "WARNING",
    });
  }

  return issues;
}

export function runQualityGates(input: {
  draft: StoryDraft;
  directives: SceneDirective[];
  cast: CastSet;
  language: string;
  ageRange?: { min: number; max: number };
  wordBudget?: WordBudget;
  artifactArc?: ArtifactArcPlan;
  humorLevel?: number;
}): QualityReport {
  const { draft, directives, cast, language, ageRange, wordBudget, artifactArc, humorLevel } = input;

  const gateRunners: Array<{ name: string; fn: () => QualityIssue[] }> = [
    { name: "LENGTH_PACING", fn: () => gateLengthAndPacing(draft, wordBudget) },
    { name: "CHAPTER_STRUCTURE", fn: () => gateChapterStructure(draft, language) },
    { name: "DIALOGUE_QUOTE", fn: () => gateDialogueQuote(draft, language, ageRange) },
    { name: "CHARACTER_INTEGRATION", fn: () => gateCharacterIntegration(draft, directives, cast, language) },
    { name: "CHARACTER_FOCUS", fn: () => gateCharacterFocusLoad(draft, directives, cast, language, ageRange) },
    { name: "GLOBAL_CHARACTER_LOAD", fn: () => gateGlobalCharacterLoad(draft, directives, cast, language, ageRange) },
    { name: "CAST_LOCK", fn: () => gateCastLock(draft, cast, language) },
    { name: "REPETITION_LIMITER", fn: () => gateRepetitionLimiter(draft, language, ageRange) },
    { name: "TEMPLATE_PHRASES", fn: () => gateTemplatePhrases(draft, language) },
    { name: "READABILITY_COMPLEXITY", fn: () => gateReadabilityComplexity(draft, language, ageRange) },
    { name: "RHYTHM_VARIATION", fn: () => gateRhythmVariation(draft, language, ageRange) },
    { name: "POETIC_DENSITY", fn: () => gatePoeticDensity(draft, language, ageRange) },
    { name: "TELL_PATTERN", fn: () => gateTellPatternOveruse(draft, language, ageRange) },
    { name: "CHARACTER_VOICE", fn: () => gateCharacterVoiceDistinctness(draft, directives, cast, language, ageRange) },
    { name: "STAKES_LOWPOINT", fn: () => gateStakesAndLowpoint(draft, language, ageRange) },
    { name: "CHILD_EMOTION_ARC", fn: () => gateChildEmotionArc(draft, cast, language, ageRange) },
    { name: "IMAGERY_BALANCE", fn: () => gateImageryBalance(draft, language, ageRange) },
    { name: "TENSION_ARC", fn: () => gateTensionArc(draft, language) },
    { name: "ARTIFACT_ARC", fn: () => gateArtifactArc(draft, directives, cast, language) },
    { name: "ENDING_PAYOFF", fn: () => gateEndingPayoff(draft, directives, language, ageRange) },
    { name: "TEXT_ARTIFACTS", fn: () => gateTextArtifacts(draft, language, ageRange) },
    { name: "INSTRUCTION_LEAK", fn: () => gateInstructionLeak(draft, language) },
    { name: "META_FORESHADOW", fn: () => gateMetaForeshadowPhrases(draft, language, ageRange) },
    { name: "SHOW_DONT_TELL_EXPOSITION", fn: () => gateRuleExpositionTell(draft, language, ageRange) },
    { name: "NARRATIVE_META", fn: () => gateNarrativeSummaryMeta(draft, language, ageRange) },
    { name: "NARRATIVE_NATURALNESS", fn: () => gateNarrativeNaturalness(draft, language, ageRange) },
    { name: "APPEARANCE_CONTINUITY", fn: () => gateAppearanceContinuity(draft, cast, language) },
    { name: "SCENE_CONTINUITY", fn: () => gateSceneContinuity(draft, language, ageRange) },
    // V2 Quality Gates
    { name: "CANON_FUSION", fn: () => gateCanonFusion(draft, cast, language) },
    { name: "ACTIVE_PRESENCE", fn: () => gateActivePresence(draft, directives, cast, language) },
    { name: "HUMOR_PRESENCE", fn: () => gateHumorPresence(draft, language, ageRange, humorLevel) },
    { name: "GIMMICK_LOOP", fn: () => gateGimmickLoopOveruse(draft, cast, language, ageRange) },
    { name: "ARTIFACT_MINI_ARC", fn: () => gateArtifactMiniArc(draft, cast, language, artifactArc) },
    // V7 Quality Gates — narrative structure
    { name: "CHILD_MISTAKE_ARC", fn: () => gateChildMistakeArc(draft, cast, language, ageRange) },
    { name: "CHAPTER_TRANSITION", fn: () => gateChapterTransitions(draft, language, ageRange) },
    { name: "CH1_ORIENTATION", fn: () => gateCh1Orientation(draft, cast, language, ageRange) },
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

  // Tiered scoring: gates have different max penalty caps based on reliability.
  // Noisy gates (CAST_LOCK, CHARACTER_VOICE) get lower caps to avoid false-positive score collapse.
  const GATE_MAX_PENALTY: Record<string, number> = {
    // Noisy gates with high false-positive rates: cap at 0.5
    CAST_LOCK: 0.5,
    // Structural gates: cap at 1 (important but can over-fire on style differences)
    CHARACTER_VOICE: 1,
    IMAGERY_BALANCE: 1,
    RHYTHM_VARIATION: 1,
    READABILITY_COMPLEXITY: 1,
    APPEARANCE_CONTINUITY: 1,
    SCENE_CONTINUITY: 1,
    NARRATIVE_NATURALNESS: 1,
    // All other gates: default cap at 2
  };
  const DEFAULT_MAX_PENALTY = 2;

  const gatePenalties = new Map<string, number>();
  for (const issue of allIssues) {
    const w = issue.severity === "ERROR" ? 1 : 0.5;
    gatePenalties.set(issue.gate, (gatePenalties.get(issue.gate) ?? 0) + w);
  }
  let totalPenalty = 0;
  for (const [gate, penalty] of gatePenalties) {
    const cap = GATE_MAX_PENALTY[gate] ?? DEFAULT_MAX_PENALTY;
    totalPenalty += Math.min(penalty, cap);
  }
  const score = Math.max(0, Math.min(10, 10 - totalPenalty));

  return { issues: allIssues, score, passedGates, failedGates };
}

export function buildRewriteInstructions(issues: QualityIssue[], language: string): string {
  if (issues.length === 0) return "";
  const isDE = language === "de";
  const issueCodes = new Set(issues.map(issue => issue.code));

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

  if (issueCodes.has("SENTENCE_COMPLEXITY_HIGH") || issueCodes.has("LONG_SENTENCE_OVERUSE") || issueCodes.has("VERY_LONG_SENTENCE")) {
    lines.push(isDE
      ? "- Lesbarkeit reparieren: JEDEN Satz ueber 14 Woerter aufteilen. Ziel: 4-10 Woerter pro Satz, hoechstens 15 % duerfen 14 erreichen. Rhythmus variieren: ein kurzer Satz (3-5 W.), dann ein mittlerer (6-10 W.), dann vielleicht ein laengerer (11-14 W.). Beispiel VORHER: 'Sie rannte durch den Wald und suchte den Stein, den der alte Mann ihr beschrieben hatte.' → NACHHER: 'Sie rannte los. Der Wald verschluckte sie. Irgendwo hier lag der Stein – der alte Mann hatte ihn genau beschrieben.'"
      : "- Fix readability: split only overloaded or clumsy sentences. Aim for natural read-aloud flow with short pressure beats and clear medium sentences. Longer lines are fine if they stay easy to carry aloud.");
  }
  if (issueCodes.has("SENTENCE_COMPLEXITY_HIGH") || issueCodes.has("LONG_SENTENCE_OVERUSE") || issueCodes.has("VERY_LONG_SENTENCE")) {
    lines.push(isDE
      ? "- Vorrang fuer natuerlichen Vorlese-Fluss: nicht mechanisch kuerzen. Teile nur die Saetze, die wirklich holpern, und behalte an ruhigen Stellen auch etwas laengere, klare Saetze."
      : "- Prioritize natural read-aloud flow over mechanical shortening. Split only the lines that genuinely stumble, and keep slightly longer clear sentences where they help.");
  }
  if (issueCodes.has("VOICE_INDISTINCT") || issueCodes.has("ROLE_LABEL_OVERUSE") || issueCodes.has("VOICE_TAG_FORMULA_OVERUSE")) {
    lines.push(isDE
      ? "- Figurenstimmen schaerfen: mindestens zwei klar erkennbare Sprecher pro Mehrfiguren-Szene, Rollenbezeichnungen und Formeln wie 'sagte ... kurz/knapp/leise' nicht stapeln."
      : "- Sharpen character voices: at least two clearly distinct speakers per multi-character scene, avoid repetitive formulas like 'said ... briefly/quietly'.");
  }
  if (issueCodes.has("DIALOGUE_RATIO_LOW") || issueCodes.has("DIALOGUE_RATIO_CRITICAL") || issueCodes.has("TOO_FEW_DIALOGUES")) {
    lines.push(isDE
      ? "- Mehr lebendige Interaktion einbauen: dort mehr direkte Rede setzen, wo Reibung, Waerme, Witz oder Hinweise entstehen. Nicht jeder Absatz braucht Dialog, aber ein Kapitel darf nicht ueberwiegend wie Bericht wirken."
      : "- Add more live interaction: use more direct speech where friction, warmth, humor, or clues emerge. Not every paragraph needs dialogue, but a chapter should not read mostly like report prose.");
  }
  if (issueCodes.has("POETIC_LANGUAGE_OVERLOAD")) {
    lines.push(isDE
      ? "- Sprache entdichten: weniger poetische Metaphern, mehr konkrete kindnahe Beobachtungen (Aktion, Gegenstand, einfacher Sinneseindruck)."
      : "- Reduce poetic density: fewer literary metaphors, more concrete child-facing observations (action, object, simple sensory cue).");
  }
  if (issueCodes.has("TELL_PATTERN_OVERUSE")) {
    lines.push(isDE
      ? "- Wiederholte Tell-Formeln aufbrechen (z. B. 'er spuerte', 'Stille fiel', 'innen zog sich'). Stattdessen Handlung + Dialog zeigen."
      : "- Break repetitive tell-formulas (e.g., 'he felt', 'silence fell'). Show via action + dialogue instead.");
  }
  if (issueCodes.has("TOO_MANY_ACTIVE_CHARACTERS") || issueCodes.has("FOCUS_DENSITY_HIGH")) {
    lines.push(isDE
      ? "- Figurenfokus enger setzen: fuer 6-8 Jahre maximal 3 aktive Figuren (sonst max 4); Nebenfiguren nur kurz im Hintergrund."
      : "- Tighten character focus: for age 6-8 use max 3 active characters (otherwise max 4); keep secondary figures in the background.");
  }
  if (issueCodes.has("GLOBAL_CAST_OVERLOAD")) {
    lines.push(isDE
      ? "- Gesamtcast verschlanken: fuer 6-8 Jahre maximal 4 aktiv erkennbare Figuren in der ganzen Geschichte. Kombiniere Rollen statt neue Figuren einzufuehren."
      : "- Slim down the overall cast: for age 6-8, use at most 4 actively distinct characters in the whole story. Merge roles instead of adding characters.");
  }
  if (issueCodes.has("UNLOCKED_CHARACTER_ACTOR")) {
    lines.push(isDE
      ? "- Cast-Lock strikt einhalten: entferne alle nicht erlaubten Eigennamen mit aktiver Rolle und ersetze sie durch erlaubte Figuren."
      : "- Enforce cast lock strictly: remove any unauthorized proper names with active roles and replace them with allowed characters.");
  }
  if (
    issueCodes.has("MISSING_EXPLICIT_STAKES") ||
    issueCodes.has("MISSING_LOWPOINT") ||
    issueCodes.has("LOWPOINT_EMOTION_THIN") ||
    issueCodes.has("LOWPOINT_TOO_SOFT") ||
    issueCodes.has("STAKES_TOO_ABSTRACT")
  ) {
    lines.push(isDE
      ? "- Dramaturgie reparieren: frueh klar benennen, was bei Scheitern konkret verloren geht, und in Kapitel 3/4 einen echten Tiefpunkt mit Gefuehlsreaktion zeigen."
      : "- Repair dramatic arc: state early what concrete thing is lost on failure and add a real low point with emotional reaction in chapter 3/4.");
  }
  if (
    issueCodes.has("RHYTHM_FLAT") ||
    issueCodes.has("RHYTHM_TOO_HEAVY") ||
    issueCodes.has("IMAGERY_DENSITY_HIGH") ||
    issueCodes.has("METAPHOR_OVERLOAD") ||
    issueCodes.has("COMPARISON_CLUSTER")
  ) {
    lines.push(isDE
      ? "- Sprachrhythmus variieren: kurze, mittlere und wenige laengere Saetze mischen; Bildsprache reduzieren (max. ein Vergleich pro Absatz)."
      : "- Vary language rhythm: mix short, medium, and only a few longer sentences; reduce imagery density (max one comparison per paragraph).");
  }
  if (issueCodes.has("BANNED_WORD_USED")) {
    lines.push(isDE
      ? "- Verbotene Fuellwoerter komplett entfernen (z. B. ploetzlich, irgendwie, ein bisschen, ziemlich, wirklich, sehr, Es war einmal)."
      : "- Remove banned filler words completely (e.g., suddenly, really).");
  }
  if (issueCodes.has("MISSING_INNER_CHILD_MOMENT") || issueCodes.has("NO_CHILD_ERROR_CORRECTION_ARC")) {
    lines.push(isDE
      ? "- Kinder-Emotionsbogen schaerfen: pro Hauptkind mindestens einen inneren Moment und mindestens einen Fehler->Korrektur-Bogen ausarbeiten."
      : "- Strengthen child emotional arc: each main child needs at least one inner moment and at least one mistake->correction beat.");
  }
  if (issueCodes.has("HUMOR_TOO_LOW")) {
    lines.push(isDE
      ? "- Humor gezielt erhoehen: baue kindgerechte Situationskomik und kurze Dialogwitze ein (keine Blossstellung, kein Zynismus)."
      : "- Increase humor deliberately: add child-friendly situational comedy and short dialogue wit (no humiliation, no sarcasm).");
  }
  if (issueCodes.has("GIMMICK_LOOP_CHAPTER") || issueCodes.has("GIMMICK_LOOP_OVERUSE") || issueCodes.has("GIMMICK_LOOP_BURST")) {
    lines.push(isDE
      ? "- Running Gags dosieren: gleiche Lautmalerei/Catchphrase sparsam nutzen (pro Kapitel nur wenige Einsaetze), sonst wirkt es wie Prompt-Loop."
      : "- Control running gags: use the same onomatopoeia/catchphrase sparingly (only a few uses per chapter), otherwise it reads like a prompt loop.");
  }
  if (
    issueCodes.has("CLIFFHANGER_ENDING") ||
    issueCodes.has("ENDING_UNRESOLVED") ||
    issueCodes.has("ENDING_WARMTH_MISSING") ||
    issueCodes.has("ENDING_PAYOFF_ABSTRACT") ||
    issueCodes.has("ENDING_PRICE_MISSING")
  ) {
    lines.push(isDE
      ? "- Schluss stabilisieren: keine neue Unsicherheit im letzten Abschnitt; Ende mit warmem Anker plus konkretem Gewinn und kleinem Preis/Kompromiss."
      : "- Stabilize ending: avoid new uncertainty in the final section; end with a warm anchor plus a concrete payoff and a small price/tradeoff.");
  }
  if (issueCodes.has("FILTER_PLACEHOLDER")) {
    lines.push(isDE
      ? "- Platzhalter reparieren: entferne alle Filter-/Redaktionsmarker (z. B. [inhalt-gefiltert]) und ersetze sie durch natuerliche, kindgerechte Formulierungen."
      : "- Fix placeholders: remove all filter/redaction markers (e.g., [content-filtered]) and replace them with natural, child-friendly phrasing.");
  }
  if (issueCodes.has("DRAFT_NOTE_LEAK")) {
    lines.push(isDE
      ? "- Entferne alle redaktionellen Klammernotizen (z. B. '(Lachmoment)', '[Draft]'). Erzahle diese Effekte nur als echte Szene."
      : "- Remove all editorial bracket notes (e.g., '(laugh moment)', '[draft]'). Express those effects only through real scene prose.");
  }
  if (issueCodes.has("META_LABEL_PHRASE") || issueCodes.has("META_FORESHADOW_PHRASE") || issueCodes.has("META_SUMMARY_SENTENCE")) {
    lines.push(isDE
      ? "- Entferne Meta-Vorschau- und Zusammenfassungs-Phrasen im Fliesstext (z. B. 'Der Ausblick:', 'Bald wuerden sie...', 'Die Konsequenz war klar', 'Der Preis?'). Uebergaenge muessen natuerlich klingen."
      : "- Remove meta preview and summary phrases in prose (e.g., 'The Outlook:', 'Soon they would...', 'The consequence was clear', 'The price?'). Transitions must read naturally.");
  }
  if (issueCodes.has("RULE_EXPOSITION_TELL")) {
    lines.push(isDE
      ? "- Regel-Erklaersaetze in Szene verwandeln: keine Lehrsatz-Form ('X zeigt..., X bedeutet...'). Zeige den Effekt durch konkrete Handlung + Reaktion + kurze Dialogzeile."
      : "- Convert rule-exposition into scene: no textbook lines ('X shows..., X means...'). Show effect through concrete action + reaction + short dialogue.");
  }
  if (
    issueCodes.has("PROTOCOL_STYLE_META") ||
    issueCodes.has("REPORT_STYLE_OVERUSE") ||
    issueCodes.has("PARAGRAPH_CHOPPY")
  ) {
    lines.push(isDE
      ? "- Protokollstil abbauen: keine Meta-Saetze wie 'Die Szene endete', keine Telegramm-Ketten ('Sie gingen. Sie machten ...'). Stattdessen Szene mit Ursache->Reaktion->Entscheidung in normalen Absaetzen."
      : "- Remove report style: no meta lines like 'The scene ended', no telegram chains ('They went. They did ...'). Use scene flow with cause->reaction->decision in normal paragraphs.");
  }
  if (issueCodes.has("ABRUPT_SCENE_SHIFT")) {
    lines.push(isDE
      ? "- Kontinuitaet reparieren: bei Orts-/Szenenwechsel einen sichtbaren Uebergangssatz setzen (Zeit/Bewegung/Ankunft), bevor neue Requisiten erscheinen."
      : "- Repair continuity: add a visible transition sentence for place/scene changes (time/movement/arrival) before introducing new props.");
  }
  if (issueCodes.has("GOAL_THREAD_WEAK_ENDING")) {
    lines.push(isDE
      ? "- Ende enger mit dem Anfangsziel verknuepfen: fuehre die Kernfrage/den Auftrag aus Kapitel 1-2 sichtbar zu Ende."
      : "- Reconnect ending with the opening goal: visibly close the core quest/question from chapters 1-2.");
  }
  if (issueCodes.has("TEXT_CONTROL_CHARS") || issueCodes.has("TEXT_MOJIBAKE") || issueCodes.has("TEXT_SPACED_TOKEN") || issueCodes.has("TEXT_ASCII_UMLAUT")) {
    lines.push(isDE
      ? "- Textartefakte vollstaendig entfernen: keine Steuerzeichen, keine Mojibake-Zeichenfolgen, keine auseinandergezogenen Tokens und keine ASCII-Umlaut-Umschriften."
      : "- Remove text artifacts completely: no control chars, no mojibake sequences, no spaced-out broken tokens, and no ASCII umlaut substitutions.");
  }

  const MAX_ISSUES_TOTAL = 14;
  let emittedIssues = 0;
  for (const [chapter, chIssues] of grouped) {
    if (emittedIssues >= MAX_ISSUES_TOTAL) break;
    if (chapter === 0) {
      lines.push(isDE ? "\nGesamte Geschichte:" : "\nOverall story:");
    } else {
      lines.push(isDE ? `\nKapitel ${chapter}:` : `\nChapter ${chapter}:`);
    }
    const remaining = MAX_ISSUES_TOTAL - emittedIssues;
    const chapterSlice = chIssues.slice(0, Math.max(1, Math.min(4, remaining)));
    for (const issue of chapterSlice) {
      const compactMessage = issue.message.length > 120
        ? `${issue.message.slice(0, 117).trimEnd()}...`
        : issue.message;
      lines.push(`  - [${issue.code}] ${compactMessage}`);
      emittedIssues += 1;
      if (emittedIssues >= MAX_ISSUES_TOTAL) break;
    }
  }
  if (issues.length > MAX_ISSUES_TOTAL) {
    lines.push(
      isDE
        ? `\nHinweis: ${issues.length - MAX_ISSUES_TOTAL} weitere Detailprobleme intern mitkorrigieren, ohne neue Regeln zu erfinden.`
        : `\nNote: also fix ${issues.length - MAX_ISSUES_TOTAL} additional detailed issues internally, without inventing new rules.`,
    );
  }

  return lines.join("\n");
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function hasAttributedDialogueForCharacter(text: string, name: string, language: string): boolean {
  if (!text || !name) return false;
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Use both ASCII and proper umlaut forms for robust matching
  const dialogueVerbsDE = "(?:sagte|fragte|fragen|rief|fl[üu]sterte|murmelte|antwortete|meinte|erkl[äa]rte|schrie|raunte|brummte|seufzte|lachte|nickte|sch[üu]ttelte|flehte|jammerte|jubelte|knurrte|zischte|hauchte|kr[äa]chzte|stotterte|stammelte|nuschelte|kicherte|grinste|schluchzte|wimmerte)";
  const dialogueVerbsEN = "(?:said|asked|called|whispered|muttered|answered|replied|shouted|laughed|nodded|grinned|cried|sobbed|mumbled|stammered|giggled)";
  const dialogueVerbs = language === "de" ? dialogueVerbsDE : dialogueVerbsEN;

  // Quote characters used in German text
  const q = `""\\u201E\\u201C\\u201D\\u00BB\\u00AB\\u201A\\u2018\\u2019`;

  const patterns = [
    // "Name sagte/fragte/..." within same sentence
    new RegExp(`${escapedName}[^.!?\\n]{0,60}${dialogueVerbs}`, "i"),
    // "sagte Name" within same sentence
    new RegExp(`${dialogueVerbs}[^.!?\\n]{0,30}${escapedName}`, "i"),
    // Quote followed by name attribution: „..." sagte Name
    new RegExp(`[${q}][^${q}]{3,160}[${q}][^.!?\\n]{0,40}${escapedName}`, "i"),
    // Name opens quote: Name: „..." or Name „..."
    new RegExp(`${escapedName}[^.!?\\n]{0,40}[${q}]`, "i"),
    // Name does action then speaks: Name tat etwas. „..."
    new RegExp(`${escapedName}[^\\n]{0,80}[.!?]\\s*[${q}]`, "i"),
    // Name thinks/feels (inner monologue counts as voice)
    new RegExp(`${escapedName}[^.!?\\n]{0,40}(?:dachte|[üu]berlegte|gr[üu]belte|fragte\\s+sich)`, "i"),
    new RegExp(`(?:dachte|[üu]berlegte|gr[üu]belte)\\s[^.!?\\n]{0,30}${escapedName}`, "i"),
  ];

  return patterns.some(pattern => pattern.test(text));
}

function countRoleLabelNamePairs(text: string): number {
  if (!text) return 0;
  const pattern = /\b(?:Feuerwehrfrau|Feuerwehrmann|Polizist|Polizistin|Lehrer|Lehrerin|Ritter|Hexe|Zauberer|Koenig|Koenigin)\s+[A-Z][a-z]+\b/g;
  const matches = text.match(pattern);
  return matches?.length ?? 0;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function getHardMinChapterWords(draft: StoryDraft, wordBudget?: WordBudget): number | null {
  if (!wordBudget) return null;
  const chapterCount = draft.chapters.length;
  const isMediumOrLong = wordBudget.minMinutes >= 8;
  if (chapterCount >= 4 && isMediumOrLong) return 220;
  if (chapterCount >= 3) return 160;
  return null;
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
}

function countDialogueLines(text: string): number {
  const quoteSegments = text.match(/["\u201E\u201C\u201D\u00BB\u00AB\u201A\u2018\u2019][^"\u201E\u201C\u201D\u00BB\u00AB\u201A\u2018\u2019]{2,160}["\u201E\u201C\u201D\u00BB\u00AB\u201A\u2018\u2019]/g)?.length ?? 0;
  const dashDialogues = text.match(/(?:^|\n)\s*[\u2014\u2013-]\s+.+/g)?.length ?? 0;
  const attributionVerbs = text.match(/(?:sagte|rief|fragte|fl(?:u|ue|ü)sterte|murmelte|antwortete|meinte|erkl(?:a|ae|ä)rte|schrie|raunte|brummte|seufzte|lachte|said|asked|whispered|called|shouted|replied|muttered|answered)\b/gi)?.length ?? 0;

  // Prefer concrete spoken turns (quotes + dash-dialogue). Attribution verbs are fallback support.
  const spokenTurns = quoteSegments + dashDialogues;
  if (spokenTurns > 0) return spokenTurns;
  return Math.max(0, Math.min(attributionVerbs, splitSentences(text).length));
}

function checkCharacterHasAction(text: string, name: string): boolean {
  if (!text || !name) return false;
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const actionPatterns = [
    new RegExp(`${escapedName}\\s+\\w+(?:te|t|en|ete|ierte|te sich)\\b`, "i"),
    new RegExp(`${escapedName}\\s+(?:rief|sagte|fragte|fluesterte|flüsterte|lachte|nickte|schüttelte|griff|nahm|hob|legte|stellte|drehte|sprang|rannte|ging|lief|schaute|blickte|laechelte|lächelte|stand|setzte|zog|drueckte|drückte|oeffnete|öffnete|schloss|warf|fing|hielt)\\b`, "i"),
    new RegExp(`[""\u201E\u201C\u201D\u00BB\u00AB][^""\u201E\u201C\u201D\u00BB\u00AB]+[""\u201E\u201C\u201D\u00BB\u00AB],?\\s*(?:sagte|rief|fragte|fluesterte|flüsterte|murmelte)\\s+${escapedName}`, "i"),
    new RegExp(`${escapedName}\\s+(?:said|asked|whispered|shouted|called|laughed|nodded|grabbed|took|lifted|placed|turned|jumped|ran|walked|looked|smiled|stood|sat|pulled|pushed|opened|closed|threw|caught|held)\\b`, "i"),
  ];

  if (actionPatterns.some(p => p.test(text))) return true;

  const quoteChars = "\"\u201E\u201C\u201D\u00BB\u00AB\u201A\u2018\u2019";
  const fallbackPatterns = [
    new RegExp(`${escapedName}[^.!?\\n]{0,70}\\b[\\p{L}]{4,}(?:te|ten|tet|t|st|en)\\b`, "iu"),
    new RegExp(`[${quoteChars}][^${quoteChars}]{2,180}[${quoteChars}][^.!?\\n]{0,45}${escapedName}`, "iu"),
    new RegExp(`${escapedName}[^.!?\\n]{0,45}[${quoteChars}]`, "iu"),
  ];
  if (fallbackPatterns.some(pattern => pattern.test(text))) return true;

  const loweredText = text.toLowerCase();
  const loweredName = name.toLowerCase();
  let matchIndex = loweredText.indexOf(loweredName);
  while (matchIndex !== -1) {
    if (isLikelyCharacterAction(text, name, matchIndex)) return true;
    matchIndex = loweredText.indexOf(loweredName, matchIndex + loweredName.length);
  }

  return false;
}

function isLikelyCharacterAction(text: string, name: string, matchIndex?: number): boolean {
  if (!text || !name) return false;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sentenceWindow = getSentenceWindowForName(text, matchIndex, 180);
  const speechVerbs = [
    "sagte", "rief", "fragte", "antwortete", "meinte", "fl[üu]sterte", "murmelte", "schrie",
    "said", "asked", "replied", "answered", "called", "whispered", "muttered", "shouted",
  ].join("|");
  const actionVerbs = [
    "lief", "ging", "sprang", "nickte", "zog", "dr[üu]ckte", "hob", "legte", "nahm", "griff", "zeigte", "lachte",
    "ran", "walked", "jumped", "nodded", "pulled", "pushed", "lifted", "placed", "took", "grabbed", "showed", "laughed",
  ].join("|");

  const nameThenVerb = new RegExp(`\\b${escaped}\\b\\s*(?:,\\s*)?(?:${speechVerbs}|${actionVerbs})\\b`, "i");
  if (nameThenVerb.test(sentenceWindow)) return true;

  const quoteThenAttribution = new RegExp(
    `[""\u201E\u201C\u201D\u00BB\u00AB][^""\u201E\u201C\u201D\u00BB\u00AB]{0,150}[""\u201E\u201C\u201D\u00BB\u00AB],?\\s*(?:${speechVerbs})\\s+\\b${escaped}\\b`,
    "i",
  );
  return quoteThenAttribution.test(sentenceWindow);
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

function extractGoalKeywords(text: string, language: string): string[] {
  const normalized = normalizeForComparison(text);
  if (!normalized) return [];
  const words = normalized.split(/\s+/).filter(Boolean);
  const stopwordsDE = new Set([
    "und", "oder", "aber", "dann", "wenn", "falls", "nicht", "keine", "einer", "einem", "einen",
    "eine", "der", "die", "das", "den", "dem", "des", "mit", "ohne", "fuer", "weil", "dass",
    "sowie", "auch", "noch", "nur", "sehr", "wird", "sind", "ist", "war", "sein", "ihre", "ihren",
    "ihrem", "seine", "seinen", "euch", "euer", "eure", "kapitel", "szene",
  ]);
  const stopwordsEN = new Set([
    "and", "or", "but", "then", "if", "when", "not", "with", "without", "for", "because", "that",
    "the", "a", "an", "this", "these", "those", "their", "there", "here", "from", "into", "about",
    "scene", "chapter",
  ]);
  const stopwords = language === "de" ? stopwordsDE : stopwordsEN;

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const word of words) {
    if (word.length < 5) continue;
    if (stopwords.has(word)) continue;
    if (seen.has(word)) continue;
    seen.add(word);
    unique.push(word);
    if (unique.length >= 10) break;
  }
  return unique;
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
    // ─── Articles, pronouns, conjunctions, prepositions ────────────────────
    "der", "die", "das", "ein", "eine", "aber", "und", "oder", "doch", "noch", "dann",
    "dort", "hier", "jetzt", "ganz", "schon", "auch", "nur", "mehr", "sehr", "viel",
    "alle", "andere", "weil", "wenn", "wie", "was", "wer", "vom", "zum",
    "mit", "bei", "nach", "vor", "aus", "auf", "für", "über", "durch", "ohne",
    "gegen", "unter", "neben", "zwischen", "hinter", "seit", "bis", "während",
    "sie", "ich", "wir", "ihr", "uns", "ihm", "ihn", "mir", "dir",
    "mein", "dein", "sein", "unser", "euer",
    "sich", "selbst", "einander", "jemand", "niemand", "etwas", "nichts",
    "alles", "manches", "jeder", "jede", "jedes",

    // ─── Time & nature ─────────────────────────────────────────────────────
    "morgen", "abend", "nacht", "tag", "stunde", "minute", "zeit", "moment",
    "anfang", "ende", "mitte", "morgens", "abends", "mittags",
    "wald", "berg", "see", "fluss", "meer", "ufer", "strand", "wiese", "feld",
    "haus", "hütte", "höhle",
    "stadt", "dorf", "weg", "pfad", "straße", "gasse", "brücke",
    "tor", "tür", "fenster", "boden", "decke", "dach", "wand", "mauer",
    "lichtung", "gebüsch", "gestrüpp", "dickicht", "waldrand", "wegrand",
    "küche", "stube", "flur", "veranda", "terrasse",
    "himmel", "sonne", "mond", "stern", "wolke", "nebel", "dunst",
    "wind", "regen", "schnee", "sturm", "gewitter", "blitz", "donner",
    "feuer", "wasser", "erde", "luft", "eis", "dampf", "rauch",
    "baum", "blume", "gras", "busch", "blatt", "ast", "wurzel", "moos", "pilz", "schilf",
    "stein", "fels", "kiesel", "sand", "lehm", "staub",
    "gold", "silber", "eisen", "kupfer", "bronze", "kristall", "diamant", "edelstein", "glas", "messing",
    "blech", "metall", "rost", "zinn",
    "licht", "schatten", "dunkelheit", "finsternis", "glanz", "schimmer", "strahl",
    "druck", "stoß", "ruck", "zug", "halt", "klang", "ton", "geräusch",

    // ─── Body & senses ─────────────────────────────────────────────────────
    "stimme", "hand", "herz", "auge", "augen", "kopf", "arm", "arme", "bein", "beine",
    "finger", "fuß", "füße", "nase", "mund", "ohr", "ohren", "haar", "haare",
    "schulter", "schultern", "brust", "rücken", "bauch", "knie", "stirn",
    "gesicht", "haut", "lippen", "zähne", "zunge", "kehle", "wange", "wangen",
    "atem", "blick", "träne", "tränen", "schweiß",

    // ─── Family & people (generic) ─────────────────────────────────────────
    "mama", "papa", "kind", "kinder", "freund", "freundin", "freunde",
    "bruder", "schwester", "vater", "mutter", "eltern", "großvater", "großmutter",
    "oma", "opa", "onkel", "tante", "nachbar", "nachbarin",
    "junge", "mädchen", "mann", "frau", "herr", "dame",
    "leute", "menschen", "volk", "gruppe", "truppe", "bande", "schar",
    "bewohner", "einwohner", "bürger", "fremder", "fremde", "wanderer", "reisender",

    // ─── Fairy tale roles (NOT names) ──────────────────────────────────────
    "koenig", "koenigin", "prinz", "prinzessin", "ritter", "hexe", "drache",
    "könig", "königin", "kaiser", "kaiserin",
    "zauberer", "zauberin", "fee", "feen", "elfe", "elfen",
    "zwerg", "zwerge", "riese", "riesen", "troll", "trolle",
    "held", "heldin", "helden", "wächter", "wächterin",
    "bote", "botin", "diener", "dienerin", "magd", "knecht",
    "räuber", "dieb", "bandit", "pirat", "schurke",
    "krieger", "kriegerin", "kämpfer", "soldat",
    "meister", "meisterin", "geselle", "lehrling",

    // ─── Buildings, places, furniture ──────────────────────────────────────
    "platz", "markt", "garten", "turm", "schloss", "burg", "palast", "tempel",
    "treppe", "stufe", "saal", "halle", "kammer", "zimmer", "raum",
    "thron", "kissen", "samtkissen", "tisch", "stuhl", "bank", "bett",
    "treppenhaus", "hof", "innenhof", "keller", "speicher", "dachboden",
    "werkstatt", "schmiede", "bäckerei", "laden", "marktplatz",
    "brunnen", "quelle", "teich", "wasserfall",
    "eingang", "ausgang", "durchgang", "tunnel", "passage",

    // ─── Objects & artifacts ───────────────────────────────────────────────
    "tagebuch", "brief", "zettel", "note", "buch", "karte", "rolle", "pergament",
    "seil", "kette", "schlüssel", "schloss", "riegel", "ring",
    "schwert", "schild", "bogen", "pfeil", "stab", "zauberstab",
    "amulett", "talisman", "medaillon", "anhänger", "armband",
    "krone", "helm", "rüstung", "umhang", "mantel", "kappe",
    "flasche", "kelch", "tasse", "schale", "korb", "beutel", "truhe", "dose",
    "spiegel", "lampe", "laterne", "fackel", "kerze",
    "glocke", "horn", "flöte", "trommel", "harfe",
    "feder", "tinte", "siegel", "stempel",
    "nadel", "faden", "schere", "hammer", "nagel", "werkzeug",
    "kompass", "lupe", "fernrohr", "fernglas", "lineal", "messer",
    "gehäuse", "plättchen", "rädchen", "hebel", "knopf", "taste",

    // ─── Food & drink ──────────────────────────────────────────────────────
    "brot", "brötchen", "kuchen", "suppe", "apfel", "beere", "beeren", "honig", "milch",
    "wein", "tee", "saft", "essen", "trinken", "mahl", "festmahl",

    // ─── Animals ───────────────────────────────────────────────────────────
    "hund", "katze", "pferd", "vogel", "vögel", "fisch", "bär",
    "wolf", "fuchs", "hase", "kaninchen", "maus", "ratte",
    "eule", "rabe", "adler", "falke", "schwan", "taube",
    "schlange", "frosch", "kröte", "spinne", "schmetterling",
    "eichhörnchen", "igel", "dachs", "hirsch", "reh",
    "einhorn", "greif", "phönix", "kobold",

    // ─── Emotions & abstract ───────────────────────────────────────────────
    "freude", "angst", "mut", "kraft", "liebe", "hoffnung", "glaube",
    "furcht", "schrecken", "sorge", "trauer", "wut", "zorn", "ärger",
    "glück", "pech", "stolz", "scham", "schuld", "ehre", "würde",
    "frieden", "ruhe", "stille", "geheimnis", "rätsel", "wunder",
    "vorsicht", "geduld", "ungeduld", "neugier", "eifersucht",
    "zauber", "magie", "fluch", "segen", "macht", "ohnmacht",
    "wahrheit", "lüge", "vertrauen", "zweifel", "geduld", "ungeduld",
    "freundschaft", "feindschaft", "abenteuer", "reise", "quest",
    "gefahr", "rettung", "hilfe", "rat", "plan", "idee", "trick",
    "versprechen", "schwur", "eid", "botschaft", "nachricht",

    // ─── Actions & states as nouns ─────────────────────────────────────────
    "stimme", "ruf", "schrei", "flüstern", "lachen", "weinen",
    "schritt", "sprung", "fall", "stoß", "schlag", "griff",
    "kampf", "flucht", "jagd", "suche", "wanderung",
    "schlaf", "traum", "erwachen", "arbeit", "spiel",
    "lied", "gesang", "tanz", "fest", "feier",
    "prüfung", "aufgabe", "probe", "beweis",
    "wort", "worte", "satz", "hinweis", "hinweise", "tropfen", "strich",
    "huf", "hufe", "pfote", "pfoten", "kralle", "krallen",
    "spannung", "erwartung", "aufregung", "erleichterung", "enttäuschung",
    "entscheidung", "bewegung", "richtung", "wendung", "ordnung",
    "entschuldigung", "erinnerung", "erklärung", "erzählung",
    "stoff", "rascheln", "knarzen", "klirren", "knistern", "rauschen",
    "flattern", "flirren", "flimmern", "brodeln", "blubbern", "zischen",
    "grollen", "summen", "brummen", "plätschern",

    // ─── Descriptive nouns (often capitalized at sentence start) ────────────
    "anfang", "beginn", "augenblick", "atemzug", "herzschlag",
    "gedanke", "erinnerung", "vorstellung", "eindruck",
    "antwort", "frage", "bitte", "dank", "gruß", "abschied",
    "seite", "rand", "ecke", "spitze", "grund", "tiefe", "höhe", "weite",
    "innere", "äußere", "obere", "untere", "vordere", "hintere",
    "richtung", "norden", "süden", "osten", "westen",
    "landschaft", "gegend", "umgebung", "horizont",
    "festival", "jahrmarkt", "markt", "fest",
    "kreis", "linie", "punkt", "form", "gestalt",
    "sonnenfleck", "mondlicht", "morgenlicht", "abendlicht",

    // ─── German compound-noun components & common story nouns ───────────────
    "geräusch", "gestalt", "erscheinung", "wesen", "kreatur",
    "verwandlung", "verzauberung", "verhexung", "beschwörung",
    "portal", "dimension", "teleportation",
    "zeichen", "symbol", "markierung", "spur", "spuren",
    "erkenntnis", "entdeckung", "offenbarung", "lösung",
    "hindernis", "herausforderung", "schwierigkeit",
    "belohnung", "schatz", "beute", "preis",
    "geschichte", "erzählung", "sage", "legende", "märchen",
    "dungeon", "labyrinth", "irrgarten",
    "schutz", "deckung", "versteck", "zuflucht",
    "energie", "funke", "flamme", "glut",

    // ─── Interjections & common sentence-start words ──────────────────────
    "puh", "ach", "nein", "ja", "halt", "stopp", "huch", "oh", "pst",
    "nicht", "ruhig", "schnell", "leise", "langsam", "vorsicht",
    "unsichtbar", "unsichtbares", "sichtbar", "sichtbares",
    "mist", "mensch", "herrje", "donnerwetter", "hoppla", "autsch",
    "tja", "nanu", "hm", "hmm", "psst", "bäh", "igitt",

    // ─── Imperative verb forms (often capitalized at sentence start) ─────
    "sag", "denk", "schau", "komm", "geh", "lauf", "nimm", "gib",
    "hilf", "ruf", "hör", "sieh", "pass", "warte", "bleib", "mach",
    "lass", "zeig", "stell", "leg", "setz", "zieh", "dreh", "spring",
    "halt", "fang", "wirf", "lies", "iss", "trink", "schlaf", "steh",
    "flieg", "schwimm", "kletter", "renn", "such", "find", "bring",
    "trag", "heb", "drück", "öffne", "schließ", "schneid",
    "weitermachen", "aufpassen", "aufhören", "anfangen", "weitergehen",
    "weiterlaufen", "weitersuchen", "weiterspielen",

    // ─── Common German compound-first-parts & story objects ─────────────
    "farn", "moos", "laub", "rinde", "harz", "holz", "holztisch",
    "zipfel", "fetzen", "stück", "splitter", "krümel",
    "latte", "brett", "planke", "rampe", "stufe",

    // ─── Materials, crafts & textile ────────────────────────────────────
    "faden", "fäden", "garn", "wolle", "seide", "stoff", "flicken",
    "nadel", "naht", "knoten", "spule", "spindel", "webstuhl",
    "nähte", "stiche", "stich", "muster", "geflecht", "gewebe",
    "zwirn", "schnur", "kordel", "litze", "borte", "saum",
    "glasfaden", "goldfaden", "silberfaden", "seidenfaden",

    // ─── Spices, food & kitchen ─────────────────────────────────────────
    "zimt", "pfeffer", "salz", "zucker", "mehl", "butter", "sahne",
    "vanille", "muskat", "nelke", "anis", "ingwer", "kardamom",
    "marmelade", "teig", "kruste", "krume", "scheibe", "bissen",

    // ─── Nature extended (plants, insects, weather) ─────────────────────
    "heu", "stroh", "klee", "distel", "ginster", "efeu", "flechte",
    "tanne", "tannen", "eiche", "birke", "buche", "linde", "kiefer", "fichte", "ahorn", "erle", "weide",
    "schlamm", "matsch", "pfütze", "dreck",
    "biene", "bienen", "hummel", "wespe", "käfer", "ameise", "ameisen",
    "raupe", "libelle", "grille", "zikade", "glühwürmchen",
    "spinnweben", "spinnwebe", "spinnennetz", "netz", "kokons", "kokon",
    "regentropfen", "schneeflocke", "schneeflocken", "eiszapfen",
    "wiesenblume", "wiesenblumen", "feldblume", "feldblumen",
    "sonnenblume", "sonnenblumen", "gänseblümchen", "kornblume",
    "löwenzahn", "kleeblatt", "vergissmeinnicht",
    "tau", "raureif", "frost", "hitze", "kühle", "wärme",
    "morgengrauen", "dämmerung", "abenddämmerung", "morgendämmerung",
    "mondschein", "sternenlicht", "sonnenschein",

    // ─── Body extended ──────────────────────────────────────────────────
    "brustkorb", "handgelenk", "fußgelenk", "ellbogen", "nacken",
    "wirbelsäule", "rippen", "magen", "lunge", "hals",
    "zeigefinger", "daumen", "handfläche", "fußsohle",
    "wimpern", "braue", "augenbraue", "augenbrauen",

    // ─── Everyday objects & places ──────────────────────────────────────
    "post", "brief", "paket", "karte", "papier", "blatt",
    "schuhe", "schuh", "stiefel", "socke", "socken",
    "hut", "mütze", "schal", "handschuh", "handschuhe",
    "brille", "uhr", "tasche", "rucksack", "koffer",
    "eimer", "schaufel", "besen", "lappen", "teppich",
    "vorhang", "gardine", "decke", "kissen", "polster",
    "dinge", "sachen", "kram", "zeug",
    "zettel", "zettelreste", "papiere", "notizen",

    // ─── Compound nouns (common in children's stories) ──────────────────
    "glitzerstaub", "sternenstaub", "feenstaub", "blütenstaub",
    "glitzerstücke", "glitzerstück", "glitzerfaden",
    "einschlafgeschichten", "einschlafgeschichte", "gutenachtgeschichte",
    "abenteuergeschichte", "tiergeschichte", "kindergeschichte",
    "mondlicht", "sternenlicht", "sonnenlicht", "kerzenlicht",
    "regenbogen", "wassertropfen", "tautropfen",
    "traumfänger", "windspiel", "klangspiel",
    "waldlichtung", "waldpfad", "waldweg", "feldweg",
    "dachboden", "dachfenster", "kellertür",
    "obstgarten", "kräutergarten", "blumengarten",
    "schmetterling", "schmetterlinge", "marienkäfer",
    "blumenwiese", "kräuterwiese", "sommerwiese",
    "zaubertrank", "zauberbuch", "zauberspruch",
    "schatzkarte", "schatzkiste", "schatztruhe",

    // ─── Additional story-common nouns (often false-positived) ──────────
    "perle", "perlen", "faust",
    "pollen", "notizbuch", "winkel", "flügel", "streifen",
    "gewicht", "windmühle", "vorstellung", "zahlen", "zahl",
    "basar", "leder", "hauch", "puls", "tinte", "tücher", "tuch",
    "petalen", "gang", "bücher", "gaben", "grad", "anzeige", "messung",
    "melodie", "melodien", "duft", "duftrichtung", "seitenpforte",
    "welt", "problem", "gleichgewicht", "sog", "leere", "panik",
    "konzentration", "rückkehrarbeit", "torbogen", "ärmel",
    "glaswasser", "brunnenrand", "mantel", "tasche", "manteltasche",
    "taschenkante", "taschenklappe", "tascheninnere",
    "spiegel", "band", "schale", "blüte", "blüten", "rose",
    "pfeile", "pfeil", "staubkörnchen", "seufzer",
    "boote", "boot", "glocke", "glockenspiele", "glockenschlag",
    "holzkiste", "kiste", "durchgang", "fackeln", "fackel",
    "warnlicht", "puzzleteil", "bedacht", "herzschlag",
    "fehler", "ruhe", "licht", "tee", "tassen", "tasse",
    "lineal", "skizze",
    "brunnenboden", "brunnen", "blatt", "blätter",
    "kloß", "zeichen", "schatten", "geruch",
    "gut", "stein", "raum", "pflicht", "wege",
    "gärten", "lieder", "richtung", "winde",
    "pflegen", "hegen", "kümmern",
    "kleine", "großes", "altes", "neues",
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
  if (set.has(word)) return true;

  // German plural/compound suffix stripping for better coverage
  if (language === "de" && word.length > 4) {
    // Common German plural suffixes: -en, -er, -n, -e, -s, -nen, -chen, -lein
    const stems = [
      word.replace(/chen$/, ""),    // Brötchen -> Brötch (no), but Häuschen -> Häus
      word.replace(/lein$/, ""),    // Büchlein -> Büch
      word.replace(/nen$/, ""),     // Bäuerinnen -> Bäueri
      word.replace(/en$/, ""),      // Blumen -> Blum, Straßen -> Straß
      word.replace(/er$/, ""),      // Bücher -> Büch, Kinder -> Kind
      word.replace(/e$/, ""),       // Bäume -> Bäum, Steine -> Stein
      word.replace(/n$/, ""),       // Uhren -> Uhre -> Uhr
      word.replace(/s$/, ""),       // Autos -> Auto
    ].filter(s => s.length >= 3);
    for (const stem of stems) {
      if (set.has(stem)) return true;
    }
    // Also check adding 'e' (Blumen -> Blume)
    const withE = word.replace(/en$/, "e");
    if (withE !== word && set.has(withE)) return true;
    // Umlaut de-mapping: ä→a, ö→o, ü→u (Blätter→blatter→blatt, Bäume→baume→baum)
    const deUmlaut = word.replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u");
    if (deUmlaut !== word) {
      if (set.has(deUmlaut)) return true;
      const umlautStems = [
        deUmlaut.replace(/chen$/, ""), deUmlaut.replace(/lein$/, ""),
        deUmlaut.replace(/en$/, ""), deUmlaut.replace(/er$/, ""),
        deUmlaut.replace(/e$/, ""), deUmlaut.replace(/n$/, ""),
        deUmlaut.replace(/s$/, ""),
      ].filter(s => s.length >= 3);
      for (const stem of umlautStems) {
        if (set.has(stem)) return true;
      }
    }

    // Compound noun detection: try splitting word at every position
    // If BOTH halves are known words, it's a compound noun (Glitzerstaub = Glitzer+Staub)
    if (word.length >= 6) {
      if (isGermanCompoundNoun(word, set)) return true;
      // Also try with de-umlauted version
      if (deUmlaut !== word && isGermanCompoundNoun(deUmlaut, set)) return true;
    }
  }

  return false;
}

/** Check if a word can be split into two known German root words (compound noun detection) */
function isGermanCompoundNoun(word: string, knownWords: Set<string>): boolean {
  // Common linking elements in German compound nouns
  const linkingElements = ["", "s", "n", "en", "er", "e", "es"];

  for (let splitPos = 3; splitPos <= word.length - 3; splitPos++) {
    const left = word.slice(0, splitPos);
    for (const link of linkingElements) {
      const rightStart = splitPos + link.length;
      if (rightStart >= word.length - 2) continue;
      if (word.slice(splitPos, rightStart) !== link) continue;
      const right = word.slice(rightStart);
      // Both parts must be known words (or known after de-umlauting/stemming)
      const leftKnown = knownWords.has(left)
        || knownWords.has(left.replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u"))
        || knownWords.has(left.replace(/e$/, ""))
        || knownWords.has(left.replace(/en$/, ""))
        || knownWords.has(left + "e");
      if (!leftKnown) continue;
      const rightKnown = knownWords.has(right)
        || knownWords.has(right.replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u"))
        || knownWords.has(right.replace(/e$/, ""))
        || knownWords.has(right.replace(/en$/, ""))
        || knownWords.has(right + "e");
      if (rightKnown) return true;
    }
  }
  return false;
}

function isLikelyGermanDescriptivePhrase(token: string): boolean {
  const parts = token
    .split(/\s+/)
    .map(part => part.trim().toLowerCase())
    .filter(Boolean);

  if (parts.length < 2) return false;

  const first = parts[0];
  const rest = parts.slice(1);
  const commonSceneNouns = new Set([
    "baum", "baeume", "bäume", "ast", "äste", "aeste", "wald", "waldweg", "tannen",
    "fichten", "moos", "schlucht", "bruecke", "brücke", "nacht", "schatten",
    "stille", "finsternis", "dunkelheit", "wind", "regen", "schnee", "wasser",
    "licht", "feuer", "erde", "himmel", "weg", "pfad", "haus", "stube",
  ]);

  const firstLooksDescriptive =
    isCommonWord(first, "de")
    || /(?:e|en|er|es|em|ig|lich|isch|sam|bar|los|voll)$/.test(first);
  if (!firstLooksDescriptive) return false;

  return rest.every(part =>
    isCommonWord(part, "de")
    || commonSceneNouns.has(part)
    || /(?:ung|heit|keit|nis|schaft|tum|chen|lein|licht|stein|wald|weg|pfad)$/.test(part),
  );
}

function isLikelyGermanGenitiveNounPhrase(parts: string[]): boolean {
  if (parts.length !== 2) return false;
  const [first, second] = parts;
  if (!/s$/.test(first)) return false;
  if (second.length < 4) return false;
  return (
    isCommonWord(second, "de")
    || /(?:ung|keit|heit|schaft|tion|nis|tum|erei|mut|blick|stimme|schritt|atem|herz|magen|hand|haende|hände|augen|kopf|idee|spur|karte|tasche|aufmerksamkeit)$/i.test(second)
  );
}

function isGermanCommonNounContext(text: string, matchIndex: number): boolean {
  const windowStart = Math.max(0, matchIndex - 60);
  const prefix = text.slice(windowStart, matchIndex).toLowerCase();
  const tokens = prefix.split(/[^a-zäöüß]+/).filter(Boolean);
  const prev = tokens[tokens.length - 1];
  const prevPrev = tokens[tokens.length - 2];
  if (!prev) return false;

  const articles = new Set([
    "der", "die", "das", "den", "dem", "des",
    "ein", "eine", "einen", "einem", "einer", "eines",
    "mein", "meine", "meinen", "meinem", "meiner", "meines",
    "sein", "seine", "seinen", "seinem", "seiner", "seines",
    "ihr", "ihre", "ihren", "ihrem", "ihrer", "ihres",
    "unser", "unsere", "unseren", "unserem", "unserer", "unseres",
    "euer", "eure", "euren", "eurem", "eurer", "eures",
    "dieser", "diese", "dieses", "diesen", "diesem",
    "jeder", "jede", "jedes", "jeden", "jedem",
    "mancher", "manche", "manches", "manchen", "manchem",
    "welcher", "welche", "welches", "welchen", "welchem",
    "kein", "keine", "keinen", "keinem", "keiner", "keines",
    "aller", "alle", "alles", "allen", "allem",
  ]);

  // Direct article/possessive before the word → common noun
  if (articles.has(prev)) return true;

  // Preposition + article pattern: "in der Burg", "auf dem Weg", "an den Rand"
  const prepositions = new Set([
    "in", "an", "auf", "aus", "bei", "mit", "nach", "von", "zu",
    "über", "unter", "vor", "hinter", "neben", "zwischen", "durch",
    "für", "gegen", "ohne", "um", "bis", "seit", "während", "trotz", "wegen",
  ]);
  if (prepositions.has(prev)) return true;
  if (prevPrev && prepositions.has(prevPrev) && articles.has(prev)) return true;

  // Adjective ending patterns before the word: "große Burg", "alten Baum", "magisches Amulett"
  const adjEndings = /(?:er|es|em|en|e)$/;
  if (prev && adjEndings.test(prev) && prevPrev && (articles.has(prevPrev) || prepositions.has(prevPrev))) return true;

  // Number words before nouns: "drei Brücken", "erste Stufe"
  const numberWords = new Set([
    "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn",
    "elf", "zwölf", "hundert", "tausend", "viele", "einige", "mehrere", "wenige",
    "erste", "zweite", "dritte", "vierte", "fünfte", "letzte", "nächste",
  ]);
  if (numberWords.has(prev)) return true;

  return false;
}

function isLikelyGermanNameCandidate(text: string, token: string, matchIndex: number): boolean {
  const normalized = token.trim();
  if (!normalized) return false;
  const lc = normalized.toLowerCase();

  // If the word (or its stem) is a known common noun, NEVER treat it as a name
  if (isCommonWord(lc, "de")) return false;

  // German adjectives/adverbs with these suffixes are NEVER names
  if (/(?:lich|ig|isch|sam|bar|haft|los|voll|weise|wärts)$/.test(lc)) return false;

  // German common noun suffixes — words ending in these are NEVER character names
  if (/(?:ung|heit|keit|schaft|nis|tum|chen|lein|werk|zeug|stück|stücke)$/.test(lc)) return false;

  // German compound noun suffixes — these endings strongly indicate common nouns
  if (/(?:staub|tropfen|blume|blumen|licht|korb|weben|netz|geschichten|geschichte|stein|steine|garten|wiese|faden|fäden|stiche|reste|flug|stücke|wasser|feuer|rand)$/.test(lc)) return false;

  // Sentence-initial check BEFORE repeat count — German capitalizes every sentence start
  if (isLikelySentenceStart(text, matchIndex)) {
    const prefix = text.slice(Math.max(0, matchIndex - 28), matchIndex).toLowerCase();
    if (!/(herr|frau|prinz|prinzessin|k(?:oe|ö)nig|k(?:oe|ö)nigin|ritter|fee|hexe|zauberer)\s+$/.test(prefix)) {
      return false;
    }
  }

  // Non-sentence-initial repeated words are likely real character references
  if (countWordOccurrences(text, normalized) >= 2) return true;

  return true;
}

function countWordOccurrences(text: string, word: string): number {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = text.match(new RegExp(`\\b${escaped}\\b`, "gi"));
  return matches ? matches.length : 0;
}

function isLikelySentenceStart(text: string, index: number): boolean {
  let i = index - 1;
  while (i >= 0 && /\s/.test(text[i])) i--;
  if (i < 0) return true;
  return /[.!?\n]/.test(text[i]);
}

function isLikelyQuotedSpeechPhrase(text: string, token: string, matchIndex: number): boolean {
  const startQuote = text.lastIndexOf('"', matchIndex);
  if (startQuote === -1) return false;
  const endQuote = text.indexOf('"', matchIndex + token.length);
  if (endQuote === -1) return false;
  if (startQuote > matchIndex || endQuote < matchIndex + token.length) return false;

  const quoted = text.slice(startQuote + 1, endQuote).trim();
  if (!quoted.includes(token)) return false;

  const before = text.slice(Math.max(0, startQuote - 24), startQuote);
  const after = text.slice(endQuote + 1, Math.min(text.length, endQuote + 40));
  const looksLikeSpeakerAttribution = /\b(sagte|rief|fragte|murmelte|knurrte|antwortete|flüsterte|kicherte|brüllte|meinte)\b/i.test(after)
    || /\b(sagte|rief|fragte|murmelte|knurrte|antwortete|flüsterte|kicherte|brüllte|meinte)\b/i.test(before);
  if (looksLikeSpeakerAttribution) return false;

  return quoted.split(/\s+/).length <= 3;
}

function isLikelyGermanSignPhrase(text: string, token: string, matchIndex: number): boolean {
  const normalized = token.trim();
  if (!normalized) return false;

  const parts = normalized
    .split(/\s+/)
    .map(part => part.trim().toLowerCase())
    .filter(Boolean);
  if (parts.length === 0 || parts.length > 4) return false;

  const window = text
    .slice(Math.max(0, matchIndex - 48), Math.min(text.length, matchIndex + normalized.length + 48))
    .toLowerCase();
  if (!/\b(schild|aufschrift|darauf|darunter|stand|steht|standen|las|lesen|gelesen|warnte|verboten)\b/.test(window)) {
    return false;
  }

  return parts.every(part =>
    isCommonWord(part, "de")
    || /(?:e|en|er|es|em|ig|lich|isch|sam|bar|los|voll|t)$/.test(part),
  );
}

function shouldFlagUnlockedName(text: string, token: string, matchIndex: number, language: string): boolean {
  if (language !== "de") return true;

  const normalized = token.trim();
  if (!normalized) return false;

  if (/\s+/.test(normalized)) return true;

  if (hasGermanNameHonorificPrefix(text, matchIndex)) return true;

  if (isLikelyCharacterAction(text, token, matchIndex)) return true;

  return false;
}

function hasGermanNameHonorificPrefix(text: string, matchIndex: number): boolean {
  const prefix = text.slice(Math.max(0, matchIndex - 24), matchIndex).toLowerCase();
  return /\b(herr|frau|prinz|prinzessin|k(?:oe|ö)nig|k(?:oe|ö)nigin|ritter|fee|hexe|zauberer|kobold)\s+$/.test(prefix);
}

function getSentenceWindowForName(text: string, matchIndex: number | undefined, maxChars: number): string {
  if (!text) return "";
  if (typeof matchIndex !== "number" || matchIndex < 0) {
    return text.slice(0, Math.min(text.length, maxChars));
  }
  const half = Math.max(40, Math.floor(maxChars / 2));
  const start = Math.max(0, matchIndex - half);
  const end = Math.min(text.length, matchIndex + half);
  return text.slice(start, end);
}

