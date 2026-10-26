/** Long-form adapter of the same editorial policy, preserving resumable book state. */
import { planBook, writeBook, type BookContext, type PlannedBook } from "../storybook/book/engine";
import { mentionsName } from "../storybook/book/catalogue";
import type { BookBrief, BookState } from "../storybook/book/types";
import type { CastCandidate } from "../storybook/types";
import { castSheetEn } from "../storybook/oneshot-prompt-en";
import { episodeCastFocus } from "../episode/cast-focus";
import { UNIFIED_PIPELINE_ID } from "./config";
import { unifiedCraft } from "./craft";

export function bookLead(brief: BookBrief): CastCandidate | undefined {
  if (brief.config.avatarIsHero !== false) return undefined;
  if (brief.series?.starId) return brief.catalogue.find(c => c.id === brief.series!.starId);
  const rank = (id: string) => [...brief.seed + id].reduce((n, c) => Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
  return brief.catalogue.filter(c => c.canLead).sort((a, b) => a.recentUses - b.recentUses || rank(a.id) - rank(b.id))[0];
}

function withCommonPolicy(ctx: BookContext, lead?: CastCandidate): BookContext {
  const brief = ctx.brief;
  const focus = lead ? [
    ...episodeCastFocus({ ...brief, candidates: [lead] }),
    `BINDING VOLUME CAST: ${lead.name} (${lead.id}) drives this volume through the supplied want. Choose the guest engine, keep this figure in castIds and engineFigure, and retain the avatars' distinct consequential contributions.`,
    castSheetEn(lead),
  ].join("\n") : brief.series?.starId
    ? "SERIES CONTINUITY: retain the established series star, identity and relationships. Do not replace a returning star with a newly selected pool figure."
    : episodeCastFocus(brief).join("\n");
  return { ...ctx, llm: request => ctx.llm(request.role === "writer" || /^book-patch/.test(request.stage)
    ? { ...request, system: `${request.system}\n\n${unifiedCraft(brief, "chapter-book")}\n\n${focus}` }
    : request) };
}

export async function planUnifiedBook(ctx: BookContext): Promise<PlannedBook> {
  const lead = bookLead(ctx.brief);
  const result = await planBook(withCommonPolicy(ctx, lead));
  if (lead && (!result.plan.castIds.includes(lead.id) || !mentionsName(result.plan.bible.engineFigure || "", lead.name))) {
    throw new Error(`[${UNIFIED_PIPELINE_ID}] The volume plan lost its selected pool protagonist ${lead.name}.`);
  }
  return { ...result, textPipeline: UNIFIED_PIPELINE_ID, ...(lead ? { leadId: lead.id } : {}) };
}

export async function writeUnifiedBook(ctx: BookContext, planned: PlannedBook, state: BookState, upTo = planned.brief.book.chapters): Promise<BookState> {
  const lead = planned.leadId ? planned.brief.candidates.find(c => c.id === planned.leadId) : undefined;
  if (planned.leadId && !lead) throw new Error(`[${UNIFIED_PIPELINE_ID}] Missing canonical profile for the returning book protagonist.`);
  return writeBook(withCommonPolicy({ ...ctx, brief: planned.brief }, lead), planned, state, upTo);
}
