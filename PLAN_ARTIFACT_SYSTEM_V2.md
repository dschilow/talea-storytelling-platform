# 🎁 Artefakt-System V2 - Gamification Upgrade

## Problem-Analyse

### Aktueller Zustand
- Artefakte werden **nach Story-Generierung** automatisch vergeben (nicht nach dem Lesen)
- AI generiert Artefakte, aber oft langweilige Fallbacks: "Glücksbringer", "Kristall", "Amulett"
- Artefakte haben **keine echte Rolle in der Geschichte** - sie sind nur Belohnungen am Ende
- Keine Vielfalt - die KI generiert generische Namen ohne kreative Vorgaben
- Kinder bekommen Artefakte **sofort** nach Story-Generierung, nicht nach dem Lesen

### Ziel: Echte Gamification
1. **100 vordefinierte, kreative Artefakte** mit einzigartigen Namen und Fähigkeiten
2. **Artefakte aktiv in der Geschichte** - Protagonist benutzt das Artefakt
3. **Freischaltung erst nach dem Lesen** - echte Belohnung
4. **Permanente Schatzkammer** - nichts verschwindet
5. **Wiederverwendung in zukünftigen Geschichten** - Gamification-Loop

---

## Neues System: Analog zum Charakter-System (3 Phasen)

Das Artefakt-System folgt **exakt dem bewährten Charakter-Matching-System**:

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1: SKELETON - Artefakt-Anforderung definieren           │
│  ───────────────────────────────────────────────────────────────│
│  • KI generiert Story-Skelett mit {{ARTIFACT_REWARD}} Placeholder│
│  • KI definiert ArtifactRequirement:                           │
│    - Welcher Typ passt? (TOOL, MAGICAL, NATURE, etc.)         │
│    - Welche Fähigkeit wird gebraucht?                          │
│    - In welchem Kapitel soll es gefunden werden?               │
│    - Wie soll es in der Geschichte genutzt werden?             │
│  • ANALOG zu CharacterRequirement bei Charakteren!             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 2: MATCHING - Bestes Artefakt aus Pool auswählen        │
│  ───────────────────────────────────────────────────────────────│
│  • ArtifactMatcher lädt Artefakt-Pool (100 Artefakte)          │
│  • Scoring-Algorithmus bewertet jedes Artefakt:                │
│    - Genre-Affinität (adventure=0.9, fantasy=0.8, etc.)       │
│    - Typ-Match (TOOL für "helfer"-Rolle, etc.)                │
│    - Freshness (kürzlich verwendete Artefakte = Malus)        │
│  • Quality Gate: Score muss Threshold erreichen                │
│  • Tiered Random: Zufällig aus Top-Tier wählen (Vielfalt!)    │
│  • Fallback: Smart Generation wenn kein Match                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 3: FINALISIERUNG - Artefakt aktiv in Story einbauen     │
│  ───────────────────────────────────────────────────────────────│
│  • {{ARTIFACT_REWARD}} wird durch echtes Artefakt ersetzt      │
│  • KI baut Artefakt AKTIV in die Geschichte ein:               │
│    - Discovery Scene: Protagonist FINDET das Artefakt          │
│    - Usage Scene: Protagonist BENUTZT das Artefakt             │
│    - Emotional Connection: "Das gehört jetzt dir!"             │
│  • Artefakt-Bild wird generiert (wie bei Charakteren)          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 4: BELOHNUNG - Freischaltung nach dem Lesen             │
│  ───────────────────────────────────────────────────────────────│
│  • Kind liest die gesamte Geschichte                           │
│  • Nach Kapitel 5 → /story/mark-read API                      │
│  • Artefakt wird freigeschaltet (locked: false)               │
│  • Fullscreen-Celebration: "Du hast [Name] gefunden!"         │
│  • Artefakt erscheint in der Schatzkammer (permanent)         │
└─────────────────────────────────────────────────────────────────┘
```

### Vergleich: Charakter-System vs. Artefakt-System

| Aspekt | Charakter-System | Artefakt-System (NEU) |
|--------|------------------|----------------------|
| **Phase 1** | `CharacterRequirement` mit `{{WISE_ELDER}}` | `ArtifactRequirement` mit `{{ARTIFACT_REWARD}}` |
| **Pool** | `character_pool` Tabelle (DB) | `artifact_pool` Tabelle (DB) |
| **Matching** | `phase2-matcher.ts` + `enhanced-character-matcher.ts` | `artifact-matcher.ts` (NEU) |
| **Scoring** | Genre, Species, Gender, Age, Archetype | Genre, Type, Rarity, Ability, Freshness |
| **Fallback** | `generateSmartCharacter()` | `generateSmartArtifact()` |
| **Integration** | Name wird in Story eingesetzt | Artefakt wird in Story eingebaut |
| **Bild** | Character Image Generation | Artifact Image Generation (existiert!) |

---

## Checkpoint 1: Datenbank-Schema & Artefakt-Pool

### 1.1 Neue Tabelle: `artifact_pool` (analog zu `character_pool`)

```sql
-- backend/story/migrations/XX_create_artifact_pool.up.sql

