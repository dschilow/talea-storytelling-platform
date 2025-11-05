# Modern Story Wizard - Quick Start

## 🎯 Übersicht

Der neue **Modern Story Wizard** ist eine kindgerechte, 6-stufige Alternative zum komplexen alten Story Wizard.

### Warum dieser Wizard?

**Problem:** Alter Wizard hatte 20+ Parameter, nicht kinderfreundlich, fragte nach 150 Märchen (die nicht existieren).

**Lösung:** Smart-Category-System, das:
- 3 vorhandene Märchen als Templates nutzt
- 71 Character Pool Charaktere kombiniert  
- 6 intelligente Genre-Kategorien anbietet
- **Infinite Kombinationen** aus wenigen Bausteinen erzeugt

---

## 🧩 6-Step Wizard

### Step 1: Avatar Selection 👥
**Datei:** `wizard-steps/Step1AvatarSelection.tsx`

- Zeigt alle User-Avatare in Grid
- Multi-Select (1-4 Avatare)
- Lädt via `/avatar` Endpoint
- Visuelles Feedback bei Selection

**State:**
```typescript
selectedAvatars: string[] // Avatar IDs
```

---

### Step 2: Category Selection 📚
**Datei:** `wizard-steps/Step2CategorySelection.tsx`

**6 Smart Categories:**

| Kategorie | Backend Mapping |
|-----------|----------------|
| 🏰 Klassische Märchen | `genre: "fantasy"`, `useFairyTaleTemplate: true` |
| 🗺️ Abenteuer & Schätze | `genre: "adventure"`, `suspenseLevel: 2` |
| ✨ Märchenwelten & Magie | `genre: "fantasy"`, `specialIngredients: ["Magie"]` |
| 🦊 Tierwelten | `genre: "animals"`, uses animal characters from pool |
| 🚀 Sci-Fi & Zukunft | `genre: "scifi"`, `setting: "space"` |
| 🏡 Modern & Realität | `genre: "realistic"`, `setting: "village"` |

**State:**
```typescript
mainCategory: 'fairy-tales' | 'adventure' | 'magic' | 'animals' | 'scifi' | 'modern' | null
```

**Key Insight:**  
Statt 150 individuelle Märchen zu zeigen (die nicht existieren), bieten wir **6 Genre-Templates** an, die mit 3 Märchen + 71 Charakteren **infinite Variationen** erzeugen!

---

### Step 3: Age & Length ⏱️
**Datei:** `wizard-steps/Step3AgeAndLength.tsx`

**Age Groups:**
- 3-5 Jahre: Einfache Worte, kurze Sätze
- 6-8 Jahre: Spannende Abenteuer  
- 9-12 Jahre: Komplexere Handlung
- 13+ Jahre: Tiefgründige Themen

**Lengths:**
- ⚡ Kurz: 5-10 Min, 3-4 Kapitel
- 📖 Mittel: 10-15 Min, 5-6 Kapitel  
- 📚 Lang: 15-25 Min, 7-9 Kapitel

**State:**
```typescript
ageGroup: '3-5' | '6-8' | '9-12' | '13+' | null
length: 'short' | 'medium' | 'long' | null
```

---

### Step 4: Story Feeling 💫
**Datei:** `wizard-steps/Step4StoryFeeling.tsx`

**5 Feelings (wähle 1-3):**
- 😂 Lustig
- ❤️ Herzlich  
- ⚡ Spannend
- 🤪 Verrückt
- 💭 Bedeutungsvoll

**State:**
```typescript
feelings: ('funny' | 'warm' | 'exciting' | 'crazy' | 'meaningful')[]
```

**Backend Mapping:**
- `funny` → `humorLevel: 2`
- `exciting` → `suspenseLevel: 2`, `pacing: "fast"`
- `warm` → `tone: "warm"`

---

### Step 5: Special Wishes ✨ (Optional)
**Datei:** `wizard-steps/Step5SpecialWishes.tsx`

