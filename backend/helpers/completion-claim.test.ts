import { describe, expect, spyOn, test } from "bun:test";
import { runWithCompletionClaim } from "./completion-claim";

describe("runWithCompletionClaim", () => {
  test("applies a completion reward only once under concurrent requests", async () => {
    let claimed = false;
    let applyCount = 0;

    const run = () =>
      runWithCompletionClaim({
        claim: async () => {
          if (claimed) return false;
          claimed = true;
          return true;
        },
        apply: async () => {
          applyCount += 1;
          await Promise.resolve();
          return "rewarded";
        },
        release: async () => {
          claimed = false;
        },
      });

    const results = await Promise.all([run(), run(), run()]);

    expect(applyCount).toBe(1);
    expect(results.filter((result) => result.status === "applied")).toHaveLength(1);
    expect(results.filter((result) => result.status === "duplicate")).toHaveLength(2);
  });

  test("releases the claim when progression fails so a retry can succeed", async () => {
    let claimed = false;
    let attempts = 0;

    const run = () =>
      runWithCompletionClaim({
        claim: async () => {
          if (claimed) return false;
          claimed = true;
          return true;
        },
        apply: async () => {
          attempts += 1;
          if (attempts === 1) throw new Error("temporary failure");
          return "rewarded";
        },
        release: async () => {
          claimed = false;
        },
      });

    await expect(run()).rejects.toThrow("temporary failure");
    await expect(run()).resolves.toEqual({ status: "applied", value: "rewarded" });
    expect(attempts).toBe(2);
  });

  test("does not mask the progression error when releasing also fails", async () => {
    const errorLog = spyOn(console, "error").mockImplementation(() => undefined);
    await expect(
      runWithCompletionClaim({
        claim: async () => true,
        apply: async () => {
          throw new Error("progression failed");
        },
        release: async () => {
          throw new Error("release failed");
        },
      })
    ).rejects.toThrow("progression failed");

    expect(errorLog).toHaveBeenCalledTimes(1);
    errorLog.mockRestore();
  });
});
