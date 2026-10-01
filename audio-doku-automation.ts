/**
 * CLI for the audio-doku automation interface (backend/doku/audio-automation.ts).
 *
 *   bun run audio-doku-automation.ts catalog
 *   bun run audio-doku-automation.ts start items.json     # {"items":[{topic, ageFrom, ageTo, durationMinutes, extraSpeakers:[{name, role, gender, age}]}]}
 *   bun run audio-doku-automation.ts status [jobId,jobId]
 *   bun run audio-doku-automation.ts voices                # ElevenLabs voices the casting sees
 *   bun run audio-doku-automation.ts cancel <jobId>
 *   bun run audio-doku-automation.ts publish <audioDokuId> [true|false]
 *
 * Config: env or ~/.talea-audio-automation.env (AUDIO_DOKU_AUTOMATION_KEY, TALEA_BACKEND_URL).
 * The key lives outside the repo; never commit it.
 */
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const fileEnv: Record<string, string> = {};
const envPath = join(homedir(), ".talea-audio-automation.env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) fileEnv[m[1]] = m[2];
  }
}
const key = process.env.AUDIO_DOKU_AUTOMATION_KEY || fileEnv.AUDIO_DOKU_AUTOMATION_KEY;
const base = (process.env.TALEA_BACKEND_URL || fileEnv.TALEA_BACKEND_URL || "https://backend-2-production-3de1.up.railway.app").replace(/\/+$/, "");
if (!key) {
  console.error(`AUDIO_DOKU_AUTOMATION_KEY fehlt (env oder ${envPath}).`);
  process.exit(1);
}

async function call(method: string, path: string, body?: unknown): Promise<any> {
  const res = await fetch(`${base}/automation/audio-dokus${path}`, {
    method,
    headers: { "x-automation-key": key!, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${text.slice(0, 600)}`);
    process.exit(2);
  }
  return text ? JSON.parse(text) : {};
}

const [cmd, arg, arg2] = process.argv.slice(2);

if (cmd === "catalog") {
  const data = await call("GET", "/catalog");
  console.log(`${data.total} Audio-Dokus, ${data.pendingTopics.length} offene Jobs`);
  for (const d of data.audioDokus) {
    console.log(`- [${d.isPublic ? "public" : "privat"}] ${d.title} (${d.category ?? "?"}, ${d.ageGroup ?? "?"}) :: ${String(d.description).replace(/\s+/g, " ").slice(0, 160)}`);
  }
  for (const t of data.pendingTopics) console.log(`~ in Arbeit: ${t}`);
} else if (cmd === "start" && arg) {
  const payload = JSON.parse(readFileSync(arg, "utf8"));
  const data = await call("POST", "/jobs", payload);
  for (const j of data.jobs) console.log(`${j.id}  ${j.status}  ${j.topic}`);
} else if (cmd === "status") {
  const data = await call("GET", arg ? `/jobs?ids=${encodeURIComponent(arg)}` : "/jobs");
  for (const j of data.jobs) {
    console.log(`${j.id}  ${j.status}${j.stage ? `/${j.stage}` : ""}  ${j.title ?? j.topic}${j.error ? `  FEHLER: ${j.error}` : ""}${j.audioDokuId ? `  -> ${j.audioDokuId}` : ""}`);
    for (const n of j.notes ?? []) console.log(`    · ${n}`);
  }
} else if (cmd === "voices") {
  const data = await call("GET", "/voices");
  for (const v of data.voices) {
    const l = v.labels ?? {};
    console.log(`${v.voiceId}  ${v.excludedFromAutoCast ? "[gesperrt] " : ""}${v.name}  ${[l.gender, l.age, l.accent, l.language, l.use_case].filter(Boolean).join("/")}  ${String(v.description ?? "").replace(/\s+/g, " ").slice(0, 90)}`);
  }
} else if (cmd === "cancel" && arg) {
  const j = await call("POST", `/jobs/${arg}/cancel`, {});
  console.log(`${j.id}  ${j.status}`);
} else if (cmd === "publish" && arg) {
  const r = await call("POST", `/publish/${arg}`, { isPublic: arg2 !== "false" });
  console.log(`${r.title}: ${r.isPublic ? "öffentlich" : "privat"}`);
} else {
  console.error("Befehle: catalog | voices | start <items.json> | status [ids] | cancel <jobId> | publish <audioDokuId> [true|false]");
  process.exit(1);
}
