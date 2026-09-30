import React from 'react';
import { SignedIn } from '@clerk/clerk-react';
import { CheckoutButton, SubscriptionDetailsButton, usePlans, useSubscription } from '@clerk/clerk-react/experimental';
import { ArrowRight, ArrowRightLeft, CalendarDays, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PLAN_TITLES, type SubscriptionPlan } from '../../constants/planCatalog';
import PlanComparisonTable, { type PlanComparisonProps } from './PlanComparisonTable';
import { priceForPeriod, taleaPlanForSlug } from './billingPlans';

const drawerAppearance = {
  elements: {
    drawerBackdrop: 'z-[5000] !fixed', drawerRoot: 'z-[5001] !fixed',
    drawerContent: 'z-[5002] !fixed', modalBackdrop: 'z-[5000] !fixed',
    modalContent: 'z-[5002] !fixed',
  },
};

export default function BillingPlanPicker({ currentPlan, onBillingChange }: {
  currentPlan: SubscriptionPlan;
  onBillingChange: () => void;
}) {
  const catalog = usePlans({ for: 'user', pageSize: 100 });
  const subscription = useSubscription({ for: 'user' });
  const plans: PlanComparisonProps['plans'] = {};
  for (const plan of catalog.data ?? []) {
    const key = taleaPlanForSlug(plan.slug);
    if (key && plan.publiclyVisible && plan.forPayerType === 'user') plans[key] = plan;
  }
  const activeItem = subscription.data?.subscriptionItems.find(item =>
    taleaPlanForSlug(item.plan.slug) === currentPlan && ['active', 'past_due'].includes(item.status));
  const refresh = () => {
    void subscription.revalidate();
    void catalog.revalidate();
    onBillingChange();
  };
  const manageButton = (label: string, fullWidth = false) => (
    <SignedIn>
      <SubscriptionDetailsButton for="user" onSubscriptionCancel={refresh} subscriptionDetailsProps={{ appearance: drawerAppearance }}>
        <Button type="button" variant="outline" className={`min-h-11 rounded-xl whitespace-normal ${fullWidth ? 'w-full' : ''}`}>{label}</Button>
      </SubscriptionDetailsButton>
    </SignedIn>
  );

  return (
    <section id="billing-plan-switcher" className="space-y-6 scroll-mt-8" aria-label="Abo vergleichen und wechseln">
      {catalog.isLoading ? (
        <div role="status" className="rounded-2xl bg-[var(--talea-surface-inset)] p-6 text-sm">Verfügbare Abos und Preise werden geladen …</div>
      ) : catalog.error || !Object.keys(plans).length ? (
        <div role="alert" className="space-y-3 rounded-2xl border border-[var(--talea-border-light)] p-6">
          <p>Die Abo-Preise konnten gerade nicht geladen werden.</p>
          <Button variant="outline" onClick={() => void catalog.revalidate()}>Erneut versuchen</Button>
        </div>
      ) : (
        <PlanComparisonTable currentPlan={currentPlan} plans={plans} renderAction={(plan, period) => {
          const livePlan = plans[plan];
          if (plan === 'free') return currentPlan === 'free'
            ? <Button disabled variant="outline" className="min-h-11 w-full rounded-xl">Dein kostenloser Plan</Button>
            : manageButton('Zum kostenlosen Plan wechseln', true);
          if (plan === currentPlan && (activeItem?.planPeriod === period || activeItem?.canceledAt)) return manageButton('Abo verwalten', true);
          const available = livePlan?.hasBaseFee && priceForPeriod(livePlan, period);
          if (!available || subscription.isLoading || subscription.error || subscription.data === undefined) return (
            <Button disabled variant="outline" className="min-h-11 w-full rounded-xl whitespace-normal">{!available ? 'Nicht verfügbar' : 'Abostatus wird geprüft'}</Button>
          );
          return (
            <SignedIn>
              <CheckoutButton planId={livePlan.id} planPeriod={period} for="user" onSubscriptionComplete={refresh}
                newSubscriptionRedirectUrl="/settings?section=billing&billing=success#/billing"
                checkoutProps={{ appearance: drawerAppearance }}>
                <Button type="button" variant={plan === 'familie' ? 'default' : 'outline'} className="min-h-11 w-full rounded-xl whitespace-normal">
                  {plan === currentPlan ? 'Abrechnung wechseln' : `${PLAN_TITLES[plan]} wählen`}<ArrowRight className="ml-2 h-4 w-4 shrink-0" />
                </Button>
              </CheckoutButton>
            </SignedIn>
          );
        }} />
      )}

      {subscription.error && <div role="alert" className="flex flex-wrap items-center gap-3 text-sm"><p>Dein Abostatus konnte nicht geladen werden.</p><Button variant="outline" onClick={() => void subscription.revalidate()}>Erneut versuchen</Button></div>}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[var(--talea-surface-inset)] p-5">
        <div>
          <p className="font-semibold text-[var(--talea-text-primary)]">Dein Abo bleibt in deiner Hand</p>
          <p className="mt-1 text-sm leading-6 text-[var(--talea-text-secondary)]">Zahlungsdaten, Laufzeit und Kündigung an einem Ort.</p>
          {activeItem?.canceledAt && activeItem.periodEnd && <p className="mt-1 text-sm font-medium">Gekündigt · nutzbar bis {new Intl.DateTimeFormat('de-DE').format(new Date(activeItem.periodEnd))}</p>}
        </div>
        {manageButton('Abo verwalten & kündigen')}
      </div>
      <div className="grid gap-5 text-sm sm:grid-cols-3">
        {[
          { icon: CalendarDays, title: 'Monatlich flexibel', text: 'Jederzeit kündigen. Dein bezahlter Plan bleibt bis zum Ende des laufenden Abrechnungszeitraums nutzbar.' },
          { icon: ArrowRightLeft, title: 'Plan wechseln', text: 'Upgrades gelten sofort, Downgrades zum Ende der Laufzeit. Kosten und Startdatum siehst du vor der Bestätigung.' },
          { icon: CreditCard, title: 'Klar abgerechnet', text: 'Die angezeigte Währung gilt auch beim Bezahlen. Bei USD kann deine Bank Umrechnungsgebühren berechnen.' },
        ].map(({ icon: Icon, title, text }) => <div key={title}><Icon className="mb-2 h-5 w-5 text-[var(--primary)]" /><h4 className="font-semibold text-[var(--talea-text-primary)]">{title}</h4><p className="mt-1 leading-6 text-[var(--talea-text-secondary)]">{text}</p></div>)}
      </div>
    </section>
  );
}
