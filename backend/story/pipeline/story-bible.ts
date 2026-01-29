import type { CastSet, NormalizedRequest, StoryBible, StoryBlueprintBase, StoryVariantPlan } from "./types";
import { callChatCompletion } from "./llm-client";

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function validateStoryBible(input: any, chapterCount: number, cast: CastSet): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!input || typeof input !== "object") {
    return { valid: false, errors: ["StoryBible not an object"] };
  }
  const requiredStrings = ["coreGoal", "coreProblem", "stakes", "promise", "mysteryOrQuestion"];
  requiredStrings.forEach((key) => {
    if (typeof input[key] !== "string" || input[key].trim().length < 3) {
      errors.push(`Missing or invalid ${key}`);
    }
  });

  if (!Array.isArray(input.chapterArcs) || input.chapterArcs.length !== chapterCount) {
    errors.push(`chapterArcs must have length ${chapterCount}`);
  } else {
    input.chapterArcs.forEach((arc: any, index: number) => {
      const required = ["subgoal", "reversal", "progressDelta", "newInformation", "costOrTradeoff", "carryOverHook"];
      required.forEach((key) => {
        if (typeof arc?.[key] !== "string" || arc[key].trim().length < 2) {
          errors.push(`chapterArcs[${index}] missing ${key}`);
        }
      });
      if (arc?.chapter !== index + 1) {
        errors.push(`chapterArcs[${index}] chapter must be ${index + 1}`);
      }
    });
  }

  const names = [
    ...cast.avatars.map(a => ({ name: a.displayName, role: a.roleType })),
    ...cast.poolCharacters.map(c => ({ name: c.displayName, role: c.roleType })),
  ];
  const motivations = input.characterMotivations || {};
  names.forEach((entry) => {
    if (typeof motivations[entry.name] !== "string" || motivations[entry.name].trim().length < 2) {
      errors.push(`Missing motivation for ${entry.name}`);
    }
  });

  const entryContracts = input.entryContracts || {};
  names.forEach((entry) => {
    const contract = entryContracts[entry.name];
    if (!contract || typeof contract !== "object") {
      errors.push(`Missing entryContract for ${entry.name}`);
      return;
    }
    if (typeof contract.chapter !== "number" || contract.chapter < 1 || contract.chapter > chapterCount) {
      errors.push(`Invalid entryContract.chapter for ${entry.name}`);
    }
    if (typeof contract.reason !== "string" || contract.reason.trim().length < 3) {
      errors.push(`Invalid entryContract.reason for ${entry.name}`);
    }
    if (entry.role !== "CAMEO" && contract.chapter > 2) {
      errors.push(`Entry for ${entry.name} occurs after chapter 2`);
    }
  });

  const artifactArc = input.artifactArc;
  if (!artifactArc || typeof artifactArc !== "object") {
    errors.push("Missing artifactArc");
  } else {
    const { introduceChapter, attemptChapter, decisiveChapter } = artifactArc;
    if (![introduceChapter, attemptChapter, decisiveChapter].every((n: any) => typeof n === "number")) {
      errors.push("artifactArc chapters must be numbers");
    } else if (!(introduceChapter >= 1 && decisiveChapter <= chapterCount && introduceChapter <= attemptChapter && attemptChapter <= decisiveChapter)) {
      errors.push("artifactArc chapter order invalid");
    }
  }

  return { valid: errors.length === 0, errors };
}

