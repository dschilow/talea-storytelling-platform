import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { PricingTable, UserProfile } from '@clerk/clerk-react';
import { useTranslation } from 'react-i18next';
import { useBackend } from '../../hooks/useBackend';
import { useUser } from '@clerk/clerk-react';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '../../src/i18n';
import { useTheme } from '../../contexts/ThemeContext';
import { toast } from 'sonner';
import {
  BookOpen,
  Check,
  Clock3,
  CreditCard,
  Crown,
  FileText,
  Globe,
  Headphones,
  Languages,
  Monitor,
  Moon,
  RefreshCcw,
  Settings,
  Sparkles,
  Sun,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

type ThemeOption = 'light' | 'dark' | 'system';
type SubscriptionPlan = 'free' | 'starter' | 'familie' | 'premium';

type CreditUsage = {
  limit: number | null;
  used: number;
  remaining: number | null;
  costPerGeneration: 1;
};

type BillingSnapshot = {
  plan: SubscriptionPlan;
  periodStart: Date;
  storyCredits: CreditUsage;
  dokuCredits: CreditUsage;
  audioCredits: CreditUsage;
  permissions: {
    canReadCommunityDokus: boolean;
    canUseAudioDokus: boolean;
    freeTrialActive: boolean;
    freeTrialEndsAt: Date | null;
    freeTrialDaysRemaining: number;
  };
};

type ProfileSnapshot = {
  subscription: SubscriptionPlan;
  billing: BillingSnapshot;
};

const PLAN_META: Record<
  SubscriptionPlan,
  {
    title: string;
    icon: typeof Sparkles;
    gradient: string;
    storyLimit: string;
    dokuLimit: string;
    audioLimit: string;
    community: string;
  }
> = {
  free: {
    title: 'Free',
    icon: Sparkles,
    gradient: 'from-[#64748B] to-[#94A3B8]',
    storyLimit: '3 / Monat (7 Tage Test)',
    dokuLimit: '3 / Monat (7 Tage Test)',
    audioLimit: '1 / Monat (nur Test)',
    community: 'Nur waehrend Testphase',
  },
  starter: {
    title: 'Starter',
    icon: Sparkles,
    gradient: 'from-[#FF6B9D] to-[#A989F2]',
    storyLimit: '10 / Monat',
    dokuLimit: '10 / Monat',
    audioLimit: '2 / Monat',
    community: 'Ja',
  },
  familie: {
    title: 'Familie',
    icon: Users,
    gradient: 'from-[#2DD4BF] to-[#0EA5E9]',
    storyLimit: '25 / Monat',
    dokuLimit: '25 / Monat',
    audioLimit: '10 / Monat',
    community: 'Ja',
  },
  premium: {
    title: 'Premium',
    icon: Crown,
    gradient: 'from-[#FF9B5C] to-[#FF6B9D]',
    storyLimit: '50 / Monat',
    dokuLimit: '50 / Monat',
    audioLimit: 'Unbegrenzt',
    community: 'Ja',
  },
};

const SettingsBackground: React.FC = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
    <motion.div
      className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-15"
      style={{ background: 'radial-gradient(circle, rgba(169,137,242,0.4) 0%, rgba(255,107,157,0.2) 50%, transparent 70%)' }}
      animate={{ scale: [1, 1.15, 1], x: [0, 20, 0] }}
      transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
    />
    <motion.div
      className="absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full opacity-15"
      style={{ background: 'radial-gradient(circle, rgba(45,212,191,0.3) 0%, transparent 70%)' }}
      animate={{ scale: [1, 1.2, 1], y: [0, -20, 0] }}
      transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
    />
  </div>
);

