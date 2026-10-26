/**
 * Talea-Folge — the craft of the Talea Originals for the family's own stories.
 *
 * The Originals ("Bruno, der Flunkerfisch", "Die Monster-Müllabfuhr") read full
 * and funny because a series bible carries them: one wonder with one rule that
 * makes a child's situation literal, figures with unmistakable voices, running
 * gags, an episode formula (pressure → trigger → great → chaos → the easy way
 * makes it worse → courage → resolution with callbacks) and three chapters of
 * 500–800 words. A normal story has no bible, so this lane invents one per story
 * and then writes it with the Originals' own chapters as the style reference.
 *
 * Pure: budgets, rules and samples only.
 */

import brunoS1E2 from "../library/seed/episodes/bruno-der-flunkerfisch.s1e2.json";
import monsterS1E2 from "../library/seed/episodes/die-monster-muellabfuhr.s1e2.json";
import type { AgeBand, LengthBudget } from "../storybook/craft";
import { STORYBOOK_DEFAULT_WRITER_MODEL } from "../storybook/llm";

export const EPISODE_PIPELINE_ID = "talea-folge-v1";

/**
 * Sol 6.1 plans and writes every Talea-Folge (measured 2026-10-23). The wizard's customer default
 * writer (Kimi K2.6, chosen for the old engine) never applies here; TALEA_EPISODE_WRITER_MODEL overrides.
 */
export function episodeWriterModel(_config?: unknown): string {
  return process.env.TALEA_EPISODE_WRITER_MODEL || STORYBOOK_DEFAULT_WRITER_MODEL;
}
/**
 * Chapters × words. The Originals: 3 chapters, 1,600–2,100 words, about 7 words per sentence. Ages 6–8 were 500–700
 * per chapter until 2026-10-26: "Der Riese hinterm Teig" came out at 505 / 503 / 579 words — the writer lands on the
 * floor of the range, and the staccato one-line paragraphs of this voice make that read short (about 10 minutes aloud).
 * 600–800 aims at 1,800–2,400 words, a good 12 minutes.
 */
export function episodeBudget(length: string | undefined, band: AgeBand): LengthBudget {
  const index = length === "short" ? 0 : length === "long" ? 2 : 1;
  const chapters = [2, 3, 4][index];
  const perChapter: Record<AgeBand, [number, number]> = {
    "3-5": [170, 260],
    "6-8": [600, 800],
    "9-12": [650, 900],
  };
  const [min, max] = perChapter[band];
  return {
    pages: chapters,
    wordsPerPageMin: min,
    wordsPerPageMax: max,
    totalWordsMin: chapters * min,
    totalWordsMax: chapters * max,
    maxCast: band === "3-5" ? 1 : 2,
    // FLUX.2 klein draws three figures cleanly (storybook measurement 2026-09-29). Four figures plus
    // extra props cost story 13c3a7d3 ten pictures for four slots, two still flawed.
    maxCharactersPerImage: 3,
  };
}

/** Average words per sentence the read-aloud prose aims for. */
export function sentenceLengthLine(band: AgeBand): string {
  if (band === "3-5") return "Sentences of 3–9 words (average about 6), lots of repetition, sounds to join in with; nothing a three-year-old cannot picture at once.";
  if (band === "9-12") return "Sentences of 5–16 words (average about 10), quicker wit and wordplay, real suspense; still no grown-up abstractions.";
  return "Sentences of 4–12 words (average about 7), varied; every sentence complete — never telegraphic fragments.";
}

/**
 * Two chapters of published Originals as the style reference: Bruno's
 * escalation chapter (the easy way makes it worse, a near-discovery, a quiet
 * night) and the monster finale (a wrong song, the brave moment, the job in the
 * pension). They teach rhythm, timing and voices; the prompt forbids copying.
 */
export function styleSamples(): Array<{ label: string; text: string }> {
  const bruno = (brunoS1E2 as any).chapters?.[1];
  const monster = (monsterS1E2 as any).chapters?.[2];
  return [
    { label: `„${(brunoS1E2 as any).title}“, Kapitel 2: ${bruno?.title}`, text: String(bruno?.text || "") },
    { label: `„${(monsterS1E2 as any).title}“, Kapitel 3: ${monster?.title}`, text: String(monster?.text || "") },
  ].filter((sample) => sample.text.length > 200);
}

/** The series' figures; a planner that names a dog „Bruno“ cost a full rewrite (run r4-mila). „Kaiser“ alone is a word, not a name. */
export const SAMPLE_NAMES = ["Bruno", "Ella", "Mats", "Grimmbach", "Brunello", "Jona", "Hilde", "Flusi", "Gertrud", "Sina"];

