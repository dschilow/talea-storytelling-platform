/** Report the fresh Aion 3.5 trial alongside the saved Sol 6.1 baseline. */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readOneShot } from '../../backend/story/episode/engine';
const root = 'output/aion-35-gegen-sol-2026-11-03';
const baseline = 'output/figurenwelt-autorenvergleich-2026-11-03';
const cases = ['tilda','kapitaen','funkelflug'];
const dimensions = ['humor','verstaendnis','roterFaden','sprache','figuren','spannung','gefuehl','aufloesung'];
const read = async (p: string) => { try { return JSON.parse(await readFile(p, 'utf8')); } catch { return null; } };
const norm = (s: string) => String(s || '').normalize('NFC').replace(/[„“”]/g, '"').replace(/\s+/g, ' ').trim();
const rows: any[] = [];
const reviewCosts: any[] = [];
for (const c of cases) {
  const reviews = await Promise.all(['sol','haiku'].map(j => read(join(root,'reviews',c,j,'review.json'))));
  reviews.forEach((r,i) => { if (r) reviewCosts.push({ case:c, judge:['sol','haiku'][i], costUSD:r.usage?.cost ?? null }); });
  for (const model of ['sol','aion35']) {
    const dir = join(model === 'sol' ? baseline : root, c, model, 'episode-1');
    const result = await read(join(dir,'result.json'));
    const failure = await read(join(dir,'failure.json'));
    const files = (await readdir(dir)).filter(f => /^\d+-.*\.response\.json$/.test(f)).sort();
    const calls = await Promise.all(files.map(async file => ({ file, ...(await read(join(dir,file))) })));
    const costUSD = calls.reduce((sum,call) => sum + (Number(call.usage?.costUSD) || 0),0);
    let text = result?.result?.pages?.map((p:any) => `${p.title}\n${p.content}`).join('\n\n') || '';
    if (!text && model === 'aion35') {
      for (const call of calls.filter(x => /series-author/.test(x.file) && x.text)) {
        try { const parsed = readOneShot(call.text); const candidate = parsed.story.chapters.map((p:any) => `${p.title}\n${p.text}`).join('\n\n'); if (candidate.length > text.length) text = candidate; } catch { /* no parseable draft */ }
      }
      if (text) await writeFile(join(dir,'entwurf.md'), `# Nicht ausgelieferter Aion-Entwurf – ${c}\n\n${text}\n`);
    }
    const opinions = reviews.flatMap((r,i) => {
      if (!r) return [];
      const mapping = r.mapping.find((m:any) => m.variant === model);
      const item = mapping && r.items.find((x:any) => x.id === mapping.id);
      if (!item) return [];
      const quote = norm(item.beleg).replace(/^"|"$/g,'');
      return [{ judge:['sol','haiku'][i], ...item, quoteVerified: !!quote && norm(text).includes(quote) }];
    });
    const scores = Object.fromEntries(dimensions.map(d => { const values = opinions.map(o => o[d]).filter(v => typeof v === 'number'); return [d, values.length ? values.reduce((a,b) => a+b,0)/values.length : null]; }));
    rows.push({case:c,model,status:result ? 'ausgeliefert' : 'abgebrochen',title:result?.result?.title || null,error:failure?.error || null,costUSD, historical:model==='sol', scores,opinions, textLength:text.length,calls:calls.map(({file,modelUsed,usage,durationMs,finishReason}) => ({file,modelUsed,usage,durationMs,finishReason}))});
  }
}
const n=(v:number|null) => v == null ? '–' : v.toFixed(2).replace('.',',');
const lines=['# Aion 3.5 gegen Sol 6.1 Low','', 'Drei neue Aion-3.5-Läufe in der regulären Figurenwelt-Textpipeline; Haiku 5.5 bleibt der interne Prüfer. Die drei bereits vorhandenen Sol-Fassungen werden wiederverwendet. System- und Nutzerprompts des ersten Autorenaufrufs wurden für jede Figurenwelt auf exakte Übereinstimmung geprüft. Alle Texte sind fiktiv; keine Bilder, Avatarentwicklung oder Datenbankschreibzugriffe.','', 'Zwei neue blinde Modelllektüren mit Sol 6.1 Low und Haiku 5.5 Low bewerten dieselben acht Kriterien. Reihenfolge und anonymisierte Kennzeichnung wechseln. Sol beurteilt auch eigene Texte; Haiku ist ebenfalls der interne Pipelineprüfer. Dies ist eine kleine Stichprobe ohne menschliches Lektorat, die Noten sind nicht statistisch belastbar.',''];
for (const c of cases) {
  lines.push(`## ${c}`,'','| Modell | Status | Humor | Verständnis | Roter Faden | Sprache | Figuren | Spannung | Gefühl | Auflösung | Kosten $ |','|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const row of rows.filter(r=>r.case===c)) lines.push(`| ${row.model} | ${row.status} | ${dimensions.map(d=>n(row.scores[d])).join(' | ')} | ${row.costUSD.toFixed(6)} |`);
  lines.push('');
  for (const row of rows.filter(r=>r.case===c)) {
    const path = row.model==='sol' ? `../figurenwelt-autorenvergleich-2026-11-03/${c}/sol/folge-1.md` : row.status==='ausgeliefert' ? `${c}/aion35/folge-1.md` : `${c}/aion35/episode-1/entwurf.md`;
    lines.push(`**${row.model}:** ${row.textLength ? `[Manuskript](${path})` : 'Kein auswertbares Manuskript gespeichert.'} ${row.error || ''}`,'');
    for (const o of row.opinions) lines.push(`- ${o.judge}: ${o.staerke} Schwäche: ${o.schwaeche}${o.quoteVerified ? ` Beleg: „${o.beleg}“` : ' (Beleg nicht exakt nachgewiesen.)'}`);
    lines.push('');
  }
}
const newCost=rows.filter(r=>!r.historical).reduce((s,r)=>s+r.costUSD,0);
const oldCost=rows.filter(r=>r.historical).reduce((s,r)=>s+r.costUSD,0);
const reviewCost=reviewCosts.reduce((s,r)=>s+(r.costUSD||0),0);
lines.push('## Kosten und Grenzen','',`Neue Aion-Läufe: $${newCost.toFixed(6)}. Neue externe Blindbewertungen: $${reviewCost.toFixed(6)}. Neu protokolliert insgesamt: $${(newCost+reviewCost).toFixed(6)}. Historische Sol-Generierung: $${oldCost.toFixed(6)}; diese wurde nicht erneut ausgegeben. Beträge stammen aus den erfassten API-Nutzungsdaten; bei fehlender Abrechnung eines Fehleraufrufs kann ein Restbetrag unbekannt sein. Keine Bildkosten.`,'','Ein abgebrochener Lauf wird als solcher gezeigt; eine eventuell bewertete Rohfassung ist nicht gleichbedeutend mit einer akzeptierten Geschichte. Die aktuelle lokale Arbeitskopie enthält bereits bestehende, nicht committete Änderungen. Einzelne fehlende Noten bleiben unberücksichtigt.','');
await writeFile(join(root,'ergebnisse.json'),JSON.stringify({rows,reviewCosts,newCost,oldCost,reviewCost},null,2));
await writeFile(join(root,'README.md'),lines.join('\n'));
console.log(JSON.stringify({rows:rows.map(({case:c,model,status,costUSD,scores,error})=>({case:c,model,status,costUSD,scores,error})),newCost,oldCost,reviewCost}));