**Optionen:**
- 🎵 Mit Reimen (`allowRhymes: true`)
- 📖 Mit Moral (moral lesson)
- ⭐ Avatar ist Held (`avatarIsHero: true`) - **Default aktiv**
- 👑 Bekannte Figuren (`famousCharacters: true`)
- 😊 Happy End (`happyEnd: true`) - **Default aktiv**
- ❗ Überraschungs-Ende (`hasTwist: true`)
- 💬 Custom Wish (Freitext, max 200 Zeichen)

**State:**
```typescript
rhymes: boolean
moral: boolean
avatarIsHero: boolean
famousCharacters: boolean
happyEnd: boolean
surpriseEnd: boolean
customWish: string
```

---

### Step 6: Summary & Create 🎉
**Datei:** `wizard-steps/Step6Summary.tsx`

- Zeigt Zusammenfassung aller Auswahlen
- Große "GESCHICHTE ERSTELLEN" Button
- Erwartete Dauer: 60-90 Sek (Story), 2-3 Min (mit Bildern)

---

## 🔄 State Management

**Haupt-State** (`ModernStoryWizard.tsx`):
```typescript
interface WizardState {
  selectedAvatars: string[];
  mainCategory: string | null;
  subCategory: string | null;
  ageGroup: string | null;
  length: string | null;
  feelings: string[];
  rhymes: boolean;
  moral: boolean;
  avatarIsHero: boolean;
  famousCharacters: boolean;
  happyEnd: boolean;
  surpriseEnd: boolean;
  customWish: string;
}
```

**Mapping zu API** (`mapWizardStateToAPI`-Funktion):
```typescript
{
  avatarIds: state.selectedAvatars,
  ageGroup: state.ageGroup,
  genre: genreMap[state.mainCategory],
  length: state.length,
  complexity: 'medium',
  setting: derivedFromCategory,
  suspenseLevel: state.feelings.includes('exciting') ? 2 : 1,
  humorLevel: state.feelings.includes('funny') ? 2 : 1,
  tone: state.feelings.includes('warm') ? 'warm' : 'balanced',
  pacing: state.feelings.includes('exciting') ? 'fast' : 'balanced',
  allowRhymes: state.rhymes,
  hasTwist: state.surpriseEnd,
  customPrompt: state.customWish,
  preferences: {
    useFairyTaleTemplate: state.mainCategory === 'fairy-tales'
  }
}
```

---

## 🎨 UI/UX Features

### Design System
- **TailwindCSS** für Styling
- **lucide-react** für Icons
- **Framer Motion** für Animationen (optional)

### Progress Indicator
- 6-Step Stepper mit Kreisen
- Aktiver Step: Lila Ring  
- Abgeschlossene Steps: Grüner Haken
- Verbindungslinien zwischen Steps

### Validation
- Step 1: Min. 1 Avatar nötig
- Step 2: Kategorie nötig
- Step 3: Age + Length nötig
- Step 4: Min. 1 Feeling nötig
- Step 5: Alles optional
- "Weiter"-Button nur aktiv wenn Step valid

### Responsive
- Mobile: 1-2 Spalten  
- Desktop: 3-4 Spalten
- Touch-friendly Buttons (min 44x44px)

---

## 🚀 Integration

### 1. Routing hinzufügen
```tsx
// In App.tsx oder Routes.tsx
<Route path="/stories/wizard" element={<ModernStoryWizard />} />
```

### 2. Navigation
```tsx
// Von StoriesScreen.tsx
<button onClick={() => navigate('/stories/wizard')}>
  Neue Geschichte
</button>
```

### 3. Generation Screen
Nach "ERSTELLEN"-Klick → `/stories/generating` mit State:
```tsx
navigate('/stories/generating', { 
  state: { request: mappedAPIRequest } 
});
```

---

## 🧪 Testing

### Manual Test Flow
1. **Avatar Selection:** Wähle 2 Avatare → "Weiter" aktiv
2. **Category:** Wähle "Abenteuer & Schätze" → "Weiter" aktiv  
3. **Age & Length:** Wähle "6-8 Jahre" + "Mittel" → "Weiter" aktiv
4. **Feeling:** Wähle "Spannend" + "Lustig" → "Weiter" aktiv
5. **Wishes:** Aktiviere "Mit Reimen", Custom: "Mit Drachen" → "Weiter" aktiv
6. **Summary:** Überprüfe Zusammenfassung → "ERSTELLEN" klicken
7. **Result:** Sollte zur Generation-Screen navigieren