/** Words that only exist in the samples. A story that contains them copied instead of learned. */
export const SAMPLE_SIGNATURES = [
  "Bruno", "Ella", "Mats", "Grimmbach", "Kater Kaiser", "Flunker", "Plan W", "Blubb", "Simsalabrunello",
  "Jona", "Oma Hilde", "Flusi", "Gertrud", "Gähnmonster", "Socken-Schnüffler", "Monster-Pension", "Süßer", "Süße",
];

export const METHOD_EN = [
  "THE METHOD — how every Talea Original is built:",
  "1. A REAL CHILD SITUATION starts it: something every child knows, that matters to one hero personally and fits their nature (the task lists today's choices). This feeling is the heart of the story.",
  "2. ONE WONDER WITH ONE RULE a six-year-old can repeat in a single sentence. The wonder takes the child situation literally and makes it visible. It is SHOWN in chapter 1 by a small first effect, never explained in a lecture. Right after it, a figure says the rule in one short line — naming the exact trigger (the word, the deed) — or the heroes work it out aloud: the fun is that the listener knows what sets it off while the figures keep setting it off. No convenient signs, notes or books that explain the magic. Its consequences are visible and physical and get crazier step by step. The wonder is a someone with a will of its own, or it comes with one (a creature, a talking thing, an animal with an attitude) — not a mere mechanism.",
  "3. THE EASY WAY OUT FAILS: the heroes try to fix it without facing the real thing. Two or three attempts; each follows from the rule and makes it worse in a new, visible, funny way. Why the obvious shortcut does not work is shown, not claimed.",
  "4. GROWN-UPS are warm and busy and almost discover it — the near-discovery is a gag and raises the pressure. They are never stupid, never conveniently sent away, and they never solve it.",
  "5. THE ENSEMBLE: every figure has ONE unmistakable voice (how they talk, one typical line) and wants something. The heroes complement each other. A comic companion comments on everything — give it a fresh attitude of its own (grumpy, gloomy, greedy, a know-it-all, a scaredy-cat, overly literal, sleepy, a show-off …), not the pompous announcer every time. A troublemaker, never evil, pursues a plan of its own that fails at a small slapstick detail — best because of something the heroes set up earlier.",
  "6. RUNNING GAGS: two of them, each appears three times; the third time it turns around or pays off. Catchphrases are short and land at the right moment.",
  "7. HEART: before the finale a quiet moment — someone admits a small weakness (often the companion or a grown-up), so the hero is not alone with it. Then the hero does the one hard thing the child situation was about, in front of others: tries the scary thing anyway, lets someone else go first, shares the precious thing, keeps the promise, stands up for someone, lets go, says what they really feel, admits they were wrong, gives something back — whatever this situation needs. „Asking for help“ and „together it works“ are the most worn hearts of generated stories: use them only when the situation truly is about that. That courage, together with the rule, ends the chaos in ONE moment. No coincidence, no grown-up takes over, no sermon afterwards — a warm, short reaction.",
  "8. PAYOFFS: everything that solves something was planted earlier in passing. The ending calls back the opening and the running gags; the very last lines are a laugh.",
  "9. THE OPENING shows at once where we are, who is there, what they are doing and why today is different (something is about to happen, a deadline the child can feel), in concrete things — every figure's place in it is clear (who is this grown-up, why is she here).",
  "TAKEN PREMISES: the published Talea series own these — never build a story on them: a fib or a brag that comes true or grows, a spell that only the truth or a confession ends; monsters made of forgotten things.",
].join("\n");

/**
 * Series names a new figure must not get. A family's own hero or a pool figure may of course be
 * called Ella or Bruno: those names are never forbidden, never flagged and never renamed.
 */
export function takenNames(brief: { heroes: Array<{ name: string }>; candidates: Array<{ name: string }> }): string[] {
  const own = new Set([...brief.heroes, ...brief.candidates].flatMap((figure) => String(figure.name || "").toLocaleLowerCase("de-DE").split(/\s+/)));
  return SAMPLE_NAMES.filter((name) => !own.has(name.toLocaleLowerCase("de-DE")));
}

export function takenNamesLine(brief: Parameters<typeof takenNames>[0]): string {
  const names = takenNames(brief);
  return names.length ? `TAKEN NAMES: these belong to the Talea series and are never given to a new figure: ${names.join(", ")}.` : "";
}

/** Fresh names for a new figure that got a series name anyway (renamed instead of a paid rewrite). */
export const FRESH_NAMES = ["Pimpel", "Fiete", "Lotti", "Brummel", "Tilli", "Momo", "Wuschel", "Knöpfchen", "Fridolin", "Rieke"];

/**
 * Sol converges on one child situation per prompt (round 1: a fib in both stories; round 2–4: „doing it
 * all alone“ whenever it was on offer — it is no longer on the list). Each story gets four different
 * ones, drawn by its seed.
 */
