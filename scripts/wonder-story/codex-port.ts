import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir, homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { existsSync } from "node:fs";
import type { StorybookLlm } from "../../backend/story/storybook/llm";

/** Test-only text transport. Auth stays inside Codex; no token is read or copied. */
export function codexPort(out: string, model = "gpt-6.1-sol"): StorybookLlm {
  const bundled = join(homedir(), ".codex", ".sandbox-bin", process.platform === "win32" ? "codex.exe" : "codex");
  const binary = process.env.TALEA_CODEX_BIN || (existsSync(bundled) ? bundled : "codex");
  let sequence = 0;
  return async request => {
    if (request.imageInputs?.length) throw new Error("The Codex test port accepts text only.");
    const started = Date.now();
    const prefix = `${String(++sequence).padStart(2, "0")}-${request.stage}`;
    await mkdir(out, { recursive: true });
    const last = resolve(out, `${prefix}.txt`);
    // Bun on sandboxed Windows can return "undefined\\temp" when TEMP/TMP
    // are absent. Keep the fallback outside the repository too, so the text
    // model does not inherit the project's AGENTS.md or local instructions.
    const systemTemp = tmpdir();
    const workRoot = isAbsolute(systemTemp) ? systemTemp
      : process.platform === "win32" ? join(homedir(), "AppData", "Local", "Temp") : "/tmp";
    await mkdir(workRoot, { recursive: true });
    const cwd = await mkdtemp(join(workRoot, "talea-story-text-"));
    const prompt = `You are a text-only model in an automated story-quality test. Do not call tools, read files, browse, write files, or delegate. Return only the requested literary text or JSON in your final answer.\n\nAUTHORING INSTRUCTIONS\n${request.system}\n\nINPUT\n${request.user}`;
    await writeFile(join(out, `${prefix}.request.json`), JSON.stringify({ ...request, actualModel: model, transport: "codex-chatgpt-plan" }, null, 2));
    console.log(`  ${request.stage} · ${model} · Codex-Kontingent`);
    const args = ["exec", "--ephemeral", "--ignore-user-config", "--skip-git-repo-check", "--sandbox", "read-only", "--model", model, "--config", `model_reasoning_effort="${request.effort === "none" || request.effort === "minimal" ? "low" : request.effort || "medium"}"`, "--cd", cwd, "--json", "--output-last-message", last, "-"];
    const child = spawn(binary, args, { cwd, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "", timedOut = false;
    child.stdout.on("data", chunk => { stdout += chunk.toString(); });
    child.stderr.on("data", chunk => { stderr += chunk.toString(); });
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, request.timeoutMs || 360_000);
    const code = await new Promise<number | null>((ok, fail) => {
      child.on("error", fail); child.on("close", ok); child.stdin.on("error", () => {}); child.stdin.end(prompt, "utf8");
    }).finally(() => clearTimeout(timer));
    await writeFile(join(out, `${prefix}.events.jsonl`), stdout);
    const events = stdout.split(/\r?\n/).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
    const failure = events.findLast(e => e.type === "turn.failed")?.error?.message
      || events.findLast(e => e.type === "error")?.message;
    if (code !== 0 || timedOut) throw new Error(`Codex ${request.stage} failed (${timedOut ? "timeout" : code}): ${String(failure || stderr).slice(-1000)}`);
    const usage = events.findLast(e => e.type === "turn.completed")?.usage;
    const text = await readFile(last, "utf8");
    if (!text.trim()) throw new Error("Codex returned no final text.");
    return { text, modelUsed: model, usage: { prompt: usage?.input_tokens || 0, completion: usage?.output_tokens || 0,
      total: (usage?.input_tokens || 0) + (usage?.output_tokens || 0), cachedPromptTokens: usage?.cached_input_tokens || 0,
      // No API invoice: the report labels this as subscription usage, never as free inference.
      costUSD: 0 }, durationMs: Date.now() - started, finishReason: "stop" };
  };
}
