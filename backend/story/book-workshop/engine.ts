import { createHash } from "node:crypto";
import { reserveCost, roundUSD, TextBudget, tokenCost, validCost } from "./budget";
import { checkManuscript, checkPlan, checkReview, ContractOutputError, normalizeIllustrationMetadata, normalizePlanMetadata, parseContract, providerSchema, readingBudget } from "./contracts";
import { manuscriptPrompt, planPrompt, reviewPrompt } from "./prompts";
import { recoverableStageError, transientGenerationError } from "./recovery";
import type { BookBrief, BookPlan, BookResult, BookReview, Manuscript, ModelPrice, StageReceipt, Transport } from "./types";

export interface EngineOptions {
  writer: string;
  reviewer: string;
  prices: Record<string, ModelPrice>;
  transport: Transport;
  textBudgetUSD?: number;
  timeoutMs?: number;
  maxCalls?: number;
  maxRecoveryAttempts?: number;
  recoveryDelayMs?: number;
  /** Persist valid intermediate output before moving on to another paid stage. */
  onCheckpoint?: (result: BookResult) => Promise<void>;
  /** Called even for malformed, truncated and uncertain billed attempts. */
  onReceipt?: (receipt: StageReceipt) => void | Promise<void>;
}
export const manuscriptHash = (book: Manuscript): string => createHash("sha256").update(JSON.stringify(book)).digest("hex");

