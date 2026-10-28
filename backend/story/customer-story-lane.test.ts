// @ts-ignore Bun's test helpers are runtime-only in the Encore project.
import { describe, expect, test } from "bun:test";
import { customerStoryLane, TALEA_FOLGE_ENGINE } from "./customer-story-lane";
import { EPISODE_PIPELINE_ID } from "./episode/craft";

describe("customer story lane", () => {
  test("the wizard's two choices reach their pipelines", () => {
    expect(customerStoryLane({ storybookEngine: "talea-folge-v1" }, undefined)).toEqual({ storybookMode: true, storybookEngine: "talea-folge-v1" });
    expect(customerStoryLane({ storybookEngine: "character-series-v1", characterSeriesId: "kapitaen-blubbert" }, undefined))
      .toEqual({ storybookMode: true, storybookEngine: "character-series-v1", characterSeriesId: "kapitaen-blubbert", avatarIsHero: false });
  });

  test("admin-only lanes are dropped; without a lane the product switch decides", () => {
    for (const engine of ["storybook-v2", "chapter-book-v1", "wonder-story-v1", "book-workshop-v1", "something-else"]) {
      expect(customerStoryLane({ storybookEngine: engine }, undefined)).toEqual({});
      expect(customerStoryLane({ storybookEngine: engine }, " talea-folge-v1 ")).toEqual({ storybookMode: true, storybookEngine: "talea-folge-v1" });
    }
    expect(customerStoryLane({}, undefined)).toEqual({});
    expect(customerStoryLane({}, "standard")).toEqual({});
  });

  test("a series id is capped, and the series never loses to the switch", () => {
    const lane = customerStoryLane({ storybookEngine: "character-series-v1", characterSeriesId: "x".repeat(300) }, "talea-folge-v1");
    expect(lane).toMatchObject({ storybookEngine: "character-series-v1" });
    expect((lane as { characterSeriesId: string }).characterSeriesId).toHaveLength(100);
  });

  test("the literal matches the Talea-Folge pipeline id", () => {
    expect(TALEA_FOLGE_ENGINE).toBe(EPISODE_PIPELINE_ID);
  });
});
