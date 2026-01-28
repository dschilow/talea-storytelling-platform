-- Migration 17: Add more TaleDNA entries for classic fairy tales

-- Schneewittchen (Snow White) - grimm-053
INSERT INTO tale_dna (tale_id, tale_dna)
VALUES
('grimm-053', $$
{
  "tale": {
    "taleId": "grimm-053",
    "title": "Schneewittchen",
    "language": "de",
    "age": { "min": 5, "max": 10 },
    "summary": "Eine wunderschoene Prinzessin flieht vor ihrer eifersuchtigen Stiefmutter und findet Zuflucht bei sieben Zwergen im Wald.",
    "moralLesson": "Wahre Schoenheit kommt von innen, und Guete siegt ueber Neid.",
    "cultureRegion": "german",
    "source": "grimm",
    "themeTags": ["kindness", "jealousy", "friendship", "courage"],
    "coreConflict": "Die boese Koenigin will Schneewittchen aus Eifersucht vernichten.",
    "emotionalArc": ["fear", "hope", "friendship", "danger", "joy"],
    "chapterCountHint": 5,
    "iconicBeats": [
      "Der magische Spiegel verraet die Schoenste",
      "Flucht in den Wald zu den sieben Zwergen",
      "Die Koenigin verkleidet sich",
      "Der vergiftete Apfel",
      "Der Prinz erweckt Schneewittchen"
    ],
    "fixedElements": ["magic mirror", "seven dwarfs", "poisoned apple", "glass coffin"],
    "flexibleElements": ["forest setting", "artifact twist", "rescue method"],
    "toneBounds": {
      "targetTone": "Magical, hopeful, gentle suspense",
      "contentRules": [
        "Keep danger implied, not graphic",
        "Focus on friendship and kindness",
        "Ensure a happy ending",
        "Use age-appropriate language"
      ]
    }
  },
  "roles": [
    { "slotKey": "SLOT_PROTAGONIST_1", "roleType": "PROTAGONIST", "required": true, "roleCount": 1, "archetypePreference": ["innocent", "kind"], "constraints": ["gender=female", "age=child"], "visualHints": ["black hair", "red lips", "fair skin", "simple dress"] },
    { "slotKey": "SLOT_ANTAGONIST_1", "roleType": "ANTAGONIST", "required": true, "roleCount": 1, "archetypePreference": ["vain", "queen"], "constraints": ["gender=female", "age=adult"], "visualHints": ["crown", "dark cloak", "elegant but sinister"] },
    { "slotKey": "SLOT_HELPER_1", "roleType": "HELPER", "required": true, "roleCount": 1, "archetypePreference": ["dwarf", "friendly"], "constraints": ["size=small"], "visualHints": ["dwarf", "colorful hat", "beard", "mining tools"] },
    { "slotKey": "SLOT_GUARDIAN_1", "roleType": "GUARDIAN", "required": false, "roleCount": 1, "archetypePreference": ["prince", "noble"], "constraints": ["gender=male", "age=young_adult"], "visualHints": ["prince", "noble clothing", "kind eyes"] }
  ],
  "scenes": [
    {
      "sceneNumber": 1,
      "beatType": "SETUP",
      "sceneTitle": "Der Spiegel spricht",
      "setting": "castle throne room",
      "mood": "MYSTERIOUS",
      "sceneDescription": "Die Koenigin fragt ihren magischen Spiegel, wer die Schoenste im Land ist.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1", "SLOT_ANTAGONIST_1"]
    },
    {
      "sceneNumber": 2,
      "beatType": "INCITING",
      "sceneTitle": "Flucht in den Wald",
      "setting": "dark forest",
      "mood": "TENSE",
      "sceneDescription": "Schneewittchen flieht in den dunklen Wald und entdeckt das kleine Haus der Zwerge.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1"]
    },
    {
      "sceneNumber": 3,
      "beatType": "CONFLICT",
      "sceneTitle": "Bei den sieben Zwergen",
      "setting": "dwarf cottage",
      "mood": "COZY",
      "sceneDescription": "Die Zwerge nehmen Schneewittchen auf und warnen sie vor der boesen Koenigin.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1", "SLOT_HELPER_1"],
      "artifactPolicy": { "requiresArtifact": true, "artifactSlotKey": "SLOT_ARTIFACT_1", "artifactMustBeVisible": true }
    },
    {
      "sceneNumber": 4,
      "beatType": "CLIMAX",
      "sceneTitle": "Der vergiftete Apfel",
      "setting": "dwarf cottage",
      "mood": "TENSE",
      "sceneDescription": "Die verkleidete Koenigin bietet Schneewittchen einen vergifteten Apfel an.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1", "SLOT_ANTAGONIST_1"],
      "artifactPolicy": { "requiresArtifact": true, "artifactSlotKey": "SLOT_ARTIFACT_1", "artifactMustBeVisible": true }
    },
    {
      "sceneNumber": 5,
      "beatType": "RESOLUTION",
      "sceneTitle": "Das Erwachen",
      "setting": "forest clearing",
      "mood": "TRIUMPH",
      "sceneDescription": "Schneewittchen erwacht und alle feiern das glueckliche Ende.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1", "SLOT_HELPER_1", "SLOT_GUARDIAN_1"]
    }
  ]
}
$$::jsonb)
ON CONFLICT (tale_id) DO UPDATE SET tale_dna = EXCLUDED.tale_dna;

