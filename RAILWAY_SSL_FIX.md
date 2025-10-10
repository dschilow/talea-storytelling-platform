# Railway PostgreSQL SSL Fix

## Problem
Railway PostgreSQL nutzt selbst-signierte Zertifikate, was zu diesem Fehler führt:
```
database story: connection pool error: Error { kind: Tls, cause: Some(Ssl(Error { code: ErrorCode(1), cause: Some(Ssl(ErrorStack([Error { code: 167772294, library: "SSL routines", function: "tls_post_process_server_certificate", reason: "certificate verify failed"
```

## Lösung

### Option 1: SSL deaktivieren (empfohlen für Railway)
Setze in den Railway Environment Variables:

```bash
DATABASE_URL=postgresql://${{PGUSER}}:${{POSTGRES_PASSWORD}}@${{RAILWAY_PRIVATE_DOMAIN}}:5432/${{PGDATABASE}}?sslmode=disable
```

### Option 2: SSL ohne Verifizierung
Falls SSL benötigt wird, aber Zertifikat-Verifizierung übersprungen werden soll:

```bash
DATABASE_URL=postgresql://${{PGUSER}}:${{POSTGRES_PASSWORD}}@${{RAILWAY_PRIVATE_DOMAIN}}:5432/${{PGDATABASE}}?sslmode=require&sslrootcert=/dev/null
```

### Option 3: SSL mit allow (funktioniert mit selbst-signierten Zertifikaten)
```bash
DATABASE_URL=postgresql://${{PGUSER}}:${{POSTGRES_PASSWORD}}@${{RAILWAY_PRIVATE_DOMAIN}}:5432/${{PGDATABASE}}?sslmode=allow
```

## Setzen in Railway

1. Gehe zu deinem Railway Projekt
2. Wähle den **Backend Service** aus
3. Gehe zu **Variables**
4. Bearbeite `DATABASE_URL` und füge `?sslmode=disable` am Ende hinzu
5. Klicke auf **Redeploy** beim Backend Service

## Wichtig
- Dies muss NUR beim Backend Service gesetzt werden
- Der PostgreSQL Service braucht keine Änderungen
- Nach dem Setzen wird automatisch neu deployed
