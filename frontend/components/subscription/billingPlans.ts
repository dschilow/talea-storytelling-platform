import type { BillingMoneyAmount, BillingPlanResource, BillingSubscriptionPlanPeriod } from '@clerk/shared/types';
import type { SubscriptionPlan } from '../../constants/planCatalog';

// Match the aliases accepted by backend/helpers/billing.ts. Never assign quotas
// to an unknown product or silently substitute another product's checkout ID.
export function taleaPlanForSlug(slug: string): SubscriptionPlan | undefined {
  const value = slug.toLowerCase().trim().split(':').pop() ?? '';
  for (const [plan, aliases] of [
    ['premium', ['premium']], ['familie', ['familie', 'family']],
    ['starter', ['starter']], ['free', ['free', 'kostenlos']],
  ] as const) {
    if (aliases.some(alias => new RegExp(`(^|[^a-z])${alias}([^a-z]|$)`).test(value))) return plan;
  }
  return undefined;
}

export function priceForPeriod(plan: BillingPlanResource | undefined, period: BillingSubscriptionPlanPeriod) {
  return plan ? (period === 'annual' ? plan.annualFee : plan.fee) : null;
}

export function formatBillingMoney(money: BillingMoneyAmount): string {
  // Clerk supplies the decimal amount as well as minor units; use the decimal
  // string to avoid assuming every currency has two fractional digits.
  return new Intl.NumberFormat('de-DE', {
    style: 'currency', currency: money.currency, currencyDisplay: 'code',
  }).format(Number(money.amountFormatted));
}
