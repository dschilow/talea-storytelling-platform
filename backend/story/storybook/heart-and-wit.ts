/**
 * Heart and wit — what the best read-aloud books do beyond plot mechanics.
 *
 * Trigger (2026-10-15): the user's children love „Zippel, das wirklich wahre
 * Schlossgespenst“ (Alex Rühle, dtv 2018). A small, stubborn ghost lives in the
 * door lock of an old city flat; he takes every word literally, the boy Paul
 * keeps him secret from his parents, and the caretaker — for sensible reasons —
 * wants to replace all the old locks. A neighbour with a collection of antique
 * locks is the door the boy has to find. Same family: Pumuckl, Das Sams, Das
 * kleine Gespenst, Paddington, Karlsson vom Dach.
 *
 * What carries these books is not a clever magic rule but a someone: a wonder
 * with a personality, dropped into a place the child knows by heart, who sees
 * that place with fresh eyes. Our pipelines were built the other way round
 * (wonder = rule + limits + workaround), and the old language rules even
 * forbade invented words and grown-up irony — the two things Zippel lives on.
 *
 * Measured 2026-10-15 (same 10 picture-book configs, blind Gemini pairs against
 * the old prompts, Logs/zippel): the full rules won 5 and tied 2 of the 7 fairy
 * tale, magic and everyday configs, and lost all 3 space, adventure and animal
 * configs (a space mystery moved to a schoolyard, a fairy entered an animal
 * story, adventures turned "too tame"). A softened, genre-first version for all
 * genres lost the gains and still lost those 3. So the genre decides:
 *   - full  — fairy tales, magic, everyday: the wonder is a someone in the
 *             heroes' everyday world, fresh eyes, heart, two-level humour;
 *   - light — space, adventure, animals and anything else: only the sentence-
 *             level craft (voices, one fresh-eyes moment, humour that works
 *             twice, one quiet moment); the genre's own wonder stays untouched.
 *
 * Nothing here names a motif (no ghost, lock or keyhole): a concrete example in
 * a prompt was copied into five of nineteen stories on 2026-10-14. The book is
 * named in comments only, never in a writer prompt, so no writer imitates it.
 */

import type { AgeBand } from "./craft";

export type HeartAndWitMode = "full" | "light" | "off";

/** Kill switch for A/B runs and emergencies: TALEA_HEART_AND_WIT=off brings back the prompts of before 2026-10-15. */
export function heartAndWitEnabled(): boolean {
  return String(process.env.TALEA_HEART_AND_WIT || "").trim().toLowerCase() !== "off";
}

/** Genres whose promise lives in (or can visit) the heroes' own world — where the everyday wonder won. */
const FULL_GENRES = new Set(["fairy_tales", "magic", "modern"]);

export function heartAndWitMode(genre: unknown): HeartAndWitMode {
  if (!heartAndWitEnabled()) return "off";
  return FULL_GENRES.has(String(genre ?? "")) ? "full" : "light";
}

function lightRules(language: string): string[] {
  return [
    "Voices: every important character sounds unmistakable — a pet phrase, words of their own, a stubborn logic — so a child with closed eyes knows who is talking.",
    `Fresh eyes: at least one moment where someone takes a word literally, mixes something up or draws a stubbornly logical wrong conclusion, and the heroes explain — only if it truly works in ${language}, never explained.`,
    "Humour that works twice (the child laughs out loud, the grown-up reading aloud smiles) and one quiet, tender moment between the laughs — never at the cost of the wonder, the thrill or the genre the family asked for.",
  ];
}

/**
 * The rules every writer, planner and idea stage shares, by genre. `language` is the story language label.
 * Without a genre (support and repair calls) the light rules apply.
 */
