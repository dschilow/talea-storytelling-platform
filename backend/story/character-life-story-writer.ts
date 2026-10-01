/**
 * The text of a "Talea Origins" story: one writer call, a strict output format,
 * and checks that cost nothing (no second model reads the story).
 *
 * The Dev engine this replaced ran idea lab, beat sheet, scene cards, dialogue
 * plan, draft, polish, validators and repairs: 100,000+ tokens per story. A
 * strong writer (GPT-6.1 Sol) with a good brief writes the same 1,700 words in
 * one call of roughly 7,000 tokens.
 */

import {
  LIFE_STORY_ADVENTURE_WORDS,
  LIFE_STORY_CHAPTER_COUNT,
  LIFE_STORY_INTRO_WORDS,
  LIFE_STORY_SYSTEM_PROMPT,
  LIFE_STORY_TARGET_WORDS,
  buildLifeStoryPrompt,
  type LifeStoryAgeGroup,
  type LifeStoryCharacter,
} from "./character-life-story-prompt";

export interface LifeStoryDraft {
  title: string;
  description: string;
  chapters: Array<{ order: number; title: string; content: string }>;
}

export function buildLifeStoryMessages(character: LifeStoryCharacter, ageGroup: LifeStoryAgeGroup): { system: string; user: string } {
  return { system: LIFE_STORY_SYSTEM_PROMPT, user: buildLifeStoryPrompt(character, ageGroup) };
}

export function countWords(value: string): number {
  return String(value || "").trim().split(/\s+/u).filter(Boolean).length;
}

const CHAPTER_MARKER = /^\s*(?:#+\s*)?\**\s*KAPITEL\s+(\d+)\s*\**\s*[:：.\-–—]?\s*\**\s*(.*?)\s*\**\s*$/i;

function cleanLine(value: string): string {
  return value.replace(/^[\s*_#>"„“]+|[\s*_"“”]+$/g, "").trim();
}

/** Null when the format is broken beyond repair (no title, wrong chapter numbers, an empty chapter). */
export function parseLifeStoryDraft(raw: string, expectedChapters = LIFE_STORY_CHAPTER_COUNT): LifeStoryDraft | null {
  const lines = String(raw || "").replace(/\r\n/g, "\n").split("\n");
  let title = "";
  let description = "";
  const chapters: Array<{ order: number; title: string; lines: string[] }> = [];
  for (const line of lines) {
    const marker = line.match(CHAPTER_MARKER);
    if (marker) {
      chapters.push({ order: Number(marker[1]), title: cleanLine(marker[2]), lines: [] });
      continue;
    }
    if (chapters.length === 0) {
      const head = line.match(/^\s*\**\s*(TITEL|BESCHREIBUNG)\s*\**\s*[:：]\s*(.*)$/i);
      if (head) {
        if (/^TITEL$/i.test(head[1])) title = cleanLine(head[2]);
        else description = cleanLine(head[2]);
      }
      continue;
    }
    chapters[chapters.length - 1].lines.push(line);
  }
  if (!title || chapters.length !== expectedChapters) return null;
  const parsed = chapters.map((chapter, index) => ({
    order: index + 1,
    title: chapter.title || `Kapitel ${index + 1}`,
    content: chapter.lines.join("\n").replace(/\n{3,}/g, "\n\n").replace(/^\s*[-–—_*]{3,}\s*$/gm, "").trim(),
  }));
  if (chapters.some((chapter, index) => chapter.order !== index + 1) || parsed.some((chapter) => countWords(chapter.content) < 40)) return null;
  return { title, description: description || title, chapters: parsed };
}

const TRANSLITERATION = /\b(?:Saetze|Maerchen|ueber|fuer|Koenig|Koenigin|Maenner|Aepfel|Luefte|moechte|koennen|koennte|waehrend|natuerlich|Gruen|gruen|Traeume|Waelder|Haeuser|Tuer|Muetze|Gefuehl|Geraeusch|Raetsel|schoen|groess\w*|spaeter|frueh|zurueck)\b/;

/** Advisory findings stored with the story; the admin sees them next to the word counts. */
export function lifeStoryDraftIssues(draft: LifeStoryDraft, character: Pick<LifeStoryCharacter, "name" | "catchphrase">): string[] {
  const issues: string[] = [];
  const words = draft.chapters.map((chapter) => countWords(chapter.content));
  const intro = words[0] ?? 0;
  const adventure = words.slice(1).reduce((sum, count) => sum + count, 0);
  const total = intro + adventure;
  if (intro < LIFE_STORY_INTRO_WORDS.min * 0.7) issues.push(`Einleitung zu kurz (${intro} Wörter)`);
  if (adventure < LIFE_STORY_ADVENTURE_WORDS.min * 0.8) issues.push(`Abenteuer zu kurz (${adventure} Wörter, Ziel ${LIFE_STORY_ADVENTURE_WORDS.min}–${LIFE_STORY_ADVENTURE_WORDS.max})`);
  if (total > LIFE_STORY_TARGET_WORDS.max * 1.3) issues.push(`Geschichte zu lang (${total} Wörter)`);
  const text = draft.chapters.map((chapter) => chapter.content).join("\n");
  if (TRANSLITERATION.test(text)) issues.push("Umlaut-Umschrift (ae/oe/ue) im Text");
  if (!new RegExp(character.name.split(/\s+/).slice(-1)[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(draft.chapters[0].content)) {
    issues.push("Die Einleitung nennt die Figur nicht beim Namen");
  }
  const catchphrase = String(character.catchphrase || "").trim();
  if (catchphrase) {
    const needle = catchphrase.toLowerCase();
    const uses = text.toLowerCase().split(needle).length - 1;
    if (!draft.chapters[0].content.toLowerCase().includes(needle)) issues.push("Der Lieblingsspruch fehlt in der Einleitung");
    if (uses > 2) issues.push(`Der Lieblingsspruch kommt ${uses}-mal vor (höchstens 2)`);
  }
  return issues;
}
