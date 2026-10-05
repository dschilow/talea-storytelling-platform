import React, { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { IMG, PLACES, SIGHTS, SLOTS, cap } from "../content";
import { TC } from "../engine";
import type { AlibiController } from "../controller";
import { useAlibiState, useVoice } from "../hooks";
import { ACT_ICON, Eyebrow, Face, GameIcon, GhostButton, GoldButton, PlaceCard, Pips, Screen, Title } from "./primitives";
import { VillageMap } from "./VillageMap";

export const ActScreen: React.FC<{ ctrl: AlibiController }> = ({ ctrl }) => {
  const s = useAlibiState(ctrl);
  if (s.actSub === "intro") return <ActIntro ctrl={ctrl} />;
  if (s.actSub === "hand") return <Handoff ctrl={ctrl} />;
  if (s.actSub === "whisper") return ctrl.isLie() ? <LieScreen ctrl={ctrl} /> : <WhisperScreen ctrl={ctrl} />;
  if (s.actSub === "claim") return <ClaimScreen ctrl={ctrl} />;
  if (s.actSub === "announce") return <Announce ctrl={ctrl} />;
  return <ActDone ctrl={ctrl} />;
};

/* ---------- Akt-Beginn ---------- */
const ActIntro: React.FC<{ ctrl: AlibiController }> = ({ ctrl }) => {
  const s = useAlibiState(ctrl);
  const t = s.act, slot = SLOTS[t];
  return (
    <Screen
      dock={
        <GoldButton a="actGo" icon="phone2" onClick={() => ctrl.actGo()}>
          Das Geheimtelefon klingelt
        </GoldButton>
      }
    >
      <div className="flex flex-col items-center gap-3 pt-6 text-center">
        <Eyebrow>
          Akt {t + 1} von {s.W!.T}
        </Eyebrow>
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 180, damping: 14 }} className="text-[78px] leading-none drop-shadow-[0_0_30px_rgba(248,220,142,0.5)]">
          <GameIcon name={ACT_ICON[t]} size={110} className="drop-shadow-[0_0_30px_rgba(248,220,142,0.55)]" />
        </motion.div>
        <Title size="xl">{t === 0 ? "Der Abend" : slot.name}</Title>
        <p className="text-[15px] font-semibold text-white/70">{slot.time}</p>
      </div>
      {t === TC ? (
        <div className="mt-1 flex flex-col items-center gap-2" aria-live="polite">
          <div className="relative flex h-[150px] w-[150px] items-center justify-center">
            {s.bell > 0 ? <span key={`r${s.bell}`} className="alibi-ripple" /> : null}
            {s.bell > 0 ? <span key={`q${s.bell}`} className="alibi-ripple" style={{ animationDelay: "0.25s" }} /> : null}
            <motion.img
              key={`b${s.bell}`}
              src={IMG.icon("bell")}
              alt=""
              className="relative h-[150px] w-[150px] rounded-full object-cover shadow-[0_0_60px_rgba(248,220,142,0.35)]"
              style={{ transformOrigin: "50% 12%" }}
              animate={s.bell > 0 ? { rotate: [0, -14, 11, -6, 3, 0] } : { rotate: 0 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            />
          </div>
          <div className="flex h-[110px] items-center justify-center">
            {s.bell > 0 ? (
              <motion.span
                key={s.bell}
                initial={{ scale: 2, opacity: 0, filter: "blur(6px)" }}
                animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
                transition={{ type: "spring", stiffness: 300, damping: 16 }}
                className="game-display text-[100px] font-black leading-none text-[#fff3c4] drop-shadow-[0_0_30px_rgba(248,220,142,0.9)]"
              >
                {s.bell}
              </motion.span>
            ) : (
              <span className="text-[15px] font-semibold text-white/70">Zählt die Glockenschläge mit!</span>
            )}
          </div>
        </div>
      ) : (
        <p className="max-w-[380px] text-center text-[14.5px] leading-relaxed text-white/70">Gleich geht das Geheimtelefon reihum. Jeder erfährt, wo er war, wer bei ihm war und was er dort gesehen hat. Danach wählt und sagt jeder seine Aussage selbst.</p>
      )}
    </Screen>
  );
};

/* ---------- Handy weitergeben ---------- */
const Handoff: React.FC<{ ctrl: AlibiController }> = ({ ctrl }) => {
  const s = useAlibiState(ctrl);
  const i = ctrl.curP(), p = ctrl.P(i);
  return (
    <Screen
      dock={
        <GoldButton a="handAnswer" icon="phone2" onClick={() => ctrl.handAnswer()}>
          Ich bin’s
        </GoldButton>
      }
    >
      <div className="flex flex-col items-center gap-4 pt-4">
        <motion.img
          src={IMG.icon("phone")}
          alt=""
          className="h-24 w-24 rounded-[26px] bg-[#f6ead0] object-cover shadow-[0_0_40px_rgba(248,220,142,0.35)]"
          animate={{ rotate: [0, -12, 12, -9, 9, -4, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, repeatDelay: 0.8 }}
        />
        <motion.div key={i} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 220, damping: 16 }}>
          <Face p={p} size={168} />
        </motion.div>
        <Title>Nummer {i + 1}</Title>
        <p className="-mt-2 text-[15px] font-semibold text-white/75">
          {p.ch.n}
          {ctrl.typedName(i) ? ` · ${ctrl.typedName(i)}` : ""}
        </p>
        <div className="alibi-glass flex items-center gap-3 rounded-full px-4 py-2 text-[14px] text-white/85">
          <GameIcon name="ear" size={28} /> Handy ans Ohr! Alle anderen schauen weg.
        </div>
        <Pips total={s.actOrder.length} cur={s.actIdx} />
      </div>
    </Screen>
  );
};

