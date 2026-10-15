/**
 * Katalog: welche Runware-Bildmodelle können Referenzbilder UND kosten ungefähr so viel wie FLUX.2 klein?
 *
 *   bun scripts/image-bench/catalog.mjs [--max-price 0.01]
 *
 * Quelle ist der öffentliche Modellindex (kein Schlüssel nötig). Pro Modell werden Schema, gemessene Preise
 * (`x-pricing`), Referenz-Limit (`inputs.referenceImages.maxItems`) und Default-Parameter gelesen.
 * Ergebnis: Logs/image-bench/catalog.json + eine Tabelle auf der Konsole.
 */
import { mkdirSync, writeFileSync } from "node:fs";

const maxPrice = Number(process.argv[process.argv.indexOf("--max-price") + 1]) || 0.01;
const BASE = "https://runware.ai/docs/models";

const index = await (await fetch(`${BASE}/index.json`)).json();
const candidates = index.filter(
  (m) =>
    m.status === "live" &&
    m.air &&
    m.capabilities.some((c) => /image-to-image|edit|text-to-image/.test(c)) &&
    !m.capabilities.some((c) => /video|audio|3d|remove-background|preprocess|mask|vectorize|caption|upscale|age-classification/.test(c)),
);

const flat = (o) => o?.properties || (o?.allOf || o?.oneOf || []).reduce((a, x) => ({ ...a, ...flat(x) }), {});

async function inspect(model) {
  const res = await fetch(model.schema, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) return null;
  const schema = await res.json();
  const props = flat(schema.components?.schemas?.RequestBody?.items);
  const pricing = schema.info?.["x-pricing"] || {};
  const prices = [...(pricing.measured || []), ...(pricing.examples || [])].map((p) => ({ cfg: p.configuration, price: p.price }));
  const refPrices = prices.filter((p) => /reference|image-to-image|edit/i.test(p.cfg || "")).map((p) => p.price);
  const t2iPrices = prices.filter((p) => /text-to-image|^\d+x\d+/i.test(p.cfg || "")).map((p) => p.price);
  const maxRefs = props.inputs?.properties?.referenceImages?.maxItems ?? null;
  return {
    id: model.id,
    air: model.air,
    name: model.name,
    capabilities: model.capabilities.filter((c) => c !== "checkpoint"),
    refs: props.inputs?.properties?.referenceImages ? { max: maxRefs } : null,
    seedImage: Boolean(props.seedImage),
    steps: props.steps ? { default: props.steps.default ?? null, min: props.steps.minimum ?? null, max: props.steps.maximum ?? null } : null,
    cfg: props.CFGScale ? { default: props.CFGScale.default ?? null, min: props.CFGScale.minimum ?? null, max: props.CFGScale.maximum ?? null } : null,
    negative: Boolean(props.negativePrompt),
    from: pricing.overview || null,
    priceMin: prices.length ? Math.min(...prices.map((p) => p.price)) : null,
    priceMax: prices.length ? Math.max(...prices.map((p) => p.price)) : null,
    refPriceMax: refPrices.length ? Math.max(...refPrices) : null,
    t2iPriceMax: t2iPrices.length ? Math.max(...t2iPrices) : null,
    prices,
  };
}

const rows = [];
let next = 0;
await Promise.all(
  Array.from({ length: 8 }, async () => {
    while (next < candidates.length) {
      const model = candidates[next++];
      try {
        const row = await inspect(model);
        if (row) rows.push(row);
      } catch (error) {
        console.error(`✗ ${model.id}: ${error.message}`);
      }
    }
  }),
);

rows.sort((a, b) => (a.priceMin ?? 9) - (b.priceMin ?? 9));
mkdirSync("Logs/image-bench", { recursive: true });
writeFileSync("Logs/image-bench/catalog.json", JSON.stringify(rows, null, 1));

const cheap = rows.filter((r) => r.refs && (r.priceMax ?? 9) <= maxPrice);
console.log(`${rows.length} Bildmodelle gelesen, ${rows.filter((r) => r.refs).length} mit inputs.referenceImages, ${cheap.length} davon ≤ $${maxPrice}\n`);
console.log("AIR".padEnd(40), "max-Refs", "Steps", "CFG ", "min…max $", "  Name");
for (const r of cheap) {
  console.log(
    r.air.padEnd(40),
    String(r.refs.max ?? "?").padStart(8),
    String(r.steps?.default ?? "-").padStart(5),
    String(r.cfg?.default ?? "-").padStart(4),
    `${(r.priceMin ?? 0).toFixed(5)}…${(r.priceMax ?? 0).toFixed(5)}`.padEnd(18),
    r.name,
  );
}
