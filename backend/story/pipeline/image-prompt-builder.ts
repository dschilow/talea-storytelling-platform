import type { CastSet, ImageSpec } from "./types";

export function buildFinalPromptText(spec: ImageSpec, cast: CastSet, options?: { forceEnglish?: boolean }): string {
  const forceEnglish = options?.forceEnglish ?? false;
  const characterNames = spec.onStageExact
    .map(slot => findCharacterName(cast, slot))
    .filter((name): name is string => Boolean(name));
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
  const identityConsistencyRules = buildIdentityConsistencyRules(cast, spec.onStageExact);

  // Separate rules for animal characters vs humanoid fantasy creatures (fairy, elf, dwarf, goblin)
  const animalRule = nonHumanInfo.animalNames.length > 0
    ? `- ANIMAL RULE: ${nonHumanInfo.animalNames.join(", ")} must keep clear animal anatomy (e.g., paws, fur, snout, tail). Accessories from identity locks are allowed. Do NOT turn them into human children or human faces.`
    : "";
  const humanoidFantasyRule = nonHumanInfo.humanoidFantasyNames.length > 0
    ? `- FANTASY CREATURE RULE: ${nonHumanInfo.humanoidFantasyNames.join(", ")} ${nonHumanInfo.humanoidFantasyNames.length === 1 ? "is a" : "are"} humanoid fantasy creature${nonHumanInfo.humanoidFantasyNames.length !== 1 ? "s" : ""} — ${buildHumanoidFantasyHint(nonHumanInfo.humanoidFantasyKinds)}. They keep humanoid fantasy traits and are not replaced by plain human kids or real animals.`
    : "";
  const nonHumanRule = [animalRule, humanoidFantasyRule].filter(Boolean).join("\n") || "";

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
    "- Characters MUST perform their described actions (running, kneeling, reaching, climbing) — NOT just standing idle",
    "- Follow CHARACTER ACTION LOCKS exactly; each named character must show a different visible movement",
    "- Characters interact with each other or props; NOT looking at camera; NOT posing for a photo",
    "- NO static group poses — each character must have a DIFFERENT body position and action",
    "- Characters must be fully integrated in the scene (no sticker/cutout look, no pasted avatars, no floating heads)",
    "- Single continuous scene; no panels, split-screen, collage, or multi-image layout",
    "- No written text or typography; no watermarks or logos",
    hasBird ? "- EXACTLY 1 bird total (if present), no other animals" : "- No extra animals",
    identityLock,
    ...identityConsistencyRules,
    nonHumanRule,
  ]
    .filter(Boolean)
    .join("\n");

  const settingValue = (spec.setting || "").trim();
  const settingBlock = `SETTING (ONE): ${settingValue || "story setting"}. Use only this location.`;

  const sceneBlock = `SHOT / COMPOSITION: ${normalizedComposition}${blockingText ? `. ${blockingText}` : ""}${lightingText ? `. Lighting: ${lightingText}` : ""}`;

  const stagingLine = count > 1 ? buildStagingLine(namesLine, refEntries, isCollageMode) : "";
  const characterActionLockBlock = buildCharacterActionLockBlock(spec.actions, characterNames);
  const actionText = mergeActionText(spec.sceneDescription, spec.actions) || "Characters actively interact with each other and their surroundings in a dynamic moment — each with a different pose and action.";
  const propsText = (spec.propsVisible || []).filter(Boolean).join(", ");
  const actionBlock = `ACTION (DO NOT SWAP): ${stagingLine ? `${stagingLine}. ` : ""}${actionText}${propsText ? ` Key props: ${propsText}.` : ""}`;

  const characterIdentityBlock = characterDetails.length > 0
    ? `CHARACTER IDENTITY LOCKS:\n${characterDetails.map(detail => `- ${detail}`).join("\n")}`
    : "";
  const characterForbiddenBlock = buildCharacterForbiddenLockBlock(cast, spec.onStageExact);

  const languageGuard = forceEnglish
    ? "LANGUAGE: English only. Translate any non-English words before rendering."
    : "";

  const negativeBlock = `NEGATIVE (VERY STRONG): ${buildNegativeList({
    hasBird,
    nonHumanKinds: nonHumanInfo.nonHumanKinds,
  }).join(", ")}`;

  const combined = [styleBlock, refBlock, constraints, settingBlock, sceneBlock, characterIdentityBlock, characterForbiddenBlock, characterActionLockBlock, actionBlock, languageGuard, negativeBlock]
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

