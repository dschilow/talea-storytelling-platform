import React, { useMemo, useState } from 'react';
import { Book, PackageOpen, Shield, Swords, Users } from 'lucide-react';

import { useTheme } from '../../contexts/ThemeContext';
import { InventoryItem } from '../../types/avatar';
import InventoryItemCard from './InventoryItemCard';
import ArtifactDetailModal from './ArtifactDetailModal';

interface TreasureRoomProps {
  items: InventoryItem[];
}

const formatCount = (items: InventoryItem[], type: InventoryItem['type']) =>
  items.filter((item) => item.type === type).length;

const TreasureRoom: React.FC<TreasureRoomProps> = ({ items }) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const sortedItems = useMemo(
    () =>
      [...(items || [])].sort(
        (a, b) => new Date(b.acquiredAt).getTime() - new Date(a.acquiredAt).getTime()
      ),
    [items]
  );

  const handleItemClick = (item: InventoryItem) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedItem(null), 200);
  };

  if (!sortedItems.length) {
    return (
      <div
        className="rounded-3xl border px-6 py-10 text-center"
        style={{
          borderColor: isDark ? '#34495f' : '#ddcfbe',
          background: isDark ? 'rgba(21,32,47,0.8)' : 'rgba(255,251,245,0.9)',
        }}
      >
        <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: isDark ? 'rgba(59,78,103,0.45)' : '#ece3d9' }}>
          <PackageOpen className="h-7 w-7" style={{ color: isDark ? '#e3ecfa' : '#425974' }} />
        </div>
        <h3 className="text-xl font-semibold" style={{ color: isDark ? '#e8f0fb' : '#213247' }}>
          Die Schatzkammer ist noch leer
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed" style={{ color: isDark ? '#9eb1ca' : '#647a92' }}>
          Beim Lesen von Geschichten und Dokus sammelt dein Avatar neue Artefakte. Diese tauchen danach hier auf.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <StatTile
            icon={<Shield className="h-4 w-4" />}
            label="Artefakte"
            value={sortedItems.length}
            isDark={isDark}
          />
          <StatTile
            icon={<Swords className="h-4 w-4" />}
            label="Werkzeuge"
            value={formatCount(sortedItems, 'WEAPON')}
            isDark={isDark}
          />
          <StatTile
            icon={<Book className="h-4 w-4" />}
            label="Wissen"
            value={formatCount(sortedItems, 'KNOWLEDGE')}
            isDark={isDark}
          />
          <StatTile
            icon={<Users className="h-4 w-4" />}
            label="Begleiter"
            value={formatCount(sortedItems, 'COMPANION')}
            isDark={isDark}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {sortedItems.map((item) => (
            <InventoryItemCard key={item.id} item={item} onClick={() => handleItemClick(item)} />
          ))}
        </div>
      </div>

      <ArtifactDetailModal item={selectedItem} isOpen={isModalOpen} onClose={handleCloseModal} showStoryLink />
    </>
  );
};

const StatTile: React.FC<{ icon: React.ReactNode; label: string; value: number; isDark: boolean }> = ({
  icon,
  label,
  value,
  isDark,
}) => (
  <div
    className="rounded-2xl border px-3 py-2.5"
    style={{
      borderColor: isDark ? '#33485f' : '#dbcdbd',
      background: isDark ? 'rgba(23,34,49,0.82)' : 'rgba(255,251,245,0.9)',
    }}
  >
    <div className="flex items-center justify-between">
      <span style={{ color: isDark ? '#9cb1cb' : '#6b8099' }}>{icon}</span>
      <span className="text-lg font-semibold" style={{ color: isDark ? '#e8effb' : '#213247' }}>
        {value}
      </span>
    </div>
    <p className="mt-1 text-[11px] uppercase tracking-[0.1em]" style={{ color: isDark ? '#8fa4c1' : '#7286a0' }}>
      {label}
    </p>
  </div>
);

export default TreasureRoom;
