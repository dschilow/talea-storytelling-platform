/** Finish the independent reviews and candidate checks after the serial baseline queue. */
import { readFile, writeFile } from "node:fs/promises";
const root = "Logs/pipeline-bakeoff/2026-10-26";
async function run(args: string[]) {
  console.log(`START ${args.join(" ")}`);
  const code = await Bun.spawn([process.execPath, ...args], { stdout: "inherit", stderr: "inherit", windowsHide: true }).exited;
  if (code) throw new Error(`Stopped at ${args.join(" ")} (${code}); inspect saved output before resuming.`);
}
for (let n = 0; ; n++) {
  const status = JSON.parse(await readFile(`${root}/queue-status.json`, "utf8").catch(() => "[]"));
  const dev = status.find((s: any) => s.lane === "developer");
  if (dev?.status === "complete" || dev?.status === "existing") break;
  if (dev?.status === "failed") throw new Error("Baseline queue stopped on developer; do not launch more calls blindly.");
  if (n > 360) throw new Error("Baseline queue not finished after 30 minutes.");
  await Bun.sleep(5000);
}
for (const lane of ["storybook", "workshop", "standard", "developer", "chapterbook"]) {
  await run(["scripts/pipeline-bakeoff/review.ts", `${root}/${lane}`]);
}
for (const [lane, flags] of [["unified", []], ["unified-picture", ["--picture-book"]], ["unified-sleep", ["--young"]]] as const) {
  try { await readFile(`${root}/${lane}/result.json`); } catch {
    await run(["scripts/pipeline-bakeoff/run.ts", "--lane", "unified", "--out", `${root}/${lane}`, ...flags]);
  }
  await run(["scripts/pipeline-bakeoff/review.ts", `${root}/${lane}`]);
}
await run(["scripts/pipeline-bakeoff/report.ts"]);
await writeFile(`${root}/finish-status.json`, JSON.stringify({ status: "complete", finished: new Date().toISOString() }));
