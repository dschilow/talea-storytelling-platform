import { describe, expect, test } from 'bun:test';
import path from 'node:path';
import type { BillingPlanResource } from '@clerk/shared/types';
// Runtime import keeps frontend sources outside Encore's TypeScript project.
const { formatBillingMoney, priceForPeriod, taleaPlanForSlug } = await import(
  path.resolve(import.meta.dir, '../../frontend/components/subscription/billingPlans.ts')
);

describe('billing prices and plan mapping', () => {
  test('maps backend-compatible aliases without accepting unrelated products', () => {
    expect(taleaPlanForSlug('user:family')).toBe('familie');
    expect(taleaPlanForSlug('talea-starter')).toBe('starter');
    expect(taleaPlanForSlug('premium')).toBe('premium');
    expect(taleaPlanForSlug('free_user')).toBe('free');
    expect(taleaPlanForSlug('premiumplus')).toBeUndefined();
    expect(taleaPlanForSlug('unknown')).toBeUndefined();
  });
  test('preserves the checkout currency and decimal price', () => {
    expect(formatBillingMoney({ amount: 999, amountFormatted: '9.99', currency: 'USD', currencySymbol: '$' })).toMatch(/9,99\sUSD/);
    expect(formatBillingMoney({ amount: 7999, amountFormatted: '79.99', currency: 'EUR', currencySymbol: '€' })).toMatch(/79,99\sEUR/);
  });
  test('never substitutes a monthly or static price for a missing annual offer', () => {
    const fee = { amount: 999, amountFormatted: '9.99', currency: 'USD', currencySymbol: '$' };
    const plan = { fee, annualFee: null } as BillingPlanResource;
    expect(priceForPeriod(plan, 'month')).toEqual(fee);
    expect(priceForPeriod(plan, 'annual')).toBeNull();
    expect(priceForPeriod(undefined, 'month')).toBeNull();
  });
});
