import React from "react";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { IMG, PLACES, SLOTS } from "../content";
import { TC } from "../engine";
import type { AlibiController } from "../controller";
import { useAlibiState } from "../hooks";
import { Face } from "./primitives";

/**
 * Dorfkarte: jeder Ort eine Karte, darin die Figuren, die behaupten, dort gewesen zu sein.
 * Kleine Gesichter daneben sind die genannten Begleiter. `truth` zeigt stattdessen, was wirklich war.
 */
export const VillageMap: React.FC<{ ctrl: AlibiController; t: number; truth?: boolean; tabs?: boolean; isNew?: boolean }> = ({ ctrl, t, truth, tabs, isNew }) => {
  const s = useAlibiState(ctrl);
  const W = s.W;
  if (!W) return null;
  const flags = !truth && s.flags && t === TC ? s.flags : null;
  const bad = new Set<number>(), alone = new Set<number>();
  flags?.conf.forEach((c) => {
    bad.add(c.a);
    bad.add(c.b);
  });
  flags?.alone.forEach((i) => alone.add(i));
  const byPlace: Record<string, { i: number; comp: number[] }[]> = {};
  W.places.forEach((p) => (byPlace[p] = []));
  W.players.forEach((p) => {
    const c = truth ? { place: W.pos[p.id][t], comp: W.comp[p.id][t] } : s.claims[p.id]?.[t];
    if (c) byPlace[c.place].push({ i: p.id, comp: c.comp });
  });

  return (
    <div className="flex w-full flex-col gap-3">
      {tabs ? (
        <div className="flex justify-center gap-2" role="tablist" aria-label="Akte">
          {Array.from({ length: W.T }, (_, k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={k === t}
              data-a="tab"
              data-v={k}
              onClick={() => ctrl.setTab(k)}
              className={cn(
                "relative flex min-w-[96px] flex-col items-center overflow-hidden rounded-2xl px-3 py-1.5 text-[11.5px] font-bold transition-colors",
                k === t ? "text-[#2b1c07]" : "alibi-glass text-white/80 hover:bg-white/[0.12]"
              )}
            >
              {k === t ? <motion.span layoutId="alibi-tab" className="absolute inset-0 rounded-2xl" style={{ background: "linear-gradient(180deg,#fbe39f,#e9a93c)" }} transition={{ type: "spring", stiffness: 420, damping: 34 }} /> : null}
              <span className="relative text-[20px] leading-tight">{SLOTS[k].icon}</span>
              <span className="relative">{SLOTS[k].name}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {W.places.map((pid) => {
          const pl = PLACES[pid], crime = pid === W.crimePlace && t === TC;
          const sg = truth ? ctrl.sightAt(t, pid) : null;
          return (
            <div
              key={pid}
              className={cn("min-w-0 overflow-hidden rounded-[18px] border bg-[rgba(16,18,36,0.72)] backdrop-blur-md", crime ? "border-[#ff6e5a]/80 shadow-[0_0_24px_rgba(255,110,90,0.28)]" : "border-white/10")}
            >
              <div className="relative h-[54px] overflow-hidden">
                <img src={IMG.place(pid)} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/35 to-transparent" />
                <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: pl.color }} />
                <span className="absolute bottom-1.5 left-3 text-[13px] font-extrabold text-white drop-shadow">{pl.short}</span>
                {crime && s.caseDef ? <img src={IMG.loot(s.caseDef.id)} alt="Tatort" title="Tatort" className="absolute right-1.5 top-1.5 h-8 w-8 rounded-full bg-[#f6ead0] object-contain p-0.5 shadow" /> : null}
                {sg ? <img src={IMG.sight(sg.id)} alt={sg.name} title={sg.name} className="absolute right-1.5 top-1.5 h-9 w-9 rounded-full bg-[#f6ead0] object-cover shadow ring-2 ring-white" /> : null}
              </div>
              <div className="flex min-h-[58px] flex-col gap-1.5 p-1.5">
                <AnimatePresence initial={false}>
                  {byPlace[pid].map((r) => {
                    const dim = !truth && !ctrl.matchesSpuren(r.i);
                    const cleared = s.cleared.indexOf(r.i) >= 0;
                    const fresh = isNew && s.newRes === r.i;
                    const Body = (
                      <>
                        <Face p={ctrl.P(r.i)} size={38} dim={dim} />
                        {!truth ? (
                          <span className="flex min-w-0 flex-wrap items-center gap-[3px]">
                            {r.comp.length ? r.comp.map((x) => <Face key={x} p={ctrl.P(x)} size={20} noNumber />) : <span className="text-[15px] opacity-70" title="allein">🧍</span>}
                          </span>
                        ) : null}
                        {bad.has(r.i) ? <i className="absolute -right-1 -top-2 text-[17px] not-italic" title="Einspruch">⚡</i> : alone.has(r.i) ? <i className="absolute -right-1 -top-2 text-[17px] not-italic" title="Keiner hat sie gesehen">👻</i> : null}
                      </>
                    );
                    const cls = cn(
                      "relative flex min-h-[46px] items-center gap-2 rounded-[12px] bg-white/[0.06] px-1.5 py-1 text-left",
                      bad.has(r.i) && "bg-[rgba(232,130,108,0.22)] ring-2 ring-[#e8826c]",
                      !bad.has(r.i) && alone.has(r.i) && "outline-dashed outline-2 outline-[#f2b04a]",
                      (dim || cleared) && "opacity-45"
                    );
                    return (
                      <motion.div
                        key={r.i}
                        layout
                        initial={fresh ? { opacity: 0, y: -60, scale: 0.4, rotate: -12 } : { opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ type: "spring", stiffness: 320, damping: 22 }}
                      >
                        {truth ? (
                          <div className={cls}>{Body}</div>
                        ) : (
                          <button type="button" data-res={r.i} data-t={t} onClick={() => ctrl.replayClaim(r.i, t)} className={cn(cls, "w-full transition-colors hover:bg-white/[0.12]")} aria-label={`Aussage von Nummer ${r.i + 1} anhören`}>
                            {Body}
                          </button>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                {!byPlace[pid].length ? <span className="py-3 text-center text-[18px] text-white/20">·</span> : null}
              </div>
            </div>
          );
        })}
      </div>
      {flags && (flags.conf.length || flags.alone.length) ? (
        <div className="flex justify-center gap-4 text-[12.5px] text-white/70">
          {flags.conf.length ? <span>⚡ Einspruch</span> : null}
          {flags.alone.length ? <span>👻 keiner hat sie gesehen</span> : null}
        </div>
      ) : null}
    </div>
  );
};
