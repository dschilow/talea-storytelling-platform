// @ts-nocheck
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const backendRoot = path.resolve(import.meta.dir, "..");

function source(relativePath: string): string {
  return readFileSync(path.join(backendRoot, relativePath), "utf8");
}

function routeOptions(relativePath: string, route: string): string {
  const line = source(relativePath)
    .split(String.fromCharCode(10))
    .find((candidate) => candidate.includes('path: "' + route + '"'));
  if (!line) throw new Error("Route not found: " + relativePath + " " + route);
  return line;
}

describe("security regression guards", () => {
  test("costly public endpoints require authentication", () => {
    const routes: Array<[string, string]> = [
      ["ai/avatar-generation.ts", "/ai/generate-avatar"],
      ["ai/analyze-avatar.ts", "/ai/analyze-avatar-image"],
      ["ai/analyze-personality.ts", "/ai/analyze-personality"],
      ["ai/generate-visual-profile.ts", "/ai/generate-visual-profile"],
      ["tavi/chat.ts", "/tavi/chat"],
      ["tts/tts.ts", "/tts/generate"],
      ["tts/tts.ts", "/tts/batch"],
      ["tts/tts.ts", "/tts/qwen/dialogue"],
      ["doku/audio-script.ts", "/doku/audio-script/topics"],
      ["doku/audio-script.ts", "/doku/audio-script/generate"],
      ["story/audio-cache.ts", "/story/pre-generate-audio"],
      ["doku/audio-doku.ts", "/audio-dokus/generate-cover"],
      ["avatar/cosmos-suggestions-api.ts", "/api/suggestions/refresh-one"],
    ];

    for (const [file, route] of routes) {
      expect(routeOptions(file, route)).toContain("auth: true");
    }
  });

  test("low-level bulk AI endpoints are internal only", () => {
    expect(routeOptions("ai/image-generation.ts", "/ai/generate-image")).toContain("expose: false");
    expect(routeOptions("ai/image-generation.ts", "/ai/generate-images-batch")).toContain("expose: false");
    expect(routeOptions("story/ai-generation.ts", "/ai/generate-story")).toContain("expose: false");
  });

  test("raw SQL and maintenance endpoints are not exposed", () => {
    const routes: Array<[string, string]> = [
      ["story/run-migration-sql.ts", "/story/run-migration-sql"],
      ["doku/run-migration-sql.ts", "/doku/run-migration-sql"],
      ["avatar/run-migration-sql.ts", "/avatar/run-migration-sql"],
      ["health/run-migrations.ts", "/health/run-migrations"],
      ["health/complete-fairy-tales-setup.ts", "/health/complete-fairy-tales-setup"],
      ["health/import-150-fairy-tales.ts", "/health/import-150-fairy-tales"],
    ];

    for (const [file, route] of routes) {
      expect(routeOptions(file, route)).toContain("expose: false");
    }
  });

  test("normal users cannot choose subscription or role", () => {
    const profile = source("user/profile.ts");
    const requestStart = profile.indexOf("interface CreateUserRequest");
    const requestEnd = profile.indexOf("interface GetUserParams", requestStart);
    const requestBlock = profile.slice(requestStart, requestEnd);
    expect(requestBlock).not.toContain("subscription");
    expect(requestBlock).not.toContain("role");
    expect(routeOptions("user/profile.ts", "/user")).toContain("auth: true");
    expect(routeOptions("user/profile.ts", "/user/:id")).toContain("auth: true");
    expect(profile).not.toContain("req.subscription");
    expect(profile).not.toContain("req.role");
  });

  test("secondary AI and diagnostic paths are guarded", () => {
    expect(source("avatar/cosmos-suggestions-api.ts")).toContain("claimMeteredUsage");
    expect(source("doku/audio-doku.ts")).toContain("claimMeteredUsage");
    expect(source("log/debug.ts")).toContain("ensureAdmin()");
    expect(source("story/analyze-phase-logs.ts")).toContain("ensureAdmin()");
  });

  test("all paid quotas remain finite and metered updates are atomic", () => {
    const billing = source("helpers/billing.ts");
    expect(billing).toContain("premium: { stories: 50, dokus: 50, audio: 30 }");
    expect(billing).toContain("premium: { chat: 3_000, image: 500, tts: 1_500_000 }");
    expect(billing).toContain("AND units + ${units} <= ${limit}");
  });
});