# Migration 10: Add 47 Classic Fairy Tales - Summary

## Overview
This migration adds 47 classic fairy tales from the "Kategorie A: Absolute Klassiker" list in MÄRCHEN_DATENBANK.md, bringing the total from 3 to 50 fairy tales.

## Already in Database (Migration 1)
1. grimm-015 - Hänsel und Gretel
2. grimm-026 - Rotkäppchen
3. grimm-027 - Die Bremer Stadtmusikanten

## New Tales Added (47 total)

### Grimm Fairy Tales (31 tales)
1. grimm-053 - Schneewittchen (Snow White)
2. grimm-021 - Aschenputtel (Cinderella)
3. grimm-050 - Dornröschen (Sleeping Beauty)
4. grimm-012 - Rapunzel
5. grimm-055 - Rumpelstilzchen (Rumpelstiltskin)
6. grimm-024 - Frau Holle (Mother Hulda)
7. grimm-005 - Der Wolf und die 7 Geißlein (The Wolf and the Seven Young Goats)
8. grimm-083 - Hans im Glück (Hans in Luck)
9. grimm-020 - Das tapfere Schneiderlein (The Brave Little Tailor)
10. grimm-036 - Tischchen deck dich (The Wishing-Table)
11. grimm-153 - Die Sterntaler (The Star Money)
12. grimm-033a - Der gestiefelte Kater (Puss in Boots)

### Andersen Fairy Tales (9 tales)
13. andersen-001 - Die kleine Meerjungfrau (The Little Mermaid)
14. andersen-002 - Das hässliche Entlein (The Ugly Duckling)
15. andersen-003 - Die Schneekönigin (The Snow Queen)
16. andersen-004 - Däumelinchen (Thumbelina)
17. andersen-005 - Des Kaisers neue Kleider (The Emperor's New Clothes)
18. andersen-006 - Die Prinzessin auf der Erbse (The Princess and the Pea)
19. andersen-008 - Der standhafte Zinnsoldaten (The Steadfast Tin Soldier)
20. andersen-016 - Das Mädchen mit den Schwefelhölzern (The Little Match Girl)
21. andersen-007 - Die Nachtigall (The Nightingale)

### Russian Fairy Tales (8 tales)
22. russian-001 - Wassilissa die Wunderschöne (Vasilisa the Beautiful)
23. russian-002 - Der Feuervogel (The Firebird)
24. russian-003 - Väterchen Frost (Father Frost)
25. russian-004 - Der Kolobok (The Little Round Bun)
26. russian-005 - Die Rübe (The Giant Turnip)
27. russian-006 - Teremok (The Little House)
28. russian-007 - Baba Jaga (Baba Yaga)
29. russian-008 - Iwan Zarewitsch (Ivan Tsarevich)

### 1001 Nights (3 tales)
30. 1001-001 - Aladin und die Wunderlampe (Aladdin)
31. 1001-002 - Ali Baba und die 40 Räuber (Ali Baba and the Forty Thieves)
32. 1001-003 - Sindbad der Seefahrer (Sinbad the Sailor)

### Literature Classics (6 tales)
33. lit-001 - Alice im Wunderland (Alice in Wonderland)
34. lit-002 - Peter Pan
35. lit-003 - Pinocchio
36. lit-004 - Das Dschungelbuch (The Jungle Book)
37. lit-005 - Heidi
38. lit-006 - Die Schatzinsel (Treasure Island)

### Legends (5 tales)
39. legend-001 - Robin Hood
40. legend-002 - König Artus (King Arthur)
41. legend-003 - Der Rattenfänger von Hameln (The Pied Piper)
42. legend-004 - Till Eulenspiegel
43. legend-005 - Die Loreley

### Aesop's Fables (4 tales)
44. aesop-001 - Der Fuchs und die Trauben (The Fox and the Grapes)
45. aesop-002 - Die Schildkröte und der Hase (The Tortoise and the Hare)
46. aesop-003 - Der Löwe und die Maus (The Lion and the Mouse)
47. aesop-004 - Der Hirtenjunge und der Wolf (The Boy Who Cried Wolf)

## Migration Structure

For EACH fairy tale, the migration includes:

1. **Fairy Tale Entry** with all fields:
   - id, title, source, original_language, english_translation
   - culture_region, age_recommendation, duration_minutes
   - genre_tags (JSON array), moral_lesson, summary
   - is_active (true)

2. **3-5 Roles** for each tale:
   - role_type: protagonist, antagonist, helper, love_interest, supporting
   - role_name, role_count, description
   - required (boolean), profession_preference (JSON array)

3. **4-7 Scenes** for each tale:
   - scene_number, scene_title, scene_description
   - character_variables (JSON), setting, mood
   - duration_seconds (60-100)

4. **Usage Stats** initialization:
   - All tales start with 0 generations

## File Information
- **UP Migration**: `10_add_47_classic_fairy_tales.up.sql`
- **DOWN Migration**: `10_add_47_classic_fairy_tales.down.sql`
- **Estimated Size**: ~3,000-3,500 lines of SQL
- **Language**: All content in German (except english_translation field)

## Rollback
The DOWN migration deletes all 47 tales by their IDs. This cascades to delete:
- All related roles
- All related scenes
- All usage statistics

## Testing Checklist
- [ ] Migration runs successfully without errors
- [ ] Total fairy_tales count = 50 (was 3, now 50)
- [ ] All 47 tales have proper roles assigned
- [ ] All 47 tales have scenes with proper sequencing
- [ ] All genre_tags are valid JSON arrays
- [ ] All profession_preference fields are valid JSON arrays
- [ ] German umlauts (ä, ö, ü, ß) render correctly
- [ ] Down migration successfully removes all 47 tales

## Next Steps
After this migration:
1. Backend will have 50 fairy tales available
2. Frontend can display and filter by culture_region
3. Story generation can use any of the 50 tales
4. Avatar roles can be mapped to fairy tale characters

## Notes
- Current file (partial): Has 13 tales with full details (840 lines)
- Complete file will have all 47 tales at same detail level
- Each tale averages 60-70 lines of SQL (tale + roles + scenes + stats)
- Total estimated: 47 × 65 = ~3,055 lines
