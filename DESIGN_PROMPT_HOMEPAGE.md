# 🎨 Talea Homepage - Professioneller UI/UX Design Prompt

## 📋 Projekt Overview
**App Name:** Talea - Die Magische Story & Avatar Plattform für Kinder  
**Zielgruppe:** Kinder (6-13 Jahre) & Eltern  
**Primärer Zweck:** Erstelle magische Geschichten, Avatare und Dokumentationen  
**Design-Philosophie:** Kindgerecht, spielerisch, motivierend, sicher, bildend

---

## 🏠 Homepage Struktur & Layout

### **1. HEADER SECTION - Personalisierte Begrüßung**

#### Visual Design:
- **Background:** Sanfter Gradient von Violett (A989F2) zu Türkis (4EC9D8) mit Glasmorphismus-Effekt
- **Animation:** Subtile Partikel/Sterne die sanft schweben
- **Layout:** Full-width, 120-150px Höhe

#### Inhalte:
```
┌─────────────────────────────────────────────────────────┐
│  🎭 Talea                    👋 Hallo, [Kindsname]!  🔔  │
│                              (+ Avatar Mini Portrait)     │
└─────────────────────────────────────────────────────────┘
```

**Elemente:**
- **Talea Logo** (links): Animiertes Märchen-Icon (Zauberstab + Buch)
- **Personalized Greeting** (Mitte): "Hallo, [Name]! Heute schreiben wir eine neue Geschichte! ✨"
- **Notifikationen Icon** (rechts): Pulsierender Badge für neue Features
- **User Avatar** (rechts unten): Mini-Profil des Kindes mit Namen
- **Zeichenkonto-Switches** (nur wenn mehrere Kids): Schneller Wechsel zwischen Profilen

**Interaktivität:**
- Greeting ändert sich je nach Tageszeit ("Guten Morgen", "Guten Nachmittag", "Gute Nacht!")
- Micro-animations: Emojis hüpfen beim Laden
- Click auf Avatar → Quick Access zu Profil-Einstellungen

---

### **2. QUICK ACTION BUTTONS - Call-to-Action Hero Section**

#### Visual Design:
- **Layout:** 3 große, gleichmäßig verteilte Buttons in einer Reihe
- **Card Style:** Glasmorphismus mit farbigen Borders
- **Spacing:** Mit 20-30px Padding oben/unten

#### Die 3 Hauptaktionen:

```
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│   📖 Neue Geschichte │  │   🎭 Avatar erstellen │  │   📚 Dokumentation   │
│   SCHREIBEN & TRÄUMEN│  │   LEBEN EINHAUCHEN!  │  │   LERNEN & ERFORSCHEN│
│                      │  │                      │  │                      │
│   [CTA Button]       │  │   [CTA Button]       │  │   [CTA Button]       │
└──────────────────────┘  └──────────────────────┘  └──────────────────────┘
```

**Button 1: "📖 Neue Geschichte Schreiben"**
- **Icon:** Glowing Book/Zauberstab Combo
- **Color:** Gradient Violett → Pink (A989F2 → FF6B9D)
- **Hover Effect:** Scale up, shadow expand, rotate icon
- **Click Action:** Navigate zu StoryWizard
- **Sub-text:** "Lass deine Fantasie fliegen!"

**Button 2: "🎭 Avatar Erstellen"**
- **Icon:** Smiling Face mit Sparkles
- **Color:** Gradient Cyan → Grün (4EC9D8 → 3FD68D)
- **Hover Effect:** Breathing animation, avatar blinkt
- **Click Action:** Navigate zu AvatarWizard
- **Sub-text:** "Erschaffe dein digitales Alter Ego!"

**Button 3: "📚 Dokumentationen"**
- **Icon:** Book mit Lightbulb
- **Color:** Gradient Orange → Gelb (FFB950 → FDD95C)
- **Hover Effect:** Pages flip animation
- **Click Action:** Navigate zu DokuWizard
- **Sub-text:** "Wissen teilen & verbreiten!"

