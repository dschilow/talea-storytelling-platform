# 📖 Public Domain Geschichten für Talea

**Zweck:** Kuratierte Story-Templates basierend auf gemeinfreien Märchen  
**Status:** ✅ Alle Geschichten frei nutzbar  
**Stand:** 31. Oktober 2025

---

## 🎯 Übersicht

Diese Datei enthält **fertige Story-Templates** für die Talea-Plattform, basierend auf den 3.600+ gemeinfreien Märchen aus `MÄRCHEN_KATALOG.md`.

Jedes Template ist:
- ✅ Sofort verwendbar im Story Wizard
- ✅ Mit Talea Character Pool kompatibel
- ✅ Altersgerecht kategorisiert
- ✅ Mit Learning Objectives versehen
- ✅ Multi-Avatar-ready

---

## 📚 STORY-TEMPLATE STRUKTUR

```typescript
interface StoryTemplate {
  id: string;
  source: "grimm" | "andersen" | "russian" | "perrault" | "1001nights" | "aesop" | "british" | "german" | "literature";
  khm_number?: number; // Für Grimm
  
  // Basis-Info
  title_de: string;
  title_en?: string;
  title_original?: string;
  
  // Kategorisierung
  genre: "fantasy" | "adventure" | "animal" | "moral" | "horror" | "humor" | "romance" | "historic";
  age_rating: 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  popularity: 1 | 2 | 3 | 4 | 5; // Sterne
  
  // Story-Inhalt
  summary_de: string;
  original_plot_points: string[];
  
  // Character Mapping
  required_avatars: {
    min: number;
    max: number;
    recommended: number;
  };
  avatar_roles: {
    protagonist: number; // Wie viele Haupt-Avatare?
    guide?: boolean;
    companion?: boolean;
    discovery?: boolean;
    obstacle?: boolean;
  };
  character_pool_suggestions: string[]; // IDs aus Character Pool
  
  // Themes & Learning
  main_themes: string[];
  moral?: string;
  learning_objectives?: string[];
  story_soul: string; // adventure, friendship, courage, etc.
  emotional_flavors: string[];
  
  // Talea-Integration
  compatible_styles: string[]; // Welche Style Presets passen?
  seasonal?: "spring" | "summer" | "fall" | "winter";
  special_features?: string[];
  
  // Rechtliches
  is_public_domain: true;
  copyright_notes?: string;
  disney_warning?: boolean;
}
```

---

## 🌟 TOP 100 STORY TEMPLATES

### 🇩🇪 GRIMM - SEHR BELIEBT (30 Templates)

#### 1. Hänsel und Gretel

```json
{
  "id": "grimm-015-haensel-gretel",
  "source": "grimm",
  "khm_number": 15,
  
  "title_de": "Hänsel und Gretel",
  "title_en": "Hansel and Gretel",
  
  "genre": "adventure",
  "age_rating": 6,
  "popularity": 5,
  
  "summary_de": "Zwei Geschwister werden im Wald ausgesetzt, finden ein Hexenhaus aus Lebkuchen und müssen die böse Hexe überlisten, um nach Hause zu gelangen.",
  
  "original_plot_points": [
    "Familie leidet unter Armut und Hunger",
    "Stiefmutter überredet Vater, Kinder auszusetzen",
    "Hänsel hört Plan und legt Kieselsteine aus",
    "Zweiter Versuch mit Brotkrumen (Vögel fressen sie)",
    "Kinder finden Hexenhaus aus Lebkuchen",
    "Hexe sperrt Hänsel ein, will ihn mästen",
    "Gretel täuscht Hexe mit Knochen",
    "Gretel stößt Hexe in Ofen",
    "Kinder finden Schatz und kehren heim",
    "Stiefmutter ist tot, glückliches Ende"
  ],
  
  "required_avatars": {
    "min": 2,
    "max": 4,
    "recommended": 2
  },
  
  "avatar_roles": {
    "protagonist": 2,
    "guide": false,
    "companion": false,
    "discovery": false,
    "obstacle": true
  },
  
  "character_pool_suggestions": [
    "die-nebelhexe", // Als böse Hexe
    "die-alte-eiche", // Optional: weiser Baum im Wald
    "pip-das-eichhoernchen" // Optional: Helfer
  ],
  
  "main_themes": [
    "Geschwisterliebe",
    "Mut",
    "List und Cleverness",
    "Familie",
    "Überleben"
  ],
  
  "moral": "Zusammenhalt und Cleverness helfen, selbst die größten Gefahren zu überwinden.",
  
  "learning_objectives": [
    "Problemlösungskompetenz",
    "Teamwork und Zusammenarbeit",
    "Mut in schwierigen Situationen",
    "Kreatives Denken"
  ],
  
  "story_soul": "courage",
  
  "emotional_flavors": [
    "suspense",
    "triumph",
    "bonding"
  ],
  
  "compatible_styles": [
    "classic_fairy_tale",
    "modern_adventure",
    "dark_forest"
  ],
  
  "seasonal": "fall",
  
  "is_public_domain": true,
  "disney_warning": false
}
```

