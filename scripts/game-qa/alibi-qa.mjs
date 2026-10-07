/**
 * Automatische Prüfung des Mitternachts-Alibi (ref2game-Prinzip: „der Nutzer findet nie zuerst einen Fehler,
 * den eine Prüfung hätte finden können“). Braucht den Vite-Dev-Server mit der Werkstatt-Seite:
 *
 *   cd frontend && bunx vite --port 5199 --strictPort         (in einem zweiten Terminal)
 *   node scripts/game-qa/alibi-qa.mjs [--base http://127.0.0.1:5199] [--only round,reveal] [--no-shots]
 *
 * Für jede Spielphase (Werkstatt ?stop=…) mit 8 Spielern und langen Namen, auf Handy (390×844) und Desktop (1280×800):
 *  - keine Fehler in der Konsole, keine Seitenfehler
 *  - kein waagrechtes Scrollen der Seite
 *  - kein abgeschnittener Text in Knöpfen und Schildern (scrollWidth > clientWidth bei nowrap)
 *  - Bildschirmfoto nach scripts/game-qa/out/
 * Dazu: Fußgleiten der laufenden Figuren (Akt-Reiter wechseln) und ob der Kartenboden sich bewegt.
 * Playwright: aus PLAYWRIGHT_PATH, sonst aus dem ref2game-Skill, sonst das normale Paket.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "out");
const require = createRequire(import.meta.url);
function loadPlaywright() {
  const tries = [process.env.PLAYWRIGHT_PATH, path.join(os.homedir(), ".claude/skills/ref2game/scripts/node_modules/playwright"), "playwright"].filter(Boolean);
  for (const t of tries) {
    try {
      return require(t);
    } catch {
      /* nächster Versuch */
    }
  }
  throw new Error("Playwright nicht gefunden (PLAYWRIGHT_PATH setzen oder `bun add -d playwright`).");
}
const { chromium } = loadPlaywright();

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const BASE = opt("base", "http://127.0.0.1:5199");
const STOPS = (opt("only", "") || "cast,case,act0,whisper,claim,announce,act0done,act1,round,spur,duel,seal,vote,point,reveal,story,end").split(",");
const SHOTS = !args.includes("--no-shots");
const VIEWS = [
  { name: "handy", width: 390, height: 844, dpr: 2 },
  { name: "desktop", width: 1280, height: 800, dpr: 1 },
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const report = { at: new Date().toISOString(), base: BASE, pages: [], walk: null, ground: null, problems: [] };

async function check(view, stop) {
  const page = await browser.newPage({ viewport: { width: view.width, height: view.height }, deviceScaleFactor: view.dpr });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(`${BASE}/alibi-lab.html?stop=${stop}&n=8&level=detektiv&long=1`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2200);
  const res = await page.evaluate(() => {
    const doc = document.scrollingElement || document.documentElement;
    const hscroll = doc.scrollWidth > window.innerWidth + 1;
    const cut = [];
    document.querySelectorAll("button, .alibi-plaque, .alibi-stamp, [data-a]").forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return;
      const r = el.getBoundingClientRect();
      if (!r.width) return;
      // abgeschnittener Text: die Textzeilen selbst sind breiter als der Kasten (Glanz-Effekte zählen nicht)
      const range = document.createRange();
      range.selectNodeContents(el);
      const tr = range.getBoundingClientRect();
      if (tr.width > r.width + 2 && cs.overflow !== "visible") cut.push((el.getAttribute("data-a") || el.textContent || "").trim().slice(0, 40));
      // Element ragt aus dem Fenster (auf dem Spielbrett schneidet das Brett selbst sauber ab)
      if (!el.closest(".alibi-board") && (r.right > window.innerWidth + 2 || r.left < -2)) cut.push(`außerhalb: ${(el.getAttribute("data-a") || el.textContent || "").trim().slice(0, 30)}`);
    });
    return { hscroll, cut: [...new Set(cut)].slice(0, 12) };
  });
  if (SHOTS) await page.screenshot({ path: path.join(OUT, `${view.name}-${stop}.png`) });
  await page.close();
  const entry = { view: view.name, stop, errors: errors.filter((e) => !/Clerk|DevTools|favicon/i.test(e)), ...res };
  report.pages.push(entry);
  if (entry.errors.length) report.problems.push(`${view.name}/${stop}: Konsole: ${entry.errors[0].slice(0, 160)}`);
  if (entry.hscroll) report.problems.push(`${view.name}/${stop}: waagrechtes Scrollen`);
  entry.cut.forEach((c) => report.problems.push(`${view.name}/${stop}: abgeschnitten/außerhalb: ${c}`));
  process.stdout.write(`${view.name}/${stop} ${entry.errors.length || entry.hscroll || entry.cut.length ? "✗" : "✓"}  `);
}

for (const view of VIEWS) for (const stop of STOPS) await check(view, stop);
console.log("");

// Laufende Figuren: Füße dürfen in der Standphase nicht gleiten (animation.md §14)
{
  const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
  await page.goto(`${BASE}/alibi-lab.html?stop=round&n=8`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await page.evaluate(() => (window.__alibiTrace.length = 0));
  for (const tab of ["0", "2", "1"]) {
    const el = await page.$(`[data-a="tab"][data-v="${tab}"]`);
    if (el) await el.click();
    await page.waitForTimeout(2600);
  }
  const tr = await page.evaluate(() => window.__alibiTrace.slice());
  const byId = {};
  tr.forEach((f) => (byId[f.id] ||= []).push(f));
  let worst = 0, sum = 0, n = 0;
  Object.values(byId).forEach((fs) => {
    for (let i = 1; i < fs.length; i++) {
      const a = fs[i - 1], c = fs[i];
      // nur flüssiges Laufen in Seitenansicht; Umdrehen (Spiegeln) ist ein gewollter Bildwechsel
      if (c.move < 0.95 || c.side < 0.6 || c.t - a.t > 0.1 || c.face !== a.face) continue;
      for (let k = 0; k < 2; k++) {
        if (a.feet[k].down && c.feet[k].down) {
          const d = Math.abs(c.feet[k].x - a.feet[k].x);
          worst = Math.max(worst, d);
          sum += d;
          n++;
        }
      }
    }
  });
  report.walk = { frames: tr.length, stanceSamples: n, meanSlidePct: n ? +(sum / n).toFixed(4) : null, worstSlidePct: +worst.toFixed(4) };
  if (!n) report.problems.push("Laufen: keine Standphasen gemessen (laufen die Figuren?)");
  else if (sum / n > 0.08) report.problems.push(`Laufen: Füße gleiten (Mittel ${(sum / n).toFixed(3)} % der Kartenbreite)`);
  // Kartenboden lebt: zwei Aufnahmen des Bodens unterscheiden sich
  const board = await page.$(".alibi-board-ground");
  if (board) {
    const a = await board.screenshot();
    await page.waitForTimeout(700);
    const b = await board.screenshot();
    let diff = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i += 97) if (a[i] !== b[i]) diff++;
    report.ground = { changedSamples: diff };
    if (!diff) report.problems.push("Kartenboden: keine Bewegung zwischen zwei Aufnahmen");
  }
  await page.close();
}

await browser.close();
writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 1));
console.log(`Laufen: ${JSON.stringify(report.walk)}  Boden: ${JSON.stringify(report.ground)}`);
console.log(report.problems.length ? `\n${report.problems.length} Auffälligkeiten:\n- ${report.problems.join("\n- ")}` : "\nKeine Auffälligkeiten.");
process.exit(report.problems.length ? 1 : 0);