---

### **3. WILLKOMMENS SEKTION - Personalisierter Überblick**

#### Layout: 3-Column Grid Layout unter Quick Actions
Responsive: 1 Column auf Mobile, 2 auf Tablet, 3 auf Desktop

---

## 📖 SECTION 1: MEINE GESCHICHTEN (Stories Overview)

### Visual Design:
```
┌──────────────────────────────────────────────────────────────┐
│  📖 Meine Geschichten                           [Alle anzeigen →] │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │              │  │              │  │              │        │
│  │   Cover 1    │  │   Cover 2    │  │   Cover 3    │        │
│  │              │  │              │  │              │        │
│  │ [Title]      │  │ [Title]      │  │ [+ Neu]      │        │
│  │ ⭐⭐⭐⭐⭐   │  │ ⭐⭐⭐⭐     │  │              │        │
│  │ 2 Tage ago   │  │ 1 Woche ago  │  │              │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

### Inhalte:
- **Section Title:** "📖 Meine Geschichten" mit kleinem Sparkle Animation
- **Display Mode:** Carousel/Scrollable Grid (3-4 visible)
- **Card Elements pro Geschichte:**
  - Cover Image (Glasmorphism overlay mit gradient)
  - Story Title (Bold, 16px, truncated)
  - Star Rating (⭐ visual)
  - Last Modified Date ("2 Tage ago")
  - Hover Actions: [Lesen] [Bearbeiten] [Teilen]
  - Status Badge: "✓ Fertig" / "⏳ Wird geschrieben"
  
- **Empty State (keine Geschichten):**
  ```
  [Illustration: Kind mit leeren Buch]
  "Noch keine Geschichten? Lass uns eine schreiben! 🎉"
  [CTA Button: "Jetzt schreiben"]
  ```

- **"+ Neue Geschichte" Card:**
  - Animierter Pluszeichen mit Puls
  - Hover: Größere Animation, "Klick um zu starten!"
  - Click: Öffnet StoryWizard

### Interaktivität:
- **Swipe/Scroll:** Horizontal scrollen für mehr Stories
- **Tap Card:** Öffnet Story Reader
- **Long Press:** Zeigt Options Menu (Edit, Delete, Share)
- **Lazy Loading:** Weitere Stories laden bei Scroll

### Colors:
- Background: Glasmorphism Box (rgba(255,255,255,0.1))
- Text: Dunkles Violett (color.text.primary)
- Accents: Gradient Violett-Pink

---

## 🎭 SECTION 2: MEINE AVATARE (Avatars Overview)

### Visual Design:
```
┌──────────────────────────────────────────────────────────────┐
│  🎭 Meine Avatare                              [Alle anzeigen →] │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │              │  │              │  │              │        │
│  │   Avatar 1   │  │   Avatar 2   │  │   Avatar 3   │        │
│  │   (Full img) │  │   (Full img) │  │   (Full img) │        │
│  │              │  │              │  │              │        │
│  │ [Name]       │  │ [Name]       │  │ [+ Neu]      │        │
│  │ Erstellt:    │  │ Erstellt:    │  │              │        │
│  │ 3 Wochen ago │  │ 1 Tag ago    │  │              │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

### Inhalte:
- **Section Title:** "🎭 Meine Avatare" mit spielerischem Icon
- **Display Mode:** Carousel/Grid (3-4 visible)
- **Card Elements pro Avatar:**
  - Full Avatar Portrait (Large, ~120px)
  - Avatar Name (Bold, 14px)
  - Creation Date ("Erstellt: 1 Tag ago")
  - Creation Type Badge: "🤖 AI-Generiert" oder "📷 Hochgeladen"
  - Hover Actions: [Ansehen] [Bearbeiten] [In Story nutzen]
  - Favorit Star (fill bei Favoriten)

