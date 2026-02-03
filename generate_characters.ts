import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface Character {
    id: string;
    isActive: boolean;
    name: string;
    archetype: string;
    role: string;
    species: string; // Helper for visualProfile
    description: string; // Helper for visualProfile
    imagePrompt: string; // Helper for visualProfile
    dominantPersonality: string;
    secondaryTraits: string[];
    speechStyle: string[];
    catchphrase: string;
    catchphraseContext: string;
    emotionalTriggers: string[];
    quirk: string;
    // Computed fields for JSON structure
    emotionalNature?: any;
    visualProfile?: any;
    availableChapters?: number[];
    canonSettings?: string[];
    createdAt?: string;
    updatedAt?: string;
    maxScreenTime?: number;
    recentUsageCount?: number;
    totalUsageCount?: number;
    imageUrl?: string;
}

const templates: Character[] = [
    {
        id: crypto.randomUUID(),
        isActive: true,
        name: "Dr. Johann Heilgut",
        archetype: "healer",
        role: "helper",
        species: "human_doctor",
        description: "Dr. Johann Heilgut",
        imagePrompt: "Portrait of Dr. Johann Heilgut, friendly elderly doctor, white coat, stethoscope, round glasses, kind face, carrying a medical bag. Storybook illustration style, warm colors.",
        dominantPersonality: "fürsorglich",
        secondaryTraits: ["genau", "geduldig", "beruhigend"],
        speechStyle: ["medizinisch", "sanft", "ermutigend"],
        catchphrase: "Keine Sorge, das heilt schneller als man 'Pflaster' sagen kann!",
        catchphraseContext: "bei der Behandlung von kleineren Wehwehchen",
        emotionalTriggers: ["Verletzungen", "Krankheit", "Tapferkeit"],
        quirk: "rückt ständig seine Brille zurecht und zückt das Stethoskop"
    },
    {
        id: crypto.randomUUID(),
        isActive: true,
        name: "Räuber Raubauke",
        archetype: "villain",
        role: "antagonist",
        species: "human_bandit",
        description: "Räuber Raubauke",
        imagePrompt: "Portrait of Robber Raubauke, scruffy beard, black eye mask, striped shirt, sack over shoulder, sneaky expression. Storybook illustration style, dynamic lighting.",
        dominantPersonality: "frech",
        secondaryTraits: ["gierig", "laut", "stibitzend"],
        speechStyle: ["polternd", "umgangssprachlich", "laut"],
        catchphrase: "Was deins ist, ist bald meins!",
        catchphraseContext: "wenn er etwas Wertvolles sieht",
        emotionalTriggers: ["Gold", "Schätze", "Polizei"],
        quirk: "klaut unbemerkt Kleinigkeiten während er spricht"
    },
    {
        id: crypto.randomUUID(),
        isActive: true,
        name: "Oma Herzlich",
        archetype: "caregiver",
        role: "mentor",
        species: "human_elder",
        description: "Oma Herzlich",
        imagePrompt: "Portrait of Grandma Herzlich, sweet old lady with white bun hair, apron with flower pattern, holding a plate of cookies, warm smile. Storybook illustration style, cozy atmosphere.",
        dominantPersonality: "liebevoll",
        secondaryTraits: ["gastfreundlich", "großzügig", "verhätschelnd"],
        speechStyle: ["weich", "kosewortreich", "besorgt"],
        catchphrase: "Komm erst mal rein, Kindchen, nimm dir einen Keks.",
        catchphraseContext: "zur Begrüßung oder zum Trost",
        emotionalTriggers: ["Hunger", "Traurigkeit", "dünne Kinder"],
        quirk: "bietet jedem, wirklich jedem, sofort etwas zu Essen an"
    },
    {
        id: crypto.randomUUID(),
        isActive: true,
        name: "Hexe Kräuterweis",
        archetype: "magical_trickster",
        role: "neutral",
        species: "human_witch",
        description: "Hexe Kräuterweis",
        imagePrompt: "Portrait of Witch Kräuterweis, crooked hat, messy hair with twigs in it, green robes, stirring a small cauldron, mischievous grin. Storybook illustration style, mystical green glow.",
        dominantPersonality: "exzentrisch",
        secondaryTraits: ["schusselig", "kreativ", "geheimnisvoll"],
        speechStyle: ["reimend", "kichernd", "mystisch"],
        catchphrase: "Krötenbein und Spinnendreck, eins, zwei, drei und du bist weg!",
        catchphraseContext: "beim Zaubern oder wenn sie ihre Ruhe will",
        emotionalTriggers: ["Magie", "seltene Zutaten", "Unordnung"],
        quirk: "spricht manchmal mit ihrem Besen als wäre er eine Person"
    },
    {
        id: crypto.randomUUID(),
        isActive: true,
        name: "Zauberer Sternenschweif",
        archetype: "magical_mentor",
        role: "mentor",
        species: "human_wizard",
        description: "Zauberer Sternenschweif",
        imagePrompt: "Portrait of Wizard Sternenschweif, long white beard, starry blue robe, tall pointed hat, holding a glowing staff. Storybook illustration style, magical blue aura.",
        dominantPersonality: "weise",
        secondaryTraits: ["zerstreut", "mächtig", "altmodisch"],
        speechStyle: ["gehoben", "rätselhaft", "langsam"],
        catchphrase: "Die Sterne lügen nie, man muss sie nur lesen können.",
        catchphraseContext: "wenn er einen Rat gibt",
        emotionalTriggers: ["Gefahr", "kosmische Ungleichgewichte", "Respektlosigkeit"],
        quirk: "vergisst oft wo er seinen Zauberstab hingelegt hat (er hält ihn in der Hand)"
    },
    {
        id: crypto.randomUUID(),
        isActive: true,
        name: "Leo Löwenmut",
        archetype: "hero",
        role: "main",
        species: "human_child_boy",
        description: "Leo Löwenmut",
        imagePrompt: "Portrait of Leo, 8yo boy, messy brown hair, wearing a makeshift superhero cape and pilot goggles, brave stance. Storybook illustration style, vibrant colors.",
        dominantPersonality: "mutig",
        secondaryTraits: ["abenteuerlustig", "ehrlich", "ungestüm"],
        speechStyle: ["begeistert", "laut", "heldenhaft"],
        catchphrase: "Das ist ein Job für Leo Löwenmut!",
        catchphraseContext: "wenn eine Aufgabe schwierig erscheint",
        emotionalTriggers: ["Ungerechtigkeit", "Abenteuer", "Drachen"],
        quirk: "stellt sich immer in Superhelden-Pose, Hände in den Hüften"
    },
    {
        id: crypto.randomUUID(),
        isActive: true,
        name: "Mia Neugier",
        archetype: "explorer",
        role: "main",
        species: "human_child_girl",
        description: "Mia Neugier",
        imagePrompt: "Portrait of Mia, 7yo girl, pigtails, overalls with many pockets, holding a magnifying glass and a map. Storybook illustration style, detailed textures.",
        dominantPersonality: "neugierig",
        secondaryTraits: ["schlau", "beobachtend", "fragend"],
        speechStyle: ["fragend", "schnell", "analytisch"],
        catchphrase: "Hmm... das muss ich mir genauer ansehen!",
        catchphraseContext: "wenn sie ein Rätsel oder etwas Neues entdeckt",
        emotionalTriggers: ["Geheimnisse", "neue Orte", "Rätsel"],
        quirk: "schaut alles durch ihre Lupe an, auch Menschen"
    },
    {
        id: crypto.randomUUID(),
        isActive: true,
        name: "Professor Tüftel",
        archetype: "inventor",
        role: "helper",
        species: "human_scientist",
        description: "Professor Tüftel",
        imagePrompt: "Portrait of Professor Tüftel, wild grey hair, lab coat with oil stains, holding a strange mechanical gadget, excited expression. Storybook illustration style, steampunk vibes.",
        dominantPersonality: "genial",
        secondaryTraits: ["chaotisch", "begeistert", "technisch"],
        speechStyle: ["kompliziert", "schnell", "fachsimpelnd"],
        catchphrase: "Heureka! Es funktioniert... glaube ich!",
        catchphraseContext: "wenn er eine Erfindung präsentiert",
        emotionalTriggers: ["Defekte Maschinen", "Inspiration", "Explosionen"],
        quirk: "hat immer eine Schraube locker... wörtlich, in der Tasche"
    },
    {
        id: crypto.randomUUID(),
        isActive: true,
        name: "Bello der Spürhund",
        archetype: "animal_companion",
        role: "sidekick",
        species: "dog",
        description: "Bello",
        imagePrompt: "Portrait of Bello the dog, golden retriever floppy ears, wearing a detective hat, wagging tail. Storybook illustration style, cute and friendly.",
        dominantPersonality: "treu",
        secondaryTraits: ["verfressen", "verspielt", "mutig"],
        speechStyle: ["wuff", "bellend", "knurrend (freundlich)"],
        catchphrase: "Wuff! Ich rieche Abenteuer... und Wurst!",
        catchphraseContext: "wenn er eine Fährte aufnimmt",
        emotionalTriggers: ["Leckerlis", "Bälle", "fremde Katzen"],
        quirk: "jagt seinen eigenen Schwanz bei Aufregung"
    },
    {
        id: crypto.randomUUID(),
        isActive: true,
        name: "Mimi Samtpfote",
        archetype: "animal_companion",
        role: "sidekick",
        species: "cat",
        description: "Mimi",
        imagePrompt: "Portrait of Mimi the cat, elegant white fluffy cat, wearing a pink bow collar, sitting regally. Storybook illustration style, elegant.",
        dominantPersonality: "elegant",
        secondaryTraits: ["eingebildet", "verschmust", "flink"],
        speechStyle: ["schnurrend", "miauend", "leise"],
        catchphrase: "Miau. Ist das auch gut genug für mich?",
        catchphraseContext: "wenn sie Futter oder einen Schlafplatz inspiziert",
        emotionalTriggers: ["Kraulen", "Fisch", "nasse Pfoten"],
        quirk: "leckt sich demonstrativ die Pfote wenn ihr etwas nicht passt"
    },
    {
        id: crypto.randomUUID(),
        isActive: true,
        name: "Eichhörnchen Flitz",
        archetype: "animal_trickster",
        role: "helper",
        species: "squirrel",
        description: "Flitz",
        imagePrompt: "Portrait of Flitz the squirrel, holding an acorn bigger than its head, bushy tail, big shiny eyes. Storybook illustration style, dynamic.",
        dominantPersonality: "hyperaktiv",
        secondaryTraits: ["schnell", "sammelwütig", "schreckhaft"],
        speechStyle: ["rasend schnell", "piepsig", "stotternd"],
        catchphrase: "Hui! Hab ich da eine Nuss gesehen? Wo? Wo?",
        catchphraseContext: "ständig, besonders in Wäldern",
        emotionalTriggers: ["Nüsse", "Eicheln", "laute Geräusche"],
        quirk: "kann keine Sekunde stillstehen"
    },
    {
        id: crypto.randomUUID(),
        isActive: true,
        name: "Feuerwehrfrau Fanni",
        archetype: "hero_helper",
        role: "helper",
        species: "human_firefighter",
        description: "Feuerwehrfrau Fanni",
        imagePrompt: "Portrait of Firefighter Fanni, brave woman in firefighter uniform and helmet, holding a hose, confident smile. Storybook illustration style, heroic pose.",
        dominantPersonality: "tatkräftig",
        secondaryTraits: ["mutig", "zuverlässig", "sportlich"],
        speechStyle: ["laut", "klar", "befehlend"],
        catchphrase: "Wasser marsch! Wir löschen das!",
        catchphraseContext: "bei Gefahr oder Feuer",
        emotionalTriggers: ["Feuer", "Gefahr", "Katzen auf Bäumen"],
        quirk: "prüft immer ob der Feuerlöscher griffbereit ist"
    },
    {
        id: crypto.randomUUID(),
        isActive: true,
        name: "Polizist Peter",
        archetype: "guardian",
        role: "support",
        species: "human_police",
        description: "Polizist Peter",
        imagePrompt: "Portrait of Police Officer Peter, blue uniform, police hat, whistle around neck, friendly but strict face. Storybook illustration style.",
        dominantPersonality: "ordnungsliebend",
        secondaryTraits: ["streng", "korrekt", "hilfsbereit"],
        speechStyle: ["amtlich", "förmlich", "korrekt"],
        catchphrase: "Halt! Hier gilt die Straßenverkehrsordnung!",
        catchphraseContext: "wenn jemand zu schnell rennt",
        emotionalTriggers: ["Unordnung", "Regelverstöße", "Donuts"],
        quirk: "zückt sofort seinen Notizblock für ein Protokoll"
    },
    {
        id: crypto.randomUUID(),
        isActive: true,
        name: "Bäcker Bruno",
        archetype: "merchant",
        role: "support",
        species: "human_baker",
        description: "Bäcker Bruno",
        imagePrompt: "Portrait of Baker Bruno, big round man, white baker's hat and apron, covered in flour, holding a fresh baguette. Storybook illustration style, warm lighting.",
        dominantPersonality: "gemütlich",
        secondaryTraits: ["freundlich", "großzügig", "genießerisch"],
        speechStyle: ["warm", "einladend", "schmatzend"],
        catchphrase: "Frisch, knusprig und lecker! Greift zu!",
        catchphraseContext: "wenn er Backwaren anbietet",
        emotionalTriggers: ["verbranntes Brot", "lob für sein Gebäck", "Hunger"],
        quirk: "hat immer eine Mehlwolke um sich herum"
    },
    {
        id: crypto.randomUUID(),
        isActive: true,
        name: "Kapitän Blubbert",
        archetype: "adventurer",
        role: "guide",
        species: "human_sailor",
        description: "Kapitän Blubbert",
        imagePrompt: "Portrait of Captain Blubbert, old sailor with a white beard, captains hat, pipe, blue striped shirt. Storybook illustration style, maritime theme.",
        dominantPersonality: "rau",
        secondaryTraits: ["herzlich", "laut", "erfahren"],
        speechStyle: ["seemannsgarn", "laut", "lachend"],
        catchphrase: "Beim Klabautermann! Land in Sicht!",
        catchphraseContext: "wenn er etwas entdeckt oder sich freut",
        emotionalTriggers: ["das Meer", "Sturm", "Schiffe"],
        quirk: "schwankt beim Gehen als wäre er an Bord"
    },
    {
        id: crypto.randomUUID(),
        isActive: true,
        name: "Prinzessin Lilia",
        archetype: "royal",
        role: "main",
        species: "human_princess",
        description: "Prinzessin Lilia",
        imagePrompt: "Portrait of Princess Lilia, wearing a pink crown but muddy boots and a torn dress, adventurous spirit. Storybook illustration style, contrast between royal and wild.",
        dominantPersonality: "wild",
        secondaryTraits: ["unprinzessinnenhaft", "mutig", "frech"],
        speechStyle: ["direkt", "trotzig", "fröhlich"],
        catchphrase: "Auch eine Prinzessin kann auf Bäume klettern!",
        catchphraseContext: "wenn jemand sagt, sie solle sich benehmen",
        emotionalTriggers: ["Etikette", "Langeweile", "Kleider"],
        quirk: "trägt immer einen Frosch in der Tasche"
    },
    {
        id: crypto.randomUUID(),
        isActive: true,
        name: "Ritter Rostfrei",
        archetype: "guardian",
        role: "helper",
        species: "human_knight",
        description: "Ritter Rostfrei",
        imagePrompt: "Portrait of Knight Rostfrei, in shiny armor that is slightly too big, helmet visor sliding down, holding a wooden sword. Storybook illustration style, comical.",
        dominantPersonality: "patscherig",
        secondaryTraits: ["gutmütig", "ängstlich", "pflichtbewusst"],
        speechStyle: ["blechern", "stotternd", "feierlich"],
        catchphrase: "Für Ehre und... öh... wo ist mein Schwert?",
        catchphraseContext: "beim Versuch heldenhaft zu sein",
        emotionalTriggers: ["Drachen", "Rost", "Duelle"],
        quirk: "fällt oft über seine eigenen Füße, rappelt sich aber immer wieder auf"
    },
    {
        id: crypto.randomUUID(),
        isActive: true,
        name: "Drache Fauchi",
        archetype: "creature",
        role: "neutral",
        species: "dragon_small",
        description: "Drache Fauchi",
        imagePrompt: "Portrait of Fauchi the Dragon, small green dragon, tiny wings, trying to look scary but looking cute, puff of smoke. Storybook illustration style.",
        dominantPersonality: "Möchtegern-böse",
        secondaryTraits: ["niedlich", "hitzköpfig", "verspielt"],
        speechStyle: ["krächzend", "rauchig", "kindlich"],
        catchphrase: "Ich bin nicht niedlich! Ich bin gefährlich! Roar!",
        catchphraseContext: "wenn ihn jemand streicheln will",
        emotionalTriggers: ["Gold", "Ritter", "Wasser"],
        quirk: "hustet Rauchwolken wenn er lachen muss"
    },
    {
        id: crypto.randomUUID(),
        isActive: true,
        name: "Fee Rosalie",
        archetype: "magical_helper",
        role: "helper",
        species: "fairy",
        description: "Fee Rosalie",
        imagePrompt: "Portrait of Fairy Rosalie, tiny with butterfly wings, pink glowing dress, holding a wand with a star. Storybook illustration style, sparkly.",
        dominantPersonality: "zauberhaft",
        secondaryTraits: ["hilfsbereit", "zart", "glitzernd"],
        speechStyle: ["hoch", "singend", "klingend"],
        catchphrase: "Ein bisschen Glitzer hilft immer.",
        catchphraseContext: "wenn sie ein Problem löst",
        emotionalTriggers: ["Dunkelheit", "Traurigkeit", "Blumen"],
        quirk: "hinterlässt überall eine Spur aus Glitzerstaub"
    },
    {
        id: crypto.randomUUID(),
        isActive: true,
        name: "Troll Grummel",
        archetype: "creature_obstacle",
        role: "antagonist",
        species: "troll",
        description: "Troll Grummel",
        imagePrompt: "Portrait of Troll Grummel, big nose, mossy skin, under a bridge, looking grumpy but harmless. Storybook illustration style, earthy tones.",
        dominantPersonality: "mürrisch",
        secondaryTraits: ["bestechlich", "stark", "einfach"],
        speechStyle: ["grollend", "kurz angebunden", "tief"],
        catchphrase: "Keiner kommt hier vorbei ohne Wegezoll!",
        catchphraseContext: "wenn er eine Brücke blockiert",
        emotionalTriggers: ["Höflichkeit", "Essen", "Lärm"],
        quirk: "kratzt sich lautstark am Bauch"
    },
    {
        id: crypto.randomUUID(),
        isActive: true,
        name: "Robo-X",
        archetype: "construct",
        role: "helper",
        species: "robot",
        description: "Robo-X",
        imagePrompt: "Portrait of Robo-X, cute square robot with wheels, glowing screen face showing a smile, antennas. Storybook illustration style, tech details.",
        dominantPersonality: "logisch",
        secondaryTraits: ["hilfreich", "unfreiwillig komisch", "präzise"],
        speechStyle: ["mechanisch", "piepsend", "monoton"],
        catchphrase: "Beep Boop. Analyse abgeschlossen. Spaß-Level: Hoch.",
        catchphraseContext: "nach einer Berechnung oder Beobachtung",
        emotionalTriggers: ["Wasser", "Magnete", "Updates"],
        quirk: "dreht sich im Kreis wenn er rechnet"
    },
    {
        id: crypto.randomUUID(),
        isActive: true,
        name: "Astronautin Nova",
        archetype: "explorer",
        role: "special",
        species: "human_astronaut",
        description: "Astronautin Nova",
        imagePrompt: "Portrait of Astronaut Nova, in futuristic white space suit, bubble helmet, floating in zero gravity. Storybook illustration style, cosmic background.",
        dominantPersonality: "visionär",
        secondaryTraits: ["schwerelos", "ruhig", "wissenschaftlich"],
        speechStyle: ["funk-verzerrt", "cool", "fachlich"],
        catchphrase: "Bis zur Unendlichkeit und noch viel weiter!",
        catchphraseContext: "beim Start oder einer Entdeckung",
        emotionalTriggers: ["Aliens", "Kometen", "Schwerkraft"],
        quirk: "versucht manchmal Dinge schweben zu lassen, auch auf der Erde"
    },
    {
        id: crypto.randomUUID(),
        isActive: true,
        name: "Detektiv Schnüffel",
        archetype: "investigator",
        role: "neutral",
        species: "fox_detective",
        description: "Detektiv Schnüffel",
        imagePrompt: "Portrait of Detective Schnüffel, fox in a trench coat and fedora hat, looking suspicious with a notebook. Storybook illustration style.",
        dominantPersonality: "misstrauisch",
        secondaryTraits: ["schlau", "hartnäckig", "stilvoll"],
        speechStyle: ["flüsternd", "kombinierend", "geheimnisvoll"],
        catchphrase: "Dieser Fall stinkt... nach Geheimnis!",
        catchphraseContext: "wenn er eine Spur findet",
        emotionalTriggers: ["Lügen", "Spuren", "Lupe"],
        quirk: "rückt seinen Hut tief ins Gesicht"
    },
    {
        id: crypto.randomUUID(),
        isActive: true,
        name: "Gespenst Schrecki",
        archetype: "creature",
        role: "friend",
        species: "ghost",
        description: "Gespenst Schrecki",
        imagePrompt: "Portrait of Ghost Schrecki, white sheet ghost with patches, big pleading eyes, floating. Storybook illustration style, translucent.",
        dominantPersonality: "schüchtern",
        secondaryTraits: ["lieb", "unsichtbar", "ängstlich"],
        speechStyle: ["heilend", "zitternd", "leise"],
        catchphrase: "Buh! ... Hast du dich erschreckt? Bitte sag ja.",
        catchphraseContext: "beim Versuch zu spuken",
        emotionalTriggers: ["Staubsauger", "Licht", "tapfere Kinder"],
        quirk: "wird rot wenn ihm etwas peinlich ist (obwohl er weiß ist)"
    },
    {
        id: crypto.randomUUID(),
        isActive: true,
        name: "Gärtnerin Flora",
        archetype: "nature_lover",
        role: "support",
        species: "human_gardener",
        description: "Gärtnerin Flora",
        imagePrompt: "Portrait of Gardener Flora, straw hat, green dungarees, holding a watering can, surrounded by flowers. Storybook illustration style, vivid floral colors.",
        dominantPersonality: "naturverbunden",
        secondaryTraits: ["geduldig", "fürsorglich", "erdig"],
        speechStyle: ["ruhig", "liebevoll", "langsam"],
        catchphrase: "Geduld ist die Wurzel aller Freude.",
        catchphraseContext: "beim Pflanzen oder Warten",
        emotionalTriggers: ["Unkraut", "Regen", "Schnecken"],
        quirk: "spricht mit ihren Pflanzen und gibt ihnen Namen"
    },
    {
        id: crypto.randomUUID(),
        isActive: true,
        name: "Königin Klara",
        archetype: "royal",
        role: "mentor",
        species: "human_queen",
        description: "Königin Klara",
        imagePrompt: "Portrait of Queen Klara, regal posture, golden crown, red velvet robe, kind but authoritative face. Storybook illustration style, majestic.",
        dominantPersonality: "gerecht",
        secondaryTraits: ["majestätisch", "klug", "gütig"],
        speechStyle: ["hoheitsvoll", "gewählt", "bestimmt"],
        catchphrase: "Gerechtigkeit steht jedem gut.",
        catchphraseContext: "beim Fällen eines Urteils",
        emotionalTriggers: ["Ungerechtigkeit", "Chaos", "Drachenangriffe"],
        quirk: "richtet ihre Krone, auch wenn sie perfekt sitzt"
    },
    {
        id: crypto.randomUUID(),
        isActive: true,
        name: "Zwerg Goldzahn",
        archetype: "miner",
        role: "helper",
        species: "dwarf",
        description: "Zwerg Goldzahn",
        imagePrompt: "Portrait of Dwarf Goldzahn, long red beard, pickaxe over shoulder, miner's helmet with candle, dirty face. Storybook illustration style, underground lighting.",
        dominantPersonality: "fleißig",
        secondaryTraits: ["stur", "stark", "handwerklich"],
        speechStyle: ["grummelig", "direkt", "laut"],
        catchphrase: "Tief graben, Schätze heben!",
        catchphraseContext: "bei der Arbeit",
        emotionalTriggers: ["Gold", "Edelsteine", "Elfen (mag er nicht)"],
        quirk: "beißt auf Münzen um zu prüfen ob sie echt sind"
    },
    {
        id: crypto.randomUUID(),
        isActive: true,
        name: "Einhorn Sternenglanz",
        archetype: "magical_creature",
        role: "special",
        species: "unicorn",
        description: "Einhorn Sternenglanz",
        imagePrompt: "Portrait of Unicorn Sternenglanz, white horse with pearlescent horn, rainbow mane, sparkling aura. Storybook illustration style, dreamlike.",
        dominantPersonality: "rein",
        secondaryTraits: ["magisch", "scheu", "anmutig"],
        speechStyle: ["telepathisch", "sanft", "weise"],
        catchphrase: "Folge deinem Herzen, es kennt den Weg.",
        catchphraseContext: "in Momenten der Verzweiflung",
        emotionalTriggers: ["Unschuld", "Dunkle Magie", "Äpfel"],
        quirk: "hinterlässt Regenbögen wo es galoppiert"
    },
    {
        id: crypto.randomUUID(),
        isActive: true,
        name: "Lehrerin Lämpel",
        archetype: "mentor",
        role: "support",
        species: "human_teacher",
        description: "Lehrerin Lämpel",
        imagePrompt: "Portrait of Teacher Lämpel, strict bun, glasses on chain, pointing at a blackboard with ABC. Storybook illustration style, classroom setting.",
        dominantPersonality: "belehrend",
        secondaryTraits: ["klug", "streng", "wissend"],
        speechStyle: ["deutlich", "hochdeutsch", "erklärend"],
        catchphrase: "Wer nicht fragt, bleibt dumm!",
        catchphraseContext: "im Unterricht oder bei Fehlern",
        emotionalTriggers: ["Rechtschreibfehler", "Lärm", "Wissensdurst"],
        quirk: "hebt den Zeigefinger wenn sie etwas erklärt"
    },
    {
        id: crypto.randomUUID(),
        isActive: true,
        name: "Postbote Papierschiff",
        archetype: "messenger",
        role: "support",
        species: "human_postman",
        description: "Postbote Papierschiff",
        imagePrompt: "Portrait of Postman Papierschiff, yellow uniform, huge bag overflowing with letters, riding a bicycle. Storybook illustration style, motion blur.",
        dominantPersonality: "eilig",
        secondaryTraits: ["pünktlich", "informiert", "sportlich"],
        speechStyle: ["schnell", "atemlos", "freundlich"],
        catchphrase: "Post ist da! Egal bei welchem Wetter!",
        catchphraseContext: "bei der Zustellung",
        emotionalTriggers: ["Hunde", "Regen", "falsche Adressen"],
        quirk: "klingelt zweimal, immer"
    }
];

