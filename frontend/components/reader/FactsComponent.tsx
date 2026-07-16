import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Lightbulb } from 'lucide-react';

import type { DokuSection } from '../../types/doku';
import { useTheme } from '../../contexts/ThemeContext';

interface FactsComponentProps {
  section: DokuSection;
  variant?: 'page' | 'inline';
}

type DisplayFact = {
  title?: string;
  fact: string;
  whyItMatters?: string;
};

const normalizeText = (value: unknown): string => {
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').replace(/^[-*\u2022\u00b7]\s*/, '').trim();
  if (value == null) return '';
  return String(value).replace(/\s+/g, ' ').trim();
};

const normalizeFact = (value: unknown): DisplayFact | null => {
  if (typeof value === 'string') {
    const fact = normalizeText(value);
    return fact ? { fact } : null;
  }

  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const fact = normalizeText(source.fact ?? source.text ?? source.description ?? source.value ?? source.content);
  if (!fact) return null;

  const title = normalizeText(source.title ?? source.label).slice(0, 70);
  const whyItMatters = normalizeText(source.whyItMatters ?? source.why ?? source.context).slice(0, 220);
  return { fact, ...(title ? { title } : {}), ...(whyItMatters ? { whyItMatters } : {}) };
};

export const FactsComponent: React.FC<FactsComponentProps> = ({ section, variant = 'page' }) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const facts = useMemo(() => {
    const rawFacts = Array.isArray(section.keyFacts) ? section.keyFacts : [];
    return rawFacts.map(normalizeFact).filter((fact): fact is DisplayFact => Boolean(fact));
  }, [section.keyFacts]);

  if (facts.length === 0) return null;

  const colors = isDark
    ? {
        panel: 'rgba(24,34,48,0.88)', border: '#355072', title: '#e8f1fe', body: '#adbed4',
        iconWrap: 'rgba(82,106,139,0.22)', icon: '#a4b9d9', itemBg: 'rgba(34,47,66,0.68)',
      }
    : {
        panel: 'rgba(255,250,242,0.9)', border: '#decfbf', title: '#24364b', body: '#63778f',
        iconWrap: 'rgba(225,215,200,0.66)', icon: '#6883a8', itemBg: 'rgba(255,255,255,0.72)',
      };

  const wrapperClass = variant === 'page'
    ? 'w-full min-h-full flex flex-col items-center justify-center p-4 md:p-8'
    : 'w-full';

  return (
    <div className={wrapperClass}>
      <div className="w-full max-w-3xl rounded-3xl border p-5 md:p-6" style={{ borderColor: colors.border, background: colors.panel }}>
        <div className="mb-5 flex items-center gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: colors.iconWrap }}>
            <Lightbulb className="h-5 w-5" style={{ color: colors.icon }} />
          </div>
          <div>
            <h3 className="text-xl font-semibold" style={{ color: colors.title }}>Wichtige Fakten</h3>
            <p className="text-sm" style={{ color: colors.body }}>Die Aha-Momente – kurz, klar und mit dem Warum dahinter.</p>
          </div>
        </div>

        <div className="space-y-3">
          {facts.map((item, index) => (
            <motion.div
              key={`${item.fact}-${index}`}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.28, delay: index * 0.04 }}
              className="flex items-start gap-3 rounded-2xl border p-3.5"
              style={{ borderColor: colors.border, background: colors.itemBg }}
            >
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color: colors.icon }} />
              <div className="min-w-0">
                {item.title && <p className="text-[11px] font-bold uppercase tracking-[0.11em]" style={{ color: colors.icon }}>{item.title}</p>}
                <p className="text-base leading-relaxed" style={{ color: colors.title }}>{item.fact}</p>
                {item.whyItMatters && (
                  <p className="mt-1 text-sm leading-relaxed" style={{ color: colors.body }}>
                    <span className="font-semibold" style={{ color: colors.title }}>Warum das zählt: </span>{item.whyItMatters}
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};