-- Haensel und Gretel - grimm-015
INSERT INTO tale_dna (tale_id, tale_dna)
VALUES
('grimm-015', $$
{
  "tale": {
    "taleId": "grimm-015",
    "title": "Haensel und Gretel",
    "language": "de",
    "age": { "min": 5, "max": 9 },
    "summary": "Zwei Geschwister verirren sich im Wald und finden ein Lebkuchenhaus, das einer boesen Hexe gehoert.",
    "moralLesson": "Zusammenhalt und Cleverness helfen, auch schwierige Situationen zu meistern.",
    "cultureRegion": "german",
    "source": "grimm",
    "themeTags": ["siblings", "courage", "cleverness", "teamwork"],
    "coreConflict": "Die Kinder muessen der Hexe entkommen und den Weg nach Hause finden.",
    "emotionalArc": ["fear", "wonder", "danger", "bravery", "relief"],
    "chapterCountHint": 5,
    "iconicBeats": [
      "Die Kinder werden im Wald ausgesetzt",
      "Entdeckung des Lebkuchenhauses",
      "Die Hexe lockt die Kinder hinein",
      "Gretel ueberlistet die Hexe",
      "Rueckkehr nach Hause"
    ],
    "fixedElements": ["breadcrumbs", "gingerbread house", "witch", "oven"],
    "flexibleElements": ["forest path", "artifact twist", "escape method"],
    "toneBounds": {
      "targetTone": "Adventurous, suspenseful but hopeful",
      "contentRules": [
        "Keep witch scary but not terrifying",
        "Focus on sibling teamwork",
        "Ensure happy reunion",
        "Use clear, simple sentences"
      ]
    }
  },
  "roles": [
    { "slotKey": "SLOT_PROTAGONIST_1", "roleType": "PROTAGONIST", "required": true, "roleCount": 1, "archetypePreference": ["brave", "clever"], "constraints": ["age=child"], "visualHints": ["simple clothes", "determined look"] },
    { "slotKey": "SLOT_PROTAGONIST_2", "roleType": "PROTAGONIST", "required": true, "roleCount": 1, "archetypePreference": ["clever", "resourceful"], "constraints": ["age=child"], "visualHints": ["simple dress", "braided hair"] },
    { "slotKey": "SLOT_ANTAGONIST_1", "roleType": "ANTAGONIST", "required": true, "roleCount": 1, "archetypePreference": ["witch", "trickster"], "constraints": ["age=elder"], "visualHints": ["witch hat", "crooked nose", "dark cloak"] },
    { "slotKey": "SLOT_GUARDIAN_1", "roleType": "GUARDIAN", "required": false, "roleCount": 1, "archetypePreference": ["parent"], "constraints": ["age=adult"], "visualHints": ["simple village clothes", "kind face"] }
  ],
  "scenes": [
    {
      "sceneNumber": 1,
      "beatType": "SETUP",
      "sceneTitle": "Im dunklen Wald",
      "setting": "deep forest",
      "mood": "MYSTERIOUS",
      "sceneDescription": "Haensel und Gretel verirren sich im tiefen Wald und suchen den Weg.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1", "SLOT_PROTAGONIST_2"]
    },
    {
      "sceneNumber": 2,
      "beatType": "INCITING",
      "sceneTitle": "Das Lebkuchenhaus",
      "setting": "gingerbread house clearing",
      "mood": "FUNNY",
      "sceneDescription": "Die Kinder entdecken ein wunderbares Haus aus Lebkuchen und Suessigkeiten.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1", "SLOT_PROTAGONIST_2"]
    },
    {
      "sceneNumber": 3,
      "beatType": "CONFLICT",
      "sceneTitle": "Die Hexe erscheint",
      "setting": "gingerbread house interior",
      "mood": "TENSE",
      "sceneDescription": "Die Hexe lockt die Kinder hinein und offenbart ihre boesen Absichten.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1", "SLOT_PROTAGONIST_2", "SLOT_ANTAGONIST_1"],
      "artifactPolicy": { "requiresArtifact": true, "artifactSlotKey": "SLOT_ARTIFACT_1", "artifactMustBeVisible": true }
    },
    {
      "sceneNumber": 4,
      "beatType": "CLIMAX",
      "sceneTitle": "Der clevere Plan",
      "setting": "witch kitchen",
      "mood": "TENSE",
      "sceneDescription": "Gretel fasst Mut und ueberlistet die Hexe mit einem cleveren Plan.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1", "SLOT_PROTAGONIST_2", "SLOT_ANTAGONIST_1"],
      "artifactPolicy": { "requiresArtifact": true, "artifactSlotKey": "SLOT_ARTIFACT_1", "artifactMustBeVisible": true }
    },
    {
      "sceneNumber": 5,
      "beatType": "RESOLUTION",
      "sceneTitle": "Heimkehr",
      "setting": "forest edge near home",
      "mood": "TRIUMPH",
      "sceneDescription": "Die Geschwister finden den Weg nach Hause und werden freudig empfangen.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1", "SLOT_PROTAGONIST_2", "SLOT_GUARDIAN_1"]
    }
  ]
}
$$::jsonb)
ON CONFLICT (tale_id) DO UPDATE SET tale_dna = EXCLUDED.tale_dna;

