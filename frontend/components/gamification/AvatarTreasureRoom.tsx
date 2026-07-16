import React, { useMemo, useState } from 'react';
import { BookOpen, Gem, PackageOpen, Shield, Sparkles, Users, type LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useTheme } from '../../contexts/ThemeContext';
import type { InventoryItem } from '../../types/avatar';
import ArtifactDetailModal from './ArtifactDetailModal';

interface AvatarTreasureRoomProps {
  avatarName: string;
  items: InventoryItem[];
}

type TreasureKind = 'magic' | 'gear' | 'knowledge' | 'companion';

const getKind = (item: InventoryItem): TreasureKind => {
  const type = String(item.type || '').toUpperCase();
  const tags = (item.tags || []).map((tag) => tag.toLowerCase());

  if (type === 'COMPANION') return 'companion';
  if (type === 'KNOWLEDGE' || tags.some((tag) => ['book', 'map', 'knowledge'].includes(tag))) return 'knowledge';
  if (type === 'WEAPON' || tags.some((tag) => ['weapon', 'armor', 'tool', 'tech'].includes(tag))) return 'gear';
  return 'magic';
};

const KIND_META: Record<
  TreasureKind,
  { label: string; icon: LucideIcon; color: string; soft: string }
> = {
  magic: { label: 'Zauberfunde', icon: Sparkles, color: '#8a6ca8', soft: '#efe8f6' },
  gear: { label: 'Ausr\u00fcstung', icon: Shield, color: '#9b7138', soft: '#f3eadc' },
  knowledge: { label: 'Wissenssch\u00e4tze', icon: BookOpen, color: '#527b70', soft: '#e3f0eb' },
  companion: { label: 'Begleiter', icon: Users, color: '#5f78a0', soft: '#e7ecf5' },
};

const rarityLabel = (item: InventoryItem) => {
  const rarity = item.tags?.find((tag) => ['common', 'uncommon', 'rare', 'epic', 'legendary'].includes(tag.toLowerCase()));
  const labels: Record<string, string> = {
    common: 'H\u00e4ufig',
    uncommon: 'Besonders',
    rare: 'Selten',
    epic: 'Episch',
    legendary: 'Legend\u00e4r',
  };
  return rarity ? labels[rarity.toLowerCase()] || rarity : null;
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
};

