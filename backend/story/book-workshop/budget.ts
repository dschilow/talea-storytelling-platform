import type { ModelPrice, StageReceipt } from "./types";

export class BudgetExceeded extends Error {}
export const roundUSD = (value: number): number => Math.round(value * 1e9) / 1e9;
export function validCost(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
export function tokenCost(price: ModelPrice, input: number, output: number): number {
  return roundUSD((input * price.inputPerMillion + output * price.outputPerMillion) / 1e6);
}
/** UTF-8 bytes are a deliberately conservative bound, not a token estimate.
 * Covers byte-token text models; chat framing gets a separate allowance.
 * Provider max_price + max_tokens enforce the same price/output ceilings.
 */
export function reserveCost(price: ModelPrice, system: string, user: string, maxTokens: number): number {
  return tokenCost(price, Buffer.byteLength(system + user, "utf8") + 256, maxTokens);
}
export class TextBudget {
  readonly receipts: StageReceipt[] = [];
  constructor(readonly limitUSD = 0.03, readonly maxCalls = 5) {
    if (!Number.isFinite(limitUSD) || limitUSD <= 0) throw new Error("Invalid text budget");
    if (!Number.isInteger(maxCalls) || maxCalls < 1) throw new Error("Invalid call budget");
  }
  get spent(): number { return roundUSD(this.receipts.reduce((sum, r) => sum + r.costUSD, 0)); }
  total(source: StageReceipt["costSource"]): number {
    return roundUSD(this.receipts.filter(r => r.costSource === source).reduce((sum, r) => sum + r.costUSD, 0));
  }
  assertFits(reservation: number, calls = 1): void {
    if (!Number.isInteger(calls) || calls < 1 || !validCost(reservation) || this.receipts.length + calls > this.maxCalls || this.spent + reservation > this.limitUSD + 1e-9) {
      throw new BudgetExceeded("Text budget cannot cover the next complete stage.");
    }
  }
  record(receipt: StageReceipt): void { this.receipts.push(receipt); }
  get complete(): boolean { return this.receipts.every(r => r.costSource === "provider"); }
}
