/**
 * Assemble the S1E8 seeds of both Originals series (Friday 2026-12-04): texts written by
 * Claude, counter-read and revised by GPT-6.2 Sol (Codex subscription, final grade at least 8),
 * plus scene-specific FLUX direction.
 *
 *   bun run scripts/library/prepare-s1e8.ts            # reads docs/talea-originals/2026-12-04/<key>.lektoriert.txt
 *   bun run scripts/library/prepare-s1e8.ts --from v2  # reads <key>.v2.txt instead (pictures before the final edit)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { parseChapters } from "../../backend/story/library/engine";
import type { EpisodeSeed, ImageSlot } from "../../backend/story/library/types";

const root = resolve(import.meta.dir, "../..");
const docs = join(root, "docs/talea-originals/2026-12-04");
const fromAt = process.argv.indexOf("--from");
const suffix = fromAt > 0 ? process.argv[fromAt + 1] : "lektoriert";
/** Falls back to the edited text when a series has no file with the requested suffix. */
const read = (key: string) => {
  const wanted = join(docs, `${key}.${suffix}.txt`);
  return parseChapters(readFileSync(existsSync(wanted) ? wanted : join(docs, `${key}.lektoriert.txt`), "utf8"));
};
const publishAt = "2026-12-04T14:00:00.000Z";
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

