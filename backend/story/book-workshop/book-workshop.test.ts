// @ts-ignore Bun's test runner is available without adding a production dependency.
import { describe, expect, test } from "bun:test";
import { normalizeArtifacts, normalizePeople } from "./catalog";
import { makeBrief, wizardWishes } from "./brief";
import { checkManuscript, checkReview, grounded, normalizeIllustrationMetadata, parseContract, readingBudget } from "./contracts";
import { generateBook, manuscriptHash } from "./engine";
import { describeBookFailure } from "./failure";
import { transientGenerationError } from "./recovery";
import { storyMetadataForViewer } from "../metadata-visibility";
import { TextBudget } from "./budget";
import { imageAccounting, illustrateBook, runwareProvider } from "./images";
import { openRouterTransport, reasoningFor } from "./openrouter";
import { summarizeRunwareResponse } from "../../ai/image-cost-summary";
import type { BookBrief, BookPlan, BookReview, Completion, Manuscript, Person, Transport } from "./types";

const hero: Person = { id: "alex", name: "Alexander", description: "probiert gern Dinge aus", voice: [], motivation: "", quirk: "", settings: [], appearance: "brown hair" };
const brief: BookBrief = { seed: "test", ageBand: "3-5", length: "short", language: "de", heroes: [hero], candidates: [], artifacts: [], wishes: { humorLevel: 0 }, recentPremises: [], blockedTerms: [] };
// Mechanical fixture, deliberately not a claimed gold-standard children's story.
const pageText = "Alexander wollte den Ball holen. Der Ball lag unter der Bank. Alexander streckte den Arm aus. Er kam nicht weit genug. Er legte sich auf den Bauch und griff noch einmal zu. Nun hatte er den Ball.";
const book: Manuscript = { title: "Der Ball", description: "Alexander holt einen Ball unter einer Bank hervor.", pages: Array.from({ length: 6 }, (_, i) => ({ order: i + 1, text: pageText, illustration: { scene: "Alexander reaches for a ball under a bench.", castIds: [hero.id], artifactVisible: false } })) };
const plan: BookPlan = { premise: "Ein Ball liegt unter der Bank.", childWants: "Den Ball holen", whyItMatters: "Weiterspielen", worldRule: null, castIds: [], artifactId: null, heroActions: [{ heroId: "alex", contribution: "Er holt den Ball" }], places: ["Hof"], beats: Array.from({ length: 6 }, (_, i) => ({ page: i + 1, place: "Hof", action: "greift nach Ball", cause: "Ball ist weg", result: "Ball gefunden" })), ending: "Sie spielen weiter" };
const evidence = { page: 1, quote: "Alexander wollte den Ball holen." };
const answer = { answer: "Er möchte den Ball holen.", evidence: [evidence] };
const review: BookReview = { comprehension: { want: answer, obstacle: answer, solution: answer, outcome: answer }, scores: { clarity: 4, causality: 4, agency: 4, readAloud: 4, engagement: 4, humor: 1 }, issues: [], heroActions: [{ heroId: "alex", evidence: [evidence] }], imageIssues: [], developments: [], artifactEvidence: null };
const prices = { writer: { inputPerMillion: 0.01, outputPerMillion: 0.01 }, judge: { inputPerMillion: 0.01, outputPerMillion: 0.01 } };
const copy = <T>(value: T): T => structuredClone(value);
const received = (value: unknown, overrides: Partial<Completion> = {}): Completion => ({ text: JSON.stringify(value), model: "test", promptTokens: 100, completionTokens: 100, costUSD: 0.0001, finishReason: "stop", ...overrides });
function sequence(values: unknown[]) {
  let calls = 0;
  const transport: Transport = async () => { const value = values[calls++]; if (value instanceof Error) throw value; return received(value); };
  return { transport, count: () => calls };
}
const options = (transport: Transport) => ({ writer: "writer", reviewer: "judge", prices, transport, maxCalls: 5, maxRecoveryAttempts: 0, recoveryDelayMs: 0 });