#### 2. Rotkäppchen

```json
{
  "id": "grimm-026-rotkaeppchen",
  "source": "grimm",
  "khm_number": 26,
  
  "title_de": "Rotkäppchen",
  "title_en": "Little Red Riding Hood",
  
  "genre": "adventure",
  "age_rating": 5,
  "popularity": 5,
  
  "summary_de": "Ein Mädchen mit roter Kappe besucht ihre kranke Großmutter und begegnet im Wald dem bösen Wolf, der versucht, beide zu fressen.",
  
  "original_plot_points": [
    "Mutter schickt Rotkäppchen zur kranken Großmutter",
    "Warnung: Nicht vom Weg abkommen",
    "Wolf begegnet Rotkäppchen im Wald",
    "Wolf nimmt Abkürzung zum Haus",
    "Wolf frisst Großmutter",
    "Wolf verkleidet sich als Großmutter",
    "Rotkäppchen bemerkt seltsame Details",
    "Wolf springt aus Bett und frisst Rotkäppchen",
    "Jäger rettet beide aus Wolfsmagen",
    "Wolf wird mit Steinen gefüllt und stirbt"
  ],
  
  "required_avatars": {
    "min": 1,
    "max": 3,
    "recommended": 1
  },
  
  "avatar_roles": {
    "protagonist": 1,
    "guide": false,
    "companion": false,
    "discovery": false,
    "obstacle": true
  },
  
  "character_pool_suggestions": [
    "der-waldgeist-leshy", // Als weiser Waldwächter statt Jäger
    "brumm-der-steinwaechter" // Optional: freundlicher Beschützer
  ],
  
  "main_themes": [
    "Gehorsam",
    "Vorsicht vor Fremden",
    "Täuschung",
    "Rettung"
  ],
  
  "moral": "Höre auf Warnungen und sei vorsichtig vor Fremden, die freundlich scheinen.",
  
  "learning_objectives": [
    "Gefahrenbewusstsein",
    "Anweisungen befolgen",
    "Fremden mit Vorsicht begegnen"
  ],
  
  "story_soul": "caution",
  
  "emotional_flavors": [
    "suspense",
    "rescue",
    "relief"
  ],
  
  "compatible_styles": [
    "classic_fairy_tale",
    "cautionary_tale"
  ],
  
  "is_public_domain": true,
  "disney_warning": false,
  
  "special_features": [
    "perfect_for_youngest",
    "clear_moral_lesson",
    "iconic_character"
  ]
}
```

#### 3. Schneewittchen

