# Talea Mobile App - Android

Die mobile Android-App für die Talea Storytelling Platform.

## 🚀 Technologie-Stack

- **React Native** mit **Expo** (SDK 54)
- **TypeScript** für Type-Safety
- **NativeWind** (Tailwind CSS für React Native)
- **React Navigation** für Navigation
- **Redux Toolkit** für State Management
- **Clerk** für Authentication
- **Encore.ts Backend** Integration

## 📋 Voraussetzungen

- **Bun** (Package Manager)
- **Node.js** v18+ (für Expo)
- **Android Studio** (für Android Emulator)
- **Expo Go App** (optional, für Device Testing)

## 🛠️ Setup

### 1. Dependencies installieren

```bash
cd mobile
bun install
```

### 2. Environment Variables konfigurieren

Kopiere `.env.example` zu `.env` und füge deinen Clerk Publishable Key hinzu:

```env
EXPO_PUBLIC_BACKEND_URL=https://backend-2-production-3de1.up.railway.app
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
```

**Wichtig:** Den Clerk Key erhältst du im [Clerk Dashboard](https://dashboard.clerk.com).

### 3. App starten

```bash
# Development Server starten
bun start

# Direkt auf Android Emulator starten
bun run android

# Auf iOS Simulator starten (nur auf macOS)
bun run ios

# Im Web Browser starten
bun run web
```

## 📱 Android Build

### Development Build (APK)

```bash
# EAS CLI installieren (falls noch nicht vorhanden)
npm install -g eas-cli

# Bei EAS anmelden
eas login

# Development Build erstellen
eas build --profile development --platform android
```

### Production Build (AAB für Google Play)

```bash
# Production Build erstellen
eas build --profile production --platform android
```

## 🏗️ Projektstruktur

```
mobile/
├── src/
│   ├── screens/           # App Screens
│   │   ├── Home/          # Home Screen
│   │   ├── Avatar/        # Avatar Management
│   │   ├── Story/         # Story Creation & Reading
│   │   ├── Auth/          # Authentication
│   │   ├── FairyTales/    # Fairy Tales Browser
│   │   └── Profile/       # User Profile
│   ├── components/        # Reusable Components
│   │   ├── common/        # Common UI Elements
│   │   ├── layout/        # Layout Components
│   │   └── ui/            # UI Library Components
│   ├── navigation/        # React Navigation Setup
│   ├── store/             # Redux Store & Slices
│   ├── hooks/             # Custom React Hooks
│   ├── utils/             # Utilities
│   │   ├── api/           # API Client
│   │   ├── auth/          # Auth Utilities
│   │   └── constants/     # Constants (colors, etc.)
│   ├── types/             # TypeScript Types
│   └── config/            # Configuration Files
├── assets/                # Images, Fonts, etc.
├── App.tsx                # Root Component
├── app.json               # Expo Configuration
├── tailwind.config.js     # Tailwind/NativeWind Config
└── package.json           # Dependencies

```

## 🎨 Design System

Die App verwendet das gleiche Design-System wie die Web-Version:

- **Farben:** Lavender (Primary), Peach, Coral, Mint
- **Typografie:** Fredoka (Headlines), Nunito (Body)
- **Style:** Modern Glassmorphism mit sanften Verläufen

## 🔐 Authentication

Die App nutzt **Clerk** für Authentication mit OAuth (Google):

1. User öffnet Auth Screen
2. Klickt auf "Mit Google anmelden"
3. OAuth Flow startet
4. Nach erfolgreicher Anmeldung wird automatisch zur Main App navigiert
5. Auth Token wird automatisch im API Client gesetzt

## 🌐 API Integration

Der API Client (`src/utils/api/client.ts`) kommuniziert mit dem Encore Backend:

```typescript
import { api } from '@/utils/api/client';

// Avatare laden
const avatars = await api.avatar.list();

// Story erstellen
const story = await api.story.generate({ title: '...', config: {...} });
```

## 📦 Wichtige Commands

```bash
# Development Server starten
bun start

# Android Emulator starten
bun run android

# Dependencies hinzufügen
bun add <package-name>

# TypeScript Check
bunx tsc --noEmit

# Metro Bundler Cache clearen
bunx expo start --clear
```

## 🐛 Troubleshooting

### Problem: "Clerk Key Missing"

**Lösung:** Stelle sicher, dass `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` in `.env` gesetzt ist.

### Problem: "Network Error" beim API Call

**Lösung:**
1. Prüfe ob Backend erreichbar ist: https://backend-2-production-3de1.up.railway.app
2. Stelle sicher, dass du angemeldet bist (Auth Token wird automatisch gesetzt)

### Problem: Android Build schlägt fehl

**Lösung:**
1. Stelle sicher, dass alle Dependencies installiert sind: `bun install`
2. Lösche `node_modules` und `.expo` Ordner, dann neu installieren
3. Prüfe ob Android SDK installiert ist

## 🚧 Roadmap

- [x] Basic App Setup
- [x] Authentication mit Clerk
- [x] Navigation Structure
- [x] Avatar Screen (List View)
- [x] Story Screen (List View)
- [x] Profile Screen
- [ ] Avatar Creation Flow
- [ ] Story Creation Wizard
- [ ] Story Reader (mit Bildern)
- [ ] Fairy Tales Integration
- [ ] Offline Support
- [ ] Push Notifications
- [ ] Image Upload für Avatare

## 📝 Hinweise

- Die App ist aktuell im **Early Development** Status
- Nicht alle Features aus der Web-Version sind bereits portiert
- Die API-Integration ist vorbereitet, aber einige Endpoints können noch angepasst werden
- Das Design folgt dem Web-Frontend, ist aber mobile-optimiert

## 🤝 Beitragen

Bei Fragen oder Problemen bitte Issue im Hauptrepository erstellen.

---

Made with ❤️ for Storytellers
