#!/usr/bin/env bun
/**
 * Merge V2 personality fields from Migration 20 SQL into the JSON character export.
 *
 * Usage: bun run merge-v2-personality.ts
 */

import { readFile, writeFile } from "fs/promises";
import { join } from "path";

const JSON_PATH = join(import.meta.dir, "Logs/sample/talea-characters-2026-02-02T12-25-31-114Z.json");
const SQL_PATH = join(import.meta.dir, "backend/story/migrations/20_seed_character_personality_v2.up.sql");

interface V2PersonalityData {
  dominantPersonality: string;
  secondaryTraits: string[];
  speechStyle: string[];
  catchphrase: string;
  catchphraseContext: string;
  emotionalTriggers: string[];
  quirk: string;
}

// Parse the SQL file to extract V2 personality data
function parseMigrationSQL(sql: string): Map<string, V2PersonalityData> {
  const result = new Map<string, V2PersonalityData>();

  // Split by UPDATE statements
  const updates = sql.split(/UPDATE character_pool SET/g).slice(1);

  for (const block of updates) {
    // Extract WHERE id
    const idMatch = block.match(/WHERE\s+id\s*=\s*'([^']+)'/);
    if (!idMatch) continue;
    const id = idMatch[1];

    // Extract fields
    const dominant = block.match(/dominant_personality\s*=\s*'([^']+)'/)?.[1] ?? "";
    const secondaryMatch = block.match(/secondary_traits\s*=\s*ARRAY\[([^\]]+)\]/);
    const secondary = secondaryMatch
      ? secondaryMatch[1].match(/'([^']+)'/g)?.map(s => s.replace(/'/g, "")) ?? []
      : [];

    const catchphrase = block.match(/catchphrase\s*=\s*'([^']+)'/)?.[1] ?? "";
    const catchphraseContext = block.match(/catchphrase_context\s*=\s*'([^']+)'/)?.[1] ?? "";

    const speechMatch = block.match(/speech_style\s*=\s*ARRAY\[([^\]]+)\]/);
    const speechStyle = speechMatch
      ? speechMatch[1].match(/'([^']+)'/g)?.map(s => s.replace(/'/g, "")) ?? []
      : [];

    const triggersMatch = block.match(/emotional_triggers\s*=\s*ARRAY\[([^\]]+)\]/);
    const emotionalTriggers = triggersMatch
      ? triggersMatch[1].match(/'([^']+)'/g)?.map(s => s.replace(/'/g, "")) ?? []
      : [];

    const quirk = block.match(/quirk\s*=\s*'([^']+)'/)?.[1] ?? "";

    result.set(id, {
      dominantPersonality: dominant,
      secondaryTraits: secondary,
      speechStyle,
      catchphrase,
      catchphraseContext,
      emotionalTriggers,
      quirk,
    });
  }

  return result;
}

