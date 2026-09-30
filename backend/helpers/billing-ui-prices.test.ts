import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import type { BillingPlanResource } from '@clerk/shared/types';
// Runtime import keeps frontend sources outside Encore's TypeScript project.
const { formatBillingMoney, priceForPeriod, taleaPlanForSlug } = await import(
  fileURLToPath(new URL('../../frontend/components/subscription/billingPlans.ts', import.meta.url))
);

describe('billing prices and plan mapping', () => {
  test('maps backend-compatible aliases without accepting unrelated products', () => {
    assert.equal(taleaPlanForSlug('user:family'), 'familie');
    assert.equal(taleaPlanForSlug('talea-starter'), 'starter');
    assert.equal(taleaPlanForSlug('premium'), 'premium');
    assert.equal(taleaPlanForSlug('free_user'), 'free');
    assert.equal(taleaPlanForSlug('premiumplus'), undefined);
    assert.equal(taleaPlanForSlug('unknown'), undefined);
  });
  test('preserves the checkout currency and decimal price', () => {
    assert.match(formatBillingMoney({ amount: 999, amountFormatted: '9.99', currency: 'USD', currencySymbol: '$' }), /9,99\sUSD/);
    assert.match(formatBillingMoney({ amount: 7999, amountFormatted: '79.99', currency: 'EUR', currencySymbol: '€' }), /79,99\sEUR/);
  });
  test('never substitutes a monthly or static price for a missing annual offer', () => {
    const fee = { amount: 999, amountFormatted: '9.99', currency: 'USD', currencySymbol: '$' };
    const plan = { fee, annualFee: null } as BillingPlanResource;
    assert.deepEqual(priceForPeriod(plan, 'month'), fee);
    assert.equal(priceForPeriod(plan, 'annual'), null);
    assert.equal(priceForPeriod(undefined, 'month'), null);
  });
});
