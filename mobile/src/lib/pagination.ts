/** Collect the complete catalogue; list endpoints deliberately return summaries. */
export async function collectPages<T>(
  load: (page: { limit: number; offset: number }) => Promise<{ items: T[]; hasMore?: boolean; total?: number }>,
  pageSize = 50,
): Promise<T[]> {
  const items: T[] = [];
  for (;;) {
    const page = await load({ limit: pageSize, offset: items.length });
    items.push(...page.items);
    if (!page.items.length || page.hasMore === false ||
      (page.total !== undefined && items.length >= page.total) ||
      (page.hasMore === undefined && page.items.length < pageSize)) return items;
  }
}

export async function collectCursorPages<T extends { id: string }>(
  load: (cursor?: string) => Promise<{ items: T[]; nextCursor?: string | null }>,
): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await load(cursor);
    items.push(...page.items);
    if (!page.items.length || !page.nextCursor) return items;
    const next = page.items[page.items.length - 1].id;
    if (next === cursor) throw new Error('Pagination did not advance');
    cursor = next;
  }
}
