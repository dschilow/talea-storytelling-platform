import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";

import { cn } from "@/lib/utils";
import { COLORS, IMG, SLOTS, cap } from "../content";
import { TC } from "../engine";
import { director } from "../audio";
import type { AlibiController } from "../controller";
import { useAlibiState } from "../hooks";
import { ACT_ICON, BigCount, Eyebrow, Face, GameIcon, GhostButton, GoldButton, PlaceCard, Screen, Title, ringColor, type GameIconName } from "./primitives";
import { SpurChips } from "./RoundScreens";
import { VillageMap } from "./VillageMap";
import { TaviSprite } from "../live/TaviSprite";
import { StandFigure } from "../live/StandFigure";
import { ElsterReveal, FeatherTrack, LootShowcase, WantedPoster, epilogText } from "./Vault";

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
          <GoldButton a="startCount" icon="point" onClick={() => void ctrl.startCount()}>
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
          <GoldButton a="accuse" icon="point" disabled={s.sel === null} onClick={() => ctrl.accuse()}>
            {s.sel === null ? "Figur antippen" : `Nummer ${s.sel + 1} anklagen`}
          </GoldButton>
          <GhostButton a="tie" icon="replay" onClick={() => ctrl.tie()}>
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
          <GoldButton a="flip" icon="card" onClick={() => void ctrl.flip()}>
            Kapuze runter!
          </GoldButton>
        ) : m === "shown" ? (
          <GoldButton a="afterReveal" icon={last ? "magnifier" : "replay"} onClick={() => ctrl.afterReveal()}>
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
      {/* Die angeklagte Figur tritt ins Licht, die Kapuze fällt */}
      <div className="relative mt-3 flex w-full max-w-[340px] justify-center" data-fx="reveal" style={{ height: 290 }}>
        <motion.span
          className="alibi-spotlight"
          animate={{ opacity: m === "shown" ? 1 : m === "drum" ? [0.65, 0.95, 0.7] : 0.75 }}
          transition={m === "drum" ? { duration: 0.42, repeat: Infinity } : { duration: 0.6 }}
          style={{ background: m === "shown" ? (kob ? "radial-gradient(50% 60% at 50% 0%, rgba(255,120,90,0.55), transparent 70%)" : "radial-gradient(50% 60% at 50% 0%, rgba(150,255,180,0.45), transparent 70%)") : undefined }}
        />
        <span className="alibi-spot-floor" />
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
          <StandFigure
            H={250}
            look={{ color: COLORS[p.ch.fam] || "#9aa1a8" }}
            pose={{ shiver: m === "drum" ? 1 : 0, cheer: m === "shown" && !kob ? 1 : 0, reach: m === "shown" && kob ? 0.35 : 0 }}
            head={
              <span className="block h-full w-full overflow-hidden rounded-full bg-[#2a2118]" style={{ boxShadow: `0 0 0 4px ${ringColor(p.ch)}, 0 0 0 7px rgba(255,255,255,0.85), 0 10px 22px rgba(0,0,0,0.55)` }}>
                <img src={p.ch.img} alt={p.ch.n} className="h-full w-full object-cover" />
              </span>
            }
            overHead={
              <motion.img
                src="/game/alibi/live/parts/hood.webp"
                alt=""
                className="absolute max-w-none drop-shadow-[0_10px_16px_rgba(0,0,0,0.55)]"
                style={{ width: "150%", left: "-25%", top: "-36%" }}
                initial={false}
                animate={m === "shown" ? { y: -300, x: 90, rotate: 38, opacity: 0 } : m === "drum" ? { y: [0, -3, 0], rotate: [0, -2, 2, 0], opacity: 1 } : { y: 0, x: 0, rotate: 0, opacity: 1 }}
                transition={m === "shown" ? { duration: 0.85, ease: [0.25, 0.1, 0.4, 1], opacity: { delay: 0.45, duration: 0.4 } } : m === "drum" ? { duration: 0.3, repeat: Infinity } : { duration: 0.3 }}
              />
            }
          />
        </div>
        {/* Beim Dieb fällt die Beute aus dem Mantel */}
        {m === "shown" && kob ? (
          <motion.img
            src={IMG.loot(s.caseDef!.id)}
            alt=""
            className="absolute left-1/2 h-16 w-16 rounded-full border-2 border-white bg-[#f6ead0] object-cover shadow-[0_0_30px_rgba(248,220,142,0.9)]"
            initial={{ x: "-50%", y: 170, scale: 0.3, opacity: 0 }}
            animate={{ x: ["-50%", "-10%", "40%"], y: [170, 150, 236], scale: 1, opacity: 1, rotate: [0, 120, 250] }}
            transition={{ delay: 0.9, duration: 0.9, ease: "easeOut" }}
          />
        ) : null}
        {m === "shown" ? (
          <motion.span
            initial={{ scale: 3, opacity: 0, rotate: -4 }}
            animate={{ scale: 1, opacity: 1, rotate: -9 }}
            transition={{ delay: 0.75, type: "spring", stiffness: 380, damping: 15 }}
            className={cn("alibi-stamp absolute left-1/2 top-[58%] z-10 -translate-x-1/2 bg-black/60 text-[28px]", kob ? "text-[#ff6e5a]" : "text-[#7be39b]")}
          >
            {kob ? "Überführt" : "Unschuldig"}
          </motion.span>
        ) : null}
      </div>
      {m === "drum" ? <p className="text-[15px] font-bold text-white/80">Trommelwirbel … wer steckt unter der Kapuze?</p> : null}
      {m === "ask" ? <p className="text-[14px] font-semibold text-white/70">Unter der Kapuze steht {p.ch.n}. War es wirklich der Dieb?</p> : null}
      {m === "shown" ? (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }} className="alibi-glass w-full rounded-[22px] px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#f8dc8e]/90">{p.ch.n}</p>
          <p className="game-display mt-1 text-[20px] font-semibold italic leading-snug text-white">„{kob ? p.ch.confess : p.ch.deny}“</p>
        </motion.div>
      ) : null}
    </Screen>
  );
};

