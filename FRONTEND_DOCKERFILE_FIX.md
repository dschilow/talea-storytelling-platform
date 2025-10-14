# 🔧 Frontend Dockerfile Fix - Quick Guide

## ❌ Das Problem

Railway liest nur **EINE** `railway.toml` Datei pro Projekt.

**Ergebnis:**
- Frontend Service versucht `Dockerfile.backend` zu nutzen ❌
- Build schlägt fehl mit Encore-Errors ❌

## ✅ Die Lösung

Du musst **manuell** in Railway konfigurieren, welches Dockerfile jeder Service nutzt.

---

## Schritt-für-Schritt Fix

### 1. Backend Service

Railway Dashboard → **Backend Service** → **Settings** → **Build**

```
Builder: DOCKERFILE
Dockerfile Path: Dockerfile.backend
```

### 2. Frontend Service ⚠️ WICHTIG

Railway Dashboard → **Frontend Service** → **Settings** → **Build**

```
Builder: DOCKERFILE
Dockerfile Path: Dockerfile.frontend  ← MUSS MANUELL GESETZT WERDEN!
```

### 3. Beide Services neu deployen

Nach der Änderung:
- Beide Services → **Redeploy**
- Oder: Neuen Commit pushen

---

## Verification

### ✅ Backend Build erfolgreich
```
Building with Dockerfile: Dockerfile.backend
Installing Encore CLI...
✓ Backend running on port 8080
```

### ✅ Frontend Build erfolgreich
```
Building with Dockerfile: Dockerfile.frontend
Building frontend assets...
✓ Nginx serving on port 80
```

---

## Warum ist das nötig?

Railway's Limitierung:
- ❌ Kann nicht `railway.frontend.toml` für Frontend Service nutzen
- ❌ Nutzt nur `railway.toml` für ALLE Services
- ✅ Manuelle Konfiguration umgeht diese Limitierung

---

## Quick Checklist

- [ ] Backend Service → Settings → Build → `Dockerfile.backend`
- [ ] Frontend Service → Settings → Build → `Dockerfile.frontend`
- [ ] Beide Services redeploy
- [ ] Backend logs zeigen "Encore CLI installed" ✓
- [ ] Frontend logs zeigen "Nginx" ✓

---

**Nach diesem Fix sollte Frontend sauber deployen!** 🚀

**Vollständige Anleitung:** [RAILWAY_MANUAL_CONFIG.md](./RAILWAY_MANUAL_CONFIG.md)