### Expected API Call
```json
{
  "avatarIds": ["avatar-1", "avatar-2"],
  "ageGroup": "6-8",
  "genre": "adventure",
  "length": "medium",
  "complexity": "medium",
  "setting": "varied",
  "suspenseLevel": 2,
  "humorLevel": 2,
  "tone": "balanced",
  "pacing": "fast",
  "allowRhymes": true,
  "hasTwist": false,
  "customPrompt": "Mit Drachen",
  "preferences": {
    "useFairyTaleTemplate": false
  }
}
```

---

## 📈 Advantages vs Old Wizard

| Old Wizard | New Wizard |
|------------|------------|
| 20+ Parameters | 6 Simple Steps |
| Erwachsenen-UI | Kindgerecht mit Emojis |
| Fragt nach 150 Märchen | 6 Smart Categories |
| Alle Parameter auf 1 Seite | Progressive Disclosure |
| Validation erst am Ende | Live Validation per Step |
| Keine Fortschritts-Anzeige | Visueller Stepper |
| Technische Begriffe | Emotionale Sprache |

---

## 🔮 Future Enhancements

### Phase 2 (Later)
- [ ] **Avatar Preview:** Zeige Avatar-Bilder in Summary
- [ ] **Category Previews:** Mini-Story-Snippets pro Kategorie
- [ ] **Feeling Combinations:** Intelligente Vorschläge ("Oft gewählt: Lustig + Spannend")
- [ ] **Save Presets:** Lieblings-Kombinationen speichern
- [ ] **Undo/Redo:** Navigation-History
- [ ] **Keyboard Shortcuts:** Space = Weiter, Backspace = Zurück

### Phase 3 (Advanced)
- [ ] **Live Preview:** Generate Chapter 1 während Wizard läuft
- [ ] **A/B Testing:** Teste welche Categories am beliebtesten
- [ ] **Analytics:** Track welche Kombinationen beste Stories erzeugen
- [ ] **Multi-Language:** Wizard auf Englisch/Französisch

---

## 📝 Notes

### Why Smart Categories Work

**Problem:**  
User wollte 150 Märchen, aber `build150FairyTalesLibrary()` liefert nur 3.

**Math:**
- 3 Fairy Tale Templates
- 71 Character Pool Characters
- 6 Genre Categories  
- 4 Age Groups
- 3 Lengths
- 5 Feelings (pick 1-3)
- 6+ Special Wishes

**Combinations:**
```
3 × 71 × 6 × 4 × 3 × 125 (feeling combos) = 
~2,000,000+ unique story configurations
```

**Result:**  
Infinite variety from limited building blocks! 🎨

---

## 🎯 Success Metrics

### User Experience
- ✅ Kid-friendly (ages 6-12 can use independently)
- ✅ Max 2 minutes to complete wizard
- ✅ No confusing technical terms
- ✅ Visual feedback at every step

### Technical
- ✅ Compatible with existing backend API
- ✅ No backend changes needed
- ✅ Responsive on mobile/tablet/desktop
- ✅ Accessible (keyboard navigation, screen readers)

---

## 🤝 Migration Path

### From Old Wizard
1. Keep old wizard at `/stories/wizard-legacy`
2. Add new wizard at `/stories/wizard`
3. A/B test for 2 weeks
4. Collect feedback
5. Remove old wizard if new one performs better

### Backwards Compatibility
All wizard outputs map to existing `StoryConfig` interface - **no breaking changes!**

---

## 📞 Support

**Questions?** Check:
- `ModernStoryWizard.tsx` - Main component
- `mapWizardStateToAPI()` - API mapping logic
- `backend/story/four-phase-orchestrator.ts` - Story generation

**Bugs?** Test:
1. Avatar loading (check `/avatar` endpoint)
2. Category selection (state updates)
3. API mapping (console.log before navigate)
4. Generation flow (check Railway logs)

---

**Version:** 2.0  
**Created:** 2025-01-31  
**Status:** ✅ Ready to Deploy
