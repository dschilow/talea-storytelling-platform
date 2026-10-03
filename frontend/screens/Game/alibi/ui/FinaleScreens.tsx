import React, { useEffect } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";

import { cn } from "@/lib/utils";
import { IMG, SLOTS } from "../content";
import { TC } from "../engine";
import { director } from "../audio";
import type { AlibiController } from "../controller";
import { useAlibiState } from "../hooks";
import { BigCount, Eyebrow, Face, GhostButton, GoldButton, PlaceCard, Screen, Title, ringColor } from "./primitives";
import { SpurChips } from "./RoundScreens";
import { VillageMap } from "./VillageMap";

/* ---------- Anklage ---------- */
export const VoteScreen: React.FC<{ ctrl: AlibiController }> = ({ ctrl }) => {
  const s = useAlibiState(ctrl);
  const W = s.W!;
  if (s.voteSub === "count")
    return (
      <Screen>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 pt-16">
          <Eyebrow>Finger bereit!</Eyebrow>
          <BigCount n={s.count} />
        </div>
      </Screen>
    );
  if (s.voteSub === "ready")
    return (
      <Screen
        dock={
          <GoldButton a="startCount" icon="👆" onClick={() => void ctrl.startCount()}>
            Los: drei, zwei, eins
          </GoldButton>
        }
      >
        <div className="flex flex-col items-center gap-3 pt-6 text-center">
          <Eyebrow>{s.attempt === 2 ? "Zweite und letzte Anklage" : "Die Anklage"}</Eyebrow>
          <motion.img src={IMG.icon("vote")} alt="" initial={{ scale: 0.5, rotate: -10, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 220, damping: 14 }} className="h-28 w-28 rounded-full object-cover shadow-[0_0_40px_rgba(248,220,142,0.35)]" />
          <Title size="xl">Wer war es?</Title>
          <p className="max-w-[380px] text-[15px] leading-relaxed text-white/75">Besprecht euch noch kurz. Dann zählt Tavi runter, und alle zeigen gleichzeitig auf den Dieb.</p>
        </div>
        <SpurChips ctrl={ctrl} />
      </Screen>
    );
  return (
    <Screen
      dock={
        <>
          <GoldButton a="accuse" icon="👆" disabled={s.sel === null} onClick={() => ctrl.accuse()}>
            {s.sel === null ? "Figur antippen" : `Nummer ${s.sel + 1} anklagen`}
          </GoldButton>
          <GhostButton a="tie" icon="🔁" onClick={() => ctrl.tie()}>
            Gleichstand: noch einmal zeigen
          </GhostButton>
        </>
      }
    >
      <motion.div initial={{ scale: 2.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 14 }} className="game-display pt-2 text-[60px] font-black leading-none text-[#f8dc8e] drop-shadow-[0_0_30px_rgba(248,220,142,0.6)]">
        ZEIGT!
      </motion.div>
      <p className="-mt-2 text-[15px] font-bold text-white/85">Auf wen zeigen die meisten?</p>
      <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
        {W.players.map((p, k) => {
          const cleared = s.cleared.indexOf(p.id) >= 0, sel = s.sel === p.id;
          return (
            <motion.button
              key={p.id}
              type="button"
              data-pid={p.id}
              disabled={cleared}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0, scale: sel ? 1.04 : 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: k * 0.04 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => ctrl.select(p.id)}
              className={cn(
                "alibi-paper relative flex flex-col items-center gap-1.5 rounded-[22px] p-2 pb-2.5 text-center transition-shadow",
                sel && "shadow-[0_0_0_4px_#f2b04a,0_0_36px_rgba(242,176,74,0.6)]",
                cleared && "opacity-40 grayscale"
              )}
            >
              <span className="relative w-full overflow-hidden rounded-[16px]" style={{ boxShadow: `0 0 0 4px ${ringColor(p.ch)}` }}>
                <img src={p.ch.img} alt="" className="aspect-square w-full object-cover" />
                <span className="absolute bottom-1.5 right-1.5 flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#2b1c07] text-[18px] font-black text-[#2b1c07]" style={{ background: "linear-gradient(180deg,#fbe39f,#e9a93c)" }}>
                  {p.id + 1}
                </span>
              </span>
              <span className="text-[13px] font-extrabold leading-tight text-[#2c2117]">{p.ch.n}</span>
              {cleared ? <span className="alibi-stamp absolute left-2 top-3 -rotate-12 bg-white/80 text-[11px] text-emerald-700">unschuldig</span> : null}
            </motion.button>
          );
        })}
      </div>
    </Screen>
  );
};

