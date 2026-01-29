import type { CastSet, NormalizedRequest, SceneDirective, StoryBible, WorldState } from "./types";
import { callChatCompletion } from "./llm-client";

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function validateWorldState(input: any, expectedChapter: number, cast: CastSet): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!input || typeof input !== "object") return { valid: false, errors: ["WorldState not an object"] };
  if (typeof input.chapter !== "number" || input.chapter !== expectedChapter) {
    errors.push(`WorldState.chapter must be ${expectedChapter}`);
  }
  if (typeof input.location !== "string" || input.location.trim().length < 2) {
    errors.push("WorldState.location missing");
  }
  if (!input.characterState || typeof input.characterState !== "object") {
    errors.push("WorldState.characterState missing");
  }
  const names = [
    ...cast.avatars.map(a => a.displayName),
    ...cast.poolCharacters.map(c => c.displayName),
  ];
  names.forEach((name) => {
    const entry = input.characterState?.[name];
    if (!entry) {
      errors.push(`WorldState.characterState missing ${name}`);
      return;
    }
    if (!["onStage", "offStage", "left"].includes(entry.status)) {
      errors.push(`WorldState.characterState invalid status for ${name}`);
    }
  });
  if (!Array.isArray(input.openLoops)) {
    errors.push("WorldState.openLoops must be array");
  }
  return { valid: errors.length === 0, errors };
}

export function createInitialWorldState(input: {
  normalized: NormalizedRequest;
  firstDirective?: SceneDirective;
  cast: CastSet;
  storyBible: StoryBible;
}): WorldState {
  const { normalized, firstDirective, cast, storyBible } = input;
  const names = [
    ...cast.avatars.map(a => a.displayName),
    ...cast.poolCharacters.map(c => c.displayName),
  ];
  const characterState: WorldState["characterState"] = {};
  names.forEach((name) => {
    characterState[name] = {
      status: "offStage",
      lastSeenChapter: 0,
      reasonIfOffStage: normalized.language === "de" ? "Noch nicht eingefuehrt." : "Not introduced yet.",
    };
  });

  return {
    chapter: 0,
    location: firstDirective?.setting || (normalized.language === "de" ? "unbekannter Ort" : "unknown place"),
    timeOfDay: normalized.language === "de" ? "morgens" : "morning",
    inventory: [],
    artifactState: storyBible.artifactArc ? "unentdeckt" : undefined,
    characterState,
    openLoops: storyBible.mysteryOrQuestion ? [storyBible.mysteryOrQuestion] : [],
    resolvedLoops: [],
    summary: normalized.language === "de" ? "Ausgangslage vor Kapitel 1." : "Initial state before chapter 1.",
  };
}

function buildWorldStatePrompt(input: {
  normalized: NormalizedRequest;
  storyBible: StoryBible;
  directive: SceneDirective;
  previousState: WorldState;
  chapterText: string;
}): string {
  const { normalized, storyBible, directive, previousState, chapterText } = input;
  const isGerman = normalized.language === "de";
  const continuity = directive.continuityMust?.join("; ") || "";
  const entryExit = (directive.continuityMust || []).filter(item => item.startsWith("ENTRY:") || item.startsWith("EXIT:")).join("; ");

  if (isGerman) {
    return `Aktualisiere den WorldState nach Kapitel ${directive.chapter}.

StoryBible:
Goal: ${storyBible.coreGoal}
Problem: ${storyBible.coreProblem}
Mystery: ${storyBible.mysteryOrQuestion}

Vorheriger WorldState (JSON):
${JSON.stringify(previousState)}

Kontinuitaet (muss stimmen):
${continuity || "Keine"}

Entry/Exit Hinweise:
${entryExit || "Keine"}

Kapiteltext:
${chapterText}

Gib JSON:
{
  "chapter": ${directive.chapter},
  "location": "...",
  "timeOfDay": "...",
  "inventory": [],
  "artifactState": "...",
  "characterState": { "Name": { "status": "onStage|offStage|left", "lastSeenChapter": ${directive.chapter}, "reasonIfOffStage": "..." } },
  "openLoops": ["..."],
  "resolvedLoops": ["..."],
  "summary": "Kurzfassung (1 Satz)"
}`;
  }

  return `Update the WorldState after chapter ${directive.chapter}.

StoryBible:
Goal: ${storyBible.coreGoal}
Problem: ${storyBible.coreProblem}
Mystery: ${storyBible.mysteryOrQuestion}

Previous WorldState (JSON):
${JSON.stringify(previousState)}

Continuity constraints:
${continuity || "None"}

Entry/Exit hints:
${entryExit || "None"}

Chapter text:
${chapterText}

Return JSON:
{
  "chapter": ${directive.chapter},
  "location": "...",
  "timeOfDay": "...",
  "inventory": [],
  "artifactState": "...",
  "characterState": { "Name": { "status": "onStage|offStage|left", "lastSeenChapter": ${directive.chapter}, "reasonIfOffStage": "..." } },
  "openLoops": ["..."],
  "resolvedLoops": ["..."],
  "summary": "Short one-sentence summary"
}`;
}