-- Dornroeschen (Sleeping Beauty) - grimm-050
INSERT INTO tale_dna (tale_id, tale_dna)
VALUES
('grimm-050', $$
{
  "tale": {
    "taleId": "grimm-050",
    "title": "Dornroeschen",
    "language": "de",
    "age": { "min": 5, "max": 10 },
    "summary": "Eine Prinzessin wird von einer boesen Fee verflucht und faellt in einen tiefen Schlaf, bis ein mutiger Prinz sie erweckt.",
    "moralLesson": "Liebe und Mut koennen jeden Fluch brechen.",
    "cultureRegion": "german",
    "source": "grimm",
    "themeTags": ["love", "courage", "magic", "patience"],
    "coreConflict": "Der Fluch der boesen Fee droht das Koenigreich in ewigen Schlaf zu versetzen.",
    "emotionalArc": ["celebration", "fear", "sleep", "hope", "awakening"],
    "chapterCountHint": 5,
    "iconicBeats": [
      "Die Taufe mit den guten Feen",
      "Der Fluch der dreizehnten Fee",
      "Das Maedchen findet die Spindel",
      "Der Prinz durchdringt die Dornenhecke",
      "Der erloesende Kuss"
    ],
    "fixedElements": ["spindle", "thorn hedge", "sleeping castle", "fairies"],
    "flexibleElements": ["castle setting", "artifact twist", "awakening method"],
    "toneBounds": {
      "targetTone": "Magical, romantic, gentle",
      "contentRules": [
        "Keep the curse mysterious but not scary",
        "Focus on hope and love",
        "Ensure a beautiful awakening",
        "Use poetic, simple language"
      ]
    }
  },
  "roles": [
    { "slotKey": "SLOT_PROTAGONIST_1", "roleType": "PROTAGONIST", "required": true, "roleCount": 1, "archetypePreference": ["innocent", "graceful"], "constraints": ["gender=female", "age=child"], "visualHints": ["princess dress", "long hair", "gentle expression"] },
    { "slotKey": "SLOT_ANTAGONIST_1", "roleType": "ANTAGONIST", "required": true, "roleCount": 1, "archetypePreference": ["dark fairy", "vengeful"], "constraints": ["gender=female"], "visualHints": ["dark robes", "staff", "sinister aura"] },
    { "slotKey": "SLOT_HELPER_1", "roleType": "HELPER", "required": true, "roleCount": 1, "archetypePreference": ["good fairy", "protective"], "constraints": ["gender=female"], "visualHints": ["fairy wings", "sparkling wand", "kind face"] },
    { "slotKey": "SLOT_GUARDIAN_1", "roleType": "GUARDIAN", "required": false, "roleCount": 1, "archetypePreference": ["prince", "brave"], "constraints": ["gender=male", "age=young_adult"], "visualHints": ["prince attire", "sword", "determined look"] }
  ],
  "scenes": [
    {
      "sceneNumber": 1,
      "beatType": "SETUP",
      "sceneTitle": "Die Taufe",
      "setting": "castle great hall",
      "mood": "COZY",
      "sceneDescription": "Das Koenigreich feiert die Geburt der Prinzessin mit den guten Feen.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1", "SLOT_HELPER_1"]
    },
    {
      "sceneNumber": 2,
      "beatType": "INCITING",
      "sceneTitle": "Der Fluch",
      "setting": "castle great hall",
      "mood": "TENSE",
      "sceneDescription": "Die boese Fee erscheint und spricht einen schrecklichen Fluch aus.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1", "SLOT_ANTAGONIST_1", "SLOT_HELPER_1"]
    },
    {
      "sceneNumber": 3,
      "beatType": "CONFLICT",
      "sceneTitle": "Die Spindel",
      "setting": "tower room",
      "mood": "MYSTERIOUS",
      "sceneDescription": "Die neugierige Prinzessin findet eine versteckte Spindel im Turm.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1"],
      "artifactPolicy": { "requiresArtifact": true, "artifactSlotKey": "SLOT_ARTIFACT_1", "artifactMustBeVisible": true }
    },
    {
      "sceneNumber": 4,
      "beatType": "CLIMAX",
      "sceneTitle": "Durch die Dornen",
      "setting": "thorn hedge and castle",
      "mood": "TENSE",
      "sceneDescription": "Der mutige Held kaempft sich durch die Dornenhecke zum schlafenden Schloss.",
      "mustIncludeSlots": ["SLOT_GUARDIAN_1"],
      "artifactPolicy": { "requiresArtifact": true, "artifactSlotKey": "SLOT_ARTIFACT_1", "artifactMustBeVisible": true }
    },
    {
      "sceneNumber": 5,
      "beatType": "RESOLUTION",
      "sceneTitle": "Das Erwachen",
      "setting": "princess chamber",
      "mood": "TRIUMPH",
      "sceneDescription": "Die Prinzessin erwacht und das ganze Koenigreich feiert.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1", "SLOT_GUARDIAN_1", "SLOT_HELPER_1"]
    }
  ]
}
$$::jsonb)
ON CONFLICT (tale_id) DO UPDATE SET tale_dna = EXCLUDED.tale_dna;

