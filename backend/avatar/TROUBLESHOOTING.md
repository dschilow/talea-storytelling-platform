# Avatar Migration API – Fehlerprotokoll

## 2025-11-20: Build brach bei Encore-Docker-Image ab
- **Symptom:** GitHub Actions schlugen im Schritt „Build Encore Docker Image“ mit `invalid database query: syntax error at or near "$1"` fehl (`backend/avatar/migration-api.ts:28`).
- **Ursache:** `avatarDB.exec\`${req.migrationSql}\`` benutzt den Encore-SQL-Template-Tag. Dadurch wurde die komplette eingehende SQL als einzelner Parameter `$1` behandelt und Postgres meldete einen Syntaxfehler.
- **Fix:** Keine Template-Interpolation verwenden, sondern den SQL-String direkt übergeben:
  ```ts
  // vorher
  await avatarDB.exec`${req.migrationSql}`;

  // nachher
  await avatarDB.exec(req.migrationSql);
  ```
- **Betroffene Commits:** Letzter guter Build: `7faad7c` (`feat: add cinematic story and doku viewers…`). Der Fehler kam mit `0734749` (Migration-Endpoint hinzugefügt). Der Fix ist in `5a2be96` (`fix: allow raw avatar migration sql`).

## Wie prüfen?
- Build/Action erneut laufen lassen.
- Bei Bedarf Endpoint lokal per Encore ausführen und einen einfachen SQL-Befehl testen, z.B. `SELECT 1;`.
