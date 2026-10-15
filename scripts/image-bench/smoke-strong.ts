/** Einzelaufruf der starken Stufe mit genau den Parametern des Produktions-Providers. bun --env-file=.env.local run scripts/image-bench/smoke-strong.ts */
import { Budget, generate, ROOT } from "./lib/core";
import { loadRoster } from "./lib/roster";
import { buildRefs } from "./lib/refs";
import { byKey } from "./lib/models";

const budget = new Budget(0.1);
const roster = await loadRoster(budget);
const refs = await buildRefs("sprite", roster.filter((figure) => ["Adrian", "Drache Fauchi", "Wolke Wuschel"].some((name) => figure.name.startsWith(name.split(" ")[0]))), byKey("klein4base"), budget);
const result = await generate({
  model: "runware:400@5", positivePrompt: "Evening at a mossy cave entrance: a small green dragon puffs a flame, a small cloud with a rainbow scarf floats beside it, a blond boy crouches and holds out his hands. Soft watercolour picture-book illustration.",
  negativePrompt: "text, letters, extra arms, duplicate character", width: 1024, height: 1024, steps: 20, CFGScale: 4, seed: 4711, checkNSFW: true,
  inputs: { referenceImages: refs.images },
}, `${ROOT}/smoke-strong.jpg`, budget);
console.log(JSON.stringify({ file: result.file, cost: result.cost, ms: result.ms, error: result.error }));