- **Empty State:**
  ```
  [Illustration: Leere Avatare Silhouette]
  "Noch keine Avatare? Erstelle deinen ersten Avatar! 👤"
  [CTA Button: "Avatar erstellen"]
  ```

- **"+ Neuer Avatar" Card:**
  - Plus Icon in Kreis mit Glasmorphismus
  - Hover: Rainbow Border Animation
  - Click: Öffnet AvatarWizard

### Interaktivität:
- **Drag & Reorder** (Optional): Ziehe Avatare um Reihenfolge zu ändern
- **Tap Avatar:** Öffnet Avatar Detail View
- **Long Press:** Menü (Edit, Delete, Make Favorite)
- **Quick Share:** Avatar teilen Badge

### Colors:
- Background: Glasmorphism Box (rgba(76, 201, 216, 0.08))
- Text: Dunkel Cyan-Grün
- Accents: Gradient Cyan-Türkis

---

## 📚 SECTION 3: DOKUMENTATIONEN (Dokus Overview)

### Visual Design:
```
┌──────────────────────────────────────────────────────────────┐
│  📚 Meine Dokumentationen                    [Alle anzeigen →] │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │              │  │              │  │              │        │
│  │   Cover 1    │  │   Cover 2    │  │   Cover 3    │        │
│  │              │  │              │  │              │        │
│  │ [Title]      │  │ [Title]      │  │ [+ Neu]      │        │
│  │ Thema:       │  │ Thema:       │  │              │        │
│  │ [Topic]      │  │ [Topic]      │  │              │        │
│  │ 5 Tage ago   │  │ 2 Wochen ago │  │              │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

### Inhalte:
- **Section Title:** "📚 Meine Dokumentationen" mit Buch Icon
- **Display Mode:** Carousel/Grid (3-4 visible)
- **Card Elements pro Doku:**
  - Cover Image (Ähnlich Stories, aber mit Topic-Farb-Tag)
  - Doku Title (Bold, 16px)
  - Topic Tag (z.B. "🔬 Wissenschaft", "🌍 Geographie")
  - Last Modified ("5 Tage ago")
  - Hover Actions: [Lesen] [Bearbeiten] [Drucken]
  - Completion Status: "75% fertig" Progress Bar

- **Empty State:**
  ```
  [Illustration: Kind mit Lupe & Buch]
  "Noch keine Dokumentationen? Erstelle eine und lerne neues! 📖"
  [CTA Button: "Dokumentation erstellen"]
  ```

- **"+ Neue Doku" Card:**
  - Plus Icon mit Lightbulb Animation
  - Hover: Knowledge Sparkles
  - Click: Öffnet DokuWizard

### Interaktivität:
- **Filter by Topic:** Topic Tags als Filter
- **Tap Card:** Öffnet Doku Reader
- **Long Press:** Optionen Menü
- **Share Badge:** Zum Teilen mit Familie/Schule

### Colors:
- Background: Glasmorphism Box (rgba(255, 185, 80, 0.08))
- Text: Orange-Braun
- Accents: Gradient Orange-Gelb

---

## 🎨 DESIGN SYSTEM & STYLING

### Color Palette:
```javascript
Primary Gradient:    A989F2 (Violett) → FF6B9D (Pink)
Secondary Gradient:  4EC9D8 (Cyan) → 3FD68D (Grün)
Accent Gradient:     FFB950 (Orange) → FDD95C (Gelb)

Backgrounds:
- Primary:     F8F9FE (Sehr Helles Violett)
- Secondary:   FFFFFF (Weiß mit 0.5 opacity)
- Glass:       rgba(255, 255, 255, 0.1) mit blur(20px)

Text:
- Primary:     2D1B4E (Dunkes Violett)
- Secondary:   6B5B95 (Medium Violett)
- Accent:      Gradient Primary

