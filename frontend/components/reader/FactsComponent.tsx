import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Lightbulb } from 'lucide-react';

import type { DokuSection } from '../../types/doku';
import { useTheme } from '../../contexts/ThemeContext';

interface FactsComponentProps {
  section: DokuSection;
  variant?: 'page' | 'inline';
}

const normalizeFact = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.replace(/\s+/g, ' ').replace(/^[-*\u2022\u00b7]\s*/, '').trim();
  }

  if (Array.isArray(value)) {
    return value.map(normalizeFact).filter(Boolean).join(', ');
  }

  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const candidate =
      source.fact ??
      source.text ??
      source.title ??
      source.description ??
      source.value ??
      source.content;

    if (candidate != null) {
      return normalizeFact(candidate);
    }

    try {
      return JSON.stringify(source);
    } catch {
      return '';
    }
  }

  if (value == null) {
    return '';
  }

  return String(value).trim();
};

export const FactsComponent: React.FC<FactsComponentProps> = ({ section, variant = 'page' }) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const facts = useMemo(() => {
    const rawFacts = Array.isArray(section.keyFacts) ? section.keyFacts : [];
    return rawFacts.map(normalizeFact).filter((fact) => fact.length > 0);
  }, [section.keyFacts]);

  if (facts.length === 0) {
    return null;
  }

  const colors = isDark
    ? {
        panel: 'rgba(24,34,48,0.88)',
        border: '#355072',
        title: '#e8f1fe',
        body: '#adbed4',
        iconWrap: 'rgba(82,106,139,0.22)',
        icon: '#a4b9d9',
        itemBg: 'rgba(34,47,66,0.68)',
      }
    : {
        panel: 'rgba(255,250,242,0.9)',
        border: '#decfbf',
        title: '#24364b',
        body: '#63778f',
        iconWrap: 'rgba(225,215,200,0.66)',
        icon: '#6883a8',
        itemBg: 'rgba(255,255,255,0.72)',
      };

  const wrapperClass =
    variant === 'page'
      ? 'w-full min-h-full flex flex-col items-center justify-center p-4 md:p-8'
      : 'w-full';

  return (
    <div className={wrapperClass}>
      <div className="w-full max-w-3xl rounded-3xl border p-5 md:p-6" style={{ borderColor: colors.border, background: colors.panel }}>
        <div className="mb-5 flex items-center gap-3">
          <div
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: colors.iconWrap }}
          >
            <Lightbulb className="h-5 w-5" style={{ color: colors.icon }} />
          </div>
          <div>
            <h3 className="text-xl font-semibold" style={{ color: colors.title }}>
              Wichtige Fakten
            </h3>
            <p className="text-sm" style={{ color: colors.body }}>
              Kurz und praegnant fuer den schnellen Ueberblick.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {facts.map((fact, index) => (
            <motion.div
              key={`${fact}-${index}`}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.28, delay: index * 0.04 }}
              className="flex items-start gap-3 rounded-2xl border p-3.5"
              style={{ borderColor: colors.border, background: colors.itemBg }}
            >
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color: colors.icon }} />
              <p className="text-base leading-relaxed" style={{ color: colors.title }}>
                {fact}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

