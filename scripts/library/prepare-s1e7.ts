/**
 * Assemble the S1E7 seeds of both Originals series (Friday 2026-11-27): texts written by
 * Claude, counter-read and revised by GPT-6.2 Sol (Codex subscription, final grade at least 8),
 * plus scene-specific FLUX direction.
 *
 *   bun run scripts/library/prepare-s1e7.ts            # reads docs/talea-originals/2026-11-27/<key>.lektoriert.txt
 *   bun run scripts/library/prepare-s1e7.ts --from v2  # reads <key>.v2.txt instead (pictures before the final edit)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { parseChapters } from "../../backend/story/library/engine";
import type { EpisodeSeed, ImageSlot } from "../../backend/story/library/types";

const root = resolve(import.meta.dir, "../..");
const docs = join(root, "docs/talea-originals/2026-11-27");
const fromAt = process.argv.indexOf("--from");
const suffix = fromAt > 0 ? process.argv[fromAt + 1] : "lektoriert";
/** Falls back to the edited text when a series has no file with the requested suffix. */
const read = (key: string) => {
  const wanted = join(docs, `${key}.${suffix}.txt`);
  return parseChapters(readFileSync(existsSync(wanted) ? wanted : join(docs, `${key}.lektoriert.txt`), "utf8"));
};
const publishAt = "2026-11-27T14:00:00.000Z";
type Boxes = Record<string, number[]>;
const slot = (url: string, sceneEn: string, characterIds: string[], boxes: Boxes, afterParagraph?: number, outfits?: Record<string, string>): ImageSlot => ({
  url, sceneEn, characterIds, ...(afterParagraph === undefined ? {} : { afterParagraph }), ...(outfits ? { outfits } : {}), boxes,
});
/** Paragraph index of the first paragraph matching the anchor; a picture sits after it. */
function place(text: string, phrase: RegExp): number {
  const paragraphs = text.split(/\n\n/);
  const match = paragraphs.findIndex((p) => phrase.test(p));
  if (match < 0) throw new Error(`Bildanker fehlt: ${phrase}`);
  return Math.max(2, Math.min(paragraphs.length - 3, match));
}

