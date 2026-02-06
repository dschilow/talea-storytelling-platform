import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

// ─── Mastery Tiers (mirror backend) ─────────────────────────────────────────
const MASTERY_TIERS = [
  { level: 1, name: 'Anfänger', icon: '🌱', minValue: 0, color: '#94A3B8' },
  { level: 2, name: 'Lehrling', icon: '🌿', minValue: 21, color: '#22C55E' },
  { level: 3, name: 'Geselle', icon: '🌳', minValue: 41, color: '#3B82F6' },
  { level: 4, name: 'Meister', icon: '⭐', minValue: 61, color: '#A855F7' },
  { level: 5, name: 'Legende', icon: '👑', minValue: 81, color: '#F59E0B' },
] as const;

function getMasteryTier(value: number) {
  for (let i = MASTERY_TIERS.length - 1; i >= 0; i--) {
    if (value >= MASTERY_TIERS[i].minValue) return MASTERY_TIERS[i];
  }
  return MASTERY_TIERS[0];
}

// ─── Trait Config ─────────────────────────────────────────────────────────────
const TRAIT_CONFIG: Array<{ id: string; label: string; icon: string; color: string }> = [
  { id: 'courage', label: 'Mut', icon: '🦁', color: '#EF4444' },
  { id: 'creativity', label: 'Kreativität', icon: '🎨', color: '#A855F7' },
  { id: 'vocabulary', label: 'Wortschatz', icon: '📖', color: '#EC4899' },
  { id: 'curiosity', label: 'Neugier', icon: '🔍', color: '#F59E0B' },
  { id: 'teamwork', label: 'Teamgeist', icon: '🤝', color: '#3B82F6' },
  { id: 'empathy', label: 'Empathie', icon: '💗', color: '#10B981' },
  { id: 'persistence', label: 'Ausdauer', icon: '🧗', color: '#F97316' },
  { id: 'logic', label: 'Logik', icon: '🔢', color: '#6366F1' },
];

interface PersonalityRadarChartProps {
  /** Backend personality traits object */
  traits: Record<string, any>;
  /** Size of the chart (width & height) */
  size?: number;
  /** Show mastery badges around the chart */
  showMasteryBadges?: boolean;
  /** Show legend below */
  showLegend?: boolean;
  /** Animate on mount */
  animate?: boolean;
}

