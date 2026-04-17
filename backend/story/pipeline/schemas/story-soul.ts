/**
 * Story Soul Schema (Stage 0 – vor Blueprint)
 *
 * Die Soul ist das Herz einer Kindergeschichte: Premise, Hook, emotionale Stakes,
 * Figur-Fingerabdrücke, Welt-Textur und Payoff-Versprechen. Wird vor dem Blueprint
 * erzeugt und von einem Validator geprüft. Wenn die Soul nicht trägt, wird nichts
 * geschrieben – denn der Writer kann nicht reparieren, was in der Seele fehlt.
 *
 * Siehe STORY_QUALITY_RADICAL_PLAN.md Abschnitt 4 für die Hintergrund-Begründung.
 */

export type StorySoulCharacterRole =
  | "protagonist"
  | "partner"
  | "antagonist"
  | "helper"
  | "comic-relief"
  | "mentor";

export type StorySoulSupportPurpose =
  | "comic-relief"
  | "mentor"
  | "trickster"
  | "emotional-mirror";

export type StorySoulAntagonismType =
  | "internal"
  | "external"
  | "social"
  | "nature";

export type StorySoulHumorType =
  | "misunderstanding"
  | "slapstick"
  | "dry-observation"
  | "callback"
  | "absurd-literal";

export type StorySoulChapterEndingType =
  | "emotional-cliffhanger"
  | "info-cliffhanger"
  | "punchline"
  | "warm-pause";

export interface StorySoulEmotionalStakes {
  /** Was konkret verloren geht (Objekt, Person, Ritual) */
  what: string;
  /** Warum es emotional wichtig ist – Beziehung, Ritual, Erinnerung */
  why: string;
  /** Wer im Personenfeld am meisten fühlt und warum */
  whoCares: string;
}

export interface StorySoulWorldTexture {
  /** Exakt 3 konkrete Welt-Anker (nicht "Wald", sondern "Krümelwald hinter Omas Bäckerei") */
  anchors: [string, string, string];
  /** Sinneseindrücke: Geruch, Ton, Haptik */
  senseDetails: string;
  /** Name des zentralen Ortes */
  placeName: string;
}

export interface StorySoulCharacterFingerprint {
  name: string;
  role: StorySoulCharacterRole;
  /** Die zentrale Macke – muss in Ch1 riechbar sein */
  coreMacke: string;
  /** Wiederkehrender Gag über die Kapitel hinweg */
  runningGag: string;
  /** Wörter, die diese Figur liebt – müssen tatsächlich im Text vorkommen */
  favoriteWords: string[];
  /** Wörter, die diese Figur NIE sagt */
  tabooWords: string[];
  /** Körpersprache-Tell (statt "fühlte Angst") */
  bodyTell: string;
  /** Innerer Wunsch (unterschwellig im Text) */
  wantIneedle: string;
  /** Innere Angst (Gegenstück zum Wunsch) */
  fearInternal: string;
  /** EIN konkretes Beispiel-Dialog der Figur – bindend für Ton */
  voiceExample: string;
}

export interface StorySoulSupportingCharacter {
  name: string;
  purpose: StorySoulSupportPurpose;
  /** In welchem Kapitel erscheint sie zum ersten Mal – PFLICHT wenn auf Cover */
  firstAppearanceChapter: number;
  /** Die charakteristische Handlung – muss im Text realisiert werden */
  signaturAction: string;
  /** Kurze Beschreibung (Optik, Haltung) */
  description: string;
}

export interface StorySoulPayoffPromise {
  /** Wie FÜHLT sich Ch5 an – nicht was passiert. */
  emotionalLanding: string;
  /** Wie sich das Kind verändert hat – beobachtbar */
  transformationOfChild: string;
  /** Das letzte Bild – konkret, filmisch */
  finalImage: string;
  /** Ein konkretes Element aus Ch1, das in Ch5 anders/erfüllt auftaucht */
  callbackFromChapter1: string;
}

