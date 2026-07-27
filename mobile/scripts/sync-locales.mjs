#!/usr/bin/env node
/**
 * Mirrors the i18n locale bundles from the web workspace so the mobile app shows
 * exactly the same copy in all 7 supported languages.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sourceDir = resolve(here, '../../frontend/src/i18n/locales');
const targetDir = resolve(here, '../src/i18n/locales');

mkdirSync(targetDir, { recursive: true });

let count = 0;
for (const file of readdirSync(sourceDir)) {
  if (!file.endsWith('.json')) continue;
  const raw = readFileSync(join(sourceDir, file), 'utf8');
  JSON.parse(raw); // fail loudly on malformed locale data
  writeFileSync(join(targetDir, file), raw, 'utf8');
  count += 1;
}

console.log(`[sync-locales] Copied ${count} locale bundles to ${targetDir}`);

/**
 * TTS chunking is shared verbatim.
 *
 * `normalizeTTSText()` is the fix for the German/multilingual "missing and
 * repeated sentences" bug (Unicode quotes broke sentence splitting, producing
 * 80-120 word chunks that make CosyVoice drift). It is pure string logic with no
 * browser APIs, so the mobile app mirrors the file instead of reimplementing it —
 * a divergence here silently corrupts audio.
 */
const chunkingSource = resolve(here, '../../frontend/utils/ttsChunking.ts');
const chunkingTarget = resolve(here, '../src/lib/ttsChunking.ts');
const chunkingCode = readFileSync(chunkingSource, 'utf8');

if (/\b(window|document|localStorage|navigator|indexedDB)\b/.test(chunkingCode)) {
  console.error('[sync-locales] FAILED: ttsChunking.ts now references a browser global and is no longer portable.');
  process.exit(1);
}

mkdirSync(dirname(chunkingTarget), { recursive: true });
writeFileSync(
  chunkingTarget,
  '// AUTO-GENERATED — DO NOT EDIT. Mirrored from frontend/utils/ttsChunking.ts by `bun run sync-locales`.\n' +
    chunkingCode,
  'utf8'
);
console.log(`[sync-locales] Mirrored ttsChunking.ts`);

/**
 * Domain types are shared verbatim so the mobile app and the web app agree on
 * the shapes the backend returns (AIModel ids in particular drift often).
 */
// `avatarForm.ts` additionally carries the option catalogues (character types,
// hair/eye colours, special features) and the formData -> visualProfile /
// narrativeProfile builders. Those builders define the exact payload the avatar
// endpoints expect, so the mobile wizard mirrors them instead of reimplementing.
const SHARED_TYPES = ['story.ts', 'avatar.ts', 'doku.ts', 'tavi.ts', 'avatarForm.ts'];
const typesTargetDir = resolve(here, '../src/types');
mkdirSync(typesTargetDir, { recursive: true });

for (const file of SHARED_TYPES) {
  const raw = readFileSync(resolve(here, '../../frontend/types', file), 'utf8');
  writeFileSync(
    join(typesTargetDir, file),
    `// AUTO-GENERATED — DO NOT EDIT. Mirrored from frontend/types/${file} by \`bun run sync-locales\`.\n${raw}`,
    'utf8'
  );
}
console.log(`[sync-locales] Mirrored ${SHARED_TYPES.length} shared type modules`);
