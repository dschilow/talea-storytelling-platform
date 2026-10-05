/**
 * Erzeugt die Sprach-Clips des Mitternachts-Alibi über ElevenLabs (eleven_v4, Audio-Tags im Text).
 *
 *   bun scripts/game-voices/generate.mjs --dry                 # nur planen und Zeichen zählen
 *   bun scripts/game-voices/generate.mjs --prio 1               # Paket 1 (unverzichtbare Bausteine)
 *   bun scripts/game-voices/generate.mjs --prio 3               # alles bis Paket 3
 *   bun scripts/game-voices/generate.mjs --ids num.1,act.0      # einzelne Clips
 *   bun scripts/game-voices/generate.mjs --only character.astra # Teilstring in der ID
 *   bun scripts/game-voices/generate.mjs --kind figur --force   # neu erzeugen (kostet Zeichen)
 *   bun scripts/game-voices/generate.mjs --prio 3 --remaster    # nur neu schneiden/normalisieren (kostenlos)
 *   bun scripts/game-voices/generate.mjs --ids a,b --force --seed 7   # anderer Zufallswert, wenn ein Clip stottert
 *
 * Wiederaufnehmbar: Rohdateien liegen in scripts/game-voices/.cache/raw (Hash aus Stimme + Text im Namen),
 * fertige Clips unter frontend/public/game/alibi/voices. Bei Guthaben-Ende bricht der Lauf sauber ab.
 * Tavi (alle Ansagen, Namen, Zahlen, Orte, Flüstern, Macken) spricht mit der Audio-Doku-Stimme.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REPO_ROOT, TAVI_VOICE_ID, ttsClip } from "./eleven.mjs";
import { CAST, characterText, resolveVoice } from "./casting.mjs";
import { master } from "./master.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STIMMEN = path.join(REPO_ROOT, "docs", "games", "mitternachts-alibi-v2", "Stimmen.json");
export const OUT_DIR = path.join(REPO_ROOT, "frontend", "public", "game", "alibi", "voices");
const RAW_DIR = path.join(HERE, ".cache", "raw");
const LEDGER = path.join(HERE, ".cache", "ledger.json");

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : d;
};

/** Gesprochener Text weicht vom Untertitel ab, wenn die Stimme den Satz sonst verschluckt (per Abhörtest gefunden). */
const SPOKEN_OVERRIDES = {
  "w.with.1": "[whispers] Bei dir, war", // "Bei dir war:" wurde in 6 von 6 Versuchen zu "bei Tavi"/"by DLR"
};

const accountVoices =JSON.parse(readFileSync(path.join(HERE, "voices-account.json"), "utf8"));

/** Plan für einen Eintrag aus Stimmen.json: Stimme + endgültiger Text. */
function plan(id, entry) {
  if (entry.kind === "figur") {
    const m = id.match(/^character\.(.+)\.(intro|stmt|deny|confess|smug|witness)$/);
    if (!m) throw new Error(`Figuren-ID nicht lesbar: ${id}`);
    const [, slug, line] = m;
    const voice = resolveVoice(CAST[slug]?.[0] ?? (() => { throw new Error(`Figur ohne Besetzung: ${slug}`); })(), accountVoices);
    return { voiceId: voice.voice_id, voiceName: voice.name.trim(), text: characterText(slug, line, entry.text) };
  }
  return { voiceId: TAVI_VOICE_ID, voiceName: "Tavi", text: SPOKEN_OVERRIDES[id] ?? entry.eleven };
}

const stimmen = JSON.parse(readFileSync(STIMMEN, "utf8"));
const maxPrio = Number(opt("prio", "1"));
const kinds = opt("kind", "")?.split(",").filter(Boolean);
const only = opt("only", "");
const ids = opt("ids", "")?.split(",").filter(Boolean);
const limit = Number(opt("limit", "0")) || Infinity;
const concurrency = Number(opt("concurrency", "3"));
const seed = opt("seed", "") === "" ? undefined : Number(opt("seed", "0"));

