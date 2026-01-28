import type { StoryDNA } from "./types";
import { STORY_CATEGORIES } from "./constants";

const BASE_RULES = [
  "Keep the story safe for children",
  "No explicit violence or harm",
  "Avoid modern slang unless the category is Modern & Realität",
  "No new named characters beyond the cast",
  "Keep each chapter focused on a single beat",
];

export const STORY_DNA_TEMPLATES: StoryDNA[] = [
  {
    templateId: "adventure_core_v1",
    category: "Abenteuer & Schätze",
    language: "de",
    age: { min: 6, max: 10 },
    themeTags: ["courage", "discovery", "teamwork"],
    coreConflict: "A clear obstacle blocks the quest for a treasure or goal",
    beatPattern: [
      { beatType: "SETUP", sceneTitle: "Der Ruf", settingHint: "village edge", mood: "WONDER", mustIncludeRoleTypes: ["AVATAR"] },
      { beatType: "INCITING", sceneTitle: "Die Karte", settingHint: "trailhead", mood: "MYSTERIOUS", mustIncludeRoleTypes: ["AVATAR", "HELPER"] },
      { beatType: "CONFLICT", sceneTitle: "Die Prüfung", settingHint: "wild terrain", mood: "TENSE", mustIncludeRoleTypes: ["AVATAR", "ANTAGONIST"], requiresArtifact: true },
      { beatType: "CLIMAX", sceneTitle: "Der Durchbruch", settingHint: "ancient ruins", mood: "TRIUMPH", mustIncludeRoleTypes: ["AVATAR", "ANTAGONIST"], requiresArtifact: true },
      { beatType: "RESOLUTION", sceneTitle: "Die Heimkehr", settingHint: "campfire", mood: "COZY", mustIncludeRoleTypes: ["AVATAR", "HELPER"] },
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
      targetTone: "Warm, adventurous, hopeful",
      contentRules: BASE_RULES,
    },
  },
  {
    templateId: "magic_worlds_v1",
    category: "Märchenwelten & Magie",
    language: "de",
    age: { min: 6, max: 10 },
    themeTags: ["wonder", "friendship", "magic"],
    coreConflict: "Magic is out of balance and must be restored",
    beatPattern: [
      { beatType: "SETUP", sceneTitle: "Der Zauberort", settingHint: "enchanted village", mood: "WONDER", mustIncludeRoleTypes: ["AVATAR"] },
      { beatType: "INCITING", sceneTitle: "Das Zeichen", settingHint: "mystic grove", mood: "MYSTERIOUS", mustIncludeRoleTypes: ["AVATAR", "MENTOR"] },
      { beatType: "CONFLICT", sceneTitle: "Das Rätsel", settingHint: "floating castle", mood: "TENSE", mustIncludeRoleTypes: ["AVATAR", "ANTAGONIST"], requiresArtifact: true },
      { beatType: "CLIMAX", sceneTitle: "Die Entfesselung", settingHint: "crystal chamber", mood: "TRIUMPH", mustIncludeRoleTypes: ["AVATAR", "ANTAGONIST"], requiresArtifact: true },
      { beatType: "RESOLUTION", sceneTitle: "Das Fest", settingHint: "glowing courtyard", mood: "COZY", mustIncludeRoleTypes: ["AVATAR", "MENTOR", "HELPER"] },
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
      targetTone: "Whimsical, luminous, comforting",
      contentRules: BASE_RULES,
    },
  },
  {
    templateId: "animal_worlds_v1",
    category: "Tierwelten",
    language: "de",
    age: { min: 4, max: 9 },
    themeTags: ["friendship", "empathy", "nature"],
    coreConflict: "The animal community faces a challenge in their habitat",
    beatPattern: [
      { beatType: "SETUP", sceneTitle: "Das Revier", settingHint: "forest clearing", mood: "COZY", mustIncludeRoleTypes: ["AVATAR"] },
      { beatType: "INCITING", sceneTitle: "Das Warnzeichen", settingHint: "riverbank", mood: "MYSTERIOUS", mustIncludeRoleTypes: ["AVATAR", "HELPER"] },
      { beatType: "CONFLICT", sceneTitle: "Die Gefahr", settingHint: "stormy meadow", mood: "TENSE", mustIncludeRoleTypes: ["AVATAR", "ANTAGONIST"], requiresArtifact: true },
      { beatType: "CLIMAX", sceneTitle: "Das gemeinsame Handeln", settingHint: "old tree", mood: "TRIUMPH", mustIncludeRoleTypes: ["AVATAR", "HELPER"], requiresArtifact: true },
      { beatType: "RESOLUTION", sceneTitle: "Die Ruhe", settingHint: "sunlit nest", mood: "COZY", mustIncludeRoleTypes: ["AVATAR"] },
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
      targetTone: "Gentle, nature-focused, heartwarming",
      contentRules: BASE_RULES,
    },
  },
  {
    templateId: "sci_fi_v1",
    category: "Sci-Fi & Zukunft",
    language: "de",
    age: { min: 7, max: 12 },
    themeTags: ["curiosity", "teamwork", "future"],
    coreConflict: "A futuristic mission faces an unexpected hazard",
    beatPattern: [
      { beatType: "SETUP", sceneTitle: "Die Basis", settingHint: "orbital station", mood: "WONDER", mustIncludeRoleTypes: ["AVATAR"] },
      { beatType: "INCITING", sceneTitle: "Der Auftrag", settingHint: "control room", mood: "MYSTERIOUS", mustIncludeRoleTypes: ["AVATAR", "MENTOR"] },
      { beatType: "CONFLICT", sceneTitle: "Die Fehlfunktion", settingHint: "engine bay", mood: "TENSE", mustIncludeRoleTypes: ["AVATAR", "ANTAGONIST"], requiresArtifact: true },
      { beatType: "CLIMAX", sceneTitle: "Der Sprung", settingHint: "nebula field", mood: "TRIUMPH", mustIncludeRoleTypes: ["AVATAR", "HELPER"], requiresArtifact: true },
      { beatType: "RESOLUTION", sceneTitle: "Die Rückkehr", settingHint: "hologram hall", mood: "COZY", mustIncludeRoleTypes: ["AVATAR"] },
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
      targetTone: "Bright, curious, hopeful",
      contentRules: BASE_RULES,
    },
  },
  {
    templateId: "modern_v1",
    category: "Modern & Realität",
    language: "de",
    age: { min: 6, max: 12 },
    themeTags: ["friendship", "confidence", "community"],
    coreConflict: "A modern day challenge needs teamwork to solve",
    beatPattern: [
      { beatType: "SETUP", sceneTitle: "Der Alltag", settingHint: "school yard", mood: "COZY", mustIncludeRoleTypes: ["AVATAR"] },
      { beatType: "INCITING", sceneTitle: "Das Problem", settingHint: "city park", mood: "MYSTERIOUS", mustIncludeRoleTypes: ["AVATAR", "HELPER"] },
      { beatType: "CONFLICT", sceneTitle: "Der Plan", settingHint: "library", mood: "TENSE", mustIncludeRoleTypes: ["AVATAR", "ANTAGONIST"], requiresArtifact: true },
      { beatType: "CLIMAX", sceneTitle: "Die Aktion", settingHint: "community hall", mood: "TRIUMPH", mustIncludeRoleTypes: ["AVATAR", "HELPER"], requiresArtifact: true },
      { beatType: "RESOLUTION", sceneTitle: "Die Erkenntnis", settingHint: "home", mood: "COZY", mustIncludeRoleTypes: ["AVATAR"] },
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
      targetTone: "Modern, uplifting, grounded",
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