// ---------- Bruno, der Flunkerfisch: S1E8 „Der Geburtstag, der nie endet“ ----------
const b = "/library/series/bruno-der-flunkerfisch/s1e8";
const lia = {
  id: "lia",
  name: "Lia",
  role: "Mats' Freundin aus der Klasse; baut Bühnen und macht Geräusche mit der Zunge",
  visualProfileEn: "six-year-old girl with warm tan skin, straight chin-length black bob haircut, lively dark eyes, teal dungarees over a cream long-sleeve shirt, red sneakers, a small plain red toy toolbox used as a pencil case",
  referenceUrl: "/library/series/bruno-der-flunkerfisch/s1e3/lia.webp",
};
const hat = "a small plain paper party hat on his head";
const matsParty = { mats: `${hat}, his orange dinosaur T-shirt, blue shorts over striped leggings, one sock slipping down` };
const parcel = "a big flat parcel wrapped in plain brown paper and tied with a string bow";
const stage = "a small handmade cardboard puppet stage with a red paper curtain held by paper clips";
const party = "Cozy apartment living room decorated for a child's birthday with plain balloons and a garland of plain colored paper triangles, a sofa, a wooden shelf by the window with one round fish tank on it";
/** The same room seen toward the sofa side; the fish tank stays out of frame (without [bruno] FLUX fills it with a stranger). */
const partySofa = "Cozy apartment living room decorated for a child's birthday with plain balloons and a garland of plain colored paper triangles, a big sofa, plain walls";
const brunoCh = read("bruno");
const bruno: EpisodeSeed = {
  seriesId: "bruno-der-flunkerfisch", season: 1, episode: 8, bibleVersion: 2, publishAt,
  title: "Der Geburtstag, der nie endet",
  summary: "Mats wird sieben, und seine Freundin Lia erzählt von Finns Feier mit Hüpfburg und Zauberer. Da flunkert Mats vor Brunos Glas: „Heute beginnt meine Geburtstagsfeier jede Stunde wieder ganz von vorn!“ Jede Stunde gibt es wieder Geschenke und Torte. Nach der vierten Torte will keiner mehr feiern. Und vor dem Haus steht der Mann mit dem Fischhut.",
  guests: [lia],
  cover: slot(`${b}/cover.webp`, `${party}. [mats] stands on the sofa and cheers with both arms up while sheets of brown wrapping paper fly up from the floor by magic and wrap themselves around the presents on the table. [lia] stands beside the sofa holding ${parcel} and laughs. On the shelf [bruno] swims in his round water-filled glass tank above his tiny stone castle and rolls his eyes. Only one boy and only one girl in the whole picture. Exactly these three figures, each once; the fish stays inside the water of its round tank`, ["mats", "lia", "bruno"],
    { mats: [80, 300, 800, 620], lia: [360, 30, 1000, 290], bruno: [150, 700, 480, 950] }, undefined, matsParty),
  chapters: brunoCh.map((c, i) => ({ ...c, images: i === 0 ? [
    slot(`${b}/ch1.webp`, `${party}. [mats] stands right in front of the shelf with the round fish tank, puffs out his chest and spreads both arms wide like a showman, boasting. [lia] stands facing him with ${parcel} in her arms and tilts her head. [ella] behind them presses her red notebook to her chest, eyes wide in alarm. On the shelf [bruno] swims in his round water-filled glass tank above his tiny stone castle with his mouth pressed shut. Everyone looks at Mats, not at the viewer. Exactly these four figures, each once; the fish stays inside the water of its round tank`, ["mats", "lia", "ella", "bruno"],
      { ella: [200, 20, 1000, 250], lia: [330, 260, 1000, 500], mats: [300, 500, 1000, 740], bruno: [120, 760, 450, 980] }, place(c.text, /jede Stunde wieder ganz von vorn/), matsParty),
    slot(`${b}/ch1-2.webp`, `${partySofa}. On the rug lies ${stage}, its curtain still closed. [lia] kneels beside it holding the curtain string, looking up with her mouth half open as if she was about to explain something. [mats] already runs away toward the kitchen door holding a big cooking pot above his head, laughing, his back half turned to her. Only one boy and only one girl in the whole picture. Exactly these two figures, each once`, ["lia", "mats"],
      { lia: [380, 40, 1000, 420], mats: [150, 560, 1000, 940] }, place(c.text, /Der Vorhang blieb geschlossen/), matsParty),
  ] : i === 1 ? [
    slot(`${b}/ch2.webp`, `${partySofa}. On the rug lies a big heap of torn brown wrapping paper, and an upturned cooking pot stands beside it. [mats] kneels at the heap and lifts out [kater-kaiser] with both arms, surprised and laughing; the big grey cat hangs stiffly in his arms, chin raised high, eyes half-closed in deeply offended royal dignity, a scrap of brown paper stuck on one ear. [oma-rosi] stands behind them with a wooden spoon in her hand and a blindfold scarf pushed up on her forehead, laughing out loud. Only one boy and only one cat in the whole picture. Exactly these three figures, each once`, ["mats", "kater-kaiser", "oma-rosi"],
      { "oma-rosi": [40, 40, 1000, 360], mats: [380, 400, 1000, 760], "kater-kaiser": [420, 520, 900, 820] }, place(c.text, /Heraus kam Kaiser/), matsParty),
    slot(`${b}/ch2-2.webp`, "Inner courtyard of a tall old four-storey apartment house at dusk, a laundry pole, an open courtyard gate. [fischhut-mann] stands by the gate, seen from the side, his head tilted far back, gazing up at one single warmly lit window high up on the third floor, glowing orange like a little lantern. He stands quite still, hands clasped behind his back. Only one man in the whole picture. Exactly this one figure", ["fischhut-mann"],
      { "fischhut-mann": [250, 80, 1000, 420] }, place(c.text, /Der Mann vom Flohmarkt/)),
  ] : [
    slot(`${b}/ch3.webp`, `${partySofa}. On the low table in front of the sofa stands a whole untouched chocolate birthday cake with a little green sugar dinosaur on top. [oma-rosi] has fallen asleep on the sofa in her socks, a paper party hat slipping sideways. [papa-brandt] sits on the sofa armrest in a cream-smeared apron, holding his full belly. [lia] sits quietly at the very end of the sofa with ${parcel} on her lap. [mats] stands in front of them all and looks at his tired guests, thoughtful, his party hat crooked. Exactly these four figures, each once`, ["oma-rosi", "papa-brandt", "lia", "mats"],
      { "papa-brandt": [60, 20, 900, 260], "oma-rosi": [380, 230, 1000, 520], lia: [420, 520, 1000, 730], mats: [300, 740, 1000, 980] }, place(c.text, /Nicht mal Tk/), matsParty),
    slot(`${b}/ch3-2.webp`, "Inner courtyard of an old small-town apartment house in the evening, an open courtyard gate. [mats] holds out a plate with a big slice of chocolate birthday cake with both hands to [fischhut-mann], who bends a little toward him and takes it carefully, smiling into his long grey beard. [ella] stands beside her brother and looks up at the old man with a serious question in her eyes. Nobody looks at the viewer. Only one boy and only one girl in the whole picture. Exactly these three figures, each once", ["mats", "fischhut-mann", "ella"],
      { "fischhut-mann": [40, 520, 1000, 900], mats: [400, 250, 1000, 520], ella: [320, 30, 1000, 260] }, place(c.text, /Ich bin sieben/), matsParty),
  ] })),
  collectible: { type: "flunker_card", title: "Flunker-Karte Nr. 8", imageUrl: `${b}/cover.webp`, fields: [
    { label: "Flunkerei", value: "„Heute beginnt meine Geburtstagsfeier jede Stunde wieder ganz von vorn!“" },
    { label: "Wer flunkert", value: "Mats" },
    { label: "Was wörtlich passiert", value: "Jede Stunde stehen die Gäste wieder unten vor der Haustür, die Geschenke sind wieder eingepackt, und die Torte ist wieder ganz. Nach der vierten Torte will keiner mehr feiern." },
    { label: "Die Wahrheit", value: "Mats' Feier fängt nicht jede Stunde von vorn an. Er wollte, dass Lia sie so toll findet wie Finns Feier mit Hüpfburg." },
    { label: "Mutmoment", value: "Selbst merken, wie müde die Gäste sind, und ohne Drängeln die Wahrheit sagen." },
  ] },
  teaser: "Nächsten Freitag: Mats ist sauer und sagt etwas über Bruno, das nicht stimmt. Plötzlich ist Bruno alles egal. Sogar die Extra-Flocken.",
  canonFactsAdded: [],
};

