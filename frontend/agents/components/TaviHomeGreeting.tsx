import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { agentDefinitions } from '../registry';
import { AgentIcon } from '../icons/AgentIcons';
import { AgentAnimation } from '../animations/AgentAnimations';

interface TaviHomeGreetingProps {
  userName?: string | null;
  storyCount?: number;
  avatarCount?: number;
  className?: string;
}

const greetings = [
  (name: string) => `Willkommen zurück, ${name}. Was möchtest du heute erleben?`,
  (name: string) => `Schön, dass du da bist, ${name}. Tavi hat auf dich gewartet.`,
  (name: string) => `${name}, deine Abenteuer warten. Wohin soll die Reise gehen?`,
  (name: string) => `Hallo ${name}! Tavi freut sich, dich wiederzusehen.`,
];

const firstTimeGreetings = [
  (name: string) => `Hallo ${name}! Tavi ist dein Begleiter in der Welt von Talea.`,
  (name: string) => `Willkommen, ${name}! Tavi hilft dir, magische Geschichten zu erleben.`,
];

const hints = [
  { text: 'Erstelle einen Avatar, um dein erstes Abenteuer zu starten.', condition: (p: TaviHomeGreetingProps) => (p.avatarCount ?? 0) === 0 },
  { text: 'Dein erster Avatar wartet auf eine Geschichte!', condition: (p: TaviHomeGreetingProps) => (p.avatarCount ?? 0) > 0 && (p.storyCount ?? 0) === 0 },
  { text: 'Die Flüsterfeder erinnert sich an deine bisherigen Abenteuer.', condition: (p: TaviHomeGreetingProps) => (p.storyCount ?? 0) > 3 },
];

/**
 * Tavi greeting card for the home screen.
 * Shows Tavi as a warm, contextual presence — not a static badge.
 */
export function TaviHomeGreeting({ userName, storyCount, avatarCount, className }: TaviHomeGreetingProps) {
  const tavi = agentDefinitions.tavi;
  const name = userName || 'Entdecker';
  const isFirstTime = (storyCount ?? 0) === 0 && (avatarCount ?? 0) === 0;

  const greeting = useMemo(() => {
    const pool = isFirstTime ? firstTimeGreetings : greetings;
    return pool[Math.floor(Math.random() * pool.length)](name);
  }, [name, isFirstTime]);

  const hint = useMemo(() => {
    const props = { userName, storyCount, avatarCount };
    return hints.find(h => h.condition(props))?.text;
  }, [storyCount, avatarCount]);

  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className={className}
          style={{
            background: tavi.colorPalette.gradient,
            border: `1px solid ${tavi.colorPalette.border}`,
            boxShadow: `0 8px 32px ${tavi.colorPalette.glow}`,
            borderRadius: '1.25rem',
            padding: '1rem 1.25rem',
          }}
        >
          <div className="flex items-start gap-3.5">
            <AgentAnimation agentId="tavi" state="active">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: tavi.colorPalette.bg,
                  border: `1.5px solid ${tavi.colorPalette.border}`,
                  color: tavi.colorPalette.primary,
                }}
              >
                <AgentIcon agentId="tavi" size={26} />
              </div>
            </AgentAnimation>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold" style={{ color: tavi.colorPalette.text, opacity: 0.6 }}>
                  {tavi.name} · {tavi.title}
                </span>
              </div>
              <p className="mt-1 text-sm font-medium leading-snug" style={{ color: tavi.colorPalette.text }}>
                {greeting}
              </p>
              {hint && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.7 }}
                  transition={{ delay: 0.6 }}
                  className="mt-1.5 text-xs leading-relaxed"
                  style={{ color: tavi.colorPalette.text }}
                >
                  {hint}
                </motion.p>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
