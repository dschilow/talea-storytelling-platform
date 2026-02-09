import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Beaker, Clock3, ListChecks } from 'lucide-react';

import type { DokuSection } from '../../types/doku';
import { useTheme } from '../../contexts/ThemeContext';

interface ActivityComponentProps {
  section: DokuSection;
  variant?: 'page' | 'inline';
}

const normalizeText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.replace(/\s+/g, ' ').trim();
  }

  if (Array.isArray(value)) {
    return value.map(normalizeText).filter(Boolean).join(', ');
  }

  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const candidate = source.text ?? source.title ?? source.description ?? source.value;
    if (candidate != null) {
      return normalizeText(candidate);
    }
  }

  if (value == null) {
    return '';
  }

  return String(value).trim();
};

export const ActivityComponent: React.FC<ActivityComponentProps> = ({ section, variant = 'page' }) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const items = useMemo(() => {
    const source = section.interactive?.activities;
    if (!source?.enabled || !Array.isArray(source.items)) {
      return [];
    }

    return source.items
      .map((item) => ({
        title: normalizeText(item.title),
        description: normalizeText(item.description),
        materials: Array.isArray(item.materials)
          ? item.materials.map(normalizeText).filter((entry) => entry.length > 0)
          : [],
        durationMinutes:
          typeof item.durationMinutes === 'number' && Number.isFinite(item.durationMinutes)
            ? item.durationMinutes
            : undefined,
      }))
      .filter((item) => item.title.length > 0 || item.description.length > 0);
  }, [section.interactive?.activities]);

  if (items.length === 0) {
    return null;
  }

  const colors = isDark
    ? {
        panel: 'rgba(24,34,48,0.88)',
        border: '#355072',
        title: '#e8f1fe',
        body: '#adbed4',
        iconWrap: 'rgba(82,106,139,0.22)',
        icon: '#9dc5b4',
        itemBg: 'rgba(34,47,66,0.68)',
      }
    : {
        panel: 'rgba(255,250,242,0.9)',
        border: '#decfbf',
        title: '#24364b',
        body: '#63778f',
        iconWrap: 'rgba(225,215,200,0.66)',
        icon: '#5d9685',
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
            <Beaker className="h-5 w-5" style={{ color: colors.icon }} />
          </div>
          <div>
            <h3 className="text-xl font-semibold" style={{ color: colors.title }}>
              Aktivitaeten
            </h3>
            <p className="text-sm" style={{ color: colors.body }}>
              Kleine Aufgaben, um das Thema praktisch zu vertiefen.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {items.map((item, index) => (
            <motion.div
              key={`${item.title}-${index}`}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.28, delay: index * 0.04 }}
              className="rounded-2xl border p-4"
              style={{ borderColor: colors.border, background: colors.itemBg }}
            >
              <h4 className="text-lg font-semibold" style={{ color: colors.title }}>
                {item.title || `Aktivitaet ${index + 1}`}
              </h4>

              {item.description && (
                <p className="mt-2 text-sm leading-relaxed" style={{ color: colors.body }}>
                  {item.description}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs" style={{ color: colors.body }}>
                {item.materials.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1" style={{ borderColor: colors.border }}>
                    <ListChecks className="h-3.5 w-3.5" />
                    {item.materials.join(', ')}
                  </span>
                )}

                {item.durationMinutes != null && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1" style={{ borderColor: colors.border }}>
                    <Clock3 className="h-3.5 w-3.5" />
                    {item.durationMinutes} min
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};
