/**
 * ParentDashboardRoot.tsx - "Bildungskompass" parent dashboard
 *
 * Route: /cosmos/parent
 * Shows: Interest profile, competency development, evidence highlights.
 * Serious, professional design — no gamification.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  BookOpen,
  Brain,
  Compass,
  TrendingUp,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useCosmosState } from './useCosmosState';
import { ParentCompetencyRadar } from './ParentCompetencyRadar';
import { ParentEvidenceHighlights } from './ParentEvidenceHighlights';
import { getDomainById, resolveCosmosDomains } from './CosmosAssetsRegistry';
import { fetchCosmosParentSummary, type CosmosParentSummaryDTO } from './apiCosmosClient';

const ParentDashboardRoot: React.FC = () => {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const { cosmosState, isLoading, activeAvatarId } = useCosmosState();
  const [summary, setSummary] = useState<CosmosParentSummaryDTO | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadSummary() {
      if (!activeAvatarId) {
        setSummary(null);
        return;
      }
      setSummaryLoading(true);
      try {
        const token = await getToken();
        const data = await fetchCosmosParentSummary(
          {
            avatarId: activeAvatarId,
            range: 'month',
          },
          { token }
        );
        if (!mounted) return;
        setSummary(data);
      } catch (error) {
        console.warn('[ParentDashboardRoot] Failed to load parent summary', error);
        if (mounted) setSummary(null);
      } finally {
        if (mounted) setSummaryLoading(false);
      }
    }

    void loadSummary();
    return () => {
      mounted = false;
    };
  }, [activeAvatarId, getToken]);

  const resolvedDomains = useMemo(
    () => resolveCosmosDomains(cosmosState.domains.map((entry) => entry.domainId)),
    [cosmosState.domains]
  );

  // Interest profile: top domains by mastery
  const interestProfile = useMemo(() => {
    return [...cosmosState.domains]
      .filter((d) => d.mastery > 0)
      .sort((a, b) => b.mastery - a.mastery)
      .slice(0, 5);
  }, [cosmosState.domains]);

  const totalTopicsExplored = useMemo(
    () => cosmosState.domains.reduce((sum, d) => sum + d.topicsExplored, 0),
    [cosmosState.domains]
  );

  const activeDomainCount = useMemo(
    () => cosmosState.domains.filter((d) => d.mastery > 0).length,
    [cosmosState.domains]
  );

  const childName = cosmosState.childName || 'Ihr Kind';

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="h-8 w-8 rounded-full border-2 border-purple-500 border-t-transparent"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-5 py-4">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <button
            onClick={() => navigate('/cosmos')}
            className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Zurück
          </button>
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-purple-500" />
            <h1
              className="text-base font-extrabold text-slate-800 dark:text-white"
              style={{ fontFamily: '"Nunito", sans-serif' }}
            >
              Bildungskompass
            </h1>
          </div>
          <div className="w-16" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 pt-6 space-y-6">
        {/* Overview stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={<Brain className="h-4 w-4 text-purple-500" />}
            label="Aktive Bereiche"
            value={`${activeDomainCount} / ${resolvedDomains.length}`}
          />
          <StatCard
            icon={<BookOpen className="h-4 w-4 text-blue-500" />}
            label="Themen erkundet"
            value={String(totalTopicsExplored)}
          />
          <StatCard
            icon={<TrendingUp className="h-4 w-4 text-green-500" />}
            label="Evidenz-Events"
            value={String(summary?.totalEvidenceEvents ?? 0)}
          />
        </div>
        {(summaryLoading || summary?.pendingRecalls) && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            {summaryLoading
              ? 'Evidenzdaten werden aktualisiert...'
              : `${summary?.pendingRecalls ?? 0} Recall-Aufgabe(n) sind fällig.`}
          </div>
        )}

        {/* Interest profile */}
        <Section title="Interessenprofil" subtitle={`Womit beschäftigt sich ${childName} am meisten?`}>
          {interestProfile.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {interestProfile.map((dp, idx) => {
                const domain = getDomainById(dp.domainId, resolvedDomains);
                if (!domain) return null;
                return (
                  <div
                    key={dp.domainId}
                    className="flex items-center gap-2 rounded-xl border px-3 py-2"
                    style={{
                      borderColor: `${domain.color}30`,
                      background: `${domain.color}08`,
                    }}
                  >
                    <span className="text-lg">{domain.icon}</span>
                    <div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        {domain.label}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {Math.round(dp.mastery)}% Wissen
                      </p>
                    </div>
                    {idx === 0 && (
                      <span className="ml-1 text-[10px] font-bold text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">
                        Favorit
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic">
              Noch keine Interessen erkennbar. Die ersten Dokus und Geschichten zeigen bald ein Profil.
            </p>
          )}
        </Section>

        {/* Competency radar */}
        <Section title="Kompetenzentwicklung" subtitle="Wie tief ist das Wissen in jedem Bereich?">
          <ParentCompetencyRadar domains={cosmosState.domains} />
        </Section>

        {/* Evidence highlights */}
        <Section title="Evidenz-Highlights" subtitle="Konkrete Belege für Lernfortschritte">
          <ParentEvidenceHighlights
            domains={cosmosState.domains}
            childName={childName}
            highlights={summary?.highlights ?? []}
          />
        </Section>
      </div>
    </div>
  );
};

// ─── Helper components ────────────────────────────────────────────

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
}> = ({ icon, label, value }) => (
  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4 text-center">
    <div className="flex justify-center mb-2">{icon}</div>
    <p className="text-xl font-black text-slate-800 dark:text-white">{value}</p>
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-1">
      {label}
    </p>
  </div>
);

const Section: React.FC<{
  title: string;
  subtitle: string;
  children: React.ReactNode;
}> = ({ title, subtitle, children }) => (
  <div>
    <h2
      className="text-lg font-extrabold text-slate-800 dark:text-white mb-0.5"
      style={{ fontFamily: '"Nunito", sans-serif' }}
    >
      {title}
    </h2>
    <p className="text-xs text-slate-400 mb-4">{subtitle}</p>
    {children}
  </div>
);

export default ParentDashboardRoot;
