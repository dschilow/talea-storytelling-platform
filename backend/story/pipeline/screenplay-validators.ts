/**
 * v12 §H/§I — additive screenplay-stage validators for beat-sheets and scene
 * cards.
 *
 * Why a separate module:
 *   1. lets smoke tests import the gate logic without the Encore runtime
 *   2. keeps the high-level dev-mode-generation.ts file readable as the
 *      pipeline orchestrator
 *
 * The validators here are ADDITIVE: they extend (not replace) the existing
 * `validateBeatSheet` / `validateSceneCards` in dev-mode-generation.ts. The
 * orchestrator calls these AFTER the existing checks and merges the issue
 * lists. In premium mode the new issues are hard; in efficient mode they
 * are advisory (the repair loop still tries to fix them, but a soft-fail
 * does not abort the run).
 */
import type { DevModeQualityMode } from "./potential-thresholds";

// ──────────────────────────────────────────────────────────────────────────
// Beat sheet — spec §H
// ──────────────────────────────────────────────────────────────────────────

/**
 * Spec-§H additive beat-sheet gates. Existing legacy fields
 * (`act2.midpointIrreversibleTurn`, `act2.personalCost`, `act3.closingImage`)
 * are still checked by `validateBeatSheet` in dev-mode-generation.ts; this
 * function only checks the NEW structured sub-objects.
 *
 * The new sub-objects are optional in the schema. We only complain when:
 *   - the sub-object is present but a required leaf is empty, OR
 *   - mode==='premium' AND the sub-object is missing entirely.
 *
 * That way an efficient run can keep using the legacy flat fields, while a
 * premium run is forced into the richer structure.
 */
