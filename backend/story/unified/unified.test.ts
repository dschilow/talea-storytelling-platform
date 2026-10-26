// @ts-ignore Bun's test helpers are runtime-only in the Encore project.
import { expect, test } from "bun:test";
import { buildBrief } from "../storybook/context";
import { CostLedger, type LlmRequest, type StorybookLlm } from "../storybook/llm";
import { runUnifiedTextEngine, sameStoryContract, keepsStrongLines } from "./engine";
import { validateColdRead } from "./review";
import { unifiedSystemPrompt, unifiedUserPrompt } from "./prompts";

const pages: any[] = [{ order: 1, content: "Nora legte den Schlüssel auf die Bank." }, { order: 2, content: "Ben hob den Schlüssel auf." }];
const issue = (quote = "Nora legte den Schlüssel auf die Bank.", page = 1) => ({ kind: "continuity", severity: "blocker", problem: "Ein konkreter Widerspruch", fix: "Den Besitzwechsel zeigen", evidence: [{ page, quote }] });
const rawRead = (issues: any[] = []) => JSON.stringify({ summary: "Nora sucht den Schlüssel und Ben findet ihn.", protagonist: "Nora", issues, keep: [] });

test("cold read accepts only exact evidence from its stated page", () => {
  expect(validateColdRead(rawRead([issue()]), pages).read?.issues).toHaveLength(1);
  for (const invalid of [issue("Nora verlor den Schlüssel."), issue(undefined, 2), { ...issue(), evidence: [] }]) {
    const result = validateColdRead(rawRead([invalid]), pages);
    expect(result.read?.issues).toHaveLength(0);
    expect(result.invalid).toHaveLength(1);
  }
  expect(validateColdRead("{}", pages).read).toBeNull();
});

const b = () => buildBrief({ config: { avatarIds: ["nora", "ben"], genre: "modern", setting: "forest", ageGroup: "6-8", length: "short", language: "de", avatarIsHero: true } as any,
  band: "6-8", budget: { pages: 2, wordsPerPageMin: 30, wordsPerPageMax: 80, totalWordsMin: 60, totalWordsMax: 160, maxCast: 1, maxCharactersPerImage: 3 }, heroes: [{ id: "nora", name: "Nora" }, { id: "ben", name: "Ben" }], candidates: [], artifacts: [], seed: "unified-regression" });
function manuscript(changed = false) {
  const text = `${changed ? "Nora nahm die Schale." : "Nora nahm den Korb."} Ben wartete neben der Bank. Sie suchten gemeinsam im weichen Gras und fanden die kleinen Steine. Nora legte einen Stein hin. Ben sah genau zu. Gemeinsam trugen sie alles zurück und setzten sich zufrieden unter den Baum.`;
  return `IDEE: Gemeinsam etwas suchen\nREGEL: Keine Magie\nFUNDSTÜCK: keins\nTITEL: Der kleine Fund\nBESCHREIBUNG: Nora und Ben suchen im Garten.\nKAPITEL 1: Der Korb\n${text}\n\nKAPITEL 2: Wieder da\n${text}`;
}
const response = (text: string) => ({ text, modelUsed: "test", usage: { prompt: 0, completion: 0, total: 0, costUSD: 0 }, durationMs: 0, finishReason: "stop" });
const models = { writer: "test-writer", critic: "test-critic", support: "test-support" };

test("the common prompt replaces forced plot beats and retains family constraints", () => {
  const brief = b();
  brief.blockedTerms = ["VerbotenesWort"];
  brief.artifacts = [{ id: "compass", name: "Abenteuerkompass", rule: "Zeigt nur nach Norden.", broughtBy: "ben" } as any];
  const system = unifiedSystemPrompt(brief, "picture-book");
  const user = unifiedUserPrompt(brief, "picture-book");
  expect(system).not.toContain("GROWN-UPS are warm and busy and almost discover it");
  expect(system).not.toContain("two of them, each appears three times");
  expect(user).toContain("one short picture-book spread");
  expect(user).toContain("Zeigt nur nach Norden.");
  expect(user).toContain("VerbotenesWort");
  expect(user).toContain("Nora");
  expect(user).toContain("Ben");
});

test("a repair cannot quietly change the magic rule or replace a character", () => {
  const story: any = { title: "Der kleine Fund", episode: { plan: { wonder: { rule: "Ein Wort macht einen Schritt." }, artifact: null, cast: [{ id: "pool-a", name: "Kicher", from: "pool" }] } } };
  const copy = structuredClone(story);
  expect(sameStoryContract(story, copy)).toBe(true);
  copy.episode.plan.wonder.rule = "Zwei Wörter machen einen Schritt.";
  expect(sameStoryContract(story, copy)).toBe(false);
  copy.episode.plan.wonder.rule = story.episode.plan.wonder.rule;
  copy.episode.plan.cast[0].id = "pool-b";
  expect(sameStoryContract(story, copy)).toBe(false);
});

test("an editor's validated strong line survives a repair", () => {
  const read: any = { keep: [{ page: 1, quote: "Dein Hut gewinnt schon wieder." }] };
  expect(keepsStrongLines(read, { pages: [{ content: "Ben nickte. Dein Hut gewinnt schon wieder." }] } as any)).toBe(true);
  expect(keepsStrongLines(read, { pages: [{ content: "Ben lachte und alle waren froh." }] } as any)).toBe(false);
});

test("unsupported accusations cannot trigger a rewrite or certify a story", async () => {
  const requests: LlmRequest[] = [];
  const llm: StorybookLlm = async r => { requests.push(r); return response(r.role === "critic" ? rawRead([issue("Ein Satz, der nicht vorkommt.")]) : manuscript()); };
  const result = await runUnifiedTextEngine({ brief: b(), llm, ledger: new CostLedger(), models });
  expect(requests.filter(r => r.role === "writer")).toHaveLength(1);
  expect(result.textQuality?.status).toBe("failed");
  expect(result.unified.invalidEvidence).toHaveLength(1);
});

test("a repair with a new supported blocker never replaces the original", async () => {
  const llm: StorybookLlm = async r => {
    if (r.stage === "unified-cold-read") return response(rawRead([issue("Nora nahm den Korb.")]));
    if (r.stage === "unified-repair-read") return response(rawRead([issue("Nora nahm die Schale.")]));
    return response(manuscript(r.stage.includes("-repair")));
  };
  const result = await runUnifiedTextEngine({ brief: b(), llm, ledger: new CostLedger(), models });
  expect(result.unified.repairAccepted).toBe(false);
  expect(result.pages[0].content).toContain("Nora nahm den Korb.");
  expect(result.textQuality?.status).toBe("failed");
});
