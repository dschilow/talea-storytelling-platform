/**
 * Bild-Judge: ein Vision-Modell (Standard gpt-6-luna, wie die Bild-QA im Produkt) vergleicht das Ergebnisbild
 * mit dem Porträt-Blatt der Figuren und beantwortet feste Fragen. „Bestanden“ wird aus den Zahlen abgeleitet,
 * nicht vom Modell entschieden. Kosten pro Bild ≈ 0,01–0,03 ¢.
 */
import sharp from "sharp";
import { OPENROUTER_KEY, type Budget } from "./core";
import type { Figure } from "./roster";

export interface FigureVerdict {
  name: string;
  /** wie oft die Figur im Bild vorkommt (soll 1 sein) */
  count: number;
  /** 3 = eindeutig dieselbe Figur wie auf dem Blatt, 0 = andere Figur oder fehlt */
  identity: number;
  /** Kleidung/Merkmale (Brille, Weste, Schal, Flügel …): 3 = gleich, 0 = anders */
  outfit: number;
  /** 2 = sauber, 1 = kleiner Fehler (Hand), 0 = schwer (zusätzliche Gliedmaßen, verschmolzen) */
  anatomy: number;
  note?: string;
}

export interface Verdict {
  figures: FigureVerdict[];
  unlisted: number;
  sheetLeak: boolean;
  text: boolean;
  /** 3 = sauber, 0 = starke Artefakte (verzogene Gesichter/Hände, Matsch) */
  artifacts: number;
  /** Schönheit als Bilderbuch-Illustration, 0–10 */
  beauty: number;
  /** Passt das Bild zur Szene (Handlung, Ort), 0–3 */
  sceneFit: number;
  /** Wie viel echte Umgebung: 0 = leerer/heller Wash, 1 = Andeutung, 2 = erkennbarer Ort, 3 = reiche Umgebung */
  scenery: number;
  /** 0 = Figuren stehen/posieren, 3 = die beschriebene Handlung ist klar zu sehen */
  action: number;
  /** Figuren schweben vor einem hellen Verlauf/Vignette ohne Ort */
  vignette: boolean;
  issues: string[];
  pass: boolean;
  /** Mittel aus identity (0–3), auf 0–1 normiert */
  identityScore: number;
}

const SYSTEM = `You are a strict art director checking one generated picture-book illustration against the character reference sheet.
The first image is the REFERENCE SHEET (portraits of the figures that must appear, left to right or in a grid, in the order given). The second image is the GENERATED PICTURE.
Answer only with one JSON object. Judge what is visible, not what the prompt intended.

For every listed figure:
- count: how many times that figure appears in the picture (0 if absent, 2 if drawn twice).
- identity: 3 = clearly the same individual as on the sheet (face/head, hair or fur colour and style, skin, species, proportions), 2 = same type with one noticeable difference, 1 = several differences, 0 = a different character or absent.
- outfit: 3 = same clothes, accessories (glasses, scarf, vest, hat, wings) and colours, 2 = one detail differs, 1 = several differ, 0 = entirely different.
- anatomy: 2 = clean, 1 = a small flaw (odd hand), 0 = severe (extra limbs, fused or merged bodies, features of another figure such as animal ears or a hat on the wrong person).
Also:
- unlisted: number of extra people or creatures in the FOREGROUND or MIDDLE GROUND that are not in the list and are about as prominent as the listed figures. Blurred or small background passers-by, crowds and market visitors do NOT count. A second copy of a listed figure is not "unlisted" — it is count 2 for that figure.
- sheetLeak: true if the picture contains portrait insets, coloured frames, panels, a collage strip or the reference sheet itself.
- text: true if readable letters, signs with words or a signature appear.
- artifacts: 3 = clean, 2 = minor, 1 = obvious (warped faces or hands, melted shapes), 0 = severe.
- beauty: 0-10 as a children's picture-book illustration (composition, colour, charm, finish). Be critical; 6 is decent, 8 would be a printed picture book.
- sceneFit: 3 = the described action, place and light are all there, 0 = unrelated.
- scenery: 0 = plain, pale or empty wash/background (figures could be cut out and nothing would be missing), 1 = a hint of environment (a few strokes, one object), 2 = the requested place is recognisable with several details, 3 = a full environment with foreground, middle ground and background that matches the requested place.
- action: 0 = the figures stand or pose facing the viewer, nothing happens, 1 = vague movement, 2 = the requested action is recognisable, 3 = the described moment is clearly and dynamically shown.
- vignette: true if the figures sit in a soft pale vignette, wash or blob instead of a real place (white or cream edges fading out).
- issues: up to 4 short phrases naming the worst concrete problems.`;

