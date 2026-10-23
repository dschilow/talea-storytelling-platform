/**
 * Talea-Folge — the two prompts: the story bible with its chapter plan, and the
 * writer. Instructions are English (one prompt for every story language);
 * everything a child hears is written in the family's language.
 */

import { CHILD_SAFETY_RULES_EN } from "../../helpers/child-safety";
import { isGerman } from "../storybook/craft";
import { broughtArtifact, heroIdOf, type StoryBrief } from "../storybook/context";
import { artifactSheetEn, castSheetEn, heroSheetEn, wishLinesEn } from "../storybook/oneshot-prompt-en";
import { learningGoal, learningWriterLinesEn } from "../storybook/learning";
import { childSituationChoices, FAMILY_RULE_EN, GENRE_METHOD_EN, METHOD_EN, placeChoices, styleSamples, takenNamesLine, writingRulesEn } from "./craft";
import type { EpisodePlan } from "./types";

function bandNote(band: StoryBrief["band"]): string {
  if (band === "3-5") return "The listeners are three to five: ONE simple, very visible wonder, a problem a small child knows, lots of repetition, a gentle thrill and a big laugh. The rule has no conditions; the attempts are three tries of the same kind, each funnier.";
  if (band === "9-12") return "The listeners are nine to twelve: they love pace, wit, wordplay and real (never cruel) danger. The child situation may be subtler (pride, loyalty, being taken seriously).";
  return "The listeners are six to eight: they follow every twist as long as each step follows from the previous one, and they laugh out loud at slapstick, literal misunderstandings and figures who are ridiculously sure of themselves.";
}

function chapterRhythm(chapters: number): string[] {
  if (chapters <= 2) {
    return [
      "Chapter 1: arrive in the heroes' world with the figures in action, the child situation, the trigger, the wonder's first effect, briefly great — then the first escalation and a hook.",
      "Chapter 2: the easy way makes it worse, the near-discovery, a short quiet moment, the courage in front of others, the rule resolves it, warm ending with the callbacks and the final laugh.",
    ];
  }
  const middle = chapters - 2;
  return [
    "Chapter 1: arrive in the heroes' world with the figures in action, the child situation and its pressure, the trigger, the wonder's first small effect — briefly great. End on a funny hook that shows the catch.",
    middle === 1
      ? "Chapter 2: the catch escalates; the easy-way attempts make it worse; a grown-up almost discovers it; a quiet moment where someone admits a weakness. End on a hook."
      : `Chapters 2–${chapters - 1}: the catch escalates step by step; the easy-way attempts each make it worse; a grown-up almost discovers it; the troublemaker's plan runs in parallel; in chapter ${chapters - 1} the quiet moment. Each chapter ends on a hook.`,
    `Chapter ${chapters}: everything collides at the worst moment (the troublemaker's slapstick often triggers it); the courage in front of others; the rule resolves it; the warm reaction; the thing done right for real; the callbacks of the running gags; the final laugh.`,
  ];
}

export function planSystemPrompt(brief: StoryBrief): string {
  return [
    `You are the head writer of Talea Originals. Families love our stories because they are full and funny: a wonder with one clear rule, figures with unmistakable voices, gags that come back, chaos that escalates step by step, one brave moment with real heart, and an ending that pays off everything planted. Now you develop ONE stand-alone story in which the family's own heroes are the main characters. Everything a child will hear is in ${brief.languageLabel}; these instructions are in English only for you. Think it through silently, then answer with ONE JSON object.`,
    bandNote(brief.band),
    "",
    METHOD_EN,
    takenNamesLine(brief),
    "",
    FAMILY_RULE_EN,
    "",
    CHILD_SAFETY_RULES_EN,
  ].filter((line) => line !== undefined).join("\n");
}

