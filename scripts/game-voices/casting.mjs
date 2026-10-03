/**
 * Besetzung der Figuren-Stimmen für Mitternachts-Alibi.
 *
 * Jede Figur bekommt eine Stimme aus dem ElevenLabs-Konto (deutsche Charakter-/Erzählerstimmen zuerst,
 * danach die mehrsprachigen Standardstimmen). Weil das Konto weniger Stimmen als Figuren hat, teilen sich
 * höchstens zwei Figuren eine Stimme; sie wurden so gepaart, dass sie sich in Alter, Tempo und Typ
 * deutlich unterscheiden und zusätzlich über Charakter-Tags (persona) und ein typisches Geräusch (flavor)
 * auseinanderklingen. Kommissar Tavi nutzt keine dieser Stimmen, sondern die Audio-Doku-Stimme.
 *
 * Eintrag: slug → [Stimmen-Kürzel, persona (Audio-Tags), flavor (typisches Geräusch, optional)]
 */

/** Kürzel → Anfang des Stimmennamens im Konto (Namensvergleich ohne Groß-/Kleinschreibung). */
export const VOICE_KEYS = {
  // deutsche Charakter- und Erzählerstimmen
  LEN: "Lennard", WAL: "Wally", OTT: "Otto", OPA: "Opa Johann", HEL: "Helmut", JOR: "Jorin", LEO: "Leon Stern",
  JAN: "Jantosch", BLK: "Gaming - Black Mensa", BAR: "Barnaby Bunny", BRU: "Bruno, der B", MMO: "Michael Mouse", JON: "Jonny",
  LUC: "Lucy Fennek", JUL: "Julia", SAB: "Sabrina", MIL: "Mila Winter", HIL: "Oma Hilde", NAE: "Oma's N", BRL: "Mrs. Br",
  MAP: "Milly Maple", SKB: "Skittle Bee", LUM: "Lumi – Playful", BIB: "Bibi Blume", CAN: "Candy", LOL: "Lolo", DOB: "Dobby",
  // mehrsprachige Standardstimmen
  ROG: "Roger", CHA: "Charlie", GEO: "George", CAL: "Callum", HAR: "Harry", LIA: "Liam", WIL: "Will", ERI: "Eric", CHR: "Chris",
  BRI: "Brian", DAN: "Daniel", ADA: "Adam", BIL: "Bill", BEL: "Bella", SAR: "Sarah", LAU: "Laura", ALI: "Alice", MAT: "Matilda",
  JES: "Jessica", LIL: "Lily", RIV: "River",
};

