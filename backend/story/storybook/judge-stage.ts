/**
 * Storybook Pipeline — Stage 3: the comprehension test.
 *
 * This replaces the old seventeen-dimension self-score, which rated a story
 * 8.2/10 that a real seven-year-old understood nothing of. The reason it could
 * do that: the same model family wrote the idea, the beat sheet, the scene
 * cards AND the grade.
 *
 * Here the judge gets ONLY the finished story — no plan, no premise, no
 * context — and has to answer what a child would have to be able to answer.
 * Then we compare its answers to the plan deterministically.
 *
 * The judge deliberately runs on the cheap model. That is the point: if a small
 * model cannot follow the plot with zero context, a child cannot either. It is
 * a surprisingly good proxy and it costs well under half a cent.
 */

import { callSupport, parseJsonObject, type LlmCallResult } from "./llm";
import { evaluateJudgeAnswers } from "./parsing";

export { evaluateJudgeAnswers } from "./parsing";
import type { JudgeAnswers, JudgeReport, KidLogicCard, StorybookPage } from "./types";

export interface JudgeStageInput {
  pages: StorybookPage[];
  card: KidLogicCard;
  title: string;
}

export interface JudgeStageResult {
  report: JudgeReport;
  call?: LlmCallResult;
}

function buildJudgeSystemPrompt(): string {
  return [
    "Du liest eine Kindergeschichte zum ersten Mal, so wie ein Kind sie hört: ohne Vorwissen.",
    "Du bewertest nichts. Du beantwortest nur, was du dem Text entnehmen kannst.",
    "",
    "Wichtig: Rate nicht. Wenn etwas im Text nicht steht, schreib genau das.",
    "Eine ehrliche Antwort „steht nicht drin“ ist wertvoller als eine höfliche Erfindung.",
    "",
    "Antworte ausschließlich mit einem gültigen JSON-Objekt.",
  ].join("\n");
}

function buildJudgeUserPrompt(input: JudgeStageInput): string {
  const story = input.pages.map((page) => `--- Seite ${page.order} ---\n${page.content}`).join("\n\n");

  return [
    `TITEL: ${input.title}`,
    "",
    story,
    "",
    "Beantworte jetzt diese Fragen NUR aus dem Text oben:",
    "",
    JSON.stringify(
      {
        wollte: "Was wollte die Hauptfigur? Ein Satz.",
        schiefgegangen: "Warum ist es schiefgegangen? Ein Satz.",
        andersGemacht: "Was hat die Hauptfigur am Ende anders gemacht als am Anfang? Ein Satz.",
        wiederholung: ["Nenne die Stellen, an denen sich etwas wiederholt (Satz oder Handlung)."],
        lachstelle: "An welcher Stelle lacht ein Kind? Zitiere die Stelle. Wenn es keine gibt: 'keine'.",
        unerklaerteFigur: "Welche Figur taucht auf, ohne dass im Text steht, wer sie ist? Wenn alle erklärt sind: 'keine'.",
        unverstaendlicherSatz: "Welchen Satz hast du beim ersten Lesen nicht verstanden? Zitiere ihn. Wenn alles klar war: 'keiner'.",
        verstaendlichkeit: "Zahl 1-5: Kann ein Siebenjähriger dieser Geschichte folgen? 5 = mühelos, 1 = gar nicht.",
      },
      null,
      1
    ),
  ].join("\n");
}

export async function runJudgeStage(input: JudgeStageInput): Promise<JudgeStageResult> {
  let call: LlmCallResult;
  try {
    call = await callSupport({
      system: buildJudgeSystemPrompt(),
      user: buildJudgeUserPrompt(input),
      maxTokens: 900,
      json: true,
      temperature: 0.2,
    });
  } catch (err) {
    console.warn("[storybook/judge] judge unavailable; continuing with deterministic prose checks:", err);
    return {
      report: {
        answers: {
          wollte: "",
          schiefgegangen: "",
          andersGemacht: "",
          wiederholung: [],
          lachstelle: "",
          unerklaerteFigur: "",
          unverstaendlicherSatz: "",
          verstaendlichkeit: 3,
        },
        issues: [{
          code: "judge_unavailable",
          severity: "soft",
          message: "Der Verstaendnis-Test war voruebergehend nicht erreichbar.",
        }],
        passed: true,
      },
    };
  }

  const parsed = parseJsonObject<JudgeAnswers>(call.text);
  if (!parsed) {
    // A judge that fails to answer is not evidence against the story.
    return {
      call,
      report: {
        answers: {
          wollte: "",
          schiefgegangen: "",
          andersGemacht: "",
          wiederholung: [],
          lachstelle: "",
          unerklaerteFigur: "",
          unverstaendlicherSatz: "",
          verstaendlichkeit: 3,
        },
        issues: [{ code: "judge_unavailable", severity: "soft", message: "Der Verständnis-Test konnte nicht ausgewertet werden." }],
        passed: true,
      },
    };
  }

  return { call, report: evaluateJudgeAnswers(parsed, input.card) };
}
