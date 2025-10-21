# 🌐 Domain Setup Guide - talea.website

## Schritt-für-Schritt Anleitung: Strato Domain → Railway

---

## 📋 Overview

**Ziel:** `talea.website` → Railway Frontend
**Subdomains:**
- `www.talea.website` → Frontend
- `api.talea.website` → Backend (Encore)
- `mcp.talea.website` → MCP Main Server
- `validator.talea.website` → MCP Validator

---

## 🎯 Step 1: Railway Custom Domain konfigurieren

### Frontend Service

1. **Railway Dashboard öffnen**
   - Gehe zu: `talea-frontend` Service
   - Click auf **Settings** → **Networking**

2. **Custom Domain hinzufügen**
   - Click **"Generate Domain"** (falls noch nicht gemacht)
   - Notiere die Railway URL: `frontend-production-xxxx.up.railway.app`

3. **Custom Domain eintragen**
   - Click **"Add Custom Domain"**
   - Eingeben:
     ```
     talea.website
     www.talea.website
     ```

4. **DNS Records anzeigen**
   - Railway zeigt dir jetzt die benötigten DNS-Einträge an
   - **WICHTIG:** Diese kopieren für Schritt 2!

**Erwartete DNS Records:**
```
Type: CNAME
Name: www
Value: frontend-production-xxxx.up.railway.app

Type: A
Name: @
Value: 104.21.x.x (Railway IP)

Type: AAAA
Name: @
Value: 2606:4700:... (Railway IPv6)
```

### Backend Service (Optional)

1. **Railway Dashboard** → `talea-backend` Service
2. **Settings** → **Networking** → **Add Custom Domain**
3. Eingeben:
   ```
   api.talea.website
   ```

### MCP Servers (Optional)

**MCP Main:**
```
mcp.talea.website
```

**MCP Validator:**
```
validator.talea.website
```

---

## 🔧 Step 2: Strato DNS konfigurieren

### 2.1 Strato Login

1. Gehe zu: https://www.strato.de/apps/CustomerService
2. Login mit deinen Zugangsdaten
3. Navigiere zu: **Domains** → **talea.website** → **DNS-Einstellungen**

### 2.2 DNS Records hinzufügen

**WICHTIG:** Lösche ALLE bestehenden A/CNAME Records für `talea.website`!

#### Option A: CNAME Setup (Empfohlen für www)

**Für www.talea.website:**
```
Typ: CNAME
Name: www
Wert: frontend-production-0b44.up.railway.app
TTL: 3600 (oder Auto)
```

**Für Root Domain (talea.website):**

⚠️ **Problem:** Root Domains (@) können bei Strato KEINE CNAME Records haben!

**Lösung 1: Domain Forwarding (Einfach)**
```
Strato → Domains → talea.website → Weiterleitungen
Von: talea.website
Nach: https://www.talea.website
Typ: 301 (Permanent)
```

**Lösung 2: A/AAAA Records (Fortgeschritten)**

Falls Railway statische IPs gibt:
```
Typ: A
Name: @
Wert: [Railway IP aus Dashboard]
TTL: 3600

Typ: AAAA
Name: @
Wert: [Railway IPv6 aus Dashboard]
TTL: 3600
```

⚠️ **Nachteil:** IPs können sich ändern!

#### Option B: Railway als Cloudflare Proxy (Empfohlen!)

**Besser:** Nutze Cloudflare als DNS Provider (kostenlos):

1. **Cloudflare Account erstellen**: https://dash.cloudflare.com/sign-up
2. **Domain hinzufügen**: `talea.website`
3. **Cloudflare Nameserver notieren**:
   ```
   ns1.cloudflare.com
   ns2.cloudflare.com
   ```

4. **Strato Nameserver ändern**:
   - Strato → Domains → talea.website → Nameserver
   - Ersetze Strato NS mit Cloudflare NS

