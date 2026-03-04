import React, { useMemo } from "react";
import { CheckCircle, Lightbulb } from "lucide-react";
import type { DomainProgress } from "./CosmosTypes";
import { getDomainById, resolveCosmosDomains } from "./CosmosAssetsRegistry";
import { getStageLabel, getStageColor } from "./CosmosProgressMapper";
import type { ParentEvidenceHighlightDTO } from "./apiCosmosClient";

interface Props {
  domains: DomainProgress[];
  childName: string;
  highlights?: ParentEvidenceHighlightDTO[];
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
  highlights: evidenceHighlights = [],
}) => {
  const resolvedDomains = useMemo(
    () => resolveCosmosDomains(domains.map((entry) => entry.domainId)),
    [domains]
  );

  const cards = useMemo(() => {
    const result: HighlightCard[] = [];
    const name = childName || "Ihr Kind";

    if (evidenceHighlights.length > 0) {
      for (const entry of evidenceHighlights.slice(0, 6)) {
        const domain = getDomainById(entry.domainId, resolvedDomains);
        const stage = domains.find((d) => d.domainId === entry.domainId)?.stage || "discovered";
        result.push({
          id: entry.id,
          icon: domain?.icon || "✨",
          domainLabel: domain?.label || entry.domainId,
          text: entry.summary,
          evidenceBasis: `${entry.eventType.toUpperCase()} · ${new Date(entry.timestamp).toLocaleDateString("de-DE")}`,
          recommendation: "Naechster Schritt: kurze Wiederholung und Transferfrage im selben Themenfeld.",
          stageColor: getStageColor(stage),
        });
      }
      return result;
    }

    const activeDomains = domains
      .filter((d) => d.topicsExplored > 0 || d.mastery > 0)
      .sort((a, b) => (b.planetLevel || 1) - (a.planetLevel || 1));

    for (const dp of activeDomains.slice(0, 4)) {
      const domain = getDomainById(dp.domainId, resolvedDomains);
      if (!domain) continue;

      const stageLabel = getStageLabel(dp.stage);
      const stageColor = getStageColor(dp.stage);

      let text = `${name} hat erste Lernspuren in "${domain.label}" gesammelt.`;
      let evidenceBasis = `${dp.topicsExplored} Thema${dp.topicsExplored !== 1 ? "n" : ""} mit Aktivitaet.`;
      let recommendation = "Breite Themenvielfalt anbieten, um Interessen zu entdecken.";

      if (dp.stage === "retained") {
        text = `${name} zeigt in "${domain.label}" stabile Langzeit-Sicherheit.`;
        evidenceBasis = `Stufe "${stageLabel}" erreicht, Recall-Aufgaben wurden erfolgreich abgeschlossen.`;
        recommendation = "Vertiefte Themen und Transferaufgaben in neue Kontexte anbieten.";
      } else if (dp.stage === "apply") {
        text = `${name} kann Inhalte in "${domain.label}" bereits anwenden.`;
        evidenceBasis = `Stufe "${stageLabel}" erreicht, Quiz-Serien zeigen belastbares Verstaendnis.`;
        recommendation = "Recall-Fenster nutzen, damit das Wissen langfristig sitzt.";
      } else if (dp.stage === "understood") {
        text = `${name} versteht zentrale Zusammenhaenge in "${domain.label}".`;
        evidenceBasis = `Stufe "${stageLabel}" erreicht, mehrere Quiz-Sessions mit guter Genauigkeit.`;
        recommendation = "Mit Vergleichs- und Anwendungsfragen weiter vertiefen.";
      }

      result.push({
        id: dp.domainId,
        icon: domain.icon,
        domainLabel: domain.label,
        text,
        evidenceBasis,
        recommendation,
        stageColor,
      });
    }

    if (result.length === 0) {
      result.push({
        id: "empty",
        icon: "🌱",
        domainLabel: "Startbereit",
        text: `${name}s Lernkosmos wartet auf die ersten Lernschritte.`,
        evidenceBasis: "Noch keine Lernaktivitaeten aufgezeichnet.",
        recommendation: "Eine erste Doku oder Story starten.",
        stageColor: "#94a3b8",
      });
    }

    return result;
  }, [domains, childName, evidenceHighlights, resolvedDomains]);

  return (
    <div className="space-y-4">
      {cards.map((card) => (
        <div
          key={card.id}
          className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4 shadow-sm"
        >
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

          <p className="text-sm text-slate-600 dark:text-slate-300 mb-3 leading-relaxed">
            {card.text}
          </p>

          <div className="flex items-start gap-2 mb-2 text-xs text-slate-500 dark:text-slate-400">
            <CheckCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-green-500" />
            <span>{card.evidenceBasis}</span>
          </div>

          <div className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
            <span>{card.recommendation}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

