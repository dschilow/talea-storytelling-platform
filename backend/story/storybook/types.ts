/**
 * Storybook Pipeline (storybook-v1) — shared types.
 *
 * Design rule for everything in this folder: the WRITER never sees screenplay
 * jargon. Words like "visibleDamage", "irreversibleChange" or "personalCost"
 * belong to the planner's vocabulary only. What reaches the prose model is
 * story language a human editor would use.
 */

import type { StoryConfig } from "../generate";

/** Which slot a pool character may fill. Declared by the premise, not by the AI. */
export type RoleNeed =
  | "gegenspieler"     // wants something that collides with the hero's want
  | "komplize"         // helps physically, never explains the solution
  | "skeptiker"        // doubts out loud, forces the hero to be concrete
  | "autoritaet"       // adult who can forbid or allow
  | "kleiner_helfer";  // tiny/animal figure, comic relief with one useful move

/**
 * The five comic engines that actually make 6-8 year olds laugh out loud.
 * Anything outside this list (irony, adult wordplay, wry narrator asides) is
 * charm, not comedy, and does not count.
 */
export type GagType =
  | "selbstbewusst_falsch"      // someone insists on something obviously wrong
  | "koerperliche_eskalation"   // a small mess becomes an absurd mess
  | "das_ding_hoert_nicht_auf"  // an object keeps doing its thing at the worst time
  | "erwachsener_merkt_nichts"  // grown-up misses what the child plainly sees
  | "woertlich_genommen";       // an instruction is followed to the letter

export interface PremiseOpponent {
  /** Which cast slot the opponent occupies. */
  roleNeed: RoleNeed;
  /** The opponent's OWN want. Never "is bored" — that produces no plot. */
  want: string;
}

export interface PremiseWonderRule {
  /** Physical, testable, describable by a child in one sentence. */
  rule: string;
  /**
   * The mandatory visible trace. Without this the magic does not exist for a
   * child. Countable traces ("ein Schnürsenkel wird kürzer") beat vague ones.
   */
  visibleSideEffect: string;
}

/**
 * A hand-written, child-playable premise. Novelty comes from the combinatorics
 * (premise x avatars x setting x cast x artifact), not from asking a model to
 * be original under a wall of banned words.
 */
export interface Premise {
  id: string;
  /** Working title pattern — the planner may rewrite it for the actual avatars. */
  workingTitle: string;
  genres: string[];
  settings: string[];
  ageBands: Array<"3-5" | "6-8" | "9-12">;

  /** ONE concrete sentence. Physical. Visible. */
  situation: string;
  /** What the child wants RIGHT NOW. Touchable. */
  childWant: string;
  /** What is concretely lost on failure. Never abstract. */
  whyItHurts: string;

  opponent: PremiseOpponent;
  wonderRule: PremiseWonderRule;

  /** Three beats. Each worse AND funnier than the one before. */
  escalation: [string, string, string];
  /** The same action as the setup, second time with higher stakes. */
  reversal: string;
  /** A physical thing the child gives up. Not a feeling. */
  price: string;
  /** The opening object, changed. */
  closingImage: string;

  gagType: GagType;
  /** Cast slots this premise can genuinely use. Empty slots stay empty. */
  roleNeeds: RoleNeed[];
  /** Most stories should be false. A decorative artifact confuses a child. */
  artifactSlot: boolean;
  /**
   * Variation axes. A bank of premises alone would eventually repeat itself and
   * a child who recognises the story is a child who stops listening. Each axis
   * is swapped independently, so one premise yields hundreds of distinct
   * surfaces without ever losing the structure that makes it work.
   */
  variants: PremiseVariants;
}

export interface PremiseVariants {
  /** The central object the whole story hangs on. */
  objekt: string[];
  /** The countable unit of the visible side effect ("acht Knoten", "sechs Perlen"). */
  einheit: string[];
  /** Where the three escalating beats play out. */
  arena: string[];
  /** Alternative wants for the opponent. */
  gegnerWunsch: string[];
  /** Alternative comic engines this premise can carry. */
  gag: GagType[];
}

/** One concrete draw from the variation axes. Stored so it is never repeated. */
export interface PremiseVariant {
  objekt: string;
  einheit: string;
  arena: string;
  gegnerWunsch: string;
  gag: GagType;
  /** Stable id of this exact combination, e.g. "schuhe-geradeaus:1-0-2-1-0". */
  key: string;
}

/** A premise plus the draw that makes this telling of it unique. */
export interface ResolvedPremise {
  premise: Premise;
  variant: PremiseVariant;
  /** Human-readable override lines handed to the planner. */
  directives: string[];
}

