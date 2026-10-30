import React from 'react';
import { FlaskConical, Headphones } from 'lucide-react';
import ProgressiveImage from '../common/ProgressiveImage';
import { TaleaCardMenu, type TaleaCardMenuAction } from '../talea/TaleaCardMenu';
import { taleaDisplayFont } from '../talea/TaleaPastelPrimitives';

export type DokuViewMode = 'grid' | 'list';

/** The same cover-first grid and compact list treatment used by the story library. */
export const DokuLibraryItem: React.FC<{
  title: string;
  cover?: string;
  eyebrow?: string;
  description?: string;
  metadata?: string;
  badge?: React.ReactNode;
  audio?: boolean;
  loading?: 'lazy' | 'eager';
  viewMode?: DokuViewMode;
  actions: TaleaCardMenuAction[];
  onOpen: () => void;
}> = ({ title, cover, eyebrow, description, metadata, badge, audio, loading = 'lazy', viewMode = 'grid', actions, onOpen }) => {
  const list = viewMode === 'list';
  const FallbackIcon = audio ? Headphones : FlaskConical;
  return (
    <article className={list
      ? 'group relative flex items-start gap-2 rounded-[1.375rem] border border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] p-2.5 pr-3 shadow-[var(--talea-shadow-soft)] transition-shadow hover:shadow-[var(--talea-shadow-medium)]'
      : 'group relative min-w-0'}>
      <button type="button" onClick={onOpen} aria-label={`${title} öffnen`} className={list
        ? 'flex min-w-0 flex-1 items-center gap-3.5 rounded-xl text-left focus-visible:outline-2 focus-visible:outline-[var(--primary)] sm:gap-4'
        : 'flex w-full flex-col text-left focus-visible:outline-none'}>
        <div className={list
          ? 'relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[var(--talea-media-skeleton)] sm:h-24 sm:w-24'
          : 'relative aspect-square w-full overflow-hidden rounded-[18px] bg-[var(--talea-media-skeleton)] ring-1 ring-black/5 transition duration-300 group-hover:-translate-y-0.5 group-hover:shadow-[var(--talea-shadow-medium)] group-focus-visible:ring-2 group-focus-visible:ring-[var(--primary)] motion-reduce:transition-none motion-reduce:group-hover:translate-y-0'}>
          {cover && <img src={cover} alt="" loading={loading} decoding="async" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-75 blur-xl" />}
          <ProgressiveImage src={cover} alt="" loading={loading} containerClassName="relative h-full w-full" imageClassName="object-contain transition-transform duration-700 ease-out group-hover:scale-[1.03] motion-reduce:transition-none" fallback={<div className="flex h-full w-full items-center justify-center [background:var(--talea-gradient-nature)] text-[var(--talea-text-tertiary)]"><FallbackIcon className={list ? 'h-8 w-8' : 'h-12 w-12'} /></div>} />
          {!list && badge ? <div className="absolute bottom-2.5 left-2.5">{badge}</div> : null}
        </div>
        <div className={list ? 'min-w-0 flex-1' : 'mt-2.5 px-0.5'}>
          {eyebrow && <p className="truncate text-[11.5px] font-bold uppercase tracking-[0.08em] text-[var(--talea-text-tertiary)]">{eyebrow}</p>}
          <h3 className={list ? 'line-clamp-2 text-[17px] font-semibold leading-snug text-[var(--talea-text-primary)]' : 'mt-0.5 line-clamp-2 text-[15px] font-semibold leading-snug text-[var(--talea-text-primary)] sm:text-[16px]'} style={{ fontFamily: taleaDisplayFont }}>{title}</h3>
          {list && description && <p className="mt-0.5 line-clamp-1 text-[15px] text-[var(--talea-text-secondary)] sm:line-clamp-2">{description}</p>}
          {(metadata || (list && badge)) && <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12.5px] text-[var(--talea-text-tertiary)]">{list && badge}{metadata && <span>{metadata}</span>}</div>}
        </div>
      </button>
      <TaleaCardMenu actions={actions} label={`Aktionen für ${title}`} className={list ? 'self-start [&>button]:bg-[var(--talea-surface-inset)] [&>button]:text-[var(--talea-text-secondary)] [&>button]:backdrop-blur-none' : '!absolute right-2 top-2'} />
    </article>
  );
};
