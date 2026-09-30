/// <reference types="node" />

/**
 * Compares all local Bilderbuch-Modus test runs by writer model.
 *
 *   bun run scripts/storybook-compare.ts [--since 2026-09-28T08-20]
 *
 * Reads Logs/storybook-v2-batch/<batch>/run-N/result.json and prints, per
 * writer: stories, draft/final critic score, writing tokens and cost (draft +
 * revision only), total text cost, and how often the revision was needed.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = join("Logs", "storybook-v2-batch");
const sinceAt = process.argv.indexOf("--since");
const since = sinceAt >= 0 ? process.argv[sinceAt + 1] : "";

type Row = {
  writer: string;
  critic: string;
  draftScore: number | null;
  finalScore: number | null;
  chosen: string;
  writeIn: number;
  writeOut: number;
  writeUSD: number;
  textUSD: number;
  imageUSD: number;
  words: number;
  title: string;
  path: string;
};

const rows: Row[] = [];
for (const batch of (await readdir(root)).sort()) {
  if (since && batch < since) continue;
  for (const run of await readdir(join(root, batch)).catch(() => [] as string[])) {
    const file = join(root, batch, run, "result.json");
    const result = await readFile(file, "utf8").then(JSON.parse).catch(() => null);
    if (!result?.text) continue;
    const writing = (result.ledger || []).filter((stage: any) => /^(draft|draft-retry|revision)(-failed)?$/.test(stage.stage));
    rows.push({
      writer: result.models.writer,
      critic: result.models.critic,
      draftScore: result.text.draftScore,
      finalScore: result.text.benchmarkScore,
      chosen: result.text.chosen,
      writeIn: writing.reduce((sum: number, stage: any) => sum + (stage.usage?.prompt || 0), 0),
      writeOut: writing.reduce((sum: number, stage: any) => sum + (stage.usage?.completion || 0), 0),
      writeUSD: writing.reduce((sum: number, stage: any) => sum + (stage.usage?.costUSD || 0), 0),
      textUSD: result.totals?.costUSD || 0,
      imageUSD: result.imageCostUSD || 0,
      words: result.text.pages.reduce((sum: number, page: any) => sum + String(page.content).split(/\s+/).filter(Boolean).length, 0),
      title: result.text.title,
      path: join(batch, run),
    });
  }
}

const avg = (values: Array<number | null>) => {
  const list = values.filter((value): value is number => typeof value === "number");
  return list.length ? list.reduce((a, b) => a + b, 0) / list.length : NaN;
};

const byWriter = new Map<string, Row[]>();
for (const row of rows) byWriter.set(`${row.writer} | Prüfer ${row.critic}`, [...(byWriter.get(`${row.writer} | Prüfer ${row.critic}`) || []), row]);

console.log("| Autor | Prüfer | n | Note Entwurf | Note Ende | Schreib-Tokens in/out | Schreiben $ | Text gesamt $ | Anteil Schreiben |");
console.log("|---|---|---|---|---|---|---|---|---|");
for (const [key, list] of byWriter) {
  const [writer, critic] = key.split(" | Prüfer ");
  const writeUSD = avg(list.map((r) => r.writeUSD));
  const textUSD = avg(list.map((r) => r.textUSD));
  console.log(`| ${writer} | ${critic} | ${list.length} | ${avg(list.map((r) => r.draftScore)).toFixed(1)} | ${avg(list.map((r) => r.finalScore)).toFixed(1)} | ${Math.round(avg(list.map((r) => r.writeIn)))} / ${Math.round(avg(list.map((r) => r.writeOut)))} | ${writeUSD.toFixed(4)} | ${textUSD.toFixed(4)} | ${Math.round((writeUSD / textUSD) * 100)} % |`);
}
console.log("\nEinzelläufe:");
for (const row of rows) console.log(`- ${row.writer}: „${row.title}“ — Entwurf ${row.draftScore}, Ende ${row.finalScore} (${row.chosen}), ${row.words} Wörter, Text $${row.textUSD.toFixed(4)} → ${row.path}`);