export function heartAndWitRules(language: string, genre?: unknown): string[] {
  const mode = heartAndWitMode(genre);
  if (mode === "off") return [];
  if (mode === "light") return lightRules(language);
  return [
    "The wonder is a someone, not a mechanism: the central wonder (in a story without magic, the most unusual figure) has a personality — something it wants, something it fears, a stubborn opinion and a way of talking nobody else has. Comedy and heart come from who it is; what it can do shows in what it does, with as few rules as possible.",
    "The wonder touches the everyday: it turns up in a place the heroes know by heart (their home, their street, their yard, their way to school — or the home corner of their own world) and gives that ordinary place a second meaning. Even far away, ordinary things work the way children know them: the fantastic is told with everyday precision.",
    `Fresh eyes: someone does not know how the heroes' world works, and the heroes explain it — the children are the experts. That someone takes words literally, mixes them up or coins new ones, and draws stubbornly logical wrong conclusions. Two or three such misunderstandings a child gets at once and wants to repeat at the dinner table; a word with two meanings may even carry the whole idea. Word games only if they truly work in ${language}: never translate a pun, never explain one.`,
    "Small world, big stakes: what is at stake is close and child-sized (a home, a friendship, a promise, a secret), not the world. The pressure may come from ordinary grown-up life with sensible reasons (tidying up, a repair, a move, a rule), so nobody has to be evil — the grown-ups simply cannot see what the heroes see.",
    "Friendship both ways: heroes and companion need each other, each gives the other something they lack. The companion has a small sore spot of its own (alone, homesick, too small, overlooked) that the friendship answers. Between the laughs come quiet, tender moments — a worry, a confession, a goodnight — shown in a gesture or a line, never explained.",
    // Normal-mode run N1 (2026-10-15): the near-discovery rule brought in "Mama" and "Oma's socks" — the app knows nothing about the real family.
    "Grown-ups are people with quirks, seen through a child's eyes, never cardboard villains or mere helpers; a grumpy one may turn out to know something. If grown-ups know nothing of the wonder, near-discoveries are comedy and suspense at once — and the reason the heroes must act themselves. Never invent the heroes' parents, grandparents or other relatives: a grown-up nobody named is a neighbour, a shopkeeper or simply someone calling from the kitchen.",
    "Humour that works twice: the child laughs out loud, the grown-up reading aloud smiles — deadpan understatement, grown-up logic seen from outside, a character's unshakable conviction, the exact everyday detail. Never mocking, never explained.",
    "Voices: the companion speaks unmistakably (a pet phrase, words of its own, a way of counting, singing or contradicting), so a child with closed eyes knows who is talking. Its voice changes a little as the friendship grows.",
  ];
}

/** The same rules for one short picture book: fewer, so the page budget stays with the story. */
export function heartAndWitPictureBookRules(language: string, genre?: unknown): string[] {
  const mode = heartAndWitMode(genre);
  if (mode === "off") return [];
  if (mode === "light") return lightRules(language);
  return [
    "The wonder is a someone, not a mechanism: it wants something, fears something, has a stubborn opinion and its own way of talking. As few rules as possible — what it can do shows in what it does.",
    "The wonder touches a place the heroes know by heart, or the faraway world is told with everyday precision.",
    `Fresh eyes: someone takes a word literally, mixes things up or draws a stubbornly logical wrong conclusion, and the heroes explain — at least one such moment a child wants to repeat. Word games only if they truly work in ${language}, never explained.`,
    "Heroes and companion need each other; one quiet, tender moment between the laughs. Humour that also makes the reading grown-up smile.",
  ];
}

const GENRE_NOTES: Record<string, string> = {
  fairy_tales: "In this fairy tale: the fairy-tale being has its own stubborn personality and view of things, and the fairy-tale world runs on precise everyday details.",
  // Chapter book K1 (magic, funny) lost twice when the spell faded behind the creature.
  magic: "In this magic story: the spell keeps its visible effect and its catch, and the magic has moods and opinions — a being, or something that behaves like one — and it shows up in the heroes' everyday world.",
  modern: "In this story without magic: the unusual someone is a real figure (a newcomer, a neighbour, an animal with a will of its own), or the heroes themselves take grown-up words literally.",
};

/** How the someone looks in the wished-for genre; empty outside the full genres. */
export function heartAndWitGenreNote(genre: unknown): string {
  return heartAndWitMode(genre) === "full" ? GENRE_NOTES[String(genre ?? "")] || "" : "";
}

export function heartAndWitBandNote(band: AgeBand, genre?: unknown): string {
  if (heartAndWitMode(genre) !== "full") return "";
  if (band === "3-5") return "For three- to five-year-olds: one simple misunderstanding that comes back like a refrain, a small lovable someone, a secret at most as a game.";
  if (band === "9-12") return "For nine- to twelve-year-olds: sharper wit, real wordplay, a little irony, and a feeling under the surface that the text shows and never explains or sums up.";
  return "";
}

/** The idea-stage line for the full genres: one candidate always tries the everyday wonder. Empty otherwise. */
export function everydayWonderIdeaLine(genre: unknown): string {
  if (heartAndWitMode(genre) !== "full") return "";
  return String(genre ?? "") === "modern"
    ? "At least one of the ideas puts an unusual someone into the heroes' everyday world (home, street, school) — told so that the ordinary place gets a second meaning."
    : "At least one of the ideas brings a wonder-someone into the heroes' everyday world (home, street, school) instead of sending them into a separate magic world.";
}

/** Whether the everyday-wonder engine belongs to this genre's picture-book options. */
export function everydayWonderFitsGenre(genre: unknown): boolean {
  return heartAndWitMode(genre) === "full";
}

/** Genre and age notes for the wizard settings, as prompt lines (empty outside the full genres). */
export function heartAndWitSettingLines(genre: unknown, band: AgeBand): string[] {
  return [heartAndWitGenreNote(genre), heartAndWitBandNote(band, genre)].filter(Boolean);
}