export async function updateWorldStateFromChapter(input: {
  normalized: NormalizedRequest;
  storyBible: StoryBible;
  directive: SceneDirective;
  previousState: WorldState;
  chapterText: string;
  cast: CastSet;
}): Promise<WorldState> {
  const { normalized, storyBible, directive, previousState, chapterText, cast } = input;
  const model = normalized.rawConfig.aiModel || "gpt-5-mini";
  const prompt = buildWorldStatePrompt({ normalized, storyBible, directive, previousState, chapterText });

  const result = await callChatCompletion({
    model,
    messages: [
      { role: "system", content: normalized.language === "de" ? "Du bist ein strenger Kontinuitaets-Tracker." : "You are a strict continuity tracker." },
      { role: "user", content: prompt },
    ],
    responseFormat: "json_object",
    maxTokens: 1000,
    temperature: 0.2,
    context: "world-state-update",
  });

  let parsed = safeJson(result.content);
  let validation = validateWorldState(parsed, directive.chapter, cast);
  if (!validation.valid) {
    const repairPrompt = `${prompt}\n\nFEHLER:\n${validation.errors.join("\n")}\n\nBitte korrigieren und JSON liefern.`;
    const repaired = await callChatCompletion({
      model,
      messages: [
        { role: "system", content: normalized.language === "de" ? "Korrigiere den WorldState." : "Fix the WorldState JSON." },
        { role: "user", content: repairPrompt },
      ],
      responseFormat: "json_object",
      maxTokens: 1000,
      temperature: 0.2,
      context: "world-state-repair",
    });
    parsed = safeJson(repaired.content);
    validation = validateWorldState(parsed, directive.chapter, cast);
    if (!validation.valid) {
      throw new Error(`WorldState validation failed: ${validation.errors.join("; ")}`);
    }
  }

  // Ensure all characters exist and onStage characters are marked onStage
  const names = [
    ...cast.avatars.map(a => a.displayName),
    ...cast.poolCharacters.map(c => c.displayName),
  ];
  parsed.characterState = parsed.characterState || {};
  names.forEach((name) => {
    if (!parsed.characterState[name]) {
      parsed.characterState[name] = {
        status: "offStage",
        lastSeenChapter: directive.chapter,
        reasonIfOffStage: normalized.language === "de" ? "Nicht erwaehnt." : "Not mentioned.",
      };
    }
  });

  const onStageNames = directive.charactersOnStage
    .map(slot => {
      const sheet = cast.avatars.find(a => a.slotKey === slot) || cast.poolCharacters.find(c => c.slotKey === slot);
      return sheet?.displayName;
    })
    .filter(Boolean) as string[];
  onStageNames.forEach((name) => {
    parsed.characterState[name] = {
      ...(parsed.characterState[name] || {}),
      status: "onStage",
      lastSeenChapter: directive.chapter,
      reasonIfOffStage: undefined,
    };
  });

  return parsed as WorldState;
}