-- Rumpelstilzchen - grimm-055
INSERT INTO tale_dna (tale_id, tale_dna)
VALUES
('grimm-055', $$
{
  "tale": {
    "taleId": "grimm-055",
    "title": "Rumpelstilzchen",
    "language": "de",
    "age": { "min": 5, "max": 9 },
    "summary": "Ein kleines Maennchen hilft einer Muellerstochter, Stroh zu Gold zu spinnen, verlangt aber einen hohen Preis.",
    "moralLesson": "Vorsicht bei Versprechen und die Kraft der Wahrheit.",
    "cultureRegion": "german",
    "source": "grimm",
    "themeTags": ["cleverness", "truth", "promises", "riddles"],
    "coreConflict": "Die Koenigin muss den Namen des kleinen Maennchens herausfinden, um ihr Kind zu retten.",
    "emotionalArc": ["despair", "hope", "fear", "determination", "triumph"],
    "chapterCountHint": 5,
    "iconicBeats": [
      "Der Koenig verlangt Gold aus Stroh",
      "Das kleine Maennchen erscheint",
      "Der Handel wird geschlossen",
      "Die Suche nach dem Namen",
      "Rumpelstilzchen wird entlarvt"
    ],
    "fixedElements": ["spinning wheel", "straw", "gold", "the name riddle"],
    "flexibleElements": ["castle setting", "artifact twist", "discovery method"],
    "toneBounds": {
      "targetTone": "Mysterious, suspenseful, triumphant",
      "contentRules": [
        "Keep Rumpelstilzchen quirky not scary",
        "Focus on cleverness and riddles",
        "Ensure satisfying name reveal",
        "Use playful language"
      ]
    }
  },
  "roles": [
    { "slotKey": "SLOT_PROTAGONIST_1", "roleType": "PROTAGONIST", "required": true, "roleCount": 1, "archetypePreference": ["clever", "determined"], "constraints": ["gender=female", "age=young_adult"], "visualHints": ["simple dress", "worried expression", "miller daughter"] },
    { "slotKey": "SLOT_ANTAGONIST_1", "roleType": "ANTAGONIST", "required": true, "roleCount": 1, "archetypePreference": ["trickster", "imp"], "constraints": ["size=small"], "visualHints": ["small stature", "pointed hat", "mischievous grin", "odd clothes"] },
    { "slotKey": "SLOT_HELPER_1", "roleType": "HELPER", "required": false, "roleCount": 1, "archetypePreference": ["messenger", "scout"], "constraints": ["age=adult"], "visualHints": ["traveling clothes", "messenger bag"] },
    { "slotKey": "SLOT_GUARDIAN_1", "roleType": "GUARDIAN", "required": false, "roleCount": 1, "archetypePreference": ["king", "noble"], "constraints": ["gender=male", "age=adult"], "visualHints": ["crown", "royal robes"] }
  ],
  "scenes": [
    {
      "sceneNumber": 1,
      "beatType": "SETUP",
      "sceneTitle": "Die unmogliche Aufgabe",
      "setting": "castle tower room",
      "mood": "TENSE",
      "sceneDescription": "Die Muellerstochter soll Stroh zu Gold spinnen oder ihr droht Unheil.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1"]
    },
    {
      "sceneNumber": 2,
      "beatType": "INCITING",
      "sceneTitle": "Der geheimnisvolle Helfer",
      "setting": "castle tower room",
      "mood": "MYSTERIOUS",
      "sceneDescription": "Ein kleines Maennchen erscheint und bietet seine Hilfe an - gegen einen Preis.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1", "SLOT_ANTAGONIST_1"]
    },
    {
      "sceneNumber": 3,
      "beatType": "CONFLICT",
      "sceneTitle": "Das Versprechen",
      "setting": "castle throne room",
      "mood": "TENSE",
      "sceneDescription": "Die nun Koenigin muss ein schreckliches Versprechen einloesen.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1", "SLOT_ANTAGONIST_1"],
      "artifactPolicy": { "requiresArtifact": true, "artifactSlotKey": "SLOT_ARTIFACT_1", "artifactMustBeVisible": true }
    },
    {
      "sceneNumber": 4,
      "beatType": "CLIMAX",
      "sceneTitle": "Die Suche nach dem Namen",
      "setting": "forest and mountain",
      "mood": "MYSTERIOUS",
      "sceneDescription": "Ein Bote entdeckt das Geheimnis des kleinen Maennchens am Lagerfeuer.",
      "mustIncludeSlots": ["SLOT_HELPER_1", "SLOT_ANTAGONIST_1"],
      "artifactPolicy": { "requiresArtifact": true, "artifactSlotKey": "SLOT_ARTIFACT_1", "artifactMustBeVisible": true }
    },
    {
      "sceneNumber": 5,
      "beatType": "RESOLUTION",
      "sceneTitle": "Rumpelstilzchen!",
      "setting": "castle throne room",
      "mood": "TRIUMPH",
      "sceneDescription": "Die Koenigin nennt den Namen und ist frei vom Versprechen.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1", "SLOT_ANTAGONIST_1", "SLOT_GUARDIAN_1"]
    }
  ]
}
$$::jsonb)
ON CONFLICT (tale_id) DO UPDATE SET tale_dna = EXCLUDED.tale_dna;

-- Der Froschkoenig - grimm-001
INSERT INTO tale_dna (tale_id, tale_dna)
VALUES
('grimm-001', $$
{
  "tale": {
    "taleId": "grimm-001",
    "title": "Der Froschkoenig",
    "language": "de",
    "age": { "min": 5, "max": 9 },
    "summary": "Eine Prinzessin verliert ihre goldene Kugel im Brunnen und ein Frosch hilft ihr - wenn sie ein Versprechen haelt.",
    "moralLesson": "Halte deine Versprechen, auch wenn es schwerfaellt.",
    "cultureRegion": "german",
    "source": "grimm",
    "themeTags": ["promises", "transformation", "honesty", "friendship"],
    "coreConflict": "Die Prinzessin muss lernen, ihr Versprechen an den Frosch zu halten.",
    "emotionalArc": ["playful", "distress", "reluctance", "acceptance", "joy"],
    "chapterCountHint": 5,
    "iconicBeats": [
      "Die goldene Kugel faellt in den Brunnen",
      "Der Frosch macht ein Angebot",
      "Das widerwillige Versprechen",
      "Der Frosch kommt zum Schloss",
      "Die Verwandlung"
    ],
    "fixedElements": ["golden ball", "well", "frog", "castle dinner"],
    "flexibleElements": ["garden setting", "artifact twist", "transformation trigger"],
    "toneBounds": {
      "targetTone": "Playful, magical, heartwarming",
      "contentRules": [
        "Keep the frog charming not gross",
        "Focus on keeping promises",
        "Ensure magical transformation",
        "Use gentle humor"
      ]
    }
  },
  "roles": [
    { "slotKey": "SLOT_PROTAGONIST_1", "roleType": "PROTAGONIST", "required": true, "roleCount": 1, "archetypePreference": ["princess", "spoiled"], "constraints": ["gender=female", "age=child"], "visualHints": ["princess dress", "crown", "golden ball"] },
    { "slotKey": "SLOT_HELPER_1", "roleType": "HELPER", "required": true, "roleCount": 1, "archetypePreference": ["enchanted", "patient"], "constraints": ["species=animal"], "visualHints": ["frog", "golden crown on head", "friendly eyes"] },
    { "slotKey": "SLOT_GUARDIAN_1", "roleType": "GUARDIAN", "required": false, "roleCount": 1, "archetypePreference": ["king", "wise"], "constraints": ["gender=male", "age=adult"], "visualHints": ["king", "wise expression", "royal robes"] },
    { "slotKey": "SLOT_GUARDIAN_2", "roleType": "GUARDIAN", "required": false, "roleCount": 1, "archetypePreference": ["prince"], "constraints": ["gender=male", "age=young_adult"], "visualHints": ["prince", "handsome", "grateful expression"] }
  ],
  "scenes": [
    {
      "sceneNumber": 1,
      "beatType": "SETUP",
      "sceneTitle": "Am Brunnen",
      "setting": "castle garden well",
      "mood": "COZY",
      "sceneDescription": "Die Prinzessin spielt mit ihrer goldenen Kugel am kuehlen Brunnen.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1"]
    },
    {
      "sceneNumber": 2,
      "beatType": "INCITING",
      "sceneTitle": "Die Kugel ist weg!",
      "setting": "castle garden well",
      "mood": "TENSE",
      "sceneDescription": "Die Kugel faellt in den tiefen Brunnen und ein Frosch bietet Hilfe an.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1", "SLOT_HELPER_1"]
    },
    {
      "sceneNumber": 3,
      "beatType": "CONFLICT",
      "sceneTitle": "Das Versprechen",
      "setting": "castle dining hall",
      "mood": "FUNNY",
      "sceneDescription": "Der Frosch klopft ans Schlosstor und erinnert an das Versprechen.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1", "SLOT_HELPER_1", "SLOT_GUARDIAN_1"],
      "artifactPolicy": { "requiresArtifact": true, "artifactSlotKey": "SLOT_ARTIFACT_1", "artifactMustBeVisible": true }
    },
    {
      "sceneNumber": 4,
      "beatType": "CLIMAX",
      "sceneTitle": "Der ungebetene Gast",
      "setting": "princess bedroom",
      "mood": "TENSE",
      "sceneDescription": "Die Prinzessin muss entscheiden, ob sie ihr Versprechen wirklich haelt.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1", "SLOT_HELPER_1"],
      "artifactPolicy": { "requiresArtifact": true, "artifactSlotKey": "SLOT_ARTIFACT_1", "artifactMustBeVisible": true }
    },
    {
      "sceneNumber": 5,
      "beatType": "RESOLUTION",
      "sceneTitle": "Die Verwandlung",
      "setting": "princess bedroom",
      "mood": "TRIUMPH",
      "sceneDescription": "Der Frosch verwandelt sich und alle sind gluecklich.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1", "SLOT_GUARDIAN_2"]
    }
  ]
}
$$::jsonb)
ON CONFLICT (tale_id) DO UPDATE SET tale_dna = EXCLUDED.tale_dna;

