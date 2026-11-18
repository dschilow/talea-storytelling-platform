/**
 * Assemble the S1E5 seeds of both Originals series (Friday 2026-11-13): texts written by
 * Claude, counter-read and revised by GPT-6.2 Sol (OpenAI API, the Codex quota was used up),
 * plus scene-specific FLUX direction.
 *
 *   bun run scripts/library/prepare-s1e5.ts            # reads docs/talea-originals/2026-11-13/<key>.lektoriert.txt
 *   bun run scripts/library/prepare-s1e5.ts --from v3  # reads <key>.v3.txt instead (layout and picture check before the final edit)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { parseChapters } from "../../backend/story/library/engine";
import type { EpisodeSeed, ImageSlot } from "../../backend/story/library/types";

const root = resolve(import.meta.dir, "../..");
const docs = join(root, "docs/talea-originals/2026-11-13");
const fromAt = process.argv.indexOf("--from");
const suffix = fromAt > 0 ? process.argv[fromAt + 1] : "lektoriert";
const read = (key: string) => parseChapters(readFileSync(join(docs, `${key}.${suffix}.txt`), "utf8"));
const publishAt = "2026-11-13T14:00:00.000Z";
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

// ---------- Bruno, der Flunkerfisch: S1E5 „Oma ist zwanzig“ ----------
const b = "/library/series/bruno-der-flunkerfisch/s1e5";
const skating = {
  "rosi-jung": "the same turquoise dress with pink and yellow flowers and a brown belt, the big wooden bead necklace and small gold earrings, and on her feet old white leather roller skates with red wheels instead of shoes",
  mats: "his oversized orange dinosaur T-shirt, blue shorts over striped leggings, and small blue children's roller skates on his feet",
  ella: "her green-white striped sweater, jeans with a patched knee and white sneakers, without a jacket on",
};
const youngRosi = {
  id: "rosi-jung",
  name: "Oma Rosi mit zwanzig",
  role: "Oma Rosi, verzaubert: zwanzig Jahre alt, in ihrem eigenen Blumenkleid",
  visualProfileEn: "elegant grown-up young woman of about twenty-two with adult proportions and height, a small head on a tall slender body, chin-length wavy chestnut-brown curls, red lipstick, small gold earrings, a fitted short-sleeved turquoise dress with pink and yellow flowers, belted with a brown belt and swinging to mid-calf, a big necklace of large round light-brown wooden beads, brown shoes with a small heel",
  referenceUrl: `${b}/rosi-jung.webp`,
};
const brunoCh = read("bruno");
const bruno: EpisodeSeed = {
  seriesId: "bruno-der-flunkerfisch", season: 1, episode: 5, bibleVersion: 2, publishAt,
  title: "Oma ist zwanzig",
  summary: "Alle wollen Oma Rosi auf die Bank zum Jackenhalten setzen. Da sagt sie vor Brunos Glas: „Ich bin zwanzig!“ Plötzlich stimmt das. Sie fährt rückwärts Rollschuh und erkennt sich im Spiegel nicht. Nur glaubt ihr jetzt keiner mehr, dass sie die Oma ist.",
  guests: [youngRosi],
  cover: slot(`${b}/cover.webp`, "Sunny inner courtyard of an old apartment building, a laundry pole and a bike rack, cobblestones. [rosi-jung] skates backwards in a wide swirl, arms spread out, her flower dress flying, laughing out loud. [mats] wobbles on his roller skates with bent knees, one hand on the bike rack, laughing at her. [ella] stands at the edge with a big armful of three jackets and calls out to them with one hand raised, like a worried grandmother. Exactly these three figures, each once, a funny and warm moment", ["rosi-jung", "mats", "ella"],
    { ella: [300, 40, 1000, 290], "rosi-jung": [60, 340, 1000, 640], mats: [380, 690, 1000, 900] }, undefined, skating),
  chapters: brunoCh.map((c, i) => ({ ...c, images: i === 0 ? [
    slot(`${b}/ch1.webp`, "Cozy living room in Sunday afternoon light, a plain brown cardboard shoebox with its lid off on the coffee table. [oma-rosi] stands at the shelf by the window in three-quarter view, one old white roller skate with red wheels in her hand, chin raised with a proud, stubborn little smile, and looks straight at [mats], insisting on something. Behind her on the shelf [bruno] swims in his round water-filled glass tank above his tiny stone castle, grumpy and unimpressed. [mats] stares up at her with his mouth wide open; [ella] lets a closed red notebook sink and freezes. Exactly these four figures, each once; the fish stays inside the water of its round tank", ["oma-rosi", "bruno", "ella", "mats"],
      { ella: [320, 20, 1000, 210], mats: [440, 200, 1000, 350], "oma-rosi": [160, 380, 1000, 620], bruno: [230, 660, 600, 900] }, place(c.text, /Ich bin zwanzig!/)),
    slot(`${b}/ch1-2.webp`, "Narrow apartment hallway with a coat rack full of coats. [papa-brandt] has just come out of the kitchen holding a plate of plum cake and laughs politely, eyebrows raised, not believing a word. [rosi-jung] stands in front of him and points at herself with both thumbs, beaming and leaning toward him. [ella] glances sideways at the open living-room door; [mats] grins with both hands over his mouth. Exactly these four figures, each once", ["papa-brandt", "rosi-jung", "ella", "mats"],
      { ella: [360, 30, 1000, 220], mats: [470, 220, 1000, 370], "rosi-jung": [70, 390, 1000, 630], "papa-brandt": [60, 680, 1000, 930] }, place(c.text, /Weihnachtsmann/)),
  ] : i === 1 ? [
    slot(`${b}/ch2.webp`, "Sunny courtyard of an apartment building. On the left [frau-grimmbach] leans out of her open ground-floor window and writes sternly in her small black notebook; [kater-kaiser], a very large fluffy grey cat with a golden bell on a red collar, sits on the windowsill beside her and yawns majestically. [rosi-jung] has rolled up to the window on her roller skates, one hand on her chest, smiling hopefully up at the stern woman. [mats] on wobbly roller skates clings to her arm. Exactly these four figures, each once", ["frau-grimmbach", "kater-kaiser", "rosi-jung", "mats"],
      { "frau-grimmbach": [80, 30, 640, 290], "kater-kaiser": [450, 250, 700, 420], "rosi-jung": [90, 470, 1000, 700], mats: [420, 710, 1000, 890] }, place(c.text, /kein Karussell/), skating),
    slot(`${b}/ch2-2.webp`, "Sunny courtyard. [rosi-jung] sits alone on a wooden bench against the house wall, roller skates on her feet, a pile of three jackets beside her, looking down at her own hands, quiet and a little sad. [kater-kaiser] sits on the bench right next to her. In the open house door on the left [ella] stands in side view with a cardigan over her arm, her head turned toward the bench, looking at the young woman with wide thoughtful eyes, slowly understanding. Exactly these three figures, each once", ["ella", "rosi-jung", "kater-kaiser"],
      { ella: [180, 40, 1000, 250], "rosi-jung": [260, 420, 1000, 700], "kater-kaiser": [520, 720, 900, 900] }, place(c.text, /Nur Oma sollte zugucken|Es lag an der Bank/), { ...skating, ella: "her green-white striped sweater, jeans with a patched knee and white sneakers, a soft pink knitted cardigan over her arm" }),
  ] : [
    slot(`${b}/ch3.webp`, "Courtyard in warm afternoon sun, the whole scene seen from the side like a stage. [oma-rosi], a cheerful grandmother with short curly white hair, shown in profile facing right, rolls from left to right across the cobblestones on old white leather roller skates with red wheels, arms spread wide for balance, her flower dress fluttering, laughing loudly with her head turned back toward Mats. Behind her on the left [mats] rolls after her on his roller skates, reaching out one hand and cheering. Ahead of her on the right [ella] walks backwards in side view, a closed red notebook under her arm, watching Oma with a big smile. Exactly these three figures, each once, everyone moving", ["mats", "oma-rosi", "ella"],
      { mats: [380, 40, 1000, 270], "oma-rosi": [130, 320, 1000, 640], ella: [300, 690, 1000, 920] }, place(c.text, /nächsten Sonntag/), { "oma-rosi": "her turquoise flower dress and big wooden bead necklace, and old white leather roller skates with red wheels on her feet instead of shoes", mats: skating.mats, ella: skating.ella }),
    slot(`${b}/ch3-2.webp`, "Living room in the evening lamplight, a wooden floor. [kater-kaiser], a very large fluffy grey cat with a golden bell, crouches low on all fours with both front paws pressed flat on top of one small blue child's roller skate, his hind paws pushing off the floor behind him, gliding forward on the rolling skate like on a scooter, ears back, eyes fixed on the shelf by the window. Right in front of him stands a laundry basket full of socks, one sock hanging over its rim down to the floor. On the shelf [bruno] watches from his round water-filled glass tank above his tiny stone castle, utterly unimpressed. In the doorway [mats] doubles over with laughter. Exactly these three figures, each once; the fish stays inside the water of its tank", ["mats", "kater-kaiser", "bruno"],
      { mats: [360, 20, 1000, 200], "kater-kaiser": [420, 260, 1000, 600], bruno: [180, 700, 520, 920] }, place(c.text, /Bremsen muss er|Der Rollschuh blieb stehen/)),
  ] })),
  collectible: { type: "flunker_card", title: "Flunker-Karte Nr. 5", imageUrl: `${b}/cover.webp`, fields: [
    { label: "Flunkerei", value: "„Pah! Ich bin zwanzig!“" },
    { label: "Wer flunkert", value: "Oma Rosi" },
    { label: "Was wörtlich passiert", value: "Oma ist plötzlich zwanzig. Sie erkennt sich im Spiegel nicht, schlägt ein Rad im Flur und fährt rückwärts Rollschuh im Hof. Nur glaubt ihr keiner mehr, dass sie die Oma ist." },
    { label: "Die Wahrheit", value: "Oma ist siebzig. Sie wollte nicht auf die Bank zum Jackenhalten, sondern mitfahren." },
    { label: "Mutmoment", value: "Selbst ihr echtes Alter sagen, obwohl zwanzig so viel Spaß gemacht hat." },
  ] },
  teaser: "Nächsten Freitag: Frau Grimmbach behauptet etwas über Kater Kaiser, das sie selbst nicht glaubt. Kurz darauf baut der Kater eine Maschine. Sie soll Fische fangen.",
  canonFactsAdded: [],
};

// ---------- Die Monster-Müllabfuhr: S1E5 „Das Brokkoli-Monster“ ----------
const m = "/library/series/die-monster-muellabfuhr/s1e5";
const brokkoli = {
  id: "brokkoli-monster",
  name: "Brokkoli-Monster",
  role: "Monster aus den vergessenen Resten eines Probiertellers im Gemüseladen, neuer Gärtner der Monster-Pension",
  visualProfileEn: "friendly monster made entirely of fresh broccoli, as tall as a grown-up woman: a huge bushy dark-green head of broccoli florets like the round top of a little tree, two big round white eyes with black pupils and a wide smiling mouth on the pale-green stalk just below the florets, a thick pale-green broccoli-stalk body, two long pale-green stem arms ending in small hands of green broccoli florets, two short thick stalk legs",
  referenceUrl: `${m}/brokkoli-monster.webp`,
};
const krake = { id: "kruemelkrake", name: "Krümelkrake", role: "Küchenhilfe der Pension aus Folge 3", visualProfileEn: "friendly little octopus monster made entirely of golden toasted bread crumbs, a rounded bread-crumb head the size of a sofa cushion, two expressive black button eyes, a tiny smiling mouth, exactly eight soft flexible bread-crumb arms with tiny sesame seeds and rough crust tips, cozy funny expressive creature, neither squid nor real seafood", referenceUrl: "/library/series/die-monster-muellabfuhr/s1e3/kruemelkrake.webp" };
const pups = { id: "pupsmonster", name: "Pupsmonster", role: "Lüftungswart der Pension aus Folge 4", visualProfileEn: "friendly clumsy monster made entirely of cloth: a lumpy bundle of drawstring gym bags knotted together, a big red gym bag as its round head and middle with smaller blue, green and yellow gym bags around it, loose white drawstring cords looping up from the top like messy hair, two round shiny metal eyelets as eyes, a wide happy mouth, blue mitten-like cloth hands, short green cloth legs in two old worn white sneakers, about as tall as a seven-year-old child", referenceUrl: "/library/series/die-monster-muellabfuhr/s1e4/pupsmonster.webp" };
const shop = "Inside a small dark greengrocer's shop at night, wooden crates of vegetables along the walls, a wooden counter, a flashlight beam";
const monsterCh = read("monster");
const monster: EpisodeSeed = {
  seriesId: "die-monster-muellabfuhr", season: 1, episode: 5, bibleVersion: 2, publishAt,
  title: "Das Brokkoli-Monster",
  summary: "Im Gemüseladen deckt jemand jede Nacht für einunddreißig Gäste, und keiner kommt. Das Brokkoli-Monster will nur eins: Probieren! Doch Jona hat noch nie Brokkoli gegessen. Und Flusi niest bei einem ganz bestimmten Wort.",
  guests: [brokkoli, krake, pups],
  cover: slot(`${m}/cover.webp`, `${shop}. [brokkoli-monster] bends down and holds out one tiny broccoli floret on a toothpick toward [jona], its big round eyes hopeful. [jona] in his orange vest leans back a little, holding his flashlight, unsure. Behind them [oma-hilde] holds a round monster bin piled high with cabbages and a pumpkin on top. Exactly these three figures, each once, a funny and warm moment`, ["oma-hilde", "jona", "brokkoli-monster"],
    { "oma-hilde": [100, 30, 1000, 300], jona: [400, 330, 1000, 540], "brokkoli-monster": [20, 560, 1000, 900] }),
  chapters: monsterCh.map((c, i) => ({ ...c, images: i === 0 ? [
    slot(`${m}/ch1.webp`, `${shop}. The whole floor is covered with long neat rows of flat wooden crate lids; on every lid lie one carrot, one radish and one small broccoli floret, each pierced by a toothpick, like a long banquet laid out for guests. [jona] in his orange vest crouches at the end of a row and points his flashlight along it, counting with his other hand. [oma-hilde] stands behind him with an empty round monster bin, eyebrows raised. [flusi] sits on an upturned crate and sneezes. Exactly these three figures, each once`, ["oma-hilde", "jona", "flusi"],
      { "oma-hilde": [90, 40, 1000, 300], jona: [420, 330, 1000, 560], flusi: [560, 740, 820, 900] }, place(c.text, /Einunddreißig Plätze/)),
    slot(`${m}/ch1-2.webp`, `${shop}. [oma-hilde], in side view, staggers under a round monster bin piled high with vegetables: cabbages, a kohlrabi, a cauliflower and on the very top of that pile one orange pumpkin; her arms strain and she looks up at the monster in comic dismay. [brokkoli-monster], its bushy broccoli head bare, leans toward her and lays one more green cabbage on the pile, beaming at her. On the floor [flusi] holds a big lettuce leaf over his head like an umbrella. Exactly these three figures, each once`, ["oma-hilde", "brokkoli-monster", "flusi"],
      { "oma-hilde": [80, 60, 1000, 380], "brokkoli-monster": [20, 430, 1000, 780], flusi: [650, 800, 920, 970] }, place(c.text, /Kürbis/)),
  ] : i === 1 ? [
    slot(`${m}/ch2.webp`, `${shop}. [oma-hilde], in three-quarter view, pretends to chew with puffed cheeks and eyes closed in fake delight, both her hands empty; a small green broccoli floret is stuffed into the wide cuff of her left orange work glove and sticks out at her wrist. [brokkoli-monster] bends down close and stares at the floret sticking out of her glove cuff with narrowed, offended eyes. [jona] watches with one hand over his mouth. Exactly these three figures, each once`, ["oma-hilde", "brokkoli-monster", "jona"],
      { "oma-hilde": [80, 80, 1000, 380], "brokkoli-monster": [20, 420, 1000, 740], jona: [400, 770, 1000, 960] }, place(c.text, /aus dem Ärmel|so kitzlig/)),
    slot(`${m}/ch2-2.webp`, "Night street at the curb in front of a small greengrocer's shop with a plain unmarked green awning and a plain painted wooden front, warm light falling out of its empty open doorway onto the pavement. [gertrud], the small purple garbage truck with friendly headlight eyes, stands at the curb all alone with nobody inside or beside her; a carrot lies across each of her headlights and a cauliflower sits on her roof, and she sneezes a big burst of green peas out of the open end of her own long flexible vacuum trunk, the peas shooting out of the trunk and bouncing over the street like hail. [brokkoli-monster] stands on the pavement right next to the end of her trunk, one floret hand still raised from stuffing the peas in, and jumps back in surprise as the peas bounce off its bushy head. [flusi] bounces on the pavement, delighted. Exactly these three figures, each once; the broccoli monster stands outside beside the truck", ["flusi", "brokkoli-monster", "gertrud"],
      { flusi: [700, 40, 960, 200], "brokkoli-monster": [60, 230, 980, 500], gertrud: [180, 520, 960, 990] }, place(c.text, /wie Hagel/)),
  ] : [
    slot(`${m}/ch3.webp`, `${shop}, a plate of small fresh vegetable pieces on the counter. [jona] bites carefully into a tiny broccoli floret on a toothpick, eyes squeezed shut, holding up three fingers of his other hand. [brokkoli-monster] sits on an empty wooden crate, leaning forward, watching him hopefully with its floret hands clasped. [oma-hilde] kneels beside Jona and watches him, ready to help. Exactly these three figures, each once`, ["oma-hilde", "jona", "brokkoli-monster"],
      { "oma-hilde": [300, 40, 1000, 300], jona: [340, 320, 1000, 540], "brokkoli-monster": [60, 570, 1000, 900] }, place(c.text, /^Er biss ab\.$/)),
    slot(`${m}/ch3-2.webp`, "Early dawn behind the monster pension on a depot yard, a strip of dark fresh garden earth next to a washing line, the sky turning pale. [brokkoli-monster] kneels at the garden bed and presses small holes into the soil with one broccoli-floret finger, dropping in seeds. [kruemelkrake], a golden bread-crumb octopus, holds out a watering can to it with one arm. [jona] in his orange vest crouches at the edge of the bed and watches. Exactly these three figures, each once, cozy and peaceful", ["jona", "brokkoli-monster", "kruemelkrake"],
      { jona: [340, 40, 1000, 280], "brokkoli-monster": [100, 330, 1000, 680], kruemelkrake: [420, 700, 1000, 980] }, place(c.text, /Samenkorn|Radieschensamen/)),
  ] })),
  collectible: { type: "monster_profile", title: "Monster-Steckbrief Nr. 5", imageUrl: `${m}/brokkoli-monster.webp`, fields: [
    { label: "Name", value: "Brokkoli-Monster" },
    { label: "Ursprung", value: "Vergessene Reste vom Probierteller eines Gemüseladens, in der Kiste unter der Theke" },
    { label: "Schwäche", value: "Wird zahm, wenn einer freiwillig probiert" },
    { label: "Fangtrick", value: "Jona nimmt einen Bissen vom frischen Probierteller. Freiwillig. Keiner muss." },
    { label: "Job in der Pension", value: "Gärtner im Pensionsgarten" },
  ] },
  teaser: "Nächste Woche: Im Keller klirrt es, und zwar ordentlich. Jemand aus alten Pfandflaschen will Ordnung. Nur welche?",
  canonFactsAdded: [],
};

const facts = JSON.parse(readFileSync(join(docs, "kanon.json"), "utf8")) as Record<string, string[]>;
bruno.canonFactsAdded = facts.bruno;
monster.canonFactsAdded = facts.monster;
for (const episode of [bruno, monster]) {
  for (const chapter of episode.chapters) chapter.image = chapter.images![0];
  const path = join(root, `backend/story/library/seed/episodes/${episode.seriesId}.s1e5.json`);
  writeFileSync(path, JSON.stringify(episode, null, 2) + "\n");
  console.log(`${episode.title}: ${episode.chapters.map((c) => c.text.split(/\s+/).length).join(" + ")} Wörter; Bildpositionen ${episode.chapters.map((c) => `${c.images!.map((s) => s.afterParagraph).join("/")} von ${c.text.split(/\n\n/).length}`).join(", ")}`);
}
