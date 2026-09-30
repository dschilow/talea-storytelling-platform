import { describe, expect, test } from "bun:test";
import path from "node:path";

import * as backend from "./plan-catalog";

// Loaded at runtime: a static import would pull a frontend file into the
// backend TypeScript project (and the Encore build).
const frontend: any = await import(
  path.resolve(import.meta.dir, "../../frontend/constants/planCatalog.ts")
);

const PLANS = ["free", "starter", "familie", "premium"] as const;

describe("plan catalog", () => {
  test("frontend mirror matches the enforced backend limits", () => {
    expect(frontend.PLAN_QUOTAS).toEqual(backend.PLAN_QUOTAS);
    expect(frontend.FREE_TRIAL_QUOTAS).toEqual(backend.FREE_TRIAL_QUOTAS);
    expect(frontend.PLAN_DAILY_LIMITS).toEqual(backend.PLAN_DAILY_LIMITS);
    expect(frontend.PLAN_PROFILE_LIMITS).toEqual(backend.BASE_PROFILE_LIMITS);
    expect(frontend.PLAN_AUDIO_LIBRARY_ACCESS).toEqual(backend.PLAN_AUDIO_LIBRARY_ACCESS);
    expect(frontend.PLAN_TAVI_CAN_CREATE).toEqual(backend.PLAN_TAVI_CAN_CREATE);
    expect(frontend.AUDIO_BASIC_LIBRARY_MIN_AGE_DAYS).toBe(backend.AUDIO_BASIC_LIBRARY_MIN_AGE_DAYS);
    expect(frontend.PLAN_OFFLINE_LIMITS).toEqual(backend.PLAN_OFFLINE_LIMITS);
    expect(frontend.OFFLINE_LICENSE_MAX_DAYS).toBe(backend.OFFLINE_LICENSE_MAX_DAYS);
    expect(frontend.FREE_TRIAL_DAYS).toBe(backend.FREE_TRIAL_DAYS);
    expect(frontend.FREE_TRIAL_TAVI_MESSAGES).toBe(backend.FREE_TRIAL_METERED_QUOTAS.chat);
    for (const plan of PLANS) {
      expect(frontend.PLAN_TAVI_MESSAGES[plan]).toBe(backend.PLAN_METERED_QUOTAS[plan].chat);
      expect(frontend.PLAN_IMAGES[plan]).toBe(backend.PLAN_METERED_QUOTAS[plan].image);
    }
  });

  test("every paid limit is finite and grows with the plan", () => {
    const paid = ["starter", "familie", "premium"] as const;
    for (let i = 1; i < paid.length; i++) {
      const lower = paid[i - 1];
      const higher = paid[i];
      expect(backend.PLAN_QUOTAS[higher].stories!).toBeGreaterThan(backend.PLAN_QUOTAS[lower].stories!);
      expect(backend.PLAN_DAILY_LIMITS[higher].stories).toBeGreaterThanOrEqual(backend.PLAN_DAILY_LIMITS[lower].stories);
      for (const kind of ["chat", "assist", "image", "tts"] as const) {
        expect(Number.isFinite(backend.PLAN_METERED_QUOTAS[higher][kind])).toBe(true);
        expect(backend.PLAN_METERED_QUOTAS[higher][kind]).toBeGreaterThanOrEqual(backend.PLAN_METERED_QUOTAS[lower][kind]);
      }
    }
  });

  test("the daily limit never exceeds the monthly coins", () => {
    for (const plan of PLANS) {
      expect(backend.PLAN_DAILY_LIMITS[plan].stories).toBeLessThanOrEqual(backend.PLAN_QUOTAS[plan].stories!);
      expect(backend.PLAN_DAILY_LIMITS[plan].dokus).toBeLessThanOrEqual(backend.PLAN_QUOTAS[plan].dokus!);
    }
  });

  test("free accounts cannot let Tavi create content", () => {
    expect(backend.PLAN_TAVI_CAN_CREATE.free).toBe(false);
  });

  test("yearly prices are cheaper than twelve monthly payments", () => {
    for (const plan of ["starter", "familie", "premium"] as const) {
      const { monthly, yearly } = frontend.PLAN_PRICES[plan];
      expect(yearly).not.toBeNull();
      expect(yearly!).toBeLessThan(monthly * 12);
      expect(frontend.yearlySavingMonths(plan)).toBe(4);
    }
  });
});