function buildCharacterForbiddenLockBlock(cast: CastSet, slots: string[]): string {
  const lines: string[] = [];
  for (const slot of slots) {
    const sheet = cast.avatars.find(a => a.slotKey === slot) || cast.poolCharacters.find(c => c.slotKey === slot);
    if (!sheet) continue;
    const forbids = (sheet.forbidden || [])
      .map(item => String(item).trim())
      .filter(Boolean)
      .slice(0, 3);
    if (forbids.length === 0) continue;
    lines.push(`- ${sheet.displayName}: avoid ${forbids.join(", ")}`);
  }
  if (lines.length === 0) return "";
  return `CHARACTER FORBIDDEN LOCKS:\n${lines.join("\n")}`;
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
  const resolvedSlotNames = slotEntries.map(([, value]) => extractRefName(value)).filter(Boolean);
  const parts = slotEntries.map(([key, value]) => {
    const slotNum = key.replace("slot_", "");
    const name = extractRefName(value);
    return `Slot-${slotNum} ${name}`;
  });
  const slotNames = resolvedSlotNames.map(name => normalizeNameToken(name));
  const missingNames = namesLine
    .split(" + ")
    .map(name => name.trim())
    .filter(name => name && !slotNames.includes(normalizeNameToken(name)));
  const missingSuffix = missingNames.length > 0 ? `, then ${missingNames.join(" + ")}` : "";
  return `LEFT-TO-RIGHT (slot order): ${parts.join(", ")}${missingSuffix}`;
}

function extractRefName(value: string): string {
  if (!value) return "";
  const normalized = value.replace(/[–—]/g, "-");
  const [head] = normalized.split(/\s+-\s+/);
  const core = (head || normalized).trim();
  return core.replace(/\s*\(.*\)\s*$/, "").trim() || core;
}

function normalizeNameToken(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}

function mergeActionText(primary?: string, secondary?: string): string {
  const first = normalizeSentence(primary);
  const second = normalizeSentence(secondary);
  if (first && (!second || first.toLowerCase().includes(second.toLowerCase()))) return first;
  if (second && (!first || second.toLowerCase().includes(first.toLowerCase()))) return second;
  return [first, second].filter(Boolean).join(" ");
}