export const CAST = {
  "amir-sternfinder": ["JON", "quiet, curious, wondering", ""],
  "astra": ["LUC", "dreamy, airy, slow", ""],
  "astronautin-nova": ["MIL", "confident, crisp, radio voice", ""],
  "baecker-braun": ["CHR", "warm, hearty, cozy", "chuckles"],
  "baecker-bruno": ["LEN", "rich, jovial, big-hearted", "laughs warmly"],
  "baecker-wilhelm": ["JAN", "loud, cheerful, exaggerating", "laughs"],
  "bauerntochter-greta": ["MAP", "bright, sincere, cheerful", "giggles"],
  "bo-buecherfuchs": ["DAN", "dry, witty, bookish", "dry chuckle"],
  "bruchkind-brenno": ["CHA", "gruff, sullen, clipped", "grunts"],
  "brumm-der-steinwaechter": ["BRI", "very deep, slow, rumbling", "rumbles"],
  "der-geraeusche-fresser": ["RIV", "whispering, slow, apologetic", "smacks lips"],
  "der-leiser-mann": ["WAL", "soft, nervous, hushed", "coughs quietly"],
  "der-letzte-wehmueter": ["BIL", "gravelly, bitter, dignified", "sighs"],
  "der-mutlosmacher": ["BLK", "weary, mumbling, deadpan", "sighs heavily"],
  "der-zeitweber": ["LEO", "ancient, ceremonial, mysterious", ""],
  "der-zu-ordentliche": ["OTT", "formal, exact, stiff", "clears throat"],
  "detektiv-schnueffel": ["BLK", "dry, deadpan, noir detective", "dry chuckle"],
  "die-alte-eiche": ["HIL", "slow, poetic, rustling", ""],
  "die-besserwisserin-klotilde": ["ALI", "lecturing, haughty, precise", "sniffs"],
  "die-nebelfee": ["LIL", "whispery, shy, ethereal", "softly"],
  "die-nebelhexe": ["BRL", "teasing, mysterious, giggling", "giggles"],
  "diener-johann": ["OPA", "formal, deferential, nervous", "clears throat"],
  "die-stundendiebin": ["JES", "hasty, precise, nervous", "gasps"],
  "drache-fauchi": ["CAL", "loud, hot-tempered, rolling R", "snorts"],
  "eichhoernchen-flitz": ["MAP", "fast, chirpy, playful", "giggles"],
  "fee-rosalie": ["LUM", "bright, sparkly, playful", "giggles"],
  "feuerwehrfrau-fanni": ["LUC", "firm, commanding, reassuring", ""],
  "fluestertante-flora": ["LIL", "velvety, whispering, conspiratorial", "whispers"],
  "frau-gleichgleich": ["MAT", "mechanical, polite, stiff", ""],
  "frau-mueller": ["ALI", "calm, encouraging, grandmotherly", "chuckles"],
  "frau-wellenreiter": ["SAR", "calm, weathered, warm", ""],
  "frosch-quak": ["BAR", "rhythmic, cheerful, croaky", "croaks"],
  "funkelflug": ["WAL", "eager, clumsy, apologetic", "nervous laugh"],
  "gelehrter-professor-theodor": ["JOR", "elderly, enthusiastic, rambling", "chuckles"],
  "graf-griesgram": ["ROG", "curt, grumpy, reluctant", "grumbles"],
  "graumund-der-gleichgueltige": ["GEO", "dry, sarcastic, flat", "sighs"],
  "haendler-gustav": ["ERI", "charming, fast-talking, cheeky", "chuckles"],
  "herr-seitenflug": ["MMO", "enthusiastic, rambling, bookish", "laughs"],
  "hexe-griselda": ["NAE", "cackling, theatrical, giggly", "cackles"],
  "hexe-kraeuterweis": ["SAR", "dry, whispery, crafty", "chuckles"],
  "hirtenjunge-peter": ["BAR", "excited, eager, childlike", "giggles"],
  "juna-windwaerts": ["LUM", "confident, dry-humored, bright", "chuckles"],
  "kapitaen-blubbert": ["JAN", "booming, seamanlike, hearty", "booming laugh"],
  "kobold-kicher": ["DOB", "giggling, teasing, staccato", "giggles"],
  "koenig-friedrich": ["ADA", "commanding, curt, dignified", ""],
  "koenigin-isabella": ["SAB", "gracious, warm, composed", ""],
  "koenig-karl-der-weise": ["OPA", "deliberate, wise, dry", "chuckles"],
  "koenig-wilhelm": ["GEO", "formal, dignified, deep", ""],
  "krummfinger-der-sammler": ["MMO", "squeaky, hurried, whispering", "greedy giggle"],
  "kuno-knopf": ["WIL", "friendly, earnest, craftsmanlike", ""],
  "lehrerin-laempel": ["JUL", "clear, patient, encouraging", ""],
  "lumi-nachtlicht": ["SKB", "quiet, shy, gentle", ""],
  "luna": ["LAU", "snippy, superior, sly", "scoffs"],
  "magd-elsa": ["BEL", "quiet, modest, tired", "sighs"],
  "magierin-luna": ["BEL", "thoughtful, mysterious, soft", ""],
  "mia-neugier": ["SKB", "fast, curious, questioning", ""],
  "mina-mosaik": ["BIB", "vivid, enthusiastic, warm", "giggles"],
  "morpheus": ["HEL", "soothing, sleepy, whispering", "yawns"],
  "mueller-hans": ["CHR", "plain, honest, taciturn", "grunts"],
  "noch-einmal-nick": ["LIA", "playful, ingratiating, cocky", "chuckles"],
  "oma-herzlich": ["NAE", "cozy, warm, gentle humor", "chuckles"],
  "pip": ["DOB", "fast, hyper, excited", "squeaks"],
  "polizist-peter": ["LEN", "clear, steady, calming", ""],
  "postbote-papierschiff": ["ERI", "friendly, lightly singing, reliable", ""],
  "prinz-alexander": ["WIL", "bold, enthusiastic, sincere", ""],
  "prinzessin-rosalinde": ["JES", "warm, graceful, firm", ""],
  "professor-lichtweis": ["DAN", "bubbly, absent-minded, enthusiastic", "oh"],
  "raeuberhauptmann-rotbart": ["HAR", "rough, theatrical, booming", "roars with laughter"],
  "raeuber-raubauke": ["CAL", "boisterous, mocking, cocky", "laughs loudly"],
  "raeuber-rolf": ["HAR", "nervous, boastful, trying to sound threatening", "nervous laugh"],
  "rika-rindenlauf": ["MIL", "terse, calm, determined", ""],
  "ritter-rostfrei": ["LIA", "chivalrous, earnest, anxious", ""],
  "samu-sanftpfote": ["BRU", "calm, gentle, simple", "soft rumble"],
  "schattenjunge-finn": ["JON", "defiant, hurt, halting", ""],
  "schmied-konrad": ["LEO", "big, curt, plain-spoken", "grunts"],
  "schwarzmagier-vardun": ["ADA", "mocking, theatrical, slow", "villain laugh"],
  "silberfunke": ["CAN", "singing, rhyming, teasing", "giggles"],
  "silberhorn-der-hirsch": ["OTT", "noble, calm, steady", ""],
  "stiefmutter-brunhilde": ["MAT", "cold, elegant, cutting", "scoffs"],
  "tante-sorgenfalt": ["BRL", "anxious, trembling, loving", "gasps"],
  "theo-zeitsam": ["BIL", "dry, terse, wise", "dry chuckle"],
  "tilda-tueftel": ["LAU", "fast, inventive, excited", "giggles"],
  "troll-grummel": ["BRU", "deep, gruff, short sentences", "grumbles"],
  "weise-frau-margarethe": ["HIL", "warm, soothing, wise", ""],
  "wirtin-martha": ["SAB", "hearty, chatty, hospitable", "laughs"],
  "wolke-wuschel": ["LOL", "soft, gentle, rumbling", "giggles softly"],
  "yara-wellenklang": ["JUL", "melodic, calm, musical", ""],
  "zauberer-merlin": ["JOR", "deliberate, mysterious, twinkling", ""],
  "zauberer-sternenschweif": ["HEL", "melodic, riddling, gentle", ""],
};