const enrichedCharacters = templates.map(char => {
    // Basic mapping to expanded structure to match existing JSON
    return {
        ...char,
        emotionalNature: {
            dominant: (char.dominantPersonality === "frech" || char.dominantPersonality === "Möchtegern-böse") ? "mischievous" :
                (char.dominantPersonality === "weise" || char.dominantPersonality === "klug") ? "wise" :
                    (char.dominantPersonality === "mutig" || char.dominantPersonality === "tatkräftig") ? "brave" :
                        (char.dominantPersonality === "liebevoll" || char.dominantPersonality === "fürsorglich") ? "kind" : "neutral",
            secondary: char.secondaryTraits.map(t => {
                // Very rough mapping just to fill the field, not critical
                return "trait";
            }),
            triggers: char.emotionalTriggers.map(t => "trigger")
        },
        visualProfile: {
            colorPalette: ["primary", "secondary", "accent"], // Dummy defaults
            description: char.description,
            imagePrompt: char.imagePrompt,
            species: char.species
        },
        availableChapters: [1, 2, 3, 4, 5],
        canonSettings: ["forest", "village", "castle", "home"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        maxScreenTime: 50,
        recentUsageCount: 0,
        totalUsageCount: 0,
        imageUrl: "" // Reset image URL for new generation
    };
});

const outputPath = 'C:\\MyProjects\\Talea\\talea-storytelling-platform\\Logs\\sample\\talea-characters-enhanced.json';
fs.writeFileSync(outputPath, JSON.stringify(enrichedCharacters, null, 2));
console.log(`Successfully written ${enrichedCharacters.length} characters to ${outputPath}`);