const PLAN_SHAPE = (brief: StoryBrief, chapters: number) => [
  "JSON (all story content in the story language, short phrases, no prose paragraphs):",
  "{",
  ` "ideas": ["three completely different pitches, one line each: child situation + wonder"],`,
  ` "chosen": 1,`,
  ` "title": "2–6 words like a real children's book: a thing, creature, exclamation or impossible situation from THIS story; never „${brief.heroes.map((hero) => hero.name).join(" und ")} und …“, never the ending",`,
  ` "summary": "two sentences for the story card: the situation and the funny problem, never the ending",`,
  ` "focusHero": "hero id",`,
  ` "childSituation": "who is under which everyday pressure, and why it matters to them",`,
  ` "wonder": {"rule": "ONE sentence a child can repeat", "who": "the wonder as a someone (or the figure that comes with it): attitude and voice", "firstEffect": "the small first visible effect in chapter 1", "escalation": ["next effect", "craziest effect"], "endsWhen": "the only way it stops, in ONE moment — tied to the child situation, planted in chapter 1"},`,
  ` "heroes": [{"id": "hero id", "name": "…", "voice": "how they talk + one typical line", "contribution": "their own decisive deed in this story"}],`,
  ` "cast": [{"id": "pool id, or a new kebab-case id", "name": "…", "from": "pool|new", "role": "companion|troublemaker|grownup|wonder", "species": "human|animal|creature|thing", "voice": "how they talk + one typical line", "wants": "…", "comicPattern": "…", "lookEn": "English, concrete colours and shapes for the illustrator — for new figures"}],`,
  ` "runningGags": [{"gag": "…", "beats": ["first time", "second time", "third time: the turn or payoff"]}],`,
  ` "attempts": ["the easy-way attempt → why it gets worse"],`,
  ` "nearDiscovery": "who almost finds out, how, and the comic dodge",`,
  ` "quietMoment": "who admits which small weakness",`,
  ` "courage": "who does which hard thing in front of whom (see HEART), and what it shows about them",`,
  ` "solution": "one child's sentence: why it works",`,
  ` "setups": [{"what": "…", "planted": 1, "paysOff": ${chapters}}],`,
  ` "chapters": [{"title": "1–4 words, funny, from the chapter", "beats": ["concrete events in order"], "laughs": ["two laugh-out-loud set pieces of this chapter: what exactly goes wrong and what it looks like"], "ending": "the hook (last chapter: resolution + final laugh)"}] (exactly ${chapters}),`,
  ` "schoolyardLine": "the line children will retell, word for word",`,
  ` "finalLaugh": "the very last gag — a callback",`,
  ` "artifact": null or {"id": "artifact id", "role": "what it does in this story, within its unchangeable rule", "firstChapter": 1, "useChapter": 2},`,
  ` "learningCore": ${learningGoal(brief.config) ? `"the knowledge core in one or two sentences, true in the real world, as the child should say it afterwards"` : "null"}`,
  "}",
];

/** Today's choices: they keep Sol off its favourite child situation and its favourite stage. */
function choiceLines(brief: StoryBrief): string[] {
  return [
    `TODAY'S CHILD SITUATIONS — your three ideas use three DIFFERENT ones of these, each fitted to the heroes' nature: ${childSituationChoices(brief.seed).map((situation) => `„${situation}“`).join("; ")}.`,
    `TODAY'S PLACES — set the story in one of these, or in an equally fresh one of the genre: ${placeChoices(brief.config.genre, brief.seed).map((place) => `„${place}“`).join("; ")}. Not a festival, party, show or performance (unless the family's wish asks for one) — that stage is worn out.`,
    "The heroes' traits and hobbies colour how they act, speak and solve things; they are not the topic. A hero who loves dancing does not need a dance performance — let the trait show up somewhere unexpected.",
  ];
}

export function planUserPrompt(brief: StoryBrief, repair?: { plan: unknown; problems: string[] }): string {
  const lines: string[] = [];
  lines.push("TASK: Invent and plan one Talea story with these heroes — one a child wants to hear again and again and retells the next morning.");
  lines.push("First note three completely different ideas (each: a child situation + a wonder that takes it literally) and take the one a child would most want to retell („Stell dir vor, …!“). Then build its bible and chapter plan with the method.");
  lines.push(...choiceLines(brief), "");
  lines.push(...storyBriefLines(brief, "plan 4–7 concrete beats per chapter"));
  lines.push(...PLAN_SHAPE(brief, brief.budget.pages));
  if (repair) {
    lines.push("");
    lines.push("YOUR PREVIOUS PLAN had these problems. Return the complete corrected JSON; keep everything that was good:");
    for (const problem of repair.problems) lines.push(`- ${problem}`);
    lines.push(`PREVIOUS PLAN: ${JSON.stringify(repair.plan)}`);
  }
  return lines.join("\n");
}

