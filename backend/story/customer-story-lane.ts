import { CHARACTER_SERIES_ENGINE } from "./character-series/core";

/** Talea-Folge (see episode/craft.ts EPISODE_PIPELINE_ID); kept literal so this module stays free of the writer code. */
export const TALEA_FOLGE_ENGINE = "talea-folge-v1";

export type CustomerStoryLane =
  | { storybookMode: true; storybookEngine: typeof CHARACTER_SERIES_ENGINE; characterSeriesId?: string; avatarIsHero: false }
  | { storybookMode: true; storybookEngine: typeof TALEA_FOLGE_ENGINE }
  | Record<string, never>;

/**
 * The lane a customer story runs on. The wizard offers two (2026-10-28): "Eigene Geschichte" (Talea-Folge) and
 * "Figurenabenteuer" (Figurenserie, the series figure leads, so the avatars are never the sole heroes). Every other
 * lane a request names is admin-only and dropped. A request without a lane (Tavi, an older app) follows the product
 * switch TALEA_CUSTOMER_STORY_ENGINE: talea-folge-v1, or unset the standard pipeline.
 */
export function customerStoryLane(
  requested: { storybookEngine?: string; characterSeriesId?: string },
  productSwitch: string | undefined,
): CustomerStoryLane {
  if (requested.storybookEngine === CHARACTER_SERIES_ENGINE) {
    return { storybookMode: true, storybookEngine: CHARACTER_SERIES_ENGINE, characterSeriesId: requested.characterSeriesId?.slice(0, 100), avatarIsHero: false };
  }
  if (requested.storybookEngine === TALEA_FOLGE_ENGINE || (productSwitch || "").trim() === TALEA_FOLGE_ENGINE) {
    return { storybookMode: true, storybookEngine: TALEA_FOLGE_ENGINE };
  }
  return {};
}
