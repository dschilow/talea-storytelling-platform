import type { BookResult } from "./types";

/** Explain the actual stop without presenting transport failures as bad prose. */
export function describeBookFailure(result: BookResult): { stage: string; reason: string; message: string } {
  const failed = [...result.receipts].reverse().find(r => r.status === "failed");
  const stage = failed?.stage ?? (!result.plan ? "plan" : !result.manuscript ? "plan" : !result.review ? "review" : "quality");
  const issues = result.issues.join("\n");
  const http = issues.match(/OpenRouter HTTP (\d{3})/);
  if (http) return { stage, reason: `provider-http-${http[1]}`, message: `Der Textanbieter hat den Aufruf abgewiesen (HTTP ${http[1]}). Die Geschichte konnte nicht erstellt werden.` };
  if (/budget|reserved budget/i.test(issues)) return { stage, reason: "budget", message: "Das Textbudget reicht für den nächsten vollständigen Arbeitsschritt nicht aus. Die Geschichte wurde nicht freigegeben." };
  if (/Incomplete |Invalid (plan|manuscript|review)|JSON|Unexpected token|Unterminated/i.test(issues)) return { stage, reason: "invalid-output", message: `Die KI-Antwort im Schritt ${stage} war unvollständig oder hatte ein ungültiges Format. Die Geschichte konnte nicht fertiggestellt werden.` };
  if (failed) return { stage, reason: "technical", message: `Der KI-Aufruf im Schritt ${stage} ist fehlgeschlagen. Die Geschichte konnte nicht fertiggestellt werden.` };
  if (!result.manuscript) return { stage, reason: "plan-rejected", message: "Der Geschichtenplan erfüllt die Vorgaben noch nicht. Es wurde noch kein Geschichtentext erzeugt." };
  return { stage, reason: "quality-rejected", message: "Die Geschichte hat die abschließende Qualitätsprüfung nicht bestanden und wurde nicht freigegeben." };
}