/** Frame, learning arc, rhythm, heroes, pool, new figures, artifacts, history — shared by the planner and the one-shot. */
function storyBriefLines(brief: StoryBrief, sizeHint: string): string[] {
  const { budget } = brief;
  const chapters = budget.pages;
  const lines: string[] = [];
  lines.push("FRAME:");
  lines.push(`- Story language: ${brief.languageLabel}`);
  lines.push(`- Listeners' age: ${brief.band} years`);
  lines.push(`- Size: exactly ${chapters} chapters of ${budget.wordsPerPageMin}–${budget.wordsPerPageMax} words each (${budget.totalWordsMin}–${budget.totalWordsMax} words) — enough room for full scenes, so ${sizeHint}.`);
  const genre = GENRE_METHOD_EN[String(brief.config.genre || "")];
  for (const line of wishLinesEn(brief.config, "story")) {
    // The genre line of the shared wish list is replaced by this lane's version.
    if (genre && /^Genre /.test(line)) lines.push(`- ${genre}`);
    else lines.push(`- ${line}`);
  }
  lines.push("");
  const learning = learningWriterLinesEn(brief.config, { form: "story", band: brief.band, units: chapters });
  if (learning.length) lines.push(...learning, "");
  lines.push("CHAPTER RHYTHM:");
  for (const line of chapterRhythm(chapters)) lines.push(`- ${line}`);
  lines.push("");
  lines.push("THE HEROES (they are the main characters and have the decisive ideas; their data is in the family's language):");
  for (const [index, hero] of brief.heroes.entries()) lines.push(heroSheetEn({ ...hero, id: heroIdOf(hero, index) }, brief.heroMemories[hero.id] || []));
  lines.push("");
  if (brief.candidates.length > 0) {
    lines.push(`CHARACTER POOL — the family meets these figures again and again. Cast 1 to ${budget.maxCast} of them with a real role (companion, troublemaker or grown-up) right into the finale, in their own nature and home world: choose the idea so that the figure belongs there naturally (a robber in a forest, a fox in its library), never as a costume in a place where it makes no sense. Keep their quirk and give them the voice they have:`);
    for (const candidate of brief.candidates) lines.push(castSheetEn(candidate));
    lines.push("");
  }
  lines.push(`NEW FIGURES: besides the heroes and the pool, at most ${brief.band === "3-5" ? 1 : 2} new figures (the wonder itself counts if it is a someone) — each with a name, a voice and a concrete English look. One extra grown-up without a name may appear briefly.`);
  lines.push("");
  const brought = broughtArtifact(brief);
  if (brought) {
    lines.push("BROUGHT ARTIFACT (mandatory: a hero has it from the first page on; its rule never changes):");
    lines.push(artifactSheetEn(brought));
    lines.push("");
  } else if (brief.artifacts.length > 0) {
    lines.push("POSSIBLE FINDS (optional, at most one, only if it fits naturally; always exactly this name; its rule never changes):");
    for (const artifact of brief.artifacts) lines.push(artifactSheetEn(artifact));
    lines.push("");
  }
  if (brief.recentStories.length > 0) {
    lines.push("THIS FAMILY ALREADY KNOWS (repeat none of it — neither the wonder nor the main object nor the title pattern):");
    for (const story of brief.recentStories.slice(0, 6)) lines.push(`- ${story}`);
    lines.push("");
  }
  if (brief.blockedTerms.length > 0) lines.push(`These terms must not appear anywhere: ${brief.blockedTerms.join(", ")}`, "");
  return lines;
}

/* ── One-shot: bible and story in one call ──────────────────────────────── */

/**
 * The two-step plan cost about as much as the story itself (≈ 4,000 JSON tokens of Sol output,
 * 2026-10-23) — for a short story more than the text. The one-shot plans silently and writes only
 * the few header lines the app needs (cast, artifact, knowledge) before the chapters.
 */
export function oneShotSystemPrompt(brief: StoryBrief): string {
  return [
    writerSystemPrompt(brief).replace(/\nOUTPUT, plain text without markdown[\s\S]*$/, ""),
    "",
    "Before you write, you are also the head writer: you invent the story's own small series bible with this method — silently, in your head.",
    METHOD_EN,
    takenNamesLine(brief),
    "",
    "OUTPUT, plain text without markdown — these markers stay German, everything else is in the story language:",
    "IDEE: <the chosen idea in one line>",
    "REGEL: <the wonder's one rule, one sentence a child can repeat>",
    "FIGUR: <name> | pool | <pool id> | <companion|troublemaker|grownup|wonder>   (one line per pool figure in the story)",
    "FIGUR: <name> | neu | <companion|troublemaker|grownup|wonder> | <human|animal|creature|thing> | <concrete English look for the illustrator>   (one line per new named figure)",
    "FUNDSTÜCK: <artifact id, or keins>",
    ...(learningGoal(brief.config) ? ["WISSEN: <the knowledge core in one or two sentences, true in the real world, as the child should say it afterwards>"] : []),
    `TITEL: <2–6 words like a real children's book: a thing, creature, exclamation or impossible situation from THIS story; never „${brief.heroes.map((hero) => hero.name).join(" und ")} und …“, never the ending>`,
    "BESCHREIBUNG: <two sentences for the story card: the situation and the funny problem, never the ending>",
    "",
    "KAPITEL 1: <chapter title>",
    "<paragraphs, separated by one blank line>",
    "",
    "KAPITEL 2: <chapter title>",
    "…",
  ].join("\n");
}