export const PersonalityRadarChart: React.FC<PersonalityRadarChartProps> = ({
  traits,
  size = 320,
  showMasteryBadges = true,
  showLegend = true,
  animate = true,
}) => {
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = size * 0.35; // Leave room for labels
  const levels = 5; // Grid rings (20, 40, 60, 80, 100)

  // Extract trait values (handle both flat and hierarchical format)
  const traitValues = useMemo(() => {
    return TRAIT_CONFIG.map(tc => {
      const raw = traits[tc.id];
      if (raw === undefined || raw === null) return { ...tc, value: 0 };
      const value = typeof raw === 'number' ? raw : (raw.value ?? 0);
      return { ...tc, value: Math.min(100, Math.max(0, value)) };
    });
  }, [traits]);

  const n = traitValues.length;
  const angleStep = (2 * Math.PI) / n;

  // Calculate polygon point for a given index and value
  const getPoint = (index: number, value: number) => {
    const angle = angleStep * index - Math.PI / 2; // Start from top
    const r = (value / 100) * maxRadius;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  };

  // Build the data polygon path
  const dataPath = useMemo(() => {
    return traitValues
      .map((tv, i) => {
        const pt = getPoint(i, tv.value);
        return `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`;
      })
      .join(' ') + ' Z';
  }, [traitValues, cx, cy, maxRadius]);

  // Grid rings
  const gridRings = Array.from({ length: levels }, (_, i) => {
    const value = ((i + 1) / levels) * 100;
    const r = (value / 100) * maxRadius;
    return { value, r };
  });

  // Grid lines from center to each vertex
  const gridLines = Array.from({ length: n }, (_, i) => {
    const pt = getPoint(i, 100);
    return { x1: cx, y1: cy, x2: pt.x, y2: pt.y };
  });

  // Label positions (outside the chart)
  const labelPositions = traitValues.map((tv, i) => {
    const angle = angleStep * i - Math.PI / 2;
    const labelR = maxRadius + 36;
    return {
      x: cx + labelR * Math.cos(angle),
      y: cy + labelR * Math.sin(angle),
      ...tv,
    };
  });

  // Dot positions (on the data polygon)
  const dotPositions = traitValues.map((tv, i) => ({
    ...getPoint(i, tv.value),
    ...tv,
  }));

  return (
    <div className="flex flex-col items-center">
      {/* SVG Radar Chart */}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-sm">
        <defs>
          {/* Gradient for the data area */}
          <radialGradient id="radarGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#A855F7" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#6366F1" stopOpacity="0.1" />
          </radialGradient>
          {/* Glow filter for the data polygon */}
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background circle (subtle) */}
        <circle cx={cx} cy={cy} r={maxRadius + 2} fill="#F8FAFC" stroke="none" />

        {/* Grid rings */}
        {gridRings.map(({ value, r }) => (
          <polygon
            key={value}
            points={Array.from({ length: n }, (_, i) => {
              const angle = angleStep * i - Math.PI / 2;
              return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
            }).join(' ')}
            fill="none"
            stroke={value === 100 ? '#CBD5E1' : '#E2E8F0'}
            strokeWidth={value === 100 ? 1.5 : 0.8}
            strokeDasharray={value === 100 ? 'none' : '3,3'}
          />
        ))}

        {/* Grid lines from center */}
        {gridLines.map((line, i) => (
          <line
            key={i}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="#E2E8F0"
            strokeWidth={0.8}
          />
        ))}

        {/* Data polygon (filled area) */}
        <motion.path
          d={dataPath}
          fill="url(#radarGradient)"
          stroke="#8B5CF6"
          strokeWidth={2.5}
          strokeLinejoin="round"
          filter="url(#glow)"
          initial={animate ? { opacity: 0, scale: 0.3 } : false}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />

        {/* Data points (dots) */}
        {dotPositions.map((dot, i) => {
          const tier = getMasteryTier(dot.value);
          return (
            <motion.circle
              key={dot.id}
              cx={dot.x}
              cy={dot.y}
              r={dot.value > 0 ? 5 : 3}
              fill={dot.value > 0 ? tier.color : '#CBD5E1'}
              stroke="white"
              strokeWidth={2}
              initial={animate ? { opacity: 0, r: 0 } : false}
              animate={{ opacity: 1, r: dot.value > 0 ? 5 : 3 }}
              transition={{ duration: 0.5, delay: 0.3 + i * 0.05 }}
            />
          );
        })}

        {/* Labels around the chart */}
        {labelPositions.map((lp) => {
          const tier = getMasteryTier(lp.value);
          return (
            <g key={lp.id}>
              <text
                x={lp.x}
                y={lp.y - 8}
                textAnchor="middle"
                dominantBaseline="central"
                className="text-sm select-none pointer-events-none"
                style={{ fontSize: '15px' }}
              >
                {lp.icon}
              </text>
              <text
                x={lp.x}
                y={lp.y + 10}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#374151"
                className="select-none pointer-events-none"
                style={{ fontSize: '10px', fontWeight: 600 }}
              >
                {lp.label}
              </text>
              {showMasteryBadges && lp.value > 0 && (
                <text
                  x={lp.x}
                  y={lp.y + 22}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={tier.color}
                  className="select-none pointer-events-none"
                  style={{ fontSize: '9px', fontWeight: 700 }}
                >
                  {tier.icon} {lp.value}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Mastery Legend */}
      {showLegend && (
        <div className="flex flex-wrap justify-center gap-2 mt-4 px-4">
          {MASTERY_TIERS.map(tier => (
            <div
              key={tier.level}
              className="flex items-center gap-1 px-2 py-1 rounded-full text-xs"
              style={{
                backgroundColor: `${tier.color}15`,
                color: tier.color,
                border: `1px solid ${tier.color}30`,
              }}
            >
              <span>{tier.icon}</span>
              <span className="font-medium">{tier.name}</span>
              <span className="opacity-60">{tier.minValue}+</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PersonalityRadarChart;