function LanguageSelector() {
  const { t, i18n } = useTranslation();
  const backend = useBackend();
  const { user, isLoaded } = useUser();
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>(
    (i18n.language as SupportedLanguage) || 'de'
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isLoaded && user && backend) {
      loadUserLanguage();
    }
  }, [isLoaded, user, backend]);

  const loadUserLanguage = async () => {
    try {
      const profile = await backend.user.me();
      if (profile.preferredLanguage) {
        setSelectedLanguage(profile.preferredLanguage);
        i18n.changeLanguage(profile.preferredLanguage);
      }
    } catch (err) {
      console.error('Failed to load user language:', err);
    }
  };

  const handleLanguageChange = async (language: SupportedLanguage) => {
    setIsSaving(true);
    try {
      await backend.user.updateLanguage({ language });
      await i18n.changeLanguage(language);
      setSelectedLanguage(language);
      localStorage.setItem('talea_language', language);
      toast.success(t('settings.saved'));
    } catch (err) {
      console.error('Failed to save language:', err);
      toast.error(t('settings.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#A989F2] to-[#FF6B9D] flex items-center justify-center shadow-md">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
              {t('settings.language')}
            </h2>
            <p className="text-xs text-muted-foreground">{t('settings.languageDescription')}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {SUPPORTED_LANGUAGES.map((lang, i) => (
          <motion.button
            key={lang.code}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleLanguageChange(lang.code)}
            disabled={isSaving}
            className={`relative p-4 rounded-2xl border-2 transition-all ${
              selectedLanguage === lang.code
                ? 'border-[#A989F2] bg-[#A989F2]/10 shadow-lg shadow-[#A989F2]/10'
                : 'border-white/[0.08] bg-white/[0.06] hover:border-[#A989F2]/40 hover:shadow-md hover:bg-white/[0.10]'
            } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {selectedLanguage === lang.code && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-2 right-2 w-6 h-6 bg-[#A989F2] rounded-full flex items-center justify-center shadow-sm"
              >
                <Check className="w-4 h-4 text-white" />
              </motion.div>
            )}
            <div className="flex items-center gap-3">
              <span className="text-3xl">{lang.flag}</span>
              <div className="text-left">
                <div className="font-bold text-foreground">{lang.nativeName}</div>
                <div className="text-sm text-muted-foreground">{lang.name}</div>
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function ThemeSelector() {
  const { t } = useTranslation();
  const { theme, setTheme: setGlobalTheme } = useTheme();

  const handleThemeChange = async (newTheme: ThemeOption) => {
    try {
      await setGlobalTheme(newTheme);
      toast.success(t('settings.saved'));
    } catch (err) {
      console.error('Failed to save theme:', err);
      toast.error(t('settings.saveFailed'));
    }
  };

  const themeOptions = [
    { value: 'light' as ThemeOption, icon: Sun, label: t('settings.light'), description: t('settings.lightDescription') },
    { value: 'dark' as ThemeOption, icon: Moon, label: t('settings.dark'), description: t('settings.darkDescription') },
    { value: 'system' as ThemeOption, icon: Monitor, label: t('settings.system'), description: t('settings.systemDescription') },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF9B5C] to-[#FF6B9D] flex items-center justify-center shadow-md">
            <Sun className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
              {t('settings.themeTitle')}
            </h2>
            <p className="text-xs text-muted-foreground">{t('settings.themeDescription')}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {themeOptions.map((option, i) => {
          const Icon = option.icon;
          return (
            <motion.button
              key={option.value}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleThemeChange(option.value)}
              className={`relative p-5 rounded-2xl border-2 transition-all ${
                theme === option.value
                  ? 'border-[#FF9B5C] bg-[#FF9B5C]/10 shadow-lg shadow-[#FF9B5C]/10'
                  : 'border-white/[0.08] bg-white/[0.06] hover:border-[#FF9B5C]/40 hover:shadow-md hover:bg-white/[0.10]'
              }`}
            >
              {theme === option.value && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-2 right-2 w-6 h-6 bg-[#FF9B5C] rounded-full flex items-center justify-center shadow-sm"
                >
                  <Check className="w-4 h-4 text-white" />
                </motion.div>
              )}
              <div className="flex flex-col items-center gap-3">
                <Icon className="w-8 h-8 text-foreground/80" />
                <div className="text-center">
                  <div className="font-bold text-foreground">{option.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{option.description}</div>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function UsageCard(props: {
  title: string;
  subtitle: string;
  usage: CreditUsage;
  icon: React.ReactNode;
  accentClass: string;
}) {
  const limitText = props.usage.limit === null ? 'unbegrenzt' : String(props.usage.limit);
  const remainingText = props.usage.remaining === null ? 'unbegrenzt' : String(props.usage.remaining);
  const progress =
    props.usage.limit === null
      ? 24
      : props.usage.limit <= 0
      ? 100
      : Math.min(100, Math.round((props.usage.used / props.usage.limit) * 100));

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.06] backdrop-blur-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{props.title}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{props.subtitle}</p>
        </div>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${props.accentClass}`}>{props.icon}</div>
      </div>

      <div className="flex items-end justify-between mb-2">
        <div>
          <p className="text-2xl font-bold text-foreground">{remainingText}</p>
          <p className="text-[11px] text-muted-foreground">verbleibend</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-foreground">{props.usage.used} / {limitText}</p>
          <p className="text-[11px] text-muted-foreground">verbraucht / limit</p>
        </div>
      </div>

      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-[#A989F2] to-[#FF6B9D]" style={{ width: `${progress}%` }} />
      </div>

      <p className="text-[11px] text-muted-foreground mt-2">Kosten: {props.usage.costPerGeneration} Credit pro Generierung</p>
    </div>
  );
}

function BillingPanel() {
  const backend = useBackend();
  const [profile, setProfile] = useState<ProfileSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('free');

  const loadBilling = async () => {
    try {
      setIsLoading(true);
      const nextProfile = (await backend.user.me()) as unknown as ProfileSnapshot;
      setProfile(nextProfile);
      const activePlan = nextProfile.billing?.plan || nextProfile.subscription;
      setSelectedPlan(activePlan || 'free');
    } catch (err) {
      console.error('Failed to load billing profile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBilling();
  }, [backend]);

  const billing = profile?.billing ?? null;
  const currentPlan = billing?.plan ?? profile?.subscription ?? 'free';
  const currentPlanMeta = PLAN_META[currentPlan];
  const CurrentPlanIcon = currentPlanMeta.icon;
  const selectedPlanMeta = PLAN_META[selectedPlan];
  const periodStartLabel = useMemo(() => {
    if (!billing?.periodStart) return '-';
    return new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(new Date(billing.periodStart));
  }, [billing?.periodStart]);

  const scrollToClerkPricing = () => {
    setPlanDialogOpen(false);
    const target = document.getElementById('clerk-pricing-table');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2DD4BF] to-[#0EA5E9] flex items-center justify-center shadow-md">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
              Abo & Credits
            </h2>
            <p className="text-xs text-muted-foreground">Monatliche Credits, Verbrauch und Planwechsel in einem Bereich.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={loadBilling}>
            <RefreshCcw className="w-4 h-4 mr-2" />
            Aktualisieren
          </Button>
          <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
            <DialogTrigger asChild>
              <Button type="button">
                <CreditCard className="w-4 h-4 mr-2" />
                Plan wechseln
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Monatsplan wechseln</DialogTitle>
                <DialogDescription>
                  Waehle einen Plan und oeffne danach Clerk Billing fuer den eigentlichen Wechsel.
                </DialogDescription>
              </DialogHeader>

              <RadioGroup value={selectedPlan} onValueChange={(value) => setSelectedPlan(value as SubscriptionPlan)} className="gap-2">
                {(Object.keys(PLAN_META) as SubscriptionPlan[]).map((plan) => {
                  const meta = PLAN_META[plan];
                  return (
                    <div key={plan} className="relative flex w-full items-center gap-2 rounded-lg border border-input px-4 py-3 shadow-sm shadow-black/5 has-[[data-state=checked]]:border-ring has-[[data-state=checked]]:bg-accent">
                      <RadioGroupItem value={plan} id={`plan-${plan}`} aria-describedby={`plan-${plan}-desc`} className="order-1 after:absolute after:inset-0" />
                      <div className="grid grow gap-1">
                        <Label htmlFor={`plan-${plan}`}>{meta.title}</Label>
                        <p id={`plan-${plan}-desc`} className="text-xs text-muted-foreground">
                          Story: {meta.storyLimit} | Doku: {meta.dokuLimit} | Audio: {meta.audioLimit}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </RadioGroup>

              <div className="rounded-xl border border-white/[0.08] bg-white/[0.05] p-3">
                <p className="text-xs font-semibold text-foreground mb-2">Ausgewaehlter Plan: {selectedPlanMeta.title}</p>
                <p className="text-xs text-muted-foreground">Community-Dokus: {selectedPlanMeta.community}</p>
                <p className="text-xs text-muted-foreground">Audio-Dokus: {selectedPlanMeta.audioLimit}</p>
              </div>

              <div className="grid gap-2">
                <Button type="button" className="w-full" onClick={scrollToClerkPricing}>
                  Zu Clerk Billing
                </Button>
                <DialogClose asChild>
                  <Button type="button" variant="ghost" className="w-full">
                    Schliessen
                  </Button>
                </DialogClose>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.06] p-5 text-sm text-muted-foreground">
          Lade Billing-Daten...
        </div>
      ) : billing ? (
        <>
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.06] backdrop-blur-lg p-5">
            <div className={`absolute -top-14 -right-10 h-32 w-32 rounded-full blur-2xl opacity-40 bg-gradient-to-br ${currentPlanMeta.gradient}`} />
            <div className="relative flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${currentPlanMeta.gradient}`}>
                  <CurrentPlanIcon className="h-5 w-5 text-white" />
                </span>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Aktueller Plan</p>
                  <h3 className="text-xl font-bold text-foreground">{currentPlanMeta.title}</h3>
                  <p className="text-xs text-muted-foreground">Abrechnungsmonat: {periodStartLabel}</p>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${billing.permissions.canReadCommunityDokus ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
                  Community: {billing.permissions.canReadCommunityDokus ? 'aktiv' : 'gesperrt'}
                </span>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${billing.permissions.canUseAudioDokus ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
                  Audio: {billing.permissions.canUseAudioDokus ? 'aktiv' : 'gesperrt'}
                </span>
              </div>
            </div>
          </div>

          {currentPlan === 'free' && (
            <div
              className={`rounded-2xl border p-4 text-sm ${
                billing.permissions.freeTrialActive
                  ? 'border-[#A989F2]/30 bg-[#A989F2]/10 text-foreground'
                  : 'border-rose-500/40 bg-rose-500/10 text-rose-200'
              }`}
            >
              {billing.permissions.freeTrialActive ? (
                <div className="flex items-center gap-2">
                  <Clock3 className="w-4 h-4" />
                  <span>
                    Free-Testphase aktiv: noch {billing.permissions.freeTrialDaysRemaining} Tage.
                    Danach keine Generierung, keine Community-Dokus und keine Audio-Dokus.
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Clock3 className="w-4 h-4" />
                  <span>
                    Free-Testphase abgelaufen. Upgrade auf Starter, Familie oder Premium, um weiter zu generieren.
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <UsageCard
              title="StoryCredits"
              subtitle="1 Story = 1 Credit"
              usage={billing.storyCredits}
              icon={<BookOpen className="w-4 h-4 text-white" />}
              accentClass="bg-gradient-to-br from-[#A989F2] to-[#7C6BE3]"
            />
            <UsageCard
              title="DokuCredits"
              subtitle="1 Doku = 1 Credit"
              usage={billing.dokuCredits}
              icon={<FileText className="w-4 h-4 text-white" />}
              accentClass="bg-gradient-to-br from-[#2DD4BF] to-[#0EA5E9]"
            />
            <UsageCard
              title="AudioCredits"
              subtitle="1 Audio-Doku = 1 Credit"
              usage={billing.audioCredits}
              icon={<Headphones className="w-4 h-4 text-white" />}
              accentClass="bg-gradient-to-br from-[#FF9B5C] to-[#FF6B9D]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {(Object.keys(PLAN_META) as SubscriptionPlan[]).map((plan) => {
              const meta = PLAN_META[plan];
              const PlanIcon = meta.icon;
              const active = currentPlan === plan;
              return (
                <div
                  key={plan}
                  className={`relative rounded-2xl border p-4 ${
                    active
                      ? 'border-[#A989F2] bg-[#A989F2]/10 shadow-lg shadow-[#A989F2]/10'
                      : 'border-white/[0.08] bg-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${meta.gradient}`}>
                        <PlanIcon className="h-4 w-4 text-white" />
                      </span>
                      <p className="text-sm font-bold text-foreground">{meta.title}</p>
                    </div>
                    {active && <span className="text-[10px] font-bold uppercase tracking-wider text-[#A989F2]">Aktiv</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">Story: {meta.storyLimit}</p>
                  <p className="text-xs text-muted-foreground">Doku: {meta.dokuLimit}</p>
                  <p className="text-xs text-muted-foreground">Audio: {meta.audioLimit}</p>
                  <p className="text-xs text-muted-foreground mt-1">Community: {meta.community}</p>
                </div>
              );
            })}
          </div>

          <div id="clerk-pricing-table" className="rounded-2xl border border-dashed border-[#A989F2]/30 bg-white/[0.06] backdrop-blur-lg p-4">
            <div className="mb-3">
              <h3 className="text-sm font-bold text-foreground" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
                Plan in Clerk Billing wechseln
              </h3>
              <p className="text-xs text-muted-foreground">
                Planwechsel ist monatlich moeglich. Nach dem Wechsel werden die Limits automatisch aktualisiert.
              </p>
            </div>
            <div className="rounded-xl overflow-hidden">
              <PricingTable ctaPosition="bottom" newSubscriptionRedirectUrl="/settings?billing=success" />
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.06] p-5 text-sm text-muted-foreground">
          Billing-Daten konnten nicht geladen werden.
        </div>
      )}
    </div>
  );
}

export default function SettingsScreen() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen relative pb-28">
      <SettingsBackground />

      <div className="relative z-10 pt-6">
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#A989F2] to-[#FF6B9D] flex items-center justify-center shadow-xl shadow-[#A989F2]/25"
            >
              <Settings className="w-7 h-7 text-white" />
            </motion.div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
                {t('settings.title')}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">{t('settings.subtitle')}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="rounded-3xl bg-white/[0.06] backdrop-blur-xl border border-white/[0.08] shadow-xl overflow-hidden"
        >
          <UserProfile
            appearance={{
              baseTheme: undefined,
              elements: {
                rootBox: 'w-full',
                card: 'shadow-none bg-transparent',
                navbar: 'bg-white/[0.04] backdrop-blur-lg border-r border-white/[0.06]',
                navbarButton: 'text-foreground/70 hover:bg-white/[0.08] rounded-xl transition-all',
                navbarButtonActive: 'bg-[#A989F2]/10 text-[#A989F2] font-semibold',
                pageScrollBox: 'bg-transparent',
                page: 'bg-transparent',
                formButtonPrimary: 'bg-gradient-to-r from-[#A989F2] to-[#FF6B9D] hover:opacity-90 text-white rounded-xl shadow-lg',
                formFieldInput: 'rounded-xl border-white/[0.08] bg-white/[0.06] backdrop-blur-lg',
              },
            }}
          >
            <UserProfile.Page
              label={t('settings.language')}
              labelIcon={<Languages className="w-4 h-4" />}
              url="language"
            >
              <LanguageSelector />
            </UserProfile.Page>

            <UserProfile.Page
              label={t('settings.appearance')}
              labelIcon={<Sun className="w-4 h-4" />}
              url="appearance"
            >
              <ThemeSelector />
            </UserProfile.Page>

            <UserProfile.Page
              label={`${t('settings.subscription')} & ${t('settings.billing')}`}
              labelIcon={<CreditCard className="w-4 h-4" />}
              url="billing"
            >
              <BillingPanel />
            </UserProfile.Page>
          </UserProfile>
        </motion.div>
      </div>
    </div>
  );
}
