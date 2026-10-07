/**
 * Runware-Helfer für die Spiel-Bilder (Mitternachts-Alibi).
 *
 * Schlüssel: process.env.RUNWARE_API_KEY, sonst RUNWARE_API_KEY aus der .env.local im Projektordner.
 * Der Schlüssel liegt nur im Speicher und wird weder ausgegeben noch in eine Datei geschrieben.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, "../..");
export const CACHE = path.join(HERE, ".cache");
const API = "https://api.runware.ai/v1";

let cachedKey = null;
export function getApiKey() {
  if (cachedKey) return cachedKey;
  let key = process.env.RUNWARE_API_KEY?.trim();
  if (!key) {
    const envLocal = path.join(REPO_ROOT, ".env.local");
    if (existsSync(envLocal)) {
      const m = readFileSync(envLocal, "utf8").match(/^RUNWARE_API_KEY=(.*)$/m);
      if (m) key = m[1].trim().replace(/^["']|["']$/g, "");
    }
  }
  if (!key) throw new Error("Kein RUNWARE_API_KEY gefunden (Umgebung oder .env.local).");
  cachedKey = key;
  return key;
}

/** Lokale Datei → data-URI (für Referenzbilder, Ausgangsbilder und Masken). */
export function dataUri(file) {
  const ext = path.extname(file).slice(1).toLowerCase();
  const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/png";
  return `data:${mime};base64,${readFileSync(file).toString("base64")}`;
}
const asImage = (x) => (typeof x === "string" && (x.startsWith("http") || x.startsWith("data:")) ? x : dataUri(x));

/** Eine Runware-Aufgabe; bei Überlast des Anbieters (5xx, 429) bis zu drei Versuche mit Pause. */
export async function task(body, opts = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await taskOnce(body, opts);
    } catch (e) {
      const msg = String(e?.message || e);
      if (attempt >= 3 || !/Runware (5\d\d|429)|providerError|aborted/i.test(msg)) throw e;
      await new Promise((r) => setTimeout(r, 4000 * attempt));
    }
  }
}

async function taskOnce(body, { timeoutMs = 240_000 } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getApiKey()}` },
      body: JSON.stringify([{ taskUUID: crypto.randomUUID(), ...body }]),
      signal: ctl.signal,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.errors?.length) {
      const e = json.errors?.[0];
      throw new Error(`Runware ${res.status}: ${e ? `${e.code || ""} ${e.message || JSON.stringify(e)}` : JSON.stringify(json).slice(0, 400)}`);
    }
    return json.data?.[0];
  } finally {
    clearTimeout(t);
  }
}

async function download(url, out) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download ${res.status}`);
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, Buffer.from(await res.arrayBuffer()));
}

function log(rec) {
  mkdirSync(CACHE, { recursive: true });
  appendFileSync(path.join(CACHE, "log.jsonl"), JSON.stringify({ at: new Date().toISOString(), ...rec }) + "\n");
}

/**
 * Bild erzeugen. `refs` = Referenzbilder (Pfade oder URLs), `seedImage` + `maskImage` = Inpainting.
 * Gibt { file, cost, seed } zurück.
 */
export async function infer({ name, out, model = "bfl:flux@3-image", prompt, width = 1024, height = 1024, refs = [], seed, steps, cfg, seedImage, maskImage, strength, negative, format = "PNG", extra = {} }) {
  const body = {
    taskType: "imageInference",
    model,
    positivePrompt: prompt,
    width,
    height,
    numberResults: 1,
    outputType: ["URL"],
    outputFormat: format,
    includeCost: true,
    ...(seed !== undefined ? { seed } : {}),
    ...(steps ? { steps } : {}),
    ...(cfg ? { CFGScale: cfg } : {}),
    ...(negative ? { negativePrompt: negative } : {}),
    ...(seedImage ? { seedImage: asImage(seedImage) } : {}),
    ...(maskImage ? { maskImage: asImage(maskImage) } : {}),
    ...(strength !== undefined ? { strength } : {}),
    ...(refs.length ? { inputs: { referenceImages: refs.map(asImage) } } : {}),
    ...extra,
  };
  const t0 = Date.now();
  const d = await task(body);
  if (!d?.imageURL) throw new Error(`Keine Bild-URL in der Antwort (${name})`);
  await download(d.imageURL, out);
  log({ kind: "infer", name, model, w: width, h: height, cost: d.cost ?? null, seed: d.seed ?? seed ?? null, ms: Date.now() - t0 });
  return { file: out, cost: d.cost ?? 0, seed: d.seed };
}

/** Hintergrund entfernen (freistellen). */
export async function removeBg({ name, input, out, model = "runware:112@5" }) {
  const t0 = Date.now();
  const d = await task({ taskType: "imageBackgroundRemoval", model, inputImage: asImage(input), outputType: ["URL"], outputFormat: "PNG", includeCost: true });
  if (!d?.imageURL) throw new Error(`Keine Bild-URL beim Freistellen (${name})`);
  await download(d.imageURL, out);
  log({ kind: "rembg", name, model, cost: d.cost ?? null, ms: Date.now() - t0 });
  return { file: out, cost: d.cost ?? 0 };
}

/** Einfache Parallelität: höchstens n Aufgaben gleichzeitig. */
export async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const k = i++;
      try {
        out[k] = await fn(items[k], k);
      } catch (e) {
        out[k] = { error: String(e?.message || e) };
        console.error(`  ✗ ${items[k].name || k}: ${out[k].error}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}