export async function generateBook(brief: BookBrief, options: EngineOptions): Promise<BookResult> {
  const ledger = new TextBudget(options.textBudgetUSD ?? 0.03, options.maxCalls ?? 7);
  const recoveryLimit = options.maxRecoveryAttempts ?? 2;
  if (!Number.isInteger(recoveryLimit) || recoveryLimit < 0 || recoveryLimit > 2) throw new Error("Invalid recovery limit");
  let recoveryAttempts = 0;
  const result: BookResult = { pipeline: "book-workshop-v1", status: "rejected", issues: [], receipts: ledger.receipts, textCostUSD: 0,
    providerTextCostUSD: 0, estimatedTextCostUSD: 0, reservedUnknownUSD: 0, budgetCommittedUSD: 0, accountingComplete: true };
  const finish = () => {
    result.providerTextCostUSD = ledger.total("provider");
    result.estimatedTextCostUSD = ledger.total("estimate");
    result.reservedUnknownUSD = ledger.total("reserved-unknown");
    result.textCostUSD = roundUSD(result.providerTextCostUSD + result.estimatedTextCostUSD);
    result.budgetCommittedUSD = ledger.spent;
    result.accountingComplete = ledger.complete;
    return result;
  };
  if (!brief.heroes.length || new Set(brief.heroes.map(h => h.id)).size !== brief.heroes.length) {
    result.issues = ["Missing or duplicate hero IDs"]; return finish();
  }
  if (options.writer === options.reviewer) { result.issues = ["Writer and reviewer must be different models"]; return finish(); }

  const completeAttempt = async <T>(stage: string, model: string, prompt: { system: string; user: string }, maxTokens: number, kind: "plan" | "manuscript" | "review"): Promise<T> => {
    const price = options.prices[model];
    if (!price || !validCost(price.inputPerMillion) || !validCost(price.outputPerMillion)) throw new Error(`No verified price for ${model}`);
    const jsonSchema = { name: `book_${kind}`, schema: providerSchema(kind) };
    const reserved = reserveCost(price, prompt.system + JSON.stringify(jsonSchema), prompt.user, maxTokens);
    ledger.assertFits(reserved);
    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 150_000);
    let receipt: StageReceipt | undefined;
    try {
      const call = await options.transport({ model, price, ...prompt, jsonSchema, maxTokens, signal: controller.signal });
      const knownTokens = Number.isSafeInteger(call.promptTokens) && call.promptTokens >= 0 && Number.isSafeInteger(call.completionTokens) && call.completionTokens >= 0;
      receipt = {
        stage, model: call.model, promptTokens: knownTokens ? call.promptTokens : 0, completionTokens: knownTokens ? call.completionTokens : 0,
        costUSD: validCost(call.costUSD) ? call.costUSD : knownTokens ? tokenCost(price, call.promptTokens, call.completionTokens) : reserved,
        costSource: validCost(call.costUSD) ? "provider" : knownTokens ? "estimate" : "reserved-unknown", status: "received", durationMs: Date.now() - start,
      };
      // Record before parsing; invalid content still costs money.
      ledger.record(receipt);
      if (ledger.spent > ledger.limitUSD) throw new Error("Provider charge exceeded the reserved budget");
      if (call.finishReason === "length") throw new ContractOutputError(`Incomplete ${stage} (length)`);
      if (!["stop", "end_turn"].includes(call.finishReason)) throw new Error(`Incomplete ${stage} (${call.finishReason})`);
      return parseContract<T>(kind, call.text);
    } catch (error) {
      if (!receipt) {
        receipt = { stage, model, promptTokens: 0, completionTokens: 0, costUSD: reserved, costSource: "reserved-unknown", status: "failed", durationMs: Date.now() - start };
        ledger.record(receipt);
      } else receipt.status = "failed";
      throw error;
    } finally {
      clearTimeout(timeout);
      if (receipt && options.onReceipt) {
        try { await options.onReceipt(receipt); } catch { /* Accounting observers cannot change the book. */ }
      }
    }
  };

  const complete = async <T>(stage: string, model: string, prompt: { system: string; user: string }, maxTokens: number, kind: "plan" | "manuscript" | "review"): Promise<T> => {
    try { return await completeAttempt<T>(stage, model, prompt, maxTokens, kind); }
    catch (error) {
      if (recoveryAttempts >= recoveryLimit || !recoverableStageError(error, kind)) throw error;
      recoveryAttempts++;
      if (transientGenerationError(error)) {
        await new Promise(resolve => setTimeout(resolve, options.recoveryDelayMs ?? 1500 * recoveryAttempts));
      }
      // One retry per stage, two across the book. The failed attempt remains
      // charged/reserved in the ledger, including timeouts with unknown cost.
      return completeAttempt<T>(`${stage}-retry`, model, {
        ...prompt, system: prompt.system + "\nGib ein vollständiges JSON gemäß dem Schema aus. Keine Markdown-Hülle. Halte alle Textfelder knapp und die geforderte Wortspanne ein.",
      }, error instanceof ContractOutputError && error.message.includes("(length)") ? Math.ceil(maxTokens * 1.25) : maxTokens, kind);
    }
  };
  const checkpoint = async () => { if (options.onCheckpoint) await options.onCheckpoint(structuredClone(finish())); };

  try {
    const budget = readingBudget(brief);
    const planningPrompt = planPrompt(brief);
    const planTokens = 800 + budget.pages * 200 + brief.heroes.length * 100;
    let plan = normalizePlanMetadata(await complete<BookPlan>("plan", options.reviewer, planningPrompt, planTokens, "plan"), brief);
    // A wrong page count needs real planning, not duplicated or discarded beats.
    // One bounded correction only; it shares the five-call and dollar budget.
    if (plan.beats.length > 0 && plan.beats.length !== budget.pages) {
      plan = normalizePlanMetadata(await complete<BookPlan>("plan-repair", options.reviewer, {
        system: planningPrompt.system,
        user: JSON.stringify({ originalRequest: JSON.parse(planningPrompt.user), previousPlan: plan,
          defects: checkPlan(plan, brief), task: `Überarbeite den Plan zu genau ${budget.pages} zusammenhängenden Leseseiten. Keine Ereignisse bloß duplizieren. Gib den vollständigen Plan als JSON zurück.` }),
      }, planTokens, "plan"), brief);
    }
    result.plan = plan;
    result.issues = checkPlan(plan, brief);
    if (result.issues.length) return finish();
    await checkpoint();

    // Includes prose, JSON and small image briefs; no separate image-prompt LLM.
    // Include German prose, repeated UUIDs, JSON keys and English image briefs.
    // This is output headroom, not a request for longer prose or a higher bill.
    const writerTokens = Math.ceil(budget.maxWords * 4 + budget.pages * (160 + Math.min(4, brief.heroes.length + plan.castIds.length) * 40) + 512);
    let book = normalizeIllustrationMetadata(await complete<Manuscript>("manuscript", options.writer, manuscriptPrompt(brief, plan), writerTokens, "manuscript"), plan);
    result.manuscript = book;
    await checkpoint();
    let reviewRetried = false;
    const reviewTokens = 2800 + brief.heroes.length * 320;
    for (let version = 0; version < 2; version++) {
      const mechanical = checkManuscript(book, plan, brief);
      // A malformed shape was already rejected by the schema. Review content
      // even with a length defect so a repair receives all known problems.
      const reviewStage = version ? "review-revision" : "review";
      let review: BookReview;
      try {
        review = await complete<BookReview>(reviewStage, options.reviewer, reviewPrompt(brief, book), reviewTokens, "review");
      } catch (error) {
        // Re-read the SAME manuscript once after an invalid output, never turn
        // malformed scores/evidence into a passing judgement through coercion.
        if (!(error instanceof ContractOutputError) || reviewRetried) throw error;
        reviewRetried = true;
        const prompt = reviewPrompt(brief, book);
        review = await complete<BookReview>(`${reviewStage}-retry`, options.reviewer, {
          ...prompt, user: JSON.stringify({ ...JSON.parse(prompt.user), formatCorrection: error.message }),
        }, reviewTokens, "review");
      }
      result.review = review;
      result.manuscriptHash = manuscriptHash(book);
      result.issues = [...mechanical, ...checkReview(review, book, brief, plan)];
      // Humor is still revised once when requested. A subjective 3/5 humor
      // score alone must not discard an otherwise comprehensible, checked book.
      if (version > 0 && review.scores.humor >= 3) {
        result.editorialNotes = result.issues.filter(issue => issue === "Requested humor is not delivered");
        result.issues = result.issues.filter(issue => issue !== "Requested humor is not delivered");
      }
      await checkpoint();
      if (!result.issues.length) { result.status = "accepted"; return finish(); }
      if (version === 0) {
        // Forecast revision plus re-review using the current actual request.
        // The book is already included in reviewPrompt.user: adding it again
        // plus writerTokens * 8 was a fictitious second and third input bill.
        // Every later call still passes its own exact-input byte-bound check.
        const repairPrompt = manuscriptPrompt(brief, plan, { book, issues: result.issues });
        const writerPrice = options.prices[options.writer], reviewPrice = options.prices[options.reviewer];
        const currentReviewPrompt = reviewPrompt(brief, book);
        const reviewPromptBytes = Buffer.byteLength(currentReviewPrompt.system + currentReviewPrompt.user, "utf8");
        const reviewReserve = tokenCost(reviewPrice, reviewPromptBytes + Buffer.byteLength(JSON.stringify({ name: "book_review", schema: providerSchema("review") })) + 256, reviewTokens);
        ledger.assertFits(reserveCost(writerPrice, repairPrompt.system + JSON.stringify({ name: "book_manuscript", schema: providerSchema("manuscript") }), repairPrompt.user, writerTokens) + reviewReserve, 2);
        book = normalizeIllustrationMetadata(await complete<Manuscript>("revision", options.writer, repairPrompt, writerTokens, "manuscript"), plan);
        result.manuscript = book;
        // Old review must never certify a new version, even if re-review fails.
        result.review = undefined;
        result.manuscriptHash = undefined;
        await checkpoint();
      }
    }
  } catch (error) {
    result.issues = [...result.issues, error instanceof Error ? error.message : "Generation failed"];
  }
  return finish();
}
