# 🔧 Märchen-Migrationen manuell ausführen

Da die automatischen Migrationen nicht funktionieren, hier die **schnellste Lösung**:

## Option 1: Via Railway CLI (Empfohlen)

### 1. Installiere Railway CLI
```bash
npm install -g @railway/cli
```

### 2. Login
```bash
railway login
```

### 3. Verbinde dich mit deinem Projekt
```bash
cd c:\MyProjects\Talea\talea-storytelling-platform
railway link
```

### 4. Führe die Migrationen aus

**Migration 10:**
```bash
railway run psql $DATABASE_URL < backend/fairytales/migrations/10_add_47_classic_fairy_tales.up.sql
```

**Migration 11:**
```bash
railway run psql $DATABASE_URL < backend/fairytales/migrations/11_add_andersen_fairy_tales.up.sql
```

**Migration 12:**
```bash
railway run psql $DATABASE_URL < backend/fairytales/migrations/12_add_russian_arabian_fairy_tales.up.sql
```

**Migration 13:**
```bash
railway run psql $DATABASE_URL < backend/fairytales/migrations/13_add_classics_legends_fables.up.sql
```

### 5. Prüfe das Ergebnis
```bash
railway run psql $DATABASE_URL -c "SELECT COUNT(*) FROM fairy_tales;"
```

Sollte **50** zurückgeben.

---

## Option 2: Via psql direkt

Wenn du `psql` installiert hast (PostgreSQL Client):

```bash
psql "postgresql://postgres:HqJVXXiJiVtiCOJuOmEatCjuTEULvpjr@autorack.proxy.rlwy.net:42832/railway" -f backend/fairytales/migrations/10_add_47_classic_fairy_tales.up.sql

psql "postgresql://postgres:HqJVXXiJiVtiCOJuOmEatCjuTEULvpjr@autorack.proxy.rlwy.net:42832/railway" -f backend/fairytales/migrations/11_add_andersen_fairy_tales.up.sql

psql "postgresql://postgres:HqJVXXiJiVtiCOJuOmEatCjuTEULvpjr@autorack.proxy.rlwy.net:42832/railway" -f backend/fairytales/migrations/12_add_russian_arabian_fairy_tales.up.sql

psql "postgresql://postgres:HqJVXXiJiVtiCOJuOmEatCjuTEULvpjr@autorack.proxy.rlwy.net:42832/railway" -f backend/fairytales/migrations/13_add_classics_legends_fables.up.sql
```

---

## Option 3: Via TablePlus / DBeaver / pgAdmin

1. Öffne dein bevorzugtes PostgreSQL GUI Tool
2. Verbinde mit:
   - **Host**: `autorack.proxy.rlwy.net`
   - **Port**: `42832`
   - **Database**: `railway`
   - **User**: `postgres`
   - **Password**: `HqJVXXiJiVtiCOJuOmEatCjuTEULvpjr`

3. Öffne nacheinander jede `.up.sql` Datei:
   - `backend/fairytales/migrations/10_add_47_classic_fairy_tales.up.sql`
   - `backend/fairytales/migrations/11_add_andersen_fairy_tales.up.sql`
   - `backend/fairytales/migrations/12_add_russian_arabian_fairy_tales.up.sql`
   - `backend/fairytales/migrations/13_add_classics_legends_fables.up.sql`

4. Führe jede Datei aus (Execute/Run)

5. Prüfe mit:
   ```sql
   SELECT COUNT(*) FROM fairy_tales;
   ```

---

## ✅ Erfolgskontrolle

Nach erfolgreicher Ausführung:

1. **Datenbank-Check:**
   ```sql
   SELECT COUNT(*) FROM fairy_tales;
   ```
   → Sollte **50** sein

2. **Website-Check:**
   - Gehe zu https://www.talea.website/fairytales
   - Du solltest **50 Märchen** sehen!

3. **Märchen nach Quelle:**
   ```sql
   SELECT source, COUNT(*)
   FROM fairy_tales
   GROUP BY source
   ORDER BY source;
   ```

   Erwartetes Ergebnis:
   ```
   1001-nights | 3
   aesop       | 4
   andersen    | 9
   grimm       | 16
   legend      | 5
   literature  | 6
   russian     | 8
   ```

---

## 🆘 Troubleshooting

**"Table fairy_tales does not exist"**
→ Stelle sicher, dass du mit der richtigen Datenbank verbunden bist (railway, nicht eine andere!)

**"Duplicate key violation"**
→ Die Migration wurde bereits teilweise ausgeführt. Prüfe den Count:
```sql
SELECT COUNT(*) FROM fairy_tales;
```

**Netzwerkfehler**
→ Prüfe ob die Railway Connection Strings aktuell sind (können sich ändern!)