export const CHILD_SITUATIONS_EN = [
  "waiting for something big that takes forever",
  "a promise that is hard to keep",
  "being too small for something the others may do",
  "being told you are too big for something you still love",
  "being afraid to do something in front of others",
  "missing someone who is far away",
  "wanting to belong to a group that already has its games",
  "having to share the very best thing",
  "wanting to help and making it worse",
  "being the new one somewhere",
  "losing at a game and hating it",
  "being jealous of someone who is better at something",
  "a pet or plant someone entrusted to you",
  "wanting to win so badly that it spoils the game",
  "not wanting to say goodbye to something old",
  "being blamed for something you did not do",
  "a broken thing that belongs to someone else",
  "not being allowed to do something yet",
  "a wish that is bigger than the pocket money",
  "a secret that is hard to keep for a surprise",
  "being scared of something that turns out to be scared too",
  "a messy room just before visitors arrive",
];

function seededOrder<T>(items: T[], seed: string): T[] {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const swap = Math.floor(next() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

export function childSituationChoices(seed: string, count = 4): string[] {
  return seededOrder(CHILD_SITUATIONS_EN, seed).slice(0, count);
}

/**
 * Round 3 (2026-10-23): six of seven stories were set at a festival with cushions, a curtain and an
 * organiser with a list — Sol's default stage. Each story gets three fresh places of its genre.
 */
const PLACES_EN: Record<string, string[]> = {
  everyday: [
    "a flat full of moving boxes on moving day", "the last school morning before the holidays", "a long train ride with a picnic",
    "the Saturday market between the stalls", "a tent in the garden for a sleepover", "the waiting room of the vet",
    "a snow day when school is cancelled", "the corner bakery before it opens", "the outdoor pool on its first warm day",
    "a power cut on a dark evening", "the school bus on a rainy morning", "an allotment garden with a shed",
    "the laundrette with its round windows", "a broken lift in a tall house", "the playground the morning after a storm",
    "the lost-and-found office of a station", "the hairdresser's on a busy Saturday", "a library on its reading night",
    "the hospital's waiting room for a check-up, nothing serious", "a ferry across a lake", "the attic during a rainy weekend",
  ],
  fairy_tales: [
    "a mill by a rushing stream", "a castle kitchen at dawn", "a crooked tower with too many stairs", "the market of a fairy-tale town",
    "a bridge where a toll troll lives", "a cottage at the edge of an enchanted forest", "the royal stables", "a well at the crossroads",
    "a ship of a fairy-tale king", "a giant's vegetable garden", "a frozen lake in a winter kingdom", "a bakery in a gingerbread village",
  ],
  adventure: [
    "a cave behind a waterfall", "a tiny island at low tide", "a raft on a slow river", "an old lighthouse on the cliffs",
    "a mountain hut above the clouds", "a ruined castle in deep woods", "a sunken ship in a clear bay", "a desert oasis",
    "a jungle path with hanging bridges", "an abandoned mine with rails", "a glacier with blue ice caves", "a marsh with wooden walkways",
  ],
  scifi: [
    "the greenhouse of a space station", "a moon base during a dust storm", "a robot repair shop on Mars", "the cargo hold of a rocket",
    "a market on a planet with two suns", "the inside of a comet", "a floating city above the clouds of a gas planet", "a rover crossing a crater",
    "a laboratory of crazy inventions", "a spaceship's kitchen", "an asteroid with low gravity", "the control room of a satellite",
  ],
  animals: [
    "a farmyard on a stormy day", "a pond at dusk", "a burrow under the meadow", "a zoo at night after closing time",
    "a river bank in spring", "the forest floor under the leaves", "a beaver dam", "a bird colony on a cliff",
    "a barn in winter", "a coral reef", "a beehive in a garden", "a savanna waterhole",
  ],
};

export function placeChoices(genre: string | undefined, seed: string, count = 3): string[] {
  const pool = PLACES_EN[String(genre || "")] || PLACES_EN.everyday;
  return seededOrder(pool, `${seed}:place`).slice(0, count);
}

/** What the chosen genre tile promises, phrased for this method. */
export const GENRE_METHOD_EN: Record<string, string> = {
  fairy_tales: "Genre fairy tale (mandatory): a real fairy-tale world where the wonder belongs naturally (a talking animal, a magic object, a wish, a curse, a transformation), helpers and an opponent, the fairy-tale rule of three. An everyday problem in a castle setting is not yet a fairy tale.",
  adventure: "Genre adventure (mandatory): the heroes set out to a special place (cave, island, river, summit, ruin, deep forest) and face real obstacles there with courage and wits; the wonder or the place has its rule. The story stays out there — it is not a story about the heroes' room.",
  magic: "Genre magic (mandatory): a spell or magic thing is at the centre — a visible effect, one clear rule and a literal, comic catch. The heroes learn to use the rule cleverly instead of fighting it.",
  animals: "Genre animal story (mandatory): animals carry the story and have character; what they really do as animals (eating, digging, sleeping, migrating, hiding, hoarding) drives the comedy and the solution — factually right. Talking animals still behave like their species.",
  scifi: "Genre space and future (mandatory): spaceship, robot, alien planet or a crazy invention; the wonder is a technical or alien thing with one rule a child understands. The whole story happens there — never on a playground with a cardboard rocket.",
  modern: "Genre everyday life today (mandatory): no magic at all. The „wonder“ is a crazy but possible situation with its own logic — an escaped animal, a machine with a mind of its own, a rumour, a bet, a mix-up that snowballs; its „rule“ is how it behaves. Nursery, school, playground, neighbourhood.",
};

export const FAMILY_RULE_EN =
  "FAMILY: the app knows nothing about the heroes' real families. Never invent parents, grandparents, siblings or other relatives, and never say how the heroes are related. Grown-ups in the story are neighbours, teachers, shopkeepers, a caretaker, a bus driver, a librarian … — people with quirks, seen through a child's eyes.";

export function writingRulesEn(band: AgeBand, language: string, german: boolean): string {
  return [
    "HOW TALEA SOUNDS — writing rules:",
    `- Read-aloud prose in ${language} for children aged ${band}. ${sentenceLengthLine(band)}`,
    "- Rhythm like the reference, never a pattern: quick exchanges of dialogue in short paragraphs (often one line of speech plus a gesture), action in paragraphs of two to five sentences, a single sound or word as its own paragraph for a bang. Never four paragraphs in a row of the same shape. Sentence lengths range from two to about eighteen words.",
    "- Lots of dialogue — about half of the paragraphs contain speech, with real back-and-forth. Every figure sounds like itself (the voice from the plan); catchphrases word for word. Figures talk like people in a children's book, not like officials: no stilted formal words as a figure's whole voice.",
    "- Sound words are beats of their own: big when loud, repeated when rhythmic.",
    // "Der Riese hinterm Teig": „Adrian stellte sich auf die Zehenspitzen neben ihm. Er schob die letzte Sternform …“ — the
    // picture director and the picture check read it as two different boys.
    "- A sentence never starts with „Er“ right after a sentence that names two figures the pronoun could mean (two boys; a grown-up and a child) or names one figure and „ihm“/„ihn“ for another: repeat the name. The illustrator reads these sentences too and draws the wrong figure.",
    "- A chapter title never counts anything (no „Drei schlechte Einfälle“, no „Zwei Wünsche“): it names a place, a thing or the funny moment of the chapter.",
    "- The child laughs first: visible absurdity (an answer that makes no sense in the neatest handwriting), bodies and things in funny trouble, a proud figure whose plan fails at a tiny detail, children's logic that is wrong and right at once, exact silly details in threes (the third the craziest), literal misunderstandings, slapstick with cause and effect, timing (build-up, then one short dry sentence). A dry line for the grown-up reading aloud is a bonus, never the main joke. Never explain a joke. Nobody is laughed at for who they are, nobody is humiliated or hurt.",
    "- Feelings show in body and action, in this story's own images — never the stock ones (hot or glowing ears, a tingling belly, a lump in the throat) — and in what figures do, never in a lecture. No narrator questions. „Plötzlich“ / „suddenly“ at most twice in the whole story.",
    "- Avoid the worn tics of generated stories: no pencil behind anyone's ear, no clipboard or list-ticking organiser, no seat cushions, garlands or curtains as the main props, no grown-up's slogans of the form „Erst …, dann …“, no „mein Links oder dein Links“, no figure that „verkündet“ everything. Grown-ups talk like real people.",
    "- At least two moments per chapter a child laughs out loud at — set pieces with concrete absurd content (what exactly goes wrong, what exactly it looks like), not just a witty remark.",
    "- Every figure is introduced at its first appearance with half a sentence of action or look — no info block. The heroes' looks, size and age are not described (the pictures show them); they are introduced through what they do and like.",
    "- Concrete and sensual: smells, sounds, things to touch, exact numbers (eleven bells, 212 steps). Places, paths, who holds what and where things are stay consistent from sentence to sentence.",
    "- Every step follows from the previous one; the wonder's rule never bends; the solution comes from the heroes' courage or knowledge and from something planted earlier — never from chance, never from a grown-up.",
    "- Chapters 1 to n-1 end with a concrete hook (an event, a line, a discovery) — never a question. The last chapter resolves everything, warmly, with the callbacks and a final laugh. No cliffhanger, no teaser.",
    "- No moral, no lesson, no „und so lernten sie“; a grown-up's reaction is warm and short, never a sermon.",
    `- Third person, close to the focus hero. Simple past${german ? " (Präteritum). German quotation marks „…“." : "."}`,
  ].join("\n");
}
