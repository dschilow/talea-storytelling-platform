/** One editorial source for both the runtime catalogue and the readable series bibles. */
import { writeFile } from 'node:fs/promises';
import bibles from '../../backend/story/character-series/series-bibles.json';
import { SERIES_NARRATIVES } from '../../backend/story/character-series/narrative';
const entries = bibles.map((b, index) => {
  const n = SERIES_NARRATIVES[b.id];
  if (!n || n.arcs.length !== 4) throw new Error(`Incomplete series ${b.id}`);
  const originNames = { before: 'Davor', arrival: 'Der eigene Anlass und Weg der Avatare', encounter: 'Die erste Begegnung', trouble: 'Das Abenteuer und der Fehlversuch', choice: 'Die entscheidende Wahl', after: 'Ergebnis und offene Serienfrage' };
  const text = [
    `## ${index + 1}. ${b.title}`, `### Serienversprechen\n\n${n.promise}`,
    `### Hauptfigur\n\n${n.lead}\n\n**Stimme:** ${n.voice}\n\n**Fester Bildentwurf:** ${n.look}`,
    `### Die Welt vor der ersten Begegnung\n\n${n.world}`,
    `### Verbindliche Regeln\n\n${n.rules.map(r => `- ${r}`).join('\n')}`,
    `### Festes Ensemble\n\n${n.ensemble.map(c => `- **${c.name}** (${c.species}): ${c.nature}\n  Aussehen: ${c.look}`).join('\n')}`,
    `### Persönlicher Ursprung\n\n${Object.entries(n.origin).map(([key, value]) => `**${originNames[key as keyof typeof originNames]}:** ${value}`).join('\n\n')}`,
    `### Vier Entwicklungsbögen mit Stoff für rund 40 Folgen\n\nDie Zehnerbereiche sind Möglichkeiten, keine behauptete Vorgeschichte. Was wirklich geschehen ist, entscheidet ausschließlich das persönliche Folgenlog. Konflikte werden ausgebaut, verbunden und verändert; die Liste ist kein fertiger Plan für 40 Episoden.\n\n${n.arcs.map((a, i) => `**Folgen ${i * 10 + 1}–${i * 10 + 10}: ${a.question}**\n\n${a.possibilities.map(p => `- ${p}`).join('\n')}\n\nMögliche verdiente Veränderung: ${a.earnedChange}`).join('\n\n')}`,
  ].join('\n\n');
  return { ...b, description: n.promise.split(': ').pop()!.split('. ')[0] + '.', bible: text };
});
await writeFile('backend/story/character-series/series-bibles.json', JSON.stringify(entries, null, 2) + '\n');
await writeFile('docs/figurenserien/serienbibeln.md', '# Figurenserien – überarbeitete Serienbibeln, Version 2\n\nStand: 27. Oktober 2026. Verbindliche Quelle: `backend/story/character-series/narrative.ts`; Export: `bun scripts/character-series/export.ts`. Die früheren Entwürfe und ihr Sol-Lektorat dokumentieren Version 1. Version 2 eröffnet eine neue persönliche Zeitlinie.\n\n' + entries.map(b => b.bible).join('\n\n') + '\n');
await writeFile('docs/figurenserien/export-bibeln.ts', "/** Export the current authoritative editorial contracts. */\nimport '../../scripts/character-series/export';\n");
console.log(`Exported ${entries.length} series contracts.`);
