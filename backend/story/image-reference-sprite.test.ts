// @ts-ignore Bun's test runner is available without a production dependency.
import { describe, expect, test } from "bun:test";
import sharp from "sharp";
import { buildSceneIllustrationPrompt, createIdentityReferenceCache, renderIdentitySprite } from "./image-reference-sprite";

const source = (colour: string, width = 512, height = 512) => sharp({ create: { width, height, channels: 3, background: colour } }).png().toBuffer();
const pixels = async (buffer: Buffer) => sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const pixel = (r: Awaited<ReturnType<typeof pixels>>, x: number, y: number) => [...r.data.subarray((y * r.info.width + x) * 3, (y * r.info.width + x) * 3 + 3)];
const fromReference = (url: string) => Buffer.from(url.split(",")[1], "base64");

describe("single reference sprite without injected picture frames", () => {
  test("source pixels extend to every tile edge, without coloured borders or gutters", async () => {
    const result = await pixels(await renderIdentitySprite([await source("#222222"), await source("#bbbbbb")]));
    expect([result.info.width, result.info.height]).toEqual([1024, 512]);
    for (const [x, y] of [[0, 0], [511, 0], [0, 511], [511, 511]]) expect(pixel(result, x, y)).toEqual([34, 34, 34]);
    for (const [x, y] of [[512, 0], [1023, 0], [512, 511], [1023, 511]]) expect(pixel(result, x, y)).toEqual([187, 187, 187]);
  });

  test("tall references preserve the top and bottom instead of cropping them away", async () => {
    const tall = await sharp(await source("#eeeeee", 128, 256)).composite([
      { input: await source("#222222", 128, 16), left: 0, top: 0 },
      { input: await source("#777777", 128, 16), left: 0, top: 240 },
    ]).png().toBuffer();
    const result = await pixels(await renderIdentitySprite([tall, await source("white")]));
    expect(pixel(result, 256, 1)).toEqual([34, 34, 34]);
    expect(pixel(result, 256, 510)).toEqual([119, 119, 119]);
    expect(pixel(result, 0, 256)).toEqual([255, 255, 255]);
  });

  test("concurrent pages reuse one sprite, with exactly one provider attachment", async () => {
    let calls = 0;
    const sources = [await source("#222222"), await source("#bbbbbb")];
    const build = createIdentityReferenceCache((async url => { calls++; return new Response(new Uint8Array(sources[String(url).endsWith("a.png") ? 0 : 1])); }) as typeof fetch);
    const slots = [{ displayName: "Alexander", imageUrl: "https://example.com/a.png" }, { displayName: "Adrian", imageUrl: "https://example.com/b.png" }];
    const [a, b] = await Promise.all([build(slots), build(slots)]);
    expect(a).toBe(b); expect(calls).toBe(2); expect(a.urls.length).toBe(1); expect(a.mode).toBe("sprite");
    expect(a.subjects.map(s => s.displayName)).toEqual(["Alexander", "Adrian"]);
    const reversed = await build([...slots].reverse());
    expect(calls).toBe(2);
    expect(reversed.subjects.map(s => s.displayName)).toEqual(["Adrian", "Alexander"]);
    expect(pixel(await pixels(fromReference(reversed.urls[0])), 0, 0)).toEqual([187, 187, 187]);
  });

  test("four avatars and an artifact all fit within one bounded reference", async () => {
    const image = await source("#eeeeee");
    const build = createIdentityReferenceCache((async () => new Response(new Uint8Array(image))) as typeof fetch);
    const slots = Array.from({ length: 4 }, (_, i) => ({ displayName: `Hero ${i + 1}`, imageUrl: `https://example.com/${i}.png` }));
    const result = await build([...slots, { displayName: "Compass", imageUrl: "https://example.com/compass.png", kind: "artifact" }]);
    expect(result.urls.length).toBe(1); expect(result.subjects.length).toBe(5);
    expect(result.subjects[4]).toEqual({ displayName: "Compass", kind: "artifact" });
    expect((await sharp(fromReference(result.urls[0])).metadata()).width).toBeLessThanOrEqual(2048);
  });

  test("a broken middle entry does not silently shift identity positions", async () => {
    const image = await source("#eeeeee");
    const build = createIdentityReferenceCache((async url => String(url).includes("broken") ? new Response("unavailable", { status: 403 }) : new Response(new Uint8Array(image))) as typeof fetch);
    await expect(build([
      { displayName: "Alexander", imageUrl: "https://example.com/a.png" },
      { displayName: "Adrian", imageUrl: "https://example.com/broken.png" },
      { displayName: "Wilhelm", imageUrl: "https://example.com/c.png" },
    ])).rejects.toThrow("403");
  });

  test("a single subject needs neither collage rendering nor a second input", async () => {
    let calls = 0;
    const build = createIdentityReferenceCache((async () => { calls++; throw new Error("Unexpected fetch"); }) as typeof fetch);
    expect((await build([{ displayName: "Alexander", imageUrl: "https://example.com/a.png" }])).urls).toEqual(["https://example.com/a.png"]);
    expect((await build([])).urls).toEqual([]); expect(calls).toBe(0);
    await expect(build([{ displayName: "Alexander", imageUrl: "bucket://private/a.png" }])).rejects.toThrow("provider-readable");
  });

  test("the scene leads, while identities use positions instead of frame colours", () => {
    const scene = "Alexander and Adrian pull a sled along the snowy path.";
    const prompt = buildSceneIllustrationPrompt(scene, "Watercolor and coloured pencil.", {
      mode: "sprite", urls: ["https://example.com/sprite.png"], subjects: [
        { displayName: "Alexander", kind: "character" }, { displayName: "Adrian", kind: "character" }, { displayName: "Wilhelm", kind: "character" },
      ],
    }, ["Alexander", "Adrian"]);
    expect(prompt.startsWith(scene)).toBe(true);
    expect(prompt).toContain("LEFT TO RIGHT");
    expect(prompt).toContain("1: Alexander"); expect(prompt).toContain("2: Adrian");
    expect(prompt).toContain("exactly these characters in the scene: Alexander, Adrian.");
    expect(prompt).not.toMatch(/framed portraits|purple frame|green frame|#[0-9A-F]{6}/i);
  });
});
