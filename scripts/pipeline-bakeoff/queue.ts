/** Serial execution prevents bursts; completed exact requests resume locally. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
const root = resolve("Logs/pipeline-bakeoff/2026-10-26");
await mkdir(root, { recursive: true });
const lanes = process.argv.slice(2).length ? process.argv.slice(2) : ["standard", "developer", "workshop", "chapterbook", "episode", "storybook", "wonder"];
const status: any[] = [];
for (const lane of lanes) {
  try { await readFile(join(root, lane, "result.json")); console.log(`${lane}: completed result already exists`); status.push({ lane, status: "existing" }); continue; } catch { /* run */ }
  const cmd = lane === "standard" || lane === "developer" ? ["scripts/pipeline-bakeoff/adapter-run.ts", ...(lane === "standard" ? ["--standard"] : [])] : ["scripts/pipeline-bakeoff/run.ts", "--lane", lane];
  console.log(`START ${lane}`);
  const proc = Bun.spawn([process.execPath, ...cmd], { stdout: "inherit", stderr: "inherit", windowsHide: true });
  const code = await proc.exited;
  status.push({ lane, status: code ? "failed" : "complete", code });
  await writeFile(join(root, "queue-status.json"), JSON.stringify(status, null, 2));
  if (code) {
    const failure = await readFile(join(root, lane, "failure.json"), "utf8").catch(() => "");
    if (/429|quota|rate.limit|usage.limit/i.test(failure)) { console.log("Quota/provider throttling: queue stops, no alternate account or paid transport."); process.exit(2); }
  }
}