describe("release depends on the final manuscript", () => {
  test("heroes accidentally listed as supporting cast are not dropped from the book", async () => {
    const doubled = copy(plan); doubled.castIds = [hero.id];
    const fake = sequence([doubled, book, review]);
    const result = await generateBook(brief, options(fake.transport));
    expect(result.status).toBe("accepted"); expect(fake.count()).toBe(3);
    expect(result.plan!.castIds).toEqual([]);
    expect(result.plan!.heroActions).toEqual(plan.heroActions);
    const unknown = copy(plan); unknown.castIds = ["invented-stranger"];
    const rejected = await generateBook(brief, options(sequence([unknown]).transport));
    expect(rejected.status).toBe("rejected");
  });
  test("moderate humor after revision is an editorial note, while clarity and evidence remain mandatory", async () => {
    const funnyBrief = { ...brief, wishes: { humorLevel: 2 } };
    const moderate = copy(review); moderate.scores.humor = 3;
    const fake = sequence([plan, book, moderate, book, moderate]);
    const result = await generateBook(funnyBrief, options(fake.transport));
    expect(result.status).toBe("accepted"); expect(fake.count()).toBe(5);
    expect(result.editorialNotes).toContain("Requested humor is not delivered");
    expect(result.review!.scores.humor).toBe(3);
    for (const defect of ["clarity", "evidence", "humor"] as const) {
      const failed = copy(moderate);
      if (defect === "clarity") failed.scores.clarity = 2;
      if (defect === "evidence") failed.comprehension.solution = null;
      if (defect === "humor") failed.scores.humor = 2;
      const run = await generateBook(funnyBrief, options(sequence([plan, book, moderate, book, failed]).transport));
      expect(run.status).toBe("rejected");
    }
  });
  test("real-price repair remains affordable after the logged 0.00945015 USD spend", async () => {
    const medium = { ...brief, ageBand: "6-8" as const, length: "medium" as const };
    const longerPlan = { ...plan, beats: Array.from({ length: 8 }, (_, i) => ({ ...plan.beats[0], page: i + 1 })) };
    const makeBook = (repetitions: number) => ({ ...book, pages: Array.from({ length: 8 }, (_, i) => ({ ...book.pages[0], order: i + 1, text: Array(repetitions).fill(pageText).join(" ") })) });
    const badReview = copy(review); badReview.comprehension.solution = null;
    const values = [longerPlan, makeBook(3), badReview, makeBook(2), review];
    const costs = [0.002, 0.004, 0.00345015, 0.003, 0.002];
    let calls = 0;
    const result = await generateBook(medium, { ...options(async () => { const i = calls++; return received(values[i], { costUSD: costs[i] }); }),
      prices: { writer: { inputPerMillion: 0.2, outputPerMillion: 1.2 }, judge: { inputPerMillion: 0.25, outputPerMillion: 1.5 } }, textBudgetUSD: 0.03 });
    expect(result.status).toBe("accepted"); expect(calls).toBe(5);
    expect(result.textCostUSD).toBe(0.01445015);
    expect(result.manuscriptHash).toBe(manuscriptHash(makeBook(2)));
  });
  test("ordinary props never request a nonexistent catalogue image and prose remains intact", () => {
    const marked = copy(book); marked.pages[0].illustration.artifactVisible = true;
    const corrected = normalizeIllustrationMetadata(marked, plan);
    expect(corrected.pages[0].illustration.artifactVisible).toBe(false);
    expect(corrected.pages.map(p => p.text)).toEqual(marked.pages.map(p => p.text));
    expect(marked.pages[0].illustration.artifactVisible).toBe(true);
    expect(normalizeIllustrationMetadata(marked, { ...plan, artifactId: "real-item" }).pages[0].illustration.artifactVisible).toBe(true);
  });
  test("quoted dialogue excerpts tolerate quotation typography but never changed words or wrong pages", () => {
    const dialogue = copy(book); dialogue.pages[0].text = '„Wir bringen den Korb pünktlich hin. Ich kenne den Weg.“';
    expect(grounded({ page: 1, quote: '„Wir bringen den Korb pünktlich hin.“' }, dialogue)).toBe(true);
    expect(grounded({ page: 1, quote: '„Wir brachten den Korb pünktlich hin.“' }, dialogue)).toBe(false);
    expect(grounded({ page: 2, quote: '„Wir bringen den Korb pünktlich hin.“' }, dialogue)).toBe(false);
  });
  test("transient planning and writing failures recover and still leave room for a checked revision", async () => {
    const bad = copy(review); bad.scores.clarity = 2;
    const fake = sequence([new Error("OpenRouter HTTP 503"), plan, new Error("connection lost"), book, bad, book, review]);
    const snapshots: any[] = [];
    const result = await generateBook(brief, { ...options(fake.transport), maxCalls: 7, maxRecoveryAttempts: 2,
      onCheckpoint: async snapshot => { snapshots.push(snapshot); } });
    expect(result.status).toBe("accepted"); expect(fake.count()).toBe(7);
    expect(result.reservedUnknownUSD).toBeGreaterThan(0);
    expect(result.receipts.filter(r => r.status === "failed").length).toBe(2);
    expect(snapshots.some(s => s.manuscript && !s.review)).toBe(true);
    expect(snapshots[0].manuscript).toBeUndefined();
    expect(result.manuscriptHash).toBe(manuscriptHash(book));
  });
  test("malformed writer output retries only the writer", async () => {
    const fake = sequence([plan, {}, book, review]);
    const result = await generateBook(brief, { ...options(fake.transport), maxCalls: 7, maxRecoveryAttempts: 2 });
    expect(result.status).toBe("accepted");
    expect(result.receipts.map(r => r.stage)).toEqual(["plan", "manuscript", "manuscript-retry", "review"]);
  });
  test("persistent outages are bounded and permanent provider errors are not retried", async () => {
    for (const status of [400, 401, 402, 403, 404]) {
      expect(transientGenerationError(new Error(`OpenRouter HTTP ${status}`))).toBe(false);
      const fake = sequence([new Error(`OpenRouter HTTP ${status}`)]);
      await generateBook(brief, { ...options(fake.transport), maxCalls: 7, maxRecoveryAttempts: 2 });
      expect(fake.count()).toBe(1);
    }
    const fake = sequence([new Error("OpenRouter HTTP 503"), new Error("OpenRouter HTTP 503")]);
    const result = await generateBook(brief, { ...options(fake.transport), maxCalls: 7, maxRecoveryAttempts: 2 });
    expect(result.status).toBe("rejected"); expect(fake.count()).toBe(2);
  });
  test("saved unapproved drafts are private and survive a failed review in checkpoints", async () => {
    const saved: any[] = [];
    const fake = sequence([plan, book, new Error("OpenRouter HTTP 401")]);
    const result = await generateBook(brief, { ...options(fake.transport), onCheckpoint: async s => { saved.push(s); } });
    expect(result.status).toBe("rejected");
    expect(saved[saved.length - 1].manuscript).toEqual(book);
    expect(saved[saved.length - 1].review).toBeUndefined();
    const metadata = { adminGenerationMetrics: { bookWorkshopDraft: saved[saved.length - 1] }, error: { message: "unavailable" } };
    expect(storyMetadataForViewer(metadata, false)).toEqual({ error: { message: "unavailable" } });
  });
  test("logged malformed review is retried against the same book and both calls are charged", async () => {
    const malformed = { ...copy(review), developments: [{ heroId: "alex", trait: "courage", change: "+2", description: "holt den Ball", evidence: [evidence] }], artifactEvidence: [] };
    const requests: any[] = [];
    const values = [plan, book, malformed, review];
    const transport = openRouterTransport("test-only", (async (_url: unknown, init: RequestInit) => {
      const request = JSON.parse(String(init.body)); requests.push(request);
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(values[requests.length - 1]) }, finish_reason: "stop" }],
        usage: { prompt_tokens: 100, completion_tokens: 100, cost: 0.0001 } }));
    }) as typeof fetch);
    const result = await generateBook(brief, options(transport));
    expect(result.status).toBe("accepted"); expect(result.textCostUSD).toBe(0.0004);
    expect(result.receipts.map(r => r.stage)).toEqual(["plan", "manuscript", "review", "review-retry"]);
    expect(result.receipts[2].status).toBe("failed");
    for (const request of requests) {
      expect(request.response_format.type).toBe("json_schema");
      expect(request.response_format.json_schema.strict).toBe(true);
    }
    const schema = requests[2].response_format.json_schema.schema;
    expect(schema.properties.developments.items.properties.change.type).toBe("integer");
    expect(schema.properties.artifactEvidence.anyOf[0].type).toBe("object");
    expect(JSON.parse(requests[2].messages[1].content).book).toEqual(JSON.parse(requests[3].messages[1].content).book);
    expect(result.manuscriptHash).toBe(manuscriptHash(book));
  });
  test("invalid reviews are not coerced and the retry is bounded", async () => {
    const malformed = { ...copy(review), scores: { ...review.scores, clarity: "4" } };
    const fake = sequence([plan, book, malformed, malformed]);
    const result = await generateBook(brief, options(fake.transport));
    expect(result.status).toBe("rejected"); expect(fake.count()).toBe(4);
    expect(result.review).toBeUndefined(); expect(result.manuscriptHash).toBeUndefined();
    expect(result.manuscript).toEqual(book);
    expect(result.textCostUSD).toBe(0.0004);
  });
  test("review retry cannot bypass a causal blocker or exceed the five-call cap", async () => {
    const malformed = { ...copy(review), artifactEvidence: [] };
    const bad = copy(review); bad.scores.causality = 1;
    const fake = sequence([plan, book, malformed, bad]);
    const result = await generateBook(brief, options(fake.transport));
    expect(result.status).toBe("rejected"); expect(fake.count()).toBe(4);
    expect(result.issues.join(" ")).toContain("causality");
  });
  test("truncated review is regenerated once without rewriting the story", async () => {
    let calls = 0;
    const result = await generateBook(brief, options(async () => {
      calls++;
      return received([plan, book, review, review][calls - 1], { finishReason: calls === 3 ? "length" : "stop" });
    }));
    expect(result.status).toBe("accepted"); expect(calls).toBe(4);
    expect(result.receipts[3].stage).toBe("review-retry");
  });
  test("redundant plan numbering and location index cannot discard valid events", async () => {
    const metadata = copy(plan);
    metadata.beats.forEach((b, i) => { b.page = i + 2; b.place = " Garten "; });
    const fake = sequence([metadata, book, review]);
    const result = await generateBook(brief, options(fake.transport));
    expect(result.status).toBe("accepted"); expect(fake.count()).toBe(3);
    expect(result.plan!.beats.map(b => b.action)).toEqual(metadata.beats.map(b => b.action));
    expect(result.plan!.places).toContain("Garten");
  });
  test("wrong page count gets one paid plan correction, never padded events", async () => {
    const short = copy(plan); short.beats.pop();
    const fake = sequence([short, plan, book, review]);
    const result = await generateBook(brief, options(fake.transport));
    expect(result.status).toBe("accepted"); expect(fake.count()).toBe(4);
    expect(result.receipts.map(r => r.stage)).toEqual(["plan", "plan-repair", "manuscript", "review"]);
    expect(result.textCostUSD).toBe(0.0004);
    const stillWrong = sequence([short, short]);
    const rejected = await generateBook(brief, options(stillWrong.transport));
    expect(rejected.status).toBe("rejected"); expect(stillWrong.count()).toBe(2);
    expect(rejected.issues[0]).toContain("received 5");
  });
  test("a repaired plan cannot spend on prose revision without a remaining review slot", async () => {
    const short = copy(plan); short.beats.pop();
    const bad = copy(review); bad.scores.clarity = 2;
    const fake = sequence([short, plan, book, bad]);
    const result = await generateBook(brief, options(fake.transport));
    expect(result.status).toBe("rejected"); expect(fake.count()).toBe(4);
    expect(result.issues.join(" ")).toContain("budget");
  });
  test("medium German manuscript has room for prose plus illustration JSON", async () => {
    const medium = { ...brief, ageBand: "6-8" as const, length: "medium" as const };
    const longerPlan = { ...plan, beats: Array.from({ length: 8 }, (_, i) => ({ ...plan.beats[0], page: i + 1 })) };
    const longerBook = { ...book, pages: Array.from({ length: 8 }, (_, i) => ({ ...book.pages[0], order: i + 1, text: `${pageText} ${pageText}` })) };
    let calls = 0;
    const result = await generateBook(medium, options(async request => {
      const value = [longerPlan, longerBook, review][calls++];
      return received(value, { finishReason: calls === 2 && request.maxTokens < 4000 ? "length" : "stop" });
    }));
    expect(result.status).toBe("accepted"); expect(calls).toBe(3);
  });
  test("provider and planning failures are not reported as failed comprehension", async () => {
    const provider = await generateBook(brief, options(sequence([new Error("OpenRouter HTTP 401")]).transport));
    expect(describeBookFailure(provider).reason).toBe("provider-http-401");
    expect(describeBookFailure(provider).stage).toBe("plan");
    const malformed = await generateBook(brief, options(sequence([{}]).transport));
    expect(describeBookFailure(malformed).reason).toBe("invalid-output");
    const invalidPlan = copy(plan); invalidPlan.beats = [];
    const planning = await generateBook(brief, options(sequence([invalidPlan]).transport));
    expect(describeBookFailure(planning).reason).toBe("plan-rejected");
    const budget = await generateBook(brief, { ...options(sequence([]).transport), textBudgetUSD: 0.000001 });
    expect(describeBookFailure(budget).reason).toBe("budget");
  });
  test("one plan, one manuscript, one review", async () => {
    const fake = sequence([plan, book, review]);
    const result = await generateBook(brief, options(fake.transport));
    expect(result.status).toBe("accepted"); expect(fake.count()).toBe(3);
    expect(result.manuscriptHash).toBe(manuscriptHash(book)); expect(result.textCostUSD).toBe(0.0003);
  });
  test("a causal blocker survives good format and scores", async () => {
    const rejected = copy(review); rejected.issues.push({ severity: "blocker", page: 5, problem: "Das Boot fährt ohne das abgeschnittene Segel", fix: "Zeige, wie das Boot tatsächlich zurückkommt" });
    const fake = sequence([plan, book, rejected, book, rejected]);
    const result = await generateBook(brief, options(fake.transport));
    expect(result.status).toBe("rejected"); expect(fake.count()).toBe(5);
    let imageCalls = 0;
    expect(await illustrateBook(result, brief, async () => { imageCalls++; return {}; }, async u => u)).toEqual([]);
    expect(imageCalls).toBe(0);
  });
  test("a revision needs a fresh review and never inherits the old verdict", async () => {
    const rejected = copy(review); rejected.scores.clarity = 2;
    const revised = copy(book); revised.title = "Ein klarer Schluss";
    const fake = sequence([plan, book, rejected, revised, new Error("review timeout")]);
    const result = await generateBook(brief, options(fake.transport));
    expect(result.status).toBe("rejected"); expect(result.review).toBeUndefined(); expect(result.manuscriptHash).toBeUndefined();
    expect(result.receipts.length).toBe(5); expect(result.accountingComplete).toBe(false);
  });
  test("successful revision is certified against its own content", async () => {
    const rejected = copy(review); rejected.scores.clarity = 2;
    const revised = copy(book); revised.title = "Der wiedergefundene Ball";
    const fake = sequence([plan, book, rejected, revised, review]);
    const result = await generateBook(brief, options(fake.transport));
    expect(result.status).toBe("accepted"); expect(result.manuscriptHash).toBe(manuscriptHash(revised));
  });
  test("an unavailable reviewer never passes", async () => {
    const fake = sequence([plan, book, new Error("unavailable")]);
    expect((await generateBook(brief, options(fake.transport))).status).toBe("rejected"); expect(fake.count()).toBe(3);
  });
  test("made-up evidence cannot pass", () => {
    const bad = copy(review); bad.comprehension.solution!.evidence = [{ page: 5, quote: "Das Boot schwamm ganz von selbst zurück." }];
    expect(checkReview(bad, book, brief, plan)).toContain("Unproven comprehension: solution");
  });
  test("missing evidence is a schema failure, not an empty-array pass", () => {
    const bad = copy(review); bad.heroActions[0].evidence = [];
    expect(() => parseContract("review", JSON.stringify(bad))).toThrow();
  });
  test("missing or wrong types do not coerce into passing grades", () => {
    expect(() => parseContract("review", '{"scores":{"clarity":"5"}}')).toThrow();
  });
  test("changed approved text cannot trigger image generation", async () => {
    const fake = sequence([plan, book, review]); const result = await generateBook(brief, options(fake.transport));
    result.manuscript!.pages[0].text += " Dann flog er weg.";
    expect(await illustrateBook(result, brief, async () => { throw new Error("must not run"); }, async u => u)).toEqual([]);
  });
});

