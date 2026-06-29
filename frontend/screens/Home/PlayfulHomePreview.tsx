import React, { useEffect, useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import Lenis from "lenis";
import { ArrowRight, ArrowUpRight, Clock, Feather, Plus, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { EdCover, EdAvatar } from "@/components/talea/EdCover";
import { EdProgress, EdRing, EdTag, EdSpark, EdRuleLabel } from "@/components/talea/EdBits";
import {
  Reveal,
  RevealItem,
  Counter,
  TiltCard,
  Shimmer,
  UnderlineLink,
} from "@/components/talea/EdMotion";

/**
 * TALEA EDITORIAL — warm illustrated-magazine home, refined & animated.
 * Framer Motion staggered reveals, Lenis smooth-scroll, tilt cards,
 * animated counters/rings, shimmering accents. Auth-free at /playful-preview.
 */

const CONTINUE = [
  { id: "lumi-mondzucker", title: "Lumi und der Mondzucker", genre: "Gute-Nacht", chapter: "Kapitel 4 von 6", time: 6, progress: 64, ago: "vor 2 Tagen" },
  { id: "roby-regenbogen", title: "Robys Reise zum Regenbogen", genre: "Abenteuer", chapter: "Kapitel 2 von 5", time: 7, progress: 38, ago: "vor 4 Tagen" },
];

const LIBRARY = [
  { id: "marienkaefer", title: "Der mutige Marienkäfer", genre: "Mut", time: 9, isNew: true },
  { id: "sterne-sammlerin", title: "Die Sterne-Sammlerin", genre: "Fantasie", time: 5, isNew: false },
  { id: "wal-der-singt", title: "Der Wal, der singen lernte", genre: "Freundschaft", time: 8, isNew: false },
  { id: "drache-tee", title: "Ein Drache trinkt Tee", genre: "Humor", time: 6, isNew: true },
];

const FORYOU = [
  { id: "wolken-werkstatt", title: "Die Wolken-Werkstatt", reason: "Weil du Lumi magst", time: 7 },
  { id: "leuchtturm", title: "Das Licht im Leuchtturm", reason: "Beliebt diese Woche", time: 9 },
  { id: "garten-nacht", title: "Was nachts im Garten geschieht", reason: "Neu im Atelier", time: 5 },
  { id: "berg-fluestern", title: "Wenn die Berge flüstern", reason: "Passt zu Yuki", time: 8 },
];

const AVATARS = [
  { id: "mia", name: "Mia", role: "Heldin", trait: "Mut", level: 4 },
  { id: "ben", name: "Ben", role: "Entdecker", trait: "Neugier", level: 3 },
  { id: "yuki", name: "Yuki", role: "Träumerin", trait: "Fantasie", level: 5 },
  { id: "leo", name: "Leo", role: "Beschützer", trait: "Empathie", level: 2 },
  { id: "robo", name: "Robo", role: "Erfinder", trait: "Logik", level: 4 },
];

const DOKUS = [
  { id: "himmel-blau", n: "01", title: "Warum ist der Himmel blau?", topic: "Natur", time: 4, isNew: true },
  { id: "delfine-schlaf", n: "02", title: "Wie schlafen Delfine?", topic: "Meer", time: 5, isNew: false },
  { id: "sternschnuppen", n: "03", title: "Was sind Sternschnuppen?", topic: "Weltall", time: 3, isNew: false },
];

const PlayfulHomePreview: React.FC = () => {
  const reduce = useReducedMotion();
  const heroRef = useRef<HTMLDivElement>(null);

  // Lenis smooth scroll
  useEffect(() => {
    if (reduce) return;
    const lenis = new Lenis({ duration: 1.1, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
    let raf = 0;
    const loop = (time: number) => { lenis.raf(time); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); lenis.destroy(); };
  }, [reduce]);

  // hero cover parallax on page scroll
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const coverY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -60]);
  const coverScale = useTransform(scrollYProgress, [0, 1], [1, reduce ? 1 : 1.04]);

  return (
    <div className="ed-page ed-grain ed-sans relative min-h-screen">
      {/* ambient accent glows */}
      {!reduce && (
        <>
          <div className="pointer-events-none fixed left-[-8%] top-[-6%] -z-10 h-80 w-80 rounded-full opacity-[0.12] blur-3xl" style={{ background: "var(--ed-accent)" }} aria-hidden />
          <div className="pointer-events-none fixed bottom-[-10%] right-[-6%] -z-10 h-96 w-96 rounded-full opacity-[0.1] blur-3xl" style={{ background: "var(--ed-plum)" }} aria-hidden />
        </>
      )}

      {/* ---- masthead ---- */}
      <motion.header
        initial={reduce ? undefined : { y: -20, opacity: 0 }}
        animate={reduce ? undefined : { y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="sticky top-0 z-30 border-b border-[var(--ed-line)] bg-[var(--ed-paper)]/80 backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-[1080px] items-center justify-between px-6 py-4 sm:px-8">
          <div className="flex items-baseline gap-3">
            <span className="ed-serif text-2xl font-semibold tracking-tight text-[var(--ed-ink)]">Talea</span>
            <span className="ed-eyebrow hidden sm:inline">Ausgabe № 128 · Dienstag, 23. Juni</span>
          </div>
          <nav className="flex items-center gap-1">
            {["Geschichten", "Helden", "Wissen"].map((n) => (
              <UnderlineLink key={n} className="ed-sans px-3 py-1.5 text-sm text-[var(--ed-ink-2)] transition-colors hover:text-[var(--ed-ink)]">
                {n}
              </UnderlineLink>
            ))}
            <span className="mx-2 hidden h-5 w-px bg-[var(--ed-line-2)] sm:block" />
            <motion.span whileHover={reduce ? undefined : { scale: 1.06 }} className="ml-1 flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-[var(--ed-line-2)]">
              <EdAvatar seed="mia-profile" className="h-full w-full" />
            </motion.span>
          </nav>
        </div>
      </motion.header>

      <main className="mx-auto max-w-[1080px] px-6 sm:px-8">
        {/* ---- HERO ---- */}
        <section ref={heroRef} className="grid gap-10 border-b border-[var(--ed-line)] py-12 sm:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
          <Reveal className="flex flex-col justify-center" amount={0.3}>
            <RevealItem className="flex items-center gap-2.5">
              <motion.span
                className="text-[var(--ed-accent)]"
                animate={reduce ? undefined : { rotate: [0, 90, 0], scale: [1, 1.15, 1] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              >
                <EdSpark className="h-3.5 w-3.5" />
              </motion.span>
              <p className="ed-eyebrow">Guten Morgen, Mia</p>
            </RevealItem>
            <RevealItem as="div">
              <h1 className="ed-serif mt-4 text-[2.9rem] font-semibold leading-[1.04] tracking-tight text-[var(--ed-ink)] sm:text-[3.6rem]">
                Heute warten drei neue Geschichten auf dich.
              </h1>
            </RevealItem>
            <RevealItem>
              <p className="ed-sans mt-5 max-w-md text-[1.05rem] leading-relaxed text-[var(--ed-ink-2)]">
                Lies dort weiter, wo du aufgehört hast — oder lass Talea ein neues Abenteuer mit deinen Helden schreiben.
              </p>
            </RevealItem>
            <RevealItem className="mt-8 flex flex-wrap items-center gap-3">
              <motion.button
                whileHover={reduce ? undefined : { y: -2, scale: 1.02 }}
                whileTap={reduce ? undefined : { scale: 0.97 }}
                className="ed-btn-accent ed-sans inline-flex items-center gap-2 rounded-[var(--ed-r)] px-5 py-3 text-sm font-bold text-[var(--ed-paper)]"
              >
                <Feather className="h-4 w-4" /> Neue Geschichte schreiben
                <Shimmer />
              </motion.button>
              <motion.button
                whileHover={reduce ? undefined : { y: -2 }}
                whileTap={reduce ? undefined : { scale: 0.97 }}
                className="ed-sans inline-flex items-center gap-2 rounded-[var(--ed-r)] border border-[var(--ed-line-2)] px-5 py-3 text-sm font-bold text-[var(--ed-ink)] transition-colors hover:bg-[var(--ed-card-2)]"
              >
                Weiterlesen <ArrowRight className="h-4 w-4" />
              </motion.button>
            </RevealItem>

            <RevealItem as="div" className="mt-10">
              <dl className="flex divide-x divide-[var(--ed-line)] border-t border-[var(--ed-line)] pt-6">
                {[
                  { to: 12, l: "Geschichten" },
                  { to: 5, l: "Helden" },
                  { to: 31, l: "Min. heute gelesen" },
                ].map((s) => (
                  <div key={s.l} className="px-6 first:pl-0">
                    <dt className="ed-serif ed-nums text-2xl font-semibold text-[var(--ed-ink)]"><Counter to={s.to} /></dt>
                    <dd className="ed-sans mt-0.5 text-xs text-[var(--ed-ink-3)]">{s.l}</dd>
                  </div>
                ))}
              </dl>
            </RevealItem>
          </Reveal>

          {/* featured cover with parallax + progress ring */}
          <Reveal className="flex flex-col" amount={0.2} delay={0.1}>
            <RevealItem as="div">
              <div className="group relative">
                <span className="ed-eyebrow absolute -left-3 top-6 z-10 origin-left -rotate-90 text-[var(--ed-ink-3)]">Im Mittelpunkt</span>
                <motion.div style={{ y: coverY, scale: coverScale }} className="overflow-hidden rounded-[var(--ed-r-lg)] shadow-[var(--ed-shadow-lift)]">
                  <EdCover seed="lumi-mondzucker" className="ed-cover-hover aspect-[4/5] w-full" />
                </motion.div>
                <motion.div
                  initial={reduce ? undefined : { scale: 0, opacity: 0 }}
                  animate={reduce ? undefined : { scale: 1, opacity: 1 }}
                  transition={{ delay: 0.5, type: "spring", bounce: 0.5 }}
                  className="absolute bottom-4 right-4 rounded-full bg-[var(--ed-ink)]/35 p-1 backdrop-blur-md"
                >
                  <EdRing value={64} size={50}>
                    <span className="ed-sans ed-nums text-[11px] font-bold text-[var(--ed-paper)]">64%</span>
                  </EdRing>
                </motion.div>
              </div>
            </RevealItem>
            <RevealItem as="div" className="mt-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <EdTag accent>Gute-Nacht</EdTag>
                    <span className="ed-sans text-xs text-[var(--ed-ink-3)]">zuletzt vor 2 Tagen</span>
                  </div>
                  <h2 className="ed-serif mt-2 text-xl font-semibold leading-tight text-[var(--ed-ink)]">Lumi und der Mondzucker</h2>
                  <p className="ed-sans mt-1 text-sm text-[var(--ed-ink-2)]">Kapitel 4 von 6 · noch 6 Minuten</p>
                </div>
                <span className="ed-index shrink-0 text-2xl">№1</span>
              </div>
            </RevealItem>
          </Reveal>
        </section>

        {/* ---- CONTINUE ---- */}
        <Section index="01" kicker="Weiterlesen" title="Wo du aufgehört hast" action="Verlauf">
          <Reveal className="grid gap-x-10 gap-y-8 sm:grid-cols-2" amount={0.15}>
            {CONTINUE.map((s) => (
              <RevealItem key={s.id} as="article" className="group flex gap-5">
                <TiltCard className="shrink-0">
                  <EdCover seed={s.id} className="ed-cover-hover h-36 w-28 transition-shadow group-hover:shadow-[var(--ed-shadow-lift)]" />
                </TiltCard>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-center gap-2">
                    <EdTag>{s.genre}</EdTag>
                    <span className="ed-sans text-xs text-[var(--ed-ink-3)]">{s.ago}</span>
                  </div>
                  <h3 className="ed-serif mt-2 text-xl font-semibold leading-snug text-[var(--ed-ink)]">{s.title}</h3>
                  <p className="ed-sans mt-1 flex items-center gap-1.5 text-sm text-[var(--ed-ink-3)]">
                    <Clock className="h-3.5 w-3.5" /> {s.chapter} · noch {s.time} Min
                  </p>
                  <div className="mt-auto pt-4">
                    <EdProgress value={s.progress} delay={0.2} />
                    <div className="mt-2.5 flex items-center justify-between">
                      <span className="ed-sans ed-nums text-xs font-semibold text-[var(--ed-ink-3)]">{s.progress}% gelesen</span>
                      <UnderlineLink className="ed-sans text-sm text-[var(--ed-ink-2)] transition-colors group-hover:text-[var(--ed-accent)]">
                        Weiterlesen <ArrowRight className="h-3.5 w-3.5" />
                      </UnderlineLink>
                    </div>
                  </div>
                </div>
              </RevealItem>
            ))}
          </Reveal>
        </Section>

        {/* ---- FOR YOU ---- */}
        <Section index="02" kicker="Kuratiert" title="Heute für dich ausgewählt" action="Mehr Empfehlungen">
          <Reveal className="-mx-6 flex snap-x gap-6 overflow-x-auto px-6 pb-3 sm:mx-0 sm:px-0" amount={0.1}>
            {FORYOU.map((s) => (
              <RevealItem key={s.id} as="article" className="group w-[260px] shrink-0 snap-start">
                <TiltCard intensity={5} lift={4}>
                  <EdCover seed={s.id} className="ed-cover-hover aspect-[3/2] w-full transition-shadow group-hover:shadow-[var(--ed-shadow-lift)]" />
                </TiltCard>
                <div className="mt-3 flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-[var(--ed-accent)]" />
                  <span className="ed-eyebrow text-[var(--ed-accent)]">{s.reason}</span>
                </div>
                <h3 className="ed-serif mt-1.5 text-lg font-semibold leading-snug text-[var(--ed-ink)]">{s.title}</h3>
                <p className="ed-sans mt-1 text-sm text-[var(--ed-ink-3)]">{s.time} Min Lesezeit</p>
              </RevealItem>
            ))}
          </Reveal>
        </Section>

        {/* ---- LIBRARY ---- */}
        <Section index="03" kicker="Deine Bibliothek" title="Zuletzt hinzugefügt" action="Alle 12 ansehen">
          <Reveal className="grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-4" amount={0.12}>
            {LIBRARY.map((s) => (
              <RevealItem key={s.id} as="article" className="group">
                <TiltCard intensity={7} lift={5} className="relative">
                  <EdCover seed={s.id} className="ed-cover-hover aspect-square w-full transition-shadow group-hover:shadow-[var(--ed-shadow-lift)]" />
                  {s.isNew && (
                    <span className="ed-sans absolute left-2 top-2 rounded-full bg-[var(--ed-accent)] px-2 py-0.5 text-[10px] font-bold text-[var(--ed-paper)] shadow-[var(--ed-shadow-sm)]">NEU</span>
                  )}
                </TiltCard>
                <div className="mt-3 flex items-center justify-between">
                  <EdTag>{s.genre}</EdTag>
                  <span className="ed-sans text-xs text-[var(--ed-ink-3)]">{s.time} Min</span>
                </div>
                <h3 className="ed-serif mt-1.5 text-base font-semibold leading-snug text-[var(--ed-ink)]">{s.title}</h3>
              </RevealItem>
            ))}
          </Reveal>
        </Section>

        {/* ---- HEROES ---- */}
        <Section index="04" kicker="Dein Ensemble" title="Deine Helden" action="Alle Helden">
          <Reveal className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3" amount={0.12}>
            {AVATARS.map((a) => (
              <RevealItem key={a.id} as="div">
                <motion.button
                  whileHover={reduce ? undefined : { y: -3 }}
                  className="ed-card-fine group flex w-full items-center gap-4 p-3 text-left transition-shadow hover:shadow-[var(--ed-shadow-lift)]"
                >
                  <motion.div whileHover={reduce ? undefined : { rotate: -6, scale: 1.05 }} transition={{ type: "spring", stiffness: 300, damping: 15 }}>
                    <EdAvatar seed={a.id} className="h-16 w-16 shrink-0 border border-[var(--ed-line-2)]" />
                  </motion.div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="ed-serif text-lg font-semibold text-[var(--ed-ink)]">{a.name}</h3>
                      <span className="ed-sans text-xs text-[var(--ed-ink-3)]">Stufe {a.level}</span>
                    </div>
                    <p className="ed-sans truncate text-sm text-[var(--ed-ink-2)]">{a.role} · {a.trait}</p>
                    <EdProgress value={a.level * 20} className="mt-2" delay={0.15} />
                  </div>
                </motion.button>
              </RevealItem>
            ))}
            <RevealItem as="div">
              <motion.button
                whileHover={reduce ? undefined : { y: -3 }}
                className="group flex h-full w-full items-center gap-4 rounded-[var(--ed-r-lg)] border border-dashed border-[var(--ed-line-2)] p-3 text-left transition-colors hover:border-[var(--ed-accent)]"
              >
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--ed-line-2)] text-[var(--ed-ink-3)] transition-all group-hover:rotate-90 group-hover:border-[var(--ed-accent)] group-hover:text-[var(--ed-accent)]">
                  <Plus className="h-6 w-6" />
                </span>
                <div>
                  <h3 className="ed-serif text-lg font-semibold text-[var(--ed-ink)]">Neuer Held</h3>
                  <p className="ed-sans text-sm text-[var(--ed-ink-3)]">erschaffe eine neue Figur</p>
                </div>
              </motion.button>
            </RevealItem>
          </Reveal>
        </Section>

        {/* ---- KNOWLEDGE ---- */}
        <Section index="05" kicker="Wissenswelt" title="Große Fragen, klug erklärt" action="Alle Themen">
          <Reveal as="ul" className="border-t border-[var(--ed-line)]" amount={0.12}>
            {DOKUS.map((d) => (
              <RevealItem key={d.id} as="li">
                <motion.button
                  whileHover={reduce ? undefined : { x: 4 }}
                  className="group flex w-full items-center gap-5 border-b border-[var(--ed-line)] py-5 text-left"
                >
                  <span className="ed-index w-8 text-lg">{d.n}</span>
                  <EdCover seed={d.id} tone={Number(d.n)} className="h-14 w-14 shrink-0 transition-shadow group-hover:shadow-[var(--ed-shadow)]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="ed-eyebrow">{d.topic}</span>
                      {d.isNew && <EdTag accent>Neu</EdTag>}
                    </div>
                    <h3 className="ed-serif text-lg font-semibold leading-snug text-[var(--ed-ink)]">{d.title}</h3>
                  </div>
                  <span className="ed-sans hidden items-center gap-1.5 text-xs text-[var(--ed-ink-3)] sm:flex">
                    <Clock className="h-3.5 w-3.5" /> {d.time} Min
                  </span>
                  <ArrowUpRight className="h-5 w-5 shrink-0 text-[var(--ed-ink-3)] transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--ed-accent)]" />
                </motion.button>
              </RevealItem>
            ))}
          </Reveal>
        </Section>

        {/* colophon */}
        <footer className="py-12">
          <EdRuleLabel className="mx-auto max-w-sm">Ende der heutigen Ausgabe</EdRuleLabel>
          <p className="ed-serif mt-4 text-center text-sm italic text-[var(--ed-ink-3)]">Talea · dein Geschichtenatelier</p>
        </footer>
      </main>
    </div>
  );
};

const Section: React.FC<{ index: string; kicker: string; title: string; action: string; children: React.ReactNode }> = ({
  index, kicker, title, action, children,
}) => {
  const reduce = useReducedMotion();
  return (
    <section className="border-b border-[var(--ed-line)] py-12 sm:py-14">
      <Reveal className="mb-8 flex items-end justify-between gap-6" amount={0.6}>
        <RevealItem className="flex items-baseline gap-4">
          <span className="ed-index text-sm font-semibold tracking-widest">{index}</span>
          <div>
            <p className="ed-eyebrow">{kicker}</p>
            <h2 className="ed-serif mt-1 text-[1.9rem] font-semibold leading-tight tracking-tight text-[var(--ed-ink)] sm:text-[2.3rem]">{title}</h2>
          </div>
        </RevealItem>
        <RevealItem className="hidden shrink-0 sm:block">
          <UnderlineLink className="ed-sans text-sm text-[var(--ed-ink-2)] transition-colors hover:text-[var(--ed-accent)]">
            {action} <ArrowRight className="h-4 w-4" />
          </UnderlineLink>
        </RevealItem>
      </Reveal>
      {children}
    </section>
  );
};

export default PlayfulHomePreview;
