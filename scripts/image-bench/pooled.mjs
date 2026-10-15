/**
 * Zieht Varianten zusammen: bun scripts/image-bench/pooled.mjs <lauf> [refs|model|prompt|style|figures]
 * Wilson-Intervall (95 %) für die Bestehensquote — einzelne Varianten haben oft nur 20 Bilder, da ist jeder Unterschied unter ~15 Punkten Rauschen.
 */
import { readFileSync } from "node:fs";
const run = process.argv[2];
const by = process.argv[3] || "refs";
const ranks = (() => { try { return JSON.parse(readFileSync(`Logs/image-bench/runs/${run}/ranks.json`, "utf8")); } catch { return {}; } })();
const rows = readFileSync(`Logs/image-bench/runs/${run}/results.jsonl`, "utf8").split("\n").filter(Boolean).map(JSON.parse).filter((r) => r.file && r.verdict && !r.verdict.error);
const keyOf = (r) => (by === "figures" ? `${r.figures} Figuren` : by === "model+figures" ? `${r.model} ${r.figures}F` : by === "refs+figures" ? `${r.refs} ${r.figures}F` : r[by]);
const groups = new Map();
for (const r of rows) groups.set(keyOf(r), [...(groups.get(keyOf(r)) || []), r]);
const wilson = (k, n) => { const z = 1.96, p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [(c - m) / d, (c + m) / d]; };
const out = [];
for (const [key, rs] of groups) {
  const pass = rs.filter((r) => r.verdict.pass).length;
  const [lo, hi] = wilson(pass, rs.length);
  const cost = rs.reduce((s, r) => s + r.cost, 0) / rs.length;
  const dup = rs.filter((r) => r.verdict.figures.some((f) => f.count > 1)).length / rs.length;
  const miss = rs.filter((r) => r.verdict.figures.some((f) => f.count === 0)).length / rs.length;
  const id = rs.reduce((s, r) => s + r.verdict.identityScore, 0) / rs.length;
  const outfit = rs.reduce((s, r) => s + r.verdict.figures.reduce((a, f) => a + f.outfit, 0) / (3 * r.verdict.figures.length), 0) / rs.length;
  const rk = rs.map((r) => ranks[r.variant]?.score).filter((x) => x != null);
  out.push({ key, n: rs.length, pass: pass / rs.length, lo, hi, cost, perGood: cost / (pass / rs.length), dup, miss, id, outfit, rank: rk.length ? rk.reduce((a, b) => a + b, 0) / rk.length : NaN });
}
out.sort((a, b) => b.pass - a.pass);
const f = (x, d = 0) => (Number.isFinite(x) ? (x * 100).toFixed(d) + "%" : "–");
console.log(`${by.padEnd(22)} n   pass [95%-CI]      doppelt fehlt  ident outfit rank  ¢/Bild ¢/gutes`);
for (const o of out) console.log(`${String(o.key).padEnd(22)} ${String(o.n).padStart(3)} ${f(o.pass).padStart(4)} [${f(o.lo)}–${f(o.hi)}]`.padEnd(46) + ` ${f(o.dup).padStart(4)}  ${f(o.miss).padStart(4)}  ${o.id.toFixed(2)}  ${o.outfit.toFixed(2)}  ${f(o.rank)}  ${(o.cost * 100).toFixed(3)}  ${(o.perGood * 100).toFixed(3)}`);
