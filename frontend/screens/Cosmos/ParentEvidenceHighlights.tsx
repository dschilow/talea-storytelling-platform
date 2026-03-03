/**
 * ParentEvidenceHighlights.tsx - Concrete learning evidence cards
 *
 * Each card answers: What was learned? How do we know? What's next?
 * MVP: Generated from domain progress data (later from real evidence events).
 */

import React, { useMemo } from 'react';
import { CheckCircle, TrendingUp, Lightbulb } from 'lucide-react';
import type { DomainProgress } from './CosmosTypes';
import { getDomainById } from './CosmosAssetsRegistry';
import { getStageLabel, getStageColor } from './CosmosProgressMapper';

interface Props {
  domains: DomainProgress[];
  childName: string;
}

interface HighlightCard {
  id: string;
  icon: string;
  domainLabel: string;
  text: string;
  evidenceBasis: string;
  recommendation: string;
  stageColor: string;
}

export const ParentEvidenceHighlights: React.FC<Props> = ({
  domains,
  childName,
}) => {
  const highlights = useMemo(() => {
    const cards: HighlightCard[] = [];
    const name = childName || 'Ihr Kind';

    // Only generate highlights for domains with actual progress
    const activeDomains = domains
      .filter((d) => d.mastery > 0)
      .sort((a, b) => b.mastery - a.mastery);

    for (const dp of activeDomains.slice(0, 4)) {
      const domain = getDomainById(dp.domainId);
      if (!domain) continue;

      const stageLabel = getStageLabel(dp.stage);
      const stageColor = getStageColor(dp.stage);

      let text: string;
      let evidenceBasis: string;
      let recommendation: string;

      switch (dp.stage) {
        case 'mastered':
          text = `${name} hat tiefes Verständnis in "${domain.label}" entwickelt und kann Gelerntes in neuen Kontexten anwenden.`;
          evidenceBasis = `Stufe "${stageLabel}" erreicht (Wissen: ${Math.round(dp.mastery)}%, Sicherheit: ${Math.round(dp.confidence)}%). ${dp.topicsExplored} Themen erkundet.`;
          recommendation = `Vertiefte Themen anbieten oder Verbindungen zu anderen Wissensbereichen herstellen.`;
          break;
        case 'can_explain':
          text = `${name} kann Zusammenhänge in "${domain.label}" erklären und zeigt wachsendes Verständnis.`;
          evidenceBasis = `Stufe "${stageLabel}" (Wissen: ${Math.round(dp.mastery)}%). Erklärungen und Transfer-Aufgaben erfolgreich gelöst.`;
          recommendation = `Recall-Übungen stärken die Langzeit-Verankerung des Wissens.`;
          break;
        case 'understood':
          text = `${name} zeigt Interesse an "${domain.label}" und beginnt Ursache-Wirkung-Zusammenhänge zu verstehen.`;
          evidenceBasis = `Stufe "${stageLabel}" (Wissen: ${Math.round(dp.mastery)}%). Quiz-Ergebnisse zeigen grundlegendes Verständnis.`;
          recommendation = `Weiter erkunden lassen — die Neugier ist da. Vergleichende Fragen fördern tieferes Denken.`;
          break;
        default:
          text = `${name} hat erste Schritte in "${domain.label}" gemacht.`;
          evidenceBasis = `${dp.topicsExplored} Thema${dp.topicsExplored !== 1 ? 'n' : ''} angeschaut. Grundlagen werden aufgebaut.`;
          recommendation = `Breite Themenvielfalt anbieten, um Interessen zu entdecken.`;
      }

      cards.push({
        id: dp.domainId,
        icon: domain.icon,
        domainLabel: domain.label,
        text,
        evidenceBasis,
        recommendation,
        stageColor,
      });
    }

    // If no active domains, show an encouragement card
    if (cards.length === 0) {
      cards.push({
        id: 'empty',
        icon: '🌱',
        domainLabel: 'Startbereit',
        text: `${name}s Lernkosmos wartet darauf, entdeckt zu werden! Jede Geschichte und jede Doku bringt neue Sterne zum Leuchten.`,
        evidenceBasis: 'Noch keine Lernaktivitäten aufgezeichnet.',
        recommendation: 'Eine erste Doku oder Geschichte starten — der Kosmos füllt sich von selbst.',
        stageColor: '#94a3b8',
      });
    }

    return cards;
  }, [domains, childName]);

  return (
    <div className="space-y-4">
      {highlights.map((card) => (
        <div
          key={card.id}
          className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4 shadow-sm"
        >
          {/* Header */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">{card.icon}</span>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
              {card.domainLabel}
            </span>
            <span
              className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-md"
              style={{
                color: card.stageColor,
                background: `${card.stageColor}15`,
              }}
            >
              Evidenz
            </span>
          </div>

          {/* Main text */}
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-3 leading-relaxed">
            {card.text}
          </p>

          {/* Evidence basis */}
          <div className="flex items-start gap-2 mb-2 text-xs text-slate-500 dark:text-slate-400">
            <CheckCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-green-500" />
            <span>{card.evidenceBasis}</span>
          </div>

          {/* Recommendation */}
          <div className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
            <span>{card.recommendation}</span>
          </div>
        </div>
      ))}
    </div>
  );
};
