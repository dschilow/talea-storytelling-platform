import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronDown, Crown, Headphones, Minus, Sparkles, Star, Users } from 'lucide-react';
import type { BillingPlanResource, BillingSubscriptionPlanPeriod } from '@clerk/shared/types';
import {
  AUDIO_ACCESS_LABELS, FREE_TRIAL_DAYS, FREE_TRIAL_QUOTAS, PLAN_AUDIO_LIBRARY_ACCESS,
  PLAN_DAILY_LIMITS, PLAN_FEATURE_ROWS, PLAN_ORDER, PLAN_PROFILE_LIMITS, PLAN_QUOTAS,
  PLAN_TAVI_MESSAGES, PLAN_TITLES, RECOMMENDED_PLAN, type SubscriptionPlan,
} from '../../constants/planCatalog';
import { formatBillingMoney, priceForPeriod } from './billingPlans';

const PLAN_ICONS = { free: Sparkles, starter: Star, familie: Users, premium: Crown };
const PLAN_TAGLINES = {
  free: 'Einfach mal eintauchen', starter: 'Für kleine Entdecker',
  familie: 'Gemeinsam mehr erleben', premium: 'Für große Geschichtenfans',
};

function FeatureValue({ value }: { value: string | boolean }) {
  if (typeof value === 'string') return <>{value}</>;
  return value ? (
    <><Check className="mx-auto h-4 w-4 text-[var(--primary)]" /><span className="sr-only">Enthalten</span></>
  ) : (
    <><Minus className="mx-auto h-4 w-4" /><span className="sr-only">Nicht enthalten</span></>
  );
}

export type PlanComparisonProps = {
  currentPlan?: SubscriptionPlan;
  plans: Partial<Record<SubscriptionPlan, BillingPlanResource>>;
  renderAction: (plan: SubscriptionPlan, period: BillingSubscriptionPlanPeriod) => React.ReactNode;
};