// ---------- Bruno, der Flunkerfisch: S1E7 „Papa im All“ ----------
const b = "/library/series/bruno-der-flunkerfisch/s1e7";
const suit = { "papa-brandt": "a puffy white astronaut space suit with many pockets, thick white boots and a round white space helmet with its gold visor pushed up so his short brown beard and his face are clearly visible" };
const floatingKitchen = "Small family kitchen with a stove and a pan; several coffee cups float slowly in the air, a pancake floats above the pan like a little flying saucer, and a wobbly round ball of cold brown coffee drifts through the air";
const brunoCh = read("bruno");
const bruno: EpisodeSeed = {
  seriesId: "bruno-der-flunkerfisch", season: 1, episode: 7, bibleVersion: 2, publishAt,
  title: "Papa im All",
  summary: "Ella und Mats suchen heimlich den Zylinder, denn Papa will ihn am Montag zum Fundbüro bringen. Als Papa fragt, was sie suchen, flunkert Ella vor Brunos Glas: „Mein Papa ist Astronaut!“ Prompt schweben Papa und die Kaffeetassen durch die Küche. Und Ella muss bei jedem Training zugucken.",
  guests: [],
  cover: slot(`${b}/cover.webp`, `${floatingKitchen}. [papa-brandt] floats near the ceiling in his space suit, lying on his back in the air with his arms spread, beaming with pride. [mats] jumps up and grabs the floating pancake, laughing. [ella] stands by the door with her red notebook pressed to her chest and looks up at her father, half amazed and half worried. Only one girl and only one boy in the whole picture. Exactly these three figures, each once`, ["papa-brandt", "mats", "ella"],
    { "papa-brandt": [20, 250, 450, 780], ella: [360, 30, 1000, 260], mats: [380, 700, 1000, 930] }, undefined, suit),
  chapters: brunoCh.map((c, i) => ({ ...c, images: i === 0 ? [
    slot(`${b}/ch1.webp`, "Cozy living room in morning light, a sofa, a wooden shelf by the window with a round fish tank on it. [mats] lies flat on his tummy on the rug and shines a flashlight under the sofa, one arm deep underneath. [ella] kneels beside him and crosses something out in a small red notebook with a pencil, frowning with concentration. On the shelf [bruno] swims in his round water-filled glass tank above his tiny stone castle and watches them with grumpy half-closed eyes. Exactly these three figures, each once; the fish stays inside the water of its round tank", ["mats", "ella", "bruno"],
      { mats: [560, 40, 1000, 470], ella: [330, 460, 1000, 680], bruno: [150, 700, 480, 940] }, place(c.text, /Papas Hausschuh/)),
    slot(`${b}/ch1-2.webp`, "Cozy living room. [ella] stands in front of the shelf with the round fish tank, turned toward her brother like a television presenter, one arm swept out wide in a big announcing gesture, a forced bright smile. [mats] stares at her with his mouth open, a flashlight in his hand. Ella faces Mats, not the viewer. In the doorway [papa-brandt] stands in his red flannel shirt with flour on his hands, eyebrows raised. On the shelf [bruno] swims in his round water-filled glass tank above his tiny stone castle, eyes wide. Exactly these four figures, each once; the fish stays inside the water of its round tank", ["ella", "mats", "papa-brandt", "bruno"],
      { "papa-brandt": [60, 20, 1000, 260], mats: [420, 270, 1000, 450], ella: [280, 470, 1000, 690], bruno: [150, 720, 480, 950] }, place(c.text, /Mein Papa ist Astronaut/)),
  ] : i === 1 ? [
    slot(`${b}/ch2.webp`, `${floatingKitchen}. On the left edge is the open kitchen doorway to the hallway. [ella] stands in that doorway frozen mid-step on tiptoe, caught sneaking out, looking back over her shoulder. [papa-brandt] floats upside down in the middle of the kitchen in his space suit and points happily at her. [mats] sits cross-legged on the kitchen floor on the right, eating a piece of pancake and grinning. Only one girl and only one boy in the whole picture. Exactly these three figures, each once`, ["papa-brandt", "ella", "mats"],
      { ella: [300, 20, 1000, 240], "papa-brandt": [60, 300, 560, 720], mats: [560, 720, 1000, 950] }, place(c.text, /Training doch angekündigt|Zuschauen!/), suit),
    slot(`${b}/ch2-2.webp`, "An apartment front door wide open onto a bright stairwell landing with a wooden banister. Just inside the doorway [papa-brandt] floats in the air in his space suit, lying sideways in mid-air with his boots up high and his head low near the door handle, grinning proudly at the visitor. On the landing [frau-grimmbach] is seen in profile, turned toward Papa, staring at him with a stern frown and scribbling fast in her small black notebook, not looking at the viewer. Down by her ankles [kater-kaiser] slips past her legs into the apartment, low and sneaky. Papa appears only once, floating in his white space suit; nobody else anywhere in the picture. Exactly these three figures, each once", ["papa-brandt", "frau-grimmbach", "kater-kaiser"],
      { "papa-brandt": [30, 60, 720, 480], "frau-grimmbach": [80, 540, 1000, 820], "kater-kaiser": [720, 380, 1000, 600] }, place(c.text, /Sie schweben/), suit),
  ] : [
    slot(`${b}/ch3.webp`, "Living room by the window, a sofa and a wooden shelf with one round fish tank on it. [papa-brandt] in his space suit floats a hand's width above the sofa and holds on to the sofa backrest with both gloved hands, a pancake stuck flat on top of his helmet, looking puzzled. [ella] stands on a wooden kitchen chair in front of the shelf and holds an empty coffee cup sideways, right under a floating wobbly ball of brown coffee that hovers just above the open top of the fish tank. In the tank [bruno] looks up at the coffee ball in alarm. There is only one fish tank and only one goldfish in the whole picture. Exactly these three figures, each once; the fish stays inside the water of its round tank", ["papa-brandt", "ella", "bruno"],
      { "papa-brandt": [150, 20, 800, 420], ella: [200, 470, 1000, 720], bruno: [150, 720, 500, 960] }, place(c.text, /Ella schob die Tasse dazwischen|genau unter den Ball/), suit),
    slot(`${b}/ch3-2.webp`, "Cozy living room by the window. [papa-brandt] sits on the sofa in his red flannel shirt with a flat pancake lying on top of his head like a cap, blinking in total confusion. In front of the shelf on the floor [ella] kneels and holds an old black top hat steady with both hands while [kater-kaiser] pulls his two front paws out of it, chin raised with offended dignity. Only one hat in the whole picture. Exactly these three figures, each once", ["papa-brandt", "ella", "kater-kaiser"],
      { "papa-brandt": [120, 30, 900, 420], ella: [380, 460, 1000, 720], "kater-kaiser": [560, 700, 1000, 980] }, place(c.text, /leckte sich die Pfote/)),
  ] })),
  collectible: { type: "flunker_card", title: "Flunker-Karte Nr. 7", imageUrl: `${b}/cover.webp`, fields: [
    { label: "Flunkerei", value: "„Mein Papa ist Astronaut. Er zeigt uns heute ein schwereloses Training in unserer Küche!“" },
    { label: "Wer flunkert", value: "Ella" },
    { label: "Was wörtlich passiert", value: "Papa trägt einen Raumanzug und schwebt mit Kaffeetassen und Pfannkuchen durch die Küche. Frau Grimmbach öffnet er kopfüber die Tür. Und Ella muss bei jedem Training zugucken." },
    { label: "Die Wahrheit", value: "Papa ist kein Astronaut. Ella wollte nicht, dass Papa fragt, was sie suchen: den alten Zylinder." },
    { label: "Mutmoment", value: "Die Wahrheit sagen, obwohl sie damit genau das verrät, was sie verstecken wollte." },
  ] },
  teaser: "Nächsten Freitag: Mats hat Geburtstag. Und dann gleich noch mal. Und noch mal. Und vor dem Haus steht jemand mit einem sehr seltsamen Hut.",
  canonFactsAdded: [],
};

