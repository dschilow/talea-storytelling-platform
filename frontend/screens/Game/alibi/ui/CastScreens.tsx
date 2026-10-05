import React from "react";
import { motion } from "framer-motion";

import { IMG, KOM, PLACES, SLOTS, cap } from "../content";
import { TC } from "../engine";
import type { AlibiController } from "../controller";
import { useAlibiState } from "../hooks";
import { ACT_ICON, Eyebrow, Face, GameIcon, GoldButton, Pips, Screen, Title, TraitRow, ringColor } from "./primitives";

/* ---------- Besetzung: Karte ziehen ---------- */
export const CastScreen: React.FC<{ ctrl: AlibiController }> = ({ ctrl }) => {
  const s = useAlibiState(ctrl);
  const W = s.W!;
  if (s.castIdx >= W.N) return <CastWall ctrl={ctrl} />;
  const i = s.castIdx, p = ctrl.P(i), ch = p.ch, gender = ctrl.L.keys.indexOf("gdr") >= 0;

  if (s.castSub === "draw")
    return (
      <Screen
        dock={
          <GoldButton a="castShow" icon="card" onClick={() => ctrl.castShow()}>
            Karte ziehen
          </GoldButton>
        }
      >
        <div className="flex flex-col items-center gap-2 pt-2">
          <Eyebrow>Die Besetzung</Eyebrow>
          <Title>Nummer {i + 1}</Title>
          <p className="text-center text-[14.5px] text-white/70">Wer das Handy hat, zieht die Karte. Alle schauen zu.</p>
        </div>
        <div className="relative mt-4 h-[300px] w-[210px]" aria-hidden="true">
          {[2, 1, 0].map((k) => (
            <motion.div
              key={k}
              initial={{ y: 30, opacity: 0, rotate: 0 }}
              animate={{ y: k * -6, opacity: 1, rotate: (k - 1) * 5 }}
              transition={{ type: "spring", stiffness: 200, damping: 20, delay: (2 - k) * 0.08 }}
              className="absolute inset-0 overflow-hidden rounded-[26px] border-[3px] border-[#f2b04a]/70 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.85)]"
              style={{ background: "radial-gradient(circle at 50% 35%, #2c3570, #121535 70%)" }}
            >
              <div className="absolute inset-3 rounded-[18px] border border-[#f8dc8e]/35" />
              <motion.div
                className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                animate={k === 0 ? { y: [0, -6, 0] } : undefined}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
              >
                <GameIcon name="midnight" size={84} className="drop-shadow-[0_0_24px_rgba(248,220,142,0.6)]" />
                <span className="game-display text-[22px] font-black text-[#f8dc8e]">Kicherwald</span>
                <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/50">Verdächtigenkarte</span>
              </motion.div>
            </motion.div>
          ))}
        </div>
        <Pips total={W.N} cur={i} />
      </Screen>
    );

  return (
    <Screen
      dock={
        <GoldButton a="castNext" icon="go" onClick={() => ctrl.castNext()}>
          {i < W.N - 1 ? "Weitergeben" : "Alle ansehen"}
        </GoldButton>
      }
    >
      <div className="flex flex-col items-center gap-1 pt-1">
        <Eyebrow>Nummer {i + 1}</Eyebrow>
      </div>
      <div style={{ perspective: 1200 }} className="w-full max-w-[320px]">
        <motion.div
          initial={{ rotateY: -100, opacity: 0, scale: 0.9 }}
          animate={{ rotateY: 0, opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 140, damping: 16 }}
          className="alibi-paper flex flex-col items-center gap-3 rounded-[28px] p-4 pb-5"
        >
          <div className="relative w-full overflow-hidden rounded-[20px]" style={{ boxShadow: `0 0 0 5px ${ringColor(ch)}, 0 0 0 8px rgba(255,255,255,0.9)` }}>
            <img src={ch.img} alt={ch.n} className="aspect-square w-full object-cover" />
            <span
              className="game-display absolute bottom-2 right-2 flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-[#2b1c07] text-[30px] font-black text-[#2b1c07] shadow-xl"
              style={{ background: "linear-gradient(180deg,#fbe39f,#e9a93c)" }}
            >
              {i + 1}
            </span>
          </div>
          <h3 className="game-display text-center text-[28px] font-black leading-none text-[#2c2117]">{ch.n}</h3>
          <TraitRow ch={ch} gender={gender} light />
          {ctrl.typedName(i) ? <span className="text-[12.5px] font-semibold text-[#6e5f48]">gespielt von {ctrl.typedName(i)}</span> : null}
          <p className="text-left text-[13.5px] leading-relaxed text-[#5c4d38]">{ch.story}</p>
        </motion.div>
      </div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="alibi-glass w-full rounded-[20px] px-4 py-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#f8dc8e]/90">{ch.n} sagt</p>
        <p className="game-display mt-1 text-[19px] font-semibold italic leading-snug text-white">„{ch.intro}“</p>
        <p className="mt-2 text-[13px] text-white/65">
          <b className="text-white/85">Typische Macke:</b> {cap(ch.q)}.
        </p>
      </motion.div>
    </Screen>
  );
};