// Build a mapping from character name keywords to SQL IDs
function buildNameToIdMap(): Map<string, string> {
  const map = new Map<string, string>();

  // Original 18 characters - map common name parts to SQL IDs
  map.set("frau müller", "char_001_frau_mueller");
  map.set("professor lichtweis", "char_002_professor_lichtweis");
  map.set("alte eiche", "char_003_alte_eiche");
  map.set("silberhorn", "char_004_hirsch_silberhorn");
  map.set("luna", "char_005_luna_die_katze");
  map.set("pip", "char_006_pip_das_eichhoernchen");
  map.set("silver spark", "char_007_silberfunke");
  map.set("silberfunke", "char_007_silberfunke");
  map.set("nebelfee", "char_008_nebelfee");
  map.set("funkelflug", "char_009_golddrache");
  map.set("graf griesgram", "char_010_graf_griesgram");
  map.set("nebelhexe", "char_011_die_nebelhexe");
  map.set("brumm", "char_012_steingolem");
  map.set("braun", "char_013_baecker_braun");
  map.set("wellenreiter", "char_014_leuchtturmwaerterin");
  map.set("mr. seitenflug", "char_015_bibliothekar_seitenflug");
  map.set("zeitweber", "char_016_zeitweber");
  map.set("astra", "char_017_sternentaenzerin");
  map.set("morpheus", "char_018_traumweber");

  // Human characters from migration 8 - map name to UUID IDs used in migration 20
  map.set("wilhelm", "7f8e9a1b-2c3d-4e5f-6a7b-8c9d0e1f2a3b"); // König Wilhelm
  map.set("maximilian", "a0b1c2d3-4e5f-6a7b-8c9d-0e1f2a3b4c5d"); // Prinz Alexander -> but we need to be careful
  map.set("isabella", "9b0c1d2e-3f4a-5b6c-7d8e-9f0a1b2c3d4e"); // Königin Isabella
  map.set("rosalie", "b1c2d3e4-5f6a-7b8c-9d0e-1f2a3b4c5d6e"); // Prinzessin Rosalinde -> mapped to Rosalie?
  map.set("hans", "c2d3e4f5-6a7b-8c9d-0e1f-2a3b4c5d6e7f"); // Müller Hans
  map.set("margarethe", "e0f1a2b3-4c5d-6e7f-8a9b-0c1d2e3f4a5b"); // Weise Frau Margarethe
  map.set("rolf", "c8d9e0f1-2a3b-4c5d-6e7f-8a9b0c1d2e3f"); // Räuber Rolf
  map.set("brunhilde", "d9e0f1a2-3b4c-5d6e-7f8a-9b0c1d2e3f4a"); // Stiefmutter Brunhilde
  map.set("cornelius", "a6b7c8d9-0e1f-2a3b-4c5d-6e7f8a9b0c1d"); // Zauberer Merlin -> Cornelius
  map.set("viktor", "a2b3c4d5-6e7f-8a9b-0c1d-2e3f4a5b6c7d"); // Händler Gustav -> Viktor
  map.set("peter", "e6f7a8b9-0c1d-2e3f-4a5b-6c7d8e9f0a1b"); // Hirtenjunge Peter
  map.set("lotte", "f7a8b9c0-1d2e-3f4a-5b6c-7d8e9f0a1b2c"); // Bauerntochter Greta -> Lotte

  return map;
}

// Build a mapping from SQL UUID IDs to V2 data, using the character names from migration 20 comments
function buildIdToV2Map(sqlData: Map<string, V2PersonalityData>): Map<string, V2PersonalityData> {
  return sqlData;
}