-- Die Bremer Stadtmusikanten - grimm-027
INSERT INTO tale_dna (tale_id, tale_dna)
VALUES
('grimm-027', $$
{
  "tale": {
    "taleId": "grimm-027",
    "title": "Die Bremer Stadtmusikanten",
    "language": "de",
    "age": { "min": 4, "max": 8 },
    "summary": "Vier alte Tiere schliessen sich zusammen, um Musikanten zu werden, und verjagen dabei Raeuber aus einem Haus.",
    "moralLesson": "Gemeinsam ist man stark, und jeder hat etwas Wertvolles beizutragen.",
    "cultureRegion": "german",
    "source": "grimm",
    "themeTags": ["teamwork", "friendship", "courage", "music"],
    "coreConflict": "Die vier Tiere muessen zusammenarbeiten, um ein neues Zuhause zu finden.",
    "emotionalArc": ["sad", "hopeful", "brave", "funny", "triumphant"],
    "chapterCountHint": 5,
    "iconicBeats": [
      "Esel, Hund, Katze und Hahn treffen sich",
      "Sie beschliessen nach Bremen zu gehen",
      "Sie entdecken das Raeuberhaus",
      "Die Tiere bilden eine Pyramide",
      "Die Raeuber fliehen fuer immer"
    ],
    "fixedElements": ["donkey", "dog", "cat", "rooster", "robber house"],
    "flexibleElements": ["forest path", "artifact twist", "scare method"],
    "toneBounds": {
      "targetTone": "Funny, heartwarming, adventurous",
      "contentRules": [
        "Keep robbers comical not scary",
        "Focus on animal friendship",
        "Ensure funny pyramid scene",
        "Use animal sounds playfully"
      ]
    }
  },
  "roles": [
    { "slotKey": "SLOT_PROTAGONIST_1", "roleType": "PROTAGONIST", "required": true, "roleCount": 1, "archetypePreference": ["wise", "leader"], "constraints": ["species=animal"], "visualHints": ["donkey", "gray fur", "long ears", "determined"] },
    { "slotKey": "SLOT_HELPER_1", "roleType": "HELPER", "required": true, "roleCount": 1, "archetypePreference": ["loyal", "brave"], "constraints": ["species=animal"], "visualHints": ["dog", "friendly", "wagging tail"] },
    { "slotKey": "SLOT_HELPER_2", "roleType": "HELPER", "required": true, "roleCount": 1, "archetypePreference": ["clever", "agile"], "constraints": ["species=animal"], "visualHints": ["cat", "striped fur", "green eyes"] },
    { "slotKey": "SLOT_HELPER_3", "roleType": "HELPER", "required": true, "roleCount": 1, "archetypePreference": ["proud", "loud"], "constraints": ["species=animal"], "visualHints": ["rooster", "red comb", "colorful feathers"] },
    { "slotKey": "SLOT_ANTAGONIST_1", "roleType": "ANTAGONIST", "required": false, "roleCount": 1, "archetypePreference": ["robber", "cowardly"], "constraints": ["age=adult"], "visualHints": ["robber mask", "dark clothes", "scared expression"] }
  ],
  "scenes": [
    {
      "sceneNumber": 1,
      "beatType": "SETUP",
      "sceneTitle": "Die vier Freunde",
      "setting": "country road",
      "mood": "COZY",
      "sceneDescription": "Die vier Tiere treffen sich auf dem Weg und beschliessen zusammen zu reisen.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1", "SLOT_HELPER_1"]
    },
    {
      "sceneNumber": 2,
      "beatType": "INCITING",
      "sceneTitle": "Der Plan",
      "setting": "forest path",
      "mood": "COZY",
      "sceneDescription": "Die Gruppe waechst und sie planen, Musikanten in Bremen zu werden.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1", "SLOT_HELPER_1", "SLOT_HELPER_2", "SLOT_HELPER_3"]
    },
    {
      "sceneNumber": 3,
      "beatType": "CONFLICT",
      "sceneTitle": "Das Raeuberhaus",
      "setting": "dark forest clearing",
      "mood": "MYSTERIOUS",
      "sceneDescription": "Sie entdecken ein Haus mit Licht - aber darin sind Raeuber!",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1", "SLOT_HELPER_1", "SLOT_HELPER_2", "SLOT_HELPER_3"],
      "artifactPolicy": { "requiresArtifact": true, "artifactSlotKey": "SLOT_ARTIFACT_1", "artifactMustBeVisible": true }
    },
    {
      "sceneNumber": 4,
      "beatType": "CLIMAX",
      "sceneTitle": "Die Tierpyramide",
      "setting": "robber house window",
      "mood": "FUNNY",
      "sceneDescription": "Die Tiere klettern aufeinander und erschrecken die Raeuber mit lautem Laerm.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1", "SLOT_HELPER_1", "SLOT_HELPER_2", "SLOT_HELPER_3", "SLOT_ANTAGONIST_1"],
      "artifactPolicy": { "requiresArtifact": true, "artifactSlotKey": "SLOT_ARTIFACT_1", "artifactMustBeVisible": true }
    },
    {
      "sceneNumber": 5,
      "beatType": "RESOLUTION",
      "sceneTitle": "Ein neues Zuhause",
      "setting": "cozy house interior",
      "mood": "TRIUMPH",
      "sceneDescription": "Die Tiere haben das Haus fuer sich und leben gluecklich zusammen.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1", "SLOT_HELPER_1", "SLOT_HELPER_2", "SLOT_HELPER_3"]
    }
  ]
}
$$::jsonb)
ON CONFLICT (tale_id) DO UPDATE SET tale_dna = EXCLUDED.tale_dna;

