/** Wie viel der Szene überlebt im Produktions-Prompt? bun run scripts/image-bench/clip-check.ts */
import { assembleImagePrompt, STORYBOOK_IMAGE_STYLE_SHORT, type VisualEntity } from "../../backend/story/storybook/illustration-stage";
import { SCENES } from "./lib/prompts";

const look = (name: string, role: "hero" | "cast", species: string, isHuman: boolean, appearance: string, tag: string): VisualEntity => ({ id: name, name, kind: "character", role, species, isHuman, appearance, tag, forbidden: [], referenceUrl: "x" });
const people: Record<string, VisualEntity> = {
  Alexander: look("Alexander", "hero", "human", true, "Brown tousled hair, light skin, green eyes, cream chunky ribbed sweater with a high collar, blue jeans, brown sneakers, child of about eight.", "brown-haired boy in a cream sweater"),
  Adrian: look("Adrian", "hero", "human", true, "Short blond hair, light skin, blue eyes, dark navy T-shirt with a small yellow crescent moon on the chest, grey-green trousers, child of about seven.", "blond boy in a navy T-shirt"),
  "Die Nebelfee": look("Die Nebelfee", "cast", "fairy", false, "Delicate half-transparent fairy of mist and moonlight, long silver hair, pale blue puff-sleeved dress, large clear iridescent wings, faint face.", "silver-haired fairy in a pale blue dress"),
  "Lehrerin Lämpel": look("Lehrerin Lämpel", "cast", "human", true, "Young teacher with a dark bun, round blue glasses, light blue blouse and dark trousers, a notebook full of stars in her hand.", "teacher with round glasses and a bun"),
};
console.log("Szene".padEnd(34), "Original  im Prompt  Prompt  | Ort/Licht (letzter Satz) überlebt?");
for (const scene of SCENES.filter((s) => /^l\d/.test(s.id))) {
  const stage = scene.cast.map((name) => people[name] || people[Object.keys(people).find((k) => k.startsWith(name.split(" ")[0]))!]);
  const prompt = assembleImagePrompt({ scene: scene.text, onStage: stage, spriteOrder: stage });
  const first = prompt.split("\n")[0];
  const lastSentence = scene.text.split(/(?<=[.!?])\s+/).pop()!;
  const placeWord = lastSentence.split(/[,; ]/).find((w) => w.length > 5)!;
  console.log(scene.id.padEnd(34), String(scene.text.length).padEnd(9), String(first.length).padEnd(11), String(prompt.length).padEnd(7), "|", first.includes(placeWord) ? "ja" : "NEIN", `("${placeWord}")`);
}