async function main() {
  console.log("🔄 Merging V2 personality data into character JSON...\n");

  // Read files
  const jsonContent = await readFile(JSON_PATH, "utf-8");
  const sqlContent = await readFile(SQL_PATH, "utf-8");

  const characters = JSON.parse(jsonContent) as any[];
  const v2Data = parseMigrationSQL(sqlContent);
  const nameToId = buildNameToIdMap();

  console.log(`📊 JSON characters: ${characters.length}`);
  console.log(`📊 V2 entries from SQL: ${v2Data.size}`);

  let matched = 0;
  let unmatched: string[] = [];

  for (const character of characters) {
    const name = (character.name as string).toLowerCase().trim();
    const charId = character.id as string;

    // Try to match by character ID directly (if it's a char_xxx ID)
    let v2 = v2Data.get(charId);

    // Try to match by name -> mapped ID
    if (!v2) {
      const mappedId = nameToId.get(name);
      if (mappedId) {
        v2 = v2Data.get(mappedId);
      }
    }

    // Try partial name match
    if (!v2) {
      for (const [nameKey, sqlId] of nameToId.entries()) {
        if (name.includes(nameKey) || nameKey.includes(name)) {
          v2 = v2Data.get(sqlId);
          if (v2) break;
        }
      }
    }

    // Try matching against UUID IDs directly from the SQL
    if (!v2) {
      v2 = v2Data.get(charId);
    }

    if (v2) {
      character.dominantPersonality = v2.dominantPersonality;
      character.secondaryTraits = v2.secondaryTraits;
      character.speechStyle = v2.speechStyle;
      character.catchphrase = v2.catchphrase;
      character.catchphraseContext = v2.catchphraseContext;
      character.emotionalTriggers = v2.emotionalTriggers;
      character.quirk = v2.quirk;
      matched++;
    } else {
      unmatched.push(character.name);
    }
  }

  console.log(`\n✅ Matched: ${matched}/${characters.length}`);
  if (unmatched.length > 0) {
    console.log(`⚠️  Unmatched (${unmatched.length}): ${unmatched.join(", ")}`);
    console.log("\n→ Generating default V2 data for unmatched characters based on their emotionalNature...");

    // Generate defaults from emotionalNature for unmatched characters
    for (const character of characters) {
      if (character.dominantPersonality) continue; // Already matched

      const emotional = character.emotionalNature || {};
      const dominant = emotional.dominant || "neugierig";
      const secondary = emotional.secondary || [];
      const triggers = emotional.triggers || [];

      // Map English dominant to German
      const dominantMap: Record<string, string> = {
        "adventurer": "mutig",
        "brave": "mutig",
        "wise": "weise",
        "curious": "neugierig",
        "kind": "hilfsbereit",
        "protective": "beschützend",
        "playful": "verspielt",
        "clever": "clever",
        "mischievous": "frech",
        "gentle": "sanft",
        "creative": "kreativ",
        "innocent": "unschuldig",
        "noble": "edel",
        "loyal": "loyal",
        "grumpy": "grummelig",
        "stern": "streng",
        "cheerful": "fröhlich",
        "wonder": "verträumt",
        "fierce": "wild",
        "jolly": "fröhlich",
        "calm": "ruhig",
        "mysterious": "geheimnisvoll",
        "cunning": "listig",
        "caring": "fürsorglich",
        "determined": "entschlossen",
        "stubborn": "stur",
        "proud": "stolz",
        "shy": "schüchtern",
        "energetic": "energisch",
        "sweet": "lieblich",
        "warm": "warmherzig",
        "lively": "lebhaft",
        "funny": "lustig",
        "strong": "stark",
        "elegant": "elegant",
        "patient": "geduldig",
        "dreamy": "verträumt",
        "vigilant": "wachsam",
        "free-spirited": "freiheitsliebend",
        "crafty": "geschickt",
        "whimsical": "launisch",
        "helpful": "hilfsbereit",
        "reliable": "zuverlässig",
      };

      // Map English secondary traits to German
      const traitMap: Record<string, string> = {
        ...dominantMap,
        "ancient": "uralt",
        "ethereal": "ätherisch",
        "magical": "magisch",
        "trickster": "schelmisch",
        "challenging": "herausfordernd",
        "lonely": "einsam",
        "misunderstood": "missverstandern",
        "generous": "großzügig",
        "organized": "organisiert",
        "enthusiastic": "enthusiastisch",
        "friendly": "freundlich",
        "clumsy": "tollpatschig",
        "independent": "unabhängig",
        "mysterious": "geheimnisvoll",
        "trustworthy": "vertrauenswürdig",
        "fast": "schnell",
        "slow": "langsam",
        "hardworking": "fleißig",
        "humble": "bescheiden",
        "nervous": "nervös",
        "quiet": "still",
        "hopeful": "hoffnungsvoll",
        "bossy": "bestimmerisch",
        "adventurous": "abenteuerlustig",
        "charming": "charmant",
        "tiny": "winzig",
        "cozy": "gemütlich",
        "music-loving": "musikliebend",
      };

      const germanDominant = dominantMap[dominant.toLowerCase()] || dominant;
      const germanSecondary = secondary
        .slice(0, 3)
        .map((s: string) => traitMap[s.toLowerCase()] || s);

      // Generate speech style from dominant personality
      const speechMap: Record<string, string[]> = {
        "mutig": ["direkt", "bestimmt", "ermunternd"],
        "weise": ["bedacht", "ruhig", "ermutigend"],
        "neugierig": ["fragend", "enthusiastisch", "wissbegierig"],
        "hilfsbereit": ["warmherzig", "einladend", "ermutigend"],
        "frech": ["neckend", "schnippisch", "verspielt"],
        "verspielt": ["fröhlich", "aufgeregt", "übertreibend"],
        "sanft": ["leise", "beruhigend", "poetisch"],
        "kreativ": ["fantasievoll", "begeistert", "bildhaft"],
        "grummelig": ["knapp", "brummig", "unwillig"],
        "loyal": ["bestimmt", "ehrlich", "direkt"],
        "schüchtern": ["leise", "zögerlich", "nachdenklich"],
        "verträumt": ["abschweifend", "poetisch", "sanft"],
        "clever": ["schnippisch", "überlegen", "verspielt"],
        "geheimnisvoll": ["rätselhaft", "langsam", "bedeutungsvoll"],
        "fröhlich": ["fröhlich", "einladend", "herzlich"],
        "streng": ["bestimmt", "knapp", "fordernd"],
        "listig": ["drohend", "nervös", "prahlerisch"],
        "beschützend": ["bestimmt", "warmherzig", "ruhig"],
        "unschuldig": ["kindlich", "staunend", "fröhlich"],
        "edel": ["förmlich", "bestimmt", "würdevoll"],
        "wild": ["laut", "direkt", "ungeduldig"],
        "elegant": ["diplomatisch", "warmherzig", "bestimmt"],
        "ruhig": ["bedacht", "ruhig", "langsam"],
        "stark": ["bestimmt", "knapp", "ehrlich"],
        "energisch": ["schnell", "aufgeregt", "enthusiastisch"],
        "lebhaft": ["schnell", "fröhlich", "übertreibend"],
        "warmherzig": ["warmherzig", "einladend", "ermutigend"],
        "lustig": ["fröhlich", "übertreibend", "witzig"],
        "stur": ["knapp", "bestimmt", "unwillig"],
        "stolz": ["förmlich", "bestimmt", "stolz"],
        "lieblich": ["sanft", "melodisch", "freundlich"],
        "geduldig": ["ruhig", "bedacht", "ermutigend"],
        "wachsam": ["knapp", "aufmerksam", "bestimmt"],
        "geschickt": ["schnell", "präzise", "charmant"],
        "entschlossen": ["bestimmt", "direkt", "ermunternd"],
        "zuverlässig": ["ehrlich", "direkt", "bestimmt"],
      };

      const speech = speechMap[germanDominant] || ["freundlich", "offen", "warmherzig"];

      // Generate a character-appropriate catchphrase
      const role = character.role || "";
      const species = character.visualProfile?.species || "";
      const charName = character.name as string;

      character.dominantPersonality = germanDominant;
      character.secondaryTraits = germanSecondary;
      character.speechStyle = speech;
      character.catchphrase = "";  // Will be filled below
      character.catchphraseContext = "";
      character.emotionalTriggers = triggers.slice(0, 4).map((t: string) => {
        // Translate common trigger words
        const triggerTranslations: Record<string, string> = {
          "adventure": "Abenteuer",
          "friends": "Freunde",
          "children": "Kinder",
          "help": "wenn jemand Hilfe braucht",
          "danger": "Gefahr",
          "nature": "Natur",
          "forest": "Waldabenteuer",
          "music": "Musik",
          "food": "Essen",
          "animals": "Tiere",
          "magic": "Magie",
          "mystery": "Rätsel",
          "injustice": "Ungerechtigkeit",
          "lost travelers": "verirrte Wanderer",
          "forest threats": "Bedrohung des Waldes",
          "learning": "Lernmomente",
        };
        return triggerTranslations[t.toLowerCase()] || t;
      });
      character.quirk = "";  // Will be filled below

      // Generate catchphrases and quirks based on character type
      generateCatchphraseAndQuirk(character);
    }
  }

  // Write output
  const outputPath = JSON_PATH; // Overwrite the same file
  await writeFile(outputPath, JSON.stringify(characters, null, 2), "utf-8");

  console.log(`\n✅ Written to: ${outputPath}`);
  console.log(`📊 Total characters: ${characters.length}`);
  console.log(`📊 With V2 personality: ${characters.filter((c: any) => c.dominantPersonality).length}`);
}