/* ---------- Abschluss: Beute, Steckbrief, Epilog mit Cliffhanger ---------- */
export const EndScreen: React.FC<{ ctrl: AlibiController; onExit: () => void; onVault: () => void }> = ({ ctrl, onExit, onVault }) => {
  const s = useAlibiState(ctrl);
  const W = s.W!, won = !!s.finalCaught, cu = W.culprit, cd = s.caseDef!, r = s.reward!, thief = ctrl.P(cu).ch;
  const [mapT, setMapT] = useState(TC);
  const words = epilogText(cd.id).split(" ");
  return (
    <Screen
      dock={
        <>
          <GoldButton a="nextCase" icon="magnifier" onClick={() => ctrl.nextCase()}>
            Nächster Fall: {r.next.title}
          </GoldButton>
          <div className="grid grid-cols-2 gap-2.5">
            <GhostButton a="vault" icon="vault" onClick={onVault}>
              Sammlung
            </GhostButton>
            <GhostButton a="exit" icon="home" onClick={onExit}>
              Übersicht
            </GhostButton>
          </div>
        </>
      }
    >
      <div className="flex flex-col items-center gap-2 pt-2 text-center">
        <motion.div initial={{ y: 40, opacity: 0, scale: 0.8 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 14 }}>
          <TaviSprite pose={won ? "cheer" : "shrug"} className="h-36 drop-shadow-[0_14px_30px_rgba(0,0,0,0.6)]" />
        </motion.div>
        <Title size="xl" className={won ? "!text-[#9ff0b9]" : "!text-[#ff9d8c]"}>
          {won ? "Fall gelöst!" : "Der Dieb entkommt!"}
        </Title>
        <p className="max-w-[440px] text-[15px] leading-relaxed text-white/80">{won ? cd.solved : cd.escaped}</p>
      </div>

      {r.elsterNow ? <ElsterReveal /> : null}

      {won ? (
        <div className="flex w-full flex-col items-center gap-2">
          <div data-fx="loot">
            <LootShowcase caseId={cd.id} size={250} />
          </div>
          <motion.span
            initial={{ scale: 0, rotate: -8 }}
            animate={{ scale: 1, rotate: -3 }}
            transition={{ delay: 0.9, type: "spring", stiffness: 300, damping: 14 }}
            className="alibi-stamp bg-black/45 text-[15px] text-[#f8dc8e]"
          >
            {r.newLoot ? "Neu in der Sammlung!" : `Schon ${r.copies}× gesammelt`}
          </motion.span>
          <p className="game-display text-center text-[22px] font-black text-white">{cap(cd.loot)}</p>
          <div data-fx="feather" className="w-full">
            <FeatherTrack count={r.feathers} fresh={r.newFeather} />
          </div>
        </div>
      ) : (
        <div className="flex w-full flex-col items-center gap-3 pt-2">
          <div data-fx="poster">
            <WantedPoster ch={thief} reward={cap(cd.loot)} />
          </div>
          <p className="text-[13.5px] font-semibold text-white/75">{r.newWanted ? "Neuer Steckbrief an der Fahndungswand." : "Schon wieder entwischt! Der Steckbrief hängt noch."}</p>
        </div>
      )}

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }} className="flex items-center gap-2 rounded-full bg-white/[0.07] px-4 py-2 text-[13.5px] font-bold text-white/85">
        <GameIcon name={r.rank.icon as GameIconName} size={30} />
        {r.rankUp ? <span className="text-[#f8dc8e]">Neuer Rang: {r.rank.name}!</span> : <span>Rang: {r.rank.name}</span>}
      </motion.div>

      {/* Epilog mit Cliffhanger */}
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.6, type: "spring", stiffness: 140, damping: 18 }} className="alibi-night-card relative w-full overflow-hidden rounded-[26px] p-5">
        <motion.img src={IMG.icon("feather")} alt="" initial={{ y: -80, rotate: -70, opacity: 0 }} animate={{ y: 0, rotate: -25, opacity: 0.9 }} transition={{ delay: 2.2, duration: 2.4, ease: "easeOut" }} className="pointer-events-none absolute -right-2 top-2 h-24 w-24 object-contain" />
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#b9a6ff]">Epilog · später in der Nacht</p>
        <p className="game-display alibi-typewriter mt-2 pr-14 text-[17px] font-semibold italic leading-relaxed text-white/90">
          {words.map((w, k) => (
            <span key={k} style={{ animationDelay: `${2 + k * 0.11}s` }}>
              {w}{" "}
            </span>
          ))}
        </p>
        <div className="mt-4 flex items-center gap-3 rounded-[18px] bg-black/35 p-2.5">
          <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full ring-2 ring-[#f8dc8e]/50">
            <img src={IMG.loot(r.next.id)} alt="" className="h-full w-full object-cover brightness-[0.35] blur-[2px]" />
            <span className="absolute inset-0 flex items-center justify-center text-[24px] font-black text-[#f8dc8e]">?</span>
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#f8dc8e]/85">Nächster Fall</p>
            <p className="game-display truncate text-[19px] font-black text-white">{r.next.title}</p>
          </div>
        </div>
      </motion.div>

      <details className="group w-full rounded-[20px] bg-white/[0.05] p-2">
        <summary className="flex cursor-pointer list-none items-center justify-between px-2 py-1.5 text-[14px] font-bold text-white/90">
          <span className="inline-flex items-center gap-2"><GameIcon name="map" size={26} />Dorfkarte: was wirklich geschah</span>
          <span className="text-white/50 transition-transform group-open:rotate-180">⌄</span>
        </summary>
        <div className="flex flex-col gap-2 pt-2">
          <div className="flex justify-center gap-2">
            {Array.from({ length: W.T }, (_, t) => (
              <button key={t} type="button" onClick={() => setMapT(t)} className={cn("rounded-full px-3 py-1.5 text-[12.5px] font-bold", t === mapT ? "bg-[#f2b04a] text-[#2b1c07]" : "bg-white/10 text-white/80")}>
                <GameIcon name={ACT_ICON[t]} size={18} className="mr-1 inline-block align-[-4px]" />{SLOTS[t].name}
              </button>
            ))}
          </div>
          <VillageMap ctrl={ctrl} t={mapT} truth story={{ focus: cu }} />
        </div>
      </details>

      <div className="flex w-full flex-col gap-2">
        <Eyebrow className="text-center">Die Auszeichnungen</Eyebrow>
        {W.players.map((p, k) => {
          const a = s.awards?.[p.id];
          if (!a) return null;
          return (
            <motion.div key={p.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + k * 0.07 }} className="flex items-center gap-3 rounded-[20px] bg-white/[0.06] p-2.5">
              <Face p={p} size={52} />
              <div className="min-w-0">
                <p className="text-[15px] font-extrabold text-white">
                  <GameIcon name={a.icon as GameIconName} size={26} className="mr-1.5 inline-block align-[-6px]" />
                  {a.title}
                </p>
                <p className="text-[12.5px] text-white/65">{a.why}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </Screen>
  );
};