// ---------- Die Monster-Müllabfuhr: S1E8 „Gertrud ist weg!“ ----------
const m = "/library/series/die-monster-muellabfuhr/s1e8";
const knaeuelbande = {
  id: "knaeuelbande",
  name: "Die Knäuelbande",
  role: "Drei kleine Wollknäuel aus vergessenen Strickresten, neue Strickwerkstatt der Monster-Pension",
  visualProfileEn: "three small friendly monsters side by side, each one simply a round, neatly wound ball of soft knitting yarn small enough to hold in one hand: one red, one yellow, one blue, each with two tiny shiny black button eyes and one loose yarn end trailing behind it on the ground like a little tail; just smooth round balls of plain single-colored yarn",
  referenceUrl: `${m}/knaeuelbande.webp`,
};
const klirrklaus = {
  id: "klirrklaus",
  name: "Klirrklaus",
  role: "Lagerverwalter der Pension aus Folge 6",
  visualProfileEn: "friendly tall monster made entirely of old empty glass bottles, a little taller than a grown-up woman: a body and two legs of stacked green, brown and clear glass bottles, two long arms made of chains of small bottles, its head one big thick clear glass bottle standing upright with two shiny golden zigzag-edged bottle caps as round eyes; a single golden knitted wool thread tied in a small bow around the neck of the head bottle like a badge; every bottle is plain glass without any label, sticker or writing",
  referenceUrl: "/library/series/die-monster-muellabfuhr/s1e6/klirrklaus.webp",
};
const kabelsalat = {
  id: "kabelsalat",
  name: "Kabelsalat",
  role: "Elektriker der Pension aus Folge 7",
  visualProfileEn: "friendly monster made of one big tangled ball of old charging cables in black, white and grey, about the size of a beanbag, many small cable plugs sticking out of the tangle like little spikes, two plugs on top wiggling like feelers, two big round friendly eyes peeking out of the knot; plain cables without any writing, no sparks, no electricity, nothing plugged in",
  referenceUrl: "/library/series/die-monster-muellabfuhr/s1e7/kabelsalat.webp",
};
const omaNight = { "oma-hilde": "an energetic grandmother around 68, a tall grown-up woman with adult height, short spiky grey hair with one purple streak, a black leather jacket with patches worn over striped pyjamas, black rubber boots" };
const yard = "Night on a depot yard behind a train station, wet asphalt shining after rain, a small building with a green door and a small flap in it, an open yard gate";
const backyard = "Small cobbled backyard at night between old brick buildings, lit by one street lamp";
const monsterCh = read("monster");
const monster: EpisodeSeed = {
  seriesId: "die-monster-muellabfuhr", season: 1, episode: 8, bibleVersion: 2, publishAt,
  title: "Gertrud ist weg!",
  summary: "Mitten in der Nacht ist Gertrud verschwunden. Am Hoftor lehnt ein gestricktes Warndreieck, und ein roter Wollfaden führt in die Dunkelheit. Ohne Wagen, ohne Tonnen und ohne Musik folgt die Crew der Spur zu Fuß, und die Gäste der Pension helfen mit. Wer hat Gertrud mit einer falschen Panne weggelockt? Und für wen?",
  guests: [knaeuelbande, klirrklaus, kabelsalat],
  cover: slot(`${m}/cover.webp`, `${backyard}. A red plastic crate divided into many small square compartments like an egg box, every compartment empty, stands tilted forward on the cobbles. [klirrklaus] stands behind it and holds it tilted with both bottle-chain arms. Toward its low front edge rolls [knaeuelbande] in a little row like a tiny train. [jona] in his orange vest kneels beside the crate and reaches into it with one hand, smiling. Exactly these figures, each once`, ["knaeuelbande", "klirrklaus", "jona"],
    { klirrklaus: [40, 20, 1000, 340], knaeuelbande: [560, 330, 1000, 700], jona: [380, 700, 1000, 960] }),
  chapters: monsterCh.map((c, i) => ({ ...c, images: i === 0 ? [
    slot(`${m}/ch1.webp`, `${yard}. On the wet ground there is one empty dry rectangle where a truck was parked. Right in front of the open gate lies one single small knitted red warning triangle made of wool, the only triangle in the whole picture, and a single red yarn thread runs from it out through the gate into the dark street. [jona] in his orange vest crouches right in front of the triangle, the bright beam of his flashlight pointing straight down onto the triangle, frowning at it. [oma-hilde] stands behind him with wide frightened eyes and raised eyebrows, one hand pressed to her mouth, not smiling at all. Exactly these two figures, each once`, ["jona", "oma-hilde"],
      { "oma-hilde": [80, 80, 1000, 420], jona: [460, 480, 1000, 860] }, place(c.text, /Ein Warndreieck/), omaNight),
    slot(`${m}/ch1-2.webp`, `${yard}. In the open green door stands [klirrklaus], holding out an empty red plastic bottle crate with many small square compartments. In front of him [kabelsalat] rolls over the doorstep, its two plug feelers wiggling. [jona] in his orange vest stands in the yard with [flusi] sitting on his shoulder and nods bravely. Exactly these four figures, each once`, ["klirrklaus", "kabelsalat", "jona", "flusi"],
      { klirrklaus: [20, 30, 1000, 360], kabelsalat: [520, 360, 1000, 660], jona: [300, 680, 1000, 940], flusi: [300, 760, 480, 900] }, place(c.text, /Kasten\. Statt Tonne/)),
  ] : i === 1 ? [
    slot(`${m}/ch2.webp`, "Empty street behind a train station at night, old street lamps, wet cobbles. A single red yarn thread runs along the pavement, and at the street corner stands a small knitted red warning triangle. [oma-hilde] walks in front with a flashlight and a blanket around her shoulders, singing loudly with her mouth wide open and one fist raised like a rock singer. [jona] in his orange vest walks beside her, counting his steps on his fingers. Behind them [klirrklaus] carries an empty red plastic bottle crate, and [kabelsalat] rolls along at the back. Whole scene seen from the side, everyone walking to the right. Exactly these four figures, each once", ["oma-hilde", "jona", "klirrklaus", "kabelsalat"],
      { klirrklaus: [20, 20, 1000, 280], kabelsalat: [600, 280, 1000, 480], jona: [380, 480, 1000, 680], "oma-hilde": [80, 680, 1000, 960] }, place(c.text, /Sonderabfuhr/), omaNight),
    slot(`${m}/ch2-2.webp`, `${backyard}. In the middle stands [gertrud] all alone, nobody inside or beside her, her driver's cab empty, just waking up: her big round headlight eyes are half closed and sleepy and glow only faintly. In front of her on the cobbles lie a small knitted red warning triangle and an old bicycle horn with a rubber bulb. In front of her bumper sit three small balls of yarn, [knaeuelbande], red, yellow and blue. In the open wooden gate in front stand [jona] in his orange vest and [oma-hilde], staring at the truck in surprise. Exactly these figures, each once`, ["gertrud", "knaeuelbande", "jona", "oma-hilde"],
      { gertrud: [80, 330, 900, 980], knaeuelbande: [700, 520, 950, 900], "oma-hilde": [80, 20, 1000, 230], jona: [420, 200, 1000, 360] }, place(c.text, /Schlaufe um den Gummiball/), omaNight),
  ] : [
    slot(`${m}/ch3.webp`, `${backyard}, yarn threads criss-crossing the whole yard. [oma-hilde] hops with both feet together, her two rubber boots tied tightly together by many loops of red, yellow and blue yarn, arms flailing for balance, eyebrows raised in disbelief. Right at her feet [kabelsalat] patiently lifts one yarn loop off her boots with one plug feeler. A little apart [flusi] tickles a small yellow ball of yarn with his single curly tuft, and the yellow ball giggles. Exactly these three figures, each once, and one small yellow ball of yarn`, ["oma-hilde", "kabelsalat", "flusi"],
      { "oma-hilde": [40, 30, 1000, 400], kabelsalat: [520, 400, 1000, 760], flusi: [700, 760, 950, 960] }, place(c.text, /Doppelschuh|Na prima/), omaNight),
    slot(`${m}/ch3-2.webp`, `${backyard}. A closed old back door under a small plain tin sign showing a simple washing machine with a star in its round window, no letters anywhere. Red, yellow and blue yarn threads come out from under the door. [jona] in his orange vest stands in front of the door and looks up at the sign, holding his breath, with [flusi] trembling on his shoulder. [oma-hilde] stands beside him with her hand on the door handle and whispers, her face serious and amazed, not smiling. Exactly these three figures, each once`, ["jona", "flusi", "oma-hilde"],
      { "oma-hilde": [60, 520, 1000, 860], jona: [380, 180, 1000, 480], flusi: [380, 330, 520, 460] }, place(c.text, /Der alte Waschsalon/), omaNight),
  ] })),
  collectible: { type: "monster_profile", title: "Monster-Steckbrief Nr. 8", imageUrl: `${m}/knaeuelbande.webp`, fields: [
    { label: "Name", value: "Die Knäuelbande" },
    { label: "Ursprung", value: "Vergessene Strickreste unter einer Bank am alten Waschsalon" },
    { label: "Schwäche", value: "Rollen jedem losen Fadenende nach, das direkt vor ihren Knopfaugen baumelt" },
    { label: "Fangtrick", value: "Jedem ein baumelndes Fadenende vorhalten und bis in ein Fach von Klirrklaus' Kasten locken" },
    { label: "Job in der Pension", value: "Strickwerkstatt: rollen dem Gähnmonster die Wolle zu" },
  ] },
  teaser: "Nächste Woche: Oma hat sich den Fuß verknackst. Zum ersten Mal leitet Jona den Einsatz allein. Und unter alten Schattenfiguren liegt etwas, das klimpert.",
  canonFactsAdded: [],
};

const factsPath = join(docs, "kanon.json");
const facts = existsSync(factsPath) ? (JSON.parse(readFileSync(factsPath, "utf8")) as Record<string, string[]>) : { bruno: [], monster: [] };
bruno.canonFactsAdded = facts.bruno;
monster.canonFactsAdded = facts.monster;
for (const episode of [bruno, monster]) {
  for (const chapter of episode.chapters) chapter.image = chapter.images![0];
  const path = join(root, `backend/story/library/seed/episodes/${episode.seriesId}.s1e8.json`);
  writeFileSync(path, JSON.stringify(episode, null, 2) + "\n");
  console.log(`${episode.title}: ${episode.chapters.map((c) => c.text.split(/\s+/).length).join(" + ")} Wörter; Bildpositionen ${episode.chapters.map((c) => `${c.images!.map((s) => s.afterParagraph).join("/")} von ${c.text.split(/\n\n/).length}`).join(", ")}`);
}
