import React, { useId, useMemo } from 'react';
import { motion } from 'framer-motion';

import { useTheme } from '../../contexts/ThemeContext';

type TraitConfig = {
  id: string;
  label: string;
  short: string;
  color: string;
};

const TRAITS: TraitConfig[] = [
  { id: 'knowledge', label: 'Wissen', short: 'WI', color: '#6e93cc' },
  { id: 'creativity', label: 'Kreativitaet', short: 'KR', color: '#a884c8' },
  { id: 'vocabulary', label: 'Wortschatz', short: 'WO', color: '#c98ba0' },
  { id: 'courage', label: 'Mut', short: 'MU', color: '#d08c7a' },
  { id: 'curiosity', label: 'Neugier', short: 'NE', color: '#c59b66' },
  { id: 'teamwork', label: 'Teamgeist', short: 'TE', color: '#6fa89d' },
  { id: 'empathy', label: 'Empathie', short: 'EM', color: '#75a1bf' },
  { id: 'persistence', label: 'Ausdauer', short: 'AU', color: '#8da37b' },
  { id: 'logic', label: 'Logik', short: 'LO', color: '#7f89bc' },
];

const MASTERY_TIERS = [
  { level: 1, name: 'Anfaenger', minValue: 0, color: '#95a3ba' },
  { level: 2, name: 'Lehrling', minValue: 21, color: '#72a896' },
  { level: 3, name: 'Geselle', minValue: 41, color: '#7b96c5' },
  { level: 4, name: 'Meister', minValue: 61, color: '#9b83c0' },
  { level: 5, name: 'Legende', minValue: 81, color: '#c58b79' },
] as const;

type RadarTrait = TraitConfig & {
  rawValue: number;
  normalizedValue: number;
};

interface PersonalityRadarChartProps {
  traits: Record<string, unknown>;
  size?: number;
  showMasteryBadges?: boolean;
  showLegend?: boolean;
  animate?: boolean;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const extractTraitValue = (traits: Record<string, unknown>, traitId: string) => {
  const raw = traits[traitId];
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? Math.max(0, raw) : 0;
  }

  if (raw && typeof raw === 'object') {
    const source = raw as Record<string, unknown>;

    if (typeof source.value === 'number' && Number.isFinite(source.value)) {
      return Math.max(0, source.value);
    }

    if (source.subcategories && typeof source.subcategories === 'object') {
      return Object.values(source.subcategories as Record<string, unknown>).reduce((sum, entry) => {
        if (typeof entry === 'number' && Number.isFinite(entry)) {
          return sum + Math.max(0, entry);
        }
        return sum;
      }, 0);
    }
  }

  return 0;
};

const getMasteryTier = (value: number) => {
  const normalized = clamp(value, 0, 100);
  for (let i = MASTERY_TIERS.length - 1; i >= 0; i -= 1) {
    if (normalized >= MASTERY_TIERS[i].minValue) {
      return MASTERY_TIERS[i];
    }
  }
  return MASTERY_TIERS[0];
};

const getAdaptiveAxisMax = (maxValue: number) => {
  if (maxValue <= 100) {
    return 100;
  }

  const rounded = Math.ceil(maxValue / 50) * 50;
  return clamp(rounded, 100, 1000);
};

