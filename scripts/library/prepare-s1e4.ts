/**
 * Assemble the S1E4 seeds of both Originals series (Friday 2026-11-06): texts written by
 * Claude, counter-read and revised by GPT-6.1 Sol via Codex, plus scene-specific FLUX direction.
 *
 *   bun run scripts/library/prepare-s1e4.ts            # reads docs/talea-originals/2026-11-06/<key>.lektoriert.txt
 *   bun run scripts/library/prepare-s1e4.ts --from v3  # reads <key>.v3.txt instead (layout and picture check before the final edit)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { parseChapters } from "../../backend/story/library/engine";
import type { EpisodeSeed, ImageSlot } from "../../backend/story/library/types";

const root = resolve(import.meta.dir, "../..");
const docs = join(root, "docs/talea-originals/2026-11-06");
const fromAt = process.argv.indexOf("--from");
const suffix = fromAt > 0 ? process.argv[fromAt + 1] : "lektoriert";
const read = (key: string) => parseChapters(readFileSync(join(docs, `${key}.${suffix}.txt`), "utf8"));
const publishAt = "2026-11-06T14:00:00.000Z";
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

// ---------- Bruno, der Flunkerfisch: S1E4 „Mats kommt nicht runter“ ----------
const b = "/library/series/bruno-der-flunkerfisch/s1e4";
const jacket = { mats: "a green zip-up jacket worn open over his orange dinosaur T-shirt, a drawstring cord with two round toggles hanging from the jacket's bottom hem, blue shorts over striped leggings, only socks on his feet, one sock slipping half off" };
const brunoCh = read("bruno");
const bruno: EpisodeSeed = {
  seriesId: "bruno-der-flunkerfisch", season: 1, episode: 4, bibleVersion: 2, publishAt,
  title: "Mats kommt nicht runter",
  summary: "Mats soll die Sachen vom hohen Schrank holen. Stattdessen behauptet er vor Brunos Glas: „Ich kann fliegen!“ Fliegen kann er jetzt wirklich. Landen leider nicht. Und Lia steht unten und hat eine sehr praktische Frage.",
  guests: [
    { id: "lia", name: "Lia", role: "Mats' Freundin aus der Klasse; baut Bühnen und macht Geräusche mit der Zunge", visualProfileEn: "six-year-old girl with warm tan skin, straight chin-length black bob haircut, lively dark eyes, teal dungarees over a cream long-sleeve shirt, red sneakers, a small plain red toy toolbox used as a pencil case", referenceUrl: "/library/series/bruno-der-flunkerfisch/s1e3/lia.webp" },
  ],
  cover: slot(`${b}/cover.webp`, "Cozy apartment living room in warm afternoon light. [mats] floats high under the ceiling like a balloon and clings with both hands to the curtain rod above the window, eyes squeezed shut, his sock feet dangling in the air. [ella] stands on a small stepladder below him and holds the drawstring cord at the bottom hem of his jacket. [lia] stands on the carpet next to a big soft pile of sofa cushions with a beanbag on top and looks up at Mats with her head tilted. [bruno] swims in his round water-filled glass tank on the shelf right under the window and peers up at Mats. Exactly these four figures, each once, a funny and warm moment", ["mats", "ella", "lia", "bruno"],
    { mats: [20, 420, 470, 650], ella: [250, 170, 1000, 410], lia: [430, 700, 1000, 900], bruno: [520, 470, 820, 660] }, undefined, jacket),
  chapters: brunoCh.map((c, i) => ({ ...c, images: i === 0 ? [
    slot(`${b}/ch1.webp`, "Cozy living room in afternoon light. [mats] flies joyfully through the air above the sofa, turning a somersault with his arms spread wide, his sock feet up in the air, a fan of small plain white cards in one hand like a magician. [ella] stands below on the carpet in her red round glasses, her mouth open in astonishment, a closed planner under one arm and a bouncy ball in her hand. [bruno] presses his mouth against the inside of his round water-filled glass tank on the shelf by the window, looking thoroughly unimpressed. Exactly these three figures, each once", ["mats", "ella", "bruno"],
      { mats: [30, 330, 520, 680], ella: [420, 60, 1000, 320], bruno: [420, 720, 780, 950] }, place(c.text, /Ich FLIEGE/), jacket),
    slot(`${b}/ch1-2.webp`, "Close view of a living room window and the shelf under it. On the shelf stands a round glass fish tank full of water, and [bruno] swims INSIDE the water of that tank above his tiny stone castle, looking up in surprise at three small plain white cards floating on the water surface above him. More plain white cards flutter down through the air like autumn leaves. High above the tank [mats] floats right under the ceiling, grabbing the curtain rod with both hands and looking down in fright with wide eyes, his sock feet dangling in the air. Mats appears exactly once, up at the curtain rod; on the shelf stands only the fish tank. Exactly these two figures, each once; the fish stays inside the water of its round tank", ["mats", "bruno"],
      { mats: [0, 280, 470, 700], bruno: [580, 400, 900, 640] }, place(c.text, /Plitsch/), jacket),
  ] : i === 1 ? [
    slot(`${b}/ch2.webp`, "Living room window, close view. [ella] stands on a small stepladder and pulls gently at the drawstring cord hanging from the bottom hem of the green jacket of [mats], who floats right under the ceiling and clings stubbornly to the curtain rod, eyes squeezed shut. One side of the curtain has slid down and lies over the round fish tank on the shelf like a bride's veil; [bruno] peeks out grumpily from beneath it. Exactly these three figures, each once", ["ella", "mats", "bruno"],
      { ella: [250, 100, 1000, 400], mats: [0, 420, 460, 700], bruno: [520, 600, 860, 860] }, place(c.text, /keine Braut/), jacket),
    slot(`${b}/ch2-2.webp`, "Cozy living room seen from the side, the door to the hall open on the left. [papa-brandt] has just stepped in, shown in side view, his head tilted far back and his chin up, staring at the ceiling in calm astonishment; on his feet he wears one brown slipper and one plain sock. Next to him [lia], also in side view, carries her one single small red toolbox in her left hand and tilts her head back to look up at the ceiling too. Low on the floor behind their legs [kater-kaiser], a very large fluffy grey cat with a golden bell, slinks into the room in side view, belly low, eyes fixed on the shelf by the window, where [bruno] swims in his open round water-filled glass tank above his tiny stone castle and blows bubbles in alarm. Exactly these four figures, each once; everyone's eyes are on the ceiling or on the tank", ["papa-brandt", "lia", "kater-kaiser", "bruno"],
      { "papa-brandt": [60, 80, 1000, 380], lia: [380, 400, 1000, 580], "kater-kaiser": [640, 560, 1000, 800], bruno: [220, 780, 560, 980] }, place(c.text, /Er sah sehr lange nach oben/)),
  ] : [
    slot(`${b}/ch3.webp`, "Living room. On the FLOOR under the window lies a big soft landing pile of sofa cushions and a blanket with a brown beanbag on top. [mats] hovers in the air a hand's width above the beanbag, sinking slowly like a balloon on a string, one eye open, looking at Lia. [ella] stands halfway down a small stepladder and lowers him gently by the drawstring cord at his jacket's hem. [papa-brandt] holds the ladder steady with both hands. [lia] stands beside the pile, one hand raised like a train conductor, her lips pursed to make a soft clicking train sound. Exactly these four figures, each once", ["lia", "mats", "ella", "papa-brandt"],
      { "papa-brandt": [220, 20, 1000, 230], ella: [180, 240, 1000, 450], mats: [120, 470, 640, 680], lia: [380, 720, 1000, 920] }, place(c.text, /Gleis eins/), jacket),
    slot(`${b}/ch3-2.webp`, "Living room. [kater-kaiser], a very large fluffy grey cat with a golden bell on a red collar, crouches stiffly on the top step of a small stepladder next to the shelf by the window, his tail puffed up like a bottle brush, his eyes wide and nervous, looking down. [mats] stands on the floor at the foot of the ladder with only one foot on the lowest step and stretches both arms up toward the cat, talking to him calmly. [ella] and [lia] hold the ladder steady on both sides. Exactly these four figures, each once", ["kater-kaiser", "mats", "ella", "lia"],
      { "kater-kaiser": [0, 390, 360, 620], ella: [300, 130, 1000, 370], mats: [470, 400, 1000, 620], lia: [400, 650, 1000, 860] }, place(c.text, /Guck mich an\.“$|einen Fuß auf die unterste Stufe/), jacket),
  ] })),
  collectible: { type: "flunker_card", title: "Flunker-Karte Nr. 4", imageUrl: `${b}/ch1.webp`, fields: [
    { label: "Flunkerei", value: "„Ich brauch keine Leiter. Ich kann fliegen!“" },
    { label: "Wer flunkert", value: "Mats" },
    { label: "Was wörtlich passiert", value: "Mats kann fliegen. Landen kann er nicht: Er steigt wie ein Luftballon zur Decke und hält sich an der Gardinenstange fest." },
    { label: "Die Wahrheit", value: "Mats kann nicht fliegen. Er wollte nicht auf die Leiter, weil er Angst vor oben hat." },
    { label: "Mutmoment", value: "Erst um Hilfe bitten, dann auf dem Sitzsack die Wahrheit sagen. Und danach freiwillig die Angst vor oben zugeben." },
  ] },
  teaser: "Nächsten Freitag: Oma Rosi sagt vor Brunos Glas, sie ist zwanzig. Plötzlich stimmt das. Und sie will unbedingt Rollschuh fahren.",
  canonFactsAdded: [],
};

// ---------- Die Monster-Müllabfuhr: S1E4 „Alarm in der Turnhalle“ ----------
const m = "/library/series/die-monster-muellabfuhr/s1e4";
const monsterCh = read("monster");
const monster: EpisodeSeed = {
  seriesId: "die-monster-muellabfuhr", season: 1, episode: 4, bibleVersion: 2, publishAt,
  title: "Alarm in der Turnhalle",
  summary: "Vor der Pension sind riesige Abdrücke wie von nassen Socken. Doch erst ruft die Turnhalle: Dort pupst ein Monster aus vergessenen Turnbeuteln die Bälle durch die Halle. Hinterherrennen hilft nicht. Jona braucht einen Plan, eine Trillerpfeife und zwölf Fenster.",
  guests: [
    { id: "pupsmonster", name: "Pupsmonster", role: "Monster aus vergessenen Turnbeuteln, neuer Lüftungswart der Monster-Pension", visualProfileEn: "friendly clumsy monster made entirely of cloth: a lumpy bundle of drawstring gym bags knotted together, a big red gym bag as its round head and middle with smaller blue, green and yellow gym bags around it, loose white drawstring cords looping up from the top like messy hair, two round shiny metal eyelets as eyes, a wide happy mouth, blue mitten-like cloth hands, short green cloth legs in two old worn white sneakers, about as tall as a seven-year-old child", referenceUrl: `${m}/pupsmonster.webp` },
    { id: "kruemelkrake", name: "Krümelkrake", role: "Küchenhilfe der Pension aus Folge 3", visualProfileEn: "friendly little octopus monster made entirely of golden toasted bread crumbs, a rounded bread-crumb head the size of a sofa cushion, two expressive black button eyes, a tiny smiling mouth, exactly eight soft flexible bread-crumb arms with tiny sesame seeds and rough crust tips, cozy funny expressive creature, neither squid nor real seafood", referenceUrl: "/library/series/die-monster-muellabfuhr/s1e3/kruemelkrake.webp" },
    { id: "socken-schnueffler", name: "Socken-Schnüffler", role: "Sockenpaar-Sortierer der Pension aus Folge 1, sammelt Socken ohne Partner", visualProfileEn: "friendly dog-sized creature made entirely of mismatched single socks, long striped sock-tip snout, two black button eyes, floppy soft sock body", referenceUrl: "/library/series/die-monster-muellabfuhr/s1e1/socken-schnueffler.webp" },
  ],
  cover: slot(`${m}/cover.webp`, "Big school gym at night, moonlight falling through a row of high narrow windows, the first ones already open, climbing ropes swaying. [jona] in his orange vest stands in the middle of the hall with a whistle between his teeth, counting on his fingers. [oma-hilde] reaches up with a long window pole to crank open the next high window. [pupsmonster] perches on top of a basketball hoop, its gym bags puffed up, watching them curiously. Exactly these three figures, each once, a playful night adventure", ["jona", "oma-hilde", "pupsmonster"],
    { "oma-hilde": [120, 40, 1000, 330], jona: [380, 400, 1000, 580], pupsmonster: [0, 660, 440, 900] }),
  chapters: monsterCh.map((c, i) => ({ ...c, images: i === 0 ? [
    slot(`${m}/ch1.webp`, "Night in a depot yard in front of a green wooden door with a small flap at its bottom. In the wet dark sand lies a trail of large smooth oval imprints, each one a single soft rounded dent with blurry edges, like a foot in a wet sock pressed into the sand, leading from the yard gate to the flap. [jona] crouches with a flashlight and has put his foot in its small yellow rubber boot right next to one imprint; the imprint is clearly longer than the boot. [oma-hilde] stands behind him holding two cocoa mugs and stares at the imprints with raised eyebrows. Exactly these two figures; the smooth imprints are the only trace of anyone else", ["jona", "oma-hilde"],
      { jona: [380, 120, 1000, 470], "oma-hilde": [100, 560, 1000, 830] }, place(c.text, /Gummistiefel daneben/)),
    slot(`${m}/ch1-2.webp`, "Night in the depot yard. [kruemelkrake], a golden bread-crumb octopus, leans out of the open green door and holds a mixing bowl in each of several arms. Together with [jona] she places the bowls upside down over the big round footprints in the sand; a row of bowls already covers the first prints. Exactly these two figures, each once, busy and cheerful", ["kruemelkrake", "jona"],
      { kruemelkrake: [200, 40, 950, 470], jona: [320, 560, 1000, 800] }, place(c.text, /Rührschüssel/)),
  ] : i === 1 ? [
    slot(`${m}/ch2.webp`, "Dark indoor school gym at night with plain painted walls. [pupsmonster] sits on top of the tall wooden wall bars, bouncing happily while a puff of air blows out of its gym bags and sends a ball rolling. Across the hall the small grey dust bunny [flusi] hangs tangled in the net of a basketball hoop. [oma-hilde] runs with an empty round monster bin; [jona] pinches his nose shut with his fingers and pulls a funny face. Exactly these four figures, each once, funny chaos with swinging climbing ropes", ["pupsmonster", "flusi", "oma-hilde", "jona"],
      { pupsmonster: [0, 20, 460, 290], flusi: [40, 760, 280, 900], "oma-hilde": [280, 330, 1000, 590], jona: [430, 620, 1000, 780] }, place(c.text, /Flusi hängt/)),
    slot(`${m}/ch2-2.webp`, "Inside a big indoor school gym at night with a high ceiling and plain painted walls, moonlight falling through high windows. [oma-hilde] sprays a big pale pink cloud from a plain spray can decorated with one painted flower up toward a basketball hoop, holding her nose with her other hand. On top of the hoop [pupsmonster] puffs up all its gym bags like balloons, about to let out an enormous gust. [jona] watches with both hands over his nose and red ears. Exactly these three figures, each once", ["oma-hilde", "pupsmonster", "jona"],
      { "oma-hilde": [180, 80, 1000, 380], jona: [400, 430, 1000, 610], pupsmonster: [0, 620, 450, 900] }, place(c.text, /PRRRÖÖÖ/)),
  ] : [
    slot(`${m}/ch3.webp`, "Inside a big school gym at night with plain painted walls. On the left the wide open double doors of the hall; in the doorway stands [gertrud], the small purple garbage truck with friendly headlight eyes, all alone with nobody inside or beside her, reaching her own long flexible vacuum trunk into the hall by herself and blowing a strong stream of fresh night air with a few leaves in it. In the middle of the hall [pupsmonster] floats down gently from the basketball hoop, limp and soft like an empty pillowcase, its drawstring cords fluttering, eyes half closed blissfully. [jona] stands on the floor with a whistle in his mouth and both arms raised. [oma-hilde] holds a long window pole up at the high open windows on the right. Exactly these four figures, each once", ["gertrud", "pupsmonster", "jona", "oma-hilde"],
      { gertrud: [300, 0, 1000, 300], pupsmonster: [0, 380, 450, 640], jona: [480, 420, 1000, 600], "oma-hilde": [120, 720, 1000, 960] }, place(c.text, /leichter? wie ein leerer Kissenbezug|segelte vom Korb/)),
    slot(`${m}/ch3-2.webp`, "Pre-dawn in the depot yard in front of the green door, a few upturned mixing bowls stacked aside. [kruemelkrake] holds a baking tray full of flour with two arms. [socken-schnueffler], a dog-sized creature made of socks, has just stepped from the flour into the sand and left small white round dabs right next to a much bigger dark round footprint. [jona] crouches with a flashlight and compares the small white prints with the big dark one. [pupsmonster], clean and fluffy, watches curiously. Exactly these four figures, each once, cozy detective mood", ["kruemelkrake", "socken-schnueffler", "jona", "pupsmonster"],
      { kruemelkrake: [180, 0, 950, 290], "socken-schnueffler": [480, 300, 1000, 520], jona: [330, 540, 1000, 760], pupsmonster: [200, 790, 1000, 990] }, place(c.text, /Keine passte|Keiner von unseren Gästen/)),
  ] })),
  collectible: { type: "monster_profile", title: "Monster-Steckbrief Nr. 4", imageUrl: `${m}/pupsmonster.webp`, fields: [
    { label: "Name", value: "Pupsmonster" },
    { label: "Ursprung", value: "Vergessene Turnbeutel aus der Fundkiste einer Turnhalle" },
    { label: "Schwäche", value: "Echte frische Luft" },
    { label: "Fangtrick", value: "Durchzug: zwölf Fenster auf, dann pustet Gertrud durchs Hallentor. Nicht hinterherrennen." },
    { label: "Job in der Pension", value: "Lüftungswart: merkt, wenn es an der Klappe zieht" },
  ] },
  teaser: "Nächste Woche: Im Gemüseladen wartet etwas Grünes. Es will, dass alle probieren. Und Flusi niest bei einem ganz bestimmten Wort.",
  canonFactsAdded: [],
};

const facts = JSON.parse(readFileSync(join(docs, "kanon.json"), "utf8")) as Record<string, string[]>;
bruno.canonFactsAdded = facts.bruno;
monster.canonFactsAdded = facts.monster;
for (const episode of [bruno, monster]) {
  for (const chapter of episode.chapters) chapter.image = chapter.images![0];
  const path = join(root, `backend/story/library/seed/episodes/${episode.seriesId}.s1e4.json`);
  writeFileSync(path, JSON.stringify(episode, null, 2) + "\n");
  console.log(`${episode.title}: ${episode.chapters.map((c) => c.text.split(/\s+/).length).join(" + ")} Wörter; Bildpositionen ${episode.chapters.map((c) => `${c.images!.map((s) => s.afterParagraph).join("/")} von ${c.text.split(/\n\n/).length}`).join(", ")}`);
}