export interface StorySoulAntagonism {
  type: StorySoulAntagonismType;
  /** Konkret: wer/was steht dem Kind im Weg und warum */
  specific: string;
  /** Wie und in welchem Kapitel löst sich das */
  resolvesHow: string;
  /**
   * Kapitelnummern (mindestens 2), in denen der Antagonist physisch auftritt
   * oder seine Wirkung unmittelbar sichtbar ist (Spur, Geräusch, Geruch, Zeuge,
   * Schaden). Reine Erwähnung reicht NICHT.
   */
  appearsInChapters: number[];
  /**
   * Die eine Szene, in der die angedrohte Bedrohung einmal tatsächlich eintritt
   * (kurz, für Altersgruppe passend): Kapitel + konkretes Ereignis.
   * Ohne dieses Einlösen fühlen sich Stakes unecht an.
   */
  threatRealizedOnce: {
    chapter: number;
    what: string;
  };
}

export interface StorySoulBenchmark {
  /** Konkreter Buch-Titel als Referenz */
  title: string;
  /** Warum passt dieses Buch als Vorbild */
  whyMatch: string;
  /** Ein 1-2-Satz-Absatz als Ton-Referenz */
  voiceReference: string;
}

export interface StorySoulHumorBeat {
  chapter: number;
  type: StorySoulHumorType;
  /** Was konkret passiert – szenisch, nicht abstrakt */
  what: string;
  /**
   * Wörtliche Zeile (max 140 Zeichen), die der Writer im Kapitel verwenden MUSS.
   * Entweder ein gesprochener Dialog-Satz oder eine physische Aktion im Präsens.
   * Beispiel: "Adrian ruft 'Ich rieche Gefahr!' und springt hinter den Brunnen."
   */
  exactLine: string;
}

export interface StorySoulChapterEnding {
  chapter: number;
  type: StorySoulChapterEndingType;
  /** Wie endet das Kapitel – mit GEFÜHL, nicht nur Info */
  what: string;
}

/**
 * Die vollständige Story Soul. Alle Felder sind PFLICHT, sonst wird die
 * Soul vom Validator verworfen.
 */
export interface StorySoul {
  /** 1 Satz, den ein 7-Jähriger beim Abendessen nacherzählen würde */
  premise: string;

  /** Die brennende Frage, die nach Ch1 im Leser hängt – emotional, nicht info */
  hookQuestion: string;

  emotionalStakes: StorySoulEmotionalStakes;
  worldTexture: StorySoulWorldTexture;

  /** Fingerprints für die Hauptfiguren (mind. 2 bei 2 Avataren) */
  characterFingerprints: StorySoulCharacterFingerprint[];

  /** Alle Cover-Figuren MÜSSEN hier mit Rolle auftauchen */
  supportingCast: StorySoulSupportingCharacter[];

  payoffPromise: StorySoulPayoffPromise;
  antagonism: StorySoulAntagonism;
  benchmarkBook: StorySoulBenchmark;

  /** Humor-Beats pro Kapitel – konkret, szenisch */
  humorBeats: StorySoulHumorBeat[];

  /** Chapter-Endings 1..N-1 – emotionale Cliffhanger bevorzugt */
  chapterEndings: StorySoulChapterEnding[];

  /** Genau 3 ikonische, nachspielbare Szenen */
  iconicScenes: [string, string, string];
}

// ───────────────────────── Validator ─────────────────────────

export interface StorySoulValidationIssue {
  path: string;
  code: string;
  severity: "ERROR" | "WARNING";
  message: string;
}

export interface StorySoulValidationResult {
  valid: boolean;
  issues: StorySoulValidationIssue[];
  /** Die normalisierte Soul (wenn Struktur valid) */
  soul?: StorySoul;
}

const VALID_ROLES = new Set<StorySoulCharacterRole>([
  "protagonist", "partner", "antagonist", "helper", "comic-relief", "mentor",
]);

const VALID_SUPPORT_PURPOSES = new Set<StorySoulSupportPurpose>([
  "comic-relief", "mentor", "trickster", "emotional-mirror",
]);

const VALID_ANTAGONISM_TYPES = new Set<StorySoulAntagonismType>([
  "internal", "external", "social", "nature",
]);

const VALID_HUMOR_TYPES = new Set<StorySoulHumorType>([
  "misunderstanding", "slapstick", "dry-observation", "callback", "absurd-literal",
]);

const VALID_ENDING_TYPES = new Set<StorySoulChapterEndingType>([
  "emotional-cliffhanger", "info-cliffhanger", "punchline", "warm-pause",
]);

