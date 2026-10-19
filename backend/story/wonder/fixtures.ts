import { buildBrief } from "../storybook/context";
import { wonderBudget } from "./library";

/** Fictional test avatars; never imports customer data or credentials. */
export function fixture(name = "magic", length: "short" | "medium" | "long" = "medium") {
  const young = name === "bedtime";
  const band = young ? "3-5" as const : "6-8" as const;
  const genre = name === "space" ? "scifi" : name === "realistic" ? "modern" : name === "fairytale" ? "fairy_tales" : "magic";
  return buildBrief({
    config: {
      avatarIds: ["hero:nora", "hero:ben"], genre, setting: name === "space" ? "space" : name === "fairytale" ? "fantasy" : "varied", ageGroup: band, length,
      complexity: "medium", language: "de", humorLevel: young ? 0 : 3, suspenseLevel: young ? 0 : 2,
      requireHappyEnd: true, avatarIsHero: true, useCharacterPool: true, aiProvider: "openrouter", openRouterModel: "openai/gpt-6.1-sol",
      // Reproduces the reported wizard combination using fictional avatars and guidance.
      ...(name === "fairytale" ? { humorLevel: 2, tone: "witty" as const, pacing: "fast" as const, pov: "personale" as const, allowRhymes: true, hasTwist: true, parentalGuidance: "Kindgerecht, keine grausamen Strafen und ein gutes Ende." } : {}),
      customPrompt: young ? "Eine geborgene Geschichte vor dem Einschlafen. Leise, kein Erschrecken und kein Zeitdruck." : name === "realistic" ? "Eine wirklich lustige Geschichte ohne Magie und ohne sprechende Gegenstände. Nora plant gern, Ben möchte mitentscheiden." : name === "dragon" ? "Fino ist ein kleiner Drache, der fliegen und kleine warme Flammen pusten kann. Diese Fähigkeiten bleiben ihm erhalten. Ein lustiges Abenteuer mit Freundschaft und eigenwilligen Nebenfiguren." : name === "space" ? "Ein lustiges Abenteuer auf einer Raumstation. Die Figuren dürfen Fehler machen und gemeinsam etwas herausfinden." : "Ein fantastisches Abenteuer, das mit einer komischen Alltagsstörung beginnt. Trockene Dialoge, echte Überraschungen, ein stiller Moment. Keine Schwerkraft, kein Amt, keine drei Prüfungen.",
    }, band, budget: wonderBudget(length, band), seed: `wonder-pilot-${name}-2026-10-19`,
    heroes: name === "dragon" ? [
      { id: "hero:nora", name: "Fino", age: 8, description: "Kleiner flugfähiger Drache mit grünen Schuppen. Hilfsbereit, ungeduldig; kann kleine warme Flammen pusten. Möchte zeigen, dass man sich auf ihn verlassen kann.", physicalTraits: { characterType: "dragon", wings: true }, personalityTraits: { courage: 30, creativity: 20 } },
      { id: "hero:ben", name: "Ben", age: 8, description: "Menschliches Kind. Bedächtig, beobachtet genau, trockener Humor. Fragt nach, wenn etwas nicht stimmt.", personalityTraits: { logic: 30, curiosity: 20 } },
    ] : [
      { id: "hero:nora", name: "Nora", age: young ? 5 : 8, description: "Menschliches Kind. Neugierig, praktisch und etwas vorschnell. Plant gern und muss andere manchmal erst zu Wort kommen lassen.", personalityTraits: { curiosity: 30, creativity: 20 } },
      { id: "hero:ben", name: "Ben", age: young ? 5 : 8, description: "Menschliches Kind. Bedächtig, beobachtet genau, trockener Humor. Möchte mitentscheiden und fragt nach, wenn etwas nicht stimmt.", personalityTraits: { logic: 30, courage: 10 } },
    ], candidates: [], artifacts: [],
  });
}