/* ---------- Enthüllung ---------- */
export const RevealScreen: React.FC<{ ctrl: AlibiController }> = ({ ctrl }) => {
  const s = useAlibiState(ctrl);
  const W = s.W!, i = s.accused!, p = ctrl.P(i), kob = i === W.culprit, m = s.revealSub;
  useEffect(() => {
    if (m === "shown" && kob && !director.fast) {
      const fire = (ratio: number, opts: confetti.Options) => void confetti({ origin: { y: 0.65 }, particleCount: Math.floor(220 * ratio), colors: ["#f8dc8e", "#e9a93c", "#ffffff", "#79c895", "#8d62c9"], zIndex: 2000, ...opts });
      fire(0.25, { spread: 26, startVelocity: 55 });
      fire(0.2, { spread: 60 });
      fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
      fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    }
  }, [m, kob]);
  const last = kob || s.attempt >= ctrl.L.tries;
  return (
    <Screen
      dock={
        m === "ask" ? (
          <GoldButton a="flip" icon="🃏" onClick={() => void ctrl.flip()}>
            Karte umdrehen
          </GoldButton>
        ) : m === "shown" ? (
          <GoldButton a="afterReveal" icon={last ? "🔎" : "🔁"} onClick={() => ctrl.afterReveal()}>
            {last ? "Auflösung" : "Zweite Anklage"}
          </GoldButton>
        ) : undefined
      }
    >
      <div className="flex flex-col items-center gap-1 pt-1 text-center">
        <Eyebrow>Die Enthüllung</Eyebrow>
        <Title size="md">
          Nummer {i + 1}, {p.ch.n}, tritt vor.
        </Title>
      </div>
      <div style={{ perspective: 1300 }} className="w-full max-w-[290px]">
        <motion.div
          className="relative aspect-[3/4] w-full"
          style={{ transformStyle: "preserve-3d" }}
          animate={m === "shown" ? { rotateY: 180 } : m === "drum" ? { rotateY: 0, x: [0, -4, 4, -3, 3, 0], rotate: [0, -1.5, 1.5, -1, 1, 0] } : { rotateY: 0 }}
          transition={m === "shown" ? { duration: 0.9, ease: [0.2, 0.7, 0.2, 1] } : m === "drum" ? { duration: 0.18, repeat: Infinity } : { duration: 0.3 }}
        >
          <div className="alibi-paper absolute inset-0 flex flex-col items-center gap-2 rounded-[24px] p-3" style={{ backfaceVisibility: "hidden" }}>
            <img src={p.ch.img} alt="" className="aspect-square w-full rounded-[16px] object-cover" style={{ boxShadow: `0 0 0 4px ${ringColor(p.ch)}` }} />
            <span className="game-display text-[24px] font-black text-[#2c2117]">{p.ch.n}</span>
            <span className="text-[13px] font-semibold text-[#6e5f48]">Nummer {i + 1}</span>
          </div>
          <div
            className="alibi-paper absolute inset-0 flex flex-col items-center gap-2 rounded-[24px] p-3"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", boxShadow: kob ? "0 0 60px rgba(255,90,70,0.6)" : "0 0 60px rgba(121,200,149,0.5)" }}
          >
            <img src={p.ch.img} alt="" className="aspect-square w-full rounded-[16px] object-cover" />
            <span className="game-display text-[24px] font-black text-[#2c2117]">{p.ch.n}</span>
            <span className="text-[13px] font-semibold text-[#6e5f48]">Nummer {i + 1}</span>
            {m === "shown" ? (
              <motion.span
                initial={{ scale: 3, opacity: 0, rotate: -4 }}
                animate={{ scale: 1, opacity: 1, rotate: -9 }}
                transition={{ delay: 0.75, type: "spring", stiffness: 380, damping: 15 }}
                className={cn("alibi-stamp absolute left-1/2 top-[44%] -translate-x-1/2 bg-black/55 text-[28px]", kob ? "text-[#ff6e5a]" : "text-[#7be39b]")}
              >
                {kob ? "Überführt" : "Unschuldig"}
              </motion.span>
            ) : null}
          </div>
        </motion.div>
      </div>
      {m === "drum" ? <p className="text-[15px] font-bold text-white/80">Trommelwirbel …</p> : null}
      {m === "shown" ? (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }} className="alibi-glass w-full rounded-[22px] px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#f8dc8e]/90">{p.ch.n}</p>
          <p className="game-display mt-1 text-[20px] font-semibold italic leading-snug text-white">„{kob ? p.ch.confess : p.ch.deny}“</p>
        </motion.div>
      ) : null}
    </Screen>
  );
};