5. **Cloudflare DNS konfigurieren**:
   ```
   Type: CNAME
   Name: @
   Content: frontend-production-xxxx.up.railway.app
   Proxy: Enabled (Orange Cloud)

   Type: CNAME
   Name: www
   Content: frontend-production-xxxx.up.railway.app
   Proxy: Enabled (Orange Cloud)

   Type: CNAME
   Name: api
   Content: backend-production-xxxx.up.railway.app
   Proxy: Enabled

   Type: CNAME
   Name: mcp
   Content: talea-mcp-main-production.up.railway.app
   Proxy: Enabled

   Type: CNAME
   Name: validator
   Content: talea-mcp-validator-production.up.railway.app
   Proxy: Enabled
   ```

**Vorteile Cloudflare:**
- ✅ CNAME für Root Domain (@) möglich
- ✅ Kostenlose SSL Zertifikate
- ✅ DDoS Protection
- ✅ CDN (schnellere Ladezeiten)
- ✅ Analytics

---

## 📝 Step 3: Strato DNS Konfiguration (Direkt)

**Falls du OHNE Cloudflare arbeitest:**

### 3.1 Strato DNS Manager

**Login:**
```
https://www.strato.de/apps/CustomerService
```

**Navigation:**
```
Paket-Verwaltung → Domains → talea.website → Verwaltung → DNS-Einstellungen
```

### 3.2 DNS Records eintragen

**CNAME für www:**
```
Hostname: www
Typ: CNAME
Wert: frontend-production-0b44.up.railway.app.
TTL: 3600
```

**Root Domain Weiterleitung:**
```
Strato → Weiterleitungen → Neue Weiterleitung
Von: talea.website
Nach: https://www.talea.website
Typ: 301 (Permanent)
Frame: Nein
```

**API Subdomain:**
```
Hostname: api
Typ: CNAME
Wert: [deine-encore-railway-url].up.railway.app.
TTL: 3600
```

**MCP Subdomains:**
```
Hostname: mcp
Typ: CNAME
Wert: talea-mcp-main-production.up.railway.app.
TTL: 3600

Hostname: validator
Typ: CNAME
Wert: talea-mcp-validator-production.up.railway.app.
TTL: 3600
```

---

## ⏱️ Step 4: DNS Propagation warten

### Wie lange dauert es?

- **Strato DNS:** 1-24 Stunden
- **Cloudflare DNS:** 5-30 Minuten

### DNS Propagation prüfen

**Online Tools:**
```
https://www.whatsmydns.net/#CNAME/www.talea.website
https://dnschecker.org/
```

**Command Line:**
```bash
# Windows
nslookup www.talea.website

# macOS/Linux
dig www.talea.website
```

**Erwartetes Ergebnis:**
```
www.talea.website. 3600 IN CNAME frontend-production-xxxx.up.railway.app.
```

---

## 🔒 Step 5: SSL Zertifikat (HTTPS)

### Railway SSL (Automatisch)

Railway generiert automatisch SSL-Zertifikate via Let's Encrypt.

**Prüfen:**
1. Railway Dashboard → Frontend Service → Settings → Networking
2. Custom Domain sollte **"SSL Active"** anzeigen
3. Kann 5-15 Minuten dauern nach DNS Propagation

### Cloudflare SSL (wenn genutzt)

**Cloudflare Dashboard → SSL/TLS:**
```
Encryption Mode: Full (Strict)
Edge Certificates: Enabled
Always Use HTTPS: Enabled
```

---

## ✅ Step 6: Testen

### 6.1 Domain Aufruf testen

```bash
# Browser
https://talea.website
https://www.talea.website
https://api.talea.website/health
https://mcp.talea.website/health
https://validator.talea.website/health
```

### 6.2 SSL prüfen

```bash
# Online Tool
https://www.ssllabs.com/ssltest/analyze.html?d=talea.website
```

### 6.3 Redirects prüfen

```bash
# HTTP → HTTPS
curl -I http://talea.website
# Sollte: 301 → https://talea.website

# Root → www
curl -I https://talea.website
# Sollte: 301 → https://www.talea.website (falls konfiguriert)
```

---

## 🔧 Step 7: Frontend & Backend konfigurieren

### Frontend Vite Config

**File:** `frontend/vite.config.ts`

```typescript
export default defineConfig({
  // ... existing config
  server: {
    host: true, // Allow external connections
    port: 5173,
  },
  preview: {
    host: true,
    port: 5173,
  },
});
```