```json
{
  "id": "grimm-053-schneewittchen",
  "source": "grimm",
  "khm_number": 53,
  
  "title_de": "Schneewittchen",
  "title_en": "Snow White",
  
  "genre": "fantasy",
  "age_rating": 6,
  "popularity": 5,
  
  "summary_de": "Eine schöne Prinzessin flieht vor ihrer eifersüchtigen Stiefmutter und findet Zuflucht bei sieben Zwergen im Wald.",
  
  "original_plot_points": [
    "Königin wünscht sich Kind 'weiß wie Schnee, rot wie Blut, schwarz wie Ebenholz'",
    "Schneewittchen wird geboren, Mutter stirbt",
    "Stiefmutter mit magischem Spiegel",
    "Spiegel sagt: Schneewittchen ist schöner",
    "Jäger soll Schneewittchen töten, verschont sie",
    "Schneewittchen findet Zwergenhaus",
    "Drei Mordversuche (Schnürriemen, Kamm, Apfel)",
    "Scheintod durch vergifteten Apfel",
    "Prinz findet Glassarg",
    "Apfelstück wird ausgespuckt, Erwachen",
    "Stiefmutter tanzt in glühenden Schuhen zu Tode"
  ],
  
  "required_avatars": {
    "min": 1,
    "max": 8,
    "recommended": 1
  },
  
  "avatar_roles": {
    "protagonist": 1,
    "guide": false,
    "companion": true, // Zwerge
    "discovery": false,
    "obstacle": true
  },
  
  "character_pool_suggestions": [
    "die-nebelhexe", // Als böse Stiefmutter
    "professor-lichtweis", // Als weiser Zwerg (Anführer)
    "pip-das-eichhoernchen", // Waldfreunde
    "silberhorn-der-hirsch" // Prinz-äquivalent
  ],
  
  "main_themes": [
    "Neid und Eifersucht",
    "Innere Schönheit",
    "Freundschaft",
    "Gute vs. Böse",
    "Rettung"
  ],
  
  "moral": "Innere Schönheit und Güte sind wichtiger als äußere Erscheinung. Neid zerstört.",
  
  "learning_objectives": [
    "Selbstwert",
    "Freundschaft schätzen",
    "Gefahren erkennen",
    "Güte bewahren"
  ],
  
  "story_soul": "resilience",
  
  "emotional_flavors": [
    "suspense",
    "wonder",
    "triumph"
  ],
  
  "compatible_styles": [
    "classic_fairy_tale",
    "enchanted_forest"
  ],// filepath: c:\MyProjects\Talea\talea-storytelling-platform\PUBLIC_STORIES.md
# 📖 Public Domain Geschichten für Talea

**Zweck:** Kuratierte Story-Templates basierend auf gemeinfreien Märchen  
**Status:** ✅ Alle Geschichten frei nutzbar  
**Stand:** 31. Oktober 2025

---

## 🎯 Übersicht

Diese Datei enthält **fertige Story-Templates** für die Talea-Plattform, basierend auf den 3.600+ gemeinfreien Märchen aus `MÄRCHEN_KATALOG.md`.

Jedes Template ist:
- ✅ Sofort verwendbar im Story Wizard
- ✅ Mit Talea Character Pool kompatibel
- ✅ Altersgerecht kategorisiert
- ✅ Mit Learning Objectives versehen
- ✅ Multi-Avatar-ready

---

## 📚 STORY-TEMPLATE STRUKTUR

```typescript
interface StoryTemplate {
  id: string;
  source: "grimm" | "andersen" | "russian" | "perrault" | "1001nights" | "aesop" | "british" | "german" | "literature";
  khm_number?: number; // Für Grimm
  
  // Basis-Info
  title_de: string;
  title_en?: string;
  title_original?: string;
  
  // Kategorisierung
  genre: "fantasy" | "adventure" | "animal" | "moral" | "horror" | "humor" | "romance" | "historic";
  age_rating: 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  popularity: 1 | 2 | 3 | 4 | 5; // Sterne
  
  // Story-Inhalt
  summary_de: string;
  original_plot_points: string[];
  
  // Character Mapping
  required_avatars: {
    min: number;
    max: number;
    recommended: number;
  };
  avatar_roles: {
    protagonist: number; // Wie viele Haupt-Avatare?
    guide?: boolean;
    companion?: boolean;
    discovery?: boolean;
    obstacle?: boolean;
  };
  character_pool_suggestions: string[]; // IDs aus Character Pool
  