const jobs = [];
for (const [id, entry] of Object.entries(stimmen)) {
  if (ids.length ? !ids.includes(id) : entry.prio > maxPrio) continue;
  if (kinds.length && !kinds.includes(entry.kind)) continue;
  if (only && !id.includes(only)) continue;
  const p = plan(id, entry);
  const hash = createHash("sha1").update(`${p.voiceId}\n${p.text}`).digest("hex").slice(0, 8);
  jobs.push({ id, entry, ...p, hash, raw: path.join(RAW_DIR, `${id}.${hash}.mp3`), out: path.join(OUT_DIR, `${id}.mp3`) });
}

mkdirSync(RAW_DIR, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });
const ledger = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, "utf8")) : {};
const saveLedger = () => writeFileSync(LEDGER, JSON.stringify(ledger, null, 1));

const todo = jobs.filter((j) => flag("force") || flag("remaster") || !(existsSync(j.out) && ledger[j.id]?.hash === j.hash)).slice(0, limit);
const chars = todo.reduce((s, j) => s + j.text.length, 0);
console.log(`Clips gesamt im Plan: ${jobs.length} | zu erzeugen: ${todo.length} | Zeichen: ${chars} | geschätzt ${(chars * 0.00015).toFixed(1)}–${(chars * 0.0003).toFixed(1)} €`);
if (flag("dry")) {
  const byVoice = {};
  todo.forEach((j) => (byVoice[j.voiceName] = (byVoice[j.voiceName] || 0) + 1));
  console.log("Stimmen:", Object.entries(byVoice).sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n} ${c}`).join(" | "));
  process.exit(0);
}

let done = 0;
let aborted = false;
const failures = [];
async function worker(queue) {
  while (!aborted) {
    const job = queue.shift();
    if (!job) return;
    try {
      if (!existsSync(job.raw) || flag("force")) {
        const r = await ttsClip({ voiceId: job.voiceId, text: job.text, seed });
        writeFileSync(job.raw, r.audio);
        job.model = r.modelId;
      }
      const m = master(job.raw, job.out);
      ledger[job.id] = { hash: job.hash, voice: job.voiceName, voiceId: job.voiceId, chars: job.text.length, text: job.text, model: job.model ?? ledger[job.id]?.model, duration: m.duration, gain: m.gain };
      done++;
      console.log(`[${done}/${todo.length}] ${job.id} · ${job.voiceName} · ${m.duration.toFixed(1)} s · ${(job.text.length / m.duration).toFixed(0)} Z/s`);
      if (done % 10 === 0) saveLedger();
    } catch (e) {
      const msg = String(e.message);
      failures.push({ id: job.id, error: msg.slice(0, 200) });
      console.log(`FEHLER ${job.id}: ${msg.slice(0, 200)}`);
      if (/quota_exceeded|insufficient|invalid_api_key|payment/i.test(msg)) {
        aborted = true;
        console.log("→ Guthaben/Schlüssel-Problem, Lauf wird beendet (bereits erzeugte Clips bleiben erhalten).");
      }
    }
  }
}
const queue = [...todo];
await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker(queue)));
saveLedger();

/** Manifest: alle vorhandenen mp3-Dateien (Sprache + Klänge). */
const present = readdirSync(OUT_DIR).filter((f) => f.endsWith(".mp3")).map((f) => f.slice(0, -4)).sort();
writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify({ ids: present }));
const plain = (t) => t.replace(/\[[^\]]*\]/g, "").trim().length;
const outliers = Object.entries(ledger).filter(([, v]) => v.duration > 0 && plain(v.text) > 12 && (plain(v.text) / v.duration < 7 || plain(v.text) / v.duration > 24));
console.log(`\nFertig: ${done} erzeugt, ${failures.length} Fehler, Manifest ${present.length} IDs.`);
if (outliers.length) console.log("Auffällige Dauer (Zeichen/Sekunde außerhalb 7–24):", outliers.map(([id, v]) => `${id} (${(plain(v.text) / v.duration).toFixed(1)})`).join(", "));
process.exit(failures.length ? 1 : 0);