export function oneShotUserPrompt(brief: StoryBrief, revision?: { raw: string; notes: string[] }): string {
  const lines: string[] = [];
  lines.push("TASK: Invent, plan and write one complete Talea story with these heroes — one a child wants to hear again and again and retells the next morning.");
  lines.push("Plan silently first: three completely different ideas (each: a child situation + a wonder that takes it literally), take the one a child would most want to retell („Stell dir vor, …!“), then work out its bible with the method — rule, voices, two running gags, the easy-way attempts, the near-discovery, the quiet moment, the courage, the payoffs and the final laugh. Then write the header lines and the whole story as living scenes.");
  lines.push(...choiceLines(brief), "");
  lines.push(...storyBriefLines(brief, "every chapter carries several full scenes"));
  const names = [...brief.heroes.map((hero) => hero.name), ...brief.candidates.map((candidate) => candidate.name)];
  lines.push(`NAMES: named figures are the heroes, the pool figures you cast and your new figures (each listed as FIGUR in the header). Anyone else stays nameless (a neighbour, the baker) and appears only briefly. Heroes and pool: ${names.join(", ")}${brief.config.allowFamousCharacters ? " — plus the requested famous fairy-tale figure under its well-known name" : ""}.`);
  if (revision) {
    lines.push("", "The editor read the version below. Return the WHOLE story again (header and chapters) so that every point is solved. Keep what works (gags, lines, scenes); change precisely:");
    for (const note of revision.notes) lines.push(`- ${note}`);
    lines.push("", "PREVIOUS VERSION:", revision.raw);
  }
  return lines.join("\n");
}

/* ── Writer ─────────────────────────────────────────────────────────────── */

export function writerSystemPrompt(brief: StoryBrief): string {
  const german = isGerman(brief.config.language);
  const samples = styleSamples();
  return [
    `You are an author of Talea Originals, the children's series families love because every story is full and funny. You write one complete story print-ready in ${brief.languageLabel}, in the series' voice. These instructions are in English only for you.`,
    bandNote(brief.band),
    "",
    writingRulesEn(brief.band, brief.languageLabel, german),
    "",
    FAMILY_RULE_EN,
    "",
    "STYLE REFERENCE — two chapters of published Talea Originals (German). Learn the craft from them: rhythm and sentence length, how a joke is built up and lands, how differently the figures speak, how sound words and exact numbers work, how a chapter ends, how the brave moment is told without a sermon. Copy NOTHING from them: no names, figures, objects, magic rules, sound words, catchphrases or jokes. Your story is completely different.",
    ...samples.map((sample) => `<<< ${sample.label}\n${sample.text}\n>>>`),
    "",
    CHILD_SAFETY_RULES_EN,
    "",
    "OUTPUT, plain text without markdown — these markers stay German, everything else is in the story language:",
    "TITEL: <title>",
    "BESCHREIBUNG: <two sentences for the story card>",
    "",
    "KAPITEL 1: <chapter title>",
    "<paragraphs, separated by one blank line>",
    "",
    "KAPITEL 2: <chapter title>",
    "…",
  ].join("\n");
}

