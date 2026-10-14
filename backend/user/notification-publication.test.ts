import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import type { NotificationItem } from './notification-model';
// URL imports also allow Node's native TypeScript runner as a Windows fallback.
const { applyNotificationState } = await import(new URL('./notification-model.ts', import.meta.url).href);
const { splitMigrationStatements } = await import(new URL('../health/migration-order.ts', import.meta.url).href);

// Opt-in integration suite, isolated in a temporary schema on local PostgreSQL.
const databaseUrl = process.env.NOTIFICATION_TEST_DATABASE_URL;
const { Client } = createRequire(import.meta.url)('pg');
describe('catalog publication notifications (PostgreSQL)', { skip: !databaseUrl }, () => {
  const schema = `notification_qa_${crypto.randomUUID().replaceAll('-', '')}`;
  let client: {
    connect(): Promise<void>;
    query(sql: string, values?: unknown[]): Promise<{ rows: any[] }>;
    end(): Promise<void>;
  };
  const oldDate = new Date('2025-01-01T12:00:00Z');
  const audioMigration = new URL('../doku/migrations/8_audio_publication_time.up.sql', import.meta.url);
  const characterMigration = new URL('../story/migrations/42_character_publication_time.up.sql', import.meta.url);

  async function migrate(file: URL) {
    // Use the same statement splitter as Railway, including the trigger bodies.
    for (const statement of splitMigrationStatements(await readFile(file, 'utf8'))) await client.query(statement);
  }
  async function query<T = Record<string, any>>(text: string, values: unknown[] = []): Promise<T[]> {
    return (await client.query(text, values)).rows;
  }
  async function addAudio(id: string, isPublic: boolean, audioUrl = 'bucket://episode.mp3') {
    await query(`INSERT INTO audio_dokus (id, user_id, title, description, audio_url, is_public, created_at)
      VALUES ($1, 'test-owner', $1, 'Test episode', $2, $3, $4)`, [id, audioUrl, isPublic, oldDate.toISOString()]);
  }
  async function visibleAudio() {
    return query<{ id: string; published_at: Date }>(`SELECT id, published_at FROM audio_dokus
      WHERE is_public = TRUE AND BTRIM(audio_url) <> '' AND published_at >= CURRENT_TIMESTAMP - INTERVAL '90 days'`);
  }

  before(async () => {
    assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(databaseUrl!).hostname), 'Use local PostgreSQL for this suite.');
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
    // schema contains only a fixed prefix and UUID hex digits.
    await query(`CREATE SCHEMA "${schema}"`);
    await query(`SET search_path TO "${schema}"`);
    await query(await readFile(new URL('../doku/migrations/3_create_audio_dokus.up.sql', import.meta.url), 'utf8'));
    await query(`CREATE TABLE character_pool (id TEXT PRIMARY KEY, is_active BOOLEAN DEFAULT TRUE,
      image_url TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await addAudio('legacy-public', true);
    await addAudio('legacy-private', false);
    await migrate(audioMigration);
    await migrate(characterMigration);
  });
  after(async () => {
    if (!client) return;
    try { await query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); }
    finally { await client.end(); }
  });

  it('backfills public episodes with their original date and leaves drafts unpublished', async () => {
    const rows = await query<{ id: string; published_at: Date | null }>('SELECT id, published_at FROM audio_dokus ORDER BY id');
    assert.equal(rows.find((row) => row.id === 'legacy-public')?.published_at?.toISOString(), oldDate.toISOString());
    assert.equal(rows.find((row) => row.id === 'legacy-private')?.published_at, null);
    assert.equal((await visibleAudio()).length, 0);
  });

  it('discovers an old private episode when it is published, after a read-all snapshot', async () => {
    const [{ snapshot }] = await query<{ snapshot: Date }>("SELECT clock_timestamp() - INTERVAL '1 second' AS snapshot");
    await query("UPDATE audio_dokus SET is_public = TRUE WHERE id = 'legacy-private'");
    const row = (await visibleAudio()).find((entry) => entry.id === 'legacy-private');
    assert.ok(row);
    assert.ok(row.published_at > snapshot);
    const item: NotificationItem = { id: `audio:${row.id}`, kind: 'audio', title: row.id, body: '',
      createdAt: row.published_at.toISOString(), pinned: false, read: false, archived: false, managed: false };
    assert.equal(applyNotificationState([item], [], snapshot)[0].read, false);
  });

  it('stamps public uploads immediately but waits for audio on unfinished episodes', async () => {
    await addAudio('direct-public', true);
    await addAudio('no-audio', true, '   ');
    assert.ok((await visibleAudio()).some((row) => row.id === 'direct-public'));
    assert.ok(!(await visibleAudio()).some((row) => row.id === 'no-audio'));
    await query("UPDATE audio_dokus SET audio_url = 'bucket://ready.mp3' WHERE id = 'no-audio'");
    assert.ok((await visibleAudio()).some((row) => row.id === 'no-audio'));
  });

  it('withdraws hidden content and preserves publication and read identity across edits and re-publishing', async () => {
    const [original] = await query<{ published_at: Date }>("SELECT published_at FROM audio_dokus WHERE id = 'direct-public'");
    await query("UPDATE audio_dokus SET title = 'Edited', audio_url = 'bucket://edited.mp3', is_public = FALSE WHERE id = 'direct-public'");
    assert.ok(!(await visibleAudio()).some((row) => row.id === 'direct-public'));
    await query("UPDATE audio_dokus SET is_public = TRUE WHERE id = 'direct-public'");
    assert.equal((await visibleAudio()).find((row) => row.id === 'direct-public')?.published_at.toISOString(), original.published_at.toISOString());
  });

  it('discovers characters only after activation and a ready image, including older drafts', async () => {
    await query("INSERT INTO character_pool (id, is_active, created_at) VALUES ('no-image', TRUE, $1)", [oldDate.toISOString()]);
    await query("INSERT INTO character_pool (id, is_active, image_url, created_at) VALUES ('inactive', FALSE, 'bucket://cover.png', $1)", [oldDate.toISOString()]);
    const before = await query('SELECT published_at FROM character_pool');
    assert.ok(before.every((row) => row.published_at === null));
    await query("UPDATE character_pool SET image_url = 'bucket://ready.png' WHERE id = 'no-image'");
    await query("UPDATE character_pool SET is_active = TRUE WHERE id = 'inactive'");
    const ready = await query(`SELECT id FROM character_pool WHERE is_active = TRUE AND BTRIM(image_url) <> ''
      AND published_at >= CURRENT_TIMESTAMP - INTERVAL '90 days'`);
    assert.deepEqual(ready.map((row) => row.id).sort(), ['inactive', 'no-image']);
  });

  it('can re-run the migrations without turning old entries into new notifications', async () => {
    const original = await query('SELECT id, published_at FROM audio_dokus ORDER BY id');
    await migrate(audioMigration);
    await migrate(characterMigration);
    assert.deepEqual(await query('SELECT id, published_at FROM audio_dokus ORDER BY id'), original);
  });

  it('can roll both migrations back and apply them again', async () => {
    await migrate(new URL('../doku/migrations/8_audio_publication_time.down.sql', import.meta.url));
    await migrate(new URL('../story/migrations/42_character_publication_time.down.sql', import.meta.url));
    await migrate(audioMigration);
    await migrate(characterMigration);
    const [row] = await query("SELECT published_at FROM audio_dokus WHERE id = 'direct-public'");
    assert.ok(row.published_at);
  });
});