function generateCatchphraseAndQuirk(character: any) {
  const name = character.name as string;
  const species = (character.visualProfile?.species || "").toLowerCase();
  const role = (character.role || "").toLowerCase();
  const dominant = (character.dominantPersonality || "").toLowerCase();

  // Species-based catchphrases and quirks
  if (species.includes("cat") || species.includes("katze")) {
    character.catchphrase = character.catchphrase || `Miau... ${name} weiß immer Bescheid.`;
    character.catchphraseContext = character.catchphraseContext || "wenn sie etwas Interessantes entdeckt";
    character.quirk = character.quirk || "putzt sich betont gelangweilt eine Pfote";
  } else if (species.includes("dog") || species.includes("hund")) {
    character.catchphrase = character.catchphrase || "Wuff! Auf geht's, Freunde!";
    character.catchphraseContext = character.catchphraseContext || "wenn ein Abenteuer beginnt";
    character.quirk = character.quirk || "wedelt aufgeregt mit dem Schwanz";
  } else if (species.includes("rabbit") || species.includes("hase") || species.includes("bunny")) {
    character.catchphrase = character.catchphrase || "Hoppla! Das wird spannend!";
    character.catchphraseContext = character.catchphraseContext || "wenn etwas Überraschendes passiert";
    character.quirk = character.quirk || "zuckt aufgeregt mit der Nase";
  } else if (species.includes("bird") || species.includes("vogel") || species.includes("owl") || species.includes("eule")) {
    character.catchphrase = character.catchphrase || "Von hier oben sieht alles ganz anders aus!";
    character.catchphraseContext = character.catchphraseContext || "wenn sie einen Überblick verschafft";
    character.quirk = character.quirk || "neigt den Kopf schief wenn sie nachdenkt";
  } else if (species.includes("bear") || species.includes("bär")) {
    character.catchphrase = character.catchphrase || "Brumm! Erst mal was Leckeres suchen!";
    character.catchphraseContext = character.catchphraseContext || "wenn er Hunger hat oder trösten möchte";
    character.quirk = character.quirk || "schnuppert an allem was ihm begegnet";
  } else if (species.includes("fox") || species.includes("fuchs")) {
    character.catchphrase = character.catchphrase || "Ich kenne da einen Trick...";
    character.catchphraseContext = character.catchphraseContext || "wenn eine clevere Lösung gefragt ist";
    character.quirk = character.quirk || "streicht sich nachdenklich über den buschigen Schwanz";
  } else if (species.includes("horse") || species.includes("pferd")) {
    character.catchphrase = character.catchphrase || "Schnell, steigt auf! Wir haben keine Zeit zu verlieren!";
    character.catchphraseContext = character.catchphraseContext || "wenn Eile geboten ist";
    character.quirk = character.quirk || "scharrt ungeduldig mit dem Huf";
  } else if (species.includes("pig") || species.includes("schwein")) {
    character.catchphrase = character.catchphrase || "Oink! Das sieht doch ganz einfach aus!";
    character.catchphraseContext = character.catchphraseContext || "wenn sie eine Herausforderung unterschätzt";
    character.quirk = character.quirk || "wühlt überall neugierig herum";
  } else if (species.includes("sheep") || species.includes("schaf")) {
    character.catchphrase = character.catchphrase || "Mäh... zusammen sind wir stärker!";
    character.catchphraseContext = character.catchphraseContext || "wenn Teamwork gefragt ist";
    character.quirk = character.quirk || "kuschelt sich an jeden der traurig aussieht";
  } else if (species.includes("hamster")) {
    character.catchphrase = character.catchphrase || "Moment! Ich hab da was in meinen Backen gespeichert!";
    character.catchphraseContext = character.catchphraseContext || "wenn er etwas Nützliches hervorholt";
    character.quirk = character.quirk || "stopft sich die Backen voll wenn er nervös ist";
  } else if (species.includes("cow") || species.includes("kuh")) {
    character.catchphrase = character.catchphrase || "Muuuh... immer mit der Ruhe.";
    character.catchphraseContext = character.catchphraseContext || "wenn alle zu hektisch sind";
    character.quirk = character.quirk || "kaut gemütlich auf einem Grashalm";
  } else if (species.includes("goat") || species.includes("ziege")) {
    character.catchphrase = character.catchphrase || "Meck! Da komme ich auch hoch!";
    character.catchphraseContext = character.catchphraseContext || "wenn etwas schwer erreichbar scheint";
    character.quirk = character.quirk || "knabbert an allem was sie findet";
  } else if (species.includes("rooster") || species.includes("hahn")) {
    character.catchphrase = character.catchphrase || "Kikeriki! Aufwachen, es gibt Neuigkeiten!";
    character.catchphraseContext = character.catchphraseContext || "wenn er wichtige Neuigkeiten hat";
    character.quirk = character.quirk || "reckt stolz die Brust raus";
  } else if (species.includes("dragon") || species.includes("drache")) {
    character.catchphrase = character.catchphrase || "Hups! Das sollte eigentlich nicht brennen...";
    character.catchphraseContext = character.catchphraseContext || "wenn ihm versehentlich Feuer entfährt";
    character.quirk = character.quirk || "kleine Rauchkringel steigen aus den Nüstern wenn er aufgeregt ist";
  } else if (species.includes("unicorn") || species.includes("einhorn")) {
    character.catchphrase = character.catchphrase || "Schau, das Horn leuchtet! Es zeigt den Weg!";
    character.catchphraseContext = character.catchphraseContext || "wenn Magie im Spiel ist";
    character.quirk = character.quirk || "das Horn glitzert wenn sie sich freut";
  } else if (species.includes("fairy") || species.includes("fee")) {
    character.catchphrase = character.catchphrase || "Ein Wunsch? Aber nur ein ganz kleiner!";
    character.catchphraseContext = character.catchphraseContext || "wenn jemand Hilfe braucht";
    character.quirk = character.quirk || "hinterlässt überall Glitzerstaub";
  } else if (species.includes("dwarf") || species.includes("zwerg")) {
    character.catchphrase = character.catchphrase || "Was klein ist, ist deshalb noch lange nicht schwach!";
    character.catchphraseContext = character.catchphraseContext || "wenn jemand ihn unterschätzt";
    character.quirk = character.quirk || "klopft mit dem Werkzeug auf den Boden wenn er nachdenkt";
  } else if (species.includes("wolf")) {
    character.catchphrase = character.catchphrase || "Der Wind trägt viele Geschichten... wenn man zuhört.";
    character.catchphraseContext = character.catchphraseContext || "wenn er eine Spur entdeckt";
    character.quirk = character.quirk || "hebt die Nase in den Wind und lauscht";
  } else if (species.includes("hedgehog") || species.includes("igel")) {
    character.catchphrase = character.catchphrase || "Pieks! Vorsicht, nicht zu nah!";
    character.catchphraseContext = character.catchphraseContext || "wenn jemand zu stürmisch ist";
    character.quirk = character.quirk || "rollt sich bei Überraschungen kurz zusammen";
  } else if (species.includes("squirrel") || species.includes("eichhörnchen")) {
    character.catchphrase = character.catchphrase || "Nüsse! Äh, ich meine... natürlich helfe ich!";
    character.catchphraseContext = character.catchphraseContext || "wenn er abgelenkt wird";
    character.quirk = character.quirk || "hüpft aufgeregt von einem Fuß auf den anderen";
  } else if (species.includes("deer") || species.includes("hirsch") || species.includes("reh")) {
    character.catchphrase = character.catchphrase || "Still... hört ihr das auch?";
    character.catchphraseContext = character.catchphraseContext || "wenn Gefahr droht oder etwas Besonderes geschieht";
    character.quirk = character.quirk || "hebt lauschend den Kopf bei jedem Geräusch";
  } else if (species.includes("parrot") || species.includes("papagei")) {
    character.catchphrase = character.catchphrase || "Genau! Genau! Das hab ich doch gesagt!";
    character.catchphraseContext = character.catchphraseContext || "wenn er Recht behält";
    character.quirk = character.quirk || "wiederholt die letzten Worte anderer";
  } else if (species.includes("snowman") || species.includes("schneemann")) {
    character.catchphrase = character.catchphrase || "Brrr! Ist das herrlich frisch heute!";
    character.catchphraseContext = character.catchphraseContext || "wenn es kalt ist";
    character.quirk = character.quirk || "seine Karottennase rutscht ständig schief";
  } else if (species.includes("cloud") || species.includes("wolke")) {
    character.catchphrase = character.catchphrase || "Von hier oben sieht alles ganz friedlich aus!";
    character.catchphraseContext = character.catchphraseContext || "wenn sie die Welt von oben betrachtet";
    character.quirk = character.quirk || "verändert ihre Form je nach Stimmung";
  } else if (species.includes("star") || species.includes("stern")) {
    character.catchphrase = character.catchphrase || "Leuchte hell, kleiner Freund!";
    character.catchphraseContext = character.catchphraseContext || "wenn jemand Mut braucht";
    character.quirk = character.quirk || "funkelt heller wenn sie glücklich ist";
  } else if (species.includes("moon") || species.includes("mond")) {
    character.catchphrase = character.catchphrase || "Auch in der dunkelsten Nacht gibt es Licht.";
    character.catchphraseContext = character.catchphraseContext || "wenn jemand Angst im Dunkeln hat";
    character.quirk = character.quirk || "strahlt sanfter wenn sie tröstet";
  } else if (species.includes("sunflower") || species.includes("sonnenblume")) {
    character.catchphrase = character.catchphrase || "Die Sonne kommt immer wieder!";
    character.catchphraseContext = character.catchphraseContext || "wenn jemand traurig ist";
    character.quirk = character.quirk || "dreht sich immer zur Sonne";
  } else if (species.includes("duck") || species.includes("ente")) {
    character.catchphrase = character.catchphrase || "Quak! Folgt mir, ich kenne den Weg!";
    character.catchphraseContext = character.catchphraseContext || "wenn sie vorangeht";
    character.quirk = character.quirk || "watschelt aufgeregt hin und her";
  }

  // Role-based fallback for humans without species match
  if (!character.catchphrase || character.catchphrase === "") {
    if (role.includes("doctor") || name.includes("Doktor") || name.includes("Dr.")) {
      character.catchphrase = "Einmal tief einatmen... so ist es gut!";
      character.catchphraseContext = "wenn er jemanden untersucht oder beruhigt";
      character.quirk = "schaut immer zuerst in die Augen seines Gegenübers";
    } else if (role.includes("police") || name.includes("Poliz")) {
      character.catchphrase = "Keine Sorge, ich passe auf euch auf!";
      character.catchphraseContext = "wenn jemand Schutz braucht";
      character.quirk = "richtet sich die Mütze zurecht bevor er spricht";
    } else if (role.includes("teacher") || name.includes("Lehrer")) {
      character.catchphrase = "Wer eine Frage hat, hebt die Hand!";
      character.catchphraseContext = "wenn sie unterrichtet oder erklärt";
      character.quirk = "tippt mit dem Finger auf den Tisch beim Erklären";
    } else if (role.includes("firefighter") || name.includes("Feuerwehr") || name.includes("Felix")) {
      character.catchphrase = "Tatütata! Hilfe ist unterwegs!";
      character.catchphraseContext = "wenn ein Notfall eintritt";
      character.quirk = "prüft reflexartig ob sein Helm richtig sitzt";
    } else if (role.includes("mailman") || name.includes("Brief")) {
      character.catchphrase = "Post! Ich habe eine Nachricht für euch!";
      character.catchphraseContext = "wenn er Neuigkeiten überbringt";
      character.quirk = "kramt in seiner Tasche nach der richtigen Sendung";
    } else if (role.includes("musician") || name.includes("Melody") || name.includes("Musik")) {
      character.catchphrase = "Hört mal! Die Melodie erzählt eine Geschichte!";
      character.catchphraseContext = "wenn sie musiziert oder etwas Schönes hört";
      character.quirk = "wippt immer im Takt mit";
    } else if (role.includes("dancer") || name.includes("Tina") || name.includes("Tänzer")) {
      character.catchphrase = "Tanzen macht alles leichter!";
      character.catchphraseContext = "wenn sie jemanden aufmuntern möchte";
      character.quirk = "dreht sich bei jeder Gelegenheit im Kreis";
    } else if (role.includes("painter") || name.includes("Max") || name.includes("Maler")) {
      character.catchphrase = "Warte! Das muss ich schnell malen!";
      character.catchphraseContext = "wenn er etwas Schönes sieht";
      character.quirk = "hat immer Farbkleckse an den Fingern";
    } else if (role.includes("cook") || name.includes("Koch") || name.includes("Chef")) {
      character.catchphrase = "Das Geheimnis liegt in der Würze!";
      character.catchphraseContext = "wenn er kocht oder Rat gibt";
      character.quirk = "schnuppert an allem als ob es ein Gericht wäre";
    } else if (role.includes("grandma") || role.includes("grandmother") || name.includes("Oma") || name.includes("Hildegard") || name.includes("Gerda")) {
      character.catchphrase = "Komm her, mein Kind, ich erzähle dir eine Geschichte.";
      character.catchphraseContext = "wenn sie tröstet oder Weisheit teilt";
      character.quirk = "strickt an einem endlosen Schal während sie spricht";
    } else if (role.includes("grandpa") || role.includes("grandfather") || name.includes("Opa") || name.includes("Otto") || name.includes("Wilhelm")) {
      character.catchphrase = "Zu meiner Zeit... ach, das ist jetzt nicht wichtig.";
      character.catchphraseContext = "wenn er eine alte Geschichte anfangen will";
      character.quirk = "krault sich am Kinn wenn er nachdenkt";
    } else if (role.includes("shopkeeper") || name.includes("Viktor") || name.includes("Händler")) {
      character.catchphrase = "Nur heute, nur für euch – ein Sonderpreis!";
      character.catchphraseContext = "wenn er etwas verkaufen will";
      character.quirk = "reibt sich die Hände wenn er einen Deal wittert";
    } else if (role.includes("gardener") || name.includes("Rosa") || name.includes("Gärtner")) {
      character.catchphrase = "Jede Blume hat ihre eigene Geschichte!";
      character.catchphraseContext = "wenn sie im Garten arbeitet";
      character.quirk = "riecht an jeder Blume die sie sieht";
    } else if (name.includes("Tim")) {
      character.catchphrase = "Los geht's! Abenteuer warten nicht!";
      character.catchphraseContext = "wenn ein neues Abenteuer beginnt";
      character.quirk = "kann nie still sitzen bleiben";
    } else if (name.includes("Boss")) {
      character.catchphrase = "Baba! Ich will auch mit!";
      character.catchphraseContext = "wenn die Großen etwas Spannendes machen";
      character.quirk = "streckt die Ärmchen aus wenn es aufgeregt ist";
    } else if (name.includes("Frosty") || name.includes("Schnee")) {
      character.catchphrase = "Brrr! Ist das herrlich frisch!";
      character.catchphraseContext = "wenn es kalt ist";
      character.quirk = "seine Karottennase rutscht ständig schief";
    } else {
      // Generic fallback
      character.catchphrase = `Na, was gibt es Neues?`;
      character.catchphraseContext = "wenn er/sie jemanden trifft";
      character.quirk = "schaut aufmerksam um sich wenn etwas Neues passiert";
    }
  }
}

main().catch(console.error);
