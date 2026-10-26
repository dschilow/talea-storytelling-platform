import { readFile } from "node:fs/promises";
import { toCastCandidate } from "../../backend/story/storybook/cast-selection";

export const SEED = "talea-all-pipelines-2026-10-26-a";
// Captured from the first standard run. Its clock-derived novelty direction
// is fixed for resume and the developer comparison, without changing prompts.
export const NOVELTY = { seed: "zw914v", shelfPromise: "The story feels like a discoverable book on a library display, not a generic fantasy quest.", creativeLane: "social comedy: a rule at school, a club, a birthday, a queue, a contest, a secret job", emotionalEngine: "thinking a mistake ruined everything until the mistake becomes a tool", wonderMechanic: "a helper can only help badly until the child gives a precise instruction", keyMomentLens: "Wonder + Mystery: odd encounter -> pattern clue -> false explanation -> rule reveal -> earned solution", titleEnergy: "ordinary place + secret job", hardAvoidMotifs: ["Glöckchen", "Gloeckchen", "Geräusche-Fresser", "Geraeusche-Fresser", "lautlose Stadt", "müdes Kissen", "muedes Kissen", "gestohlene Geräusche", "gestohlene Geraeusche"], recentStories: [] };
export async function fixture(young = false) {
  const pool = JSON.parse(await readFile("exports/character-pool/2026-10-26/talea-characters-2026-10-26-optimiert.json", "utf8"));
  const names = young ? ["Morpheus", "Lumi Nachtlicht", "Bo Bücherfuchs"] : ["Kobold Kicher", "Pip", "Bäcker Braun"];
  const rows = names.map(name => { const row = pool.find((r: any) => r.name === name); if (!row) throw new Error(name); return row; });
  const heroes = [
    { id: "fixture-nora", name: "Nora", age: young ? 5 : 8, description: "Neugierig und praktisch; plant gern, handelt manchmal vorschnell und muss Ben zu Wort kommen lassen.", narrativeProfile: { speechStyle: "kurze konkrete Vorschläge" } },
    { id: "fixture-ben", name: "Ben", age: young ? 5 : 8, description: "Beobachtet genau, fragt knapp und hat trockenen Humor. Möchte selbst mitentscheiden.", narrativeProfile: { speechStyle: "knappe Fragen und trockene Einwürfe" } },
  ];
  const config: any = { avatarIds: heroes.map(h => h.id), genre: "magic", setting: "forest", ageGroup: young ? "3-5" : "6-8", length: "short", language: "de",
    humorLevel: young ? 1 : 2, suspenseLevel: young ? 0 : 1, emotionalFlavors: ["lachfreude", "warmherzigkeit"], requireHappyEnd: true, avatarIsHero: false,
    allowRhymes: false, aiProvider: "openrouter", aiModel: "openai/gpt-6.1-sol", openRouterModel: "openai/gpt-6.1-sol",
    customPrompt: young ? "Eine leise, geborgene Geschichte vor dem Einschlafen. Keine Gefahr und kein Zeitdruck. Ein einfaches kleines Wunder und etwas zum Schmunzeln."
      : "Ein lustiges magisches Abenteuer mit einer eigenwilligen Pool-Figur in der Hauptrolle und den beiden Kindern als wirksamen Begleitern. Ein verständliches Wunder, ein stiller Moment und ein überraschender Schlussgag. Kein Fest und keine Prophezeiung.",
  };
  return { config, heroes, rows, candidates: rows.map((r: any) => toCastCandidate(r)!) };
}
