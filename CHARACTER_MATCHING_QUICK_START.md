# Quick Start: Optimierte Character Matching

## ⚡ Schnellstart (5 Minuten)

### 1. Code deployen
```bash
# Backend neu deployen (Railway, Encore, oder lokal)
encore run
```

### 2. Optional: Datenbank-Migration
```bash
# Nur wenn du Tags nutzen willst (empfohlen für beste Ergebnisse)
psql -h <host> -U <user> -d <database> -f backend/migrations/add_character_tags.sql
```

### 3. Erste Story generieren
Erstelle eine Story und beobachte:
- ✅ Kapitel sind jetzt kürzer (50-70 Wörter)
- ✅ Charaktere passen besser zur Beschreibung
- ✅ Verschiedene Charaktere in jeder Story

---

## 🔍 Was hat sich geändert?

### Für Story-Creator (User-Perspective):
**Vorher**: 
- Geschichten hatten oft die gleichen Charaktere
- Charaktere passten nicht immer zur Beschreibung
- Hirsch statt Hund, etc.

**Jetzt**:
- ✅ Jede Story hat verschiedene Charaktere
- ✅ Charaktere passen visuell zur Skeleton-Beschreibung
- ✅ Mehr Vielfalt in Species/Typen

### Für Entwickler:
**Neue Felder**:
```typescript
// In CharacterRequirement und ChapterSkeleton:
visualHints?: string; // "aelterer Mensch, Arzt, Brille"
```

**Neue Scoring-Parameter**:
```typescript
// Phase 2 Matcher bewertet jetzt:
- Visual Hints (100 Punkte) ← NEU
- Species Diversity (30 Punkte) ← NEU  
- Freshness (50 statt 40 Punkte) ← ERHÖHT
```

---

## 📊 Monitoring & Debugging

### 1. Phase 1 Validation
```bash
# Prüfe Console Logs für:
[Phase1] ⚠️ Chapter X word count 78 outside target range (50-70). CRITICAL!
```
→ Falls das auftritt, ist der Prompt nicht strikt genug gefolgt worden.

### 2. Phase 2 Matching Scores
```bash
# Prüfe Console Logs für:
[Phase2] Match details for {{WISE_ELDER}}:
{
  character: "Frau Müller",
  totalScore: 450,
  breakdown: {
    roleExact: 100,
    visual: 80,
    freshness: 50,
    diversity: 30
  }
}
```
→ `visual` Score zeigt an, wie gut visuelle Hints gematcht wurden

### 3. Token-Verbrauch
```bash
# Prüfe OpenAI Usage in Logs:
Phase 1: ~4500 tokens (vorher ~6400)
Phase 4: ~200 tokens pro Bild (vorher ~500)
```

---

## 🐛 Troubleshooting

### Problem: Charaktere passen immer noch nicht
**Lösung**: 
1. Prüfe ob `visualHints` im Skeleton generiert wurden
2. Erhöhe Visual Matching Score-Weight in `phase2-matcher.ts`
3. Führe Migration aus für bessere Tags

### Problem: Immer noch gleiche Charaktere
**Lösung**:
1. Prüfe `recentUsageCount` in DB - muss hochzählen
2. Erhöhe Freshness-Penalty in Matching
3. Reduziere `recentStoryCount` Parameter

### Problem: Kapitel zu lang
**Lösung**:
- AI Model ignoriert den Prompt → Validierung wirft jetzt Error
- Prüfe ob Reasoning-Model (gpt-5) verwendet wird

---

## 🎯 Best Practices

### 1. Character Pool pflegen
```sql
-- Regelmäßig ungenutzte Charaktere prüfen:
SELECT name, total_usage_count, recent_usage_count
FROM character_pool
WHERE recent_usage_count = 0
ORDER BY total_usage_count ASC;
```

### 2. Vielfalt überwachen
```sql
-- Prüfe Species-Verteilung:
SELECT 
  (visual_profile->>'species') as species,
  COUNT(*) as usage_count
FROM character_pool
JOIN story_characters ON character_pool.id = story_characters.character_id
GROUP BY species
ORDER BY usage_count DESC;
```

### 3. Token-Optimierung
- Phase 1: Max 4500 tokens
- Phase 4: Max 200 tokens pro Bild
- Falls höher: Prüfe Prompt-Länge

---

## 🚀 Erweiterte Features (Optional)

### A) Custom Visual Keywords hinzufügen
```typescript
// In phase2-matcher.ts → extractVisualKeywords()
const animals = [..., "einhorn", "phoenix"]; // Neue Tiere
const professions = [..., "astronaut", "pilot"]; // Neue Berufe
```

### B) Scoring-Matrix anpassen
```typescript
// In phase2-matcher.ts → findBestMatch()
// Visual Hints wichtiger machen:
const visualScore = this.scoreVisualMatch(candidate, visualKeywords);
score += visualScore * 1.5; // War: score += visualScore
```

### C) Setting-Affinity nutzen (nach Migration)
```sql
-- Charaktere mit hoher Wald-Affinität:
SELECT name, setting_affinity->'forest' as forest_score
FROM character_pool
WHERE (setting_affinity->'forest')::int > 7
ORDER BY forest_score DESC;
```

---

## ✅ Erfolgs-Checklist

Nach Deployment prüfen:

- [ ] Phase 1 generiert `visualHints` im JSON
- [ ] Phase 2 Logs zeigen `visual` Score > 0
- [ ] Kapitel sind <= 75 Wörter
- [ ] Token-Verbrauch ist reduziert
- [ ] Charaktere sind vielfältiger
- [ ] Bilder zeigen konsistente Charaktere

---

## 📚 Weiterführende Dokumentation

- Vollständige Analyse: `CHARACTER_MATCHING_OPTIMIZATIONS.md`
- Character Pool Setup: `CHARACTER_POOL_IMPLEMENTATION.md`
- Testing Guide: `TESTING_GUIDE.md`

**Ready to go! 🎉**
