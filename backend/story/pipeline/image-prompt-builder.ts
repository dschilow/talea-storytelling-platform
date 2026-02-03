import type { CastSet, ImageSpec } from "./types";

export function buildFinalPromptText(spec: ImageSpec, cast: CastSet, options?: { forceEnglish?: boolean }): string {
  const forceEnglish = options?.forceEnglish ?? false;
  const characterNames = spec.onStageExact
    .map(slot => findCharacterName(cast, slot))
    .filter(Boolean);
  const count = characterNames.length;
  const namesLine = characterNames.join(" + ");
  const characterDetails = spec.onStageExact
    .map(slot => buildCharacterDetail(cast, slot))
    .filter(Boolean);

  const refEntries = Object.entries(spec.refs || {});
  const isCollageMode = refEntries.length > 0 && refEntries.some(([key]) => key.startsWith("slot_"));

  const styleBlock = isCollageMode
    ? `STYLE: ${spec.style}, no text, no words, no watermark, no frames, no borders`
    : `STYLE: ${spec.style}, no text, no words, no watermark`;
  let refBlock = "";
  if (isCollageMode) {
    const slotLines = refEntries
      .map(([key, value]) => {
        const slotNum = key.replace("slot_", "");
        return `Slot-${slotNum} = ${value}.`;
      })
      .join("\n");
    refBlock = [
      `REFERENCE IMAGE (IDENTITY ONLY): one combined reference image with ${refEntries.length} faces, ordered LEFT to RIGHT for identity matching only.`,
      slotLines,
      `Use the reference ONLY for identity. Ignore the strip layout entirely.`,
      `Do NOT copy the strip composition. Do NOT make a collage, panels, split-screen, or multi-image layout.`,
      `Any colored guides in the reference are identification markers only — do NOT reproduce guides, shapes, halos, badges, boxes, outlines, or overlays.`,
    ].join("\n");
  } else if (refEntries.length > 0) {
    const refLines = refEntries.map(([key, value]) => `${key} = ${value}`).join("\n");
    refBlock = `REFERENCE IMAGES (IDENTITY ONLY):\n${refLines}\nUse each reference image ONLY for face identity. Ignore backgrounds.`;
  }

  const hasBird = containsBirdToken([spec.actions, spec.blocking, ...(spec.propsVisible || [])].join(" "));
  const shotLabel = count >= 3 ? "wide shot" : "medium-wide shot";
  const normalizedComposition = normalizeComposition(spec.composition, count);
  const blockingText = isCollageMode ? "" : (spec.blocking || "").trim();
  const lightingText = (spec.lighting || "").trim();

  const nonHumanInfo = classifyNonHumans(cast, spec.onStageExact);
  const humanCount = Math.max(0, count - nonHumanInfo.nonHumanNames.length);

  // Constraints with explicit action/gaze directions
  const identityLock = refEntries.length > 0
    ? isCollageMode
      ? "- Do NOT swap identities; each character MUST match their slot identity from the reference strip"
      : "- Do NOT swap identities; match each character to its reference image"
    : "";

  const nonHumanRule = nonHumanInfo.nonHumanNames.length > 0
    ? `- NON-HUMAN RULE: ${nonHumanInfo.nonHumanNames.join(", ")} must remain non-human characters; full body on the ground with non-human anatomy (e.g., frog legs/hands). No human body, no upright human stance, no human clothing.`
    : "";

  const constraints = [
    "ABSOLUTE HARD RULES (MUST FOLLOW):",
    `- EXACTLY ${formatCountWord(count)} character${count !== 1 ? "s" : ""} total: ${namesLine}`,
    nonHumanInfo.nonHumanNames.length > 0
      ? `- EXACTLY ${humanCount} human${humanCount !== 1 ? "s" : ""} + ${nonHumanInfo.nonHumanNames.length} non-human${nonHumanInfo.nonHumanNames.length !== 1 ? "s" : ""}`
      : "",
    "- EACH character appears EXACTLY ONCE (no duplicates, twins, clones)",
    "- NO other people anywhere (no background people, silhouettes, reflections, faces in posters/paintings)",
    `- FULL body visible head-to-toe for all (feet visible), ${shotLabel}`,
    "- No cropping or occlusion; no one hidden behind objects or other characters",
    "- Characters interact with each other or props; NOT looking at camera",
    "- Single continuous scene; no panels, split-screen, collage, or multi-image layout",
    "- No written text or typography; no watermarks or logos",
    hasBird ? "- EXACTLY 1 bird total (if present), no other animals" : "- No extra animals",
    identityLock,
    nonHumanRule,
  ]
    .filter(Boolean)
    .join("\n");

  const settingValue = (spec.setting || "").trim();
  const settingBlock = `SETTING (ONE): ${settingValue || "story setting"}. Use only this location.`;

  const sceneBlock = `SHOT / COMPOSITION: ${normalizedComposition}${blockingText ? `. ${blockingText}` : ""}${lightingText ? `. Lighting: ${lightingText}` : ""}`;

  const stagingLine = count > 1 ? buildStagingLine(namesLine, refEntries, isCollageMode) : "";
  const actionText = mergeActionText(spec.sceneDescription, spec.actions) || "Characters act together in a dynamic moment.";
  const propsText = (spec.propsVisible || []).filter(Boolean).join(", ");
  const actionBlock = `ACTION (DO NOT SWAP): ${stagingLine ? `${stagingLine}. ` : ""}${actionText}${propsText ? ` Key props: ${propsText}.` : ""}`;

  const characterBlock = refEntries.length === 0 && characterDetails.length > 0
    ? `CHARACTER DETAILS: ${characterDetails.join("; ")}`
    : "";

  const languageGuard = forceEnglish
    ? "LANGUAGE: English only. Translate any non-English words before rendering."
    : "";

  const negativeBlock = `NEGATIVE (VERY STRONG): ${buildNegativeList({
    hasBird,
    nonHumanKinds: nonHumanInfo.nonHumanKinds,
  }).join(", ")}`;

  const combined = [styleBlock, refBlock, constraints, settingBlock, sceneBlock, actionBlock, characterBlock, languageGuard, negativeBlock]
    .filter(Boolean)
    .join("\n\n");

  return sanitizeForbiddenTerms(combined);
}

