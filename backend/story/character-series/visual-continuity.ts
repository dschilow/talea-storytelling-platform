import type { IllustrationShot, StorybookPage } from '../storybook/types';

/** A shared design from the finished prose; it uses no extra image or reference-sheet cell. */
export interface SeriesVisualContract {
  name: string;
  aliases: string[];
  appearance: string;
  evidence: Array<{ page: number; quote: string }>;
}

const norm = (value: string) => value.normalize('NFC').toLocaleLowerCase('de-DE').replace(/\s+/g, ' ').trim();
const contains = (text: string, alias: string) => new RegExp(`(?<![\\p{L}\\p{N}])${norm(alias).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'u').test(norm(text));

interface DesignPart { sep: string; text: string }

/**
 * A design in clauses, each with the separator before it: semicolons, sentence ends, the comma before a new part, or
 * (`everyComma`) every comma, so "…, each with a small handle, standing on the board" loses only its board.
 */
function designParts(appearance: string, everyComma = false): DesignPart[] {
  const tokens = appearance.split(everyComma ? /(;\s*|(?<=\.)\s+|,\s*)/ : /(;\s*|(?<=\.)\s+|,\s*(?=(?:with|which|that|and|but|so|each|plus)\s))/i);
  const parts: DesignPart[] = [{ sep: '', text: tokens[0] }];
  for (let i = 1; i < tokens.length; i += 2) parts.push({ sep: tokens[i], text: tokens[i + 1] ?? '' });
  return parts;
}

function joinDesign(parts: DesignPart[], original: string): string {
  const text = parts.map((part, index) => (index ? part.sep : '') + part.text).join('').trim().replace(/[\s,;]+$/, '');
  return /[.!]$/.test(text) || !/[.!]\s*$/.test(original) ? text : `${text}.`;
}

// What the magic does to an object, from the start of that phrase to the clause's end.
const CHANGE = /(?:^|[\s,]+)(?:(?:that|which|and|but|so|it|they|its|their|each)\s+)*(?:(?:can|could|may|might|will|is able to|are able to)\s+(?:\w+\s+){0,2}(?:grow|shrink|swell|stretch|expand|change|turn|become|transform|double|multiply)\w*|(?:grows?|grew|shrinks?|shrank|swells?|expands?|transforms?|turns?\s+into|becomes?))\b.*$/i;

/**
 * The design as the story first shows the object. Pilot "Die Gans versperrt den Ausgang" (2026-11-06): Luna wrote
 * "Three wooden goose pieces …; they can grow from small game pieces to enormous geese" and the design line went into
 * every picture of the geese — FLUX painted flocks of living geese before anything had grown. The size of a page is its
 * caption's business.
 */
export function stableDesign(appearance: string): string {
  const parts = designParts(appearance);
  let changed = false;
  const kept = parts.flatMap((part, index) => {
    const cut = part.text.replace(CHANGE, '').trim();
    if (cut === part.text.trim()) return [part];
    changed = true;
    // The first clause says what the object is; it stays, shortened when the change only trails it.
    return cut.length >= 12 ? [{ ...part, text: cut }] : index === 0 ? [part] : [];
  });
  return changed ? joinDesign(kept, appearance) : appearance;
}

/** Ignore malformed/invented auxiliary facts rather than losing a valid paid manuscript or drawing invented objects. */
export function readSeriesVisualContracts(raw: unknown, pages: StorybookPage[]): SeriesVisualContract[] {
  if (!Array.isArray(raw)) return [];
  const result: SeriesVisualContract[] = [];
  for (const item of raw.slice(0, 8)) {
    if (typeof item?.name !== 'string' || item.name.trim().length < 3 || item.name.length > 80
      || typeof item.appearance !== 'string' || item.appearance.trim().length < 12 || item.appearance.length > 400) continue;
    const aliases: string[] = [...new Set<string>([item.name.trim(), ...(Array.isArray(item.aliases)
      ? item.aliases.filter((a: unknown): a is string => typeof a === 'string' && a.trim().length >= 3 && a.length <= 80).slice(0, 6).map((a: string) => a.trim()) : [])])];
    const evidence: SeriesVisualContract['evidence'] = [];
    for (const citation of Array.isArray(item.evidence) ? item.evidence.slice(0, 4) : []) {
      const source = pages.find(page => page.order === citation?.page)?.content;
      if (typeof citation?.quote !== 'string' || citation.quote.length < 12 || citation.quote.length > 500 || !source
        || !norm(source).includes(norm(citation.quote)) || !aliases.some(alias => contains(citation.quote, alias))) continue;
      evidence.push({ page: citation.page, quote: citation.quote });
    }
    if (!evidence.length || result.some(contract => contract.aliases.some(alias => aliases.some(a => norm(a) === norm(alias))))) continue;
    result.push({ name: item.name.trim(), aliases, appearance: stableDesign(item.appearance.trim()), evidence });
    if (result.length === 4) break;
  }
  return result;
}

const IRREGULAR: Record<string, string> = { goose: 'geese', mouse: 'mice', wolf: 'wolves', leaf: 'leaves', loaf: 'loaves', knife: 'knives', shelf: 'shelves', elf: 'elves', die: 'dice' };
/** The words a design of this object is named by: the last word of each alias, with its plural or singular. */
function headWords(contract: SeriesVisualContract): Set<string> {
  const words = new Set<string>();
  for (const alias of [contract.name, ...contract.aliases]) {
    const head = norm(alias).match(/([\p{L}]{4,})$/u)?.[1];
    if (!head) continue;
    words.add(head);
    const singular = Object.entries(IRREGULAR).find(([, many]) => many === head)?.[0]
      || (/(?:s|x|z|ch|sh)es$/.test(head) ? head.slice(0, -2) : /[^s]s$/.test(head) ? head.slice(0, -1) : head);
    words.add(singular);
    words.add(IRREGULAR[singular] || (/(?:s|x|z|ch|sh)$/.test(singular) ? `${singular}es` : `${singular}s`));
  }
  return words;
}

/**
 * Only a prop already selected by the scene is described; mentioning a design must never summon another prop. Pilot
 * 2026-11-06: the board's design "with grooves for the sliding geese" went into a picture without geese, which came back
 * with eight goose pieces on the board. A clause naming an object that is not in the scene leaves the design (never
 * its first clause, which says what the object is).
 */
export function seriesShotContinuity(contracts: SeriesVisualContract[], shot: IllustrationShot): SeriesVisualContract[] {
  const inShot = contracts.filter(contract => contract.aliases.some(alias => contains(shot.scene, alias)));
  return inShot.map(contract => {
    const own = headWords(contract);
    const foreign = [...new Set(contracts.filter(other => !inShot.includes(other)).flatMap(other => [...headWords(other)]))].filter(word => !own.has(word));
    if (!foreign.length) return contract;
    const parts = designParts(contract.appearance, true);
    const kept = parts.filter((part, index) => index === 0 || !foreign.some(word => contains(part.text, word)));
    return kept.length === parts.length ? contract : { ...contract, appearance: joinDesign(kept, contract.appearance) };
  });
}

export function seriesVisualContractText(contracts: SeriesVisualContract[]): string {
  return contracts.map(contract => `${contract.name}: ${contract.appearance}`).join('\n');
}
