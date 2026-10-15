/**
 * Modellprofile: Parameter, Referenz-Limit und typischer Preis pro Referenz-Aufruf (USD).
 * Quelle: Runware-Modellindex (`catalog.mjs`), Stand 2026-10-15. Preise sind Richtwerte aus `x-pricing`;
 * gerechnet wird mit dem echten `cost` der Antwort.
 */
export interface ModelProfile {
  key: string;
  air: string;
  label: string;
  /** Wie viele Referenzbilder das Modell annimmt. */
  maxRefs: number;
  steps?: number;
  cfg?: number;
  negative: boolean;
  /** Kann Breite/Höhe gesetzt werden? Sonst folgt die Ausgabe dem Referenzbild (dann quadratisches Blatt). */
  dims: boolean;
  accel?: boolean;
  /** false = das Modell lehnt `seed` ab. */
  seed?: boolean;
  /** Richtwert pro Aufruf mit Referenz. */
  price: number;
  note?: string;
}

export const MODELS: ModelProfile[] = [
  // --- heutiger Standard und seine Verwandten ---
  { key: "klein9", air: "runware:400@2", label: "FLUX.2 klein 9B (heute)", maxRefs: 4, steps: 4, cfg: 4, negative: true, dims: true, accel: true, price: 0.0017 },
  { key: "klein4", air: "runware:400@4", label: "FLUX.2 klein 4B (Avatare heute)", maxRefs: 4, steps: 4, cfg: 4, negative: true, dims: true, accel: true, price: 0.0013 },
  { key: "klein9kv", air: "runware:400@6", label: "FLUX.2 klein 9B KV (Multi-Ref-Cache)", maxRefs: 4, steps: 4, cfg: 4, negative: true, dims: true, accel: true, price: 0.0025 },
  { key: "klein9base", air: "runware:400@3", label: "FLUX.2 klein 9B Base (28 Schritte, echtes CFG)", maxRefs: 4, steps: 20, cfg: 4, negative: true, dims: true, price: 0.009 },
  { key: "klein4base", air: "runware:400@5", label: "FLUX.2 klein 4B Base (28 Schritte, echtes CFG)", maxRefs: 4, steps: 20, cfg: 4, negative: true, dims: true, price: 0.0032 },
  // --- Bearbeitungs-/Referenzmodelle aus dem Preisfenster ---
  { key: "boogu", air: "boogu:image@0.1-edit-turbo", label: "Boogu Edit Turbo", maxRefs: 1, steps: 4, negative: false, dims: false, price: 0.0038, note: "1 Referenz, Ausgabe folgt dem Referenzbild" },
  { key: "kandinsky", air: "runware:kandinsky-5.0-image-lite@1", label: "Kandinsky 5.0 Image Lite", maxRefs: 1, steps: 20, cfg: 7, negative: true, dims: true, price: 0.0122, note: "1 Referenz" },
  { key: "qwenedit", air: "runware:108@20", label: "Qwen-Image-Edit", maxRefs: 1, steps: 8, cfg: 4, negative: true, dims: true, price: 0.0045, note: "1 Referenz" },
  { key: "qwenedit2511", air: "alibaba:qwen-image-edit@2511", label: "Qwen-Image-Edit-2511", maxRefs: 3, steps: 30, cfg: 4, negative: true, dims: true, price: 0.0098 },
  { key: "pedit", air: "prunaai:2@1", label: "P-Image-Edit", maxRefs: 4, negative: false, dims: true, price: 0.0088 },
  { key: "muse", air: "meta:muse@image", label: "Meta Muse Image", maxRefs: 10, negative: false, dims: false, seed: false, price: 0.01, note: "feste 2K-Ausgabe" },
  // --- Obergrenze, nur mit --allow-expensive ---
  { key: "flux2dev", air: "runware:400@1", label: "FLUX.2 dev", maxRefs: 4, steps: 20, cfg: 4, negative: true, dims: true, price: 0.03 },
];

export const byKey = (key: string): ModelProfile => {
  const found = MODELS.find((model) => model.key === key || model.air === key);
  if (!found) throw new Error(`unknown model "${key}" — known: ${MODELS.map((model) => model.key).join(", ")}`);
  return found;
};

export interface RequestInput {
  prompt: string;
  negative?: string;
  refs: string[];
  seed: number;
  size: number;
  steps?: number;
  cfg?: number;
  /** Runware `acceleration`: none | low | medium | high (produktiv: high). */
  accel?: string;
}

/** Baut genau die Felder, die das Modell versteht — fremde Felder lehnt Runware ab. */
export function buildRequest(model: ModelProfile, input: RequestInput): Record<string, unknown> {
  const steps = input.steps ?? model.steps;
  const cfg = input.cfg ?? model.cfg;
  return {
    model: model.air,
    positivePrompt: input.prompt,
    ...(model.seed === false ? {} : { seed: input.seed }),
    ...(model.dims ? { width: input.size, height: input.size } : {}),
    ...(steps ? { steps } : {}),
    ...(cfg ? { CFGScale: cfg } : {}),
    ...(model.negative && input.negative ? { negativePrompt: input.negative } : {}),
    ...(model.accel ? { acceleration: input.accel ?? "high" } : {}),
    ...(input.refs.length ? { inputs: { referenceImages: input.refs.slice(0, model.maxRefs) } } : {}),
  };
}
