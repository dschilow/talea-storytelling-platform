/** Assemble the hand-written, Opus-edited Friday episodes and their scene-specific FLUX direction. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { parseChapters } from "../../backend/story/library/engine";
import type { EpisodeSeed, ImageSlot } from "../../backend/story/library/types";

const root = resolve(import.meta.dir, "../..");
const docs = join(root, "docs/talea-originals/2026-10-30");
const draft = process.argv.includes("--draft");
const read = (key: string) => parseChapters(readFileSync(join(docs, `${key}.${draft ? "entwurf" : "lektoriert"}.txt`), "utf8"));
const slot = (url: string, sceneEn: string, characterIds: string[], afterParagraph?: number, outfits?: Record<string, string>): ImageSlot => ({ url, sceneEn, characterIds, ...(afterParagraph === undefined ? {} : { afterParagraph }), ...(outfits ? { outfits } : {}) });
const robot = { "frau-pfeffer": "her same familiar face, brown bob haircut and cherry hairclip, blue cardigan and red flat shoes, but transformed into a friendly mechanical robot: articulated silver wrists and fingers, subtle silver joints, a tiny luminous unlabeled battery icon on her blue cardigan" };
function place(text: string, phrase: RegExp, fallback: number): number {
  const paragraphs = text.split(/\n\n/);
  const match = paragraphs.findIndex(p => phrase.test(p));
  if (match < 0 && !draft) console.warn(`Bildanker fehlt: ${phrase}; Textstelle bitte prüfen.`);
  return Math.max(2, Math.min(paragraphs.length - 3, match < 0 ? Math.round(paragraphs.length * fallback) : match));
}
const b = "/library/series/bruno-der-flunkerfisch/s1e3";
const m = "/library/series/die-monster-muellabfuhr/s1e3";
const brunoCh = read("bruno");
const monsterCh = read("monster");
const bruno: EpisodeSeed = {
  seriesId: "bruno-der-flunkerfisch", season: 1, episode: 3, bibleVersion: 2, publishAt: "2026-10-30T14:00:00.000Z",
  title: "Frau Pfeffer piept",
  summary: "Mats behauptet vor Brunos Aquarium, seine Lehrerin sei ein Roboter. Am nächsten Morgen kann Frau Pfeffer alles perfekt – sogar einem Papierlöwen die Mähne wegschneiden. Und ausgerechnet die neue Lia soll Mats für besonders schlau halten.",
  guests: [
    { id: "lia", name: "Lia", role: "Neue Freundin in Mats' Klasse; baut Bühnen und macht Geräusche mit der Zunge", visualProfileEn: "six-year-old girl with warm tan skin, straight chin-length black bob haircut, lively dark eyes, teal dungarees over a cream long-sleeve shirt, red sneakers, a small plain red toy toolbox used as a pencil case", referenceUrl: `${b}/lia.webp` },
    { id: "frau-pfeffer", name: "Frau Pfeffer", role: "Mats' Lehrerin, für einen Vormittag ein sehr ordentlicher Roboter", visualProfileEn: "friendly grown-up female primary school teacher about 40, adult height and proportions, brown chin-length bob haircut, a tiny cherry hairclip, blue knitted cardigan over a pale blouse, dark trousers, red flat shoes, warm expressive face", referenceUrl: `${b}/frau-pfeffer.webp` },
  ],
  cover: slot(`${b}/cover.webp`, "Sunny primary school craft classroom. [frau-pfeffer], a whimsical robot with articulated silver wrists, has meticulously lined up small shoes by size in front of a desk. A small glowing green battery icon on her cardigan has two bars, without letters or numbers. [lia] sits beside the cardboard puppet theatre on the desk, her mismatched dotted and striped socks visible, holding her red shoes out of reach with a determined expression. [mats] holds a yellow paper lion whose mane has been cut off and looks astonished at the absurdly perfect order. The warm, playful comedy is obvious, nobody frightened. Three figures only", ["frau-pfeffer", "lia", "mats"], undefined, robot),
  chapters: brunoCh.map((c, i) => ({ ...c, images: i === 0 ? [
    slot(`${b}/ch1.webp`, "Cozy apartment living room at the windowsill shelf. [mats] stands in side view and has just said something boastful, one finger raised, while his older sister [ella] looks at him with sudden concern and holds a closed planner. [bruno] swims safely inside his round water-filled glass tank above the tiny stone castle, one fin raised and grumpy eyes fixed on Mats. Two plain blank little cards pinned beside the shelf, a few delicate bell strings far from the tank. Exactly these three figures", ["mats", "ella", "bruno"], place(c.text, /Tief im Aquarium|knackte|Kiesel/, .42)),
    slot(`${b}/ch1-2.webp`, "Sunny primary school classroom. [frau-pfeffer] as a friendly mechanical robot with silver articulated wrists draws many perfect plain circles across an otherwise blank green blackboard, enthusiastically holding chalk. A tiny unlabeled green battery icon on her blue cardigan. [mats] and [lia] watch from their shared desk, leaning toward one another, amused and astonished; Lia's little red toolbox pencil case lies closed on the desk. Only these three figures, no text or equations", ["frau-pfeffer", "mats", "lia"], place(c.text, /Die Klasse klatschte|Zugabe|Seifenblasen/, .8), robot),
  ] : i === 1 ? [
    slot(`${b}/ch2.webp`, "Primary school craft table. [frau-pfeffer] as a friendly mechanical robot with silver articulated fingers carefully trims the last jagged piece of mane from a flat yellow paper lion using small school scissors, the animal lies safely on the tabletop well away from hands. [mats] stares at his now bald paper lion in dismay; [lia] clutches a closed glue stick and looks unconvinced beside a handmade cardboard puppet theatre. An unlabeled battery icon with two bars glows on the teacher's blue cardigan. Three figures only", ["frau-pfeffer", "mats", "lia"], place(c.text, /Überstehendes Papier entfernt|Das war sein Fell/, .25), robot),
    slot(`${b}/ch2-2.webp`, "Quiet old primary school corridor, warm daylight. [ella] in red round glasses studies a half-torn vintage magic-show poster on the noticeboard and makes a small drawing in her open planner, its pages seen from the back and unmarked. [mats] points at a small white crescent moon floating near the hand of a tiny illustrated stage magician wearing a dark cape on the poster. The poster is a wordless illustration with torn blank edges, no lettering anywhere. The two children look intrigued by the crescent clue, not at the viewer", ["ella", "mats"], place(c.text, /die Mondsichel|weiße Mondsichel|Fleck über/, .7)),
  ] : [
    slot(`${b}/ch3.webp`, "Warm primary school classroom, joyful small puppet show after the magic has ended. [mats] stands behind a little homemade cardboard theatre and pokes a yellow paper lion without a mane through the curtain, opening his mouth to make a huge funny roar. [lia] beside the stage makes snipping sound effects with her mouth and fingers. [frau-pfeffer] is fully HUMAN again with ordinary hands, blue cardigan, brown bob and cherry hairclip, sitting on a chair and playfully holding the desk as if the little lion's roar shook her. Three figures only; no battery icon, no robot parts", ["mats", "lia", "frau-pfeffer"], place(c.text, /Mats brüllte|am Tisch festhielt/, .52)),
    slot(`${b}/ch3-2.webp`, "Late afternoon in the Brandt living room. [ella] pins a small plain blank card beside the round water-filled aquarium while [mats] proudly stands beside her holding a pencil. [bruno] with the white crescent over his left eye swims close to the inner glass and looks at Mats, seemingly grumpy but secretly fond. Ella's closed planner rests on the shelf. Three figures, gently emotional, plain unmarked cards, no lettering", ["ella", "mats", "bruno"], place(c.text, /pinnte Ella Flunker|Flunker-Karte Nr\. 3/, .82)),
  ] })),
  collectible: { type: "flunker_card", title: "Flunker-Karte Nr. 3", imageUrl: `${b}/ch2.webp`, fields: [
    { label: "Flunkerei", value: "Unsere Lehrerin ist ein Roboter. Ein echter. Mit Akku." }, { label: "Wer flunkert", value: "Mats" },
    { label: "Was wörtlich passiert", value: "Frau Pfeffer piept, sortiert alles und schneidet sogar die Löwenmähne ordentlich ab." },
    { label: "Die Wahrheit", value: "Frau Pfeffer ist kein Roboter. Mats wollte Lia beeindrucken." }, { label: "Mutmoment", value: "Die Wahrheit vor Lia sagen, obwohl Mats auch heimlich zu Ella gehen könnte." },
  ] },
  teaser: "Nächsten Freitag: Mats kann fliegen! Leider kann er nicht landen. Und Lia steht unten und hat eine ziemlich praktische Frage.",
  canonFactsAdded: [
    "Frau Pfeffer ist Mats' Lehrerin. Sie mag lebendiges Theater und spielt bei einem Löwengebrüll begeistert mit.",
    "Lia ist neu in Mats' Klasse: roter Werkzeugkoffer als Mäppchen, sie baut Pappbühnen und macht mit der Zunge Geräusche, auch wenn sie unsicher ist.",
    "Mats wird bei Erzählrunden manchmal still. Vor Lia sagt er freiwillig die Wahrheit, statt den Zauber heimlich vor Ella zu beenden. Lia bleibt seine Freundin und kommt am Samstag spielen.",
    "Im Schulflur hängt ein halb abgerissenes Zaubershow-Plakat: Namensrest NELLO und eine weiße Mondsichel. Ella zeichnet beides in ihren Planer und verbindet es mit Brunos Schlafwort Simsalabrunello.",
    "Frau Pfeffer will nach einem vollständigen Exemplar des alten Plakats suchen. Brunos Herkunft ist weiter unbestätigt.",
    "Lia bemerkt das Plopp beim Geständnis, und Mats nennt es ein Geheimnis. Sie hört Bruno nicht sprechen. Mats' Klasse erinnert sich an die Roboterlehrerin, kennt aber weder die Ursache noch Bruno.",
    "Nach dem Geständnis erzählt Mats mit seinem Papierlöwen vom Drachenbauen mit Papa. Lia hilft mit Zungengeräuschen. Ella fragt Bruno nach Brunello; er weicht mit Flocken und seiner Burg aus.",
    "Flunker-Karte Nr. 3: Roboterlehrerin, von Mats vor Lia aufgelöst. Grimmbachs neuer Heft-Eintrag ist Nr. 48 und betrifft nach Schuhgröße sortierte Kinder und Knöpfe.",
  ],
};
const monster: EpisodeSeed = {
  seriesId: "die-monster-muellabfuhr", season: 1, episode: 3, bibleVersion: 2, publishAt: "2026-10-30T14:00:00.000Z",
  title: "Die Krümelkrake",
  summary: "Im Buchenweg läuft das Sofa seitwärts: Darunter wohnt eine Krake aus vergessenen Brotkrümeln. Jona findet ihre kitzlige Stelle – doch plötzlich brauchen Oma und Flusi selbst Hilfe. Und die Krake scheint die Socke mit der Krone zu kennen.",
  guests: [
    { id: "kruemelkrake", name: "Krümelkrake", role: "Kitzlige Krake aus vergessenen Brotkrümeln, neue Küchenhilfe der Monster-Pension", visualProfileEn: "friendly little octopus monster made entirely of golden toasted bread crumbs, a rounded bread-crumb head the size of a sofa cushion, two expressive black button eyes, a tiny smiling mouth, exactly eight soft flexible bread-crumb arms with tiny sesame seeds and rough crust tips, the eighth arm slightly shorter with a thin dry bread crust attached, cozy funny expressive creature, neither squid nor real seafood", referenceUrl: `${m}/kruemelkrake.webp` },
    { id: "socken-schnueffler", name: "Socken-Schnüffler", role: "Bekannter Sockenpaar-Sortierer aus Folge 1, Gast in der Pension", visualProfileEn: "friendly dog-sized creature made entirely of mismatched single socks, long striped sock-tip snout, two black button eyes, floppy soft sock body", referenceUrl: "/library/series/die-monster-muellabfuhr/s1e1/socken-schnueffler.webp" },
  ],
  cover: slot(`${m}/cover.webp`, "Cozy living room at night, warmly lit. A sofa has shifted sideways, revealing [kruemelkrake] underneath, a funny golden bread-crumb octopus offering a plain TV remote to [oma-hilde] in one arm and a marble in another, while two more arms tug an empty round monster bin underneath the sofa. [jona] crouches beside the sofa with his orange vest and yellow boots and stares in astonishment. [flusi] peeks over the sofa cushion with delighted round eyes. Four figures, whimsical comedy, sofa stands safely on the floor, no text", ["kruemelkrake", "oma-hilde", "jona", "flusi"]),
  chapters: monsterCh.map((c, i) => ({ ...c, images: i === 0 ? [
    slot(`${m}/ch1.webp`, "Oma Hilde's cozy kitchen at night. [flusi] is a perfectly round grey dust-bunny creature, comically dipping his round head into his own large plain cocoa mug on the table, only his two tiny black eyes and single curly tuft visible above the rim. [jona] sits beside him in his plain blue hoodie and grins; [oma-hilde], tall grey-haired grandmother with purple streak and black leather jacket, hands Flusi a soft towel. Three mugs and an old radio on the windowsill, three characters only", ["flusi", "jona", "oma-hilde"], place(c.text, /Flusi tropft|Handtuch hin/, .1), { jona: "plain blue hoodie over dark trousers, before putting on his orange vest for the night shift" }),
    slot(`${m}/ch1-2.webp`, "Apartment living room at night. [kruemelkrake] peeks from beneath a sofa, friendly golden bread-crumb body with eight flexible arms. One arm offers the TV remote, a second a marble, a third a coin, a fourth holds a piece of toast. [oma-hilde] holds the offered remote in her orange work glove with an amused surprised face. [jona] crouches beside her and watches an empty round monster bin being pulled under the sofa by two other arms. Sofa feet stay on the carpet, no threatening movement, three figures only", ["kruemelkrake", "oma-hilde", "jona"], place(c.text, /halben Zwieback|Münze in die Hand|Fernbedienung hin/, .8)),
  ] : i === 1 ? [
    slot(`${m}/ch2.webp`, "Cozy living room floor at night. [jona] kneels beside a slice of bread lying on the carpet and looks baffled as [kruemelkrake] ignores the bread and proudly slides the empty plate under the sofa. Golden crumb arms and sesame seeds, funny little black eyes. [oma-hilde] crouches behind Jona and inspects the rejected bread with an amused expression, one orange glove on her knee. Three figures, no other people", ["jona", "kruemelkrake", "oma-hilde"], place(c.text, /Geschirr hat|leeren Teller unter/, .28)),
    slot(`${m}/ch2-2.webp`, "Warmly lit living room rug. [oma-hilde] sits on the floor laughing helplessly as a soft golden bread-crumb arm of [kruemelkrake] tickles her wrist just beneath her orange work glove. [flusi], a round grey dust-bunny, giggles with his short paws up. [jona] kneels firmly beside them holding a soft hand brush in one hand and raising his other palm in a clear gentle STOP gesture. The bread-crumb octopus immediately pauses, friendly and attentive, all safe on the floor away from the stable sofa, four figures only", ["oma-hilde", "kruemelkrake", "flusi", "jona"], place(c.text, /„Stopp!“|Stopp!/, .82)),
  ] : [
    slot(`${m}/ch3.webp`, "Cozy living room at night. A round monster transport bin stands upright on the carpet, a large soft sofa cushion visible inside. [kruemelkrake] has willingly climbed into it, curled up comfortably laughing with eight bread-crumb arms wrapped around her round belly. [jona] kneels at one side, lightly brushing her belly with a soft hand brush; [oma-hilde] crouches at the other side with a warm smile, no restraint, lid open, three figures only", ["kruemelkrake", "jona", "oma-hilde"], place(c.text, /Zusammen strichen|Krake kringelte|Hihihihihi/, .3)),
    slot(`${m}/ch3-2.webp`, "Monster boarding-house kitchen at the depot just before dawn. [kruemelkrake] sits on a low kitchen stool with several arms holding spoons over an empty mixing bowl; all her movements have paused and her eyes fix on a small SINGLE sock held by [jona]. On the sock is a tiny knitted golden crown. [jona] in orange vest and blue hoodie watches her with a gentle questioning expression. In the background a closed green door has a tiny flap at its bottom. Only Jona and the bread-crumb octopus; no king or shadow figure or extra monster, subtle mystery without fear", ["kruemelkrake", "jona"], place(c.text, /Blick blieb an der Krone|Kennst du die|kleinen Klappe hinten/, .72)),
  ] })),
  collectible: { type: "monster_profile", title: "Monster-Steckbrief Nr. 3", imageUrl: `${m}/kruemelkrake.webp`, fields: [
    { label: "Name", value: "Krümelkrake" }, { label: "Ursprung", value: "Vergessene Brotkrümel unter einem Sofa" },
    { label: "Schwäche", value: "Kitzlig am Krümelbauch" }, { label: "Fangtrick", value: "Eine freiwillige Kitzelrunde auf dem Kissen in der Tonne. Bei Stopp aufhören." },
    { label: "Job in der Pension", value: "Küchenhilfe mit acht Armen" },
  ] },
  teaser: "Nächste Woche: In der Turnhalle weht ein ziemlich ungewöhnlicher Wind. Oma hat alle Fenster im Blick. Jona schaut lieber auf die Spuren vor der Pension.",
  canonFactsAdded: [
    "Die Krümelkrake ist im Buchenweg 4 aus vergessenen Brotkrümeln unter einem Sofa entstanden. Ihre einzige Schwäche ist der kitzlige Bauch; sie achtet freiwillig auf Stopp.",
    "Oma Hilde ist an den Handgelenken kitzlig. Jona hat den Überblick behalten, als Oma und Flusi vor Lachen nicht weiterkonnten.",
    "Die Krümelkrake fährt freiwillig auf einem Sofakissen in der Monster-Tonne mit und arbeitet als Küchenhilfe in der Pension. Sie sammelt Krümel und sortiert Geschirr.",
    "Die fürsorgliche Reinigung neuer Monster passt zu ihrem Material: Die Krümelkrake wird in der trockenen Wanne vorsichtig abgebürstet, nicht gebadet.",
    "Die Krümelkrake erkennt Jonas Socke mit der winzigen gestrickten Krone, wird still und blickt zur Klappe der Pensionstür.",
    "Beim ersten Vogelgezwitscher schläft die Krümelkrake ein und murmelt: Der König ruft. Die kleine Klappe steht einen Fingerbreit offen. Oma schiebt den Riegel vor.",
    "Jona notiert Wer ist König? unter Steckbrief Nr. 3. König und Ursache der offenen Klappe sind noch ungeklärt.",
    "Omas Einsatzsong für Krümel heißt Krümel im Getriebe. Flusi hat nach dem Kakao einen nassen Handtuch-Umhang getragen.",
  ],
};
for (const episode of [bruno, monster]) {
  // Explicit figure boxes prevent extra copies of a small sidekick on the reference sheet.
  const layouts: Record<string, Record<string, number[]>> = episode === bruno ? {
    "cover.webp": { "frau-pfeffer": [40, 30, 980, 340], lia: [340, 370, 970, 630], mats: [300, 680, 980, 950] },
    "ch1.webp": { mats: [300, 30, 980, 300], ella: [180, 330, 980, 620], bruno: [250, 690, 650, 960] },
    "ch1-2.webp": { "frau-pfeffer": [30, 30, 980, 350], mats: [380, 440, 980, 680], lia: [380, 720, 980, 960] },
    "ch2.webp": { "frau-pfeffer": [40, 20, 980, 330], mats: [280, 370, 980, 640], lia: [300, 700, 980, 960] },
    "ch2-2.webp": { ella: [200, 50, 980, 340], mats: [300, 680, 980, 940] },
    "ch3.webp": { mats: [330, 180, 980, 430], lia: [320, 480, 980, 710], "frau-pfeffer": [250, 750, 980, 990] },
    "ch3-2.webp": { ella: [160, 30, 980, 320], mats: [300, 350, 980, 620], bruno: [280, 710, 650, 960] },
  } : {
    "cover.webp": { kruemelkrake: [400, 10, 960, 420], "oma-hilde": [100, 450, 980, 680], jona: [400, 700, 980, 890], flusi: [680, 890, 970, 1000] },
    "ch1.webp": { flusi: [460, 30, 900, 300], jona: [240, 360, 980, 620], "oma-hilde": [50, 680, 980, 980] },
    "ch1-2.webp": { kruemelkrake: [400, 20, 980, 430], "oma-hilde": [100, 470, 980, 700], jona: [380, 740, 980, 980] },
    "ch2.webp": { jona: [350, 20, 980, 300], kruemelkrake: [430, 360, 970, 680], "oma-hilde": [80, 730, 980, 980] },
    "ch2-2.webp": { "oma-hilde": [300, 20, 980, 280], kruemelkrake: [400, 290, 980, 600], flusi: [650, 610, 980, 760], jona: [250, 760, 980, 1000] },
    "ch3.webp": { kruemelkrake: [350, 20, 920, 430], jona: [300, 450, 980, 700], "oma-hilde": [100, 730, 980, 980] },
    "ch3-2.webp": { kruemelkrake: [300, 60, 980, 480], jona: [200, 650, 980, 940] },
  };
  for (const picture of [episode.cover, ...episode.chapters.flatMap(c => c.images!)]) picture.boxes = layouts[picture.url!.split("/").pop()!];
  if (episode === bruno) {
    episode.cover.sceneEn = "Sunny primary school classroom with plain warm walls and a green chalkboard bearing only round circles. [frau-pfeffer], a friendly robot with silver articulated wrists and her blue cardigan, meticulously lines up plain school shoes by size on a low bench. A tiny green battery icon with two bars glows on her cardigan. [lia] sits on a chair with her mismatched dotted and striped SOCKS visible, keeping her red shoes held tightly to her chest with a determined expression. [mats] beside her stares at the strict shoe arrangement in disbelief. Exactly three figures, clear funny expressions, empty plain unmarked walls, no other children or objects with faces";
    episode.chapters[1].images![0].sceneEn = "Primary school craft desk, a close clear view of a small FLAT YELLOW PAPER CUTOUT lying on the tabletop: a plain oval yellow paper body, four narrow yellow paper legs, a thin yellow tail and a completely BALD smooth ROUND paper head, without a mane or fur. It is a roughly scissor-cut two-dimensional paper lion the size of a child's palm, made from a single sheet of yellow construction paper. [frau-pfeffer], a friendly robot with articulated silver wrists, holds small blunt school scissors over the paper scraps she just trimmed from its head. [mats] stares in dismay at his bald paper animal. [lia] holds a glue stick beside their simple folded cardboard puppet theatre, a small tabletop craft object. Exactly three people, no living animal, puppet or toy lion";
    episode.chapters[2].images![0].sceneEn = "Warm primary school classroom, close view of THREE people seated at one ordinary craft desk. [mats] sits clearly visible from waist up behind the desk, his head well above the table and his mouth open in a funny roar. In his right hand he holds a palm-sized completely FLAT yellow PAPER animal, a bald smooth round head, oval body and four narrow paper legs, cut from a single sheet of yellow paper. On the desktop in front of his wrist are TWO LOW BROWN CARDBOARD FLAPS folded upright, each only as high as a mug, forming a tiny paper puppet screen. [lia] sits beside Mats making snipping sounds with her mouth; her head is at the same height as Mats' head. [frau-pfeffer] fully HUMAN again, ordinary hands, blue cardigan and cherry hairclip, sits on the right smiling and theatrically holding the desk. Three faces all clearly visible and at similar seated height, simple tabletop craft, plain classroom walls";
  } else {
    episode.cover.characterIds = ["kruemelkrake", "oma-hilde", "jona"];
    episode.cover.boxes = { kruemelkrake: [580, 20, 980, 430], "oma-hilde": [100, 470, 980, 710], jona: [360, 730, 980, 980] };
    episode.cover.sceneEn = "Cozy living room at night, side view of a long sofa on the LEFT and TWO people crouching on the RIGHT. UNDERNEATH the sofa, [kruemelkrake] peeks out with her round golden bread-crumb head near the carpet, surrounded by eight long soft golden arms. Two arms push an empty round metal monster bin under the sofa; another reaches out to offer a plain TV remote to [oma-hilde], an adult grandmother in black leather jacket and orange work gloves. [jona] crouches beside her, orange vest and yellow boots, pointing in amazement at the busy arms UNDER the furniture. Sofa cushions are EMPTY. Exactly three figures in the whole picture: one golden crumb octopus and two humans. Cozy funny scene, all safely on the carpet, plain walls";
    episode.chapters[0].images![1].sceneEn = "Cozy night living room, very LOW floor-level viewpoint showing the space UNDER A SOFA. [kruemelkrake]'s little golden bread-crumb head and eight flexible arms emerge from the dark gap underneath the furniture, low over the carpet. One extended arm offers a plain grey remote, another a round marble, a third a small coin, a fourth a square piece of toast; two more pull an empty round metal bin halfway UNDER the sofa. [oma-hilde] kneels on the right receiving the remote with her orange glove, amused. [jona] kneels beside her and studies the arms. Sofa cushions above them remain EMPTY and nobody sits on the sofa. Exactly three characters once each";
  }
  for (const chapter of episode.chapters) chapter.image = chapter.images![0];
  const path = join(root, `backend/story/library/seed/episodes/${episode.seriesId}.s1e3.json`);
  writeFileSync(path, JSON.stringify(episode, null, 2) + "\n");
  console.log(`${episode.title}: ${episode.chapters.map(c => c.text.split(/\s+/).length).join(" + ")} Wörter; Bildpositionen ${episode.chapters.map(c => c.images!.map(s => s.afterParagraph).join("/")).join(", ")}`);
}