export function validateBeatSheetSpecH(
  beatSheet: any,
  mode: DevModeQualityMode | undefined,
  heroNames: string[],
  enforceChildHeroActions = true,
): string[] {
  const issues: string[] = [];
  const isPremium = (mode || "premium") === "premium";

  // --- personalObject sub-object -----------------------------------------
  const personalObject = beatSheet?.personalObject;
  if (typeof personalObject === "object" && personalObject) {
    for (const key of ["object", "whyPersonal", "risk", "payoff"] as const) {
      if (!String(personalObject[key] || "").trim()) {
        issues.push(`beatSheet.personalObject.${key} missing`);
      }
    }
  } else if (isPremium && typeof personalObject !== "string") {
    issues.push("beatSheet.personalObject must be a structured object in premium");
  }

  // --- irreversibleMiddle sub-object -------------------------------------
  const middle = beatSheet?.irreversibleMiddle;
  if (typeof middle === "object" && middle) {
    for (const key of [
      "wrongAction",
      "visibleDamage",
      "personalCost",
      "cannotReturnToStartBecause",
      "newPressure",
    ] as const) {
      if (!String(middle[key] || "").trim()) {
        issues.push(`beatSheet.irreversibleMiddle.${key} missing`);
      }
    }
    // Spec-H: visibleDamage is the strongest hard-reject — abstract phrasing
    // ("alles wird schlimmer") does not count. Demand at least 12 chars and
    // a concrete signal verb (zerbrochen, verlischt, schrumpft, ...).
    const damage = String(middle.visibleDamage || "");
    if (damage.length > 0 && damage.length < 12) {
      issues.push("beatSheet.irreversibleMiddle.visibleDamage too short to be concrete");
    }
    if (damage.length >= 12 && !/(zerbr|brech|kaputt|riss|reisst|reißt|verschwind|verlisch|erlisch|schrumpf|verlier|loest sich|löst sich|stuerz|stürz|brennt|verbrann|tropft|leckt|verstummt|verstummen|tot|gestorben|verdorrt|welkt|gone|broken|breaks|breaks|breaks|broken|lost|missing|silent|cracked|shrinks|fades|vanishes|disappears|spilled|burned|burned|dies)/i.test(damage)) {
      issues.push("beatSheet.irreversibleMiddle.visibleDamage lacks a concrete damage signal");
    }
  } else if (isPremium) {
    issues.push("beatSheet.irreversibleMiddle structured sub-object missing");
  }

  // --- finalPayoff sub-object --------------------------------------------
  const finalPayoff = beatSheet?.finalPayoff;
  if (typeof finalPayoff === "object" && finalPayoff) {
    for (const key of ["plantedDetail", "childAction", "worldResponse", "closingImage"] as const) {
      if (!String(finalPayoff[key] || "").trim()) {
        issues.push(`beatSheet.finalPayoff.${key} missing`);
      }
    }
    // Spec-H: childAction must be executed by a hero, not by a helper.
    const childAction = String(finalPayoff.childAction || "").toLowerCase();
    if (enforceChildHeroActions && childAction.length > 0) {
      const heroMatches = heroNames.some((name) => childAction.includes(name.toLowerCase()));
      const heroPronoun = /\b(kinder|die zwei|die beiden|beide|sie zusammen|gemeinsam|die freunde|the children|the kids|both of them|together they)\b/i.test(childAction);
      if (!heroMatches && !heroPronoun) {
        issues.push("beatSheet.finalPayoff.childAction is not clearly executed by the main children");
      }
      // Helper-solves pattern: a known helper noun followed (within 3 words)
      // by a "solves/rescues/repairs" verb. Allows phrasing like "Fuchs löst
      // das Rätsel" or "der Helfer rettet die Laterne" while still matching
      // when only the heroes are nominally present but the helper does the
      // structural action.
      if (/(helfer|helper|fuchs|onkel|tante|opa|oma|fee)(\s+\S+){0,3}\s+(loest|löst|solves|saves|rettet|repariert|repairs|fixes|rescues|saves them|saves us)/i.test(childAction)) {
        issues.push("beatSheet.finalPayoff.childAction is performed by a helper, not the children");
      }
    }
    // Spec-H: payoff must come from plantedDetail. Cheap structural check —
    // require shared content. We compare 5+-char word STEMS (first 5 chars,
    // accent-folded) to forgive German morphology like
    // "Glühwürmchen-Laterne" vs "Laterne leuchtet". The LLM tends to vary
    // the surface form between fields even when the underlying object is
    // the same.
    const stemOf = (text: string): string[] => {
      const folded = text
        .toLowerCase()
        .replace(/ä/g, "a")
        .replace(/ö/g, "o")
        .replace(/ü/g, "u")
        .replace(/ß/g, "ss");
      return folded
        .split(/[^a-z]+/)
        .filter((w) => w.length >= 5)
        .map((w) => w.slice(0, 5));
    };
    const planted = String(finalPayoff.plantedDetail || "");
    const closing = String(finalPayoff.closingImage || "");
    if (planted.length > 0 && closing.length > 0) {
      const plantStems = new Set(stemOf(planted));
      const closingStems = new Set(stemOf(closing));
      let overlap = false;
      for (const stem of plantStems) {
        if (closingStems.has(stem)) { overlap = true; break; }
      }
      if (!overlap) {
        issues.push("beatSheet.finalPayoff.closingImage does not echo plantedDetail");
      }
    }
  } else if (isPremium) {
    issues.push("beatSheet.finalPayoff structured sub-object missing");
  }

  return issues;
}

// ──────────────────────────────────────────────────────────────────────────
// Scene cards — spec §I
// ──────────────────────────────────────────────────────────────────────────

/** Minimum dialogue beats per scene card under spec §I. */
export const SPEC_I_MIN_DIALOGUE_BEATS = 4;

/**
 * Spec-§I additive scene-card gates. Like beat-sheet, the existing
 * `validateSceneCards` keeps running and this only adds NEW checks.
 *
 * Premium mode requires every new field; efficient mode treats them as
 * advisory unless the field is partially present (then we still complain
 * about the missing leaves).
 */
