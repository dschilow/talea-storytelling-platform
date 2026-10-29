// @ts-ignore Bun's test helpers are runtime-only in Encore.
import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';

describe('Haiku 5.5 fallback pricing', () => {
  test('uses the correct input-length tier when the provider does not report a cost', () => {
    // Isolate Encore's runtime-only secret import and avoid affecting other test files' module mocks.
    const source = `
      const { mock } = await import('bun:test');
      mock.module('encore.dev/config', () => ({ secret: () => () => '' }));
      const { getOpenRouterModelPricing } = await import(${JSON.stringify(new URL('./openrouter-generation.ts', import.meta.url).href)});
      const low = getOpenRouterModelPricing('anthropic/claude-haiku-5.5', 100000);
      const high = getOpenRouterModelPricing('anthropic/claude-haiku-5.5', 100001);
      if (low.inputCostPer1M !== 0.1 || low.outputCostPer1M !== 0.5) throw new Error('Wrong normal-context price');
      if (high.inputCostPer1M !== 0.5 || high.outputCostPer1M !== 2.5) throw new Error('Wrong long-context price');
    `;
    const result = spawnSync(process.execPath, ['-e', source], { encoding: 'utf8' });
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });
});
