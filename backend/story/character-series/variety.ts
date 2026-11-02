/** Source excerpts, not a second model's summary or facts to import into another series. */
export interface SeriesCraftMemory {
  opening: string;
  turnaround: string;
  ending: string;
}

const excerpt = (value: unknown, limit: number) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, limit) : '';

export function seriesCraftMemory(pages: Array<{ content: string }>): SeriesCraftMemory {
  const paragraphs = (text = '') => text.split(/\n\n+/).filter(p => p.trim());
  const last = paragraphs(pages.at(-1)?.content);
  return {
    opening: excerpt(paragraphs(pages[0]?.content).slice(0, 2).join(' '), 350),
    turnaround: excerpt(last.slice(0, 5).join(' '), 500),
    ending: excerpt(last.slice(-2).join(' '), 250),
  };
}

/** Old stories still supply their planned comic mechanisms, without inventing an opening. */
export function seriesCraftHistory(metadata: Record<string, any>, title: string): string | undefined {
  if (!['character-series-v1', 'character-series-quality-v1'].includes(metadata.pipeline)) return undefined;
  const saved = metadata.characterSeriesCraft;
  const fields = saved && typeof saved === 'object'
    ? [['Einstieg', excerpt(saved.opening, 350)], ['Wendepunkt', excerpt(saved.turnaround, 500)], ['Schluss', excerpt(saved.ending, 250)]]
    : [['Geplante Komik', excerpt(Array.isArray(metadata.episode?.plan?.chapters) ? metadata.episode.plan.chapters.map((c: any) => typeof c?.laugh === 'string' ? c.laugh : '').join(' / ') : '', 500)]];
  const content = fields.filter(([, value]) => value).map(([label, value]) => `${label}: „${value}“`).join(' | ');
  return content ? `Erzählmuster ${excerpt(title, 90)}: ${content}` : undefined;
}

export function seriesVarietyContext(recentStories: string[]): string {
  if (!recentStories.length) return '';
  const patterns = recentStories.filter(line => line.startsWith('Erzählmuster ')).slice(0, 3);
  const premises = recentStories.filter(line => !line.startsWith('Erzählmuster ')).slice(0, 5);
  return [
    'RECENT FAMILY STORIES — comparison data across ALL series, never shared continuity:',
    ...premises.map(line => `- ${line.slice(0, 300)}`),
    ...patterns.map(line => `- ${line.slice(0, 1250)}`),
    'Keep today\'s required episode events and recurring personality. Vary the opening action, comic mechanism, failed approach and decisive choice wherever the blueprint leaves room. A new name or prop alone is not variety. Do not import these other worlds, relationships or objects into this series, and never contradict recorded history to manufacture novelty.',
  ].join('\n');
}
