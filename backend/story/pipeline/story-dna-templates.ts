import type { StoryDNA } from "./types";
import { STORY_CATEGORIES } from "./constants";

const BASE_RULES = [
  "Halte die Geschichte kindersicher",
  "Keine explizite Gewalt oder Verletzungen",
  "Vermeide modernen Slang ausser in Modern & Realitaet",
  "Keine neuen benannten Figuren ausserhalb des Casts",
  "Jedes Kapitel fokussiert einen Beat",
];

export const STORY_DNA_TEMPLATES: StoryDNA[] = [
  {
    templateId: "adventure_core_v1",
    category: "Abenteuer & Schätze",
    language: "de",
    age: { min: 6, max: 10 },
    themeTags: ["courage", "discovery", "teamwork"],
    coreConflict: "Ein klares Hindernis blockiert die Suche nach einem Schatz oder Ziel",
    beatPattern: [
      { beatType: "SETUP", sceneTitle: "Der Ruf", settingHint: "Dorfrand", mood: "WONDER", mustIncludeRoleTypes: ["AVATAR"] },
      { beatType: "INCITING", sceneTitle: "Die Karte", settingHint: "Wegbeginn", mood: "MYSTERIOUS", mustIncludeRoleTypes: ["AVATAR", "HELPER"] },
      { beatType: "CONFLICT", sceneTitle: "Die Prüfung", settingHint: "wildes Gelaende", mood: "TENSE", mustIncludeRoleTypes: ["AVATAR", "ANTAGONIST"], requiresArtifact: true },
      { beatType: "CLIMAX", sceneTitle: "Der Durchbruch", settingHint: "alte Ruinen", mood: "TRIUMPH", mustIncludeRoleTypes: ["AVATAR", "ANTAGONIST"], requiresArtifact: true },
      { beatType: "RESOLUTION", sceneTitle: "Die Heimkehr", settingHint: "Lagerfeuer", mood: "COZY", mustIncludeRoleTypes: ["AVATAR", "HELPER"] },
    ],
    roleSlots: [
      { slotKey: "SLOT_AVATAR_1", roleType: "AVATAR", required: true, roleCount: 1, archetypePreference: ["brave", "curious"], constraints: ["primary"], visualHints: ["child protagonist"] },
      { slotKey: "SLOT_AVATAR_2", roleType: "AVATAR", required: false, roleCount: 1, archetypePreference: ["loyal", "clever"], constraints: ["secondary"], visualHints: ["child companion"] },
      { slotKey: "SLOT_HELPER_1", roleType: "HELPER", required: true, roleCount: 1, archetypePreference: ["guide", "inventor", "scout"], visualHints: ["distinct outfit"] },
      { slotKey: "SLOT_ANTAGONIST_1", roleType: "ANTAGONIST", required: true, roleCount: 1, archetypePreference: ["rival", "guardian"], visualHints: ["intimidating but not scary"] },
      { slotKey: "SLOT_ARTIFACT_1", roleType: "ARTIFACT", required: true, roleCount: 1, visualHints: ["glowing artifact"] },
    ],
    artifactCategories: ["map", "tool", "magic", "jewelry"],
    artifactAbilities: ["navigation", "protection", "discovery", "light"],
    toneBounds: {
      targetTone: "Warm, abenteuerlich, hoffnungsvoll",
      contentRules: BASE_RULES,
    },
  },
  {
    templateId: "magic_worlds_v1",
    category: "Märchenwelten & Magie",
    language: "de",
    age: { min: 6, max: 10 },
    themeTags: ["wonder", "friendship", "magic"],
    coreConflict: "Die Magie ist aus dem Gleichgewicht geraten und muss wiederhergestellt werden",
    beatPattern: [
      { beatType: "SETUP", sceneTitle: "Der Zauberort", settingHint: "verzaubertes Dorf", mood: "WONDER", mustIncludeRoleTypes: ["AVATAR"] },
      { beatType: "INCITING", sceneTitle: "Das Zeichen", settingHint: "mystischer Hain", mood: "MYSTERIOUS", mustIncludeRoleTypes: ["AVATAR", "MENTOR"] },
      { beatType: "CONFLICT", sceneTitle: "Das Rätsel", settingHint: "schwebendes Schloss", mood: "TENSE", mustIncludeRoleTypes: ["AVATAR", "ANTAGONIST"], requiresArtifact: true },
      { beatType: "CLIMAX", sceneTitle: "Die Entfesselung", settingHint: "Kristallkammer", mood: "TRIUMPH", mustIncludeRoleTypes: ["AVATAR", "ANTAGONIST"], requiresArtifact: true },
      { beatType: "RESOLUTION", sceneTitle: "Das Fest", settingHint: "leuchtender Hof", mood: "COZY", mustIncludeRoleTypes: ["AVATAR", "MENTOR", "HELPER"] },
    ],
    roleSlots: [
      { slotKey: "SLOT_AVATAR_1", roleType: "AVATAR", required: true, roleCount: 1, archetypePreference: ["dreamer", "curious"], visualHints: ["storybook outfit"] },
      { slotKey: "SLOT_AVATAR_2", roleType: "AVATAR", required: false, roleCount: 1, archetypePreference: ["kind", "brave"], visualHints: ["storybook outfit"] },
      { slotKey: "SLOT_MENTOR_1", roleType: "MENTOR", required: true, roleCount: 1, archetypePreference: ["wise", "magical"], visualHints: ["glowing aura"] },
      { slotKey: "SLOT_HELPER_1", roleType: "HELPER", required: false, roleCount: 1, archetypePreference: ["playful creature"], visualHints: ["small magical companion"] },
      { slotKey: "SLOT_ANTAGONIST_1", roleType: "ANTAGONIST", required: true, roleCount: 1, archetypePreference: ["curse", "shadow"], visualHints: ["not too scary"] },
      { slotKey: "SLOT_ARTIFACT_1", roleType: "ARTIFACT", required: true, roleCount: 1, visualHints: ["ancient magic relic"] },
    ],
    artifactCategories: ["magic", "book", "potion", "jewelry"],
    artifactAbilities: ["magic", "wisdom", "light", "healing"],
    toneBounds: {
      targetTone: "Verspielt, leuchtend, troestlich",
      contentRules: BASE_RULES,
    },
  },
  {
    templateId: "animal_worlds_v1",
    category: "Tierwelten",
    language: "de",
    age: { min: 4, max: 9 },
    themeTags: ["friendship", "empathy", "nature"],
    coreConflict: "Die Tiergemeinschaft steht vor einer Herausforderung in ihrem Lebensraum",
    beatPattern: [
      { beatType: "SETUP", sceneTitle: "Das Revier", settingHint: "Waldlichtung", mood: "COZY", mustIncludeRoleTypes: ["AVATAR"] },
      { beatType: "INCITING", sceneTitle: "Das Warnzeichen", settingHint: "Flussufer", mood: "MYSTERIOUS", mustIncludeRoleTypes: ["AVATAR", "HELPER"] },
      { beatType: "CONFLICT", sceneTitle: "Die Gefahr", settingHint: "stuermische Wiese", mood: "TENSE", mustIncludeRoleTypes: ["AVATAR", "ANTAGONIST"], requiresArtifact: true },
      { beatType: "CLIMAX", sceneTitle: "Das gemeinsame Handeln", settingHint: "alter Baum", mood: "TRIUMPH", mustIncludeRoleTypes: ["AVATAR", "HELPER"], requiresArtifact: true },
      { beatType: "RESOLUTION", sceneTitle: "Die Ruhe", settingHint: "sonniges Nest", mood: "COZY", mustIncludeRoleTypes: ["AVATAR"] },
    ],
    roleSlots: [
      { slotKey: "SLOT_AVATAR_1", roleType: "AVATAR", required: true, roleCount: 1, archetypePreference: ["kind"], visualHints: ["child narrator"] },
      { slotKey: "SLOT_AVATAR_2", roleType: "AVATAR", required: false, roleCount: 1, archetypePreference: ["playful"], visualHints: ["child narrator"] },
      { slotKey: "SLOT_HELPER_1", roleType: "HELPER", required: true, roleCount: 1, archetypePreference: ["animal guide"], visualHints: ["friendly animal"] },
      { slotKey: "SLOT_ANTAGONIST_1", roleType: "ANTAGONIST", required: false, roleCount: 1, archetypePreference: ["storm", "predator"], visualHints: ["non-violent threat"] },
      { slotKey: "SLOT_ARTIFACT_1", roleType: "ARTIFACT", required: true, roleCount: 1, visualHints: ["nature artifact"] },
    ],
    artifactCategories: ["nature", "tool", "potion"],
    artifactAbilities: ["protection", "healing", "communication"],
    toneBounds: {
      targetTone: "Sanft, naturverbunden, herzerwaermend",
      contentRules: BASE_RULES,
    },
  },
  {
    templateId: "sci_fi_v1",
    category: "Sci-Fi & Zukunft",
    language: "de",
    age: { min: 7, max: 12 },
    themeTags: ["curiosity", "teamwork", "future"],
    coreConflict: "Eine futuristische Mission wird von einer unerwarteten Gefahr gestört",
    beatPattern: [
      { beatType: "SETUP", sceneTitle: "Die Basis", settingHint: "Orbitstation", mood: "WONDER", mustIncludeRoleTypes: ["AVATAR"] },
      { beatType: "INCITING", sceneTitle: "Der Auftrag", settingHint: "Kontrollraum", mood: "MYSTERIOUS", mustIncludeRoleTypes: ["AVATAR", "MENTOR"] },
      { beatType: "CONFLICT", sceneTitle: "Die Fehlfunktion", settingHint: "Maschinenraum", mood: "TENSE", mustIncludeRoleTypes: ["AVATAR", "ANTAGONIST"], requiresArtifact: true },
      { beatType: "CLIMAX", sceneTitle: "Der Sprung", settingHint: "Nebel-Feld", mood: "TRIUMPH", mustIncludeRoleTypes: ["AVATAR", "HELPER"], requiresArtifact: true },
      { beatType: "RESOLUTION", sceneTitle: "Die Rückkehr", settingHint: "Hologrammhalle", mood: "COZY", mustIncludeRoleTypes: ["AVATAR"] },
    ],
    roleSlots: [
      { slotKey: "SLOT_AVATAR_1", roleType: "AVATAR", required: true, roleCount: 1, archetypePreference: ["inventor", "explorer"], visualHints: ["futuristic outfit"] },
      { slotKey: "SLOT_AVATAR_2", roleType: "AVATAR", required: false, roleCount: 1, archetypePreference: ["pilot", "analyst"], visualHints: ["futuristic outfit"] },
      { slotKey: "SLOT_MENTOR_1", roleType: "MENTOR", required: false, roleCount: 1, archetypePreference: ["scientist"], visualHints: ["tech uniform"] },
      { slotKey: "SLOT_HELPER_1", roleType: "HELPER", required: true, roleCount: 1, archetypePreference: ["robot", "drone"], visualHints: ["mechanical companion"] },
      { slotKey: "SLOT_ANTAGONIST_1", roleType: "ANTAGONIST", required: true, roleCount: 1, archetypePreference: ["rogue AI", "alien"], visualHints: ["glowing tech"], constraints: ["no horror"] },
      { slotKey: "SLOT_ARTIFACT_1", roleType: "ARTIFACT", required: true, roleCount: 1, visualHints: ["tech artifact"] },
    ],
    artifactCategories: ["tech", "tool", "magic"],
    artifactAbilities: ["navigation", "communication", "time", "light"],
    toneBounds: {
      targetTone: "Hell, neugierig, hoffnungsvoll",
      contentRules: BASE_RULES,
    },
  },
  {
    templateId: "modern_v1",
    category: "Modern & Realität",
    language: "de",
    age: { min: 6, max: 12 },
    themeTags: ["friendship", "confidence", "community"],
    coreConflict: "Eine moderne Alltagsherausforderung braucht Teamarbeit, um geloest zu werden",
    beatPattern: [
      { beatType: "SETUP", sceneTitle: "Der Alltag", settingHint: "Schulhof", mood: "COZY", mustIncludeRoleTypes: ["AVATAR"] },
      { beatType: "INCITING", sceneTitle: "Das Problem", settingHint: "Stadtpark", mood: "MYSTERIOUS", mustIncludeRoleTypes: ["AVATAR", "HELPER"] },
      { beatType: "CONFLICT", sceneTitle: "Der Plan", settingHint: "Bibliothek", mood: "TENSE", mustIncludeRoleTypes: ["AVATAR", "ANTAGONIST"], requiresArtifact: true },
      { beatType: "CLIMAX", sceneTitle: "Die Aktion", settingHint: "Gemeindehaus", mood: "TRIUMPH", mustIncludeRoleTypes: ["AVATAR", "HELPER"], requiresArtifact: true },
      { beatType: "RESOLUTION", sceneTitle: "Die Erkenntnis", settingHint: "Zuhause", mood: "COZY", mustIncludeRoleTypes: ["AVATAR"] },
    ],
    roleSlots: [
      { slotKey: "SLOT_AVATAR_1", roleType: "AVATAR", required: true, roleCount: 1, archetypePreference: ["friendly"], visualHints: ["modern casual"] },
      { slotKey: "SLOT_AVATAR_2", roleType: "AVATAR", required: false, roleCount: 1, archetypePreference: ["curious"], visualHints: ["modern casual"] },
      { slotKey: "SLOT_HELPER_1", roleType: "HELPER", required: true, roleCount: 1, archetypePreference: ["classmate", "neighbor"], visualHints: ["modern clothing"] },
      { slotKey: "SLOT_ANTAGONIST_1", roleType: "ANTAGONIST", required: false, roleCount: 1, archetypePreference: ["misunderstanding", "rival"], visualHints: ["non-violent"] },
      { slotKey: "SLOT_ARTIFACT_1", roleType: "ARTIFACT", required: true, roleCount: 1, visualHints: ["important object"] },
    ],
    artifactCategories: ["tool", "book", "jewelry"],
    artifactAbilities: ["communication", "wisdom", "courage"],
    toneBounds: {
      targetTone: "Modern, aufbauend, geerdet",
      contentRules: BASE_RULES,
    },
  },
];

export function getTemplateByCategory(category: string): StoryDNA | undefined {
  return STORY_DNA_TEMPLATES.find((template) => template.category === category);
}

export function isCategorySupported(category: string): boolean {
  return STORY_CATEGORIES.includes(category as any);
}