const SCHEMA_HINT = `Return JSON exactly like: {"figures":[{"name":"","count":1,"identity":3,"outfit":3,"anatomy":2,"note":""}],"unlisted":0,"sheetLeak":false,"text":false,"artifacts":3,"beauty":7,"sceneFit":3,"scenery":2,"action":2,"vignette":false,"issues":[]}`;

const num = (value: unknown, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

export function decide(figures: FigureVerdict[], rest: Pick<Verdict, "unlisted" | "sheetLeak" | "text" | "artifacts">): boolean {
  return (
    figures.every((figure) => figure.count === 1 && figure.identity >= 2 && figure.outfit >= 2 && figure.anatomy >= 1) &&
    rest.unlisted === 0 && !rest.sheetLeak && !rest.text && rest.artifacts >= 2
  );
}

async function downscale(buffer: Buffer, side: number): Promise<string> {
  const jpeg = await sharp(buffer).resize(side, side, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

export async function judge(args: { image: Buffer; sheet: Buffer; figures: Figure[]; scene: string; model: string; budget: Budget }): Promise<Verdict | { error: string }> {
  if (!OPENROUTER_KEY) return { error: "no OPENROUTER_API_KEY" };
  const list = args.figures.map((figure, index) => `${index + 1}. ${figure.name} — ${figure.tag}`).join("\n");
  const body = {
    model: args.model,
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          { type: "text", text: `Figures that must appear, in the order of the reference sheet:\n${list}\n\nScene that was requested: ${args.scene}\n\n${SCHEMA_HINT}` },
          { type: "image_url", image_url: { url: await downscale(args.sheet, 1536) } },
          { type: "image_url", image_url: { url: await downscale(args.image, 1024) } },
        ],
      },
    ],
    response_format: { type: "json_object" },
    ...(/luna|sol/.test(args.model) ? { reasoning: { effort: "low" } } : {}),
    usage: { include: true },
    max_tokens: 1800,
  };
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENROUTER_KEY}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(90_000),
      });
      const data: any = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(`OpenRouter ${response.status}: ${JSON.stringify(data).slice(0, 200)}`);
      args.budget.judge += Number(data?.usage?.cost) || 0;
      const raw = String(data?.choices?.[0]?.message?.content || "").trim();
      const parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
      const figures: FigureVerdict[] = args.figures.map((figure, index) => {
        const found = (parsed.figures || []).find((row: any) => String(row?.name || "").toLowerCase().startsWith(figure.name.toLowerCase().slice(0, 5))) || parsed.figures?.[index] || {};
        return {
          name: figure.name, count: num(found.count), identity: Math.min(3, num(found.identity)), outfit: Math.min(3, num(found.outfit)),
          anatomy: Math.min(2, num(found.anatomy)), note: found.note ? String(found.note).slice(0, 160) : undefined,
        };
      });
      const rest = { unlisted: num(parsed.unlisted), sheetLeak: Boolean(parsed.sheetLeak), text: Boolean(parsed.text), artifacts: Math.min(3, num(parsed.artifacts)) };
      return {
        figures, ...rest, beauty: num(parsed.beauty), sceneFit: num(parsed.sceneFit),
        scenery: Math.min(3, num(parsed.scenery)), action: Math.min(3, num(parsed.action)), vignette: Boolean(parsed.vignette),
        issues: Array.isArray(parsed.issues) ? parsed.issues.slice(0, 4).map((issue: unknown) => String(issue).slice(0, 140)) : [],
        pass: decide(figures, rest),
        identityScore: figures.length ? figures.reduce((sum, figure) => sum + figure.identity, 0) / (3 * figures.length) : 0,
      };
    } catch (error) {
      if (attempt === 2) return { error: String((error as Error).message || error).slice(0, 200) };
    }
  }
  return { error: "unreachable" };
}
