import React, { useState } from "react";
import { Check, Crown, Minus, Sparkles, Star, Users } from "lucide-react";
import {
  PLAN_FEATURE_ROWS,
  PLAN_ORDER,
  PLAN_PRICES,
  PLAN_TITLES,
  RECOMMENDED_PLAN,
  formatEuro,
  yearlySavingMonths,
  type SubscriptionPlan,
} from "../../constants/planCatalog";

type BillingInterval = "yearly" | "monthly";

const PLAN_ICONS: Record<SubscriptionPlan, typeof Sparkles> = {
  free: Sparkles,
  starter: Star,
  familie: Users,
  premium: Crown,
};

const PLAN_TAGLINES: Record<SubscriptionPlan, string> = {
  free: "Zum Kennenlernen",
  starter: "Für ein Kind",
  familie: "Für Familien mit bis zu 3 Kindern",
  premium: "Für Vielleser",
};

function PriceBlock({ plan, interval }: { plan: SubscriptionPlan; interval: BillingInterval }) {
  const { monthly, yearly } = PLAN_PRICES[plan];
  if (monthly === 0) {
    return (
      <div>
        <p className="text-3xl font-bold text-[var(--talea-text-primary)]">0 €</p>
        <p className="text-xs text-[var(--talea-text-secondary)]">für immer kostenlos</p>
      </div>
    );
  }
  if (interval === "yearly" && yearly) {
    return (
      <div>
        <p className="text-3xl font-bold text-[var(--talea-text-primary)]">
          {formatEuro(yearly / 12)}
          <span className="text-sm font-medium text-[var(--talea-text-secondary)]"> / Monat</span>
        </p>
        <p className="text-xs text-[var(--talea-text-secondary)]">
          {formatEuro(yearly)} jährlich · {yearlySavingMonths(plan)} Monate geschenkt
        </p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-3xl font-bold text-[var(--talea-text-primary)]">
        {formatEuro(monthly)}
        <span className="text-sm font-medium text-[var(--talea-text-secondary)]"> / Monat</span>
      </p>
      <p className="text-xs text-[var(--talea-text-secondary)]">
        unter {formatEuro(Math.ceil((monthly / 30) * 100) / 100)} pro Tag · monatlich kündbar
      </p>
    </div>
  );
}

function FeatureValue({ value }: { value: string | boolean }) {
  if (value === true) {
    return <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="enthalten" />;
  }
  if (value === false) {
    return <Minus className="h-4 w-4 shrink-0 text-[var(--talea-text-tertiary)]" aria-label="nicht enthalten" />;
  }
  return <span className="text-right font-semibold text-[var(--talea-text-primary)]">{value}</span>;
}

/**
 * Shows every plan with price and all included features. Values come from
 * constants/planCatalog, which mirrors the limits the backend enforces.
 */
export default function PlanComparisonTable({ currentPlan }: { currentPlan?: SubscriptionPlan }) {
  const [interval, setBillingInterval] = useState<BillingInterval>("yearly");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[var(--talea-text-secondary)]">
          Münzen gelten für das ganze Konto und werden nur bei erfolgreicher Erstellung abgezogen.
        </p>
        <div
          role="radiogroup"
          aria-label="Abrechnungszeitraum"
          className="inline-flex rounded-full border border-[var(--talea-border-light)] bg-[var(--talea-surface-inset)] p-1"
        >
          {(["yearly", "monthly"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={interval === option}
              onClick={() => setBillingInterval(option)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                interval === option
                  ? "bg-[var(--primary)] text-white shadow-sm"
                  : "text-[var(--talea-text-secondary)] hover:text-[var(--talea-text-primary)]"
              }`}
            >
              {option === "yearly" ? "Jährlich · 4 Monate gratis" : "Monatlich"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {PLAN_ORDER.map((plan) => {
          const Icon = PLAN_ICONS[plan];
          const recommended = plan === RECOMMENDED_PLAN;
          const isCurrent = plan === currentPlan;
          return (
            <section
              key={plan}
              aria-label={`Plan ${PLAN_TITLES[plan]}`}
              className={`relative flex min-w-0 flex-col rounded-2xl border p-4 ${
                recommended
                  ? "border-[var(--primary)] bg-[var(--talea-surface-primary)] shadow-[var(--talea-shadow-medium)]"
                  : "border-[var(--talea-border-light)] bg-[var(--talea-surface-inset)]/60"
              }`}
            >
              {recommended && (
                <span className="absolute -top-2.5 left-4 rounded-full bg-[var(--primary)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  Beliebteste Wahl
                </span>
              )}
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0 text-[var(--primary)]" />
                  <h4 className="truncate text-base font-bold text-[var(--talea-text-primary)]">{PLAN_TITLES[plan]}</h4>
                </div>
                {isCurrent && (
                  <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                    Dein Plan
                  </span>
                )}
              </div>
              <p className="mb-3 text-xs text-[var(--talea-text-secondary)]">{PLAN_TAGLINES[plan]}</p>
              <PriceBlock plan={plan} interval={interval} />

              <dl className="mt-4 space-y-2 border-t border-[var(--talea-border-light)] pt-3 text-xs">
                {PLAN_FEATURE_ROWS.map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-3">
                    <dt className="min-w-0 text-[var(--talea-text-secondary)]">
                      {row.label}
                      {row.hint && (
                        <span className="block text-[10px] text-[var(--talea-text-tertiary)]">{row.hint}</span>
                      )}
                    </dt>
                    <dd className="flex max-w-[55%] justify-end text-right">
                      <FeatureValue value={row.values[plan]} />
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          );
        })}
      </div>
    </div>
  );
}
