import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, Clock3, Coins, Cpu, Download, Image as ImageIcon, Loader2 } from 'lucide-react';

import type { AdminGenerationMetricsData, Story } from '../../types/story';
import { useBackend } from '../../hooks/useBackend';

type Props = {
  storyId: string;
  storyTitle: string;
  metadata?: Story['metadata'];
};

const tokenFormatter = new Intl.NumberFormat('de-DE');
const usdFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 4,
  maximumFractionDigits: 6,
});

function finite(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDuration(durationMs: number): string {
  if (durationMs <= 0) return '–';
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes} Min. ${seconds} Sek.` : `${seconds} Sek.`;
}

function legacyMetrics(metadata?: Story['metadata']): AdminGenerationMetricsData | null {
  const usage = metadata?.tokensUsed;
  const cost = metadata?.totalCost;
  if (!usage && !cost) return null;

  return {
    version: 1,
    currency: 'USD',
    calculatedAt: '',
    tokens: {
      input: finite(usage?.prompt),
      cachedInput: 0,
      output: finite(usage?.completion),
      total: finite(usage?.total),
    },
    costs: {
      cachedInputUSD: 0,
      inputUSD: 0,
      outputUSD: 0,
      storyUSD: finite(cost?.text),
      imagesUSD: finite(cost?.images),
      totalUSD: finite(cost?.total),
      imageCredits: 0,
    },
    calls: {
      llm: Array.isArray(metadata?.devModeStages) ? metadata.devModeStages.length : 0,
      images: finite(metadata?.imagesGenerated),
    },
    durationMs: finite(metadata?.processingTime),
    imageCostEstimated: true,
    stages: (metadata?.devModeStages || []).map((stage) => ({
      key: stage.stage,
      calls: 1,
      inputTokens: finite(stage.usage?.prompt),
      outputTokens: finite(stage.usage?.completion),
      totalTokens: finite(stage.usage?.total),
      totalCostUSD: 0,
    })),
    models: [],
  };
}

function safeFilename(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 70) || 'talea-story';
}

export const AdminGenerationMetrics: React.FC<Props> = ({ metadata, storyId, storyTitle }) => {

  const metrics = useMemo(
    () => metadata?.adminGenerationMetrics || legacyMetrics(metadata),
    [metadata],
  );
  const backend = useBackend();
  const [downloadState, setDownloadState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleDownloadLogs = async () => {
    if (!storyId || downloadState === 'loading') return;
    setDownloadState('loading');
    try {
      const payload = await backend.story.dumpStoryLogs({ storyId });
      const downloadDocument = {
        storyId,
        downloadedAt: new Date().toISOString(),
        logs: payload.logs,
      };
      const blob = new Blob([JSON.stringify(downloadDocument, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = `${safeFilename(storyTitle)}-${storyId.slice(0, 8)}-logs.json`;
      anchor.style.display = 'none';
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setDownloadState('success');
    } catch (error) {
      console.error('[AdminGenerationMetrics] Story logs download failed', error);
      setDownloadState('error');
    }
  };

  if (!metrics) return null;

  const stageRows = metrics.stages.filter((stage) => stage.totalTokens > 0 || stage.totalCostUSD > 0);

  return (
    <section className="mx-auto w-full max-w-5xl px-4 pb-8 sm:px-6" aria-label="Generierungskosten für Administratoren">
      <details className="group overflow-hidden rounded-[26px] border border-amber-500/20 bg-slate-950/95 text-slate-100 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.85)]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-amber-300/40 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-300">
              <Cpu className="h-4 w-4" />
              Nur für Administratoren
            </div>
            <p className="mt-1 text-base font-semibold text-white">Generierung &amp; Kosten</p>
          </div>
          <ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180" />
        </summary>

        <div className="border-t border-white/10 px-5 pb-6 pt-5 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard icon={<Coins />} label="Gesamtkosten" value={usdFormatter.format(metrics.costs.totalUSD)} accent />
            <MetricCard icon={<Cpu />} label="Tokens gesamt" value={tokenFormatter.format(metrics.tokens.total)} />
            <MetricCard icon={<ImageIcon />} label="Bildkosten" value={usdFormatter.format(metrics.costs.imagesUSD)} />
            <MetricCard icon={<Clock3 />} label="Pipeline-Laufzeit" value={formatDuration(metrics.durationMs)} />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <MetricGroup title="Tokenverbrauch">
              <MetricLine label="Input" value={tokenFormatter.format(metrics.tokens.input)} />
              <MetricLine label="Davon Cache-Input" value={tokenFormatter.format(metrics.tokens.cachedInput)} />
              <MetricLine label="Output" value={tokenFormatter.format(metrics.tokens.output)} />
              <MetricLine label="LLM-Aufrufe" value={tokenFormatter.format(metrics.calls.llm)} />
            </MetricGroup>

            <MetricGroup title="Kostenabrechnung">
              <MetricLine label="Story / LLM gesamt" value={usdFormatter.format(metrics.costs.storyUSD)} />
              <MetricLine label="Input" value={usdFormatter.format(metrics.costs.inputUSD)} />
              <MetricLine label="Output" value={usdFormatter.format(metrics.costs.outputUSD)} />
              <MetricLine label={`Bilder (${metrics.calls.images})`} value={usdFormatter.format(metrics.costs.imagesUSD)} />
              {metrics.costs.imageCredits > 0 && (
                <MetricLine label="Bild-Credits" value={metrics.costs.imageCredits.toFixed(4)} />
              )}
            </MetricGroup>
          </div>

          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-amber-300/15 bg-amber-300/[0.05] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-100">Story-Logs</h3>
              <p className="mt-1 text-xs leading-5 text-slate-400">Alle zu dieser Story gespeicherten Pipeline-Logs als JSON herunterladen.</p>
              {downloadState === 'error' && <p className="mt-1 text-xs text-rose-300" role="alert">Download fehlgeschlagen. Bitte erneut versuchen.</p>}
            </div>
            <button
              type="button"
              onClick={() => void handleDownloadLogs()}
              disabled={downloadState === 'loading'}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-2.5 text-sm font-semibold text-amber-100 transition hover:bg-amber-300/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/30 disabled:cursor-wait disabled:opacity-60"
              aria-label="Alle Story-Logs herunterladen"
            >
              {downloadState === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : downloadState === 'success' ? <Check className="h-4 w-4" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
              {downloadState === 'loading' ? 'Wird vorbereitet...' : downloadState === 'success' ? 'Logs heruntergeladen' : 'Alle Logs herunterladen'}
            </button>
          </div>
          {stageRows.length > 0 && (
            <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
              <div className="border-b border-white/10 bg-white/[0.04] px-4 py-3">
                <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-300">Pipeline-Stufen</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-xs">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Stufe</th>
                      <th className="px-3 py-3 text-right font-semibold">Aufrufe</th>
                      <th className="px-3 py-3 text-right font-semibold">Input</th>
                      <th className="px-3 py-3 text-right font-semibold">Output</th>
                      <th className="px-4 py-3 text-right font-semibold">Kosten</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.07]">
                    {stageRows.map((stage) => (
                      <tr key={stage.key} className="text-slate-300">
                        <td className="max-w-[260px] truncate px-4 py-3 font-medium" title={stage.key}>{stage.key}</td>
                        <td className="px-3 py-3 text-right">{stage.calls}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{tokenFormatter.format(stage.inputTokens)}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{tokenFormatter.format(stage.outputTokens)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{stage.totalCostUSD > 0 ? usdFormatter.format(stage.totalCostUSD) : '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="mt-4 text-[11px] leading-5 text-slate-500">
            Beträge in USD. {metrics.imageCostEstimated ? 'Bildkosten sind anhand des Provider-Stückpreises berechnet. ' : ''}
            Cache-Rabatte werden separat ausgewiesen, sofern der Provider sie meldet.
          </p>
        </div>
      </details>
    </section>
  );
};

const MetricCard: React.FC<{ icon: React.ReactNode; label: string; value: string; accent?: boolean }> = ({ icon, label, value, accent }) => (
  <div className={`rounded-2xl border px-4 py-4 ${accent ? 'border-amber-400/25 bg-amber-300/[0.08]' : 'border-white/10 bg-white/[0.04]'}`}>
    <div className={`h-4 w-4 ${accent ? 'text-amber-300' : 'text-slate-500'}`}>{icon}</div>
    <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
    <p className="mt-1 text-lg font-semibold tabular-nums text-white">{value}</p>
  </div>
);

const MetricGroup: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
    <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{title}</h3>
    <div className="space-y-2.5">{children}</div>
  </div>
);

const MetricLine: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-4 text-sm">
    <span className="text-slate-500">{label}</span>
    <span className="font-medium tabular-nums text-slate-200">{value}</span>
  </div>
);