CREATE TABLE artifact_pool (
  id VARCHAR(36) PRIMARY KEY,

  -- Basis-Informationen (zweisprachig)
  name_de VARCHAR(255) NOT NULL,           -- "Der Mondschein-Kompass"
  name_en VARCHAR(255) NOT NULL,           -- "The Moonlight Compass"
  description_de TEXT NOT NULL,            -- Deutsche Beschreibung
  description_en TEXT NOT NULL,            -- Englische Beschreibung

  -- Kategorisierung
  type VARCHAR(30) NOT NULL,               -- 'TOOL', 'MAGICAL', 'NATURE', 'COMPANION', 'KNOWLEDGE', 'COURAGE'
  rarity VARCHAR(20) NOT NULL DEFAULT 'common',  -- 'common', 'uncommon', 'rare', 'legendary'

  -- Story-Integration (für Phase 3)
  story_role TEXT NOT NULL,                -- "Hilft dem Protagonisten, den Weg zu finden"
  discovery_scenarios TEXT[] NOT NULL,     -- ["In einer alten Truhe", "Am Strand angespült"]
  usage_scenarios TEXT[] NOT NULL,         -- ["Um den Weg zu finden", "Um Gefahren zu erkennen"]

  -- Bildgenerierung
  visual_keywords TEXT[] NOT NULL,         -- ["silver compass", "glowing runes", "moonlight"]

  -- Matching-Scores (Genre-Affinität 0.0 - 1.0)
  genre_adventure DECIMAL(3,2) DEFAULT 0.5,
  genre_fantasy DECIMAL(3,2) DEFAULT 0.5,
  genre_mystery DECIMAL(3,2) DEFAULT 0.5,
  genre_nature DECIMAL(3,2) DEFAULT 0.5,
  genre_friendship DECIMAL(3,2) DEFAULT 0.5,
  genre_courage DECIMAL(3,2) DEFAULT 0.5,
  genre_learning DECIMAL(3,2) DEFAULT 0.5,

  -- Usage-Tracking (wie bei character_pool)
  recent_usage_count INT DEFAULT 0,
  total_usage_count INT DEFAULT 0,
  last_used_at TIMESTAMP,
  last_used_in_story_id VARCHAR(36),

  -- Admin
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index für schnelles Matching
CREATE INDEX idx_artifact_pool_type ON artifact_pool(type);
CREATE INDEX idx_artifact_pool_rarity ON artifact_pool(rarity);
CREATE INDEX idx_artifact_pool_active ON artifact_pool(is_active);
```

### 1.2 TypeScript Interface (analog zu CharacterTemplate)

```typescript
// backend/story/types.ts

export interface ArtifactTemplate {
  id: string;

  // Zweisprachig
  name: { de: string; en: string };
  description: { de: string; en: string };

  // Kategorisierung
  type: 'TOOL' | 'MAGICAL' | 'NATURE' | 'COMPANION' | 'KNOWLEDGE' | 'COURAGE';
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';

  // Story-Integration
  storyRole: string;
  discoveryScenarios: string[];
  usageScenarios: string[];

  // Bildgenerierung
  visualKeywords: string[];

  // Genre-Affinität (0.0 - 1.0)
  genreAffinity: {
    adventure: number;
    fantasy: number;
    mystery: number;
    nature: number;
    friendship: number;
    courage: number;
    learning: number;
  };

  // Tracking
  recentUsageCount: number;
  totalUsageCount: number;
  lastUsedAt?: Date;
}

// Anforderung aus Phase 1 (analog zu CharacterRequirement)
export interface ArtifactRequirement {
  placeholder: string;              // "{{ARTIFACT_REWARD}}"
  preferredType?: string;           // "TOOL", "MAGICAL", etc.
  requiredAbility?: string;         // "navigation", "protection", "healing"
  contextHint: string;              // "Das Abenteuer erfordert einen Wegweiser"
  discoveryChapter: number;         // In welchem Kapitel soll es gefunden werden?
  usageChapter: number;             // In welchem Kapitel wird es benutzt?
  importance: 'high' | 'medium';    // Wie zentral ist das Artefakt für die Story?
}
```

### Artefakt-Kategorien (je 15-20 pro Kategorie)

#### 🛡️ TOOL (Werkzeuge & Hilfsmittel)
| ID | Name (DE) | Name (EN) | Rarity | Story-Rolle |
|----|-----------|-----------|--------|-------------|
| T01 | Der Mondschein-Kompass | The Moonlight Compass | rare | Weist den Weg im Dunkeln |
| T02 | Die Flüster-Muschel | The Whispering Shell | common | Hört Geheimnisse des Meeres |
| T03 | Der Zeitfänger-Sand | The Timecatcher Sand | legendary | Verlangsamt einen Moment |
| T04 | Die Wahrheits-Brille | The Truth Spectacles | uncommon | Sieht durch Illusionen |
| T05 | Der Traumfänger-Ring | The Dreamcatcher Ring | rare | Bewahrt gute Träume |
| T06 | Die Stern-Laterne | The Star Lantern | uncommon | Leuchtet bei Gefahr |
| T07 | Das Echo-Tagebuch | The Echo Journal | common | Erinnert an vergessene Worte |
| T08 | Der Herzschlag-Stein | The Heartbeat Stone | rare | Spürt Freunde in der Nähe |
| T09 | Die Wolken-Feder | The Cloud Feather | uncommon | Macht Sprünge federleicht |
| T10 | Der Rätsel-Würfel | The Puzzle Cube | common | Hilft bei schwierigen Rätseln |

#### ⚡ MAGICAL (Magische Gegenstände)
| ID | Name (DE) | Name (EN) | Rarity | Story-Rolle |
|----|-----------|-----------|--------|-------------|
| M01 | Der Phönix-Funken | The Phoenix Spark | legendary | Entfacht Hoffnung in dunklen Zeiten |
| M02 | Die Schattenkette | The Shadow Chain | rare | Bindet böse Geister |
| M03 | Der Regenbogen-Kristall | The Rainbow Crystal | uncommon | Erschafft Lichtbrücken |
| M04 | Das Unsichtbarkeits-Tuch | The Invisibility Cloth | rare | Verbirgt vor neugierigen Augen |
| M05 | Der Sprachzauber-Anhänger | The Tonguetwist Pendant | uncommon | Versteht alle Sprachen |
| M06 | Die Sturm-Flasche | The Storm Bottle | rare | Kontrolliert kleine Winde |
| M07 | Der Erinnerungs-Spiegel | The Memory Mirror | legendary | Zeigt vergangene Ereignisse |
| M08 | Das Glücks-Kleeblatt | The Lucky Clover | common | Bringt kleines Glück |
| M09 | Der Zauber-Pinsel | The Magic Brush | uncommon | Malt Dinge zum Leben |
| M10 | Die Melodie-Spieluhr | The Melody Music Box | rare | Beruhigt wilde Kreaturen |

#### 🌿 NATURE (Natur-Artefakte)
| ID | Name (DE) | Name (EN) | Rarity | Story-Rolle |
|----|-----------|-----------|--------|-------------|
| N01 | Der Lebensbaum-Samen | The Lifetree Seed | legendary | Lässt Pflanzen wachsen |
| N02 | Die Tier-Sprache-Blume | The Animalspeak Flower | rare | Kommuniziert mit Tieren |
| N03 | Der Wald-Schlüssel | The Forest Key | uncommon | Öffnet geheime Waldpfade |
| N04 | Das Moos-Amulett | The Moss Amulet | common | Heilt kleine Wunden |
| N05 | Die Sonnenblumen-Uhr | The Sunflower Clock | uncommon | Zeigt die beste Zeit für Abenteuer |
| N06 | Der Eichel-Talisman | The Acorn Talisman | common | Gibt Stärke wie ein Baum |
| N07 | Die Feuerfliegen-Ampel | The Firefly Lamp | rare | Leuchtet ohne Feuer |
| N08 | Der Fluss-Stein | The River Stone | uncommon | Findet Wasserquellen |
| N09 | Die Windrose | The Wind Rose | rare | Ruft sanfte Brisen |
| N10 | Das Pilz-Orakel | The Mushroom Oracle | uncommon | Gibt weise Ratschläge |

#### 👥 COMPANION (Begleiter-Artefakte)
| ID | Name (DE) | Name (EN) | Rarity | Story-Rolle |
|----|-----------|-----------|--------|-------------|
| C01 | Das Freundschaftsband | The Friendship Bracelet | common | Verbindet Herzen |
| C02 | Der Beschützer-Bär | The Guardian Bear | rare | Kleiner Teddybär der beschützt |
| C03 | Der Mutmacher-Drache | The Courage Dragon | rare | Miniatur-Drache gibt Mut |
| C04 | Die Treue-Feder | The Loyalty Feather | uncommon | Ruft einen Vogelfreund |
| C05 | Das Kuschel-Schaf | The Cuddle Sheep | common | Beruhigt bei Angst |
| C06 | Der Wächter-Fuchs | The Guardian Fox | rare | Warnt vor Gefahren |
| C07 | Die Weisheits-Eule | The Wisdom Owl | legendary | Gibt kluge Ratschläge |
| C08 | Der Spielkamerad-Hase | The Playmate Rabbit | common | Zaubert Lächeln |
| C09 | Der Trost-Stern | The Comfort Star | uncommon | Leuchtet bei Einsamkeit |
| C10 | Das Abenteuer-Fernglas | The Adventure Spyglass | uncommon | Zeigt spannende Orte |

#### 📖 KNOWLEDGE (Wissens-Artefakte)
| ID | Name (DE) | Name (EN) | Rarity | Story-Rolle |
|----|-----------|-----------|--------|-------------|
| K01 | Das Geschichtenbuch | The Story Book | rare | Enthält unendlich Geschichten |
| K02 | Die Karten-Rolle | The Map Scroll | uncommon | Zeigt unbekannte Orte |
| K03 | Der Zahlen-Zauberstab | The Number Wand | common | Löst Rechenrätsel |
| K04 | Das ABC-Alphabet | The ABC Alphabet | common | Hilft beim Lesen |
| K05 | Die Forscher-Lupe | The Explorer's Magnifier | uncommon | Entdeckt verborgene Details |
| K06 | Das Stern-Atlas | The Star Atlas | rare | Kennt alle Sternbilder |
| K07 | Die Rätsel-Schriftrolle | The Riddle Scroll | uncommon | Enthält kluge Rätsel |
| K08 | Der Geschichte-Erzähler | The Tale Teller | rare | Erzählt alte Legenden |
| K09 | Das Notiz-Blatt | The Note Leaf | common | Vergisst nie etwas |
| K10 | Die Entdecker-Karte | The Discovery Map | legendary | Findet verborgene Schätze |

#### 🦁 COURAGE (Mut-Artefakte)
| ID | Name (DE) | Name (EN) | Rarity | Story-Rolle |
|----|-----------|-----------|--------|-------------|
| B01 | Das Löwenherz-Medaillon | The Lionheart Medallion | rare | Gibt Mut in schweren Zeiten |
| B02 | Der Helden-Umhang | The Hero's Cape | legendary | Macht mutig und stark |
| B03 | Die Tapferkeits-Münze | The Bravery Coin | common | Erinnert an eigene Stärke |
| B04 | Der Schutzschild-Anhänger | The Shield Pendant | uncommon | Schützt vor Angst |
| B05 | Die Stärke-Handschuhe | The Strength Gloves | rare | Geben extra Kraft |
| B06 | Der Entschlossenheits-Ring | The Determination Ring | uncommon | Hilft nicht aufzugeben |
| B07 | Das Vertrauens-Armband | The Trust Bracelet | common | Stärkt Selbstvertrauen |
| B08 | Die Überwindungs-Brücke | The Overcome Bridge | rare | Hilft Hindernisse zu überwinden |
| B09 | Der Furchtlos-Helm | The Fearless Helm | legendary | Vertreibt alle Ängste |
| B10 | Das Standhaft-Amulett | The Steadfast Amulet | uncommon | Gibt innere Ruhe |

---

## Checkpoint 2: Backend - Phase 1 (Skeleton mit Artifact-Requirement)

### 2.1 Änderung: `backend/story/phase1-skeleton.ts`

Die Phase 1 wird erweitert, um neben `CharacterRequirements` auch ein `ArtifactRequirement` zu generieren.

```typescript
// Erweiterung des Phase 1 Prompts

const phase1Prompt = `
... (bestehender Prompt für Story-Skeleton) ...

## ARTIFACT REQUIREMENT - MANDATORY

In addition to character requirements, you MUST define ONE artifact that fits this story.

The artifact should:
- Fit the genre and setting of the story
- Have a clear purpose in the narrative
- Be something the protagonist can FIND and USE

Return in your JSON response:

"artifactRequirement": {
  "placeholder": "{{ARTIFACT_REWARD}}",
  "preferredType": "TOOL" | "MAGICAL" | "NATURE" | "COMPANION" | "KNOWLEDGE" | "COURAGE",
  "requiredAbility": "navigation" | "protection" | "communication" | "healing" | "courage" | "wisdom" | "discovery",
  "contextHint": "Why this type of artifact fits the story",
  "discoveryChapter": 2,  // Chapter number where artifact should be found (1-5)
  "usageChapter": 4,      // Chapter number where artifact should be used (must be > discoveryChapter)
  "importance": "high" | "medium"
}
`;

// Beispiel-Output von Phase 1:
const skeletonExample = {
  title: "Das Geheimnis des alten Waldes",
  chapters: [...],
  supportingCharacterRequirements: [
    { placeholder: "{{WISE_OWL}}", role: "guide", ... }
  ],
  // NEU:
  artifactRequirement: {
    placeholder: "{{ARTIFACT_REWARD}}",
    preferredType: "NATURE",
    requiredAbility: "navigation",
    contextHint: "Der Protagonist verirrt sich im Wald und braucht Hilfe, den Weg zu finden",
    discoveryChapter: 2,
    usageChapter: 4,
    importance: "high"
  }
};
```

---

## Checkpoint 3: Backend - Phase 2 (Artifact Matching)

### 3.1 Neue Datei: `backend/story/artifact-matcher.ts`

Analog zum `phase2-matcher.ts` für Charaktere.

```typescript
// backend/story/artifact-matcher.ts

import { storyDB } from "./db";
import { ArtifactTemplate, ArtifactRequirement } from "./types";

export class ArtifactMatcher {

  /**
   * Hauptmethode: Findet das beste Artefakt für die Anforderung
   */
  async match(
    requirement: ArtifactRequirement,
    genre: string,
    recentStoryIds: string[] = []
  ): Promise<ArtifactTemplate> {

    // 1. Artefakt-Pool aus DB laden
    const pool = await this.loadArtifactPool();

    // 2. Kürzlich verwendete Artefakte laden (für Freshness-Scoring)
    const recentUsage = await this.getRecentArtifactUsage(recentStoryIds);

    // 3. Scoring für jedes Artefakt berechnen
    const scoredCandidates = pool.map(artifact => ({
      artifact,
      score: this.calculateMatchScore(artifact, requirement, genre, recentUsage)
    }));

    // 4. Nach Score sortieren (höchster zuerst)
    scoredCandidates.sort((a, b) => b.score - a.score);

    // 5. Quality Gate prüfen
    const qualityThreshold = 100;  // Minimum-Score
    const validCandidates = scoredCandidates.filter(c => c.score >= qualityThreshold);

    if (validCandidates.length === 0) {
      // Fallback: Smart Generation
      return this.generateSmartArtifact(requirement, genre);
    }

    // 6. Tiered Random Selection (Vielfalt!)
    const topScore = validCandidates[0].score;
    const varianceThreshold = 20;  // Alle innerhalb 20 Punkte des Besten
    const topTier = validCandidates.filter(c => c.score >= topScore - varianceThreshold);

    // Zufällig aus Top-Tier wählen
    const randomIndex = Math.floor(Math.random() * topTier.length);
    const selected = topTier[randomIndex].artifact;

    // 7. Usage-Counter erhöhen
    await this.incrementUsageCounter(selected.id);

    return selected;
  }

  /**
   * Scoring-Algorithmus (analog zu enhanced-character-matcher.ts)
   */
  private calculateMatchScore(
    artifact: ArtifactTemplate,
    requirement: ArtifactRequirement,
    genre: string,
    recentUsage: Map<string, number>
  ): number {
    let score = 0;

    // ===== TYPE MATCHING (30 Punkte) =====
    if (requirement.preferredType) {
      if (artifact.type === requirement.preferredType) {
        score += 30;  // Perfekter Match
      } else if (this.areCompatibleTypes(artifact.type, requirement.preferredType)) {
        score += 15;  // Kompatibler Typ
      }
    } else {
      score += 20;  // Kein Typ-Preference = neutral
    }

    // ===== GENRE AFFINITY (40 Punkte) =====
    const genreKey = genre.toLowerCase() as keyof typeof artifact.genreAffinity;
    const genreScore = artifact.genreAffinity[genreKey] || 0.5;
    score += genreScore * 40;  // 0.0 = 0 Punkte, 1.0 = 40 Punkte

    // ===== ABILITY MATCHING (20 Punkte) =====
    if (requirement.requiredAbility) {
      const abilityMatch = this.matchAbility(artifact, requirement.requiredAbility);
      score += abilityMatch * 20;  // 0.0 - 1.0 → 0 - 20 Punkte
    } else {
      score += 10;  // Keine Ability-Anforderung = neutral
    }

    // ===== FRESHNESS SCORING (±50 Punkte) =====
    const usageCount = recentUsage.get(artifact.id) || 0;
    if (usageCount === 0) {
      score += 30;  // Bonus für noch nie/lange nicht verwendete Artefakte
    } else if (usageCount === 1) {
      score -= 20;  // Leichter Malus für kürzlich verwendet
    } else {
      score -= 50;  // Starker Malus für oft verwendet
    }

    // ===== RARITY BONUS (10 Punkte) =====
    // Seltene Artefakte bekommen kleinen Bonus für Abwechslung
    const rarityBonus = {
      'common': 0,
      'uncommon': 3,
      'rare': 7,
      'legendary': 10
    };
    score += rarityBonus[artifact.rarity] || 0;

    return Math.max(0, score);  // Nie negativ
  }

  /**
   * Prüft ob zwei Typen kompatibel sind
   */
  private areCompatibleTypes(actual: string, required: string): boolean {
    const compatibilityMap: Record<string, string[]> = {
      'TOOL': ['MAGICAL', 'KNOWLEDGE'],
      'MAGICAL': ['TOOL', 'NATURE'],
      'NATURE': ['MAGICAL', 'COMPANION'],
      'COMPANION': ['NATURE', 'COURAGE'],
      'KNOWLEDGE': ['TOOL', 'COURAGE'],
      'COURAGE': ['COMPANION', 'KNOWLEDGE']
    };
    return compatibilityMap[actual]?.includes(required) || false;
  }

  /**
   * Prüft wie gut ein Artefakt zu einer Fähigkeit passt
   */
  private matchAbility(artifact: ArtifactTemplate, ability: string): number {
    const abilityKeywords: Record<string, string[]> = {
      'navigation': ['compass', 'map', 'path', 'way', 'direction', 'guide'],
      'protection': ['shield', 'guard', 'protect', 'safe', 'defend'],
      'communication': ['speak', 'language', 'talk', 'understand', 'voice'],
      'healing': ['heal', 'cure', 'mend', 'restore', 'health'],
      'courage': ['brave', 'courage', 'fear', 'strength', 'hero'],
      'wisdom': ['wise', 'knowledge', 'learn', 'understand', 'answer'],
      'discovery': ['find', 'discover', 'reveal', 'hidden', 'secret']
    };

    const keywords = abilityKeywords[ability] || [];
    const artifactText = [
      artifact.storyRole,
      ...artifact.usageScenarios,
      ...artifact.visualKeywords
    ].join(' ').toLowerCase();

    // Zähle Keyword-Matches
    const matches = keywords.filter(kw => artifactText.includes(kw)).length;
    return Math.min(1.0, matches / 2);  // 2+ Matches = 1.0
  }

  /**
   * Fallback: Generiert ein neues Artefakt wenn kein guter Match
   */
  private generateSmartArtifact(
    requirement: ArtifactRequirement,
    genre: string
  ): ArtifactTemplate {
    // Analog zu generateSmartCharacter()
    // Erstellt ein Artefakt basierend auf den Anforderungen
    // und speichert es im Pool für zukünftige Verwendung

    const id = `auto_artifact_${Date.now()}`;
    const type = requirement.preferredType || 'TOOL';

    // ... Smart-Generierung basierend auf contextHint und requiredAbility

    return {
      id,
      name: { de: "Magischer Gegenstand", en: "Magical Item" },
      description: { de: requirement.contextHint, en: requirement.contextHint },
      type: type as any,
      rarity: 'uncommon',
      storyRole: requirement.contextHint,
      discoveryScenarios: ["Wird während des Abenteuers gefunden"],
      usageScenarios: ["Hilft bei der Lösung des Problems"],
      visualKeywords: ["magical item", "glowing", "ancient"],
      genreAffinity: { adventure: 0.7, fantasy: 0.7, mystery: 0.5, nature: 0.5, friendship: 0.5, courage: 0.5, learning: 0.5 },
      recentUsageCount: 0,
      totalUsageCount: 0
    };
  }

  /**
   * Lädt alle aktiven Artefakte aus der Datenbank
   */
  private async loadArtifactPool(): Promise<ArtifactTemplate[]> {
    const rows = await storyDB.queryAll<any>`
      SELECT * FROM artifact_pool WHERE is_active = TRUE
    `;
    return rows.map(this.rowToArtifactTemplate);
  }

  /**
   * Erhöht den Usage-Counter eines Artefakts
   */
  private async incrementUsageCounter(artifactId: string): Promise<void> {
    await storyDB.exec`
      UPDATE artifact_pool
      SET
        recent_usage_count = recent_usage_count + 1,
        total_usage_count = total_usage_count + 1,
        last_used_at = NOW()
      WHERE id = ${artifactId}
    `;
  }
}

export const artifactMatcher = new ArtifactMatcher();
```

---

## Checkpoint 4: Backend - Phase 3 (Story-Finalisierung mit Artefakt)

### 4.1 Änderung: `backend/story/phase3-finalizer.ts`

Das gematchte Artefakt wird in den Phase 3 Prompt eingefügt.

```typescript
// backend/story/phase3-finalizer.ts

// VORHER: Artefakt wurde komplett von AI generiert
// NACHHER: Artefakt wird aus Pool gematcht und dann integriert

export async function finalizeStory(
  skeleton: StorySkeleton,
  characterAssignments: Map<string, CharacterTemplate>,
  matchedArtifact: ArtifactTemplate,  // NEU: Vom ArtifactMatcher
  config: StoryConfig
): Promise<FinalizedStory> {

  const artifactIntegrationPrompt = `
## ARTIFACT INTEGRATION - MANDATORY

The following artifact MUST be integrated into the story:

### ${matchedArtifact.name.de} (${matchedArtifact.name.en})
- **Type:** ${matchedArtifact.type}
- **Rarity:** ${matchedArtifact.rarity}
- **Description:** ${matchedArtifact.description.de}
- **Story Role:** ${matchedArtifact.storyRole}
- **Discovery Options:** ${matchedArtifact.discoveryScenarios.join(' | ')}
- **Usage Options:** ${matchedArtifact.usageScenarios.join(' | ')}

### INTEGRATION RULES:

1. **DISCOVERY SCENE (Chapter ${skeleton.artifactRequirement.discoveryChapter})**
   - The protagonist MUST find/receive this artifact
   - Make the discovery feel exciting and magical
   - Use one of the discovery scenarios or create a fitting variant

2. **USAGE SCENE (Chapter ${skeleton.artifactRequirement.usageChapter})**
   - The artifact MUST help solve a problem or overcome a challenge
   - The artifact's ability must match: "${matchedArtifact.storyRole}"
   - Show the child how useful and special this artifact is

3. **EMOTIONAL CONNECTION**
   - Create a bond between protagonist and artifact
   - End with: "This artifact now belongs to you!"
   - Hint at future adventures where it might help again

4. **NEVER:**
   - Just mention the artifact without using it
   - Have the artifact be lost or broken
   - Give the artifact to another character

In your JSON response, return the artifact exactly as provided:
"selectedArtifact": {
  "id": "${matchedArtifact.id}",
  "name": "${matchedArtifact.name.de}",
  "nameEn": "${matchedArtifact.name.en}",
  "description": "${matchedArtifact.description.de}",
  "type": "${matchedArtifact.type}",
  "rarity": "${matchedArtifact.rarity}",
  "storyRole": "${matchedArtifact.storyRole}",
  "visualKeywords": ${JSON.stringify(matchedArtifact.visualKeywords)},
  "discoveryChapter": ${skeleton.artifactRequirement.discoveryChapter},
  "usageChapter": ${skeleton.artifactRequirement.usageChapter}
}
`;

  // ... Rest der Phase 3 Finalisierung
}
```

---

## Checkpoint 5: Backend - Orchestrator & Freischaltung

### 5.1 Änderung: `backend/story/four-phase-orchestrator.ts`

```typescript
// Erweiterte Orchestrierung mit Artifact-Matching

async orchestrate(input: OrchestrationInput): Promise<OrchestrationResult> {

  // Phase 0: Fairy Tale Selection (optional)
  // ... bestehendes ...

  // Phase 1: Story Skeleton (ERWEITERT mit ArtifactRequirement)
  const skeleton = await this.phase1Generator.generate(input);
  // skeleton enthält jetzt auch: artifactRequirement

  // Phase 2A: Character Matching (bestehendes System)
  const characterAssignments = await this.phase2Matcher.match(
    skeleton, input.setting, input.recentStoryIds, ...
  );

  // Phase 2B: ARTIFACT MATCHING (NEU!)
  const matchedArtifact = await artifactMatcher.match(
    skeleton.artifactRequirement,
    input.genre,
    input.recentStoryIds
  );

  // Phase 3: Story Finalization (mit Artefakt)
  const finalizedStory = await this.phase3Finalizer.finalize(
    skeleton,
    characterAssignments,
    matchedArtifact,  // NEU: Übergebe gematchtes Artefakt
    input
  );

  // Phase 4: Image Generation
  // ... Chapter Images, Cover Image ...

  // Phase 4.5: Artifact Image Generation (bestehendes System)
  const artifactImageUrl = await this.generateArtifactImage(matchedArtifact);

  // Phase 4.6: NICHT MEHR sofort zu Inventar hinzufügen!
  // VORHER: await addArtifactToInventoryInternal(...)
  // NACHHER: Nur in story.metadata speichern (locked)

  const storyMetadata = {
    ...finalizedStory.metadata,
    pendingArtifact: {
      id: matchedArtifact.id,
      name: matchedArtifact.name.de,
      nameEn: matchedArtifact.name.en,
      description: matchedArtifact.description.de,
      type: matchedArtifact.type,
      rarity: matchedArtifact.rarity,
      storyRole: matchedArtifact.storyRole,
      visualKeywords: matchedArtifact.visualKeywords,
      imageUrl: artifactImageUrl,
      locked: true,           // NEU: Noch nicht freigeschaltet!
      unlockedAt: null,
      discoveryChapter: skeleton.artifactRequirement.discoveryChapter,
      usageChapter: skeleton.artifactRequirement.usageChapter
    }
  };

  // Story speichern
  await this.saveStory(finalizedStory, storyMetadata);

  return { success: true, storyId: finalizedStory.id };
}
```

### 5.2 Änderung: `backend/story/mark-read.ts`

```typescript
// Artefakt-Freischaltung beim Lesen

export const markRead = api(
  { expose: true, method: "POST", path: "/story/mark-read", auth: true },
  async (req: MarkReadRequest): Promise<MarkReadResponse> => {
    const { storyId, userId } = req;

    // Story laden
    const story = await getStoryById(storyId);

    // Prüfen ob Artefakt noch gesperrt ist
    if (story.metadata?.pendingArtifact?.locked) {
      const artifact = story.metadata.pendingArtifact;

      // Artefakt freischalten
      artifact.locked = false;
      artifact.unlockedAt = new Date().toISOString();

      // Zu allen Story-Avataren hinzufügen
      const avatarIds = story.avatarIds || [];
      for (const avatarId of avatarIds) {
        const inventoryItem: InventoryItem = {
          id: crypto.randomUUID(),
          name: artifact.name,
          type: artifact.type || 'TOOL',
          level: 1,
          sourceStoryId: storyId,
          description: artifact.description,
          visualPrompt: artifact.visualKeywords?.join(', ') || '',
          tags: artifact.visualKeywords || [],
          acquiredAt: new Date().toISOString(),
          imageUrl: artifact.imageUrl,
          storyEffect: artifact.storyRole
        };

        await addArtifactToInventoryInternal(avatarId, inventoryItem);
      }

      // Story-Metadata aktualisieren
      await updateStoryMetadata(storyId, {
        pendingArtifact: artifact
      });

      return {
        success: true,
        unlockedArtifact: artifact,  // Gibt freigeschaltetes Artefakt zurück
        message: `Du hast "${artifact.name}" freigeschaltet!`
      };
    }

    // Bereits freigeschaltet oder kein Artefakt
    return {
      success: true,
      unlockedArtifact: story.metadata?.pendingArtifact?.locked === false
        ? story.metadata.pendingArtifact
        : null,
      message: "Story bereits gelesen"
    };
  }
);
```

---

## Checkpoint 6: Frontend-Änderungen

### 3.1 Änderung: `StoryReaderScreen.tsx`

```typescript
// NEU: Artefakt-Celebration NACH dem Lesen

const handleStoryCompletion = async () => {
  setIsCompleting(true);

  try {
    // Mark story as read - dies schaltet das Artefakt frei
    const response = await markRead({ storyId });

    if (response.unlockedArtifact) {
      // CELEBRATION!
      setUnlockedArtifact(response.unlockedArtifact);
      setShowArtifactCelebration(true);

      // Konfetti-Animation
      triggerConfetti();

      // Sound abspielen (optional)
      playArtifactUnlockSound();
    }
  } catch (error) {
    console.error("Failed to mark story as read", error);
  }

  setIsCompleting(false);
};

// Artifact Celebration Modal
{showArtifactCelebration && unlockedArtifact && (
  <ArtifactCelebrationModal
    artifact={unlockedArtifact}
    storyTitle={story.title}
    onClose={() => {
      setShowArtifactCelebration(false);
      navigateToTreasureRoom();
    }}
  />
)}
```

### 3.2 Neue Komponente: `ArtifactCelebrationModal.tsx`

```typescript
// Spezielles Modal für Artefakt-Freischaltung

const ArtifactCelebrationModal: React.FC<Props> = ({ artifact, storyTitle, onClose }) => {
  return (
    <FullscreenModal>
      {/* Konfetti-Regen */}
      <ConfettiAnimation />

      {/* Glowing Artifact Container */}
      <div className="artifact-reveal">
        <div className="glow-ring animate-pulse" />

        {/* Artefakt-Bild */}
        <img
          src={artifact.imageUrl}
          alt={artifact.name}
          className="artifact-image animate-bounce-in"
        />
      </div>

      {/* Text */}
      <h1 className="text-3xl font-bold text-gold animate-fade-in">
        🎉 Du hast etwas Besonderes gefunden! 🎉
      </h1>

      <h2 className="text-2xl text-white">
        {artifact.name}
      </h2>

      <p className="text-gray-300">
        {artifact.description}
      </p>

      <div className="story-connection">
        <p className="text-sm italic">
          "Aus der Geschichte: {storyTitle}"
        </p>
      </div>

      {/* Rarity Badge */}
      <RarityBadge rarity={artifact.rarity} />

      {/* CTA Buttons */}
      <button onClick={onClose} className="btn-primary">
        In die Schatzkammer legen ✨
      </button>

      <button onClick={() => shareArtifact(artifact)} className="btn-secondary">
        Mit Freunden teilen 🎁
      </button>
    </FullscreenModal>
  );
};
```

### 3.3 Verbesserung: `TreasureRoom.tsx`

```typescript
// Erweiterte Schatzkammer mit besserer Darstellung

const TreasureRoom: React.FC = () => {
  const [artifacts, setArtifacts] = useState<InventoryItem[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<InventoryItem | null>(null);
  const [filter, setFilter] = useState<ArtifactType | 'all'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'rarity' | 'type'>('date');

  return (
    <div className="treasure-room">
      {/* Header mit Statistiken */}
      <header>
        <h1>🏰 Deine Schatzkammer</h1>
        <div className="stats">
          <span>📦 {artifacts.length} Schätze</span>
          <span>⭐ {legendaryCount} Legendäre</span>
          <span>🎭 {uniqueTypes} Typen</span>
        </div>
      </header>

      {/* Filter & Sort */}
      <div className="filters">
        <TypeFilter value={filter} onChange={setFilter} />
        <SortSelector value={sortBy} onChange={setSortBy} />
      </div>

      {/* Artifact Grid */}
      <div className="artifact-grid">
        {filteredArtifacts.map(artifact => (
          <ArtifactCard
            key={artifact.id}
            artifact={artifact}
            onClick={() => setSelectedArtifact(artifact)}
          />
        ))}
      </div>

      {/* Empty State */}
      {artifacts.length === 0 && (
        <EmptyTreasureRoom />
      )}

      {/* Detail Modal */}
      {selectedArtifact && (
        <ArtifactDetailModal
          artifact={selectedArtifact}
          onClose={() => setSelectedArtifact(null)}
          onUseInStory={() => navigateToStoryCreator(selectedArtifact)}
        />
      )}
    </div>
  );
};
```

---

## Checkpoint 4: Story-Generierung mit aktivem Artefakt

### 4.1 Prompt-Erweiterung für Phase 3

```typescript
// Der AI-Prompt muss das Artefakt AKTIV einbauen

const storyIntegrationPrompt = `
## ARTIFACT STORY INTEGRATION

The chosen artifact "${chosenArtifact.name.de}" must be woven into the story naturally:

### Discovery Scene (Chapter 1-2)
- The protagonist must FIND or RECEIVE the artifact
- Options: ${chosenArtifact.discoveryScenarios.join(', ')}
- Make the discovery feel magical and exciting for the child

### Usage Scene (Chapter 3-4)
- The artifact MUST be USED to solve a problem or overcome an obstacle
- Options: ${chosenArtifact.usageScenarios.join(', ')}
- Show the child reading that the artifact is powerful and useful

### Connection to Protagonist
- The artifact should feel PERSONAL to the main character
- Create an emotional connection ("Das gehört jetzt dir!")
- Hint that this artifact will be useful in future adventures

### Rules:
1. The artifact appears in at least 2 chapters
2. The artifact's abilities must match its description
3. The protagonist ACTIVELY uses the artifact (not just carries it)
4. Other characters can comment on how special the artifact is
`;
```

### 4.2 Beispiel einer generierten Geschichte mit Artefakt

```
📖 "Das Geheimnis des Mondschein-Kompasses"

🌙 Kapitel 1: Der Fund
Lena fand die alte Truhe auf dem Dachboden ihrer Großmutter. Darin lag ein
silberner Kompass, der sanft im Mondlicht leuchtete...

🧭 Kapitel 2: Das Geheimnis
"Dieser Kompass gehörte deinem Urgroßvater", erklärte Oma. "Er zeigt nicht
nach Norden - er zeigt dorthin, wo du am meisten gebraucht wirst."

🌲 Kapitel 3: Die Prüfung
Im dunklen Wald hatte Lena sich verlaufen. Sie holte den Mondschein-Kompass
hervor. Die Nadel leuchtete golden auf und zeigte einen versteckten Pfad...

🦊 Kapitel 4: Die Rettung
Der Kompass führte Lena zu einem verletzten Fuchs. Dank des Kompasses
konnte sie den kleinen Fuchs rechtzeitig finden und ihm helfen.

🏠 Kapitel 5: Das Versprechen
"Du hast den Kompass würdig verwendet", sagte Oma stolz. "Er gehört jetzt
dir. Wer weiß, welche Abenteuer noch auf dich warten..."

🎁 FREIGESCHALTET: Der Mondschein-Kompass
"Zeigt dir immer den richtigen Weg, wenn du ihn am meisten brauchst."
```

---

## Checkpoint 5: Zukünftige Erweiterungen (Phase 2)

### 5.1 Artefakt-Wiederverwendung in neuen Stories

```typescript
// Bei Story-Erstellung: "Mit welchem Artefakt möchtest du spielen?"

interface StoryCreationWithArtifact {
  selectedArtifact?: string;  // ID aus Inventory

  // Der Prompt wird erweitert:
  // "Der Protagonist hat bereits [Artefakt].
  //  Baue ein neues Abenteuer, in dem dieses Artefakt hilft."
}
```

### 5.2 Artefakt-Sammel-Achievements

```typescript
// Achievements für Artefakt-Sammlung
const ARTIFACT_ACHIEVEMENTS = [
  { id: "first_artifact", name: "Erster Schatz", requirement: 1 },
  { id: "collector_10", name: "Schatzkammer-Anfänger", requirement: 10 },
  { id: "collector_25", name: "Schatzkammer-Entdecker", requirement: 25 },
  { id: "collector_50", name: "Schatzkammer-Meister", requirement: 50 },
  { id: "all_types", name: "Vielseitiger Sammler", requirement: "alle Typen" },
  { id: "legendary_hunter", name: "Legendenjäger", requirement: "5 Legendäre" },
];
```

### 5.3 Artefakt-Evolution durch Nutzung

```typescript
// Artefakte entwickeln sich durch Verwendung in Stories
interface ArtifactEvolution {
  usageCount: number;       // Wie oft in Stories verwendet
  level: 1 | 2 | 3;        // Steigt mit Nutzung
  evolvedAbilities: string[]; // Neue Fähigkeiten bei Level-Up
}
```

---

## Implementierungs-Reihenfolge (Analog zum Charakter-System)

### Phase A: Datenbank & Pool (Checkpoint 1)
| # | Datei | Beschreibung | Aufwand |
|---|-------|--------------|---------|
| 1 | `backend/story/migrations/XX_create_artifact_pool.up.sql` | Neue Tabelle `artifact_pool` | Klein |
| 2 | `backend/story/migrations/XX_seed_artifact_pool.up.sql` | 100 Artefakte einfügen | Mittel |
| 3 | `backend/story/types.ts` | `ArtifactTemplate` & `ArtifactRequirement` Types | Klein |

### Phase B: Backend Phase 1 - Skeleton (Checkpoint 2)
| # | Datei | Beschreibung | Aufwand |
|---|-------|--------------|---------|
| 4 | `backend/story/phase1-skeleton.ts` | Prompt erweitern für `artifactRequirement` | Mittel |

### Phase C: Backend Phase 2 - Matching (Checkpoint 3)
| # | Datei | Beschreibung | Aufwand |
|---|-------|--------------|---------|
| 5 | `backend/story/artifact-matcher.ts` | **NEUE DATEI** - Matching-Logik analog zu `phase2-matcher.ts` | Groß |

### Phase D: Backend Phase 3 - Finalisierung (Checkpoint 4)
| # | Datei | Beschreibung | Aufwand |
|---|-------|--------------|---------|
| 6 | `backend/story/phase3-finalizer.ts` | Artefakt-Integration-Prompt hinzufügen | Mittel |

### Phase E: Backend Orchestrator & Freischaltung (Checkpoint 5)
| # | Datei | Beschreibung | Aufwand |
|---|-------|--------------|---------|
| 7 | `backend/story/four-phase-orchestrator.ts` | Artifact-Matching einbinden, `pendingArtifact` statt sofort speichern | Mittel |
| 8 | `backend/story/mark-read.ts` | Freischaltung nach dem Lesen | Mittel |

### Phase F: Frontend (Checkpoint 6)
| # | Datei | Beschreibung | Aufwand |
|---|-------|--------------|---------|
| 9 | `frontend/components/gamification/ArtifactCelebrationModal.tsx` | Celebration nach Freischaltung | Mittel |
| 10 | `frontend/screens/Story/StoryReaderScreen.tsx` | Integration der Celebration | Klein |
| 11 | `frontend/components/gamification/TreasureRoom.tsx` | Verbesserte Darstellung (optional) | Klein |

### Phase G: Testen & Feinschliff
| # | Test | Beschreibung |
|---|------|--------------|
| 12 | E2E-Test | Story generieren → Skeleton hat `artifactRequirement` |
| 13 | E2E-Test | Artifact-Matcher wählt passendes Artefakt |
| 14 | E2E-Test | Story enthält Artefakt aktiv in 2+ Kapiteln |
| 15 | E2E-Test | Nach dem Lesen → Artefakt wird freigeschaltet |
| 16 | E2E-Test | Schatzkammer zeigt alle gesammelten Artefakte |

---

## Erfolgskriterien

| Kriterium | Aktuell | Ziel |
|-----------|---------|------|
| Artefakt-Vielfalt | ~5 generische | **100 einzigartige** |
| Story-Integration | Nicht vorhanden | **Aktive Rolle in 2+ Kapiteln** |
| Auswahlmethode | KI generiert beliebig | **Matching aus Pool (wie Charaktere)** |
| Freischaltung | Sofort nach Generierung | **Nach dem Lesen** |
| Kind-Engagement | Niedrig | **Hoch (Sammeln, Entdecken)** |
| Permanenz | Unklar | **Immer in Schatzkammer** |
| Abwechslung | Gleiche Artefakte | **Freshness-Scoring verhindert Wiederholung** |

---

## Vergleich: Alt vs. Neu

```
ALTES SYSTEM:
┌─────────────────────────────────────────────────────────┐
│ Story-Generierung → KI erfindet beliebiges Artefakt   │
│                   → Artefakt nur am Ende erwähnt       │
│                   → Sofort in Inventar gespeichert     │
│                   → Oft: "Glücksbringer", "Kristall"   │
└─────────────────────────────────────────────────────────┘

NEUES SYSTEM (Analog zu Charakteren):
┌─────────────────────────────────────────────────────────┐
│ Phase 1: KI definiert ArtifactRequirement              │
│          "Ich brauche ein NATURE-Artefakt für          │
│           Navigation, gefunden in Kapitel 2"           │
├─────────────────────────────────────────────────────────┤
│ Phase 2: Artifact-Matcher wählt aus Pool               │
│          Score: Genre + Type + Ability + Freshness     │
│          → "Der Mondschein-Kompass" (Score: 87)        │
├─────────────────────────────────────────────────────────┤
│ Phase 3: KI baut Artefakt AKTIV in Story ein           │
│          Kapitel 2: Protagonist findet Kompass         │
│          Kapitel 4: Kompass hilft, den Weg zu finden   │
├─────────────────────────────────────────────────────────┤
│ Freischaltung: Erst nach dem LESEN der Story           │
│                → Celebration Modal                      │
│                → In Schatzkammer (permanent)           │
└─────────────────────────────────────────────────────────┘
```

---

## Nächste Schritte nach Genehmigung

1. **Datenbank-Migration** erstellen (`artifact_pool` Tabelle)
2. **100 Artefakte** definieren und als Seed-Migration einfügen
3. **`artifact-matcher.ts`** implementieren (Kernstück!)
4. **Phase 1-3** anpassen für Artefakt-Integration
5. **Orchestrator** erweitern
6. **mark-read** für Freischaltung anpassen
7. **Frontend-Celebration** implementieren
8. **Testen** E2E

**Geschätzter Gesamtaufwand:** 8-12 Arbeitsstunden

---

**Bereit für dein Feedback!**

Soll ich:
- [ ] Änderungen am Plan vornehmen?
- [ ] Mit der Implementierung beginnen?
- [ ] Bestimmte Teile genauer erklären?