export const PersonalityRadarChart: React.FC<PersonalityRadarChartProps> = ({
  traits,
  size = 320,
  showMasteryBadges = true,
  showLegend = true,
  animate = true,
}) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const gradientId = useId().replace(/[:]/g, '');
  const glowId = useId().replace(/[:]/g, '');

  const chartData = useMemo(() => {
    const rawValues = TRAITS.map((trait) => extractTraitValue(traits, trait.id));
    const axisMax = getAdaptiveAxisMax(Math.max(...rawValues, 0));

    const mappedTraits: RadarTrait[] = TRAITS.map((trait, index) => {
      const rawValue = rawValues[index];
      const normalizedValue = clamp((rawValue / axisMax) * 100, 0, 100);

      return {
        ...trait,
        rawValue,
        normalizedValue,
      };
    });

    return {
      axisMax,
      traits: mappedTraits,
    };
  }, [traits]);

  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = size * 0.33;
  const levels = 5;
  const angleStep = (Math.PI * 2) / chartData.traits.length;

  const getPoint = (index: number, normalizedValue: number) => {
    const angle = angleStep * index - Math.PI / 2;
    const radius = (normalizedValue / 100) * maxRadius;

    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  };

  const gridRings = Array.from({ length: levels }, (_, idx) => {
    const level = idx + 1;
    const ratio = level / levels;
    return {
      ratio,
      radius: ratio * maxRadius,
      label: Math.round(ratio * chartData.axisMax),
    };
  });

  const dataPath =
    chartData.traits
      .map((trait, index) => {
        const point = getPoint(index, trait.normalizedValue);
        return `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`;
      })
      .join(' ') + ' Z';

  const axisPoints = chartData.traits.map((_, index) => getPoint(index, 100));
  const dotPoints = chartData.traits.map((trait, index) => ({
    ...getPoint(index, trait.normalizedValue),
    ...trait,
    tier: getMasteryTier(trait.rawValue),
  }));

  const labelPoints = chartData.traits.map((trait, index) => {
    const angle = angleStep * index - Math.PI / 2;
    const radius = maxRadius + 36;
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      ...trait,
      tier: getMasteryTier(trait.rawValue),
    };
  });

  return (
    <div className="flex w-full flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        <defs>
          <radialGradient id={gradientId} cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor={isDark ? '#9bb2d9' : '#87a3d6'} stopOpacity={isDark ? 0.42 : 0.34} />
            <stop offset="100%" stopColor={isDark ? '#6f86b8' : '#7f96c7'} stopOpacity={isDark ? 0.12 : 0.08} />
          </radialGradient>

          <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle
          cx={cx}
          cy={cy}
          r={maxRadius + 2}
          fill={isDark ? 'rgba(22,32,47,0.72)' : 'rgba(255,252,247,0.86)'}
          stroke="none"
        />

        {gridRings.map((ring) => (
          <polygon
            key={`ring-${ring.label}`}
            points={axisPoints
              .map((axisPoint) => {
                const scaledX = cx + (axisPoint.x - cx) * ring.ratio;
                const scaledY = cy + (axisPoint.y - cy) * ring.ratio;
                return `${scaledX},${scaledY}`;
              })
              .join(' ')}
            fill="none"
            stroke={isDark ? '#415773' : '#d9cebf'}
            strokeWidth={ring.ratio === 1 ? 1.3 : 0.8}
            strokeDasharray={ring.ratio === 1 ? undefined : '4,3'}
            opacity={ring.ratio === 1 ? 0.9 : 0.65}
          />
        ))}

        {axisPoints.map((point, index) => (
          <line
            key={`axis-${chartData.traits[index].id}`}
            x1={cx}
            y1={cy}
            x2={point.x}
            y2={point.y}
            stroke={isDark ? '#3a4f69' : '#d7ccbc'}
            strokeWidth={0.8}
          />
        ))}

        <motion.path
          d={dataPath}
          fill={`url(#${gradientId})`}
          stroke={isDark ? '#91a8d3' : '#7f96c7'}
          strokeWidth={2.2}
          strokeLinejoin="round"
          filter={`url(#${glowId})`}
          initial={animate ? { opacity: 0, scale: 0.35 } : false}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.65, ease: 'easeOut' }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />

        {dotPoints.map((dot, index) => (
          <motion.circle
            key={`dot-${dot.id}`}
            cx={dot.x}
            cy={dot.y}
            r={dot.normalizedValue > 0 ? 4.8 : 3.3}
            fill={dot.normalizedValue > 0 ? dot.tier.color : isDark ? '#4e6078' : '#cdbfae'}
            stroke={isDark ? '#162132' : '#fffaf4'}
            strokeWidth={1.8}
            initial={animate ? { opacity: 0, r: 0 } : false}
            animate={{ opacity: 1, r: dot.normalizedValue > 0 ? 4.8 : 3.3 }}
            transition={{ duration: 0.35, delay: 0.24 + index * 0.04 }}
          />
        ))}

        {labelPoints.map((labelPoint) => (
          <g key={`label-${labelPoint.id}`}>
            <text
              x={labelPoint.x}
              y={labelPoint.y - 7}
              textAnchor="middle"
              dominantBaseline="central"
              fill={isDark ? '#e1ebfa' : '#223245'}
              style={{ fontSize: '10.5px', fontWeight: 700 }}
            >
              {labelPoint.short}
            </text>
            <text
              x={labelPoint.x}
              y={labelPoint.y + 7}
              textAnchor="middle"
              dominantBaseline="central"
              fill={isDark ? '#9db1cb' : '#6b7d93'}
              style={{ fontSize: '9px', fontWeight: 600 }}
            >
              {labelPoint.rawValue}
            </text>
            {showMasteryBadges && (
              <text
                x={labelPoint.x}
                y={labelPoint.y + 17}
                textAnchor="middle"
                dominantBaseline="central"
                fill={labelPoint.tier.color}
                style={{ fontSize: '8px', fontWeight: 700 }}
              >
                {labelPoint.tier.name}
              </text>
            )}
          </g>
        ))}

        {gridRings.map((ring) => (
          <text
            key={`value-${ring.label}`}
            x={cx - ring.radius - 6}
            y={cy - 2}
            fill={isDark ? '#8fa3bd' : '#7a8ba0'}
            style={{ fontSize: '8px', fontWeight: 600 }}
          >
            {ring.label}
          </text>
        ))}
      </svg>

      <p className="mt-2 text-xs font-medium" style={{ color: isDark ? '#99adc8' : '#667a92' }}>
        Dynamische Skala: 0 bis {chartData.axisMax}
      </p>

      {showLegend && (
        <div className="mt-3 grid w-full max-w-[680px] grid-cols-2 gap-2 sm:grid-cols-3">
          {chartData.traits.map((trait) => {
            const tier = getMasteryTier(trait.rawValue);
            return (
              <div
                key={`legend-${trait.id}`}
                className="rounded-xl border px-2.5 py-2 text-xs"
                style={{
                  borderColor: isDark ? '#344b66' : '#dacdbc',
                  background: isDark ? 'rgba(26,38,55,0.7)' : 'rgba(255,252,246,0.85)',
                }}
              >
                <p className="font-semibold" style={{ color: isDark ? '#e2ebfa' : '#223245' }}>
                  {trait.label}
                </p>
                <p style={{ color: isDark ? '#a1b4cd' : '#6a7c93' }}>
                  {trait.rawValue} Punkte
                </p>
                <p className="font-medium" style={{ color: tier.color }}>
                  {tier.name}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PersonalityRadarChart;
