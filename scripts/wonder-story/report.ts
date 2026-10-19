import { readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
const root = resolve(process.argv[2] || "Logs/wonder-story");
const runs = [];
let apiUSD = 0, apiCalls = 0, unreportedCosts = 0, codexCalls = 0, codexInput = 0, codexOutput = 0;
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const dir = join(root, entry.name);
  let result: any = null, failure: any = null;
  for (const file of await readdir(dir)) {
    const path = join(dir, file);
    if (file.endsWith(".response.json")) {
      const response = JSON.parse(await readFile(path, "utf8"));
      apiUSD += response.usage?.costUSD || 0; apiCalls++;
      if (!response.providerCostReported) unreportedCosts++;
    } else if (file.endsWith(".events.jsonl")) {
      const events = (await readFile(path, "utf8")).split(/\r?\n/).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
      for (const event of events.filter(e => e.type === "turn.completed")) {
        codexCalls++; codexInput += event.usage?.input_tokens || 0; codexOutput += event.usage?.output_tokens || 0;
      }
    } else if (file === "result.json") result = JSON.parse(await readFile(path, "utf8"));
    else if (file === "failure.json") failure = JSON.parse(await readFile(path, "utf8"));
  }
  if (result || failure) runs.push({ directory: entry.name, title: result?.result?.title, chosen: result?.result?.chosen,
    status: result ? "completed" : "failed", error: failure?.error, usageThisRun: result?.usage || failure?.usage });
}
console.log(JSON.stringify({ runs, actualApiCalls: apiCalls, providerReportedUSD: Number(apiUSD.toFixed(6)), callsWithoutReportedCost: unreportedCosts,
  codex: { completedCalls: codexCalls, inputTokens: codexInput, outputTokens: codexOutput, billing: "Subscription quota, not free API inference. Replayed calls are not counted again." } }, null, 2));
