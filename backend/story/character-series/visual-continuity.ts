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
    result.push({ name: item.name.trim(), aliases, appearance: item.appearance.trim(), evidence });
    if (result.length === 4) break;
  }
  return result;
}

/** Only a prop already selected by the scene is described; mentioning a design must never summon another prop. */
export function seriesShotContinuity(contracts: SeriesVisualContract[], shot: IllustrationShot): SeriesVisualContract[] {
  return contracts.filter(contract => contract.aliases.some(alias => contains(shot.scene, alias)));
}

export function seriesVisualContractText(contracts: SeriesVisualContract[]): string {
  return contracts.map(contract => `${contract.name}: ${contract.appearance}`).join('\n');
}