/* ---------- Abspann ---------- */
export const EndScreen: React.FC<{ ctrl: AlibiController; onExit: () => void }> = ({ ctrl, onExit }) => {
  const s = useAlibiState(ctrl);
  const W = s.W!, won = !!s.finalCaught, cu = W.culprit, cd = s.caseDef!, cl = s.claims[cu][TC];
  return (
    <Screen
      dock={
        <>
          <GoldButton a="again" icon="🎲" onClick={() => ctrl.again()}>
            Neuer Fall, neue Besetzung
          </GoldButton>
          <GhostButton a="exit" icon="🏠" onClick={onExit}>
            Zurück zur Spiele-Übersicht
          </GhostButton>
        </>
      }
    >
      <div className="flex flex-col items-center gap-2 pt-2 text-center">
        <motion.img
          src={IMG.tavi(won ? "cheer" : "shrug")}
          alt=""
          initial={{ y: 40, opacity: 0, scale: 0.8 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 14 }}
          className="h-40 w-auto drop-shadow-[0_14px_30px_rgba(0,0,0,0.6)]"
        />
        <Title size="xl" className={won ? "!text-[#9ff0b9]" : "!text-[#ff9d8c]"}>
          {won ? "Fall gelöst!" : "Der Dieb entkommt!"}
        </Title>
        <p className="max-w-[440px] text-[15px] leading-relaxed text-white/80">{won ? cd.solved : cd.escaped}</p>
      </div>

      <div className="flex w-full items-center gap-4 rounded-[24px] bg-white/[0.06] p-3">
        <Face p={ctrl.P(cu)} size={88} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#f8dc8e]/90">Der Dieb war</p>
          <p className="game-display text-[24px] font-black leading-tight text-white">{ctrl.P(cu).ch.n}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-white/75">
            <span>behauptete:</span>
            <PlaceCard id={cl.place} size="sm" />
            {cl.comp.length ? cl.comp.map((x) => <Face key={x} p={ctrl.P(x)} size={32} />) : <span className="text-[22px]">🧍</span>}
          </div>
        </div>
        <img src={IMG.loot(cd.id)} alt="" className="h-16 w-16 rounded-full border-2 border-white object-cover" />
      </div>

      <div className="flex w-full flex-col gap-2">
        <Eyebrow className="text-center">Die Rekonstruktion: was wirklich geschah</Eyebrow>
        {Array.from({ length: W.T }, (_, t) => (
          <details key={t} open={t === TC} className="group rounded-[20px] bg-white/[0.05] p-2">
            <summary className="flex cursor-pointer list-none items-center justify-between px-2 py-1.5 text-[14px] font-bold text-white/90">
              <span>
                {SLOTS[t].icon} {SLOTS[t].name} · {SLOTS[t].time}
              </span>
              <span className="text-white/50 transition-transform group-open:rotate-180">⌄</span>
            </summary>
            <div className="pt-2">
              <VillageMap ctrl={ctrl} t={t} truth />
            </div>
          </details>
        ))}
      </div>

      <div className="flex w-full flex-col gap-2">
        <Eyebrow className="text-center">Die Auszeichnungen</Eyebrow>
        {W.players.map((p, k) => {
          const a = s.awards?.[p.id], tr = ctrl.traitFor(p.id);
          if (!a) return null;
          return (
            <motion.div key={p.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + k * 0.07 }} className="flex items-center gap-3 rounded-[20px] bg-white/[0.06] p-2.5">
              <Face p={p} size={52} />
              <div className="min-w-0">
                <p className="text-[15px] font-extrabold text-white">
                  <span className="mr-1.5">{a.icon}</span>
                  {a.title}
                </p>
                <p className="text-[12.5px] text-white/65">{a.why}</p>
                <p className="mt-0.5 text-[12px] font-semibold text-[#f8dc8e]/90">
                  {tr.icon} {tr.trait} +1 (Beispiel für den Avatar): {p.ch.n} {tr.why}.
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </Screen>
  );
};
