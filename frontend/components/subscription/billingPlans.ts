import { usePlans } from '@clerk/clerk-react/experimental';
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

// Clerk answers a period that is not offered with an amount of 0 rather than
// leaving it out, so a zero amount means "not bookable", never "free".
export function priceForPeriod(plan: BillingPlanResource | undefined, period: BillingSubscriptionPlanPeriod) {
  const money = plan ? (period === 'annual' ? plan.annualFee : plan.fee) : null;
  return money && money.amount > 0 ? money : null;
}

export function formatBillingMoney(money: BillingMoneyAmount): string {
  // Clerk supplies the decimal amount as well as minor units; use the decimal
  // string to avoid assuming every currency has two fractional digits.
  return new Intl.NumberFormat('de-DE', {
    style: 'currency', currency: money.currency, currencyDisplay: 'code',
  }).format(Number(money.amountFormatted));
}

/** The plans families can book, keyed by Talea plan, exactly as Clerk will charge them. */
export function useBookablePlans() {
  const catalog = usePlans({ for: 'user', pageSize: 100 });
  const plans: Partial<Record<SubscriptionPlan, BillingPlanResource>> = {};
  for (const plan of catalog.data ?? []) {
    const key = taleaPlanForSlug(plan.slug);
    if (key && plan.publiclyVisible && plan.forPayerType === 'user') plans[key] = plan;
  }
  const hasAnnual = Object.values(plans).some(plan => priceForPeriod(plan, 'annual'));
  return { catalog, plans, hasAnnual };
}
