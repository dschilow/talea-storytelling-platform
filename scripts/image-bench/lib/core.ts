/**
 * Image-Bench Kern: Runware-Client mit Festplatten-Cache, hartem Budget und Retry.
 * Der Schlüssel liegt nur im Speicher (bun --env-file=.env.local), er wird nie ausgegeben.
 */
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const ROOT = "Logs/image-bench";
export const RUNWARE_KEY = process.env.RUNWARE_API_KEY || process.env.RunwareApiKey || "";
export const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || process.env.OpenRouterAPIKey || "";

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export const sha = (value: string | Buffer, length = 16) => createHash("sha1").update(value).digest("hex").slice(0, length);

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

/** Ein hartes Budget: jeder bezahlte Aufruf wird verbucht, vor jedem Aufruf wird geprüft. */
export class Budget {
  spent = 0;
  judge = 0;
  calls = 0;
  cacheHits = 0;
  constructor(public cap: number) {}
  get left(): number {
    return this.cap - this.spent - this.judge;
  }
  get exhausted(): boolean {
    return this.left <= 0;
  }
}

export interface Generated {
  file?: string;
  cost: number;
  ms: number;
  seed?: number;
  cached: boolean;
  error?: string;
  nsfw?: boolean;
}

/** Cache-Schlüssel: Anfrage ohne taskUUID, Data-URIs durch ihren Hash ersetzt. */
function requestKey(body: Record<string, unknown>): string {
  const { taskUUID: _drop, ...rest } = body;
  return sha(JSON.stringify(rest, (_key, value) => (typeof value === "string" && value.startsWith("data:") ? `data:${sha(value)}` : value)));
}

async function post(body: Record<string, unknown>, timeoutMs = 180_000): Promise<any> {
  for (let attempt = 1; ; attempt++) {
    let response: Response;
    try {
      response = await fetch("https://api.runware.ai/v1", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${RUNWARE_KEY}` },
        body: JSON.stringify([{ taskUUID: crypto.randomUUID(), ...body }]),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      // Netzfehler (Verbindung, Timeout): wie ein 5xx behandeln
      if (attempt >= 4) throw error;
      await sleep(3000 * attempt);
      continue;
    }
    const json: any = await response.json().catch(() => ({}));
    const retryable = response.status === 429 || response.status >= 500;
    if (retryable && attempt < 4) {
      await sleep(3000 * attempt);
      continue;
    }
    if (!response.ok || json.errors?.length) {
      const first = json.errors?.[0];
      throw new Error(`Runware ${response.status}: ${first ? `${first.code || ""} ${first.message || JSON.stringify(first)}` : JSON.stringify(json).slice(0, 300)}`);
    }
    return json.data?.[0];
  }
}

/**
 * Bild erzeugen und nach `outFile` legen. Gleiche Anfrage = Cache-Treffer (kostenlos).
 * Fehler werden zurückgegeben statt geworfen, damit ein Lauf weiterläuft.
 */
const inflight = new Map<string, Promise<Generated>>();

export async function generate(body: Record<string, unknown>, outFile: string, budget: Budget): Promise<Generated> {
  // Identische Anfragen (z. B. bei Ein-Figuren-Szenen alle Referenz-Strategien) laufen nur einmal, auch gleichzeitig.
  const key = requestKey(body);
  const pending = inflight.get(key);
  if (pending) {
    const first = await pending;
    if (first.file) {
      await ensureDir(dirname(outFile));
      await copyFile(first.file, outFile);
      return { ...first, file: outFile, cached: true };
    }
    return first;
  }
  const run = generateOnce(body, outFile, budget, key);
  inflight.set(key, run);
  return run;
}

async function generateOnce(body: Record<string, unknown>, outFile: string, budget: Budget, key: string): Promise<Generated> {
  const cacheImage = join(ROOT, "cache", `${key}.jpg`);
  const cacheMeta = join(ROOT, "cache", `${key}.json`);
  await ensureDir(dirname(outFile));
  try {
    const meta = JSON.parse(await readFile(cacheMeta, "utf8"));
    await copyFile(cacheImage, outFile);
    budget.cacheHits++;
    return { file: outFile, cost: meta.cost, ms: meta.ms, seed: meta.seed, cached: true };
  } catch {
    // kein Treffer
  }
  if (budget.exhausted) return { cost: 0, ms: 0, cached: false, error: "budget exhausted" };
  const started = Date.now();
  try {
    const data = await post({ taskType: "imageInference", numberResults: 1, outputType: ["URL"], outputFormat: "JPEG", includeCost: true, ...body });
    const cost = Number(data?.cost) || 0;
    budget.spent += cost;
    budget.calls++;
    if (data?.NSFWContent === true) return { cost, ms: Date.now() - started, cached: false, nsfw: true, error: "nsfw flag" };
    if (!data?.imageURL) return { cost, ms: Date.now() - started, cached: false, error: "no imageURL in response" };
    const buffer = Buffer.from(await (await fetch(data.imageURL, { signal: AbortSignal.timeout(60_000) })).arrayBuffer());
    await ensureDir(join(ROOT, "cache"));
    if (buffer.length < 1000) throw new Error(`downloaded image is empty (${buffer.length} bytes)`);
    await writeFile(`${cacheImage}.tmp`, buffer);
    await rename(`${cacheImage}.tmp`, cacheImage);
    const ms = Date.now() - started;
    await writeFile(cacheMeta, JSON.stringify({ cost, ms, seed: data.seed, model: body.model }));
    await copyFile(cacheImage, outFile);
    return { file: outFile, cost, ms, seed: data.seed, cached: false };
  } catch (error) {
    return { cost: 0, ms: Date.now() - started, cached: false, error: String((error as Error).message || error).slice(0, 400) };
  }
}

/** Hintergrund entfernen (Runware birefnet), Ergebnis als PNG-Buffer. */
export async function removeBackground(imageDataUri: string, budget: Budget): Promise<Buffer> {
  const data = await post({ taskType: "imageBackgroundRemoval", model: "runware:112@5", inputImage: imageDataUri, outputType: ["URL"], outputFormat: "PNG", includeCost: true });
  budget.spent += Number(data?.cost) || 0;
  budget.calls++;
  if (!data?.imageURL) throw new Error("background removal returned no image");
  return Buffer.from(await (await fetch(data.imageURL)).arrayBuffer());
}

/** Einfache Parallelität: höchstens n Aufgaben gleichzeitig, Reihenfolge der Ergebnisse bleibt. */
export async function pool<T, R>(items: T[], n: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        out[index] = await fn(items[index], index);
      }
    }),
  );
  return out;
}

export function flag(name: string): boolean {
  return process.argv.includes(name);
}
export function option(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] && !process.argv[index + 1].startsWith("--") ? process.argv[index + 1] : fallback;
}
