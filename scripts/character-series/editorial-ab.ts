/**
 * Replays the production editorial review (series-editorial-review) of a finished Figurenabenteuer episode with several
 * critic models. The manuscript comes from a JSON file ({"title","chapters":[{"title","paragraphs":[…]}]}); the series
 * contract is rebuilt for the given series and episode, as the writer and critic saw it.
 *
 *   cd backend; encore exec -- bun --env-file=../.env.local ../scripts/character-series/editorial-ab.ts \
 *     --text <story.json> --series tilda-tueftel [--episode 1] [--models anthropic/claude-haiku-5.5,openai/gpt-6.1-terra] [--runs 2]
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import bibles from '../../backend/story/character-series/series-bibles.json';
import { runCharacterSeriesTextEngine } from '../../backend/story/character-series/engine';
import { SERIES_MODELS, seriesBudget } from '../../backend/story/character-series/authoring';
import { CostLedger, parseJsonObject, type LlmRequest, type StorybookLlm } from '../../backend/story/storybook/llm';
import { createOpenRouterStorybookLlm } from '../../backend/story/storybook/llm-openrouter';
import { buildBrief } from '../../backend/story/storybook/context';

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const series = arg('series') || 'tilda-tueftel';
const episode = Number(arg('episode') || 1);
const runs = Number(arg('runs') || 1);
const models = (arg('models') || `${SERIES_MODELS.critic},openai/gpt-6.1-terra`).split(',');
const story = JSON.parse(await readFile(resolve(process.env.INIT_CWD || process.cwd(), arg('text')!), 'utf8')) as { title: string; chapters: Array<{ title: string; paragraphs: string[] }> };

const bible = bibles.find(b => b.id === series)!;
const heroes = [{ id: 'alexander', name: 'Alexander', age: 8 }, { id: 'adrian', name: 'Adrian', age: 7 }];
const brief = buildBrief({
  config: { avatarIds: heroes.map(h => h.id), storybookMode: true, characterSeriesId: series, genre: 'adventure', setting: 'village', ageGroup: '6-8', length: 'medium', language: 'de', avatarIsHero: false } as any,
  band: '6-8', budget: seriesBudget('medium', '6-8'), heroes: heroes as any,
  candidates: [{ id: bible.characterId, name: bible.characterName, species: 'human', whoTheyAre: 'Serienfigur', personality: [], speechStyle: [], canLead: true } as any],
  artifacts: [], seed: `editorial-ab-${series}`,
});
brief.characterSeries = { bible, logs: [], ...(episode > 1 ? { episodeOverride: episode } : {}) } as any;
const draft = ['IDEE: Eine Folge der Figurenserie.', 'REGEL: Die Regeln der Figurenserie bleiben gültig.', `FIGUR: ${bible.characterName} | pool | ${bible.characterId} | companion`, 'FUNDSTÜCK: kein', `TITEL: ${story.title}`, 'BESCHREIBUNG: Eine gemeinsame Folge.',
  ...story.chapters.map((c, i) => `KAPITEL ${i + 1}: ${c.title}\n${c.paragraphs.join('\n\n')}`)].join('\n');

// Capture the exact production request instead of re-implementing the prompt.
let captured: LlmRequest | undefined;
const fake: StorybookLlm = async request => {
  if (request.stage === 'series-author') return { text: draft, modelUsed: 'replay', usage: { prompt: 0, completion: 0, total: 0, costUSD: 0 }, durationMs: 0 };
  captured = request;
  throw new Error('captured');
};
try { await runCharacterSeriesTextEngine({ brief, llm: fake, models: SERIES_MODELS, ledger: new CostLedger() }); } catch (error) { if (!captured) throw error; }

const llm = createOpenRouterStorybookLlm();
for (const spec of models) {
  for (let run = 1; run <= runs; run++) {
    const started = Date.now();
    try {
      const reply = await llm({ ...captured!, model: spec, fallbackModel: spec, maxTokens: /claude-haiku/.test(spec) ? 16000 : 4000 });
      const issues = parseJsonObject<{ issues: Array<{ severity: string; quote: string; problem: string }> }>(reply.text)?.issues || [];
      console.log(`\n=== ${spec} #${run}  ${((Date.now() - started) / 1000).toFixed(1)} s  ${(reply.usage.costUSD * 100).toFixed(2)} ¢  ${issues.length} issue(s)`);
      for (const issue of issues) console.log(`- [${issue.severity}] „${issue.quote}“\n  ${issue.problem}`);
    } catch (error) {
      console.log(`\n=== ${spec} #${run} ERROR ${String((error as Error).message).slice(0, 200)}`);
    }
  }
}