describe("budget and provider accounting", () => {
  test("budget preflight prevents paid work", async () => {
    const fake = sequence([]); const result = await generateBook(brief, { ...options(fake.transport), textBudgetUSD: 0.000000001 });
    expect(fake.count()).toBe(0); expect(result.status).toBe("rejected");
  });
  test("truncated paid responses remain in the ledger", async () => {
    const result = await generateBook(brief, options(async () => received(plan, { finishReason: "length", costUSD: 0.001 })));
    expect(result.status).toBe("rejected"); expect(result.textCostUSD).toBe(0.001); expect(result.receipts[0].status).toBe("failed");
  });
  test("invalid JSON is paid and stops without repair loops", async () => {
    const result = await generateBook(brief, options(async () => received(plan, { text: "broken JSON" })));
    expect(result.status).toBe("rejected"); expect(result.receipts.length).toBe(1); expect(result.textCostUSD).toBe(0.0001);
  });
  test("unknown transport outcome keeps its reservation", async () => {
    const result = await generateBook(brief, options(async () => { throw new Error("connection lost"); }));
    expect(result.receipts[0].costSource).toBe("reserved-unknown"); expect(result.textCostUSD).toBe(0);
    expect(result.providerTextCostUSD).toBe(0); expect(result.reservedUnknownUSD).toBeGreaterThan(0);
    expect(result.budgetCommittedUSD).toBe(result.reservedUnknownUSD); expect(result.accountingComplete).toBe(false);
  });
  test("an authentication failure is not presented as measured spend", async () => {
    let calls = 0;
    const transport = openRouterTransport("invalid-key", (async () => { calls++; return new Response("private provider error", { status: 401 }); }) as typeof fetch);
    const result = await generateBook(brief, options(transport));
    expect(calls).toBe(1); expect(result.issues).toContain("OpenRouter HTTP 401");
    expect(result.textCostUSD).toBe(0); expect(result.reservedUnknownUSD).toBeGreaterThan(0);
    expect(JSON.stringify(result)).not.toContain("private provider error");
  });
  test("reasoning parameters respect incompatible model generations", () => {
    expect(reasoningFor("openai/gpt-5-mini")?.effort).toBe("minimal");
    expect(reasoningFor("openai/gpt-5.6-luna")?.effort).toBe("none");
    expect(reasoningFor("google/gemini-3.5-flash-lite")?.effort).toBe("minimal");
    expect(reasoningFor("openai/gpt-4o")).toBeUndefined();
  });
  test("invalid price and budget are rejected", () => { expect(() => new TextBudget(NaN)).toThrow(); expect(() => new TextBudget(-1)).toThrow(); });
  test("null usage cost is not booked as free", async () => {
    let body: any;
    const transport = openRouterTransport("test-key", (async (_url: unknown, init: RequestInit) => { body = JSON.parse(String(init.body)); return new Response(JSON.stringify({ model: "writer", choices: [{ message: { content: "{}" }, finish_reason: "stop" }], usage: { prompt_tokens: 2, completion_tokens: 2, cost: null } })); }) as typeof fetch);
    const call = await transport({ model: "writer", price: prices.writer, system: "x", user: "y", maxTokens: 10, signal: new AbortController().signal });
    expect(call.costUSD).toBeUndefined(); expect(body.provider.max_price).toEqual({ prompt: 0.01, completion: 0.01 }); expect(body.max_tokens).toBe(10);
  });
  test("observer failure cannot release or fail a book", async () => {
    const fake = sequence([plan, book, review]);
    expect((await generateBook(brief, { ...options(fake.transport), onReceipt: () => { throw new Error("logging offline"); } })).status).toBe("accepted");
  });
});