-- Aschenputtel (Cinderella) - grimm-021
INSERT INTO tale_dna (tale_id, tale_dna)
VALUES
('grimm-021', $$
{
  "tale": {
    "taleId": "grimm-021",
    "title": "Aschenputtel",
    "language": "de",
    "age": { "min": 5, "max": 10 },
    "summary": "Ein freundliches Maedchen wird von ihrer Stiefmutter schlecht behandelt, aber mit magischer Hilfe geht sie zum Ball.",
    "moralLesson": "Guete und Bescheidenheit werden am Ende belohnt.",
    "cultureRegion": "german",
    "source": "grimm",
    "themeTags": ["kindness", "magic", "transformation", "love"],
    "coreConflict": "Aschenputtel muss trotz ihrer Stiefmutter ihren Traum vom Ball verwirklichen.",
    "emotionalArc": ["sad", "hope", "wonder", "joy", "love"],
    "chapterCountHint": 5,
    "iconicBeats": [
      "Aschenputtel wird von der Stiefmutter geplagt",
      "Die Einladung zum Ball kommt",
      "Magische Verwandlung am Haselnussbaum",
      "Der Tanz mit dem Prinzen",
      "Der Schuh passt"
    ],
    "fixedElements": ["glass slipper", "hazel tree", "ball gown", "midnight"],
    "flexibleElements": ["magic source", "artifact twist", "recognition scene"],
    "toneBounds": {
      "targetTone": "Magical, romantic, hopeful",
      "contentRules": [
        "Keep stepfamily mean but not cruel",
        "Focus on kindness winning",
        "Ensure beautiful transformation",
        "Use dreamy, gentle language"
      ]
    }
  },
  "roles": [
    { "slotKey": "SLOT_PROTAGONIST_1", "roleType": "PROTAGONIST", "required": true, "roleCount": 1, "archetypePreference": ["kind", "humble"], "constraints": ["gender=female", "age=child"], "visualHints": ["simple dress", "ash on face", "gentle smile"] },
    { "slotKey": "SLOT_ANTAGONIST_1", "roleType": "ANTAGONIST", "required": true, "roleCount": 1, "archetypePreference": ["cruel", "vain"], "constraints": ["gender=female", "age=adult"], "visualHints": ["fine dress", "stern expression", "stepmother"] },
    { "slotKey": "SLOT_HELPER_1", "roleType": "HELPER", "required": true, "roleCount": 1, "archetypePreference": ["magical", "kind"], "constraints": [], "visualHints": ["magical aura", "bird", "sparkles"] },
    { "slotKey": "SLOT_GUARDIAN_1", "roleType": "GUARDIAN", "required": false, "roleCount": 1, "archetypePreference": ["prince", "noble"], "constraints": ["gender=male", "age=young_adult"], "visualHints": ["prince", "royal clothes", "kind eyes"] }
  ],
  "scenes": [
    {
      "sceneNumber": 1,
      "beatType": "SETUP",
      "sceneTitle": "Im Aschenputtel-Dasein",
      "setting": "kitchen hearth",
      "mood": "COZY",
      "sceneDescription": "Aschenputtel arbeitet fleissig, waehrend die Stieffamilie sie schlecht behandelt.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1", "SLOT_ANTAGONIST_1"]
    },
    {
      "sceneNumber": 2,
      "beatType": "INCITING",
      "sceneTitle": "Die Einladung",
      "setting": "house entrance",
      "mood": "TENSE",
      "sceneDescription": "Eine Einladung zum koeniglichen Ball kommt, aber Aschenputtel darf nicht mit.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1", "SLOT_ANTAGONIST_1"]
    },
    {
      "sceneNumber": 3,
      "beatType": "CONFLICT",
      "sceneTitle": "Die Verwandlung",
      "setting": "hazel tree garden",
      "mood": "MYSTERIOUS",
      "sceneDescription": "Am Haselnussbaum geschieht Magie und Aschenputtel wird wunderschoen gekleidet.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1", "SLOT_HELPER_1"],
      "artifactPolicy": { "requiresArtifact": true, "artifactSlotKey": "SLOT_ARTIFACT_1", "artifactMustBeVisible": true }
    },
    {
      "sceneNumber": 4,
      "beatType": "CLIMAX",
      "sceneTitle": "Der Ball",
      "setting": "palace ballroom",
      "mood": "TRIUMPH",
      "sceneDescription": "Aschenputtel tanzt mit dem Prinzen, aber muss vor Mitternacht fliehen.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1", "SLOT_GUARDIAN_1"],
      "artifactPolicy": { "requiresArtifact": true, "artifactSlotKey": "SLOT_ARTIFACT_1", "artifactMustBeVisible": true }
    },
    {
      "sceneNumber": 5,
      "beatType": "RESOLUTION",
      "sceneTitle": "Der glaeserne Schuh",
      "setting": "house entrance",
      "mood": "TRIUMPH",
      "sceneDescription": "Der Prinz findet Aschenputtel - der Schuh passt perfekt.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1", "SLOT_GUARDIAN_1", "SLOT_ANTAGONIST_1"]
    }
  ]
}
$$::jsonb)
ON CONFLICT (tale_id) DO UPDATE SET tale_dna = EXCLUDED.tale_dna;