const CastWall: React.FC<{ ctrl: AlibiController }> = ({ ctrl }) => {
  const s = useAlibiState(ctrl);
  const W = s.W!, gender = ctrl.L.keys.indexOf("gdr") >= 0;
  return (
    <Screen
      dock={
        <GoldButton a="toCase" icon="magnifier" onClick={() => ctrl.toCase()}>
          Zum Fall
        </GoldButton>
      }
    >
      <div className="flex flex-col items-center gap-2 pt-2 text-center">
        <Eyebrow>Die Besetzung steht</Eyebrow>
        <Title>Eure Verdächtigen</Title>
        <p className="text-[14px] text-white/70">Merkt euch Nummer, Gesicht und den farbigen Rand.</p>
      </div>
      <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
        {W.players.map((p, k) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 22, delay: k * 0.06 }}
            className="alibi-glass flex flex-col items-center gap-2 rounded-[22px] px-2 py-3 text-center"
          >
            <Face p={p} size={74} />
            <span className="text-[13.5px] font-bold leading-tight text-white">{p.ch.n}</span>
            {ctrl.typedName(p.id) ? <span className="text-[11.5px] text-white/55">{ctrl.typedName(p.id)}</span> : null}
            <TraitRow ch={p.ch} gender={gender} />
          </motion.div>
        ))}
      </div>
    </Screen>
  );
};

/* ---------- Der Fall ---------- */
export const CaseScreen: React.FC<{ ctrl: AlibiController }> = ({ ctrl }) => {
  const s = useAlibiState(ctrl);
  const W = s.W!, cd = s.caseDef!;
  return (
    <Screen
      dock={
        <GoldButton a="toAct" icon="evening" onClick={() => ctrl.toAct()}>
          Der Abend beginnt
        </GoldButton>
      }
    >
      <motion.div
        initial={{ opacity: 0, y: 40, rotate: -3 }}
        animate={{ opacity: 1, y: 0, rotate: -0.6 }}
        transition={{ type: "spring", stiffness: 160, damping: 18 }}
        className="alibi-paper relative mt-6 flex w-full flex-col items-center gap-3 rounded-[16px] px-5 pb-6 pt-14"
      >
        <div className="absolute -top-3 left-1/2 h-7 w-28 -translate-x-1/2 rotate-2 bg-[#e9a93c]/70 shadow" />
        <motion.span
          initial={{ scale: 2.4, opacity: 0, rotate: -18 }}
          animate={{ scale: 1, opacity: 1, rotate: -6 }}
          transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.35 }}
          className="alibi-stamp absolute left-5 top-4 text-[14px] text-[#b3332a]"
        >
          Fall
        </motion.span>
        <div className="relative flex items-center gap-4">
          <div className="relative h-[132px] w-[132px]">
            <motion.div
              className="absolute inset-[-18px] rounded-full"
              style={{ background: "conic-gradient(from 0deg, rgba(242,176,74,0), rgba(242,176,74,0.45), rgba(242,176,74,0) 30%, rgba(242,176,74,0.4) 60%, rgba(242,176,74,0))" }}
              animate={{ rotate: 360 }}
              transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
            />
            <img src={IMG.loot(cd.id)} alt={cd.loot} className="relative h-full w-full rounded-full border-4 border-white object-cover shadow-xl" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8a6a40]">Tatort</span>
            <div className="relative h-[100px] w-[100px] overflow-hidden rounded-[18px] shadow-[0_0_0_3px_#c0392b]">
              <img src={IMG.place(W.crimePlace)} alt="" className="h-full w-full object-cover" />
            </div>
            <span className="text-[13px] font-extrabold text-[#2c2117]">{PLACES[W.crimePlace].short}</span>
          </div>
        </div>
        <h3 className="game-display text-center text-[30px] font-black leading-tight text-[#2c2117]">{cd.title}</h3>
        <p className="text-[14px] text-[#5c4d38]">
          Gestohlen: <b>{cd.loot}</b>
        </p>
        <p className="text-center text-[14px] leading-relaxed text-[#4a3b28]">{cd.intro}</p>
        <div className="flex flex-wrap justify-center gap-2 pt-1">
          {Array.from({ length: W.T }, (_, t) => (
            <span key={t} className={`rounded-full px-3 py-1 text-[12.5px] font-bold ${t === TC ? "bg-[#c0392b] text-white" : "bg-black/[0.07] text-[#4a3b28]"}`}>
              <GameIcon name={ACT_ICON[t]} size={18} className="mr-1 inline-block align-[-4px]" />{SLOTS[t].name}
              {t === TC ? " · Tatzeit" : ""}
            </span>
          ))}
        </div>
      </motion.div>
      {KOM[`kom.gag.${cd.id}`] ? (
        <motion.div
          initial={{ opacity: 0, y: 30, rotate: 3 }}
          animate={{ opacity: 1, y: 0, rotate: 1 }}
          transition={{ delay: 1.6, type: "spring", stiffness: 160, damping: 16 }}
          className="relative w-full overflow-hidden rounded-[22px] border-2 border-dashed border-[#f8dc8e]/60 bg-[#f2b04a]/15 px-4 py-3"
        >
          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#f8dc8e]"><GameIcon name="party" size={18} className="mr-1 inline-block align-[-4px]" />Alle zusammen</p>
          <p className="mt-1 text-[15px] font-semibold leading-snug text-white/90">{KOM[`kom.gag.${cd.id}`].replace(/^Bevor wir anfangen: /, "")}</p>
        </motion.div>
      ) : null}
    </Screen>
  );
};
