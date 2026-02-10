import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Shield, KeyRound, Sparkles, Ban, Target } from 'lucide-react';
import { toast } from 'sonner';
import { useBackend } from '../../hooks/useBackend';
import { useOptionalUserAccess } from '../../contexts/UserAccessContext';

type KeywordPreset = {
  id: string;
  label: string;
  keywords: string[];
};

type ParentalControlsSnapshot = {
  onboardingCompleted: boolean;
};

export default function ParentalOnboardingScreen() {
  const navigate = useNavigate();
  const backend = useBackend();
  const { refresh } = useOptionalUserAccess();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [themePresets, setThemePresets] = useState<KeywordPreset[]>([]);
  const [goalPresets, setGoalPresets] = useState<KeywordPreset[]>([]);
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [dailyStoryLimit, setDailyStoryLimit] = useState<number>(4);
  const [dailyDokuLimit, setDailyDokuLimit] = useState<number>(3);
  const [enableLimits, setEnableLimits] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await backend.user.getParentalControls();
        const controls = (response as any).controls as ParentalControlsSnapshot;
        if (controls.onboardingCompleted) {
          navigate('/', { replace: true });
          return;
        }
        setThemePresets((response as any).presets?.blockedThemePresets ?? []);
        setGoalPresets((response as any).presets?.goalPresets ?? []);
      } catch (error) {
        console.error('Failed to load parental onboarding data:', error);
        toast.error('Onboarding konnte nicht geladen werden.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [backend, navigate]);

  const togglePresetKeywords = (
    preset: KeywordPreset,
    values: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    const set = new Set(values);
    const allSelected = preset.keywords.every((keyword) => set.has(keyword.toLowerCase()));
    if (allSelected) {
      preset.keywords.forEach((keyword) => set.delete(keyword.toLowerCase()));
    } else {
      preset.keywords.forEach((keyword) => set.add(keyword.toLowerCase()));
    }
    setter(Array.from(set));
  };

  const completeOnboarding = async () => {
    if (!/^\d{4,8}$/.test(pin)) {
      toast.error('PIN muss 4 bis 8 Ziffern haben.');
      return;
    }
    if (pin !== confirmPin) {
      toast.error('PIN und Bestaetigung stimmen nicht ueberein.');
      return;
    }

    try {
      setSaving(true);
      await backend.user.saveParentalControls({
        newPin: pin,
        enabled: true,
        onboardingCompleted: true,
        blockedThemes: selectedThemes,
        learningGoals: selectedGoals,
        dailyStoryLimit: enableLimits ? dailyStoryLimit : null,
        dailyDokuLimit: enableLimits ? dailyDokuLimit : null,
      } as any);
      await refresh();
      toast.success('Eltern-Dashboard aktiviert.');
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Failed to complete parental onboarding:', error);
      toast.error(error instanceof Error ? error.message : 'Onboarding fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[linear-gradient(180deg,#f8f1e8_0%,#f6efe4_100%)] dark:bg-[linear-gradient(180deg,#121a26_0%,#0f1723_100%)]">
        <div className="rounded-2xl border border-[#d6ccc2] bg-[#fffaf3] px-5 py-4 text-sm text-muted-foreground dark:border-[#4b617a] dark:bg-[#18273b]">
          Lade Eltern-Onboarding...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(860px_500px_at_90%_0%,#e3d5ca_0%,transparent_62%),radial-gradient(780px_460px_at_0%_16%,#f5ebe0_0%,transparent_62%),linear-gradient(180deg,#f8f1e8_0%,#f6efe4_100%)] px-4 py-8 dark:bg-[radial-gradient(860px_500px_at_90%_0%,rgba(93,109,133,0.32)_0%,transparent_62%),radial-gradient(780px_460px_at_0%_16%,rgba(78,108,128,0.28)_0%,transparent_62%),linear-gradient(180deg,#121a26_0%,#0f1723_100%)]">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-3xl rounded-3xl border border-[#d6ccc2] bg-[#fffaf3]/95 p-6 shadow-[0_24px_48px_rgba(97,75,54,0.2)] dark:border-[#4b617a] dark:bg-[#18273b]/95"
      >
        <div className="mb-5 flex items-center gap-3">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#d5bdaf] via-[#e3d5ca] to-[#d6ccc2] text-[#2f4058]">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-[#6e8198]">Erststart</p>
            <h1 className="text-4xl leading-none text-[#1f2f44] dark:text-[#eaf2ff]" style={{ fontFamily: '"Cormorant Garamond", serif' }}>
              Eltern-Dashboard Setup
            </h1>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-[#d6ccc2] bg-[#f8f1e8] p-3 text-sm dark:border-[#415774] dark:bg-[#1d2d44]">
            <Ban className="mb-2 h-4 w-4 text-[#5a728d]" />
            Blockiert sensible Themen und Begriffe.
          </div>
          <div className="rounded-2xl border border-[#d6ccc2] bg-[#f8f1e8] p-3 text-sm dark:border-[#415774] dark:bg-[#1d2d44]">
            <Target className="mb-2 h-4 w-4 text-[#5a728d]" />
            Setzt klare Lernziele fuer Storys und Dokus.
          </div>
          <div className="rounded-2xl border border-[#d6ccc2] bg-[#f8f1e8] p-3 text-sm dark:border-[#415774] dark:bg-[#1d2d44]">
            <Sparkles className="mb-2 h-4 w-4 text-[#5a728d]" />
            Schuetzt Tagesverbrauch von Credits.
          </div>
        </div>

        <div className="rounded-2xl border border-[#d6ccc2] bg-[#fff8ef] p-4 dark:border-[#47607c] dark:bg-[#1b2c42]">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold">
            <KeyRound className="h-4 w-4" />
            Eltern-PIN festlegen
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              placeholder="PIN (4-8 Ziffern)"
              className="h-10 rounded-xl border border-[#d6ccc2] bg-white px-3 text-sm outline-none focus:border-[#b79f8e] dark:border-[#4a617a] dark:bg-[#20324a]"
            />
            <input
              type="password"
              inputMode="numeric"
              value={confirmPin}
              onChange={(event) => setConfirmPin(event.target.value)}
              placeholder="PIN bestaetigen"
              className="h-10 rounded-xl border border-[#d6ccc2] bg-white px-3 text-sm outline-none focus:border-[#b79f8e] dark:border-[#4a617a] dark:bg-[#20324a]"
            />
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-[#d6ccc2] bg-[#fff8ef] p-4 dark:border-[#47607c] dark:bg-[#1b2c42]">
          <p className="mb-2 text-sm font-bold">Schnell-Auswahl Tabu-Themen</p>
          <div className="flex flex-wrap gap-2">
            {themePresets.map((preset) => {
              const active = preset.keywords.every((keyword) => selectedThemes.includes(keyword.toLowerCase()));
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => togglePresetKeywords(preset, selectedThemes, setSelectedThemes)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${active ? 'border-[#b79f8e] bg-[#e3d5ca] text-[#2b3a4d]' : 'border-[#d6ccc2] bg-[#f8f1e8] text-[#5a728d] dark:border-[#44607e] dark:bg-[#22364f] dark:text-[#bfd1e8]'}`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-[#d6ccc2] bg-[#fff8ef] p-4 dark:border-[#47607c] dark:bg-[#1b2c42]">
          <p className="mb-2 text-sm font-bold">Schnell-Auswahl Lernziele</p>
          <div className="flex flex-wrap gap-2">
            {goalPresets.map((preset) => {
              const active = preset.keywords.every((keyword) => selectedGoals.includes(keyword.toLowerCase()));
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => togglePresetKeywords(preset, selectedGoals, setSelectedGoals)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${active ? 'border-[#b79f8e] bg-[#e3d5ca] text-[#2b3a4d]' : 'border-[#d6ccc2] bg-[#f8f1e8] text-[#5a728d] dark:border-[#44607e] dark:bg-[#22364f] dark:text-[#bfd1e8]'}`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-[#d6ccc2] bg-[#fff8ef] p-4 dark:border-[#47607c] dark:bg-[#1b2c42]">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold">Tageslimits aktiv</p>
            <button
              type="button"
              onClick={() => setEnableLimits((prev) => !prev)}
              className={`relative h-7 w-14 rounded-full ${enableLimits ? 'bg-[#b79f8e]' : 'bg-[#d6ccc2]'}`}
            >
              <motion.span animate={{ x: enableLimits ? 28 : 2 }} className="absolute top-0.5 h-6 w-6 rounded-full bg-white" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min={0}
              max={30}
              disabled={!enableLimits}
              value={dailyStoryLimit}
              onChange={(event) => setDailyStoryLimit(Number(event.target.value))}
              placeholder="Storys / Tag"
              className="h-10 rounded-xl border border-[#d6ccc2] bg-white px-3 text-sm outline-none focus:border-[#b79f8e] disabled:opacity-50 dark:border-[#4a617a] dark:bg-[#20324a]"
            />
            <input
              type="number"
              min={0}
              max={30}
              disabled={!enableLimits}
              value={dailyDokuLimit}
              onChange={(event) => setDailyDokuLimit(Number(event.target.value))}
              placeholder="Dokus / Tag"
              className="h-10 rounded-xl border border-[#d6ccc2] bg-white px-3 text-sm outline-none focus:border-[#b79f8e] disabled:opacity-50 dark:border-[#4a617a] dark:bg-[#20324a]"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-xl border border-[#d6ccc2] bg-white px-4 py-2 text-sm font-semibold text-[#3f526a] dark:border-[#4b617a] dark:bg-[#20324a] dark:text-[#d8e8fa]"
          >
            Spaeter
          </button>
          <button
            type="button"
            onClick={completeOnboarding}
            disabled={saving}
            className="rounded-xl bg-gradient-to-r from-[#f2d9d6] via-[#e3d5ca] to-[#d5e3cf] px-4 py-2 text-sm font-bold text-[#24354d] disabled:opacity-60"
          >
            {saving ? 'Speichere...' : 'Onboarding abschliessen'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