/* ---------- Geheimtelefon (privat) ---------- */
const PrivateHeader: React.FC<{ culprit?: boolean }> = ({ culprit }) => {
  const { speaking } = useVoice();
  return (
    <div className="flex flex-col items-center gap-2 pt-1">
      <div className="relative flex h-20 w-20 items-center justify-center">
        {speaking
          ? [0, 1, 2].map((k) => (
              <motion.span
                key={k}
                className="absolute inset-0 rounded-full border-2 border-violet-300/60"
                initial={{ scale: 0.8, opacity: 0.8 }}
                animate={{ scale: 1.8, opacity: 0 }}
                transition={{ duration: 1.8, repeat: Infinity, delay: k * 0.6, ease: "easeOut" }}
              />
            ))
          : null}
        <img src={IMG.tavi("whisper")} alt="" className="relative h-20 w-20 rounded-full bg-[#f6ead0] object-cover object-top shadow-[0_0_30px_rgba(160,120,255,0.5)]" />
      </div>
      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-bold uppercase tracking-[0.2em]", culprit ? "bg-[#c0392b]/80 text-white" : "bg-violet-500/30 text-violet-100")}>
        <GameIcon name="secret" size={16} />
        {culprit ? "Streng geheim" : "Nur für dich"}
      </span>
    </div>
  );
};

const Cover: React.FC<{ ctrl: AlibiController }> = ({ ctrl }) => (
  <motion.button
    type="button"
    data-a="unhide"
    whileTap={{ scale: 0.98 }}
    onClick={() => ctrl.toggleHidden()}
    className="flex w-full flex-col items-center gap-2 rounded-[26px] border-2 border-dashed border-white/20 bg-white/[0.04] px-4 py-16 text-[17px] font-bold text-white/85"
  >
    <GameIcon name="hide" size={76} />
    Tippe zum Aufdecken
  </motion.button>
);

const WhisperScreen: React.FC<{ ctrl: AlibiController }> = ({ ctrl }) => {
  const s = useAlibiState(ctrl);
  const W = s.W!, i = ctrl.curP(), t = s.act, p = ctrl.P(i), pid = W.pos[i][t], comp = W.comp[i][t], sg = ctrl.sightAt(t, pid);
  const loner = t === TC && W.loners.indexOf(i) >= 0;
  return (
    <Screen
      dock={
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <GhostButton a="whisperAgain" icon="ear" onClick={() => ctrl.whisperSay()}>
              Nochmal
            </GhostButton>
            <GhostButton a={s.hidden ? "unhide" : "hide"} icon={s.hidden ? "eye" : "hide"} onClick={() => ctrl.toggleHidden()}>
              {s.hidden ? "Aufdecken" : "Verdecken"}
            </GhostButton>
          </div>
          <GoldButton a="toClaim" icon="quill" onClick={() => ctrl.toClaim()}>
            Jetzt meine Aussage
          </GoldButton>
        </>
      }
    >
      <PrivateHeader />
      {s.hidden ? (
        <Cover ctrl={ctrl} />
      ) : (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="alibi-paper flex w-full flex-col gap-4 rounded-[26px] p-4">
          <div className="flex items-center gap-3">
            <Face p={p} size={64} />
            <div>
              <p className="game-display text-[24px] font-black leading-none text-[#2c2117]">Nummer {i + 1}</p>
              <p className="mt-1 text-[13px] font-semibold text-[#6e5f48]">
                <GameIcon name={ACT_ICON[t]} size={20} className="mr-1 inline-block align-[-4px]" />{SLOTS[t].name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <PlaceCard id={pid} size="lg" />
            <div className="flex min-w-0 flex-col gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8a6a40]">{comp.length ? "Bei dir" : "Allein"}</span>
              <div className="flex flex-wrap gap-2">
                {comp.length ? comp.map((c) => <Face key={c} p={ctrl.P(c)} size={52} />) : <GameIcon name="pawn" size={48} title="allein" />}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-[20px] bg-black/[0.06] p-2.5">
            <motion.img
              src={IMG.sight(sg.id)}
              alt=""
              className="h-[92px] w-[92px] shrink-0 rounded-[16px] object-cover shadow-md"
              initial={{ rotate: -8, scale: 0.7 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 240, damping: 14, delay: 0.25 }}
            />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8a6a40]">Das hast du dort gesehen</p>
              <p className="game-display mt-0.5 text-[21px] font-black leading-tight text-[#2c2117]">{cap(sg.name)}</p>
              <p className="mt-1 text-[12px] text-[#6e5f48]">Merk es dir gut: Gleich tippst du es selbst an, und es wird versiegelt.</p>
            </div>
          </div>
          {loner ? (
            <div className="rounded-[16px] border border-[#e9a93c]/60 bg-[#f2b04a]/20 px-3 py-2 text-[13.5px] font-semibold text-[#5a3c0c]">
              <GameIcon name="ghost" size={22} className="mr-1 inline-block align-[-5px]" />Allein um Mitternacht, das sieht verdächtig aus. Aber du bist unschuldig!
            </div>
          ) : null}
        </motion.div>
      )}
    </Screen>
  );
};

/* ---------- Aussage auswählen (Ort + Begleiter), gemeinsam für Täter-Alibi und Unschuldige ---------- */
interface PickTheme {
  label: string;
  summary: string;
  placeOn: string;
  placeOff: string;
  check: string;
  compOn: string;
}
const THEME_LIE: PickTheme = {
  label: "text-[#a23a2c]",
  summary: "text-[#7a3a2c]",
  placeOn: "shadow-[0_0_0_4px_#c0392b]",
  placeOff: "shadow-[0_0_0_2px_rgba(0,0,0,0.12)]",
  check: "bg-[#c0392b]",
  compOn: "bg-[#c0392b]/25 shadow-[0_0_0_3px_#c0392b]",
};
const THEME_TRUTH: PickTheme = {
  label: "text-[#8a6a40]",
  summary: "text-[#6e5f48]",
  placeOn: "shadow-[0_0_0_4px_#7a5cc8]",
  placeOff: "shadow-[0_0_0_2px_rgba(0,0,0,0.12)]",
  check: "bg-[#7a5cc8]",
  compOn: "bg-[#7a5cc8]/20 shadow-[0_0_0_3px_#7a5cc8]",
};

const ClaimPicker: React.FC<{ ctrl: AlibiController; places: string[]; theme: PickTheme; placeLabel: string; compLabel: string; sightLabel: string; hint: string }> = ({ ctrl, places, theme, placeLabel, compLabel, sightLabel, hint }) => {
  const s = useAlibiState(ctrl);
  const W = s.W!, i = ctrl.curP(), t = s.act, d = s.draft;
  const sightRef = useRef<HTMLDivElement>(null);
  const hadPlace = useRef(!!d.place);
  useEffect(() => {
    // Nach dem ersten Ort sanft zu den Bildern rollen, damit niemand die Beobachtung übersieht
    if (d.place && !hadPlace.current) {
      hadPlace.current = true;
      window.setTimeout(() => sightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 250);
    }
  }, [d.place]);
  const claimed: Record<string, number> = {};
  s.claims.forEach((c) => {
    if (c[t]) claimed[c[t].place] = (claimed[c[t].place] || 0) + 1;
  });
  return (
    <>
      <div>
        <p className={cn("text-[11px] font-bold uppercase tracking-[0.16em]", theme.label)}>{placeLabel}</p>
        <div className={cn("mt-2 grid gap-2", places.length >= 4 ? "grid-cols-4" : "grid-cols-3")}>
          {places.map((x) => {
            const on = d.place === x;
            return (
              <motion.button
                key={x}
                type="button"
                data-a="draftPlace"
                data-v={x}
                whileTap={{ scale: 0.94 }}
                onClick={() => ctrl.draftPlace(x)}
                className={cn("relative overflow-hidden rounded-[16px] text-left transition-shadow", on ? theme.placeOn : theme.placeOff)}
              >
                <img src={IMG.place(x)} alt="" className="aspect-square w-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-1 pb-1 pt-4 text-center text-[10.5px] font-extrabold leading-tight text-white">{PLACES[x].short}</span>
                {claimed[x] ? <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-1.5 text-[10px] font-bold tracking-[1px] text-white">{"●".repeat(Math.min(4, claimed[x]))}</span> : null}
                {on ? <motion.span layoutId="alibi-claim-pick" className={cn("absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-[13px] text-white", theme.check)}>✓</motion.span> : null}
              </motion.button>
            );
          })}
        </div>
      </div>
      <div>
        <p className={cn("text-[11px] font-bold uppercase tracking-[0.16em]", theme.label)}>{compLabel}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {W.players
            .filter((p) => p.id !== i)
            .map((p) => {
              const on = d.comp.indexOf(p.id) >= 0;
              return (
                <motion.button
                  key={p.id}
                  type="button"
                  data-a="draftComp"
                  data-v={p.id}
                  aria-pressed={on}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => ctrl.draftComp(p.id)}
                  className={cn("rounded-full p-1 transition-shadow", on && theme.compOn)}
                >
                  <Face p={p} size={46} />
                </motion.button>
              );
            })}
        </div>
      </div>
      <div ref={sightRef}>
        <p className={cn("text-[11px] font-bold uppercase tracking-[0.16em]", theme.label)}>{sightLabel}</p>
        {d.place ? (
          <div className="mt-2 grid grid-cols-4 gap-2">
            {SIGHTS[d.place].map((sg, k) => {
              const on = d.sight === sg.id;
              return (
                <motion.button
                  key={sg.id}
                  type="button"
                  data-a="draftSight"
                  data-v={sg.id}
                  aria-pressed={on}
                  aria-label={cap(sg.name)}
                  initial={{ opacity: 0, y: 12, rotate: k % 2 ? 3 : -3 }}
                  animate={{ opacity: 1, y: 0, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 18, delay: k * 0.05 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => ctrl.draftSight(sg.id)}
                  className={cn("relative overflow-hidden rounded-[14px] bg-white/60 transition-shadow", on ? theme.placeOn : theme.placeOff)}
                >
                  <img src={IMG.sight(sg.id)} alt="" className="aspect-square w-full object-cover" />
                  {on ? <motion.span layoutId="alibi-sight-pick" className={cn("absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full text-[11px] text-white", theme.check)}>✓</motion.span> : null}
                </motion.button>
              );
            })}
          </div>
        ) : (
          <p className="mt-2 rounded-[14px] border border-dashed border-black/15 px-3 py-3 text-center text-[13px] font-semibold opacity-70">Erst den Ort antippen.</p>
        )}
      </div>
      <div className={cn("flex min-h-[48px] flex-wrap items-center gap-2 rounded-[16px] bg-black/[0.06] px-3 py-2 text-[13px] font-semibold", theme.summary)}>
        {d.place ? (
          <>
            <span>Du sagst:</span>
            <PlaceCard id={d.place} size="sm" />
            {d.comp.length ? d.comp.map((x) => <Face key={x} p={ctrl.P(x)} size={36} />) : <GameIcon name="pawn" size={30} title="allein" />}
            {d.sight ? (
              <span className="relative ml-auto h-[52px] w-[52px] overflow-hidden rounded-[12px] shadow-md ring-2 ring-white">
                <img src={IMG.sight(d.sight)} alt="" className="h-full w-full object-cover" />
                <img src={IMG.icon("seal")} alt="versiegelt" className="absolute -bottom-1 -right-1 h-6 w-6 drop-shadow" />
              </span>
            ) : null}
          </>
        ) : (
          <span>{hint}</span>
        )}
      </div>
    </>
  );
};

/* ---------- Das Alibi des Täters (privat) ---------- */
const LieScreen: React.FC<{ ctrl: AlibiController }> = ({ ctrl }) => {
  const s = useAlibiState(ctrl);
  const W = s.W!, i = ctrl.curP(), d = s.draft;
  return (
    <Screen
      dock={
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <GhostButton a="whisperAgain" icon="ear" onClick={() => ctrl.whisperSay()}>
              Nochmal
            </GhostButton>
            <GhostButton a={s.hidden ? "unhide" : "hide"} icon={s.hidden ? "eye" : "hide"} onClick={() => ctrl.toggleHidden()}>
              {s.hidden ? "Aufdecken" : "Verdecken"}
            </GhostButton>
          </div>
          <GoldButton a="toAnnounce" icon="check" disabled={!d.place || !d.sight} onClick={() => ctrl.toAnnounce()}>
            Aussage abgeben
          </GoldButton>
        </>
      }
    >
      <PrivateHeader culprit />
      {s.hidden ? (
        <Cover ctrl={ctrl} />
      ) : (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="alibi-paper red flex w-full flex-col gap-4 rounded-[26px] p-4">
          <div className="flex items-center gap-3">
            <Face p={ctrl.P(i)} size={64} />
            <div>
              <p className="game-display text-[24px] font-black leading-none text-[#5a1610]">Du warst es!</p>
              <p className="mt-1 text-[13px] font-semibold text-[#7a3a2c]">Um Mitternacht allein am Tatort.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <PlaceCard id={W.crimePlace} size="md" crime />
            <motion.img
              src={IMG.loot(s.caseDef!.id)}
              alt=""
              className="h-[88px] w-[88px] rounded-full border-4 border-white object-cover shadow-lg"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
          <ClaimPicker
            ctrl={ctrl}
            places={W.places.filter((x) => x !== W.crimePlace)}
            theme={THEME_LIE}
            placeLabel="Dein Alibi: Wo warst du angeblich?"
            compLabel="Wer war angeblich bei dir? (freiwillig)"
            sightLabel="Was willst du dort gesehen haben? Rate gut!"
            hint="Tippe auf einen Ort."
          />
        </motion.div>
      )}
    </Screen>
  );
};

/* ---------- Eigene Aussage der Unschuldigen (privat, danach öffentlich) ---------- */
const ClaimScreen: React.FC<{ ctrl: AlibiController }> = ({ ctrl }) => {
  const s = useAlibiState(ctrl);
  const W = s.W!, i = ctrl.curP(), t = s.act, d = s.draft;
  const places = W.places.filter((x) => t !== TC || x !== W.crimePlace);
  return (
    <Screen
      dock={
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <GhostButton a="claimPeek" icon="eye" onClick={() => ctrl.claimPeek()} className={s.claimTries > 0 ? "ring-2 ring-[#f8dc8e]" : undefined}>
              Karte ansehen
            </GhostButton>
            <GhostButton a={s.hidden ? "unhide" : "hide"} icon={s.hidden ? "eye" : "hide"} onClick={() => ctrl.toggleHidden()}>
              {s.hidden ? "Aufdecken" : "Verdecken"}
            </GhostButton>
          </div>
          <GoldButton a="claimSubmit" icon="check" disabled={!d.place || !d.sight} onClick={() => ctrl.claimSubmit()}>
            Aussage abgeben
          </GoldButton>
        </>
      }
    >
      <PrivateHeader />
      {s.hidden ? (
        <Cover ctrl={ctrl} />
      ) : (
        <motion.div
          key={s.claimFlash}
          initial={{ opacity: 0, y: 20 }}
          animate={s.claimFlash > 0 ? { opacity: 1, y: 0, x: [0, -12, 10, -7, 4, 0] } : { opacity: 1, y: 0 }}
          transition={{ duration: s.claimFlash > 0 ? 0.45 : 0.3 }}
          className="alibi-paper flex w-full flex-col gap-4 rounded-[26px] p-4"
        >
          <div className="flex items-center gap-3">
            <Face p={ctrl.P(i)} size={64} />
            <div>
              <p className="game-display text-[24px] font-black leading-none text-[#2c2117]">Deine Aussage</p>
              <p className="mt-1 text-[13px] font-semibold text-[#6e5f48]">
                <GameIcon name={ACT_ICON[t]} size={20} className="mr-1 inline-block align-[-4px]" />{SLOTS[t].name}: Wo, mit wem, und was hast du gesehen?
              </p>
            </div>
          </div>
          {s.claimTries > 0 ? (
            <div role="status" className="rounded-[16px] border border-[#e9a93c]/60 bg-[#f2b04a]/20 px-3 py-2 text-[13.5px] font-semibold text-[#5a3c0c]">
              <GameIcon name="eye" size={20} className="mr-1 inline-block align-[-4px]" />Das passt nicht zu deiner Karte. Tippe auf „Karte ansehen“ und versuche es noch mal.
            </div>
          ) : null}
          <ClaimPicker
            ctrl={ctrl}
            places={places}
            theme={THEME_TRUTH}
            placeLabel="Wo warst du?"
            compLabel="Wer war bei dir? (Niemand antippen, wenn du allein warst)"
            sightLabel="Was hast du dort gesehen?"
            hint="Tippe auf den Ort, an dem du warst."
          />
        </motion.div>
      )}
    </Screen>
  );
};

/* ---------- Aussage (öffentlich) ---------- */
const Announce: React.FC<{ ctrl: AlibiController }> = ({ ctrl }) => {
  const s = useAlibiState(ctrl);
  const W = s.W!, i = ctrl.curP(), t = s.act, c = s.claims[i][t], last = s.actIdx >= W.N - 1;
  return (
    <Screen
      dock={
        <>
          <GhostButton a="replayClaim" icon="speaker" onClick={() => ctrl.replayClaim(i, t)}>
            Tavi spricht für mich
          </GhostButton>
          <GoldButton a="annNext" icon="go" onClick={() => ctrl.annNext()}>
            {last ? "Weiter" : "Weitergeben"}
          </GoldButton>
        </>
      }
    >
      <div className="flex items-center gap-2 pt-1 text-[11.5px] font-bold uppercase tracking-[0.2em] text-[#f8dc8e]">
        <motion.span className="h-2.5 w-2.5 rounded-full bg-[#ff5a4a]" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
        Deine Aussage
      </div>
      <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 240, damping: 16 }} className="flex flex-col items-center gap-2">
        <Face p={ctrl.P(i)} size={124} />
        <Title size="md">Nummer {i + 1}</Title>
        <p className="-mt-1 text-[14px] font-semibold text-white/70">{ctrl.P(i).ch.n}</p>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="alibi-glass flex w-full items-center gap-4 rounded-[24px] p-3">
        <PlaceCard id={c.place} size="md" />
        <div className="flex min-w-0 flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#f8dc8e]/85">{c.comp.length ? "Dabei" : "Ganz allein"}</span>
          <div className="flex flex-wrap gap-2">{c.comp.length ? c.comp.map((x) => <Face key={x} p={ctrl.P(x)} size={46} />) : <GameIcon name="pawn" size={42} title="allein" />}</div>
        </div>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="flex w-full items-center gap-3 rounded-[20px] border border-[#f8dc8e]/25 bg-black/30 px-3 py-2.5">
        <motion.img src={IMG.icon("seal")} alt="" initial={{ scale: 2.2, rotate: -30, opacity: 0 }} animate={{ scale: 1, rotate: -8, opacity: 1 }} transition={{ delay: 0.7, type: "spring", stiffness: 300, damping: 14 }} className="h-12 w-12 shrink-0 drop-shadow-[0_6px_10px_rgba(0,0,0,0.5)]" />
        <div className="min-w-0 text-left">
          <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#f8dc8e]">Beobachtung versiegelt</p>
          <p className="text-[13px] leading-snug text-white/75">Was du gesehen hast, bleibt geheim, bis Tavi das Siegel bricht.</p>
        </div>
      </motion.div>
      {t === TC ? (
        <motion.div initial={{ opacity: 0, scale: 0.9, rotate: -2 }} animate={{ opacity: 1, scale: 1, rotate: -1 }} transition={{ delay: 0.9, type: "spring", stiffness: 220, damping: 16 }} className="alibi-paper w-full rounded-[20px] px-4 py-3 text-left">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#a2703a]"><GameIcon name="masks" size={18} className="mr-1 inline-block align-[-4px]" />Macken-Moment</p>
          <p className="game-display mt-1 text-[18px] font-bold leading-snug text-[#2c2117]">Sag es so, wie {ctrl.P(i).ch.n} es tun würde:</p>
          <p className="mt-1 text-[14px] text-[#5c4d38]">{cap(ctrl.P(i).ch.q)}.</p>
        </motion.div>
      ) : null}
      <p className="flex items-center gap-2 text-center text-[14px] font-semibold text-white/80">
        <GameIcon name="speech" size={28} /> Sag es der Runde mit deinen eigenen Worten.
      </p>
      <VillageMap ctrl={ctrl} t={t} isNew />
    </Screen>
  );
};

const ActDone: React.FC<{ ctrl: AlibiController }> = ({ ctrl }) => {
  const s = useAlibiState(ctrl);
  const W = s.W!, t = s.act, last = t >= W.T - 1;
  return (
    <Screen
      dock={
        <GoldButton a="actDoneNext" icon={last ? "magnifier" : ACT_ICON[t + 1]} onClick={() => ctrl.actDoneNext()}>
          {last ? "Zum Verhör" : t === 0 ? "Weiter zur Mitternacht" : "Weiter zum Morgengrauen"}
        </GoldButton>
      }
    >
      <div className="flex flex-col items-center gap-2 pt-2 text-center">
        <Eyebrow>Dorfkarte</Eyebrow>
        <Title size="md">
          <GameIcon name={ACT_ICON[t]} size={20} className="mr-1 inline-block align-[-4px]" />{t === 0 ? "Der Abend" : SLOTS[t].name} ist notiert
        </Title>
        <p className="text-[13.5px] text-white/65">Tippt auf eine Figur, dann wiederholt Tavi ihre Aussage.</p>
      </div>
      <VillageMap ctrl={ctrl} t={t} />
    </Screen>
  );
};