-- Rapunzel - grimm-012
INSERT INTO tale_dna (tale_id, tale_dna)
VALUES
('grimm-012', $$
{
  "tale": {
    "taleId": "grimm-012",
    "title": "Rapunzel",
    "language": "de",
    "age": { "min": 5, "max": 10 },
    "summary": "Ein Maedchen mit wunderschoenen langen Haaren wird von einer Hexe in einem Turm gefangen gehalten.",
    "moralLesson": "Wahre Liebe und Freiheit sind staerker als jeder Turm.",
    "cultureRegion": "german",
    "source": "grimm",
    "themeTags": ["freedom", "love", "courage", "hope"],
    "coreConflict": "Rapunzel muss aus ihrem Turmgefaengnis befreit werden.",
    "emotionalArc": ["longing", "hope", "danger", "separation", "reunion"],
    "chapterCountHint": 5,
    "iconicBeats": [
      "Rapunzel im hohen Turm",
      "Rapunzel, lass dein Haar herunter",
      "Der Prinz entdeckt das Geheimnis",
      "Die Hexe entdeckt die Besuche",
      "Wiedersehen und Freiheit"
    ],
    "fixedElements": ["tower", "long golden hair", "witch", "wilderness"],
    "flexibleElements": ["tower setting", "artifact twist", "escape method"],
    "toneBounds": {
      "targetTone": "Romantic, hopeful, adventurous",
      "contentRules": [
        "Keep witch controlling not terrifying",
        "Focus on hope and freedom",
        "Ensure romantic reunion",
        "Use poetic descriptions"
      ]
    }
  },
  "roles": [
    { "slotKey": "SLOT_PROTAGONIST_1", "roleType": "PROTAGONIST", "required": true, "roleCount": 1, "archetypePreference": ["dreamer", "kind"], "constraints": ["gender=female", "age=child"], "visualHints": ["very long golden hair", "simple dress", "gentle face"] },
    { "slotKey": "SLOT_ANTAGONIST_1", "roleType": "ANTAGONIST", "required": true, "roleCount": 1, "archetypePreference": ["witch", "possessive"], "constraints": ["gender=female", "age=elder"], "visualHints": ["dark cloak", "witch", "stern face"] },
    { "slotKey": "SLOT_GUARDIAN_1", "roleType": "GUARDIAN", "required": true, "roleCount": 1, "archetypePreference": ["prince", "adventurous"], "constraints": ["gender=male", "age=young_adult"], "visualHints": ["prince clothes", "determined look", "kind eyes"] },
    { "slotKey": "SLOT_HELPER_1", "roleType": "HELPER", "required": false, "roleCount": 1, "archetypePreference": ["bird", "messenger"], "constraints": ["species=animal"], "visualHints": ["small bird", "colorful feathers"] }
  ],
  "scenes": [
    {
      "sceneNumber": 1,
      "beatType": "SETUP",
      "sceneTitle": "Der hohe Turm",
      "setting": "isolated tower",
      "mood": "MYSTERIOUS",
      "sceneDescription": "Rapunzel lebt allein im hohen Turm und singt von der Freiheit.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1"]
    },
    {
      "sceneNumber": 2,
      "beatType": "INCITING",
      "sceneTitle": "Ein Fremder im Wald",
      "setting": "forest below tower",
      "mood": "MYSTERIOUS",
      "sceneDescription": "Ein Prinz hoert Rapunzels Gesang und entdeckt den Turm.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1", "SLOT_GUARDIAN_1"]
    },
    {
      "sceneNumber": 3,
      "beatType": "CONFLICT",
      "sceneTitle": "Das Geheimnis",
      "setting": "tower room",
      "mood": "COZY",
      "sceneDescription": "Der Prinz klettert am Haar hinauf und die beiden werden Freunde.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1", "SLOT_GUARDIAN_1"],
      "artifactPolicy": { "requiresArtifact": true, "artifactSlotKey": "SLOT_ARTIFACT_1", "artifactMustBeVisible": true }
    },
    {
      "sceneNumber": 4,
      "beatType": "CLIMAX",
      "sceneTitle": "Die Hexe erfaehrt alles",
      "setting": "tower room",
      "mood": "TENSE",
      "sceneDescription": "Die Hexe entdeckt die heimlichen Besuche und ist wuetend.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1", "SLOT_ANTAGONIST_1"],
      "artifactPolicy": { "requiresArtifact": true, "artifactSlotKey": "SLOT_ARTIFACT_1", "artifactMustBeVisible": true }
    },
    {
      "sceneNumber": 5,
      "beatType": "RESOLUTION",
      "sceneTitle": "Wiedersehen",
      "setting": "wilderness meadow",
      "mood": "TRIUMPH",
      "sceneDescription": "Nach langer Suche finden Rapunzel und der Prinz zueinander.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1", "SLOT_GUARDIAN_1"]
    }
  ]
}
$$::jsonb)
ON CONFLICT (tale_id) DO UPDATE SET tale_dna = EXCLUDED.tale_dna;