export function validateSceneCardsSpecI(
  sceneCards: any[],
  mode: DevModeQualityMode | undefined,
): string[] {
  const issues: string[] = [];
  const isPremium = (mode || "premium") === "premium";

  // Find the irreversible-middle scene by purpose, with index-3-or-2 as
  // fallback. Spec §I requires the visible-damage / emotional-turn /
  // cannot-go-back checks on whichever scene actually carries that role.
  const irreversibleIdx = (() => {
    const byPurpose = sceneCards.findIndex(
      (c) => String(c?.scenePurpose || "") === "irreversible_middle",
    );
    if (byPurpose >= 0) return byPurpose;
    if (sceneCards.length >= 4) return 3;
    if (sceneCards.length >= 3) return 2;
    return -1;
  })();
  const finalIdx = sceneCards.length - 1;
  // Spec §I "Szene 4 braucht Discovery durch Kind" — interpreted as the
  // scene right before the finale (so 4-scene stories still work).
  const discoveryIdx = Math.max(finalIdx - 1, irreversibleIdx);

  sceneCards.forEach((card, index) => {
    const n = Number(card?.scene || index + 1);

    // Stricter dialogue-beat minimum: spec §I requires 4+.
    if (Array.isArray(card?.dialogueBeats) && card.dialogueBeats.length < SPEC_I_MIN_DIALOGUE_BEATS) {
      issues.push(`scene ${n} has fewer than ${SPEC_I_MIN_DIALOGUE_BEATS} dialogue beats (spec §I)`);
    }

    // recurringMotifState — must progress across scenes.
    if (isPremium && !card?.recurringMotifState) {
      issues.push(`scene ${n}.recurringMotifState missing`);
    }
    if (card?.recurringMotifState) {
      const allowed = ["introduced", "misused", "lost", "reinterpreted", "payoff"];
      if (!allowed.includes(String(card.recurringMotifState))) {
        issues.push(`scene ${n}.recurringMotifState invalid: "${card.recurringMotifState}"`);
      }
    }

    // visibleDamage on the irreversible-middle scene.
    if (isPremium && index === irreversibleIdx) {
      if (!String(card?.visibleDamage || "").trim()) {
        issues.push(`scene ${n}.visibleDamage missing (irreversible middle requires concrete damage)`);
      }
      if (!String(card?.emotionalTurn || "").trim()) {
        issues.push(`scene ${n}.emotionalTurn missing`);
      }
      if (!String(card?.cannotGoBackReason || "").trim()) {
        issues.push(`scene ${n}.cannotGoBackReason missing`);
      }
    }

    // Child discovery on the scene right before the finale.
    if (isPremium && index === discoveryIdx) {
      if (!String(card?.childDiscovery || "").trim()) {
        issues.push(`scene ${n}.childDiscovery missing — the children must find the connection`);
      }
      const helperFn = String(card?.helperFunction || "").toLowerCase();
      if (/(explain|erklaer|erklär|loesung|lösung|reveals|enthuellt|enthüllt|tells the answer|sagt die antwort)/i.test(helperFn)) {
        issues.push(`scene ${n}.helperFunction looks like helper-explains-solution`);
      }
    }

    // Final scene must contain childDecision so the resolution is executed by
    // the children, not the helper.
    if (isPremium && index === finalIdx) {
      if (!String(card?.childDecision || "").trim()) {
        issues.push(`scene ${n}.childDecision missing — final action must be a child decision`);
      }
    }
  });

  return issues;
}

// ──────────────────────────────────────────────────────────────────────────
// Issue severity classification
// ──────────────────────────────────────────────────────────────────────────

/**
 * In premium mode, spec-§H/§I issues are hard-reject. In efficient mode they
 * route to the existing repair loop but never abort the run.
 */
export function isHardRejectInPremium(mode: DevModeQualityMode | undefined): boolean {
  return (mode || "premium") === "premium";
}
