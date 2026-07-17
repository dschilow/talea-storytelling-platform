-- Artifact Treasury System ("Schatzkammer 2.0")
--
-- Pillars implemented by this migration:
--   1. Themed artifact sets (Panini-style collections with a legendary "crown"
--      reward that is only granted when every other set member is owned).
--   2. Travel journal (Reisetagebuch): every found/journey/level-up event of an
--      artifact per avatar becomes a story-linked diary entry.
--   3. Fundstücke (shards): completion currency. Stories whose plot did not
--      embrace the cast artifact award shards instead; 5 shards can be
--      exchanged for a pick-1-of-3 artifact choice.
--   4. story_artifacts learns who brought an artifact along (Mitnehmen-Loop)
--      and how present the artifact was in the story.

-- ---------------------------------------------------------------------------
-- 1) Sets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS artifact_sets (
    id TEXT PRIMARY KEY,
    name_de TEXT NOT NULL,
    name_en TEXT NOT NULL,
    description_de TEXT NOT NULL DEFAULT '',
    description_en TEXT NOT NULL DEFAULT '',
    emoji TEXT,
    accent_color TEXT,
    crown_artifact_id TEXT REFERENCES artifact_pool(id),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE artifact_pool ADD COLUMN IF NOT EXISTS set_id TEXT REFERENCES artifact_sets(id);
CREATE INDEX IF NOT EXISTS idx_artifact_pool_set ON artifact_pool(set_id);

INSERT INTO artifact_sets (id, name_de, name_en, description_de, description_en, emoji, accent_color, crown_artifact_id, sort_order) VALUES
    ('set_explorers', 'Die Weltensucher', 'The Pathfinders',
     'Karten, Kompasse und alles, was neue Wege zeigt.', 'Maps, compasses and everything that reveals new paths.',
     '🗺️', '#b98a4b', 'artifact_008', 1),
    ('set_detectives', 'Die Spurenleser', 'The Clue Seekers',
     'Lupen, Linsen und Werkzeuge für wache Augen.', 'Lenses and tools for sharp eyes.',
     '🔍', '#7d8a5a', 'artifact_017', 2),
    ('set_dragons', 'Glutherz', 'Emberheart',
     'Feuer, Funken und Drachenkraft.', 'Fire, sparks and dragon power.',
     '🐉', '#c26b4b', 'artifact_027', 3),
    ('set_storm', 'Frost & Sturm', 'Frost & Storm',
     'Eis, Wind und Wetterzauber.', 'Ice, wind and weather magic.',
     '❄️', '#6b93b8', 'artifact_066', 4),
    ('set_hearts', 'Herzlicht', 'Heartlight',
     'Alles, was Freundschaft und Familie stärkt.', 'Everything that strengthens friendship and family.',
     '💗', '#c5828c', 'artifact_042', 5),
    ('set_courage', 'Die Mutmacher', 'The Braveheart Kit',
     'Schätze gegen Angst, Wut und traurige Tage.', 'Treasures against fear, anger and sad days.',
     '🦁', '#be8f55', 'artifact_089', 6),
    ('set_nature', 'Die Naturhüter', 'The Nature Keepers',
     'Kräuter, Steine und die Kraft der Erde.', 'Herbs, stones and the power of the earth.',
     '🌿', '#527b70', 'artifact_026', 7),
    ('set_night', 'Nachtlichter', 'Nightlights',
     'Träume, Schatten und geheimnisvolle Nächte.', 'Dreams, shadows and mysterious nights.',
     '🌙', '#5f78a0', 'artifact_082', 8),
    ('set_wisdom', 'Die Weisen', 'The Sages',
     'Bücher, Wissen und kluge Gedanken.', 'Books, knowledge and clever thoughts.',
     '📚', '#8e7daf', 'artifact_088', 9),
    ('set_magic', 'Die Zauberwerkstatt', 'The Spell Workshop',
     'Tränke, Zauberkreise und magisches Handwerk.', 'Potions, spell circles and magical craft.',
     '⚗️', '#8a6ca8', 'artifact_052', 10),
    ('set_treasure', 'Funkelschätze', 'Glitter Hoard',
     'Glänzendes, Glück und sagenhafte Kostbarkeiten.', 'Shiny things, luck and fabled valuables.',
     '💎', '#9b7138', 'artifact_003', 11)
ON CONFLICT (id) DO NOTHING;

-- Set membership (crown artifacts belong to their set too).
UPDATE artifact_pool SET set_id = 'set_explorers' WHERE id IN
    ('artifact_080','artifact_097','artifact_060','artifact_012','artifact_025','artifact_056','artifact_008') AND set_id IS NULL;
UPDATE artifact_pool SET set_id = 'set_detectives' WHERE id IN
    ('artifact_098','artifact_030','artifact_077','artifact_076','artifact_005','artifact_017') AND set_id IS NULL;
UPDATE artifact_pool SET set_id = 'set_dragons' WHERE id IN
    ('artifact_014','artifact_065','artifact_078','artifact_051','artifact_027') AND set_id IS NULL;
UPDATE artifact_pool SET set_id = 'set_storm' WHERE id IN
    ('artifact_021','artifact_050','artifact_002','artifact_034','artifact_006','artifact_066') AND set_id IS NULL;
UPDATE artifact_pool SET set_id = 'set_hearts' WHERE id IN
    ('artifact_039','artifact_092','artifact_093','artifact_094','artifact_033','artifact_070','artifact_042') AND set_id IS NULL;
UPDATE artifact_pool SET set_id = 'set_courage' WHERE id IN
    ('artifact_087','artifact_071','artifact_028','artifact_029','artifact_072','artifact_073','artifact_040','artifact_089') AND set_id IS NULL;
UPDATE artifact_pool SET set_id = 'set_nature' WHERE id IN
    ('artifact_019','artifact_062','artifact_010','artifact_049','artifact_064','artifact_022','artifact_035','artifact_026') AND set_id IS NULL;
UPDATE artifact_pool SET set_id = 'set_night' WHERE id IN
    ('artifact_095','artifact_016','artifact_043','artifact_061','artifact_057','artifact_041','artifact_059','artifact_007','artifact_082') AND set_id IS NULL;
UPDATE artifact_pool SET set_id = 'set_wisdom' WHERE id IN
    ('artifact_004','artifact_055','artifact_079','artifact_031','artifact_091','artifact_048','artifact_011','artifact_088') AND set_id IS NULL;
UPDATE artifact_pool SET set_id = 'set_magic' WHERE id IN
    ('artifact_044','artifact_054','artifact_081','artifact_038','artifact_047','artifact_024','artifact_085','artifact_052') AND set_id IS NULL;
UPDATE artifact_pool SET set_id = 'set_treasure' WHERE id IN
    ('artifact_032','artifact_083','artifact_036','artifact_023','artifact_001','artifact_058','artifact_046','artifact_003') AND set_id IS NULL;

-- ---------------------------------------------------------------------------
-- 2) Travel journal
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS artifact_journal (
    id TEXT PRIMARY KEY,
    avatar_id TEXT NOT NULL,
    artifact_id TEXT NOT NULL REFERENCES artifact_pool(id),
    story_id TEXT,
    story_title TEXT,
    -- 'found' | 'journey' | 'levelup' | 'set_crown' | 'shard_choice'
    event TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_artifact_journal_avatar ON artifact_journal(avatar_id, artifact_id, created_at DESC);
-- One journal entry per (avatar, artifact, story, event); NULL story ids stay insertable.
CREATE UNIQUE INDEX IF NOT EXISTS idx_artifact_journal_unique_story_event
    ON artifact_journal(avatar_id, artifact_id, story_id, event)
    WHERE story_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3) Fundstücke (shards) + pick-1-of-3 offers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS avatar_artifact_shards (
    avatar_id TEXT PRIMARY KEY,
    shards INTEGER NOT NULL DEFAULT 0,
    total_earned INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS artifact_shard_offers (
    id TEXT PRIMARY KEY,
    avatar_id TEXT NOT NULL,
    artifact_ids TEXT[] NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    redeemed_at TIMESTAMP,
    redeemed_artifact_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_artifact_shard_offers_avatar
    ON artifact_shard_offers(avatar_id) WHERE redeemed_at IS NULL;

-- Idempotent shard grants per (avatar, story).
CREATE TABLE IF NOT EXISTS avatar_shard_grants (
    avatar_id TEXT NOT NULL,
    story_id TEXT NOT NULL,
    amount INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (avatar_id, story_id)
);

-- ---------------------------------------------------------------------------
-- 4) story_artifacts extensions (Mitnehmen-Loop + presence)
-- ---------------------------------------------------------------------------
ALTER TABLE story_artifacts ADD COLUMN IF NOT EXISTS presence TEXT NOT NULL DEFAULT 'central';
ALTER TABLE story_artifacts ADD COLUMN IF NOT EXISTS brought_by_avatar_id TEXT;
