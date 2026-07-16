import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("story generation progression boundary", () => {
  test("generation never mutates avatar progression or read history", () => {
    const source = readFileSync(join(import.meta.dir, "generate.ts"), "utf8");

    expect(source).not.toContain("avatar.updatePersonality(");
    expect(source).not.toContain("avatar.addMemory(");
    expect(source).not.toContain("INSERT INTO avatar_story_read");
    expect(source).toContain("Avatar progression deferred until story completion");
  });
});