Borders:
- Light:       E8DFF5 (Helles Violett)
- Medium:      D4C8E8
- Dark:        A989F2
```

### Typography:
```
Heading 1 (Section Titles):    28px, Bold, Color.Primary, Letter-spacing: 0.5px
Heading 2 (Card Titles):       18px, Bold, Color.Primary
Body (Descriptions):           14px, Regular, Color.Secondary, Line-height: 1.6
Caption (Dates/Meta):          12px, Regular, Color.Secondary, Opacity: 0.7
```

### Spacing:
```
Section Padding:      32px top, 24px bottom
Card Grid Gap:        20px horizontal, 16px vertical
Card Padding:         16px
Button Padding:       12px 24px (medium), 16px 32px (large)
```

### Shadows & Effects:
```
Card Shadow:          0 8px 24px rgba(169, 137, 242, 0.15)
Hover Shadow:         0 12px 36px rgba(169, 137, 242, 0.25)
Glow Effect:          box-shadow: 0 0 20px rgba(169, 137, 242, 0.3)
Glassmorphism:        backdrop-filter: blur(20px), border: 1px solid rgba(255,255,255,0.2)
```

### Border Radius:
```
Small Cards:          12px
Medium Cards:         16px
Large Cards:          20px
Buttons:              12px
Section:              24px
```

### Animations:
```
Entrance (Fade In):   0.6s ease-out
Hover Scale:          1.05x, 0.3s ease-out
Micro-interactions:   0.2s - 0.4s
Stagger (Multiple):   100ms delay between items
Float Animation:      2-3s loop, ±10px vertical
Glow Pulse:           2s infinite
```

---

## 📱 RESPONSIVE DESIGN

### Breakpoints:
```
Mobile:    320px - 767px    (1 column, stacked)
Tablet:    768px - 1024px   (2 columns)
Desktop:   1025px+          (3 columns full)
```

### Mobile Considerations:
- Header: Compact version, Avatar mini, simplified greeting
- Quick Actions: Stack vertically (1 button full width)
- Sections: Full width cards, horizontal scroll carousel
- Bottom Navigation: Sticky footer with icon tabs
- Touch targets: Minimum 44px height/width

---

## 🎯 UX Best Practices

### Navigation:
- **Top Header:** Sticky, always accessible
- **Bottom Navigation:** Tab-based (Home, Stories, Avatars, Dokus, Profile)
- **Breadcrumb:** Optional, nur auf Sub-pages

### Loading States:
- Skeleton cards während Daten laden
- Pulsing animations für Spannung
- "Momente bitte..." Messages mit Emojis

### Empty States:
- Friendly Illustration (Kind, Charakter, Objekt)
- Clear Message ("Noch keine...")
- Actionable CTA Button
- Encouraging Emoji & Tone

### Success States:
- Green checkmark animation
- Celebration confetti (optional)
- Toast notifications mit Feedback

### Error Handling:
- Friendly error messages (kein Tech-Jargon)
- Emoji für Visual Cue
- Retry/Help Button
- Non-intrusive positioning

### Accessibility:
- Color contrast > 4.5:1 für Text
- Font size mindestens 14px
- Keyboard navigation full support
- Screen reader friendly (alt text, ARIA labels)
- No rapid flashing (< 3 Hz)

---

## ✨ SPECIAL ELEMENTS & MICRO-INTERACTIONS

### 1. Greeting Personalization:
```
Morning (6-12):    "☀️ Guten Morgen, [Name]! Bist du bereit für ein Abenteuer?"
Afternoon (12-18): "🌤️ Guten Nachmittag! Zeit für eine neue Geschichte?"
Evening (18-21):   "🌙 Gute Nacht! Lass uns noch eine Gute-Nacht-Geschichte schreiben?"
Night (21-6):      "⭐ Du bist spät wach! Lass uns eine Traum-Geschichte schreiben?"
```

### 2. Reward System:
- Badges für Meilensteine ("Erste Geschichte", "5 Avatare erstellt")
- Streak Counter ("Du schreibst 5 Tage hintereinander 🔥")
- Level-up Notifications
- Mini Celebratory Animations

### 3. Seasonal/Holiday Themes:
- Easter: 🐰 Süße Oster-Avatare
- Halloween: 👻 Spooky Design
- Christmas: ❄️ Winter Wonderland Theme
- Back to School: 📚 Learn Mode Highlights

### 4. Quick Tips & Features:
- Tooltip auf Hover ("Klick hier um eine neue Geschichte zu starten!")
- Info Icon mit Popover ("Stories sind gespeicherte Geschichten, die du jederzeit lesen kannst")
- Weekly Tips: "💡 Wusste du? Du kannst deine Avatare in mehreren Geschichten nutzen!"

---

## 🔐 Safety & Privacy Features (Sichtbar für Eltern)

### Eltern-Dashboard Badge:
- Small lock icon oben rechts
- Klick öffnet Parental Controls
- Shows: Bildschirmzeit, Content Filter, Friend Requests

### Privacy-Conscious Design:
- Keine Echtnahmen in Default
- Optional Sharing Controls per Story
- Friends-only oder Public Toggle

---

## 📊 Metrics & Analytics Integration

### Tracking Points (Non-invasive):
- Section clicks (Stories, Avatars, Dokus)
- CTA Button interactions
- Feature discovery (First time users)
- Content completion rates

---

## 🚀 Implementation Priority

### Phase 1 (MVP):
1. Header with Greeting ✅
2. Quick Action Buttons ✅
3. Stories Overview ✅
4. Avatars Overview ✅

### Phase 2:
5. Dokumentations Overview ✅
6. Mobile Responsiveness ✅
7. Loading States ✅

### Phase 3:
8. Micro-interactions & Animations ✅
9. Seasonal Themes
10. Reward System

---

## 🎬 Figma/Design File Structure (Recommended)

```
Talea Homepage Design
├── 📱 Mobile (320px)
├── 📱 Tablet (768px)
├── 🖥️ Desktop (1440px)
├── 🎨 Component Library
│   ├── Buttons
│   ├── Cards
│   ├── Sections
│   ├── Icons
│   └── Animations
├── 📊 Prototypes
│   ├── User Flow
│   └── Interactions
└── 📝 Design System
    ├── Colors
    ├── Typography
    ├── Spacing
    └── Shadows
