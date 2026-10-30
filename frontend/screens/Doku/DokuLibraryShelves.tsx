import React, { useMemo } from 'react';
import { Rail } from '../Library/components/Rail';

/** Uses the Originals shelves, including swipe navigation and desktop arrows. */
export function DokuLibraryShelves<T extends { id: string }>({
  items,
  audio = false,
  groupLabel,
  renderItem,
  onShowAll,
}: {
  items: T[];
  audio?: boolean;
  groupLabel: (item: T) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
  onShowAll: () => void;
}) {
  const groups = useMemo(() => {
    const byLabel = new Map<string, T[]>();
    for (const item of items) {
      const label = groupLabel(item);
      const group = byLabel.get(label) ?? [];
      group.push(item);
      byLabel.set(label, group);
    }
    return Array.from(byLabel, ([title, entries]) => ({ title, entries }));
  }, [items, groupLabel]);

  return (
    <div className="space-y-8 sm:space-y-10">
      <Rail
        title={audio ? 'Neu in deiner Hörwelt' : 'Zuletzt dazugekommen'}
        subtitle={audio ? 'Wissen zum Zuhören. Such dir deine nächste Entdeckungsreise aus.' : 'Deine neuesten Wissensabenteuer auf einen Blick.'}
        actionLabel="Alle ansehen"
        onAction={onShowAll}
      >
        {items.slice(0, 8).map(renderItem)}
      </Rail>
      {groups.length > 1 ? groups.map(({ title, entries }) => (
        <Rail key={title} title={title} subtitle={`${entries.length} ${audio ? entries.length === 1 ? 'Audio-Doku' : 'Audio-Dokus' : entries.length === 1 ? 'Doku' : 'Dokus'} zum Entdecken`}>
          {entries.map(renderItem)}
        </Rail>
      )) : items.length > 8 ? (
        <Rail title={audio ? 'Noch mehr zum Anhören' : 'Noch mehr entdecken'} subtitle="Hier geht deine Wissensreise weiter.">
          {items.slice(8).map(renderItem)}
        </Rail>
      ) : null}
    </div>
  );
}
