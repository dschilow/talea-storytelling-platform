/**
 * TaleaMapNodeSheet.tsx  –  Phase A
 * Bottom-Sheet / Info-Panel beim Klicken auf eine Station.
 * Zeigt Titel, Beschreibung, Reward-Vorschau + Start-Button.
 */
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, CheckCircle2, ChevronDown, Flame, GitFork,
  Headphones, HelpCircle, Sparkles, X,
} from 'lucide-react';
import type { MapNode, NodeState, NodeType } from './TaleaLearningPathTypes';
import { useLearningPathProgress } from './TaleaLearningPathProgressStore';
import { ROUTE_TO_TRAITS, ROUTE_META } from './constants/routeTraitMapping';
import { getTraitLabel, getTraitIcon } from '../../constants/traits';

const TYPE_META: Record<NodeType, { icon: React.ElementType; label: string; color: string }> = {
  DokuStop:    { icon: BookOpen,    label: 'Doku-Stop',     color: '#4f8cf5' },
  QuizStop:    { icon: HelpCircle,  label: 'Quiz-Stop',     color: '#9b5ef5' },
  StoryGate:   { icon: Sparkles,    label: 'Story-Tor',     color: '#f56b9b' },
  StudioStage: { icon: Headphones,  label: 'Audio-Station', color: '#22c99a' },
  MemoryFire:  { icon: Flame,       label: 'Erinnerungs-Feuer', color: '#f5a623' },
  Fork:        { icon: GitFork,     label: 'Abzweigung',    color: '#5eb8f5' },
};

const ROUTE_LABEL: Record<string, string> = {
  heart:   '❤️ Herz',
  mind:    '🧠 Wissen',
  courage: '🛡️ Mut',
  creative:'🎨 Kreativ',
};

interface Props {
  node: MapNode;
  state: NodeState;
  isDark: boolean;
  onClose: () => void;
  /** Avatar trait values { traitId → value } for displaying current levels */
  traitValues?: Record<string, number>;
}

