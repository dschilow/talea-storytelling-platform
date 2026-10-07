export interface BookDocument { title: string; summary?: string; coverImageUrl?: string; sections: Array<{ title: string; content: string; imageUrl?: string }> }
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}
const image = (url?: string) => url && /^(https?:|file:|data:image\/)/i.test(url) ? `<img src="${escapeHtml(url)}" />` : '';
export function bookHtml(book: BookDocument): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(book.title)}</title>
    <style>@page{margin:18mm}body{font-family:sans-serif;color:#223348;font-size:12pt;line-height:1.6}h1,h2{line-height:1.2}img{max-width:100%;max-height:180mm;object-fit:contain}section{break-before:page}p{white-space:pre-wrap;overflow-wrap:anywhere}</style></head><body>
    <h1>${escapeHtml(book.title)}</h1>${image(book.coverImageUrl)}<p>${escapeHtml(book.summary ?? '')}</p>
    ${book.sections.map((section) => `<section><h2>${escapeHtml(section.title)}</h2>${image(section.imageUrl)}${section.content.split(/\n\s*\n/).filter(Boolean).map((text) => `<p>${escapeHtml(text)}</p>`).join('')}</section>`).join('')}
    </body></html>`;
}
