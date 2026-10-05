import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { CASES, IMG } from "./content";
import { featherCount, loadVault, nextRank, rankFor } from "./vault";
import { AlibiController } from "./controller";
import { director } from "./audio";
import { useAlibiCharacters, useAlibiState, usePreviewFaces } from "./hooks";
import { AlibiStage } from "./AlibiStage";

const FEATURES = [
  { img: IMG.icon("phone"), title: "Geheimtelefon", text: "Tavi flüstert jedem ins Ohr, wo er war, wen er gesehen hat und was dort los war. Niemand muss lesen können." },
  { img: IMG.icon("seal"), title: "Siegel und Duelle", text: "Jede Aussage hat eine versiegelte Beobachtung. Bricht das Siegel, fliegt jede Flunkerei auf." },
  { img: IMG.icon("story"), title: "Tathergang und Beute", text: "Am Ende erzählt Tavi, wie es wirklich war. Die Beute kommt in eure Sammlung, und der nächste Fall wartet schon." },
];
const STEPS = [
  { img: IMG.icon("file"), title: "Fall eröffnen", text: "Figuren ziehen, Tavi erzählt, was gestohlen wurde." },
  { img: IMG.icon("phone"), title: "Akte erleben", text: "Geheimtelefon, dann sagt jeder selbst, wo er war." },
  { img: IMG.icon("map"), title: "Ermitteln", text: "Wenige Züge bis zum Morgengrauen: Duell, Siegel, Labor." },
  { img: IMG.icon("vote"), title: "Anklagen", text: "Auf drei zeigen alle auf den Dieb. Dann: der Tathergang." },
];

