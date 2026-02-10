import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { BookOpenText, Brain, Sparkles } from 'lucide-react';

import { useTheme } from '../../contexts/ThemeContext';

export interface PersonalityBoardTrait {
  id: string;
  label: string;
  value: number;
  subcategories: Array<{ name: string; value: number }>;
}

interface PersonalityProgressBoardProps {
  traits: PersonalityBoardTrait[];
}

const TRAIT_ACCENTS: Record<string, { start: string; end: string }> = {
  creativity: { start: '#8c98d8', end: '#b18bd8' },
  courage: { start: '#c98f76', end: '#e1a184' },
  empathy: { start: '#70a3c8', end: '#8fc2dd' },
  curiosity: { start: '#90ab6f', end: '#a7bf84' },
  teamwork: { start: '#6da79a', end: '#8ac1b6' },
  persistence: { start: '#b6936a', end: '#ceab7f' },
  logic: { start: '#7d92c9', end: '#97aadc' },
  vocabulary: { start: '#b585a9', end: '#c99cbc' },
  knowledge: { start: '#6f8cc8', end: '#86a3d9' },
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizeKnowledgeProgress = (value: number) => {
  if (value <= 100) {
    return clamp(value, 0, 100);
  }

  const normalized = (Math.log10(value + 10) / Math.log10(1010)) * 100;
  return clamp(Math.round(normalized), 0, 100);
};

const getSkillBand = (value: number) => {
  if (value >= 90) return 'Exzellent';
  if (value >= 70) return 'Stark';
  if (value >= 40) return 'Aufbau';
  return 'Start';
};

const getKnowledgeBand = (value: number) => {
  if (value >= 500) return 'Forscher';
  if (value >= 300) return 'Experte';
  if (value >= 180) return 'Fortgeschritten';
  if (value >= 100) return 'Sicher';
  return 'Start';
};

const toDisplaySubcategory = (value: string) =>
  value
    .replace(/^knowledge\./, '')
    .replace(/_/g, ' ')
    .replace(/^\w/, (match) => match.toUpperCase());

export const PersonalityProgressBoard: React.FC<PersonalityProgressBoardProps> = ({ traits }) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const knowledgeTrait = useMemo(() => traits.find((trait) => trait.id === 'knowledge') || null, [traits]);
  const coreTraits = useMemo(
    () => traits.filter((trait) => trait.id !== 'knowledge').sort((left, right) => right.value - left.value),
    [traits]
  );

  const topCoreTrait = coreTraits[0];
  const improvingCoreTrait = [...coreTraits].sort((left, right) => left.value - right.value)[0];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <InfoCard
          icon={<Sparkles className="h-4 w-4" />}
          label="Staerkste Kompetenz"
          value={topCoreTrait ? `${topCoreTrait.label} (${Math.round(topCoreTrait.value)})` : 'Noch offen'}
          isDark={isDark}
        />
        <InfoCard
          icon={<Brain className="h-4 w-4" />}
          label="Naechster Fokus"
          value={improvingCoreTrait ? `${improvingCoreTrait.label} (${Math.round(improvingCoreTrait.value)})` : 'Noch offen'}
          isDark={isDark}
        />
        <InfoCard
          icon={<BookOpenText className="h-4 w-4" />}
          label="Wissenspunkte"
          value={knowledgeTrait ? `${Math.round(knowledgeTrait.value)} Punkte` : 'Keine Daten'}
          isDark={isDark}
        />
      </div>

      <div className="rounded-2xl border px-3 py-3" style={{ borderColor: isDark ? '#33495f' : '#d9ccbb', background: isDark ? 'rgba(19,29,42,0.7)' : 'rgba(255,255,255,0.72)' }}>
        <p className="mb-3 text-xs uppercase tracking-[0.14em]" style={{ color: isDark ? '#8fa5c3' : '#6d829c' }}>
          Kernkompetenzen
        </p>
        <div className="space-y-2.5">
          {coreTraits.map((trait, index) => {
            const accent = TRAIT_ACCENTS[trait.id] || TRAIT_ACCENTS.logic;
            const progress = clamp(Math.round(trait.value), 0, 100);
            return (
              <motion.article
                key={trait.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24, delay: index * 0.04 }}
                className="rounded-xl border px-3 py-2"
                style={{
                  borderColor: isDark ? '#3b536b' : '#d8c9b7',
                  background: isDark ? 'rgba(26,38,54,0.75)' : 'rgba(255,251,245,0.82)',
                }}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold" style={{ color: isDark ? '#e8f0fb' : '#24364b' }}>
                      {trait.label}
                    </p>
                    <p className="text-[11px]" style={{ color: isDark ? '#98afcb' : '#6c8098' }}>
                      {getSkillBand(progress)}
                    </p>
                  </div>
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: isDark ? 'rgba(70,92,119,0.52)' : '#ece3d9', color: isDark ? '#d4e2f4' : '#4a6078' }}>
                    {progress}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full" style={{ background: isDark ? 'rgba(70,91,116,0.45)' : '#e7ddcf' }}>
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.45, delay: index * 0.04 }}
                    style={{
                      background: `linear-gradient(90deg, ${accent.start} 0%, ${accent.end} 100%)`,
                    }}
                  />
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>

      {knowledgeTrait && (
        <div className="rounded-2xl border px-3 py-3" style={{ borderColor: isDark ? '#33495f' : '#d9ccbb', background: isDark ? 'rgba(19,29,42,0.7)' : 'rgba(255,255,255,0.72)' }}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold" style={{ color: isDark ? '#e8f0fb' : '#24364b' }}>
                Wissensentwicklung
              </p>
              <p className="text-[11px]" style={{ color: isDark ? '#98afcb' : '#6c8098' }}>
                {getKnowledgeBand(knowledgeTrait.value)}
              </p>
            </div>
            <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: isDark ? 'rgba(70,92,119,0.52)' : '#ece3d9', color: isDark ? '#d4e2f4' : '#4a6078' }}>
              {Math.round(knowledgeTrait.value)}
            </span>
          </div>

          <div className="h-2 overflow-hidden rounded-full" style={{ background: isDark ? 'rgba(70,91,116,0.45)' : '#e7ddcf' }}>
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${normalizeKnowledgeProgress(knowledgeTrait.value)}%` }}
              transition={{ duration: 0.5 }}
              style={{
                background: `linear-gradient(90deg, ${TRAIT_ACCENTS.knowledge.start} 0%, ${TRAIT_ACCENTS.knowledge.end} 100%)`,
              }}
            />
          </div>

          {knowledgeTrait.subcategories.length > 0 && (
            <div className="mt-3 space-y-2">
              {knowledgeTrait.subcategories.slice(0, 6).map((subcategory, index) => {
                const maxCategoryValue = Math.max(
                  1,
                  ...knowledgeTrait.subcategories.map((entry) => Math.max(1, entry.value))
                );
                const progress = clamp(Math.round((subcategory.value / maxCategoryValue) * 100), 1, 100);
                return (
                  <motion.div
                    key={`${subcategory.name}-${index}`}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.22, delay: index * 0.03 }}
                    className="rounded-lg border px-2 py-1.5"
                    style={{
                      borderColor: isDark ? '#3a5169' : '#dccfbf',
                      background: isDark ? 'rgba(26,38,54,0.7)' : 'rgba(255,251,245,0.8)',
                    }}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-medium" style={{ color: isDark ? '#dce8fb' : '#2e445d' }}>
                        {toDisplaySubcategory(subcategory.name)}
                      </p>
                      <span className="text-[11px]" style={{ color: isDark ? '#a3b7d0' : '#6f829a' }}>
                        {Math.round(subcategory.value)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full" style={{ background: isDark ? 'rgba(74,96,121,0.45)' : '#e5dacc' }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${progress}%`,
                          background: `linear-gradient(90deg, ${TRAIT_ACCENTS.knowledge.start} 0%, ${TRAIT_ACCENTS.knowledge.end} 100%)`,
                        }}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const InfoCard: React.FC<{ icon: React.ReactNode; label: string; value: string; isDark: boolean }> = ({
  icon,
  label,
  value,
  isDark,
}) => (
  <div
    className="rounded-xl border px-3 py-2.5"
    style={{
      borderColor: isDark ? '#354c63' : '#dccfbf',
      background: isDark ? 'rgba(25,36,52,0.78)' : 'rgba(255,251,245,0.88)',
    }}
  >
    <p className="mb-1 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.1em]" style={{ color: isDark ? '#95aac5' : '#6d829c' }}>
      {icon}
      {label}
    </p>
    <p className="text-sm font-semibold" style={{ color: isDark ? '#e8f0fb' : '#24364b' }}>
      {value}
    </p>
  </div>
);

export default PersonalityProgressBoard;
