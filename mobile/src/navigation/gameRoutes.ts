/** /quiz is the web hub's shortcut to its Quiz tab. Explicit tab wins on both paths. */
export function normalizeGamePath(raw: string): string {
  const separator = raw.indexOf('?');
  const path = separator < 0 ? raw : raw.slice(0, separator);
  const page = path.replace(/^\/+|\/+$/g, '');
  if (page !== 'spiel' && page !== 'quiz') return raw;
  const query = new URLSearchParams(separator < 0 ? '' : raw.slice(separator + 1));
  const explicit = query.get('tab');
  query.set('tab', explicit === 'alibi' || explicit === 'quiz' ? explicit : page === 'quiz' ? 'quiz' : 'alibi');
  return `${path.startsWith('/') ? '/' : ''}spiel?${query.toString()}`;
}
