// Runs the actual list SELECT statements in a disposable local PostgreSQL
// container. No production connection or application credentials are used.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const container = process.argv[2] || 'talea-performance-postgres';
const docs = [
  { title: 'Embedded title', summary: 'An explicit summary.', sections: [{ content: 'First sentence. More text.' }, { content: 'x'.repeat(100000) }] },
  { sections: [{ content: 'First sentence. Second sentence.' }, { content: 'x'.repeat(100000) }] },
  { summary: '', sections: [{ content: '' }] },
  { sections: [] },
  { sections: [{ content: '.No first sentence' }] },
  { title: null, summary: null, sections: [{ content: 12 }] },
  JSON.stringify({ title: 'Legacy title', summary: 'Legacy summary.', sections: [{ content: 'Original text.' }] }),
  'legacy malformed JSON',
];
const quote = value => `'${value.replaceAll("'", "''")}'`;
const fixtures = `
CREATE TEMP TABLE dokus (
  id text PRIMARY KEY, user_id text, primary_profile_id text, title text,
  topic text, content jsonb, cover_image_url text, is_public boolean,
  status text, metadata text, created_at timestamp, updated_at timestamp
);
CREATE TEMP TABLE doku_participants (doku_id text, profile_id text);
INSERT INTO dokus VALUES ${docs.map((doc, i) => `('d${i}', 'fixture-user', 'fixture-profile', '', 'topic', ${quote(JSON.stringify(doc))}::jsonb, null, true, 'complete', null, '2026-10-14', '2026-10-14')`).join(',')};
`;
const replacements = { 'auth.userID': "'fixture-user'", activeProfileId: "'fixture-profile'", includeFamily: 'FALSE', includeLegacyUnscoped: 'FALSE', limit: '12', offset: '0' };
for (const file of ['backend/doku/list.ts', 'backend/doku/list-public.ts']) {
  const source = readFileSync(file, 'utf8');
  const query = source.match(/queryAll<\{[\s\S]*?\}>`([\s\S]*?)`;/)?.[1];
  assert.ok(query, `Could not find list query in ${file}`);
  const sql = query.replace(/\$\{([^}]+)\}/g, (_, key) => {
    assert.ok(key in replacements, `Unexpected SQL parameter: ${key}`);
    return replacements[key];
  });
  const result = spawnSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], { input: `${fixtures}\nSELECT row_to_json(card) FROM (${sql}) card;`, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const cards = result.stdout.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(cards.length, docs.length);
  for (const card of cards) {
    const original = docs[Number(card.id.slice(1))];
    const summary = content => {
      if (typeof content === 'string') {
        try { content = JSON.parse(content); } catch { content = {}; }
      }
      if (typeof content.summary === 'string') return content.summary;
      const text = content.sections?.[0]?.content;
      if (typeof text !== 'string') return undefined;
      const first = text.split('.')[0];
      return first ? `${first}.` : undefined;
    };
    assert.equal(summary(card.content), summary(original));
    const normalized = content => {
      if (typeof content !== 'string') return content;
      try { return JSON.parse(content); } catch { return {}; }
    };
    assert.equal(card.title || normalized(card.content).title || card.topic, card.title || normalized(original).title || card.topic);
    assert.ok(JSON.stringify(card.content).length < 500, 'List query transferred a full article');
  }
  console.log(`${file}: ${cards.length} PostgreSQL fixtures passed; titles and summaries unchanged`);
}
