/** Summarise actual call logs and blinded reviews; never mix drafts with accepted stories. */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readOneShot } from '../../backend/story/episode/engine';
const root = 'output/figurenwelt-autorenvergleich-2026-11-03';
const cases = ['tilda', 'kapitaen', 'funkelflug'];
const variants = ['sol', 'aion', 'cydonia', 'skyfall', 'glm'];
const dims = ['humor','verstaendnis','roterFaden','sprache','figuren','spannung','gefuehl','aufloesung'];
const read = async (p: string) => { try { return JSON.parse(await readFile(p, 'utf8')); } catch { return null; } };
const norm = (s: string) => (s || '').normalize('NFC').replace(/[„“”]/g, '"').replace(/\s+/g, ' ').trim();
const rows: any[] = [];
const ext: any[] = [];
for (const c of cases) {
  const reviews = await Promise.all(['sol','haiku'].map(j => read(join(root, 'reviews', c, j, 'review.json'))));
  for (let i = 0; i < reviews.length; i++) if (reviews[i]) ext.push({ case: c, judge: ['sol','haiku'][i], costUSD: reviews[i].usage?.cost ?? null });
  for (const judge of ['sol','haiku']) { const prior = await read(join(root, 'reviews', c, judge, 'previous', 'response.json')); if (prior) ext.push({ case: c, judge, prior: true, costUSD: prior.usage?.cost ?? null }); }
  for (const model of variants) {
    const dir = join(root, c, model, 'episode-1');
    const result = await read(join(dir, 'result.json'));
    const failure = await read(join(dir, 'failure.json'));
    const files = (await readdir(dir)).filter(x => /^\d+-.*\.response\.json$/.test(x)).sort();
    const calls = (await Promise.all(files.map(async f => ({ file: f, response: await read(join(dir, f)) })))).map(({file,response}) => ({ file, model: response?.modelUsed, usage: response?.usage, durationMs: response?.durationMs, finishReason: response?.finishReason }));
    const cost = calls.reduce((n, x) => n + (Number(x.usage?.costUSD) || 0), 0);
    let manuscript = result?.result?.pages?.map((p: any) => `${p.title}\n${p.content}`).join('\n\n') || '';
    if (!manuscript) {
      for (const file of files.filter(f => /series-author/.test(f))) {
        const response = await read(join(dir, file));
        try { const parsed = readOneShot(response.text); const text = parsed.story.chapters.map((p: any) => `${p.title}\n${p.text}`).join('\n\n'); if (text.length > manuscript.length) manuscript = text; } catch { /* incomplete or invalid output */ }
      }
      if (manuscript) await writeFile(join(dir, 'entwurf.md'), `# Nicht ausgelieferter Entwurf – ${c}/${model}\n\n${manuscript}\n`);
    }
    const opinions = reviews.flatMap((review, i) => {
      if (!review) return [];
      const map = review.mapping.find((m: any) => m.variant === model);
      const item = map && review.items.find((x: any) => x.id === map.id);
      if (!item) return [];
      const quote = norm(item.beleg).replace(/^"|"$/g, '');
      return [{ judge: ['sol','haiku'][i], ...item, quoteVerified: !!quote && norm(manuscript).includes(quote) }];
    });
    const scores = Object.fromEntries(dims.map(d => { const v = opinions.map(x => x[d]).filter(x => typeof x === 'number'); return [d, v.length ? v.reduce((a,b) => a+b, 0)/v.length : null]; }));
    rows.push({ case: c, model, status: result ? 'ausgeliefert' : 'abgebrochen', title: result?.result?.title || null, error: failure?.error || null, costUSD: cost, calls, scores, opinions, manuscriptChars: manuscript.length, final: !!result });
  }
}
const num = (v: number | null) => v === null || v === undefined ? '–' : v.toFixed(2).replace('.', ',');
const lines = ['# Figurenwelt: Autorenvergleich am 3. November 2026', '', 'Drei Figurenwelten mit Nora und Ben, je fünf Autoren; reguläre Figurenwelt-Textpipeline mit Haiku 5.5 als Prüfer. Nur der Autor wird getauscht, einschließlich erforderlicher Autorenreparaturen. Die ersten System- und Nutzerprompts wurden je Fall anhand ihres SHA-256-Hashes als identisch geprüft. OpenRouter-Standardtier, keine Bilder, Avatarentwicklung oder Datenbankschreibzugriffe.', '', 'Externe Blindlektüre: Sol 6.1 Low und Haiku 5.5 Low, anonyme Reihenfolge je Fall gespiegelt. Das ist ein kleiner Pilot mit Modellbewertungen, ohne menschliches Lektorat; Sol bewertet teilweise seine eigenen Texte und Haiku hat sie bereits intern geprüft. Die Bewertungen liefern keine statistisch belastbare Rangfolge.', '', 'Noten 0–10 sind Mittelwerte der verfügbaren beiden Lektoren; fehlende Einzelnoten bleiben unberücksichtigt. Abgebrochene Fälle zeigen nur Bewertungen des gespeicherten ursprünglichen Entwurfs, nicht einer freigegebenen Fassung. – bedeutet keine Bewertung.', ''];
for (const c of cases) {
  lines.push(`## ${c}`, '', '| Autor | Pipeline | Kosten $ | Humor | Verständnis | Roter Faden | Sprache | Figuren | Spannung | Gefühl | Auflösung |', '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const row of rows.filter(r => r.case === c)) lines.push(`| ${row.model} | ${row.status} | ${row.costUSD.toFixed(6)} | ${dims.map(d => num(row.scores[d])).join(' | ')} |`);
  lines.push('');
}
lines.push('## Befunde und Manuskripte', '');
for (const row of rows) {
  const rel = `${row.case}/${row.model}/${row.final ? 'folge-1.md' : 'episode-1/entwurf.md'}`;
  lines.push(`### ${row.case} / ${row.model} – ${row.status}`, '', row.manuscriptChars ? `[Manuskript](${rel})` : 'Kein auswertbarer Manuskripttext gespeichert.', '', `Kosten: $${row.costUSD.toFixed(6)} für ${row.calls.length} protokollierte API-Antworten. ${row.error ? `Abbruch: ${row.error}` : ''}`, '');
  for (const o of row.opinions) lines.push(`- ${o.judge}: ${o.staerke} Schwäche: ${o.schwaeche}${o.quoteVerified ? ` Beleg: „${o.beleg}“` : ' (Beleg nicht exakt nachgewiesen.)'}`);
  lines.push('');
}
const generationTotal = rows.reduce((a,r) => a+r.costUSD,0);
const reviewTotal = ext.reduce((a,r) => a+(r.costUSD || 0),0);
lines.push('## Kosten und Grenzen', '', `Summe der protokollierten Generierungsaufrufe: $${generationTotal.toFixed(6)}. Externe Lektorate zusätzlich: $${reviewTotal.toFixed(6)}. Zusammen $${(generationTotal + reviewTotal).toFixed(6)}. Die Zusatzkosten enthalten beide wiederholten Kapitän-Lektorate. Provider-gemeldete Nutzungswerte, keine Bildkosten; Details und Einzelaufrufe in ergebnisse.json.`, '', 'Achtung: Der Test nutzt lokale, derzeit nicht committete Arbeitsstandänderungen. Externe Bewertungen sind zusätzliche Messungen und nicht Teil der normalen Produktionskosten. API-Fehler ohne Nutzungsangabe können nicht exakt bepreist werden.', '');
await writeFile(join(root, 'ergebnisse.json'), JSON.stringify({ rows, externalReviews: ext }, null, 2));
await writeFile(join(root, 'README.md'), lines.join('\n'));
console.log(JSON.stringify({ rows: rows.map(({case:c,model,status,costUSD,scores,error}) => ({case:c,model,status,costUSD,scores,error})), externalReviews: ext }));
