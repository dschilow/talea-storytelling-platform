// @ts-ignore Bun's test runner is available without a production dependency.
import { describe, expect, test } from "bun:test";
import sharp from "sharp";
import { buildSceneIllustrationPrompt, createIdentityReferenceCache, paintOutMarks, renderIdentitySprite, usableMarks } from "./image-reference-sprite";

const source = (colour: string, width = 512, height = 512) => sharp({ create: { width, height, channels: 3, background: colour } }).png().toBuffer();
const pixels = async (buffer: Buffer) => sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const pixel = (r: Awaited<ReturnType<typeof pixels>>, x: number, y: number) => [...r.data.subarray((y * r.info.width + x) * 3, (y * r.info.width + x) * 3 + 3)];
const fromReference = (url: string) => Buffer.from(url.split(",")[1], "base64");

describe("single reference sprite without injected picture frames", () => {
  test("a temporary download failure does not poison later sheets or shift their identity slots", async () => {
    const buffers = [await source('#222222'), await source('#bbbbbb')];
    let firstCalls = 0, secondCalls = 0;
    const build = createIdentityReferenceCache((async url => {
      if (String(url).endsWith('a.png')) {
        if (++firstCalls === 1) return new Response('', { status: 503 });
        return new Response(new Uint8Array(buffers[0]));
      }
      secondCalls++;
      return new Response(new Uint8Array(buffers[1]));
    }) as typeof fetch);
    const slots = [{ displayName: 'First', imageUrl: 'https://example.com/a.png' }, { displayName: 'Second', imageUrl: 'https://example.com/b.png' }];
    await expect(build(slots)).rejects.toThrow('503');
    const repaired = await build(slots);
    expect(repaired.subjects.map(s => s.displayName)).toEqual(['First', 'Second']);
    expect(repaired.urls).toHaveLength(1);
    expect(firstCalls).toBe(2);
    expect(secondCalls).toBe(1);
    expect((await build(slots)).urls[0]).toBe(repaired.urls[0]);
  });
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
    // The provider copy is JPEG (see encodeReferenceSprite): colours survive within ±2.
    for (const channel of pixel(await pixels(fromReference(reversed.urls[0])), 0, 0)) expect(Math.abs(channel - 187)).toBeLessThanOrEqual(2);
    expect(reversed.urls[0].startsWith("data:image/jpeg;base64,")).toBe(true);
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

  test("a single subject travels inline at 512 px; an unreachable one keeps its URL", async () => {
    const image = await source("#dddddd");
    let calls = 0;
    const build = createIdentityReferenceCache((async () => { calls++; return new Response(new Uint8Array(image)); }) as typeof fetch);
    const single = await build([{ displayName: "Alexander", imageUrl: "https://example.com/a.png" }]);
    expect(single.mode).toBe("single");
    expect(single.urls[0]).toStartWith("data:image/jpeg;base64,");
    const meta = await sharp(Buffer.from(single.urls[0].split(",")[1], "base64")).metadata();
    expect([meta.width, meta.height]).toEqual([512, 512]);
    expect(calls).toBe(1);
    const offline = createIdentityReferenceCache((async () => { throw new Error("proxy down"); }) as typeof fetch);
    expect((await offline([{ displayName: "Alexander", imageUrl: "https://example.com/a.png" }])).urls).toEqual(["https://example.com/a.png"]);
    expect((await build([])).urls).toEqual([]);
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

describe("story 26fdd23f: a logo on a hero's shirt", () => {
  // A navy shirt with a pale logo in the middle, as on Adrian's avatar.
  const shirt = async () => sharp(await source("#2b3a55", 200, 200)).composite([{ input: await source("#e8d9a0", 20, 12), left: 90, top: 94 }]).png().toBuffer();

  test("the mark is painted in the fabric's colour, the rest of the portrait stays", async () => {
    const before = await pixels(await shirt());
    expect(pixel(before, 100, 100)).toEqual([232, 217, 160]);
    const after = await pixels(await paintOutMarks(await shirt(), [[440, 460, 560, 540]]));
    const [r, g, b] = pixel(after, 100, 100);
    expect(Math.abs(r - 43) + Math.abs(g - 58) + Math.abs(b - 85)).toBeLessThan(12);
    expect(pixel(after, 5, 5)).toEqual([43, 58, 85]);
  });

  test("boxes out of range, inverted or over most of the portrait are never painted", () => {
    expect(usableMarks([[440, 460, 560, 540], [0, 0, 900, 900], [600, 600, 500, 700], [-5, 0, 10, 10], "x", [1, 2, 3]])).toEqual([[440, 460, 560, 540]]);
    expect(usableMarks(undefined)).toEqual([]);
  });

  test("the sheet carries the painted portrait, for a sprite and for a single inline portrait", async () => {
    const url = `data:image/png;base64,${(await shirt()).toString("base64")}`;
    const build = createIdentityReferenceCache(async () => new Response(await shirt()));
    const single = await pixels(fromReference((await build([{ displayName: "Adrian", imageUrl: url, marks: [[440, 460, 560, 540]] }])).urls[0]));
    expect(single.info.width).toBe(512);
    const [r] = pixel(single, 256, 256);
    expect(r).toBeLessThan(90);
    const sprite = await pixels(fromReference((await build([
      { displayName: "Adrian", imageUrl: "https://example.test/adrian.png", marks: [[440, 460, 560, 540]] },
      { displayName: "Alexander", imageUrl: "https://example.test/alexander.png" },
    ])).urls[0]));
    expect(pixel(sprite, 256, 256)[0]).toBeLessThan(90);
    expect(pixel(sprite, 768, 256)[0]).toBeGreaterThan(180);
  });
});