function buildStoryBiblePrompt(input: {
  normalized: NormalizedRequest;
  blueprint: StoryBlueprintBase;
  variantPlan: StoryVariantPlan;
  cast: CastSet;
}): string {
  const { normalized, blueprint, variantPlan, cast } = input;
  const isGerman = normalized.language === "de";
  const chapterCount = blueprint.scenes.length;
  const characterList = [
    ...cast.avatars.map(a => `${a.displayName} (${a.roleType})`),
    ...cast.poolCharacters.map(c => `${c.displayName} (${c.roleType})`),
  ].join(", ");

  if (isGerman) {
    return `Erstelle eine StoryBible fuer eine Kinderbuch-Geschichte.
ZIEL: roter Faden, klare Motivation, keine Teleport-Charaktere.

KONTEXT:
- Kategorie: ${normalized.category}
- Kapitelanzahl: ${chapterCount}
- DNA Konflikt: ${"coreConflict" in blueprint.dna ? blueprint.dna.coreConflict : blueprint.dna.coreConflict}
- Varianten: ${JSON.stringify(variantPlan.variantChoices)}
- Figuren: ${characterList}
- Artefakt: ${cast.artifact?.name || "unbekannt"}

REGELN:
1) Keine neuen Figuren erfinden. Nur die genannten Namen verwenden.
2) entryContracts: Jede Figur bekommt ein Intro, wichtige Figuren spaetestens Kapitel 2.
3) chapterArcs: exakt ${chapterCount} Eintraege, Chapter 1..${chapterCount}.
4) artifactArc: 3 Beat Arc (Einfuehrung -> Versuch/Fehlschlag -> entscheidender Einsatz).

Gib JSON aus mit diesem Schema:
{
  "coreGoal": "...",
  "coreProblem": "...",
  "stakes": "...",
  "promise": "...",
  "mysteryOrQuestion": "...",
  "chapterArcs": [
    { "chapter": 1, "subgoal": "...", "reversal": "...", "progressDelta": "...", "newInformation": "...", "costOrTradeoff": "...", "carryOverHook": "..." }
  ],
  "characterMotivations": { "Name": "Motivation" },
  "entryContracts": { "Name": { "chapter": 1, "reason": "..." } },
  "exitContracts": { "Name": { "chapter": 4, "reason": "...", "allowReturn": false } },
  "artifactArc": { "introduceChapter": 1, "attemptChapter": 3, "decisiveChapter": 5, "failureNote": "...", "successNote": "..." }
}`;
  }

  return `Create a StoryBible for a children's book story.
GOAL: strong throughline, clear motivations, no teleporting characters.

CONTEXT:
- Category: ${normalized.category}
- Chapters: ${chapterCount}
- Core conflict: ${"coreConflict" in blueprint.dna ? blueprint.dna.coreConflict : blueprint.dna.coreConflict}
- Variants: ${JSON.stringify(variantPlan.variantChoices)}
- Characters: ${characterList}
- Artifact: ${cast.artifact?.name || "unknown"}

RULES:
1) Do NOT invent new characters. Only use listed names.
2) entryContracts: every character introduced, key roles by chapter 2.
3) chapterArcs: exactly ${chapterCount} entries, chapter numbers 1..${chapterCount}.
4) artifactArc: 3-beat arc (introduce -> attempt/fail -> decisive use).

Return JSON with this schema:
{
  "coreGoal": "...",
  "coreProblem": "...",
  "stakes": "...",
  "promise": "...",
  "mysteryOrQuestion": "...",
  "chapterArcs": [
    { "chapter": 1, "subgoal": "...", "reversal": "...", "progressDelta": "...", "newInformation": "...", "costOrTradeoff": "...", "carryOverHook": "..." }
  ],
  "characterMotivations": { "Name": "Motivation" },
  "entryContracts": { "Name": { "chapter": 1, "reason": "..." } },
  "exitContracts": { "Name": { "chapter": 4, "reason": "...", "allowReturn": false } },
  "artifactArc": { "introduceChapter": 1, "attemptChapter": 3, "decisiveChapter": 5, "failureNote": "...", "successNote": "..." }
}`;
}

export async function createStoryBible(input: {
  normalized: NormalizedRequest;
  blueprint: StoryBlueprintBase;
  variantPlan: StoryVariantPlan;
  cast: CastSet;
}): Promise<StoryBible> {
  const { normalized, blueprint, variantPlan, cast } = input;
  const model = normalized.rawConfig.aiModel || "gpt-5-mini";
  const chapterCount = blueprint.scenes.length;
  const prompt = buildStoryBiblePrompt({ normalized, blueprint, variantPlan, cast });

  // Reasoning models (gpt-5, o4) use many tokens for internal reasoning
  // so we need to allocate more tokens for them to have room for the actual response
  const isReasoningModel = model.includes("gpt-5") || model.includes("o4");
  const maxTokens = isReasoningModel ? 4000 : 1800;

  const result = await callChatCompletion({
    model,
    messages: [
      { role: "system", content: normalized.language === "de" ? "Du planst Kinderbuch-Geschichten strukturiert." : "You plan children's stories structurally." },
      { role: "user", content: prompt },
    ],
    responseFormat: "json_object",
    maxTokens,
    temperature: 0.3,
    seed: normalized.variantSeed,
    context: "story-bible",
  });

  console.log("[StoryBible] AI Response length:", result.content.length);
  console.log("[StoryBible] AI Response preview:", result.content.substring(0, 500));
  
  let parsed = safeJson(result.content);
  if (!parsed) {
    console.error("[StoryBible] JSON parsing failed! Raw content:", result.content);
  }
  
  let validation = validateStoryBible(parsed, chapterCount, cast);
  if (!validation.valid) {
    const repairPrompt = `${prompt}\n\nFEHLER:\n${validation.errors.join("\n")}\n\nBitte korrigieren und nur korrektes JSON liefern.`;
    const repaired = await callChatCompletion({
      model,
      messages: [
        { role: "system", content: normalized.language === "de" ? "Korrigiere JSON nach Vorgaben." : "Fix the JSON to match the requirements." },
        { role: "user", content: repairPrompt },
      ],
      responseFormat: "json_object",
      maxTokens,
      temperature: 0.2,
      seed: normalized.variantSeed,
      context: "story-bible-repair",
    });
    parsed = safeJson(repaired.content);
    if (!parsed) {
      console.error("[StoryBible] Repair JSON parsing also failed! Raw content:", repaired.content);
    }
    validation = validateStoryBible(parsed, chapterCount, cast);
    if (!validation.valid) {
      console.error("[StoryBible] Validation still failed after repair:", validation.errors);
      console.error("[StoryBible] Parsed object:", JSON.stringify(parsed, null, 2));
      throw new Error(`StoryBible validation failed: ${validation.errors.join("; ")}`);
    }
  }

  return parsed as StoryBible;
}