function isNonEmptyString(value: unknown, minLength = 3): value is string {
  return typeof value === "string" && value.trim().length >= minLength;
}

function pushError(issues: StorySoulValidationIssue[], path: string, code: string, message: string): void {
  issues.push({ path, code, severity: "ERROR", message });
}

function pushWarning(issues: StorySoulValidationIssue[], path: string, code: string, message: string): void {
  issues.push({ path, code, severity: "WARNING", message });
}

function validateCharacterFingerprint(
  fp: any,
  path: string,
  issues: StorySoulValidationIssue[],
  expectedNames?: Set<string>,
): void {
  if (!fp || typeof fp !== "object") {
    pushError(issues, path, "FINGERPRINT_MISSING", "Fingerprint fehlt oder ist kein Objekt.");
    return;
  }
  if (!isNonEmptyString(fp.name, 1)) pushError(issues, `${path}.name`, "NAME_EMPTY", "name ist leer.");
  if (expectedNames && fp.name && !expectedNames.has(String(fp.name))) {
    pushWarning(issues, `${path}.name`, "NAME_UNKNOWN", `name "${fp.name}" ist kein bekannter Avatar.`);
  }
  if (!VALID_ROLES.has(fp.role)) {
    pushError(issues, `${path}.role`, "ROLE_INVALID", `role muss eines von ${[...VALID_ROLES].join(", ")} sein.`);
  }
  if (!isNonEmptyString(fp.coreMacke, 10)) pushError(issues, `${path}.coreMacke`, "MACKE_TOO_SHORT", "coreMacke muss mind. 10 Zeichen haben.");
  if (!isNonEmptyString(fp.runningGag, 10)) pushError(issues, `${path}.runningGag`, "GAG_TOO_SHORT", "runningGag muss mind. 10 Zeichen haben.");
  if (!Array.isArray(fp.favoriteWords) || fp.favoriteWords.length === 0) {
    pushError(issues, `${path}.favoriteWords`, "FAVORITES_EMPTY", "favoriteWords muss mind. 1 Wort enthalten.");
  }
  if (!Array.isArray(fp.tabooWords)) {
    pushError(issues, `${path}.tabooWords`, "TABOO_MISSING", "tabooWords muss Array sein (darf leer sein).");
  }
  if (!isNonEmptyString(fp.bodyTell, 5)) pushError(issues, `${path}.bodyTell`, "BODYTELL_SHORT", "bodyTell ist zu dünn.");
  if (!isNonEmptyString(fp.wantIneedle, 5)) pushError(issues, `${path}.wantIneedle`, "WANT_SHORT", "wantIneedle ist zu dünn.");
  if (!isNonEmptyString(fp.fearInternal, 5)) pushError(issues, `${path}.fearInternal`, "FEAR_SHORT", "fearInternal ist zu dünn.");
  if (!isNonEmptyString(fp.voiceExample, 15)) pushError(issues, `${path}.voiceExample`, "VOICE_EXAMPLE_SHORT", "voiceExample muss ein konkreter Satz mit mind. 15 Zeichen sein.");
}

function validateSupportingCharacter(
  sc: any,
  path: string,
  issues: StorySoulValidationIssue[],
  chapterCount: number,
): void {
  if (!sc || typeof sc !== "object") {
    pushError(issues, path, "SUPPORT_MISSING", "supporting character fehlt oder kein Objekt.");
    return;
  }
  if (!isNonEmptyString(sc.name, 1)) pushError(issues, `${path}.name`, "NAME_EMPTY", "name ist leer.");
  if (!VALID_SUPPORT_PURPOSES.has(sc.purpose)) {
    pushError(issues, `${path}.purpose`, "PURPOSE_INVALID", `purpose muss eines von ${[...VALID_SUPPORT_PURPOSES].join(", ")} sein.`);
  }
  const chapter = Number(sc.firstAppearanceChapter);
  if (!Number.isFinite(chapter) || chapter < 1 || chapter > chapterCount) {
    pushError(issues, `${path}.firstAppearanceChapter`, "CHAPTER_OUT_OF_RANGE", `firstAppearanceChapter muss 1..${chapterCount} sein.`);
  }
  if (!isNonEmptyString(sc.signaturAction, 10)) pushError(issues, `${path}.signaturAction`, "ACTION_SHORT", "signaturAction zu dünn.");
  if (!isNonEmptyString(sc.description, 10)) pushError(issues, `${path}.description`, "DESCRIPTION_SHORT", "description zu dünn.");
}