/** Sammlung auf der Startkarte: Rang, Beutestücke, Federn */
const VaultTeaser: React.FC = () => {
  const [v] = useState(loadVault);
  const rank = rankFor(v.solved), next = nextRank(v.solved), feathers = featherCount(v);
  return (
    <section className="relative overflow-hidden rounded-[28px] border border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] p-5 md:p-6" aria-label="Eure Sammlung">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <img src={IMG.icon("vault")} alt="" className="h-20 w-20 shrink-0 rounded-[20px] bg-[#f6ead0] object-cover" />
          <div>
            <h3 className="text-[18px] font-bold text-[var(--talea-text-primary)]">Eure Sammlung</h3>
            <p className="text-[13.5px] text-[var(--talea-text-secondary)]">
              {rank.icon} {rank.name} · {v.solved} gelöst{next ? ` · noch ${next.min - v.solved} bis ${next.name}` : ""}
            </p>
            <p className="text-[12.5px] text-[var(--talea-text-secondary)]">🪶 Elster-Akte: {feathers} von {CASES.length} Federn</p>
          </div>
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-2 md:justify-end">
          {CASES.map((c) => {
            const n = v.loot[c.id] || 0;
            return (
              <span key={c.id} title={n ? c.title : "noch offen"} className={cn("relative h-12 w-12 overflow-hidden rounded-full", n ? "shadow-[0_0_0_3px_#e9a93c]" : "bg-[var(--talea-surface-inset)]")}>
                <img src={IMG.loot(c.id)} alt="" className={cn("h-full w-full object-cover", !n && "opacity-20 grayscale")} />
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
};

const Badge: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-[12.5px] font-bold text-white backdrop-blur-md">{children}</span>
);

/** Eine Partie überlebt Tab-Wechsel und das Verlassen der Seite (bis zum Neuladen). */
let sharedCtrl: AlibiController | null = null;

/** Startkarte des Spiels im Tab „Mitternachts-Alibi“. Öffnet die Vollbild-Bühne. */
export const AlibiLauncher: React.FC = () => {
  const { chars, error, retry } = useAlibiCharacters();
  if (chars && !sharedCtrl) sharedCtrl = new AlibiController(chars);
  const ctrl = sharedCtrl;
  const [open, setOpen] = useState<null | { tour: boolean }>(null);
  const faces = usePreviewFaces(chars, 24);
  const strip = useMemo(() => faces.concat(faces), [faces]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (new URLSearchParams(window.location.search).get("alibiFast")) director.fast = true;
  }, []);
  useEffect(() => () => sharedCtrl?.pauseTimer(), []);

  return (
    <div className="flex flex-col gap-6">
      <section className="relative isolate overflow-hidden rounded-[32px] bg-[#0b0d1c] text-white shadow-[0_30px_80px_-30px_rgba(11,13,28,0.85)]">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <img src={IMG.keyart} alt="" className="game-kenburns h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0d1c] via-[#0b0d1c]/55 to-[#0b0d1c]/10" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0b0d1c]/80 via-transparent to-transparent" />
        </div>
        <div className="flex min-h-[460px] flex-col justify-end gap-5 p-6 md:min-h-[520px] md:p-10">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 160, damping: 20 }} className="flex max-w-[620px] flex-col gap-3">
            <span className="w-fit rounded-full bg-[#f2b04a] px-3 py-1 text-[11.5px] font-extrabold uppercase tracking-[0.18em] text-[#2b1c07]">Neu · Krimi-Partyspiel</span>
            <h2 className="game-display text-[clamp(40px,8vw,72px)] font-black leading-[0.95] drop-shadow-[0_6px_30px_rgba(0,0,0,0.6)]">Mitternachts-Alibi</h2>
            <p className="max-w-[520px] text-[16px] leading-relaxed text-white/85">Einer von euch hat heute Nacht in Kicherwald etwas gestohlen. Alle sagen die Wahrheit, nur einer flunkert. Findet ihn, bevor er entkommt.</p>
            <div className="flex flex-wrap gap-2">
              <Badge>👥 4–8 Spieler</Badge>
              <Badge>🐣 ab 5 Jahren</Badge>
              <Badge>⏱️ 20–30 Minuten</Badge>
              <Badge>📱 ein Handy</Badge>
            </div>
          </motion.div>
          <div className="flex flex-wrap items-center gap-3">
            {error ? (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-rose-300/40 bg-rose-500/20 px-4 py-3 text-[14px]">
                {error}
                <button type="button" onClick={retry} className="rounded-full bg-white/15 px-3 py-1.5 font-bold hover:bg-white/25">
                  Nochmal versuchen
                </button>
              </div>
            ) : !ctrl ? (
              <div className="flex items-center gap-3 text-[14px] text-white/75">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#f2b04a] border-t-transparent" />
                Die Verdächtigen werden aus dem Charakter-Pool geholt …
              </div>
            ) : (
              <LauncherButtons ctrl={ctrl} onPlay={() => setOpen({ tour: false })} onTour={() => setOpen({ tour: true })} />
            )}
          </div>
        </div>
      </section>

      {strip.length ? (
        <section className="relative overflow-hidden rounded-[28px] border border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] py-5" aria-label="Verdächtige aus dem Charakter-Pool">
          <div className="mb-3 flex items-baseline justify-between px-5">
            <h3 className="text-[17px] font-bold text-[var(--talea-text-primary)]">Die Verdächtigen</h3>
            <span className="text-[13px] text-[var(--talea-text-secondary)]">{chars?.length} Figuren aus dem Talea-Pool</span>
          </div>
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[var(--talea-surface-primary)] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[var(--talea-surface-primary)] to-transparent" />
          <div className="game-marquee flex w-max gap-4 px-5">
            {strip.map((c, k) => (
              <div key={`${c.key}-${k}`} className="flex w-[92px] shrink-0 flex-col items-center gap-1.5">
                <img src={c.img} alt={c.n} loading="lazy" className="h-[84px] w-[84px] rounded-full object-cover shadow-md ring-4 ring-[var(--talea-surface-inset)]" />
                <span className="line-clamp-1 text-center text-[12px] font-semibold text-[var(--talea-text-secondary)]">{c.n}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <VaultTeaser key={open ? "offen" : "zu"} />

      <section className="grid gap-3 md:grid-cols-3">
        {FEATURES.map((f, k) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + k * 0.08, type: "spring", stiffness: 200, damping: 22 }}
            className="flex items-center gap-4 rounded-[24px] border border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] p-4"
          >
            <img src={f.img} alt="" className="h-20 w-20 shrink-0 rounded-[20px] bg-[#f6ead0] object-cover" />
            <div>
              <h4 className="text-[16px] font-bold text-[var(--talea-text-primary)]">{f.title}</h4>
              <p className="mt-1 text-[13.5px] leading-snug text-[var(--talea-text-secondary)]">{f.text}</p>
            </div>
          </motion.div>
        ))}
      </section>

      <section className="relative overflow-hidden rounded-[28px] border border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] p-5 md:p-7">
        <div className="flex flex-col gap-5 md:flex-row md:items-center">
          <img src={IMG.tavi("kommissar")} alt="Kommissar Tavi" className="mx-auto h-40 w-auto shrink-0 md:mx-0" />
          <div className="flex-1">
            <h3 className="text-[20px] font-bold text-[var(--talea-text-primary)]">So läuft ein Abend mit Kommissar Tavi</h3>
            <ol className="mt-4 grid gap-3 sm:grid-cols-2">
              {STEPS.map((st, k) => (
                <li key={st.title} className="flex items-center gap-3">
                  <span className="relative shrink-0">
                    <img src={st.img} alt="" className="h-14 w-14 rounded-2xl bg-[#f6ead0] object-cover" />
                    <span className="absolute -left-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary)] text-[12px] font-black text-[var(--primary-foreground)]">{k + 1}</span>
                  </span>
                  <span>
                    <span className="block text-[14.5px] font-bold text-[var(--talea-text-primary)]">{st.title}</span>
                    <span className="block text-[13px] leading-snug text-[var(--talea-text-secondary)]">{st.text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <AnimatePresence>{open && ctrl ? <AlibiStage key="stage" ctrl={ctrl} startWithTour={open.tour} onExit={() => setOpen(null)} /> : null}</AnimatePresence>
    </div>
  );
};

const LauncherButtons: React.FC<{ ctrl: AlibiController; onPlay: () => void; onTour: () => void }> = ({ ctrl, onPlay, onTour }) => {
  const s = useAlibiState(ctrl);
  const running = s.phase !== "setup" && s.phase !== "end";
  return (
    <>
      <motion.button
        type="button"
        data-a="launch"
        whileTap={{ scale: 0.96 }}
        onClick={() => {
          director.ctx();
          onPlay();
        }}
        className="alibi-gold inline-flex min-h-[58px] items-center gap-2.5 rounded-full px-8 text-[17px] font-extrabold"
      >
        <span className="text-[20px]">{running ? "▶️" : "🌙"}</span>
        {running ? "Partie fortsetzen" : "Jetzt spielen"}
      </motion.button>
      {running ? (
        <button
          type="button"
          onClick={() => {
            ctrl.quit();
            onPlay();
          }}
          className={cn("inline-flex min-h-[56px] items-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 text-[15px] font-bold text-white backdrop-blur-md hover:bg-white/20")}
        >
          🎲 Neu starten
        </button>
      ) : (
        <button type="button" onClick={onTour} className="inline-flex min-h-[56px] items-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 text-[15px] font-bold text-white backdrop-blur-md hover:bg-white/20">
          🎬 So geht’s
        </button>
      )}
    </>
  );
};
