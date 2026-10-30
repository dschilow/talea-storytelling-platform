// @ts-ignore Bun test helpers are runtime-only.
import { describe, expect, test } from "bun:test";
import { detectAvatarReferenceSubject, isPlushType } from "./avatar-reference-subject";
import { speciesFromProfile } from "../story/storybook/illustration-stage";
import { heroSheetEn } from "../story/storybook/oneshot-prompt-en";

const response = (subject: string) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ subject }) } }] }), { status: 200 });
describe("stuffed toy avatar references", () => {
  test("only a confident plush result changes the subject type", async () => {
    expect(await detectAvatarReferenceSubject("data:image/jpeg;base64,AA==", "key", (async () => response("plush")) as typeof fetch)).toBe("plush");
    expect(await detectAvatarReferenceSubject("photo", "key", (async () => response("other")) as typeof fetch)).toBe("other");
    expect(await detectAvatarReferenceSubject("photo", "key", (async () => response("unexpected")) as typeof fetch)).toBe("unknown");
    expect(await detectAvatarReferenceSubject("photo", "key", (async () => { throw new Error("offline"); }) as typeof fetch)).toBe("unknown");
  });
  test("toy identity survives into story direction and is not human anatomy", () => {
    const hero = { id: "a", name: "Teddy", visualProfile: { characterType: "stuffed toy", speciesCategory: "object" } };
    expect(isPlushType("Kuscheltier")).toBe(true);
    expect(isPlushType("human child")).toBe(false);
    expect(speciesFromProfile(hero.visualProfile).isHuman).toBe(false);
    expect(heroSheetEn(hero, [])).toContain("stuffed toy companion");
  });
});
