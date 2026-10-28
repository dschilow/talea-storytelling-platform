// @ts-ignore Bun's test helpers are runtime-only in the Encore project.
import { describe, expect, test } from "bun:test";
import { avatarImageProxyUrl, keyFromOwnImageProxy } from "./avatar-image-url";
import { spawnSync } from "node:child_process";

describe("avatar image persistence", () => {
  test("the same stored picture has a stable URL, and replacing it produces a fresh browser cache key", () => {
    const base = "https://talea.example";
    const first = avatarImageProxyUrl(base, "avatar 1", "bucket://images/avatars/old.webp");
    expect(first).toContain("/story/image/avatar/avatar%201?v=");
    expect(avatarImageProxyUrl(base, "avatar 1", "bucket://images/avatars/old.webp")).toBe(first);
    expect(avatarImageProxyUrl(base, "avatar 1", "bucket://images/avatars/new.webp")).not.toBe(first);
    expect(first).not.toContain("old.webp");
  });

  test("a generated preview's own proxy URL resolves back to its storage key", () => {
    const base = "https://talea.example";
    expect(keyFromOwnImageProxy(`${base}/story/image?key=images%2Favatars%2Fnew.webp`, base)).toBe("images/avatars/new.webp");
    expect(keyFromOwnImageProxy("https://other.example/story/image?key=images%2Fa.webp", base)).toBeNull();
    expect(keyFromOwnImageProxy(`${base}/story/image/avatar/one?key=images%2Fa.webp`, base)).toBeNull();
    expect(keyFromOwnImageProxy(`${base}/story/image?key=..%2Fsecret`, base)).toBeNull();
    expect(keyFromOwnImageProxy(`${base}/story/image?key=images%5Csecret`, base)).toBeNull();
    expect(keyFromOwnImageProxy("not a URL", base)).toBeNull();
  });

  test("the update storage normalizer persists the preview as a bucket URL", () => {
    // Isolate the fake bucket configuration and Encore secret stub from other tests.
    const source = `
      import { mock } from "bun:test";
      mock.module("encore.dev/config", () => ({ secret: () => () => undefined }));
      Object.assign(process.env, { BUCKET_ENDPOINT: "https://storage.example.test", BUCKET_NAME: "test-bucket", BUCKET_ACCESS_KEY_ID: "test-id", BUCKET_SECRET_ACCESS_KEY: "test-secret", BUCKET_ACCESS_MODE: "private", IMAGE_PROXY_BASE_URL: "https://backend.example.test" });
      const { normalizeImageUrlForStorage, resolveImageUrlForProxyAccess } = await import(${JSON.stringify(new URL("./bucket-storage.ts", import.meta.url).href)});
      const image = await normalizeImageUrlForStorage("https://backend.example.test/story/image?key=images%2Favatars%2Fportrait.webp");
      if (image !== "bucket://test-bucket/images/avatars/portrait.webp") throw new Error("Preview did not resolve to its bucket key");
      const other = "https://other.example/story/image?key=images%2Favatars%2Fportrait.webp";
      if (await normalizeImageUrlForStorage(other) !== other) throw new Error("Foreign proxy was treated as our bucket");
      // Server-side generation must bypass the public proxy (f346d2d6: HTTP 500 for both avatars).
      const stored = "bucket://test-bucket/images/avatars/portrait.webp";
      for (const source of [stored, "https://backend.example.test/story/image?key=images%2Favatars%2Fportrait.webp"]) {
        const direct = new URL(await resolveImageUrlForProxyAccess(source));
        if (direct.hostname === "backend.example.test" || !direct.pathname.endsWith("/images/avatars/portrait.webp") || !direct.searchParams.has("X-Amz-Signature")) throw new Error("Generation still uses the public proxy instead of a signed storage URL");
      }
      if (await resolveImageUrlForProxyAccess(other) !== other) throw new Error("Foreign proxy was treated as our bucket reference");
    `;
    const result = spawnSync(process.execPath, ["-e", source], { encoding: "utf8" });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });
});
