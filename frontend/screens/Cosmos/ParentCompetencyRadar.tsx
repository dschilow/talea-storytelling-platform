/**
 * ParentCompetencyRadar.tsx - Competency profile visualization
 *
 * Simple radar/bar chart showing mastery across domains.
 * Uses pure SVG — no chart library needed.
 */

import React from 'react';
import type { DomainProgress } from './CosmosTypes';
import { getDomainById, resolveCosmosDomains } from './CosmosAssetsRegistry';
import { getStageColor } from './CosmosProgressMapper';

interface Props {
  domains: DomainProgress[];
}

export const ParentCompetencyRadar: React.FC<Props> = ({ domains }) => {
  // Sort by mastery descending
  const sorted = [...domains].sort((a, b) => b.mastery - a.mastery);
  const resolvedDomains = resolveCosmosDomains(domains.map((entry) => entry.domainId));

  return (
    <div className="space-y-3">
      {sorted.map((dp) => {
        const domain = getDomainById(dp.domainId, resolvedDomains);
        if (!domain) return null;

        const stageColor = getStageColor(dp.stage);

        return (
          <div key={dp.domainId} className="group">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-base">{domain.icon}</span>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  {domain.label}
                </span>
              </div>
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-md"
                style={{
                  color: stageColor,
                  background: `${stageColor}15`,
                }}
              >
                {Math.round(dp.mastery)}%
              </span>
            </div>

            {/* Mastery bar */}
            <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700/50 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.max(2, dp.mastery)}%`,
                  background: `linear-gradient(90deg, ${domain.color}, ${domain.emissiveColor})`,
                }}
              />
            </div>

            {/* Confidence sub-bar */}
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 w-16">
                Sicherheit
              </span>
              <div className="h-1 flex-1 rounded-full bg-slate-100 dark:bg-slate-700/30 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.max(1, dp.confidence)}%`,
                    background: stageColor,
                    opacity: 0.6,
                  }}
                />
              </div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 w-8 text-right">
                {Math.round(dp.confidence)}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
