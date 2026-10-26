import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { codexPort } from "../wonder-story/codex-port";
import type { LlmRequest, StorybookLlm } from "../../backend/story/storybook/llm";

export async function quotaPort(out: string, limit = 45) {
  await mkdir(out, { recursive: true });
  const key = (r: LlmRequest) => createHash("sha256").update(JSON.stringify([r.model.replace(/^openai\//, ""), r.system, r.user, r.json, r.effort, r.maxTokens])).digest("hex");
  const cache = new Map<string, any>();
  for (const file of await readdir(out)) if (file.endsWith(".saved.json")) {
    const saved = JSON.parse(await readFile(join(out, file), "utf8")); cache.set(saved.key, saved.response);
  }
  let calls = 0;
  const occurrences = new Map<string, number>();
  const ports = new Map<string, StorybookLlm>();
  const complete: StorybookLlm = async request => {
    if (++calls > limit) throw new Error(`Call ceiling ${limit}`);
    const model = request.model.replace(/^openai\//, "");
    if (!["gpt-6.1-sol", "gpt-6-luna"].includes(model) || request.imageInputs?.length) throw new Error("Only Sol/Luna text calls are authorized");
    const base = key(request);
    const occurrence = (occurrences.get(base) || 0) + 1;
    occurrences.set(base, occurrence);
    // A deliberate second read in the same engine run remains a fresh call.
    // Resume replays the matching occurrence, rather than memoizing a model.
    const fingerprint = occurrence === 1 ? base : `${base}-${occurrence}`;
    const saved = cache.get(fingerprint);
    if (saved) { console.log(`  ${request.stage} · exact replay`); return { ...saved, durationMs: 0, usage: { prompt: 0, completion: 0, total: 0, costUSD: 0 } }; }
    let port = ports.get(model);
    if (!port) { port = codexPort(join(out, model), model); ports.set(model, port); }
    let response;
    try { response = await port(request); }
    catch (error) {
      // A transient 429 is not a quota reset. Back off once on the same
      // account and transport; an actual usage/quota exhaustion stops here.
      if (!/429 Too Many Requests/.test(String(error)) || /usage.limit|quota.exhaust|reached.your|hit.your/i.test(String(error))) throw error;
      console.log("  Transient HTTP 429: wait 60 s, then one same-request retry.");
      await Bun.sleep(60_000);
      response = await port(request);
    }
    await writeFile(join(out, `${fingerprint}.saved.json`), JSON.stringify({ key: fingerprint, request, response }, null, 2));
    cache.set(fingerprint, response);
    return response;
  };
  // Some production engines issue two readers in parallel. Serialize their
  // transport only; both stages and their original requests still run.
  let tail = Promise.resolve<unknown>(undefined);
  const llm: StorybookLlm = request => {
    const pending = tail.then(() => complete(request));
    tail = pending.catch(() => undefined);
    return pending;
  };
  return { llm, calls: () => calls };
}
