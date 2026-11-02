/** One editorial source for both the runtime catalogue and the readable series bibles. */
import { writeFile } from 'node:fs/promises';
import bibles from '../../backend/story/character-series/series-bibles.json';
import { SERIES_NARRATIVES } from '../../backend/story/character-series/narrative';
import { SERIES_PLAN_FILES } from '../../backend/story/character-series/episode-plans';
const entries = bibles.map((b, index) => {
  const n = SERIES_NARRATIVES[b.id];
  if (!n || n.arcs.length !== 4) throw new Error(`Incomplete series ${b.id}`);
  const originNames = { before: 'Davor', arrival: 'Der eigene Anlass und Weg der Avatare', encounter: 'Die erste Begegnung', trouble: 'Das Abenteuer und der Fehlversuch', choice: 'Die entscheidende Wahl', after: 'Ergebnis und offene Serienfrage' };
  const text = [
    `## ${index + 1}. ${b.title}`, `### Serienversprechen\n\n${n.promise}`,
    `### Hauptfigur\n\n${n.lead}\n\n**Stimme:** ${n.voice}\n\n**Aussehen:** Die vorhandene Poolfigur mit ihrer Bildreferenz und ihrem gespeicherten visuellen Profil. Die Serienbibel legt kein zweites Aussehen fest.`,
    `### Die Welt vor der ersten Begegnung\n\n${n.world}`,
    `### Verbindliche Regeln\n\n${n.rules.map(r => `- ${r}`).join('\n')}`,
    `### Festes Ensemble\n\n${n.ensemble.map(c => `- **${c.name}** (${c.species}): ${c.nature}\n  Aussehen: ${c.look}`).join('\n')}`,
    `### Persönlicher Ursprung\n\n${Object.entries(n.origin).map(([key, value]) => `**${originNames[key as keyof typeof originNames]}:** ${value}`).join('\n\n')}`,
    `### Zwei Staffeln, vier Entwicklungsbögen, 20 geplante Folgen\n\nJeder Fünferbereich entwickelt eine Frage. Die Planung ist keine behauptete Vorgeschichte: Was wirklich geschehen ist, entscheidet ausschließlich das persönliche Folgenlog. Jede Folge löst ihr eigenes Problem; die Serienentwicklung bleibt daneben verständlich und kurz.\n\n${n.arcs.map((a, i) => `**Folgen ${i * 5 + 1}–${i * 5 + 5}: ${a.question}**\n\n${a.possibilities.map(p => `- ${p}`).join('\n')}\n\nGeplanter Fortschritt: ${a.earnedChange}`).join('\n\n')}`,
  ].join('\n\n');
  return { ...b, description: n.promise.split(': ').pop()!.split('. ')[0] + '.', bible: text };
});
await writeFile('backend/story/character-series/series-bibles.json', JSON.stringify(entries, null, 2) + '\n');
await writeFile('docs/figurenserien/serienbibeln.md', '# Figurenserien – Serienbibeln, Version 3\n\nStand: 2. November 2026. Verbindliche Quelle: `backend/story/character-series/narrative.ts`; Export: `bun scripts/character-series/export.ts`. Die 100 konkreten Folgen stehen in [folgenplanung.md](folgenplanung.md), das Konzept in [serienkonzept-2026-11-02.md](serienkonzept-2026-11-02.md). Bestehende Familiengeschichten werden nicht zurückgesetzt oder überschrieben; ihre belegten Ereignisse haben Vorrang vor der neuen Planung.\n\n' + entries.map(b => b.bible).join('\n\n') + '\n');
const episodeSections = entries.map(b => {
  const plan = SERIES_PLAN_FILES[b.id];
  const n = SERIES_NARRATIVES[b.id];
  const list = plan.episodes.map(ep => {
    const guest = plan.ensemble.find(g => g.id === ep.guestId);
    return [
      `### Folge ${ep.episode}: ${ep.titleIdea}`,
      `*Staffel ${ep.season}; ${guest ? `mit ${guest.name}${ep.guestDebut ? ' (erster Auftritt)' : ''}` : 'Serienfigur und Familienavatare'}.*`,
      `**Auslöser, Wunsch und Problem:** ${ep.hook}`,
      `**Komische Zuspitzung:** ${ep.slapstick}`,
      `**Entscheidender Konflikt:** ${ep.suspense}`,
      `**Sichtbare Auflösung:** ${ep.resolution}`,
      `**Mögliche Pointe:** ${ep.joke}`,
      `**Die Kinder handeln mit:** ${ep.avatarRole}`,
      `**Fortlaufende Geschichte:** ${ep.clue}`,
      `**Verständlichkeit und Kontinuität:** ${ep.continuity}`,
    ].join('\n\n');
  });
  return [`## ${b.title}`, n.promise, `**${plan.seasonTitles[1]}**\n\n**${plan.seasonTitles[2]}**`,
    '| Folgen | Übergreifende Frage | Erreichter Fortschritt |\n|---|---|---|\n' + n.arcs.map((a,i) => `| ${i*5+1}–${i*5+5} | ${a.question} | ${a.earnedChange} |`).join('\n'),
    ...list].join('\n\n');
});
await writeFile('docs/figurenserien/folgenplanung.md', '# Figurenwelten: 100 überarbeitete Folgen\n\nStand: 2. November 2026. Automatischer Export der tatsächlich verwendeten Pläne aus `backend/story/character-series/series/`. Änderungen an diesen Quelldateien vornehmen und mit `bun scripts/character-series/export.ts` neu exportieren.\n\nZiel: verständliche Vorleseabenteuer für 6–8 Jahre. Ein eigenes Problem pro Folge, eine szenische Lösung, Figurenhumor und ein kleiner bleibender Fortschritt der Serie. Für jüngere oder ältere gewählte Altersgruppen passt der bestehende Autorenschritt Sprache und Ausführlichkeit an. Diese Planung ist noch kein mit Kindern geprüfter fertiger Text.\n\nDas [Serienkonzept](serienkonzept-2026-11-02.md) erklärt Vorbilder, Spannungsaufbau, Kosten und den Umgang mit bereits gelesenen Folgen.\n\n' + episodeSections.join('\n\n') + '\n');
await writeFile('docs/figurenserien/export-bibeln.ts', "/** Export the current authoritative editorial contracts. */\nimport '../../scripts/character-series/export';\n");
console.log(`Exported ${entries.length} series contracts.`);
