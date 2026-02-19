/**
 * TaleaJourneyCard.tsx  –  Phase A
 * Startseiten-Kachel → Link auf /map
 * Wird in TaleaHomeScreen.tsx eingefügt.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, MapPin, Sparkles } from 'lucide-react';

interface Props {
  isDark: boolean;
  /** Anzahl offener (available) Stops heute (optional, default 3) */
  openStopsToday?: number;
  avatarId?: string | null;
}

const TaleaJourneyCard: React.FC<Props> = ({ isDark, openStopsToday = 3, avatarId }) => {
  const navigate = useNavigate();

  return (
    <motion.button
      type="button"
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => navigate(avatarId ? `/map?avatarId=${encodeURIComponent(avatarId)}` : '/map')}
      className="group relative w-full overflow-hidden rounded-3xl border text-left"
      style={{
        borderColor: isDark ? '#2a4060' : '#d8c8b8',
        background: isDark
          ? 'linear-gradient(135deg,rgba(40,28,70,0.88) 0%,rgba(22,36,58,0.92) 100%)'
          : 'linear-gradient(135deg,#ede3ff 0%,#d6e8f8 60%,#d8f0e8 100%)',
        boxShadow: isDark
          ? '0 12px 32px rgba(8,14,24,0.32)'
          : '0 12px 32px rgba(80,80,120,0.12)',
      }}
    >
      {/* Dekorativer Hintergrund-Blob */}
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-30"
        style={{ background: isDark ? 'radial-gradient(#7b5ef6, transparent 70%)' : 'radial-gradient(#a78bfa, transparent 70%)' }}
      />

      <div className="relative z-10 flex items-center gap-4 px-5 py-5">
        {/* Map-Icon */}
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-md"
          style={{
            background: isDark ? 'rgba(123,94,246,0.18)' : 'rgba(167,139,250,0.18)',
            border: isDark ? '1.5px solid rgba(123,94,246,0.4)' : '1.5px solid rgba(167,139,250,0.5)',
          }}
        >
          🗺️
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] font-bold uppercase tracking-[0.18em]"
            style={{ color: isDark ? '#9a88d0' : '#7c6aab' }}
          >
            Dein Abenteuer
          </p>
          <h2
            className="mt-0.5 text-lg font-extrabold leading-tight"
            style={{ color: isDark ? '#e8f0fb' : '#1e2a3a' }}
          >
            Reise-Karte
          </h2>
          <p
            className="mt-1 flex items-center gap-1.5 text-[12px] font-semibold"
            style={{ color: isDark ? '#7a9bbf' : '#5a7a8a' }}
          >
            <MapPin className="h-3.5 w-3.5" />
            Heute: {openStopsToday} Stops offen
          </p>
        </div>

        {/* CTA */}
        <div
          className="flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-white shadow-md"
          style={{
            background: isDark
              ? 'linear-gradient(135deg,#7b5ef6,#5eb8f5)'
              : 'linear-gradient(135deg,#a78bfa,#60a5fa)',
          }}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Los!
          <ArrowRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </motion.button>
  );
};

export default TaleaJourneyCard;