function planText(plan: EpisodePlan): string {
  const cast = plan.cast.map((member) => `- ${member.name} [${member.id}, ${member.from === "pool" ? "pool" : "new"}, ${member.role}]: voice ${member.voice}; wants ${member.wants}; comic pattern ${member.comicPattern}`);
  return [
    `TITLE: ${plan.title}`,
    `FOCUS HERO: ${plan.focusHero}`,
    `CHILD SITUATION: ${plan.childSituation}`,
    `WONDER — rule: ${plan.wonder.rule} | who: ${plan.wonder.who} | first effect: ${plan.wonder.firstEffect} | escalation: ${plan.wonder.escalation.join(" → ")} | ends when: ${plan.wonder.endsWhen}`,
    "HEROES:",
    ...plan.heroes.map((hero) => `- ${hero.name} [${hero.id}]: voice ${hero.voice}; contribution ${hero.contribution}`),
    "CAST:",
    ...(cast.length ? cast : ["- none"]),
    "RUNNING GAGS:",
    ...plan.runningGags.map((gag) => `- ${gag.gag}: ${gag.beats.join(" → ")}`),
    `EASY-WAY ATTEMPTS: ${plan.attempts.join(" | ")}`,
    `NEAR-DISCOVERY: ${plan.nearDiscovery}`,
    `QUIET MOMENT: ${plan.quietMoment}`,
    `COURAGE: ${plan.courage}`,
    `SOLUTION: ${plan.solution}`,
    `SETUPS: ${plan.setups.map((setup) => `${setup.what} (planted ch. ${setup.planted}, pays off ch. ${setup.paysOff})`).join(" | ")}`,
    ...plan.chapters.map((chapter, index) => `CHAPTER ${index + 1} „${chapter.title}“\n  Beats: ${chapter.beats.join(" → ")}\n  Laughs: ${chapter.laugh}\n  Ending: ${chapter.ending}`),
    `SCHOOLYARD LINE: ${plan.schoolyardLine}`,
    `FINAL LAUGH: ${plan.finalLaugh}`,
    plan.artifact ? `ARTIFACT: ${plan.artifact.id} — ${plan.artifact.role} (first ch. ${plan.artifact.firstChapter}, used ch. ${plan.artifact.useChapter})` : "",
    plan.learningCore ? `KNOWLEDGE CORE: ${plan.learningCore}` : "",
  ].filter(Boolean).join("\n");
}

export function writerUserPrompt(brief: StoryBrief, plan: EpisodePlan, revision?: { chapters: Array<{ title: string; text: string }>; notes: string[] }): string {
  const { budget } = brief;
  const lines: string[] = [];
  lines.push("FRAME:");
  lines.push(`- Story language: ${brief.languageLabel}; listeners ${brief.band} years.`);
  lines.push(`- Exactly ${budget.pages} chapters of ${budget.wordsPerPageMin}–${budget.wordsPerPageMax} words each (${budget.totalWordsMin}–${budget.totalWordsMax} words in total, will be counted). Full scenes, not summaries: show every beat as a scene with dialogue.`);
  for (const line of wishLinesEn(brief.config, "story")) lines.push(`- ${line}`);
  const learning = learningWriterLinesEn(brief.config, { form: "story", band: brief.band, units: budget.pages });
  if (learning.length) lines.push("", ...learning);
  lines.push("");
  lines.push("THE HEROES (data in the family's language):");
  for (const [index, hero] of brief.heroes.entries()) lines.push(heroSheetEn({ ...hero, id: heroIdOf(hero, index) }, brief.heroMemories[hero.id] || []));
  const pool = plan.cast.filter((member) => member.from === "pool").map((member) => brief.candidates.find((candidate) => candidate.id === member.id)).filter(Boolean);
  if (pool.length) {
    lines.push("", "POOL FIGURES IN THIS STORY (keep their nature, quirk and way of speaking):");
    for (const candidate of pool) lines.push(castSheetEn(candidate!));
  }
  const artifact = plan.artifact ? brief.artifacts.find((option) => option.id === plan.artifact!.id) : undefined;
  if (artifact) lines.push("", `ARTIFACT (always exactly this name; its rule never changes): ${artifactSheetEn(artifact)}`);
  const names = [...brief.heroes.map((hero) => hero.name), ...plan.cast.map((member) => member.name)];
  lines.push("", `NAMES: only these figures have names: ${names.join(", ")}${brief.config.allowFamousCharacters ? " — plus the requested famous fairy-tale figure under its well-known name" : ""}. Anyone else stays nameless (a neighbour, the baker) and appears only briefly.`);
  if (brief.blockedTerms.length > 0) lines.push(`These terms must not appear anywhere: ${brief.blockedTerms.join(", ")}`);
  lines.push("", "THE PLAN (follow its beats, gags and voices; tell it as living scenes):", planText(plan));
  if (revision) {
    lines.push("", "The editor read the version below. Rewrite the WHOLE story so that every point is solved. Keep what works (gags, lines, scenes); change precisely:");
    for (const note of revision.notes) lines.push(`- ${note}`);
    lines.push("", "PREVIOUS VERSION:", revision.chapters.map((chapter, index) => `KAPITEL ${index + 1}: ${chapter.title}\n${chapter.text}`).join("\n\n"));
  } else {
    lines.push("", "Write the story now.");
  }
  return lines.join("\n");
}