export interface ValidateStorySoulInput {
  chapterCount: number;
  /** Avatar-Namen, die im characterFingerprints-Array erwartet werden */
  expectedAvatarNames?: string[];
  /** Namen von Cover-Figuren (z.B. aus Pool-Characters) die in supportingCast sein MÜSSEN */
  requiredCoverCastNames?: string[];
}

/**
 * Validiert eine rohe Soul (z.B. aus LLM-JSON). Strukturfehler → invalid.
 * Soft-Warnings (z.B. "Cover-Cast nicht genutzt") landen in issues mit WARNING.
 */
export function validateStorySoul(raw: unknown, input: ValidateStorySoulInput): StorySoulValidationResult {
  const issues: StorySoulValidationIssue[] = [];

  if (!raw || typeof raw !== "object") {
    pushError(issues, "$", "ROOT_NOT_OBJECT", "Soul-Root ist kein Objekt.");
    return { valid: false, issues };
  }

  const soul = raw as Partial<StorySoul>;

  if (!isNonEmptyString(soul.premise, 20)) pushError(issues, "premise", "PREMISE_TOO_SHORT", "premise muss ein ganzer, nacherzählbarer Satz sein (>=20 Zeichen).");
  if (!isNonEmptyString(soul.hookQuestion, 15)) pushError(issues, "hookQuestion", "HOOK_TOO_SHORT", "hookQuestion muss eine echte Frage sein (>=15 Zeichen).");

  // Emotional Stakes
  if (!soul.emotionalStakes || typeof soul.emotionalStakes !== "object") {
    pushError(issues, "emotionalStakes", "STAKES_MISSING", "emotionalStakes fehlt.");
  } else {
    const es = soul.emotionalStakes;
    if (!isNonEmptyString(es.what, 5)) pushError(issues, "emotionalStakes.what", "WHAT_SHORT", "what zu dünn.");
    if (!isNonEmptyString(es.why, 10)) pushError(issues, "emotionalStakes.why", "WHY_SHORT", "why zu dünn.");
    if (!isNonEmptyString(es.whoCares, 5)) pushError(issues, "emotionalStakes.whoCares", "WHOCARES_SHORT", "whoCares zu dünn.");
  }

  // World Texture
  if (!soul.worldTexture || typeof soul.worldTexture !== "object") {
    pushError(issues, "worldTexture", "WORLD_MISSING", "worldTexture fehlt.");
  } else {
    const wt = soul.worldTexture;
    const anchors = Array.isArray(wt.anchors) ? wt.anchors : [];
    if (anchors.length !== 3) {
      pushError(issues, "worldTexture.anchors", "ANCHORS_NOT_THREE", `Genau 3 anchors erforderlich (hat ${anchors.length}).`);
    } else {
      anchors.forEach((a, i) => {
        if (!isNonEmptyString(a, 10)) pushError(issues, `worldTexture.anchors[${i}]`, "ANCHOR_SHORT", "Anchor zu kurz (<10 Zeichen).");
      });
    }
    if (!isNonEmptyString(wt.senseDetails, 10)) pushError(issues, "worldTexture.senseDetails", "SENSE_SHORT", "senseDetails zu dünn.");
    if (!isNonEmptyString(wt.placeName, 3)) pushError(issues, "worldTexture.placeName", "PLACE_SHORT", "placeName zu kurz.");
  }

  // Character Fingerprints
  const expectedNameSet = input.expectedAvatarNames ? new Set(input.expectedAvatarNames) : undefined;
  if (!Array.isArray(soul.characterFingerprints) || soul.characterFingerprints.length < 1) {
    pushError(issues, "characterFingerprints", "FINGERPRINTS_MISSING", "Mindestens 1 characterFingerprint erforderlich.");
  } else {
    soul.characterFingerprints.forEach((fp, i) => {
      validateCharacterFingerprint(fp, `characterFingerprints[${i}]`, issues, expectedNameSet);
    });
    // Check that all expected avatar names have a fingerprint
    if (expectedNameSet) {
      const presentNames = new Set(soul.characterFingerprints.map(fp => String(fp.name || "")));
      for (const expected of expectedNameSet) {
        if (!presentNames.has(expected)) {
          pushError(issues, "characterFingerprints", "AVATAR_MISSING", `Avatar "${expected}" hat keinen Fingerprint.`);
        }
      }
    }
  }

  // Supporting Cast
  if (!Array.isArray(soul.supportingCast)) {
    pushError(issues, "supportingCast", "SUPPORT_NOT_ARRAY", "supportingCast muss Array sein (darf leer sein).");
  } else {
    soul.supportingCast.forEach((sc, i) => {
      validateSupportingCharacter(sc, `supportingCast[${i}]`, issues, input.chapterCount);
    });
    // Cover-Cast Check
    if (input.requiredCoverCastNames && input.requiredCoverCastNames.length > 0) {
      const presentSupportNames = new Set(soul.supportingCast.map(sc => String(sc.name || "").toLowerCase()));
      for (const required of input.requiredCoverCastNames) {
        if (!presentSupportNames.has(required.toLowerCase())) {
          pushError(issues, "supportingCast", "COVER_CAST_MISSING", `Cover-Figur "${required}" muss in supportingCast sein.`);
        }
      }
    }
  }

  // Payoff Promise
  if (!soul.payoffPromise || typeof soul.payoffPromise !== "object") {
    pushError(issues, "payoffPromise", "PAYOFF_MISSING", "payoffPromise fehlt.");
  } else {
    const pp = soul.payoffPromise;
    if (!isNonEmptyString(pp.emotionalLanding, 10)) pushError(issues, "payoffPromise.emotionalLanding", "LANDING_SHORT", "emotionalLanding zu dünn.");
    if (!isNonEmptyString(pp.transformationOfChild, 15)) pushError(issues, "payoffPromise.transformationOfChild", "TRANSFORMATION_SHORT", "transformationOfChild zu dünn.");
    if (!isNonEmptyString(pp.finalImage, 15)) pushError(issues, "payoffPromise.finalImage", "FINAL_IMAGE_SHORT", "finalImage zu dünn.");
    if (!isNonEmptyString(pp.callbackFromChapter1, 10)) pushError(issues, "payoffPromise.callbackFromChapter1", "CALLBACK_SHORT", "callbackFromChapter1 zu dünn.");
  }

  // Antagonism
  if (!soul.antagonism || typeof soul.antagonism !== "object") {
    pushError(issues, "antagonism", "ANTAGONISM_MISSING", "antagonism fehlt.");
  } else {
    const a = soul.antagonism;
    if (!VALID_ANTAGONISM_TYPES.has(a.type)) {
      pushError(issues, "antagonism.type", "ANTAGONISM_TYPE_INVALID", `type muss eines von ${[...VALID_ANTAGONISM_TYPES].join(", ")} sein.`);
    }
    if (!isNonEmptyString(a.specific, 15)) pushError(issues, "antagonism.specific", "ANTAGONISM_SPECIFIC_SHORT", "specific zu dünn.");
    if (!isNonEmptyString(a.resolvesHow, 15)) pushError(issues, "antagonism.resolvesHow", "ANTAGONISM_RESOLVE_SHORT", "resolvesHow zu dünn.");
    if (!Array.isArray(a.appearsInChapters) || a.appearsInChapters.length < 2) {
      pushError(issues, "antagonism.appearsInChapters", "ANTAGONISM_PRESENCE_TOO_THIN", "antagonism.appearsInChapters muss mindestens 2 Kapitel nennen (physische Präsenz, nicht nur Erwähnung).");
    } else {
      const invalid = a.appearsInChapters.filter(
        (c) => !Number.isFinite(Number(c)) || Number(c) < 1 || Number(c) > input.chapterCount,
      );
      if (invalid.length > 0) {
        pushError(issues, "antagonism.appearsInChapters", "ANTAGONISM_CHAPTER_RANGE", `Kapitelnummern müssen 1..${input.chapterCount} sein.`);
      }
    }
    if (!a.threatRealizedOnce || typeof a.threatRealizedOnce !== "object") {
      pushError(issues, "antagonism.threatRealizedOnce", "THREAT_REALIZATION_MISSING", "threatRealizedOnce fehlt – die angedrohte Bedrohung muss in einer konkreten Szene einmal wirklich eintreten.");
    } else {
      const tr = a.threatRealizedOnce;
      const trChapter = Number(tr.chapter);
      if (!Number.isFinite(trChapter) || trChapter < 1 || trChapter > input.chapterCount) {
        pushError(issues, "antagonism.threatRealizedOnce.chapter", "THREAT_CHAPTER_RANGE", `threatRealizedOnce.chapter muss 1..${input.chapterCount} sein.`);
      }
      if (!isNonEmptyString(tr.what, 20)) {
        pushError(issues, "antagonism.threatRealizedOnce.what", "THREAT_WHAT_SHORT", "threatRealizedOnce.what zu dünn – was genau tritt ein?");
      }
    }
  }

  // Benchmark
  if (!soul.benchmarkBook || typeof soul.benchmarkBook !== "object") {
    pushError(issues, "benchmarkBook", "BENCHMARK_MISSING", "benchmarkBook fehlt.");
  } else {
    const b = soul.benchmarkBook;
    if (!isNonEmptyString(b.title, 3)) pushError(issues, "benchmarkBook.title", "TITLE_SHORT", "benchmark title zu kurz.");
    if (!isNonEmptyString(b.whyMatch, 10)) pushError(issues, "benchmarkBook.whyMatch", "WHYMATCH_SHORT", "whyMatch zu dünn.");
    if (!isNonEmptyString(b.voiceReference, 20)) pushError(issues, "benchmarkBook.voiceReference", "VOICE_REF_SHORT", "voiceReference zu dünn.");
  }

  // Humor Beats
  if (!Array.isArray(soul.humorBeats) || soul.humorBeats.length < 2) {
    pushError(issues, "humorBeats", "HUMOR_TOO_FEW", "Mindestens 2 humorBeats erforderlich.");
  } else {
    soul.humorBeats.forEach((hb, i) => {
      if (!hb || typeof hb !== "object") {
        pushError(issues, `humorBeats[${i}]`, "BEAT_NOT_OBJECT", "humor beat kein Objekt.");
        return;
      }
      const chapter = Number(hb.chapter);
      if (!Number.isFinite(chapter) || chapter < 1 || chapter > input.chapterCount) {
        pushError(issues, `humorBeats[${i}].chapter`, "BEAT_CHAPTER_RANGE", `chapter muss 1..${input.chapterCount} sein.`);
      }
      if (!VALID_HUMOR_TYPES.has(hb.type)) {
        pushError(issues, `humorBeats[${i}].type`, "BEAT_TYPE_INVALID", `type muss eines von ${[...VALID_HUMOR_TYPES].join(", ")} sein.`);
      }
      if (!isNonEmptyString(hb.what, 15)) pushError(issues, `humorBeats[${i}].what`, "BEAT_WHAT_SHORT", "what zu dünn.");
      if (!isNonEmptyString(hb.exactLine, 10)) {
        pushError(issues, `humorBeats[${i}].exactLine`, "BEAT_EXACTLINE_MISSING", "exactLine fehlt – wörtliche Zeile (Dialog oder physische Aktion), die der Writer im Kapitel verwenden muss.");
      } else if (hb.exactLine.length > 160) {
        pushError(issues, `humorBeats[${i}].exactLine`, "BEAT_EXACTLINE_TOO_LONG", "exactLine zu lang (max 160 Zeichen – das ist eine Zeile, kein Absatz).");
      }
    });
  }

  // Chapter Endings (N-1, da letztes Kapitel kein Cliffhanger)
  if (!Array.isArray(soul.chapterEndings)) {
    pushError(issues, "chapterEndings", "ENDINGS_NOT_ARRAY", "chapterEndings muss Array sein.");
  } else {
    const expectedEndingCount = Math.max(0, input.chapterCount - 1);
    if (soul.chapterEndings.length < expectedEndingCount) {
      pushWarning(issues, "chapterEndings", "ENDINGS_COUNT_LOW", `${expectedEndingCount} endings erwartet (Cliffhänger pro Kapitel 1..${input.chapterCount - 1}), nur ${soul.chapterEndings.length} vorhanden.`);
    }
    soul.chapterEndings.forEach((ce, i) => {
      if (!ce || typeof ce !== "object") {
        pushError(issues, `chapterEndings[${i}]`, "ENDING_NOT_OBJECT", "ending kein Objekt.");
        return;
      }
      const chapter = Number(ce.chapter);
      if (!Number.isFinite(chapter) || chapter < 1 || chapter >= input.chapterCount) {
        pushError(issues, `chapterEndings[${i}].chapter`, "ENDING_CHAPTER_RANGE", `chapter muss 1..${input.chapterCount - 1} sein (letztes Kapitel bekommt Payoff, keinen Cliffhanger).`);
      }
      if (!VALID_ENDING_TYPES.has(ce.type)) {
        pushError(issues, `chapterEndings[${i}].type`, "ENDING_TYPE_INVALID", `type muss eines von ${[...VALID_ENDING_TYPES].join(", ")} sein.`);
      }
      if (!isNonEmptyString(ce.what, 15)) pushError(issues, `chapterEndings[${i}].what`, "ENDING_WHAT_SHORT", "what zu dünn.");
    });
    // Bias-Check: emotionale Cliffhanger bevorzugt
    const emotionalCount = soul.chapterEndings.filter((ce: any) => ce?.type === "emotional-cliffhanger").length;
    if (soul.chapterEndings.length >= expectedEndingCount && emotionalCount < Math.ceil(expectedEndingCount / 2)) {
      pushWarning(issues, "chapterEndings", "ENDINGS_TOO_INFORMATIONAL", "Zu wenige emotionale Cliffhanger – Mehrheit sollte emotional sein, nicht nur Info-Fragen.");
    }
  }

  // Iconic Scenes
  if (!Array.isArray(soul.iconicScenes) || soul.iconicScenes.length !== 3) {
    pushError(issues, "iconicScenes", "ICONIC_NOT_THREE", `Genau 3 iconicScenes erforderlich (hat ${Array.isArray(soul.iconicScenes) ? soul.iconicScenes.length : 0}).`);
  } else {
    soul.iconicScenes.forEach((scene, i) => {
      if (!isNonEmptyString(scene, 20)) pushError(issues, `iconicScenes[${i}]`, "ICONIC_SHORT", "iconic scene zu dünn.");
    });
  }

  const hasErrors = issues.some(i => i.severity === "ERROR");
  if (hasErrors) {
    return { valid: false, issues };
  }

  return {
    valid: true,
    issues,
    soul: soul as StorySoul,
  };
}