export interface StorybookCastMember {
  id: string;
  name: string;
  roleNeed: RoleNeed;
  /** One sentence a child understands: who this is. */
  whoTheyAre: string;
  /** This character's own want inside THIS story. */
  wants: string;
  catchphrase?: string;
  catchphraseContext?: string;
  speechStyle?: string[];
  quirk?: string;
  imageUrl?: string;
  visualProfile?: any;
  physicalDescription?: string;
  species?: string | null;
  ageCategory?: string | null;
}

export interface StorybookArtifact {
  id: string;
  name: string;
  nameEn?: string;
  description?: string;
  category?: string;
  rarity?: string;
  storyRole: string;
  visualKeywords: string[];
  emoji?: string;
  imageUrl?: string;
}

export interface StorybookHero {
  id?: string;
  name: string;
  age?: number | null;
  description?: string;
  imageUrl?: string;
  visualProfile?: any;
  physicalTraits?: any;
  personalityTraits?: any;
  narrativeProfile?: any;
}

/** One link of the causal chain. Every field must carry its connective word. */
export interface KidLogicChain {
  will: string;
  aber: string;
  also: string;
  dadurch: string;
  entweder: string;
  waehlt: string;
  ende: string;
}

export interface KidLogicPage {
  nr: number;
  /** What visibly happens on this page, in one sentence. */
  was: string;
  /** A concrete open question a child could say out loud. Not "schafft er es?". */
  frage: string;
}

export interface KidLogicFigure {
  name: string;
  /** One sentence: who this is. Goes on the page at first appearance. */
  werSieSind: string;
  /** This figure's own want. */
  willWas: string;
}

export interface KidLogicGag {
  typ: GagType;
  beschreibung: string;
  /** Three concrete places. The third must differ from the first two. */
  stellen: [string, string, string];
}

/**
 * The Kinderlogik-Karte. If this cannot be filled in six connected sentences,
 * the premise is dead and no writer call is worth paying for.
 */
export interface KidLogicCard {
  titel: string;
  kurzbeschreibung: string;
  kette: KidLogicChain;
  wunderregel: { regel: string; sichtbareFolge: string };
  dreierSchritt: [string, string, string];
  umkehrung: string;
  preis: string;
  schlussbild: string;
  /** The chantable line. Appears 3x, transformed the third time. */
  refrain: string;
  laufgag: KidLogicGag;
  seiten: KidLogicPage[];
  figuren: KidLogicFigure[];
  /** The object that opens and closes the story. Deterministically checked. */
  ankerObjekt: string;
}

export interface CheckIssue {
  code: string;
  severity: "hard" | "soft";
  message: string;
  /** 1-based reading page, when the issue is page-scoped. */
  page?: number;
}

export interface CheckReport {
  ok: boolean;
  hard: CheckIssue[];
  soft: CheckIssue[];
}

export interface JudgeAnswers {
  wollte: string;
  schiefgegangen: string;
  andersGemacht: string;
  wiederholung: string[];
  lachstelle: string;
  unerklaerteFigur: string;
  unverstaendlicherSatz: string;
  /** Judge's own 1-5 read on whether a 7-year-old can follow this. */
  verstaendlichkeit: number;
}

export interface JudgeReport {
  answers: JudgeAnswers;
  /** Deterministic comparison of the answers against the plan. */
  issues: CheckIssue[];
  passed: boolean;
}

export interface StorybookPage {
  order: number;
  title: string;
  content: string;
}

export interface StorybookStageLog {
  stage: string;
  modelUsed?: string;
  modelRole?: "support" | "selected-story";
  durationMs?: number;
  usage?: { prompt: number; completion: number; total: number; costUSD?: number };
  note?: string;
}

export interface StorybookGenerationInput {
  config: StoryConfig;
  userId?: string;
  storyId?: string;
  heroes: StorybookHero[];
  primaryProfileAge?: number | null;
}

export interface StorybookAvatarDevelopment {
  avatarId?: string;
  name: string;
  changedTraits: Array<{ trait: string; change: number; description: string }>;
}

export interface StorybookPendingArtifact {
  id: string;
  name: string;
  nameEn?: string;
  description?: string;
  category?: string;
  rarity?: string;
  storyRole?: string;
  visualKeywords?: string[];
  emoji?: string;
  imageUrl?: string;
  discoveryChapter: number;
  usageChapter: number;
  locked: true;
}

export interface StorybookGeneratedStory {
  title: string;
  description: string;
  coverImageUrl?: string;
  displayMode: "reading_pages";
  chapters: Array<{
    id: string;
    title: string;
    content: string;
    order: number;
    imageUrl?: string;
    imagePrompt?: string;
    imageModel?: string;
  }>;
  avatarDevelopments: StorybookAvatarDevelopment[];
  pendingArtifact?: StorybookPendingArtifact;
  metadata: Record<string, any>;
}