const AvatarTreasureRoom: React.FC<AvatarTreasureRoomProps> = ({ avatarName, items }) => {
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [selected, setSelected] = useState<InventoryItem | null>(null);

  const sorted = useMemo(
    () =>
      [...(items || [])].sort(
        (a, b) => new Date(b.acquiredAt || 0).getTime() - new Date(a.acquiredAt || 0).getTime()
      ),
    [items]
  );

  const counts = useMemo(
    () =>
      sorted.reduce<Record<TreasureKind, number>>(
        (result, item) => {
          result[getKind(item)] += 1;
          return result;
        },
        { magic: 0, gear: 0, knowledge: 0, companion: 0 }
      ),
    [sorted]
  );

  const panel = {
    borderColor: isDark ? '#344b61' : '#ded2c3',
    background: isDark ? 'rgba(24,36,51,0.9)' : 'rgba(255,252,247,0.94)',
  };

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border p-4 sm:p-5" style={panel}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em]" style={{ color: isDark ? '#d0b690' : '#9b7138' }}>Fundst&uuml;cke</p>
            <h2 className="mt-1 text-2xl font-semibold" style={{ color: isDark ? '#edf4ff' : '#203449' }}>Schatzkammer von {avatarName}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed" style={{ color: isDark ? '#aabdd1' : '#61768d' }}>
              Artefakte sind Belohnungen aus vollst&auml;ndig gelesenen Geschichten. Dokus st&auml;rken Wissen und Entwicklung, legen aber kein Artefakt ab.
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold" style={{ borderColor: isDark ? '#5b513f' : '#ddccb0', background: isDark ? 'rgba(96,76,43,0.2)' : '#f8f0e3', color: isDark ? '#e0c79f' : '#85612f' }}>
            <Gem className="h-4 w-4" />
            {sorted.length} {sorted.length === 1 ? 'Schatz' : 'Sch\u00e4tze'}
          </span>
        </div>
      </section>

      {sorted.length === 0 ? (
        <section className="rounded-[28px] border px-5 py-14 text-center" style={panel}>
          <span className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-3xl" style={{ background: isDark ? 'rgba(104,82,45,0.25)' : '#f5ebda', color: isDark ? '#e0c59a' : '#9b7138' }}>
            <PackageOpen className="h-8 w-8" />
          </span>
          <h3 className="mt-4 text-xl font-semibold" style={{ color: isDark ? '#edf4ff' : '#203449' }}>Noch wartet der erste Schatz</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed" style={{ color: isDark ? '#9fb2c8' : '#687d93' }}>
            W&auml;hle eine Geschichte, lies sie vollst&auml;ndig und schlie&szlig;e sie ab. Dokus sammeln stattdessen Wissen und Erinnerungen.
          </p>
          <button
            type="button"
            onClick={() => navigate('/story')}
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#9b7138] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b7138]"
          >
            <BookOpen className="h-4 w-4" />
            Geschichte ausw&auml;hlen
          </button>
        </section>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Schatzarten">
            {(Object.keys(KIND_META) as TreasureKind[]).map((kind) => {
              const meta = KIND_META[kind];
              const Icon = meta.icon;
              return (
                <div key={kind} className="rounded-2xl border px-3 py-3" style={panel}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: isDark ? `${meta.color}30` : meta.soft, color: isDark ? '#d9e4ef' : meta.color }}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <strong className="text-xl" style={{ color: isDark ? '#edf4ff' : '#203449' }}>{counts[kind]}</strong>
                  </div>
                  <p className="mt-2 text-xs font-semibold" style={{ color: isDark ? '#9fb2c8' : '#687d93' }}>{meta.label}</p>
                </div>
              );
            })}
          </section>

          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Gesammelte Sch&auml;tze">
            {sorted.map((item) => {
              const kind = getKind(item);
              const meta = KIND_META[kind];
              const Icon = meta.icon;
              const rarity = rarityLabel(item);
              const date = formatDate(item.acquiredAt);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(item)}
                    className="group h-full w-full overflow-hidden rounded-[24px] border text-left transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b7138]"
                    style={panel}
                    aria-label={`${item.name} \u00f6ffnen`}
                  >
                    <div className="relative aspect-[4/3] overflow-hidden" style={{ background: isDark ? 'linear-gradient(135deg, #263a4f, #3b344b)' : `linear-gradient(135deg, ${meta.soft}, #f8f1e8)` }}>
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Icon className="h-12 w-12" style={{ color: isDark ? '#c8d5e3' : meta.color }} />
                        </div>
                      )}
                      <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-[#17202dcc] px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                        <Icon className="h-3.5 w-3.5" />
                        {meta.label}
                      </span>
                      {rarity ? (
                        <span className="absolute right-3 top-3 rounded-full border border-white/30 bg-[#17202dcc] px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                          {rarity}
                        </span>
                      ) : null}
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="line-clamp-2 text-base font-semibold" style={{ color: isDark ? '#edf4ff' : '#203449' }}>{item.name}</h3>
                        <span className="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold" style={{ borderColor: isDark ? '#4b6075' : '#d8ccbd', color: isDark ? '#b5c5d5' : '#65798e' }}>
                          Stufe {Math.max(1, item.level || 1)}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed" style={{ color: isDark ? '#aabdd1' : '#61768d' }}>{item.description || 'Ein besonderes Fundst\u00fcck aus einem Abenteuer.'}</p>
                      {date ? <p className="mt-3 text-xs" style={{ color: isDark ? '#8197af' : '#7b8c9d' }}>Gefunden am {date}</p> : null}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <ArtifactDetailModal item={selected} isOpen={Boolean(selected)} onClose={() => setSelected(null)} showStoryLink />
    </div>
  );
};

export default AvatarTreasureRoom;
