/**
 * Modell-/Prompt-Vergleich über ALLE Läufe, ohne doppelte Bilder (gleiche Variante+Szene+Seed zählt einmal)
 * und szenengewichtet (jede Szene zählt gleich), damit der Szenen-Mix das Ergebnis nicht verzerrt.
 *   bun scripts/image-bench/across-runs.mjs model|prompt|refs
 */
import { readdirSync, readFileSync } from "node:fs";
const axis = process.argv[2] || "model";
const seen = new Set();
const rows = [];
for (const run of readdirSync("Logs/image-bench/runs")) {
  let text; try { text = readFileSync(`Logs/image-bench/runs/${run}/results.jsonl`, "utf8"); } catch { continue; }
  for (const line of text.split("\n").filter(Boolean)) {
    const r = JSON.parse(line);
    const parts = r.variant.split("|");
    if (!r.file || !r.verdict || r.verdict.error) continue;
    if (parts.length !== 4 || r.style !== "watercolor" || r.run) continue; // keine Sonder-Einstellungen
    if (!/^s[1-7]/.test(r.scene) || /^s5[bcd]/.test(r.scene)) continue;
    if (axis === "model" && !(r.refs === "sprite" && ["current", "nolooks"].includes(r.prompt) && ["klein4", "klein9"].includes(r.model))) continue;
    if (axis === "prompt" && !(r.refs === "sprite" && ["klein4", "klein9"].includes(r.model))) continue;
    if (axis === "refs" && !(["klein4", "klein9"].includes(r.model) && r.prompt === "current")) continue;
    const key = `${r.variant}|${r.scene}|${r.seed}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(r);
  }
}
const keyOf = (r) => (axis === "model" ? r.model : axis === "prompt" ? r.prompt : r.refs);
const wilson = (k, n) => { const z = 1.96, p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [(c - m) / d, (c + m) / d]; };
const levels = [...new Set(rows.map(keyOf))].sort();
const scenes = [...new Set(rows.map((r) => r.scene))].sort();
console.log(`${rows.length} verschiedene Bilder aus allen Läufen (nur Aquarell, Standard-Einstellungen)`);
console.log(axis.padEnd(14), "n    roh     [95%-CI]      szenengewichtet   ¢/Bild", "   ", scenes.map((s) => s.slice(0, 6)).join(" "));
for (const level of levels) {
  const rs = rows.filter((r) => keyOf(r) === level);
  const pass = rs.filter((r) => r.verdict.pass).length;
  const [lo, hi] = wilson(pass, rs.length);
  const per = scenes.map((s) => { const x = rs.filter((r) => r.scene === s); return x.length ? x.filter((r) => r.verdict.pass).length / x.length : NaN; });
  const weighted = per.filter(Number.isFinite).reduce((a, b) => a + b, 0) / per.filter(Number.isFinite).length;
  const cost = rs.reduce((s, r) => s + r.cost, 0) / rs.length;
  console.log(level.padEnd(14), String(rs.length).padEnd(4), `${Math.round(100 * pass / rs.length)}%`.padEnd(6), `[${Math.round(100 * lo)}–${Math.round(100 * hi)}%]`.padEnd(12), `${Math.round(100 * weighted)}%`.padEnd(16), (cost * 100).toFixed(3).padEnd(8), per.map((p) => (Number.isFinite(p) ? Math.round(p * 100) + "%" : "-").padEnd(6)).join(" "));
}
