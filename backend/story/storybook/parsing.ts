/**
 * Storybook Pipeline — pure parsing of the writer's plain-text output.
 *
 * The writer answers in plain text with page markers rather than JSON: a model
 * that has to escape typographic quotes inside JSON strings spends attention on
 * syntax that belongs in the prose. Parsing is tolerant on purpose — a whole
 * generation must never die on a stray marker.
 */

import type { StorybookPage } from "./types";

const PAGE_MARKER = /^\s*(?:[#*_>\-–—\s]*)(?:SEITE|PAGE|PAGINA|PÁGINA|PAGINE|BLADZIJDE|СТРАНИЦА)\s+(\d+)\s*[:.\-–—]?\s*(?:[#*_\s]*)$/i;
const TITLE_LINE = /^\s*[*_#\s]*(?:TITEL|TITLE|TITRE|TÍTULO|TITOLO|НАЗВАНИЕ)\s*[:：]\s*(.+?)\s*[*_]*\s*$/im;
const DESCRIPTION_LINE = /^\s*[*_#\s]*(?:BESCHREIBUNG|DESCRIPTION|DESCRIPCIÓN|DESCRIZIONE|BESCHRIJVING|ОПИСАНИЕ)\s*[:：]\s*(.+?)\s*[*_]*\s*$/im;

/** Splits a marker-delimited text into pages. Order is taken from the marker. */
export function parsePageBlocks(raw: string): Array<{ order: number; content: string }> {
  const lines = String(raw || "").replace(/\r\n/g, "\n").split("\n");
  const blocks: Array<{ order: number; content: string }> = [];
  let order = 0;
  let buffer: string[] = [];

  const flush = () => {
    if (order > 0) {
      const content = buffer.join("\n").trim();
      if (content) blocks.push({ order, content });
    }
  };

  for (const line of lines) {
    const marker = line.match(PAGE_MARKER);
    if (marker) {
      flush();
      order = Number(marker[1]);
      buffer = [];
      continue;
    }
    if (order > 0) buffer.push(line);
  }
  flush();
  return blocks;
}

/** Removes markdown emphasis and stray heading marks a model may add to prose. */
export function cleanProse(text: string): string {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|\s)\*(\S.*?\S)\*(?=\s|$|[.,!?])/g, "$1$2")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Straight double quotes become German quotation marks „…“, but only on a
 * paragraph whose quotes pair up — an odd count means we cannot know which is
 * which, and a wrong guess is worse than a straight quote.
 */
export function normalizeGermanQuotes(text: string): string {
  return String(text || "")
    .split("\n")
    .map((paragraph) => {
      const count = (paragraph.match(/"/g) || []).length;
      if (count === 0 || count % 2 !== 0) return paragraph;
      let open = true;
      return paragraph.replace(/"/g, () => {
        const mark = open ? "„" : "“";
        open = !open;
        return mark;
      });
    })
    .join("\n");
}

export function parseDraft(
  raw: string,
  expectedPages: number,
  options: { german?: boolean } = {}
): { title: string; description: string; pages: StorybookPage[] } {
  const text = String(raw || "").replace(/\r\n/g, "\n").trim();
  const title = (text.match(TITLE_LINE)?.[1] || "").replace(/^[„"']|[“"']$/g, "").trim();
  const description = (text.match(DESCRIPTION_LINE)?.[1] || "").trim();

  let blocks = parsePageBlocks(text);

  // No markers — split the body into even blocks so a usable story still ships.
  if (blocks.length === 0) {
    const body = text.replace(TITLE_LINE, "").replace(DESCRIPTION_LINE, "").trim();
    const paragraphs = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    const perPage = Math.max(1, Math.ceil(paragraphs.length / Math.max(1, expectedPages)));
    blocks = [];
    for (let index = 0; index < expectedPages; index += 1) {
      const slice = paragraphs.slice(index * perPage, (index + 1) * perPage);
      if (slice.length === 0) break;
      blocks.push({ order: index + 1, content: slice.join("\n\n") });
    }
  }

  // Renumber: a skipped marker must not leave a hole the reader trips over.
  const pages: StorybookPage[] = blocks
    .sort((a, b) => a.order - b.order)
    .map((block, index) => {
      let content = cleanProse(block.content);
      if (options.german) content = normalizeGermanQuotes(content);
      return { order: index + 1, title: `Seite ${index + 1}`, content };
    });

  return { title, description, pages };
}