-- Der Wolf und die sieben Geisslein - grimm-005
INSERT INTO tale_dna (tale_id, tale_dna)
VALUES
('grimm-005', $$
{
  "tale": {
    "taleId": "grimm-005",
    "title": "Der Wolf und die sieben Geisslein",
    "language": "de",
    "age": { "min": 4, "max": 8 },
    "summary": "Sieben kleine Geisslein muessen sich vor dem boesen Wolf schuetzen, waehrend ihre Mutter weg ist.",
    "moralLesson": "Hoere auf deine Eltern und lass dich nicht von Fremden taeuschen.",
    "cultureRegion": "german",
    "source": "grimm",
    "themeTags": ["caution", "family", "cleverness", "protection"],
    "coreConflict": "Der Wolf versucht mit Tricks ins Haus der Geisslein zu kommen.",
    "emotionalArc": ["safe", "worried", "scared", "hiding", "relief"],
    "chapterCountHint": 5,
    "iconicBeats": [
      "Die Mutter warnt die Geisslein",
      "Der Wolf versucht hereinzukommen",
      "Der Wolf verkleidet sich",
      "Die Geisslein verstecken sich",
      "Die Mutter rettet alle"
    ],
    "fixedElements": ["goat house", "wolf disguise", "hiding places", "clock case"],
    "flexibleElements": ["house setting", "artifact twist", "rescue method"],
    "toneBounds": {
      "targetTone": "Suspenseful but safe, family-oriented",
      "contentRules": [
        "Keep wolf scary but beatable",
        "Focus on clever hiding",
        "Ensure mother saves everyone",
        "Use reassuring ending"
      ]
    }
  },
  "roles": [
    { "slotKey": "SLOT_PROTAGONIST_1", "roleType": "PROTAGONIST", "required": true, "roleCount": 1, "archetypePreference": ["youngest", "clever"], "constraints": ["species=animal", "age=child"], "visualHints": ["small white goat", "big eyes", "hiding"] },
    { "slotKey": "SLOT_ANTAGONIST_1", "roleType": "ANTAGONIST", "required": true, "roleCount": 1, "archetypePreference": ["wolf", "trickster"], "constraints": ["species=animal"], "visualHints": ["big wolf", "disguised paws", "sneaky look"] },
    { "slotKey": "SLOT_GUARDIAN_1", "roleType": "GUARDIAN", "required": true, "roleCount": 1, "archetypePreference": ["mother", "protective"], "constraints": ["species=animal", "age=adult"], "visualHints": ["mother goat", "white fur", "worried expression"] },
    { "slotKey": "SLOT_HELPER_1", "roleType": "HELPER", "required": false, "roleCount": 1, "archetypePreference": ["sibling"], "constraints": ["species=animal", "age=child"], "visualHints": ["small goat", "playful"] }
  ],
  "scenes": [
    {
      "sceneNumber": 1,
      "beatType": "SETUP",
      "sceneTitle": "Die Warnung",
      "setting": "cozy goat house",
      "mood": "COZY",
      "sceneDescription": "Die Geiss-Mutter warnt ihre Kinder vor dem boesen Wolf und geht dann einkaufen.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1", "SLOT_GUARDIAN_1"]
    },
    {
      "sceneNumber": 2,
      "beatType": "INCITING",
      "sceneTitle": "Der Wolf klopft an",
      "setting": "goat house door",
      "mood": "TENSE",
      "sceneDescription": "Der Wolf kommt und versucht mit seiner rauen Stimme hereinzukommen.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1", "SLOT_ANTAGONIST_1"]
    },
    {
      "sceneNumber": 3,
      "beatType": "CONFLICT",
      "sceneTitle": "Die Verkleidung",
      "setting": "goat house door",
      "mood": "TENSE",
      "sceneDescription": "Der Wolf verkleidet seine Stimme und Pfoten und taeuscht die Geisslein.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1", "SLOT_HELPER_1", "SLOT_ANTAGONIST_1"],
      "artifactPolicy": { "requiresArtifact": true, "artifactSlotKey": "SLOT_ARTIFACT_1", "artifactMustBeVisible": true }
    },
    {
      "sceneNumber": 4,
      "beatType": "CLIMAX",
      "sceneTitle": "Verstecken!",
      "setting": "goat house interior",
      "mood": "TENSE",
      "sceneDescription": "Die Geisslein verstecken sich ueberall, aber der Wolf findet fast alle.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1", "SLOT_ANTAGONIST_1"],
      "artifactPolicy": { "requiresArtifact": true, "artifactSlotKey": "SLOT_ARTIFACT_1", "artifactMustBeVisible": true }
    },
    {
      "sceneNumber": 5,
      "beatType": "RESOLUTION",
      "sceneTitle": "Die Rettung",
      "setting": "meadow by the well",
      "mood": "TRIUMPH",
      "sceneDescription": "Die Mutter kommt zurueck und rettet alle ihre Kinder.",
      "mustIncludeSlots": ["SLOT_PROTAGONIST_1", "SLOT_GUARDIAN_1", "SLOT_HELPER_1"]
    }
  ]
}
$$::jsonb)
ON CONFLICT (tale_id) DO UPDATE SET tale_dna = EXCLUDED.tale_dna;