export default function PlanComparisonTable({ currentPlan, plans, renderAction }: PlanComparisonProps) {
  const [period, setPeriod] = useState<BillingSubscriptionPlanPeriod>('month');
  const reducedMotion = useReducedMotion();
  const hasAnnual = Object.values(plans).some(plan => plan?.hasBaseFee && plan.annualFee);
  const selectedPeriod = hasAnnual ? period : 'month';

  return (
    <div className="talea-plan-comparison space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--talea-text-secondary)]">Mehr Raum für Fantasie</p>
          <h3 className="mt-2 text-3xl font-semibold text-[var(--talea-text-primary)]" style={{ fontFamily: 'var(--talea-font-display)' }}>Welcher Plan passt zu euch?</h3>
          <p className="mt-2 text-sm text-[var(--talea-text-secondary)]">Alle Kontingente auf einen Blick. Deinen Plan wählst du direkt hier.</p>
        </div>
        {hasAnnual && (
          <div className="inline-flex rounded-full border border-[var(--talea-border-light)] bg-[var(--talea-surface-inset)] p-1" role="group" aria-label="Abrechnungszeitraum">
            {(['month', 'annual'] as const).map(option => (
              <button key={option} type="button" aria-pressed={selectedPeriod === option} onClick={() => setPeriod(option)} className={`relative min-h-11 rounded-full px-5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] ${selectedPeriod === option ? 'text-[var(--talea-text-primary)]' : 'text-[var(--talea-text-secondary)]'}`}>
                {selectedPeriod === option && <motion.span layoutId="billing-period" transition={{ duration: reducedMotion ? 0 : 0.2 }} className="absolute inset-0 rounded-full bg-[var(--talea-surface-primary)] shadow-sm" />}
                <span className="relative">{option === 'month' ? 'Monatlich' : 'Jährlich'}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="flex items-start gap-2 text-sm leading-6 text-[var(--talea-text-secondary)]" aria-live="polite">
        <Check className="mt-1 h-4 w-4 shrink-0 text-[var(--primary)]" />
        {selectedPeriod === 'month' ? 'Monatlich abgerechnet. Jederzeit zum Ende des laufenden Monatszeitraums kündbar.' : 'Einmal jährlich abgerechnet. Kündigung zum Ende des bezahlten Jahres möglich.'}
      </p>

      <div className="talea-plan-grid">
        {PLAN_ORDER.map((plan, index) => {
          const Icon = PLAN_ICONS[plan];
          const recommended = plan === RECOMMENDED_PLAN;
          const price = priceForPeriod(plans[plan], selectedPeriod);
          const monthlyPrice = plans[plan]?.annualMonthlyFee;
          return (
            <motion.section key={plan} aria-label={`Plan ${PLAN_TITLES[plan]}`} initial={reducedMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: reducedMotion ? 0 : index * 0.04 }} className={`flex min-w-0 flex-col rounded-3xl border p-5 ${recommended ? 'border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_7%,var(--talea-surface-primary))] shadow-[var(--talea-shadow-soft)]' : 'border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)]'}`}>
              <div className="mb-5 flex min-h-6 flex-wrap items-center justify-between gap-2 text-xs font-semibold">
                <span className={recommended ? 'text-[var(--talea-text-primary)]' : 'text-[var(--talea-text-secondary)]'}>{recommended ? 'Für die ganze Familie' : plan === 'free' ? 'Kostenlos starten' : 'Dein Geschichtenalltag'}</span>
                {currentPlan === plan && <span className="rounded-full bg-[var(--talea-surface-inset)] px-2 py-1 text-[var(--talea-text-primary)]">Dein Plan</span>}
              </div>
              <Icon className="mb-3 h-6 w-6 text-[var(--primary)]" aria-hidden="true" />
              <h4 className="text-2xl font-semibold text-[var(--talea-text-primary)]" style={{ fontFamily: 'var(--talea-font-display)' }}>{PLAN_TITLES[plan]}</h4>
              <p className="mt-1 text-sm text-[var(--talea-text-secondary)]">{PLAN_TAGLINES[plan]}</p>
              <div className="my-6 min-h-24" aria-live="polite">
                <p className="text-3xl font-bold tracking-tight text-[var(--talea-text-primary)]">{plan === 'free' ? 'Kostenlos' : price ? formatBillingMoney(price) : '—'}</p>
                <p className="mt-1 text-sm text-[var(--talea-text-secondary)]">{plan === 'free' ? 'Ohne kostenpflichtiges Abo' : price ? selectedPeriod === 'annual' ? 'pro Jahr · jährlich abgerechnet' : 'pro Monat · monatlich abgerechnet' : selectedPeriod === 'annual' && plans[plan] ? 'Jahresabo nicht verfügbar' : 'Zurzeit nicht buchbar'}</p>
                {plan !== 'free' && selectedPeriod === 'annual' && price && monthlyPrice && <p className="mt-1 text-xs text-[var(--talea-text-secondary)]">Entspricht {formatBillingMoney(monthlyPrice)} / Monat</p>}
              </div>
              <dl className="grid grid-cols-2 gap-3 border-y border-[var(--talea-border-light)] py-5">
                <div className="flex flex-col">
                  <dt className="order-2 mt-1 text-sm text-[var(--talea-text-secondary)]">Geschichten</dt>
                  <dd className="text-3xl font-semibold tabular-nums text-[var(--talea-text-primary)]">{PLAN_QUOTAS[plan].stories}</dd>
                </div>
                <div className="flex flex-col">
                  <dt className="order-2 mt-1 text-sm text-[var(--talea-text-secondary)]">Dokus</dt>
                  <dd className="text-3xl font-semibold tabular-nums text-[var(--talea-text-primary)]">{PLAN_QUOTAS[plan].dokus}</dd>
                </div>
              </dl>
              <p className="mt-2 text-xs leading-5 text-[var(--talea-text-secondary)]">Pro Monat · jeweils max. {PLAN_DAILY_LIMITS[plan].stories} pro Tag</p>
              <ul className="my-5 space-y-3 text-sm text-[var(--talea-text-primary)]">
                <li className="flex items-start gap-2"><Users className="mt-0.5 h-4 w-4 shrink-0 text-[var(--talea-text-secondary)]" />{PLAN_PROFILE_LIMITS[plan]} {PLAN_PROFILE_LIMITS[plan] === 1 ? 'Kinderprofil' : 'Kinderprofile'}</li>
                <li className="flex items-start gap-2"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--talea-text-secondary)]" />{PLAN_TAVI_MESSAGES[plan]} Tavi-Nachrichten / Monat</li>
                <li className="flex items-start gap-2"><Headphones className="mt-0.5 h-4 w-4 shrink-0 text-[var(--talea-text-secondary)]" />{AUDIO_ACCESS_LABELS[PLAN_AUDIO_LIBRARY_ACCESS[plan]]}</li>
              </ul>
              {plan === 'free' && <p className="mb-4 text-xs leading-5 text-[var(--talea-text-secondary)]">Zum Einstieg: {FREE_TRIAL_QUOTAS.stories} Geschichten und {FREE_TRIAL_QUOTAS.dokus} Dokus in {FREE_TRIAL_DAYS} Tagen. Danach gilt das monatliche Kontingent.</p>}
              <div className="mt-auto pt-2">{renderAction(plan, selectedPeriod)}</div>
            </motion.section>
          );
        })}
      </div>

      <p className="text-xs leading-5 text-[var(--talea-text-secondary)]">Kontingente gelten für alle Kinderprofile zusammen – auch beim Jahresabo pro Monat. Eine erfolgreich erstellte Geschichte oder Doku verbraucht eine Münze.</p>

      <details className="group border-y border-[var(--talea-border-light)]">
        <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-semibold text-[var(--talea-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)]">Alle Leistungen im Detail vergleichen<ChevronDown className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" /></summary>
        <div className="relative overflow-x-auto pb-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)]" tabIndex={0} role="region" aria-label="Vergleich aller Leistungen, horizontal scrollbar">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <caption className="sr-only">Leistungen und Kontingente der Talea-Abos</caption>
            <thead>
              <tr className="border-b border-[var(--talea-border-light)]">
                <th scope="col" className="p-3 text-left">Leistung</th>
                {PLAN_ORDER.map(plan => (
                  <th key={plan} scope="col" className={`p-3 text-center ${plan === RECOMMENDED_PLAN ? 'bg-[var(--talea-surface-inset)]' : ''}`}>{PLAN_TITLES[plan]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLAN_FEATURE_ROWS.map(row => (
                <tr key={row.label} className="border-b border-[var(--talea-border-light)] last:border-0">
                  <th scope="row" className="max-w-64 p-3 text-left font-medium">
                    {row.label}
                    {row.hint && <span className="mt-1 block text-xs font-normal text-[var(--talea-text-secondary)]">{row.hint}</span>}
                  </th>
                  {PLAN_ORDER.map(plan => (
                    <td key={plan} className={`p-3 text-center ${plan === RECOMMENDED_PLAN ? 'bg-[var(--talea-surface-inset)]' : ''}`}>
                      <FeatureValue value={row.values[plan]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
