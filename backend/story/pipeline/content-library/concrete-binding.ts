/**
 * Greenfield Schicht 2 — Concrete & Casting Binding
 *
 * Deterministische Verbindung von:
 *   Skeleton + Genre/Tags + Has-Artifact → Casting-Plan + Konkret-Anker-Map
 *
 * Keine LLM-Calls. Reine Regel-Logik. Ziel: dem Blueprint-Generator einen
 * konkreten, vorgedachten Kontext zu liefern, sodass er nicht "aus dem Nichts"
 * erfindet.
 *
 * Output wird in buildV8BlueprintPrompt eingebunden: zusätzlich zu den
 * bisherigen Blueprint-Inputs kommen jetzt:
 *   - das gewählte Skelett (mit Kapitel-Beats)
 *   - das passende Antagonist-Archetyp-Template
 *   - (optional) das passende Artefakt-Template
 *   - 3+ gewählte Konkret-Anker-Paare
 *   - das empfohlene ending_pattern
 */

import {
  pickBestSkeleton,
  buildSkeletonPromptBlock,
  type StorySkeleton,
} from "./story-skeletons";
import {
  getAntagonistArchetype,
  buildAntagonistArchetypePromptBlock,
  type AntagonistArchetypeTemplate,
} from "./antagonist-archetypes";
import {
  pickArtifactForSkeleton,
  buildArtifactTemplatePromptBlock,
  type ArtifactTemplate,
} from "./artifact-templates";
import type { EndingPatternName } from "../ending-patterns";

export interface ContentLibraryBinding {
  skeleton: StorySkeleton;
  antagonistArchetype: AntagonistArchetypeTemplate | undefined;
  artifactTemplate: ArtifactTemplate | undefined;
  /** Bereits deterministisch gewählte Konkret-Anker (blueprint muss mind. 3) */
  concreteAnchorDefaults: Record<string, string>;
  /** Welches ending_pattern das Skelett empfiehlt */
  recommendedEndingPattern: EndingPatternName;
}

/**
 * Baut das Content-Library-Binding aus Request-Kontext.
 *
 * Liefert `undefined` falls kein Skelett matched — dann läuft die alte Pipeline
 * ohne Binding (backward-compatible).
 */
export function buildContentLibraryBinding(input: {
  genre?: string;
  themeTags?: ReadonlyArray<string>;
  hasArtifact?: boolean;
  settingHint?: string;
}): ContentLibraryBinding | undefined {
  const skeleton = pickBestSkeleton({
    genre: input.genre,
    themeTags: input.themeTags,
    hasArtifact: input.hasArtifact,
    settingHint: input.settingHint,
  });
  if (!skeleton) return undefined;

  const antagonistArchetype = getAntagonistArchetype(
    skeleton.antagonistPattern.archetypeCategory,
  );

  const artifactTemplate = input.hasArtifact
    ? pickArtifactForSkeleton(skeleton.id)
    : undefined;

  // Baue Default-Konkret-Anker aus den Hints. Pro Theme nehmen wir den ERSTEN
  // Kandidaten. Der Blueprint-LLM darf anpassen — aber hat bereits 3+ Anker,
  // die den CONCRETE_ANCHOR_PRESENCE-Gate durchlassen.
  const concreteAnchorDefaults: Record<string, string> = {};
  for (const hint of skeleton.concreteAnchorHints) {
    if (hint.concreteCandidates.length > 0) {
      concreteAnchorDefaults[hint.abstractTheme] = hint.concreteCandidates[0];
    }
  }

  return {
    skeleton,
    antagonistArchetype,
    artifactTemplate,
    concreteAnchorDefaults,
    recommendedEndingPattern: skeleton.recommendedEndingPattern,
  };
}

/**
 * Baut den kompakten Prompt-Block aus dem Binding für buildV8BlueprintPrompt.
 * Wird als zusätzlicher Abschnitt in den User-Prompt eingefügt.
 */
export function buildContentLibraryPromptBlock(binding: ContentLibraryBinding): string {
  const parts: string[] = [
    "═══ CONTENT LIBRARY BINDING (from curated templates) ═══",
    "",
    buildSkeletonPromptBlock(binding.skeleton),
  ];

  if (binding.antagonistArchetype) {
    parts.push("", buildAntagonistArchetypePromptBlock(binding.antagonistArchetype));
  }

  if (binding.artifactTemplate) {
    parts.push("", buildArtifactTemplatePromptBlock(binding.artifactTemplate));
  }

  const anchorPreview = Object.entries(binding.concreteAnchorDefaults)
    .map(([theme, anchor]) => `  "${theme}": "${anchor}"`)
    .join(",\n");
  parts.push(
    "",
    "CONCRETE ANCHOR DEFAULTS (use as-is or tune, but keep all three + add any story-specific):",
    "{",
    anchorPreview,
    "}",
    "",
    `RECOMMENDED ending_pattern: "${binding.recommendedEndingPattern}" (skeleton default — override only if plot clearly needs another)`,
    "",
    "═══ END CONTENT LIBRARY BINDING ═══",
  );

  return parts.join("\n");
}