function findCharacterName(cast: CastSet, slotKey: string): string | null {
  const sheet = cast.avatars.find(a => a.slotKey === slotKey) || cast.poolCharacters.find(c => c.slotKey === slotKey);
  return sheet?.displayName ?? null;
}

function buildCharacterDetail(cast: CastSet, slotKey: string): string | null {
  const sheet = cast.avatars.find(a => a.slotKey === slotKey) || cast.poolCharacters.find(c => c.slotKey === slotKey);
  if (!sheet) return null;
  const items = [
    ...(sheet.visualSignature || []),
    ...(sheet.outfitLock || []),
    ...(sheet.faceLock || []),
  ].filter(Boolean);
  const unique = Array.from(new Set(items)).slice(0, 3);
  const detail = unique.length > 0 ? unique.join(", ") : "distinct appearance";
  return `${sheet.displayName}: ${detail}`;
}

function containsBirdToken(text: string): boolean {
  const value = text.toLowerCase();
  return ["bird", "sparrow", "spatz", "vogel"].some(token => value.includes(token));
}

function sanitizeForbiddenTerms(text: string): string {
  if (!text) return text;
  const forbidden = ["portrait", "selfie", "close-up", "closeup"];
  const lines = text.split("\n");
  const sanitized = lines.map((line) => {
    if (line.trimStart().startsWith("NEGATIVE")) return line;
    let result = line;
    for (const word of forbidden) {
      const regex = new RegExp(word, "gi");
      result = result.replace(regex, "medium shot");
    }
    return result;
  });
  return sanitized.join("\n");
}

function formatCountWord(count: number): string {
  if (count === 1) return "ONE";
  if (count === 2) return "TWO";
  if (count === 3) return "THREE";
  if (count === 4) return "FOUR";
  return String(count);
}

function normalizeComposition(composition: string, count: number): string {
  let result = (composition || "").trim();
  if (!result) {
    result = count >= 3 ? "wide shot, eye-level" : "medium-wide shot, eye-level";
  }
  if (count >= 3 && !result.toLowerCase().includes("wide")) {
    result = "wide shot, eye-level";
  }
  if (!result.toLowerCase().includes("full body") && !result.toLowerCase().includes("head-to-toe")) {
    result += ", full body visible head-to-toe";
  }
  return result;
}

function buildStagingLine(namesLine: string, refEntries: Array<[string, string]>, isCollageMode: boolean): string {
  if (!isCollageMode) return `LEFT-TO-RIGHT: ${namesLine}`;
  const slotEntries = refEntries
    .filter(([key]) => key.startsWith("slot_"))
    .sort((a, b) => Number(a[0].replace("slot_", "")) - Number(b[0].replace("slot_", "")));
  if (slotEntries.length === 0) return `LEFT-TO-RIGHT: ${namesLine}`;
  const parts = slotEntries.map(([key, value]) => {
    const slotNum = key.replace("slot_", "");
    const name = extractRefName(value);
    return `Slot-${slotNum} ${name}`;
  });
  const slotNames = parts.map(part => part.replace(/^Slot-\d+\s+/, "").trim().toLowerCase());
  const missingNames = namesLine
    .split(" + ")
    .map(name => name.trim())
    .filter(name => name && !slotNames.includes(name.toLowerCase()));
  const missingSuffix = missingNames.length > 0 ? `, then ${missingNames.join(" + ")}` : "";
  return `LEFT-TO-RIGHT (slot order): ${parts.join(", ")}${missingSuffix}`;
}