describe("DNA, ages, wishes and artwork", () => {
  test("database and exported artifact names respect English", () => {
    expect(normalizeArtifacts([{ id: "a", name_de: "Karte", name_en: "Map", story_role: "Shows a direction" }], "en")[0].name).toBe("Map");
    expect(normalizeArtifacts([{ id: "a", name: { de: "Karte", en: "Map" }, storyRole: "Shows a direction" }], "en")[0].name).toBe("Map");
  });
  test("artifact limits at the end of long DNA are retained", () => {
    const rule = "Beschreibung. ".repeat(70) + "Kann niemals schweben.";
    expect(normalizeArtifacts([{ id: "a", name_de: "Karte", story_role: rule }], "de")[0].rule).toBe(rule);
  });
  test("unconfigured artwork is not counted as paid attempts", async () => {
    const fake = sequence([plan, book, review]); const result = await generateBook(brief, options(fake.transport));
    const images = await illustrateBook(result, brief, runwareProvider("", (async () => { throw new Error("must not call"); }) as typeof fetch), async u => u);
    expect(imageAccounting(images)).toEqual({ providerCostUSD: 0, estimatedCostUSD: 0, totalCostUSD: 0, complete: true, attempts: 0 });
    expect(images.every(i => i.status === "unavailable")).toBe(true);
  });
  test("partial image billing retains actual prices and labels only the unknown part", () => {
    const job = { page: 1, taskId: "a", prompt: "scene", references: [], attempted: true, status: "generated" as const };
    expect(imageAccounting([{ ...job, costUSD: 0.002 }, { ...job, page: 2 }, { ...job, page: 3, attempted: false, costUSD: 0 }]))
      .toEqual({ providerCostUSD: 0.002, estimatedCostUSD: 0.00151, totalCostUSD: 0.00351, complete: false, attempts: 2 });
  });
  test("duplicate names select the richer DNA deterministically", () => {
    const rows = [{ id: "old", name: "Bäcker Wilhelm", isActive: true }, { id: "new", name: "Bäcker Wilhelm", backstory: "Niemand soll hungrig sein", speechStyle: ["herzlich"] }];
    expect(normalizePeople(rows).map(p => p.id)).toEqual(["new"]); expect(normalizePeople(rows.reverse()).map(p => p.id)).toEqual(["new"]);
  });
  test("selected avatars with the same name remain separate people", () => {
    expect(normalizePeople([{ id: "a", name: "Alex" }, { id: "b", name: "Alex" }], false).map(p => p.id)).toEqual(["a", "b"]);
  });
  test("all age and length modes retain every selected hero", () => {
    for (const ageBand of ["3-5", "6-8", "9-12", "13+"] as const) for (const length of ["short", "medium", "long"] as const) {
      const many = Array.from({ length: 6 }, (_, i) => ({ ...hero, id: `hero-${i}` }));
      const budget = readingBudget({ ageBand, length, heroes: many });
      expect(budget.minWords).toBeLessThan(budget.maxWords); expect(budget.supportingCast).toBe(0); expect(many.length).toBe(6);
    }
  });
  test("no capitalized German noun detector", () => { expect(checkManuscript(book, plan, brief)).toEqual([]); });
  test("false and zero wizard settings survive", () => {
    const config: any = { ageGroup: "13+", length: "long", language: "nl", humorLevel: 0, allowRhymes: false, requireHappyEnd: false, customPrompt: "ein Rätsel", learningMode: { enabled: true, subjects: ["nature"] }, aiModel: "secret-model" };
    expect(wizardWishes(config).humorLevel).toBe(0); expect(wizardWishes(config).allowRhymes).toBe(false); expect(wizardWishes(config).aiModel).toBeUndefined();
    expect(makeBrief(config, [hero], "seed").ageBand).toBe("13+"); expect(makeBrief(config, [hero], "seed").language).toBe("nl");
  });
  test("no brought artifact can disappear from the plan", async () => {
    const fake = sequence([plan]);
    const result = await generateBook({ ...brief, artifacts: [{ id: "map", name: "Karte", rule: "Zeigt eine Richtung", appearance: "map", broughtBy: "alex" }] }, options(fake.transport));
    expect(result.status).toBe("rejected"); expect(fake.count()).toBe(1);
  });
  test("Wizard fixtures preserve the brought artifact and reject a missing owner", () => {
    const config: any = { ageGroup: "6-8", length: "short", broughtArtifact: { avatarId: "alex", artifactId: "a" } };
    const artifact = { id: "a", name: "Karte", rule: "Zeigt eine Richtung", appearance: "map" };
    expect(makeBrief(config, [hero], "seed", { artifacts: [artifact] }).artifacts[0].broughtBy).toBe("alex");
    expect(() => makeBrief(config, [], "seed", { artifacts: [artifact] })).toThrow();
  });
  test("one picture cannot demand more than four reference identities", () => {
    const crowded = copy(book); crowded.pages[0].illustration.castIds = ["alex", "a", "b", "c", "d"];
    expect(checkManuscript(crowded, plan, brief).some(i => i.includes("four"))).toBe(true);
  });
  test("image requests keep the Flux model and read actual cost", async () => {
    let body: any;
    const provider = runwareProvider("test-key", (async (_url: unknown, init: RequestInit) => { body = JSON.parse(String(init.body)); return new Response(JSON.stringify({ data: [{ taskType: "imageInference", taskUUID: "task", imageURL: "https://example.com/image.webp", cost: 0.00151 }] })); }) as typeof fetch);
    expect((await provider({ taskId: "task", page: 1, prompt: "scene", references: ["https://example.com/person.webp"] })).costUSD).toBe(0.00151);
    expect(body[0].model).toBe("runware:400@4"); expect(body[0].includeCost).toBe(true); expect(body[0].inputs.referenceImages.length).toBe(1);
  });
  test("visible characters and artifact use one combined image input", async () => {
    const withImages = { ...brief, heroes: [{ ...hero, imageUrl: "https://example.com/alex.png" }], artifacts: [{ id: "a", name: "Map", rule: "Shows the path", appearance: "map", imageUrl: "https://example.com/map.png" }] };
    const fake = sequence([plan, book, review]); const result = await generateBook(brief, options(fake.transport));
    result.plan!.artifactId = "a";
    result.manuscript!.pages.forEach(p => p.illustration.artifactVisible = true);
    result.manuscriptHash = manuscriptHash(result.manuscript!);
    const jobs: any[] = [], slotsSeen: any[] = [];
    await illustrateBook(result, withImages, async job => { jobs.push(job); return { url: "https://example.com/scene.webp", costUSD: 0.001 }; }, async url => url,
      async slots => { slotsSeen.push(slots); return { urls: ["data:image/png;base64,sprite"], mode: "sprite", subjects: slots.map(s => ({ displayName: s.displayName, kind: s.kind || "character" })) }; });
    expect(jobs.length).toBe(6);
    expect(jobs.every(j => j.references.length === 1)).toBe(true);
    expect(slotsSeen[0].map((s: any) => s.displayName)).toEqual(["Alexander", "Map"]);
    expect(jobs[0].prompt.startsWith(book.pages[0].illustration.scene)).toBe(true);
  });
  test("failed sprite preparation spends no image call", async () => {
    const fake = sequence([plan, book, review]); const result = await generateBook(brief, options(fake.transport));
    let calls = 0;
    const images = await illustrateBook(result, brief, async () => { calls++; return {}; }, async url => url, async () => { throw new Error("reference download failed"); });
    expect(calls).toBe(0); expect(images.every(i => !i.attempted && i.costUSD === 0)).toBe(true);
  });
  test("the Runware boundary rejects an accidental multi-reference request before fetch", async () => {
    let calls = 0;
    const provider = runwareProvider("test-key", (async () => { calls++; return new Response("{}"); }) as typeof fetch);
    await expect(provider({ taskId: "task", page: 1, prompt: "scene", references: ["https://example.com/a.png", "https://example.com/b.png"] })).rejects.toThrow("one combined reference");
    expect(calls).toBe(0);
  });
  test("paid placeholder and failed images keep their charge but never become artwork", async () => {
    for (const bad of [{ imageURL: "data:image/svg+xml;base64,PHN2Zz4=" }, { imageURL: "https://example.com/error.svg" }, { imageURL: "https://example.com/failure.webp", success: false }]) {
      const provider = runwareProvider("test-key", (async () => new Response(JSON.stringify({ data: [{ taskType: "imageInference", taskUUID: "task", cost: 0.001, ...bad }] }))) as typeof fetch);
      const result = await provider({ taskId: "task", page: 1, prompt: "scene", references: [] });
      expect(result.url).toBeUndefined(); expect(result.costUSD).toBe(0.001);
    }
  });
  test("billing summary preserves cost but strips images and signed URLs", () => {
    const summary: any = summarizeRunwareResponse({ data: [{ cost: 0.00151, imageURL: "private signed URL", imageBase64Data: "private image" }] });
    expect(summary.data).toEqual([{ cost: 0.00151 }]); expect(JSON.stringify(summary)).not.toContain("private");
    expect(summarizeRunwareResponse({ data: [{ cost: null }] }).costComplete).toBe(false);
  });
  test("parental filtering happens before review and images", () => {
    expect(checkManuscript(book, plan, { ...brief, blockedTerms: ["Ball"] })).toContain("Parental blocked term present");
  });
});