function buildCharacterActionLockBlock(actionsText: string, characterNames: string[]): string {
  if (!characterNames.length) return "";
  const sentences = String(actionsText || "")
    .split(/(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(Boolean);

  const lines = characterNames.map((name, index) => {
    const pattern = new RegExp(`\\b${escapeRegExp(name)}\\b`, "i");
    const sentence = sentences.find(item => pattern.test(item)) || "";
    const actionCore = sentence
      ? sentence.replace(pattern, "").replace(/[,:;\-]/g, " ").replace(/\s+/g, " ").trim()
      : "";
    const dynamicAction = normalizeActionLockText(actionCore, index);
    return `- ${name}: ${dynamicAction}`;
  });

  return `CHARACTER ACTION LOCKS (MUST BE VISIBLE):\n${lines.join("\n")}`;
}

function normalizeActionLockText(action: string, index: number): string {
  const cleaned = normalizeActionClause(action);
  if (!cleaned) return defaultActionLock(index);
  const lowered = cleaned.toLowerCase();
  if (ACTION_LOCK_STATIC_PATTERNS.some(pattern => pattern.test(lowered))) {
    return defaultActionLock(index);
  }
  if (!ACTION_LOCK_DYNAMIC_VERBS.some(verb => lowered.includes(verb)) && !MOVEMENT_PHRASE_PATTERN.test(lowered)) {
    return `${cleaned} while actively moving`;
  }
  return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
}

function normalizeActionClause(action: string): string {
  const cleaned = String(action || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  let result = cleaned;
  result = result.replace(/\bwhile\s+moving\s+decisively\b/gi, "while actively moving");
  result = result.replace(/\bwhile\s+actively\s+moving\b(?:\s+\bwhile\s+actively\s+moving\b)+/gi, "while actively moving");
  result = result.replace(/\bwhile\s+actively\s+moving\s*\.\s*while\s+actively\s+moving\b/gi, "while actively moving");
  result = result.replace(/\s+/g, " ").trim();
  return result;
}

function defaultActionLock(index: number): string {
  const defaults = [
    "sprinting toward the key clue.",
    "crouching and pulling someone clear.",
    "reaching out to stabilize a moving object.",
    "jumping across an obstacle to open the path.",
  ];
  return defaults[index % defaults.length];
}

function normalizeSentence(value?: string): string {
  const text = (value || "").trim();
  if (!text) return "";
  if (/[.!?]$/.test(text)) return text;
  return `${text}.`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function classifyNonHumans(cast: CastSet, slots: string[]): {
  nonHumanNames: string[];
  nonHumanKinds: string[];
  animalNames: string[];
  animalKinds: string[];
  humanoidFantasyNames: string[];
  humanoidFantasyKinds: string[];
} {
  const nonHumanNames: string[] = [];
  const nonHumanKinds: string[] = [];
  const animalNames: string[] = [];
  const animalKinds: string[] = [];
  const humanoidFantasyNames: string[] = [];
  const humanoidFantasyKinds: string[] = [];
  for (const slot of slots) {
    const sheet = cast.avatars.find(a => a.slotKey === slot) || cast.poolCharacters.find(c => c.slotKey === slot);
    if (!sheet) continue;
    const profileText = getCharacterProfileText(sheet).toLowerCase();
    const kind = matchNonHumanKind(profileText);
    if (kind) {
      nonHumanNames.push(sheet.displayName);
      nonHumanKinds.push(kind);
      if (HUMANOID_FANTASY_KINDS.has(kind)) {
        humanoidFantasyNames.push(sheet.displayName);
        humanoidFantasyKinds.push(kind);
      } else {
        animalNames.push(sheet.displayName);
        animalKinds.push(kind);
      }
    }
  }
  return {
    nonHumanNames: Array.from(new Set(nonHumanNames)),
    nonHumanKinds: Array.from(new Set(nonHumanKinds)),
    animalNames: Array.from(new Set(animalNames)),
    animalKinds: Array.from(new Set(animalKinds)),
    humanoidFantasyNames: Array.from(new Set(humanoidFantasyNames)),
    humanoidFantasyKinds: Array.from(new Set(humanoidFantasyKinds)),
  };
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

/**
 * Humanoid fantasy creatures that look like humans with minor fantastical features
 * (wings, pointed ears, small size). They should NOT get the strict "non-human anatomy" rule.
 */
const HUMANOID_FANTASY_KINDS = new Set(["fairy", "elf", "dwarf", "giant", "gnome", "pixie", "goblin"]);

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
  { kind: "fairy", pattern: /\bfee\b/i },
  { kind: "elf", pattern: /\belf\b/i },
  { kind: "dwarf", pattern: /\bdwarf\b/i },
  { kind: "dwarf", pattern: /\bzwerg\b/i },
  { kind: "giant", pattern: /\bgiant\b/i },
  { kind: "giant", pattern: /\briese\b/i },
  { kind: "goblin", pattern: /\bgoblin\b/i },
  { kind: "goblin", pattern: /\bkobold\b/i },
  { kind: "gnome", pattern: /\bgnome?\b/i },
  { kind: "pixie", pattern: /\bpixie\b/i },
];

function matchNonHumanKind(text: string): string | null {
  for (const entry of NON_HUMAN_PATTERNS) {
    if (entry.pattern.test(text)) return entry.kind;
  }
  return null;
}

function buildHumanoidFantasyHint(kinds: string[]): string {
  const hints: Record<string, string> = {
    fairy: "with delicate wings on back, glowing aura, normal human skin tone",
    pixie: "tiny with butterfly wings, glowing aura, normal human skin tone",
    elf: "with pointed ears, slender build, normal human skin tone",
    dwarf: "short and stocky with a beard, normal human skin tone",
    giant: "very tall and large, normal human skin tone",
    goblin: "small with pointed ears and a mischievous grin, may have green skin",
    gnome: "very small with a pointy hat, normal human skin tone",
  };
  const unique = Array.from(new Set(kinds));
  return unique.map(k => hints[k] || "humanoid with fantastical features").join("; ");
}

const ACTION_LOCK_STATIC_PATTERNS = [
  /\bstand(?:s|ing)?\b/,
  /\blook(?:s|ing)?\b/,
  /\bwatch(?:es|ing)?\b/,
  /\bpose(?:s|d)?\b/,
  /\bfacing\s+(?:camera|viewer)\b/,
  /\bidle\b/,
];

const ACTION_LOCK_DYNAMIC_VERBS = [
  "run", "sprint", "dash", "jump", "leap", "lunge", "crawl", "climb", "duck",
  "grab", "pull", "push", "lift", "hold", "open", "read", "tap", "swing",
  "throw", "catch", "brace", "reach", "drag", "step", "vault", "slide",
  "kneel", "crouch", "pivot", "charge", "stabilize", "balance",
];
const MOVEMENT_PHRASE_PATTERN = /\bwhile\s+(?:actively\s+)?moving(?:\s+decisively)?\b/i;

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
    "same character repeated",
    "same face on two bodies",
    "twins",
    "clone",
    "identity drift",
    "gender swap",
    "wrong gender presentation",
    "species swap",
    "character merge",
    "swapped identity",
    "wrong slot",
    "looking at camera",
    "staring at viewer",
    "static pose",
    "standing idle",
    "group photo",
    "sticker cutout character",
    "pasted avatar",
    "paper doll look",
    "floating head",
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

  // Prevent class drift without forcing a non-storybook rendering style.
  const animalKinds = input.nonHumanKinds.filter(k => !HUMANOID_FANTASY_KINDS.has(k));
  if (animalKinds.length > 0) {
    items.push("animal replaced by human child", "human face on animal body", "animal identity swapped");
  }
  const fantasyKinds = input.nonHumanKinds.filter(k => HUMANOID_FANTASY_KINDS.has(k));
  if (fantasyKinds.length > 0) {
    items.push("fantasy creature replaced by plain human child", "fantasy creature replaced by real animal");
  }

  return Array.from(new Set(items));
}

function buildIdentityConsistencyRules(cast: CastSet, slots: string[]): string[] {
  const rules: string[] = [];
  for (const slot of slots) {
    const sheet = cast.avatars.find(a => a.slotKey === slot) || cast.poolCharacters.find(c => c.slotKey === slot);
    if (!sheet) continue;
    const profile = getCharacterProfileText(sheet).toLowerCase();
    const kind = matchNonHumanKind(profile);
    const gender = inferGenderFromProfile(profile);

    if (!kind) {
      if (gender === "male") {
        rules.push(`- ${sheet.displayName} is a human boy. Do NOT render as female or as an animal.`);
      } else if (gender === "female") {
        rules.push(`- ${sheet.displayName} is a human girl. Do NOT render as male or as an animal.`);
      } else {
        rules.push(`- ${sheet.displayName} remains a human child, not an animal or creature.`);
      }
      continue;
    }

    if (HUMANOID_FANTASY_KINDS.has(kind)) {
      rules.push(`- ${sheet.displayName} remains a ${kind} character (humanoid fantasy), not replaced by a plain human child or real animal.`);
      continue;
    }

    rules.push(`- ${sheet.displayName} remains a ${kind}, not replaced by a human child.`);
  }
  return Array.from(new Set(rules));
}

function inferGenderFromProfile(profileLower: string): "male" | "female" | "unknown" {
  if (!profileLower) return "unknown";
  const femalePattern = /\b(female|girl|woman|maedchen|mädchen|weiblich)\b/i;
  const malePattern = /\b(male|boy|man|junge|männlich|maennlich)\b/i;
  const isFemale = femalePattern.test(profileLower);
  const isMale = malePattern.test(profileLower);
  if (isFemale && !isMale) return "female";
  if (isMale && !isFemale) return "male";
  return "unknown";
}