### Encore Backend CORS

**File:** `backend/encore.app`

```json
{
  "id": "talea-storytelling-platform-4ot2",
  "lang": "typescript",
  "global_cors": {
    "allow_origins_with_credentials": [
      "http://localhost:5173",
      "https://talea.website",
      "https://www.talea.website",
      "https://frontend-production-0b44.up.railway.app"
    ],
    "debug": true
  }
}
```

### Clerk Domains

**Clerk Dashboard → Configure → Domains:**

Füge hinzu:
```
https://talea.website
https://www.talea.website
```

**Authorized Origins:**
```
https://talea.website
https://www.talea.website
```

---

## 📊 Zusammenfassung der DNS-Einträge

### Option A: Mit Cloudflare (Empfohlen)

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| CNAME | @ | frontend-production-xxxx.up.railway.app | ✅ |
| CNAME | www | frontend-production-xxxx.up.railway.app | ✅ |
| CNAME | api | backend-production-xxxx.up.railway.app | ✅ |
| CNAME | mcp | talea-mcp-main-production.up.railway.app | ✅ |
| CNAME | validator | talea-mcp-validator-production.up.railway.app | ✅ |

### Option B: Nur Strato (Eingeschränkt)

| Type | Name | Content | TTL |
|------|------|---------|-----|
| CNAME | www | frontend-production-xxxx.up.railway.app | 3600 |
| WEITERLEITUNG | @ | https://www.talea.website | - |
| CNAME | api | backend-production-xxxx.up.railway.app | 3600 |

---

## 🐛 Troubleshooting

### Problem: "DNS_PROBE_FINISHED_NXDOMAIN"

**Lösung:**
1. DNS Records nochmal prüfen
2. DNS Cache leeren: `ipconfig /flushdns` (Windows)
3. Warten (DNS Propagation)

### Problem: "SSL Certificate Invalid"

**Lösung:**
1. Railway Dashboard → Domain Status prüfen
2. Warte 15 Minuten für Let's Encrypt
3. Verify DNS Records korrekt

### Problem: "CORS Error"

**Lösung:**
1. Backend `encore.app` → `allow_origins_with_credentials` aktualisieren
2. Clerk Dashboard → Domains hinzufügen
3. Redeploy Backend

### Problem: "Mixed Content Warnings"

**Lösung:**
1. Verify alle API Calls nutzen `https://`
2. Update Frontend Environment Variables:
   ```
   VITE_API_URL=https://api.talea.website
   ```

---

## 🚀 Best Practices

### 1. Nutze Cloudflare
- Kostenlos
- Besseres SSL Management
- CDN für Performance
- DDoS Protection

### 2. Redirects konfigurieren
```
http://talea.website → https://www.talea.website
http://www.talea.website → https://www.talea.website
https://talea.website → https://www.talea.website
```

### 3. Environment Variables aktualisieren

**Frontend (.env.production):**
```env
VITE_API_URL=https://api.talea.website
VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxx
```

**Backend (Railway):**
```env
FRONTEND_URL=https://www.talea.website
```

---

## 📞 Support

**Strato Support:**
- Hotline: 030 300 146 0
- Email: support@strato.de
- Hilfe: https://www.strato.de/faq/

**Railway Docs:**
- Custom Domains: https://docs.railway.app/guides/public-networking#custom-domains

**Cloudflare Docs:**
- Getting Started: https://developers.cloudflare.com/fundamentals/setup/

---

## ✅ Checkliste

- [ ] Railway Custom Domains hinzugefügt
- [ ] Strato DNS Records konfiguriert
- [ ] DNS Propagation abgeschlossen
- [ ] SSL Zertifikate aktiv
- [ ] CORS in Backend konfiguriert
- [ ] Clerk Domains hinzugefügt
- [ ] Frontend Environment Variables aktualisiert
- [ ] Alle Domains testen (talea.website, www, api, mcp, validator)
- [ ] SSL Testen (A+ Rating)
- [ ] Mobile Testing

---

**Viel Erfolg mit deiner neuen Domain! 🎉**