// ───────────────────────── Parser ─────────────────────────

/**
 * Extrahiert ein StorySoul-Objekt aus LLM-Output. Unterstützt:
 * - reines JSON
 * - JSON in ```json ... ```-Block
 * - JSON mit umschließendem `{ "soul": { ... } }`-Wrapper
 */
export function parseStorySoulFromLLM(raw: string): unknown {
  if (!raw || typeof raw !== "string") return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Try direct parse first
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object") {
      const maybeWrapped = (parsed as any).soul;
      if (maybeWrapped && typeof maybeWrapped === "object") return maybeWrapped;
      return parsed;
    }
  } catch {
    // fall through
  }

  // Try fenced code block
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    try {
      const parsed = JSON.parse(fenceMatch[1]);
      if (parsed && typeof parsed === "object") {
        const maybeWrapped = (parsed as any).soul;
        if (maybeWrapped && typeof maybeWrapped === "object") return maybeWrapped;
        return parsed;
      }
    } catch {
      // fall through
    }
  }

  // Try first balanced-brace block
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") {
        const maybeWrapped = (parsed as any).soul;
        if (maybeWrapped && typeof maybeWrapped === "object") return maybeWrapped;
        return parsed;
      }
    } catch {
      // fall through
    }
  }

  return null;
}

// ───────────────────────── Formatter ─────────────────────────

/**
 * Serialisiert die Soul als kompakten Prompt-Kontext (für Blueprint / Writer).
 * Behält die Struktur, aber komprimiert Whitespace.
 */
export function formatStorySoulForPrompt(soul: StorySoul): string {
  return JSON.stringify(soul, null, 2);
}

/**
 * Formatiert eine Validations-Issue-Liste als lesbarer Text (für Retry-Prompts).
 */
export function formatStorySoulIssues(issues: StorySoulValidationIssue[]): string {
  if (issues.length === 0) return "";
  const lines = issues.map(issue => `- [${issue.severity}] ${issue.path}: ${issue.message} (${issue.code})`);
  return lines.join("\n");
}