  // Themes & Learning
  main_themes: string[];
  moral?: string;
  learning_objectives?: string[];
  story_soul: string; // adventure, friendship, courage, etc.
  emotional_flavors: string[];
  
  // Talea-Integration
  compatible_styles: string[]; // Welche Style Presets passen?
  seasonal?: "spring" | "summer" | "fall" | "winter";
  special_features?: string[];
  
  // Rechtliches
  is_public_domain: true;
  copyright_notes?: string;
  disney_warning?: boolean;
}
```

---

## 🌟 TOP 100 STORY TEMPLATES

### 🇩🇪 GRIMM - SEHR BELIEBT (30 Templates)

#### 1. Hänsel und Gretel

```json
{
  "id": "grimm-015-haensel-gretel",
  "source": "grimm",
  "khm_number": 15,
  
  "title_de": "Hänsel und Gretel",
  "title_en": "Hansel and Gretel",
  
  "genre": "adventure",
  "age_rating": 6,
  "popularity": 5,
  
  "summary_de": "Zwei Geschwister werden im Wald ausgesetzt, finden ein Hexenhaus aus Lebkuchen und müssen die böse Hexe überlisten, um nach Hause zu gelangen.",
  
  "original_plot_points": [
    "Familie leidet unter Armut und Hunger",
    "Stiefmutter überredet Vater, Kinder auszusetzen",
    "Hänsel hört Plan und legt Kieselsteine aus",
    "Zweiter Versuch mit Brotkrumen (Vögel fressen sie)",
    "Kinder finden Hexenhaus aus Lebkuchen",
    "Hexe sperrt Hänsel ein, will ihn mästen",
    "Gretel täuscht Hexe mit Knochen",
    "Gretel stößt Hexe in Ofen",
    "Kinder finden Schatz und kehren heim",
    "Stiefmutter ist tot, glückliches Ende"
  ],
  
  "required_avatars": {
    "min": 2,
    "max": 4,
    "recommended": 2
  },
  
  "avatar_roles": {
    "protagonist": 2,
    "guide": false,
    "companion": false,
    "discovery": false,
    "obstacle": true
  },
  
  "character_pool_suggestions": [
    "die-nebelhexe", // Als böse Hexe
    "die-alte-eiche", // Optional: weiser Baum im Wald
    "pip-das-eichhoernchen" // Optional: Helfer
  ],
  
  "main_themes": [
    "Geschwisterliebe",
    "Mut",
    "List und Cleverness",
    "Familie",
    "Überleben"
  ],
  
  "moral": "Zusammenhalt und Cleverness helfen, selbst die größten Gefahren zu überwinden.",
  
  "learning_objectives": [
    "Problemlösungskompetenz",
    "Teamwork und Zusammenarbeit",
    "Mut in schwierigen Situationen",
    "Kreatives Denken"
  ],
  
  "story_soul": "courage",
  
  "emotional_flavors": [
    "suspense",
    "triumph",
    "bonding"
  ],
  
  "compatible_styles": [
    "classic_fairy_tale",
    "modern_adventure",
    "dark_forest"
  ],
  
  "seasonal": "fall",
  
  "is_public_domain": true,
  "disney_warning": false
}
```

#### 2. Rotkäppchen

```json
{
  "id": "grimm-026-rotkaeppchen",
  "source": "grimm",
  "khm_number": 26,
  
  "title_de": "Rotkäppchen",
  "title_en": "Little Red Riding Hood",
  
  "genre": "adventure",
  "age_rating": 5,
  "popularity": 5,
  
  "summary_de": "Ein Mädchen mit roter Kappe besucht ihre kranke Großmutter und begegnet im Wald dem bösen Wolf, der versucht, beide zu fressen.",
  
  "original_plot_points": [
    "Mutter schickt Rotkäppchen zur kranken Großmutter",
    "Warnung: Nicht vom Weg abkommen",
    "Wolf begegnet Rotkäppchen im Wald",
    "Wolf nimmt Abkürzung zum Haus",
    "Wolf frisst Großmutter",
    "Wolf verkleidet sich als Großmutter",
    "Rotkäppchen bemerkt seltsame Details",
    "Wolf springt aus Bett und frisst Rotkäppchen",
    "Jäger rettet beide aus Wolfsmagen",
    "Wolf wird mit Steinen gefüllt und stirbt"
  ],
  
  "required_avatars": {
    "min": 1,
    "max": 3,
    "recommended": 1
  },
  
  "avatar_roles": {
    "protagonist": 1,
    "guide": false,
    "companion": false,
    "discovery": false,
    "obstacle": true
  },
  
  "character_pool_suggestions": [
    "der-waldgeist-leshy", // Als weiser Waldwächter statt Jäger
    "brumm-der-steinwaechter" // Optional: freundlicher Beschützer
  ],
  
  "main_themes": [
    "Gehorsam",
    "Vorsicht vor Fremden",
    "Täuschung",
    "Rettung"
  ],
  
  "moral": "Höre auf Warnungen und sei vorsichtig vor Fremden, die freundlich scheinen.",
  
  "learning_objectives": [
    "Gefahrenbewusstsein",
    "Anweisungen befolgen",
    "Fremden mit Vorsicht begegnen"
  ],
  
  "story_soul": "caution",
  
  "emotional_flavors": [
    "suspense",
    "rescue",
    "relief"
  ],
  
  "compatible_styles": [
    "classic_fairy_tale",
    "cautionary_tale"
  ],
  
  "is_public_domain": true,
  "disney_warning": false,
  
  "special_features": [
    "perfect_for_youngest",
    "clear_moral_lesson",
    "iconic_character"
  ]
}
```

#### 3. Schneewittchen

```json
{
  "id": "grimm-053-schneewittchen",
  "source": "grimm",
  "khm_number": 53,
  
  "title_de": "Schneewittchen",
  "title_en": "Snow White",
  
  "genre": "fantasy",
  "age_rating": 6,
  "popularity": 5,
  
  "summary_de": "Eine schöne Prinzessin flieht vor ihrer eifersüchtigen Stiefmutter und findet Zuflucht bei sieben Zwergen im Wald.",
  
  "original_plot_points": [
    "Königin wünscht sich Kind 'weiß wie Schnee, rot wie Blut, schwarz wie Ebenholz'",
    "Schneewittchen wird geboren, Mutter stirbt",
    "Stiefmutter mit magischem Spiegel",
    "Spiegel sagt: Schneewittchen ist schöner",
    "Jäger soll Schneewittchen töten, verschont sie",
    "Schneewittchen findet Zwergenhaus",
    "Drei Mordversuche (Schnürriemen, Kamm, Apfel)",
    "Scheintod durch vergifteten Apfel",
    "Prinz findet Glassarg",
    "Apfelstück wird ausgespuckt, Erwachen",
    "Stiefmutter tanzt in glühenden Schuhen zu Tode"
  ],
  
  "required_avatars": {
    "min": 1,
    "max": 8,
    "recommended": 1
  },
  
  "avatar_roles": {
    "protagonist": 1,
    "guide": false,
    "companion": true, // Zwerge
    "discovery": false,
    "obstacle": true
  },
  
  "character_pool_suggestions": [
    "die-nebelhexe", // Als böse Stiefmutter
    "professor-lichtweis", // Als weiser Zwerg (Anführer)
    "pip-das-eichhoernchen", // Waldfreunde
    "silberhorn-der-hirsch" // Prinz-äquivalent
  ],
  
  "main_themes": [
    "Neid und Eifersucht",
    "Innere Schönheit",
    "Freundschaft",
    "Gute vs. Böse",
    "Rettung"
  ],
  
  "moral": "Innere Schönheit und Güte sind wichtiger als äußere Erscheinung. Neid zerstört.",
  
  "learning_objectives": [
    "Selbstwert",
    "Freundschaft schätzen",
    "Gefahren erkennen",
    "Güte bewahren"
  ],
  
  "story_soul": "resilience",
  
  "emotional_flavors": [
    "suspense",
    "wonder",
    "triumph"
  ],
  
  "compatible_styles": [
    "classic_fairy_tale",
    "enchanted_forest"
  ],