const TaleaMapNodeSheet: React.FC<Props> = ({ node, state, isDark, onClose, traitValues }) => {
  const navigate = useNavigate();
  const { markNodeDone } = useLearningPathProgress();
  const meta = TYPE_META[node.type];
  const Icon = state === 'done' ? CheckCircle2 : meta.icon;

  // Schließen mit Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleStart = () => {
    if (node.action.type === 'navigate') {
      const params = new URLSearchParams(node.action.params ?? {}).toString();
      navigate(`${node.action.to}${params ? `?${params}` : ''}`);
      markNodeDone(node.nodeId);
    } else if (node.action.type === 'sheet') {
      // MemoryFire → TODO: öffne Mini-Reflexion (Phase D)
      markNodeDone(node.nodeId);
      onClose();
    }
    // Fork → handled inline below
  };

  const bg  = isDark ? 'rgba(15,24,38,0.97)' : 'rgba(255,252,246,0.98)';
  const brd = isDark ? '#2a3d52' : '#e0d1bf';

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 z-40 bg-black/40"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl border-t px-5 pb-safe-area pb-8 pt-4 shadow-2xl"
        style={{ background: bg, borderColor: brd }}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      >
        {/* Griff */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: isDark ? '#3a5068' : '#d5bfae' }} />

        {/* Close-Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border"
          style={{ borderColor: brd, color: isDark ? '#8aa0b8' : '#8a9aaa' }}
          aria-label="Schließen"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Icon + Typ */}
        <div className="mb-3 flex items-center gap-2">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-2xl"
            style={{ background: `${meta.color}18`, border: `1.5px solid ${meta.color}50` }}
          >
            <Icon className="h-5 w-5" style={{ color: meta.color }} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: meta.color }}>
              {meta.label}
            </p>
            <p className="text-[10px] font-semibold" style={{ color: isDark ? '#7a9bbf' : '#8a9aaa' }}>
              {ROUTE_LABEL[node.route]}
            </p>
          </div>
        </div>

        {/* Titel & Subtitle */}
        <h2 className="text-xl font-bold" style={{ color: isDark ? '#e8f0fb' : '#1e2a3a' }}>
          {node.title}
        </h2>
        <p className="mt-1 text-sm" style={{ color: isDark ? '#9ab8d2' : '#5a7a8a' }}>
          {node.subtitle}
        </p>

        {/* Reward-Vorschau */}
        {node.rewardPreview && (
          <div
            className="mt-3 flex items-center gap-2 rounded-xl border px-3 py-2"
            style={{ borderColor: isDark ? '#2a3d52' : '#e0d1bf', background: isDark ? 'rgba(20,30,45,0.6)' : 'rgba(255,249,238,0.8)' }}
          >
            {node.rewardPreview.chestPossible && <span className="text-lg">🎁</span>}
            <p className="text-[11px] font-semibold" style={{ color: isDark ? '#c8d8ec' : '#4a6070' }}>
              {node.rewardPreview.label ?? (node.rewardPreview.stamps ? `+${node.rewardPreview.stamps} Stempel` : 'Belohnung möglich')}
            </p>
          </div>
        )}

        {/* Trait development section */}
        {ROUTE_TO_TRAITS[node.route] && (
          <div
            className="mt-3 rounded-xl border px-3 py-2.5"
            style={{
              borderColor: isDark ? '#2a3d52' : '#e0d1bf',
              background: isDark ? 'rgba(20,30,45,0.5)' : 'rgba(255,249,238,0.7)',
            }}
          >
            <p
              className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em]"
              style={{ color: ROUTE_META[node.route]?.color ?? (isDark ? '#7a9bbf' : '#8a9aaa') }}
            >
              {ROUTE_META[node.route]?.icon} Fördert
            </p>
            <div className="flex flex-wrap gap-2">
              {ROUTE_TO_TRAITS[node.route].map((traitId) => {
                const val = traitValues?.[traitId] ?? 0;
                return (
                  <div
                    key={traitId}
                    className="flex items-center gap-1.5 rounded-lg border px-2 py-1"
                    style={{
                      borderColor: isDark ? '#1c3050' : '#d5c5b0',
                      background: isDark ? 'rgba(14,24,40,0.7)' : 'rgba(255,254,250,0.9)',
                    }}
                  >
                    <span className="text-sm">{getTraitIcon(traitId)}</span>
                    <span
                      className="text-[11px] font-semibold"
                      style={{ color: isDark ? '#c8d8ec' : '#3a5060' }}
                    >
                      {getTraitLabel(traitId, 'de')}
                    </span>
                    {traitValues && (
                      <span
                        className="rounded-full px-1.5 py-[1px] text-[9px] font-black"
                        style={{
                          background: val > 0
                            ? (isDark ? 'rgba(34,201,154,0.18)' : 'rgba(34,201,154,0.12)')
                            : (isDark ? 'rgba(50,70,100,0.3)' : 'rgba(120,120,140,0.1)'),
                          color: val > 0 ? '#22c99a' : (isDark ? '#5a7a98' : '#9aa0a8'),
                        }}
                      >
                        {val}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Fork-Optionen */}
        {node.action.type === 'fork' && (
          <div className="mt-4 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: isDark ? '#7a9bbf' : '#8a9aaa' }}>
              Welchen Weg wählst du?
            </p>
            {node.action.options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => { markNodeDone(node.nodeId); onClose(); }}
                className="flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors"
                style={{ borderColor: isDark ? '#2a3d52' : '#e0d1bf', background: isDark ? 'rgba(20,32,48,0.7)' : 'rgba(255,252,246,0.9)' }}
              >
                <span className="text-xl">{opt.icon}</span>
                <p className="text-sm font-semibold" style={{ color: isDark ? '#e0eaf8' : '#1e2a3a' }}>{opt.label}</p>
              </button>
            ))}
          </div>
        )}

        {/* Start-Button (nicht bei Fork) */}
        {node.action.type !== 'fork' && state !== 'done' && (
          <button
            type="button"
            onClick={handleStart}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white shadow-lg transition-transform active:scale-[0.97]"
            style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}bb)` }}
          >
            Los!
          </button>
        )}

        {state === 'done' && (
          <div
            className="mt-5 flex items-center justify-center gap-2 rounded-2xl py-3"
            style={{ background: isDark ? 'rgba(34,201,154,0.1)' : 'rgba(34,201,154,0.08)' }}
          >
            <CheckCircle2 className="h-5 w-5 text-[#22c99a]" />
            <p className="text-sm font-bold text-[#22c99a]">Bereits abgeschlossen</p>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default TaleaMapNodeSheet;
