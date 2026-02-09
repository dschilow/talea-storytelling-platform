import React from 'react';
import { Book, Shield, Sparkles, Swords, Users } from 'lucide-react';

import { useTheme } from '../../contexts/ThemeContext';
import { InventoryItem } from '../../types/avatar';

interface InventoryItemCardProps {
  item: InventoryItem;
  onClick?: () => void;
}

const getTypeMeta = (type: InventoryItem['type']) => {
  switch (type) {
    case 'WEAPON':
      return { label: 'Werkzeug', icon: Swords };
    case 'KNOWLEDGE':
      return { label: 'Wissen', icon: Book };
    case 'COMPANION':
      return { label: 'Begleiter', icon: Users };
    default:
      return { label: 'Artefakt', icon: Shield };
  }
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });

const LevelStars: React.FC<{ level: number }> = ({ level }) => (
  <div className="flex items-center gap-0.5">
    {Array.from({ length: Math.max(level, 1) }).map((_, index) => (
      <Sparkles key={`level-${index}`} className="h-3 w-3 text-[#c58b79]" />
    ))}
  </div>
);

const InventoryItemCard: React.FC<InventoryItemCardProps> = ({ item, onClick }) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const typeMeta = getTypeMeta(item.type);
  const TypeIcon = typeMeta.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full overflow-hidden rounded-2xl border text-left transition-transform duration-200 hover:-translate-y-0.5"
      style={{
        borderColor: isDark ? '#33485f' : '#dccfbd',
        background: isDark ? 'rgba(24,35,50,0.88)' : 'rgba(255,251,245,0.92)',
      }}
      aria-label={`${item.name} anzeigen`}
    >
      <div className="relative h-36 overflow-hidden">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{
              background: isDark
                ? 'linear-gradient(135deg, rgba(71,96,126,0.46) 0%, rgba(98,89,129,0.5) 100%)'
                : 'linear-gradient(135deg, #ece4d9 0%, #e6ddf0 100%)',
            }}
          >
            <TypeIcon className="h-9 w-9" style={{ color: isDark ? '#dae7fa' : '#465d7f' }} />
          </div>
        )}

        <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ borderColor: 'rgba(255,255,255,0.35)', background: 'rgba(10,16,24,0.4)', color: '#f4f7fb' }}>
          <TypeIcon className="h-3 w-3" />
          {typeMeta.label}
        </div>
      </div>

      <div className="space-y-2 px-3.5 py-3.5">
        <div className="flex items-start justify-between gap-2">
          <h4 className="line-clamp-1 text-sm font-semibold" style={{ color: isDark ? '#e7effb' : '#213247' }}>
            {item.name}
          </h4>
          <LevelStars level={item.level} />
        </div>

        <p className="line-clamp-2 text-xs leading-relaxed" style={{ color: isDark ? '#a6b8d1' : '#647991' }}>
          {item.description || 'Kein Beschreibungstext vorhanden.'}
        </p>

        <div className="flex items-center justify-between text-[11px] font-medium" style={{ color: isDark ? '#94a8c4' : '#6d8098' }}>
          <span>Level {Math.max(1, item.level)}</span>
          <span>{formatDate(item.acquiredAt)}</span>
        </div>
      </div>
    </button>
  );
};

export default InventoryItemCard;
