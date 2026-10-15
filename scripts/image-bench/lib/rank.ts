/**
 * Ranking-Judge: Ein Einzel-Urteil („Bestanden“) unterscheidet bei leichten Szenen nichts (alle 8/10).
 * Hier bekommt der Judge mehrere anonymisierte Kandidaten derselben Szene und Seed nebeneinander und MUSS sie sortieren.
 * Mehrere Runden mit neu gemischten Gruppen (Plackett-Luce light): Ergebnis ist der mittlere normierte Rang,
 * 1,0 = immer der Beste, 0,0 = immer der Schlechteste.
 */
import sharp from "sharp";
import { OPENROUTER_KEY, pool, type Budget } from "./core";
import type { Figure } from "./roster";

const LETTERS = "ABCDEFGHIJKLMNOP";

export interface Candidate {
  key: string;
  file: string;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Deterministischer Zufall, damit ein erneuter Lauf dieselben Gruppen bildet. */
function mulberry(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function grid(files: string[]): Promise<Buffer> {
  const cell = 480;
  const columns = files.length <= 4 ? 2 : files.length <= 9 ? 3 : 4;
  const rows = Math.ceil(files.length / columns);
  const tiles: sharp.OverlayOptions[] = [];
  for (const [index, file] of files.entries()) {
    const left = (index % columns) * cell;
    const top = Math.floor(index / columns) * cell;
    tiles.push({ input: await sharp(file).resize(cell, cell, { fit: "cover" }).jpeg({ quality: 85 }).toBuffer(), left, top });
    tiles.push({
      input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="56"><rect width="64" height="56" fill="#111"/><text x="32" y="42" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="bold" fill="#fff">${LETTERS[index]}</text></svg>`),
      left, top,
    });
  }
  return sharp({ create: { width: cell * columns, height: cell * rows, channels: 3, background: "#ffffff" } }).composite(tiles).jpeg({ quality: 85 }).toBuffer();
}

const SYSTEM = `You are a strict art director choosing between candidate picture-book illustrations of the SAME scene.
The first image is the reference sheet of the figures (their portraits). The second image shows the lettered candidates.
Rank ALL candidates from best to worst. Criteria in this order of weight:
1. Every listed figure is present exactly once and is recognisably the same individual as on the sheet (face, hair or fur, colours, species), with the right outfit and accessories (glasses, scarf, vest, hat, wings). Figures that swap traits, are missing, duplicated or merged rank low.
2. Clean drawing: no extra limbs or fingers, melted faces, text or signatures, portrait frames or the reference sheet drawn into the picture.
3. Charm and craft as a children's picture-book illustration: composition, colour, expression, clear action.
Answer only with JSON: {"ranking":["C","A",...], "worst":"X", "why":"one short sentence"} — the ranking must contain every letter exactly once.`;

async function askRanking(args: { sheet: Buffer; figures: Figure[]; scene: string; picture: Buffer; letters: string[]; model: string; budget: Budget }): Promise<string[] | undefined> {
  const list = args.figures.map((figure, index) => `${index + 1}. ${figure.name} — ${figure.tag}`).join("\n");
  const jpeg = (buffer: Buffer) => `data:image/jpeg;base64,${buffer.toString("base64")}`;
  const body = {
    model: args.model,
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          { type: "text", text: `Figures in the order of the reference sheet:\n${list}\n\nRequested scene: ${args.scene}\n\nCandidates: ${args.letters.join(", ")}.` },
          { type: "image_url", image_url: { url: jpeg(args.sheet) } },
          { type: "image_url", image_url: { url: jpeg(args.picture) } },
        ],
      },
    ],
    response_format: { type: "json_object" },
    ...(/luna|sol/.test(args.model) ? { reasoning: { effort: "low" } } : {}),
    usage: { include: true },
    max_tokens: 1500,
  };
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENROUTER_KEY}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });
      const data: any = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(`OpenRouter ${response.status}`);
      args.budget.judge += Number(data?.usage?.cost) || 0;
      const raw = String(data?.choices?.[0]?.message?.content || "");
      const parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
      const ranking: string[] = (parsed.ranking || []).map((letter: unknown) => String(letter).trim().toUpperCase());
      if (ranking.length === args.letters.length && args.letters.every((letter) => ranking.includes(letter))) return ranking;
    } catch {
      // zweiter Versuch
    }
  }
  return undefined;
}

/** Gibt je Kandidat-Schlüssel den mittleren normierten Rang (1 = Bester) und die Zahl der Vergleiche zurück. */
export async function rankCandidates(args: {
  groups: Array<{ id: string; sheet: Buffer; figures: Figure[]; scene: string; candidates: Candidate[] }>;
  model: string;
  budget: Budget;
  rounds?: number;
  groupSize?: number;
}): Promise<Map<string, { score: number; n: number }>> {
  const totals = new Map<string, { sum: number; n: number }>();
  const rounds = args.rounds ?? 2;
  const groupSize = args.groupSize ?? 8;
  const tasks: Array<{ group: (typeof args.groups)[number]; slice: Candidate[] }> = [];
  for (const group of args.groups) {
    for (let round = 0; round < rounds; round++) {
      const random = mulberry(round * 7919 + group.id.length * 31 + [...group.id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0));
      const shuffled = shuffle(group.candidates, random);
      const parts = Math.max(1, Math.ceil(shuffled.length / groupSize));
      const size = Math.ceil(shuffled.length / parts);
      for (let part = 0; part < parts; part++) {
        const slice = shuffled.slice(part * size, (part + 1) * size);
        if (slice.length >= 3) tasks.push({ group, slice });
      }
    }
  }
  // Die Judge-Aufrufe sind unabhängig: 6 gleichzeitig statt nacheinander.
  await pool(tasks, 6, async ({ group, slice }) => {
    const letters = slice.map((_c, index) => LETTERS[index]);
    const ranking = await askRanking({ sheet: group.sheet, figures: group.figures, scene: group.scene, picture: await grid(slice.map((c) => c.file)), letters, model: args.model, budget: args.budget });
    if (!ranking) return;
    ranking.forEach((letter, position) => {
      const candidate = slice[LETTERS.indexOf(letter)];
      const entry = totals.get(candidate.key) || { sum: 0, n: 0 };
      entry.sum += 1 - position / (slice.length - 1);
      entry.n += 1;
      totals.set(candidate.key, entry);
    });
  });
  return new Map([...totals].map(([key, { sum, n }]) => [key, { score: sum / n, n }]));
}