function extractRefName(value: string): string {
  if (!value) return "";
  const head = value.split("—")[0].trim();
  return head.replace(/\s*\(.*\)\s*$/, "").trim() || head;
}

function mergeActionText(primary?: string, secondary?: string): string {
  const first = normalizeSentence(primary);
  const second = normalizeSentence(secondary);
  if (first && (!second || first.toLowerCase().includes(second.toLowerCase()))) return first;
  if (second && (!first || second.toLowerCase().includes(first.toLowerCase()))) return second;
  return [first, second].filter(Boolean).join(" ");
}

function normalizeSentence(value?: string): string {
  const text = (value || "").trim();
  if (!text) return "";
  if (/[.!?]$/.test(text)) return text;
  return `${text}.`;
}

function classifyNonHumans(cast: CastSet, slots: string[]): { nonHumanNames: string[]; nonHumanKinds: string[] } {
  const nonHumanNames: string[] = [];
  const nonHumanKinds: string[] = [];
  for (const slot of slots) {
    const sheet = cast.avatars.find(a => a.slotKey === slot) || cast.poolCharacters.find(c => c.slotKey === slot);
    if (!sheet) continue;
    const profileText = getCharacterProfileText(sheet).toLowerCase();
    const kind = matchNonHumanKind(profileText);
    if (kind) {
      nonHumanNames.push(sheet.displayName);
      nonHumanKinds.push(kind);
    }
  }
  return { nonHumanNames: Array.from(new Set(nonHumanNames)), nonHumanKinds: Array.from(new Set(nonHumanKinds)) };
}

function getCharacterProfileText(sheet: { displayName: string; visualSignature?: string[]; outfitLock?: string[]; faceLock?: string[] }): string {
  const parts = [
    sheet.displayName,
    ...(sheet.visualSignature || []),
    ...(sheet.outfitLock || []),
    ...(sheet.faceLock || []),
  ];
  return parts.filter(Boolean).join(" ");
}

const NON_HUMAN_PATTERNS: Array<{ kind: string; pattern: RegExp }> = [
  { kind: "frog", pattern: /\bfrog\b/i },
  { kind: "frog", pattern: /\bfrosch\b/i },
  { kind: "toad", pattern: /\btoad\b/i },
  { kind: "bird", pattern: /\bbird\b/i },
  { kind: "bird", pattern: /\bsparrow\b/i },
  { kind: "bird", pattern: /\bspatz\b/i },
  { kind: "cat", pattern: /\bcat\b/i },
  { kind: "dog", pattern: /\bdog\b/i },
  { kind: "fox", pattern: /\bfox\b/i },
  { kind: "wolf", pattern: /\bwolf\b/i },
  { kind: "bear", pattern: /\bbear\b/i },
  { kind: "rabbit", pattern: /\brabbit\b/i },
  { kind: "rabbit", pattern: /\bhare\b/i },
  { kind: "mouse", pattern: /\bmouse\b/i },
  { kind: "dragon", pattern: /\bdragon\b/i },
  { kind: "unicorn", pattern: /\bunicorn\b/i },
  { kind: "turtle", pattern: /\bturtle\b/i },
  { kind: "snake", pattern: /\bsnake\b/i },
  { kind: "lizard", pattern: /\blizard\b/i },
  { kind: "fish", pattern: /\bfish\b/i },
  { kind: "dinosaur", pattern: /\bdinosaur\b/i },
  { kind: "robot", pattern: /\brobot\b/i },
  { kind: "golem", pattern: /\bgolem\b/i },
  { kind: "ghost", pattern: /\bghost\b/i },
  { kind: "fairy", pattern: /\bfairy\b/i },
  { kind: "elf", pattern: /\belf\b/i },
  { kind: "dwarf", pattern: /\bdwarf\b/i },
  { kind: "giant", pattern: /\bgiant\b/i },
];

function matchNonHumanKind(text: string): string | null {
  for (const entry of NON_HUMAN_PATTERNS) {
    if (entry.pattern.test(text)) return entry.kind;
  }
  return null;
}

function buildNegativeList(input: { hasBird: boolean; nonHumanKinds: string[] }): string[] {
  const items = [
    "extra child",
    "third human",
    "extra person",
    "background people",
    "silhouettes",
    "reflections",
    "faces in posters/paintings",
    "duplicate",
    "twins",
    "clone",
    "swapped identity",
    "wrong slot",
    "looking at camera",
    "portrait",
    "selfie",
    "close-up",
    "collage",
    "panels",
    "split-screen",
    "text",
    "typography",
    "watermark",
    "cropped body",
  ];

  if (input.hasBird) {
    items.push("extra bird", "multiple birds");
  }

  if (input.nonHumanKinds.includes("frog")) {
    items.push("anthropomorphic frog", "frog becomes boy", "human-like frog", "frog stands upright like a human");
  } else if (input.nonHumanKinds.length > 0) {
    items.push("anthropomorphic animal", "animal becomes human", "human-like animal");
  }

  return Array.from(new Set(items));
}
