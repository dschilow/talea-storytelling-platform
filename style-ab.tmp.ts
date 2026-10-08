import { writeFile } from "node:fs/promises";
import { parseTextCheck, TEXT_CHECK_SYSTEM, TEXT_CHECK_USER } from "./backend/doku/doku-images";
const runwareKey = process.env.RUNWARE_API_KEY!;
const orKey = process.env.OPENROUTER_API_KEY!;
const scene = "A shiny red fire truck parked outside a modern station garage with hoses and heavy equipment ready on the ground";
const plainScene = "A shiny red fire truck with plain glossy red doors and a plain silver grille, parked outside a modern station garage with hoses and heavy equipment ready on the ground";
const variants: Record<string, string> = {
  A_artist: `${scene}. Wordless picture-book illustration in Axel Scheffler watercolor storybook style, every surface plain and unmarked, joyful tone, clear composition, bright warm colors.`,
  B_noartist: `${scene}. Wordless watercolor picture-book illustration with soft ink outlines, every surface plain and unmarked, joyful tone, clear composition, bright warm colors.`,
  C_plain: `${plainScene}. Wordless watercolor picture-book illustration with soft ink outlines, every surface plain and unmarked, joyful tone, clear composition, bright warm colors.`,
};
let cost = 0;
async function render(prompt: string) {
  const r = await fetch("https://api.runware.ai/v1", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${runwareKey}` },
    body: JSON.stringify([{ taskType: "imageInference", taskUUID: crypto.randomUUID(), model: process.argv[2] || "runware:400@4", numberResults: 1, outputType: ["URL"], outputFormat: "JPEG", width: 1024, height: 1024, steps: 4, CFGScale: 4, includeCost: true, positivePrompt: prompt }]) });
  const d: any = await r.json(); cost += Number(d?.data?.[0]?.cost ?? 0);
  return Buffer.from(await (await fetch(d.data[0].imageURL)).arrayBuffer());
}
async function check(bytes: Buffer) {
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${orKey}` },
    body: JSON.stringify({ model: "openai/gpt-6-luna", messages: [{ role: "system", content: TEXT_CHECK_SYSTEM }, { role: "user", content: [{ type: "text", text: TEXT_CHECK_USER }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${bytes.toString("base64")}` } }] }], max_tokens: 2000, response_format: { type: "json_object" }, reasoning: { effort: "low", exclude: true }, usage: { include: true } }) });
  const d: any = await r.json(); cost += Number(d?.usage?.cost ?? 0);
  const c = String(d?.choices?.[0]?.message?.content || "");
  return { verdict: parseTextCheck(c), where: c.replace(/\s+/g, " ").slice(0, 120) };
}
for (const [name, prompt] of Object.entries(variants)) {
  const results = await Promise.all([0, 1, 2, 3].map(async (i) => { const b = await render(prompt); await writeFile(`Logs/doku-live/style-ab/${process.argv[2]?.replace(/\W/g, "") || "4b"}-${name}-${i}.jpg`, b); return check(b); }));
  console.log(`${name}: clean ${results.filter((r) => r.verdict === false).length}/4`, results.map((r) => r.where).join(" | "));
}
console.log(`cost $${cost.toFixed(4)}`);