/**
 * Baut den ElevenLabs-Text (mit Audio-Tags) für eine Figurenzeile.
 * intro: Persona, am Ende das typische Geräusch · stmt: feierlich wie ein Schwur · deny: empört
 * confess: kleinlaut mit Seufzer · smug: selbstzufrieden, am Ende das typische Lachen.
 */
export function characterText(slug, kind, text) {
  const entry = CAST[slug];
  if (!entry) throw new Error(`Figur ohne Besetzung: ${slug}`);
  const [, persona, flavor] = entry;
  const tail = flavor ? ` [${flavor}]` : "";
  switch (kind) {
    case "intro": return `[${persona}] ${text}${tail}`;
    case "stmt": return `[${persona}, solemn, like swearing an oath] ${text}`;
    case "deny": return `[${persona}, indignant] ${text}`;
    case "confess": return `[sighs] [${persona}, ashamed, quietly] ${text}`;
    case "smug": return `[${persona}, smug, pleased with itself] ${text}${flavor ? tail : " [chuckles]"}`;
    default: throw new Error(`Unbekannte Zeilenart: ${kind}`);
  }
}

/** Findet die Stimme zu einem Kürzel anhand der Konto-Liste. */
export function resolveVoice(key, accountVoices) {
  const needle = VOICE_KEYS[key]?.toLowerCase();
  if (!needle) throw new Error(`Unbekanntes Stimmen-Kürzel: ${key}`);
  const hit = accountVoices.find((v) => v.name.toLowerCase().includes(needle) || v.name.toLowerCase().replace(/[–—]/g, "-").includes(needle.replace(/[–—]/g, "-")));
  if (!hit) throw new Error(`Stimme im Konto nicht gefunden: ${key} (${VOICE_KEYS[key]})`);
  return hit;
}
