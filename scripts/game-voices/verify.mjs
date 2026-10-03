/**
 * Prüft den Stand der erzeugten Clips: fehlende IDs, Dauer-Ausreißer, Lautheit, Gesamtgröße, Besetzung.
 *   bun scripts/game-voices/verify.mjs [--loudness]
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REPO_ROOT } from "./eleven.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(REPO_ROOT, "frontend", "public", "game", "alibi", "voices");
const stimmen = JSON.parse(readFileSync(path.join(REPO_ROOT, "docs", "games", "mitternachts-alibi-v2", "Stimmen.json"), "utf8"));
const effekte = JSON.parse(readFileSync(path.join(REPO_ROOT, "docs", "games", "mitternachts-alibi-v2", "Effekte.json"), "utf8"));
const ledger = existsSync(path.join(HERE, ".cache", "ledger.json")) ? JSON.parse(readFileSync(path.join(HERE, ".cache", "ledger.json"), "utf8")) : {};
const manifest = JSON.parse(readFileSync(path.join(OUT, "manifest.json"), "utf8")).ids;

const missingVoice = { 1: [], 2: [], 3: [] };
for (const [id, e] of Object.entries(stimmen)) if (!existsSync(path.join(OUT, `${id}.mp3`))) missingVoice[e.prio].push(id);
const missingFx = Object.keys(effekte).filter((id) => !id.startsWith("music.") && !existsSync(path.join(OUT, `${id}.mp3`)));
console.log(`Sprache fehlt: Paket 1: ${missingVoice[1].length}, Paket 2: ${missingVoice[2].length}, Paket 3: ${missingVoice[3].length} | Klänge fehlen: ${missingFx.length}`);
const stale = manifest.filter((id) => !existsSync(path.join(OUT, `${id}.mp3`)));
if (stale.length) console.log("Manifest nennt fehlende Dateien:", stale.join(", "));

const files = manifest.map((id) => path.join(OUT, `${id}.mp3`)).filter(existsSync);
const bytes = files.reduce((s, f) => s + statSync(f).size, 0);
console.log(`Dateien: ${files.length} | ${(bytes / 1024 / 1024).toFixed(1)} MB`);

const plain = (t) => t.replace(/\[[^\]]*\]/g, "").trim().length;
const rows = Object.entries(ledger).filter(([, v]) => v.duration > 0);
const rate = (v) => plain(v.text) / v.duration;
const slow = rows.filter(([, v]) => plain(v.text) > 12 && rate(v) < 7).map(([id, v]) => `${id} ${rate(v).toFixed(1)}`);
const fast = rows.filter(([, v]) => plain(v.text) > 12 && rate(v) > 24).map(([id, v]) => `${id} ${rate(v).toFixed(1)}`);
console.log(`Sprechtempo (Zeichen/s): zu langsam ${slow.length} ${slow.slice(0, 12).join(", ")} | zu schnell ${fast.length} ${fast.slice(0, 12).join(", ")}`);
const long = rows.filter(([id, v]) => v.duration > (id.startsWith("character.") || id.startsWith("kom.") ? 22 : 12)).map(([id, v]) => `${id} ${v.duration.toFixed(1)}s`);
if (long.length) console.log("Sehr lange Clips:", long.join(", "));

const perVoice = {};
for (const v of rows) {
  const n = v[1].voice;
  perVoice[n] = perVoice[n] || { clips: 0, chars: 0, sec: 0 };
  perVoice[n].clips++;
  perVoice[n].chars += v[1].chars;
  perVoice[n].sec += v[1].duration;
}
console.log("Stimmen:", Object.entries(perVoice).sort((a, b) => b[1].clips - a[1].clips).map(([n, v]) => `${n.slice(0, 18)} ${v.clips}/${(v.sec / 60).toFixed(1)}min`).join(" | "));
console.log(`Zeichen insgesamt abgerechnet (inkl. Tags): ${rows.reduce((s, [, v]) => s + v.chars, 0)} | Audio: ${(rows.reduce((s, [, v]) => s + v.duration, 0) / 60).toFixed(1)} min`);

if (process.argv.includes("--loudness")) {
  const vals = [];
  for (const f of files) {
    const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", f, "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8" });
    const i = [...r.stderr.matchAll(/\bI:\s+(-?\d+(?:\.\d+)?)\s+LUFS/g)].pop();
    const pk = [...r.stderr.matchAll(/Peak:\s+(-?\d+(?:\.\d+)?)\s+dBFS/g)].pop();
    if (i && pk && Number(i[1]) > -60) vals.push({ f: path.basename(f), i: Number(i[1]), pk: Number(pk[1]) });
  }
  vals.sort((a, b) => a.i - b.i);
  console.log(`Lautheit (${vals.length} Clips): min ${vals[0].i} (${vals[0].f}), max ${vals.at(-1).i} (${vals.at(-1).f}) | höchste Spitze ${Math.max(...vals.map((v) => v.pk))} dBFS`);
}