// ---------- Die Monster-Müllabfuhr: S1E7 „Kabelsalat“ ----------
const m = "/library/series/die-monster-muellabfuhr/s1e7";
const kabelsalat = {
  id: "kabelsalat",
  name: "Kabelsalat",
  role: "Monster aus vergessenen, verknoteten Ladekabeln in einer Schublade, neuer Elektriker der Monster-Pension",
  visualProfileEn: "friendly monster made of one big tangled ball of old charging cables in black, white and grey, about the size of a beanbag, many small cable plugs sticking out of the tangle like little spikes, two plugs on top wiggling like feelers, two big round friendly eyes peeking out of the knot; plain cables without any writing, no sparks, no electricity, nothing plugged in",
  referenceUrl: `${m}/kabelsalat.webp`,
};
const klirrklaus = {
  id: "klirrklaus",
  name: "Klirrklaus",
  role: "Lagerverwalter der Pension aus Folge 6",
  visualProfileEn: "friendly tall monster made entirely of old empty glass bottles, a little taller than a grown-up woman: a body and two legs of stacked green, brown and clear glass bottles, two long arms made of chains of small bottles, its head one big thick clear glass bottle standing upright with two shiny golden zigzag-edged bottle caps as round eyes; a single golden knitted wool thread tied in a small bow around the neck of the head bottle like a badge; every bottle is plain glass without any label, sticker or writing",
  referenceUrl: "/library/series/die-monster-muellabfuhr/s1e6/klirrklaus.webp",
};
const sinaPlain = "a grown-up woman in her late thirties with adult proportions and height, curly black hair tied up, warm brown skin, a green cardigan over a white top, dark trousers";
const sina = { "mama-sina": `${sinaPlain}, and a tiny faded orange child's high-visibility vest knotted loosely around her shoulders like a scarf` };
const hall = "Narrow apartment hallway at night lit by a flashlight beam, a coat rack and a wooden chest of drawers with its bottom drawer pulled open, plain walls without any writing";
const monsterCh = read("monster");
const monster: EpisodeSeed = {
  seriesId: "die-monster-muellabfuhr", season: 1, episode: 7, bibleVersion: 2, publishAt,
  title: "Kabelsalat",
  summary: "Diesmal fährt Mama Sina mit. Bei Familie Berger verknotet sich nachts alles: Schnürsenkel, Kopfhörer, sogar die Jackenärmel. Je schneller Oma zupackt, desto fester zieht sich der Kabelsalat zusammen. Jona muss den langsamsten Einsatz der Nachtschicht leiten. Und dabei erzählt Mama zum ersten Mal vom Sockenkönig.",
  guests: [kabelsalat, klirrklaus],
  cover: slot(`${m}/cover.webp`, `${hall}. [jona] in his orange vest kneels on the floor in front of [kabelsalat] and very carefully lifts one single loop of cable with two fingers, concentrating. [mama-sina] kneels beside him and holds the flashlight steady, singing softly with a calm smile. Behind them [oma-hilde] stands absolutely frozen, one orange glove still caught in the tangle, biting her lip to keep still. Exactly these four figures, each once`, ["jona", "mama-sina", "oma-hilde", "kabelsalat"],
    { "oma-hilde": [60, 20, 1000, 280], "mama-sina": [300, 260, 1000, 500], jona: [420, 480, 1000, 660], kabelsalat: [380, 660, 1000, 980] }, undefined, sina),
  chapters: monsterCh.map((c, i) => ({ ...c, images: i === 0 ? [
    slot(`${m}/ch1.webp`, "Night on a depot yard in front of a small building with a green door, warm light from a window. [klirrklaus] holds out a tiny faded orange child's high-visibility vest with both bottle-chain arms toward [mama-sina], who takes it with both hands, touched, her eyes shining. [jona] in his own orange vest stands beside his mother and looks up at her proudly. Exactly these three figures, each once", ["klirrklaus", "mama-sina", "jona"],
      { klirrklaus: [20, 40, 1000, 380], "mama-sina": [80, 420, 1000, 700], jona: [380, 710, 1000, 920] }, place(c.text, /Meine erste/), { "mama-sina": sinaPlain }),
    slot(`${m}/ch1-2.webp`, `${hall}. [kabelsalat] has crawled out of the open drawer and pulled itself tight around the right hand of [oma-hilde]: her orange glove is swallowed up to the wrist inside the cable tangle. She leans far back, both boots braced on the floor, and pulls with all her strength, face straining, not smiling, and the tangle has swollen up as big as an armchair. [jona] in his orange vest shines his flashlight on them with wide eyes. Exactly these three figures, each once`, ["kabelsalat", "oma-hilde", "jona"],
      { jona: [330, 30, 1000, 260], "oma-hilde": [80, 280, 1000, 580], kabelsalat: [300, 560, 1000, 980] }, place(c.text, /Je fester ich zieh/)),
  ] : i === 1 ? [
    slot(`${m}/ch2.webp`, `${hall}. [flusi] sits in the middle of the floor tied up tightly round and round with many black and white cables like a parcel tied with string, his round grey body almost hidden under the crossed cables, only his two tiny dot eyes and his single curly tuft peeking out, looking very calm about it. Behind him [kabelsalat] has grown big and tugs at the cables. [jona] in his orange vest has let go of a cable and looks toward the side, thinking hard. Exactly these three figures, each once`, ["flusi", "kabelsalat", "jona"],
      { jona: [300, 30, 1000, 280], flusi: [600, 360, 900, 560], kabelsalat: [200, 560, 1000, 980] }, place(c.text, /Flusi ist Paket/)),
    slot(`${m}/ch2-2.webp`, `${hall}. [oma-hilde] stands completely still with exaggerated care, one glove still caught in the cable tangle, laughing silently behind her other hand. [mama-sina] stands calmly beside her holding the flashlight and smiles at her. [jona] in his orange vest looks from one to the other. Exactly these three figures, each once, and the tangle of cables beside Oma`, ["oma-hilde", "mama-sina", "jona"],
      { "oma-hilde": [60, 40, 1000, 340], "mama-sina": [80, 380, 1000, 640], jona: [380, 680, 1000, 900] }, place(c.text, /bloß still|hältst du einfach still/), sina),
  ] : [
    slot(`${m}/ch3.webp`, `${hall}. [jona] in his orange vest kneels and holds up a single grey sock with a tiny knitted golden crown on it, looking up at his mother with a big question in his eyes. [mama-sina] kneels beside him, the flashlight in her lap, and looks at the little crown, remembering, her face soft and serious. [flusi] sits on Jona's knee, freshly freed. Beside them [kabelsalat] is already half untangled, loose loops lying calmly on the floor. Exactly these four figures, each once`, ["jona", "mama-sina", "flusi", "kabelsalat"],
      { "mama-sina": [200, 30, 1000, 330], jona: [380, 330, 1000, 560], flusi: [620, 450, 820, 600], kabelsalat: [450, 640, 1000, 980] }, place(c.text, /Sockenkönig genannt/), sina),
    slot(`${m}/ch3-2.webp`, "Cosy small kitchen of the monster pension at night, warm lamplight, an old cassette recorder on the table. [kabelsalat], now neatly wound into tidy round coils with its two plug feelers on top, holds a pencil stuck into a cassette with its feelers and slowly winds a loose loop of brown tape back in. [oma-hilde] sits at the table with her chin in both hands and watches, unusually patient. [jona] leans on the table beside her and smiles. Exactly these three figures, each once", ["kabelsalat", "oma-hilde", "jona"],
      { "oma-hilde": [200, 30, 1000, 340], jona: [320, 360, 1000, 560], kabelsalat: [380, 600, 900, 960] }, place(c.text, /Bleistift/), { kabelsalat: "the same friendly cable monster, now neatly wound into tidy round coils of black, white and grey cable, calm, two plug feelers on top, two big round friendly eyes" }),
  ] })),
  collectible: { type: "monster_profile", title: "Monster-Steckbrief Nr. 7", imageUrl: `${m}/kabelsalat.webp`, fields: [
    { label: "Name", value: "Kabelsalat" },
    { label: "Ursprung", value: "Vergessene Ladekabel, die immer in Eile in eine Schublade gestopft wurden" },
    { label: "Schwäche", value: "Braucht Geduld. Hektik macht ihn stärker." },
    { label: "Fangtrick", value: "Langsam entknoten, Schlaufe für Schlaufe. Keiner zieht, Oma hält still." },
    { label: "Job in der Pension", value: "Elektriker: passt auf, dass sich nichts verknotet" },
  ] },
  teaser: "Nächste Woche: Gertrud ist weg! Drei kleine Wollknäuel haben sie weggelockt. Und die Crew muss zu Fuß hinterher.",
  canonFactsAdded: [],
};

const factsPath = join(docs, "kanon.json");
const facts = existsSync(factsPath) ? (JSON.parse(readFileSync(factsPath, "utf8")) as Record<string, string[]>) : { bruno: [], monster: [] };
bruno.canonFactsAdded = facts.bruno;
monster.canonFactsAdded = facts.monster;
for (const episode of [bruno, monster]) {
  for (const chapter of episode.chapters) chapter.image = chapter.images![0];
  const path = join(root, `backend/story/library/seed/episodes/${episode.seriesId}.s1e7.json`);
  writeFileSync(path, JSON.stringify(episode, null, 2) + "\n");
  console.log(`${episode.title}: ${episode.chapters.map((c) => c.text.split(/\s+/).length).join(" + ")} Wörter; Bildpositionen ${episode.chapters.map((c) => `${c.images!.map((s) => s.afterParagraph).join("/")} von ${c.text.split(/\n\n/).length}`).join(", ")}`);
}
