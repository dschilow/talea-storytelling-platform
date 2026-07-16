import { describe, expect, test } from "bun:test";

import { compareMigrationFiles, splitMigrationStatements } from "./migration-order";

describe("migration ordering", () => {
  test("creates the artifact pool before seeding and constraining it", () => {
    const files = [
      "11_add_story_artifacts_unique_constraint.up.sql",
      "10_seed_artifact_pool.up.sql",
      "9_create_artifact_pool.up.sql",
      "12_add_artifact_pool_image.up.sql",
    ];
    expect(files.sort(compareMigrationFiles)).toEqual([
      "9_create_artifact_pool.up.sql",
      "10_seed_artifact_pool.up.sql",
      "11_add_story_artifacts_unique_constraint.up.sql",
      "12_add_artifact_pool_image.up.sql",
    ]);
  });

  test("keeps equal ordinals deterministic", () => {
    const files = ["15_z.up.sql", "15_a.up.sql", "no_prefix.up.sql"];
    expect(files.sort(compareMigrationFiles)).toEqual([
      "15_a.up.sql",
      "15_z.up.sql",
      "no_prefix.up.sql",
    ]);
  });
});

describe("migration SQL splitting", () => {
  test("does not discard artifact CREATE or seed statements after comments", () => {
    const sql = [
      "-- Create artifact pool",
      "CREATE TABLE artifact_pool (id TEXT PRIMARY KEY);",
      "-- Seed it",
      "INSERT INTO artifact_pool (id) VALUES ('artifact_1');",
    ].join("\n");
    expect(splitMigrationStatements(sql)).toEqual([
      "CREATE TABLE artifact_pool (id TEXT PRIMARY KEY)",
      "INSERT INTO artifact_pool (id) VALUES ('artifact_1')",
    ]);
  });

  test("keeps semicolons inside strings and PostgreSQL dollar blocks", () => {
    const sql = [
      "INSERT INTO notes(value) VALUES ('one;two');",
      "DO $$",
      "BEGIN",
      "  PERFORM 1;",
      "  PERFORM 2;",
      "END $$;",
    ].join("\n");
    const statements = splitMigrationStatements(sql);
    expect(statements).toHaveLength(2);
    expect(statements[0]).toContain("'one;two'");
    expect(statements[1]).toContain("PERFORM 1;");
    expect(statements[1]).toContain("PERFORM 2;");
  });
});