# 🔐 Clerk Domain Setup - talea.website

## Clerk Dashboard konfigurieren

### Schritt 1: Clerk Dashboard öffnen

1. Gehe zu: https://dashboard.clerk.com
2. Select dein **Talea Project**
3. Sidebar: **Configure** → **Domains**

---

### Schritt 2: Production Domain hinzufügen

**Frontend URLs hinzufügen:**

1. Click **"Add domain"** oder **"Frontend API"**
2. Eingeben:
   ```
   https://www.talea.website
   ```
3. Click **"Add"**

4. Noch eine hinzufügen:
   ```
   https://talea.website
   ```

---

### Schritt 3: Authorized Origins konfigurieren

1. Sidebar: **Configure** → **Allowed origins**
2. Click **"Add origin"**
3. Eingeben:
   ```
   https://www.talea.website
   https://talea.website
   ```

---

### Schritt 4: Development Keys entfernen (später)

⚠️ **Aktuell siehst du diese Warnung:**
```
Clerk has been loaded with development keys.
```

**Für Production:**
1. Clerk Dashboard → **API Keys**
2. Kopiere **Publishable Key** (beginnt mit `pk_live_xxx`)
3. Update Frontend Environment Variable in Railway:
   ```
   VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxx
   ```

**Aber erstmal:** Lass Development Keys aktiv zum Testen!

---

## ✅ Fertig!

Nach diesen Änderungen sollte Clerk funktionieren ohne Warnung.
