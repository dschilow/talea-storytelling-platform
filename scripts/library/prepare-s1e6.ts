/**
 * Assemble the S1E6 seeds of both Originals series (Friday 2026-11-20): texts written by
 * Claude, counter-read and revised by GPT-6.2 Sol (Codex subscription), plus scene-specific
 * FLUX direction.
 *
 *   bun run scripts/library/prepare-s1e6.ts            # reads docs/talea-originals/2026-11-20/<key>.lektoriert.txt
 *   bun run scripts/library/prepare-s1e6.ts --from v3  # reads <key>.v3.txt instead (pictures before the final edit)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { parseChapters } from "../../backend/story/library/engine";
import type { EpisodeSeed, ImageSlot } from "../../backend/story/library/types";

const root = resolve(import.meta.dir, "../..");
const docs = join(root, "docs/talea-originals/2026-11-20");
const fromAt = process.argv.indexOf("--from");
const suffix = fromAt > 0 ? process.argv[fromAt + 1] : "lektoriert";
const read = (key: string) => parseChapters(readFileSync(join(docs, `${key}.${suffix}.txt`), "utf8"));
const publishAt = "2026-11-20T14:00:00.000Z";
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

// ---------- Bruno, der Flunkerfisch: S1E6 „Kaisers großer Coup“ ----------
const b = "/library/series/bruno-der-flunkerfisch/s1e6";
const machine = "the cat's contraption: a small round red canister vacuum cleaner screwed on top of a pair of very old white leather roller skates, a thick grey suction hose hanging at its side, and a long thin silver telescopic metal pipe rising from it with an old dusty black top hat clamped upside down to its far end like a scoop; the top hat has only a tiny silver fish stitched on its band";
const genius = { "kater-kaiser": "the same very large fluffy grey tomcat with a white chest and a small golden bell on his red collar, wearing a pair of small round reading glasses on his nose" };
const brunoCh = read("bruno");
const bruno: EpisodeSeed = {
  seriesId: "bruno-der-flunkerfisch", season: 1, episode: 6, bibleVersion: 2, publishAt,
  title: "Kaisers großer Coup",
  summary: "Alle lachen über Kater Kaiser, weil er schon wieder im Wäschekorb gelandet ist. Da behauptet Frau Grimmbach vor Brunos Glas: „Kaiser kann Maschinen bauen. Das habe ich selbst gesehen.“ Sie weiß genau, dass das nicht stimmt. Prompt wird der Kater ein Genie und baut eine Fisch-Fang-Maschine. Ausgerechnet Grimmbachs Heft verrät, wann er zuschlagen will.",
  guests: [],
  cover: slot(`${b}/cover.webp`, `Cozy apartment living room by the window, a laundry basket on the floor below a wooden shelf. [kater-kaiser] sits proudly on top of ${machine}, one paw on a little crank, steering the top hat on the long pipe high over the round fish tank on the shelf. In the tank [bruno] swims and stares up at the hat. [mats] stands in front of the shelf holding up a metal kitchen colander like a shield, cheeks puffed with determination. [ella] rushes in from the left with both hands raised. Exactly these four figures, each once; the fish stays inside the water of its round tank`, ["kater-kaiser", "bruno", "mats", "ella"],
    { ella: [300, 20, 1000, 230], "kater-kaiser": [420, 240, 1000, 560], mats: [380, 560, 1000, 760], bruno: [150, 730, 480, 960] }, undefined, genius),
  chapters: brunoCh.map((c, i) => ({ ...c, images: i === 0 ? [
    slot(`${b}/ch1.webp`, "Cozy living room in afternoon light, a wooden shelf by the window with a round fish tank on it, a laundry basket full of towels on the floor below. [frau-grimmbach] stands very straight in front of the shelf in three-quarter view, chin raised, her ears red, holding [kater-kaiser] in both arms as carefully as a porcelain vase, declaring something with stern pride. Behind her on the shelf [bruno] swims in his round water-filled glass tank above his tiny stone castle, eyes wide. On the right [mats] doubles over with laughter, pointing at the cat. Exactly these four figures, each once; the fish stays inside the water of its round tank", ["frau-grimmbach", "kater-kaiser", "bruno", "mats"],
      { "frau-grimmbach": [60, 60, 1000, 380], "kater-kaiser": [330, 120, 640, 400], bruno: [180, 430, 520, 660], mats: [400, 700, 1000, 930] }, place(c.text, /Das habe ich selbst gesehen/)),
    slot(`${b}/ch1-2.webp`, "Small family kitchen with a wooden table and a dripping tap. [kater-kaiser] sits upright on the seat of a wooden kitchen chair and holds a big yellow-handled screwdriver firmly in one raised front paw, its metal tip pressed into a screw on the chair's backrest, turning it, utterly calm and focused, like a master craftsman. [papa-brandt] stands beside him, empty-handed, mouth wide open in disbelief. [mats] jumps in the air behind them, cheering with both fists up. Exactly these three figures, each once", ["kater-kaiser", "papa-brandt", "mats"],
      { "papa-brandt": [40, 40, 1000, 340], "kater-kaiser": [380, 360, 1000, 660], mats: [300, 690, 1000, 930] }, place(c.text, /Knirsch/)),
  ] : i === 1 ? [
    slot(`${b}/ch2.webp`, "Old lady's tidy ground-floor living room with an armchair, a lace doily on a low table and patterned wallpaper without any writing. On the carpet lies a small round red canister vacuum cleaner, opened up, its parts spread out, little screws lined up by size on the doily. [kater-kaiser] sits in the middle of the parts with a screwdriver in his paw, busily working, not looking up. [frau-grimmbach] sits on the very edge of her armchair, her small black notebook on her knees, pen in hand, looking down sadly at her own empty lap. In the half-open door on the right [ella] and [mats] peek in, eyes wide. Exactly these four figures, each once", ["kater-kaiser", "frau-grimmbach", "ella", "mats"],
      { "frau-grimmbach": [100, 30, 1000, 330], "kater-kaiser": [480, 340, 1000, 640], ella: [200, 660, 1000, 830], mats: [360, 820, 1000, 980] }, place(c.text, /Lesebrille/), genius),
    slot(`${b}/ch2-2.webp`, `Old lady's ground-floor living room. Behind them stands ${machine}, the top hat on its pipe. [kater-kaiser] stands on his hind legs right next to [mats] and reaches up with one front paw holding a silver paper clip bent into a little fishing hook; on the hook dangles a black electric plug on its cable, which he has just pulled out of the front pocket of Mats's blue shorts, exactly like angling a fish, totally serious. [mats] has both arms in the air and his mouth open in outrage, staring down at the plug coming out of his own pocket. Exactly these two figures, each once`, ["kater-kaiser", "mats"],
      { "kater-kaiser": [450, 120, 1000, 480], mats: [80, 480, 1000, 820] }, place(c.text, /geangelt/), genius),
  ] : [
    slot(`${b}/ch3.webp`, `Apartment living room, a wooden shelf by the window with a round fish tank on it. ${machine} stands right under the shelf, the long silver pipe bends high over the round tank, and the black top hat at its end is tipped on its side like a ladle, hanging in the air clearly above the open top of the tank with a big gap of air between hat and glass. [kater-kaiser] sits on top of the vacuum cleaner, stuck: the open round mouth of the grey suction hose is clamped right onto the small golden bell at his chest, his chin squashed against the hose, eyes wide in surprise, tail straight up. [ella] kneels on the floor beside the machine and reaches for a red button low on its side. In the tank [bruno] does not swim away and stares up at the hat. There is only one single fish tank and only one goldfish in the whole picture, on a low wooden cabinet by the window; no other shelves with jars. Exactly these three figures, each once; the fish stays inside the water of its round tank`, ["kater-kaiser", "ella", "bruno"],
      { ella: [430, 30, 1000, 360], "kater-kaiser": [400, 380, 1000, 700], bruno: [120, 690, 450, 940] }, place(c.text, /Wo ist der Schalter/)),
    slot(`${b}/ch3-2.webp`, "Apartment living room, a laundry basket full of towels on the floor. [frau-grimmbach] stands holding [kater-kaiser] close, the big grey cat nestled with his head pushed under her chin, eyes closed, purring; for the first time she smiles softly, her small black notebook tucked under her arm. [mats] stands beside the laundry basket and looks up at them with a warm, sorry little smile. Exactly these three figures, each once", ["frau-grimmbach", "kater-kaiser", "mats"],
      { "frau-grimmbach": [50, 120, 1000, 500], "kater-kaiser": [200, 200, 560, 470], mats: [400, 600, 1000, 860] }, place(c.text, /kleiner Staubsauger/)),
  ] })),
  collectible: { type: "flunker_card", title: "Flunker-Karte Nr. 6", imageUrl: `${b}/cover.webp`, fields: [
    { label: "Flunkerei", value: "„Kaiser kann Maschinen bauen. Das habe ich selbst gesehen.“" },
    { label: "Wer flunkert", value: "Frau Grimmbach, mit Absicht" },
    { label: "Was wörtlich passiert", value: "Kater Kaiser wird ein Genie. Er repariert Papas Stuhl, angelt Mats den Stecker aus der Tasche und baut aus Grimmbachs Staubsauger, ihren alten Rollschuhen und einem Zylinder eine Fisch-Fang-Maschine." },
    { label: "Die Wahrheit", value: "Kaiser kann keine Maschinen bauen. Er schläft auf der Heizung und fällt in Wäschekörbe. Frau Grimmbach wollte nicht, dass alle über ihn lachen." },
    { label: "Mutmoment", value: "Vor Herrn Brandt und den Kindern zugeben, dass sie mit Absicht geflunkert hat." },
  ] },
  teaser: "Nächsten Freitag: Ella sagt, ihr Papa ist Astronaut. Prompt schweben Papa und die Kaffeetassen durch die Küche. Und irgendwo steckt noch der Zylinder.",
  canonFactsAdded: [],
};

// ---------- Die Monster-Müllabfuhr: S1E6 „Klirrklaus im Keller“ ----------
const m = "/library/series/die-monster-muellabfuhr/s1e6";
const klirrklaus = {
  id: "klirrklaus",
  name: "Klirrklaus",
  role: "Monster aus vergessenen Pfandflaschen in einem Keller, neuer Lagerverwalter der Monster-Pension",
  visualProfileEn: "friendly tall monster made entirely of old empty glass bottles, a little taller than a grown-up woman: a body and two legs of stacked green, brown and clear glass bottles, two long arms made of chains of small bottles, its head one big thick clear glass bottle standing upright with two shiny golden zigzag-edged bottle caps as round eyes; a single golden knitted wool thread tied in a small bow around the neck of the head bottle like a badge; every bottle is plain glass without any label, sticker or writing, slightly dusty",
  referenceUrl: `${m}/klirrklaus.webp`,
};
const cellar = "A dim basement corridor at night with wooden slatted storage compartments, a single bare bulb and a flashlight beam, plain grey walls without any writing";
const crates = "two old red plastic drinks crates standing side by side on the floor, each with a grid of square slots";
const monsterCh = read("monster");
const monster: EpisodeSeed = {
  seriesId: "die-monster-muellabfuhr", season: 1, episode: 6, bibleVersion: 2, publishAt,
  title: "Klirrklaus im Keller",
  summary: "In einem Keller klirrt es jede Nacht, und morgens steht alles in Reihen: die Fahrräder nach Farbe, die Marmelade nach dem Abc. Klirrklaus aus alten Pfandflaschen will Ordnung. Nur welche? Nach Farben ist falsch, nach Größe auch. Und um seinen Hals hängt ein goldener Faden, der Jona bekannt vorkommt.",
  guests: [klirrklaus],
  cover: slot(`${m}/cover.webp`, `${cellar}. [klirrklaus] stands tall in front of a storage compartment and lines up two rubber boots on the floor with great care, his golden bottle-cap eyes worried. [jona] in his orange vest points his flashlight at him, half hiding behind [oma-hilde], who grins bravely with one hand on Jona's shoulder. [flusi] peeks out from behind Jona's boot. Exactly these four figures, each once`, ["klirrklaus", "jona", "oma-hilde", "flusi"],
    { "oma-hilde": [80, 20, 1000, 300], jona: [380, 260, 1000, 480], flusi: [760, 440, 960, 580], klirrklaus: [20, 560, 1000, 940] }),
  chapters: monsterCh.map((c, i) => ({ ...c, images: i === 0 ? [
    slot(`${m}/ch1.webp`, `${cellar}, a wooden shelf with a neat row of small plain jam jars without labels. [klirrklaus] carefully sets [flusi] down on the shelf in the gap between two jam jars, as if Flusi were one more jar. [flusi] sits in the gap with his tiny arms crossed, deeply offended. [jona] in his orange vest stands below with his flashlight and presses a hand over his mouth to keep from laughing; [oma-hilde] behind him raises her eyebrows. Exactly these four figures, each once`, ["klirrklaus", "flusi", "jona", "oma-hilde"],
      { "oma-hilde": [80, 20, 1000, 280], jona: [380, 260, 1000, 470], flusi: [260, 520, 450, 650], klirrklaus: [20, 640, 1000, 960] }, place(c.text, /keine Marmelade/)),
    slot(`${m}/ch1-2.webp`, `${cellar}. A round dark-green monster bin lies tipped over on its side, and dozens of empty green, brown and clear glass bottles without labels roll out of it across the concrete floor in every direction, clinking. In the middle [flusi] tumbles head over heels over one rolling brown bottle. [oma-hilde] leaps back with her arms up in comic surprise; [jona] in his orange vest jumps over a bottle. Exactly these three figures, each once, no monster visible, only the scattered bottles`, ["flusi", "oma-hilde", "jona"],
      { "oma-hilde": [80, 30, 1000, 330], flusi: [520, 400, 780, 600], jona: [330, 650, 1000, 900] }, place(c.text, /Purzelbaum/)),
  ] : i === 1 ? [
    slot(`${m}/ch2.webp`, `${cellar}. On the floor stands one long row of empty glass bottles without labels, sorted from the tallest on the left to the tiniest on the right, like organ pipes; the tallest bottle on the left is a big clear bottle with two golden bottle-cap eyes, bobbing happily along. [oma-hilde] kneels at the row and knocks on the bottles with her knuckles like playing an instrument, singing with her eyes closed. [flusi] stands on an upturned bucket and conducts with both tiny arms. [jona] in his orange vest laughs with his flashlight lowered. Exactly these three figures, each once`, ["oma-hilde", "flusi", "jona"],
      { "oma-hilde": [200, 250, 1000, 620], flusi: [380, 620, 700, 780], jona: [300, 790, 1000, 980] }, place(c.text, /Flaschenorgel/)),
    slot(`${m}/ch2-2.webp`, `${cellar}, an old woollen blanket lifted aside reveals ${crates}, flower pots and old paint tins stuck in their slots. [klirrklaus] bends low over the crates, and the golden wool bow at his bottle neck dangles right in front of [jona]. [jona] in his orange vest holds up a single grey sock with a tiny knitted golden crown on it right next to the golden thread, comparing them with wide eyes. Exactly these two figures, each once`, ["klirrklaus", "jona"],
      { klirrklaus: [20, 380, 1000, 900], jona: [330, 60, 1000, 400] }, place(c.text, /Genauso kraus|Sogar genauso kraus/)),
  ] : [
    slot(`${m}/ch3.webp`, `${cellar}. On the floor stand ${crates}, every slot filled with a clean empty glass bottle without a label, and in the middle of the right crate stands one big clear bottle with two golden bottle-cap eyes and a golden wool bow around its neck, peeking out; one single slot in the corner is still empty. [oma-hilde] pulls a tiny glass bottle out of her leather jacket pocket with a sheepish grin. [jona] in his orange vest points at the empty slot. [flusi] sits beside the crates wearing a long grey dust beard down to the floor. Exactly these three figures, each once`, ["oma-hilde", "jona", "flusi"],
      { "oma-hilde": [80, 20, 1000, 320], jona: [350, 300, 1000, 500], flusi: [700, 840, 960, 990] }, place(c.text, /Mein Mikro/)),
    slot(`${m}/ch3-2.webp`, "Small storeroom of the monster pension with tidy shelves, nested buckets, brooms against the wall and a neat stack of blankets, plain painted walls without any writing, warm lamplight. [klirrklaus] hangs a small orange high-visibility vest on a hook beside the door with one bottle-chain arm, and below the hook stand a pair of small yellow rubber boots side by side. [jona], in his blue hoodie and socks, without vest and boots, looks up at his own hook with a shy, happy smile. Exactly these two figures, each once", ["klirrklaus", "jona"],
      { jona: [380, 60, 1000, 380], klirrklaus: [20, 440, 1000, 900] }, place(c.text, /„Jona“, klirrte er/), { jona: "his blue hoodie, grey socks, no vest and no boots on" }),
  ] })),
  collectible: { type: "monster_profile", title: "Monster-Steckbrief Nr. 6", imageUrl: `${m}/klirrklaus.webp`, fields: [
    { label: "Name", value: "Klirrklaus" },
    { label: "Ursprung", value: "Vergessene Pfandflaschen in einem Keller, die jemand aus ihren Kästen genommen hatte" },
    { label: "Schwäche", value: "Wird ruhig, wenn jede Flasche in ihrem Pfandkasten steht" },
    { label: "Fangtrick", value: "Jede Flasche in ihr Fach. Auch Omas Mikro." },
    { label: "Job in der Pension", value: "Lagerverwalter: merkt sofort, wenn etwas fehlt" },
  ] },
  teaser: "Nächste Woche: Ein Monster aus verknoteten Ladekabeln. Je mehr man sich beeilt, desto fester zieht es sich zu. Und Mama Sina fährt mit.",
  canonFactsAdded: [],
};

const factsPath = join(docs, "kanon.json");
const facts = existsSync(factsPath) ? (JSON.parse(readFileSync(factsPath, "utf8")) as Record<string, string[]>) : { bruno: [], monster: [] };
bruno.canonFactsAdded = facts.bruno;
monster.canonFactsAdded = facts.monster;
for (const episode of [bruno, monster]) {
  for (const chapter of episode.chapters) chapter.image = chapter.images![0];
  const path = join(root, `backend/story/library/seed/episodes/${episode.seriesId}.s1e6.json`);
  writeFileSync(path, JSON.stringify(episode, null, 2) + "\n");
  console.log(`${episode.title}: ${episode.chapters.map((c) => c.text.split(/\s+/).length).join(" + ")} Wörter; Bildpositionen ${episode.chapters.map((c) => `${c.images!.map((s) => s.afterParagraph).join("/")} von ${c.text.split(/\n\n/).length}`).join(", ")}`);
}