```

---

## 💬 Tone of Voice

**Keywords:** Magical ✨ | Playful 🎉 | Encouraging 💪 | Safe 🔐 | Educational 📚 | Fun-loving 😄

**Example Headlines:**
- "Lass deine Fantasie fliegen!" (nicht: "Schreibe eine Geschichte")
- "Erschaffe dein digitales Alter Ego!" (nicht: "Avatar erstellen")
- "Wissen teilen & verbreiten!" (nicht: "Dokumentationen")

---

## 📞 Call-to-Actions Summary

| Action | Button Text | Icon | Color | Target |
|--------|------------|------|-------|--------|
| New Story | "Neue Geschichte Schreiben" | 📖 | Violett-Pink | /story |
| New Avatar | "Avatar Erstellen" | 🎭 | Cyan-Grün | /avatar/create |
| New Doku | "Dokumentation Erstellen" | 📚 | Orange-Gelb | /doku/create |
| View All Stories | "Alle Geschichten anzeigen →" | → | Violett | /stories |
| View All Avatars | "Alle Avatare anzeigen →" | → | Cyan | /avatar |
| View All Dokus | "Alle Dokumentationen anzeigen →" | → | Orange | /doku |

---

**Design Kompletiert!** 🎨✨

Dieser Prompt kann direkt an einen UI/UX Designer oder an ein AI Design Tool (wie Midjourney, Figma AI) übergeben werden.
