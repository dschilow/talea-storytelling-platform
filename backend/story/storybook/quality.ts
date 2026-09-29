import type { TextEngineResult } from "./engine";
import { isPublishable, type StorybookImagesResult } from "./images";

/** Readiness describes the delivered book, not just its text's deterministic checks. */
export function storybookQuality(text: Pick<TextEngineResult, "finalChecks" | "textQuality" | "review">, images: StorybookImagesResult, pageOrders: number[]) {
  const textStatus = text.finalChecks.hard.length ? "failed" : text.textQuality?.status || "unverified";
  const outcomes = [images.cover, ...pageOrders.map((page) => images.pages.get(page))];
  // Every page carries a printable picture; soft flaws and vignettes are listed, not hidden.
  const imagesReady = outcomes.every((outcome) => isPublishable(outcome));
  return {
    releaseReady: textStatus === "passed" && imagesReady,
    textStatus,
    imagesReady,
    acceptedImages: outcomes.filter((outcome) => isPublishable(outcome)).length,
    imageIssues: outcomes.flatMap((outcome, index) => outcome?.status === "passed" && outcome.url && !outcome.vignette ? [] : [{
      page: index === 0 ? 0 : pageOrders[index - 1], status: outcome?.status || "missing", severity: outcome?.severity ?? 999,
      ...(outcome?.vignette ? { vignette: true } : {}),
    }]),
  };
}
