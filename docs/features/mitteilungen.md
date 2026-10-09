# Mitteilungen

Der Bereich `/mitteilungen` bündelt Produktneuigkeiten, neue Audio-Dokus, neue Charaktere, Avatar-Freigaben und Tipps. Er ist über die Desktop-Navigation und die Glocke oben in der App erreichbar. Die Glocke zeigt die Zahl ungelesener, nicht archivierter Mitteilungen aus den aktivierten Themen.

## Bedienung

Mitteilungen lassen sich durchsuchen, nach Thema filtern, einzeln als gelesen markieren und archivieren. Das Archiv bietet die Wiederherstellung in den Eingang. „Alle gelesen“ gilt für den Stand der zuletzt geladenen Übersicht; später eintreffende Mitteilungen bleiben ungelesen.

Unter „Deine Themen“ können die fünf Mitteilungsarten getrennt ein- oder ausgeschaltet werden. Auf kleinen Bildschirmen öffnet „Themen“ diese Auswahl als Dialog. Die Einstellungen, der Lesestatus und das Archiv werden pro Benutzerkonto im Backend gespeichert und gelten für alle Kinderprofile und Geräte dieses Kontos.

Ein geteilter Avatar führt zur eigenen Kopie beim Empfänger. Vor dem Öffnen wechselt die App zum Kinderprofil dieser Kopie. Ist das Profil archiviert oder nicht verfügbar, zeigt sie einen Hinweis. Eine Audio-Mitteilung öffnet die betreffende Folge in der vorhandenen Audio-Doku-Detailansicht; die bestehenden Abo- und Wiedergabeprüfungen gelten weiterhin.

## Neuigkeiten veröffentlichen

Admins sehen im Eingang den Button „Neuigkeit“. Der Dialog bietet Titel, Text, Mitteilungsart und eine Live-Vorschau. Optional können ein interner Talea-Link, ein Button-Text, eine Anheftung und ein Ablaufdatum ergänzt werden. Damit lassen sich auch neue Spiele, Lernangebote, saisonale Aktionen oder Wartungshinweise ankündigen.

Der Papierkorb einer redaktionellen Neuigkeit entfernt sie für alle Mitglieder nach einer Bestätigung. Das Archiv-Symbol betrifft ausschließlich das eigene Konto. Entfernte Neuigkeiten erhalten intern einen Rückzugszeitpunkt, damit die Startmigration sie nicht erneut veröffentlicht.

## Automatische Quellen

| Quelle | Bedingung | Ziel |
| --- | --- | --- |
| Audio-Dokus | Öffentlich, Audio vorhanden, innerhalb der letzten 90 Tage erstellt | `/doku?mode=audio&episode=<id>` |
| Charakterpool | Aktiv, Bild vorhanden, innerhalb der letzten 90 Tage erstellt | Geschichten-Wizard |
| Avatar-Freigaben | Freigabe an den angemeldeten Benutzer mit einer noch vorhandenen eigenen Kopie | Avatar-Profil der Kopie |
| Redaktionelle Neuigkeiten | Veröffentlicht, nicht zurückgezogen und nicht abgelaufen | Optionaler interner Link |

Individuell gelesene oder archivierte Katalogmitteilungen bleiben über das 90-Tage-Fenster hinaus verfügbar, solange der Quellinhalt weiterhin öffentlich beziehungsweise aktiv ist. Zurückgezogene Inhalte erscheinen auch im Archiv nicht mehr. Persönliche Freigaben und redaktionelle Neuigkeiten haben kein pauschales 90-Tage-Limit.

Die Glocke aktualisiert sich bei aktivem Browser alle 60 Sekunden, bei Rückkehr zum Fenster und nach Wiederherstellung der Verbindung. Wenn während eines geöffneten Eingangs neue ungelesene Mitteilungen erkannt werden, erscheint „Jetzt anzeigen“.

## Implementierung und Prüfung

- `backend/user/notifications.ts`: authentifizierte APIs für Eingang, Zähler, Zustand und Einstellungen; Admin-Prüfung für Veröffentlichungen und Rückzüge.
- `backend/user/notification-model.ts`: Themen, Sortierung, Lesestatus und erlaubte Linkziele.
- `backend/user/migrations/13_notifications.up.sql` und `.down.sql`: redaktionelle Neuigkeiten, Einstellungen und persönlicher Zustand. Persönliche Datensätze werden beim Löschen des Benutzerkontos über Fremdschlüssel mit entfernt.
- `frontend/screens/Notifications/`: responsive Oberfläche und Veröffentlichungsdialog.
- `frontend/contexts/NotificationsContext.tsx`: gemeinsame Zähler und Aktualisierung.

Backend und Frontend müssen gemeinsam bereitgestellt werden. Migration 13 wird vom vorhandenen nummerierten Migrationslauf verarbeitet. Der API-Client wird mit `encore gen client --target leap --output ../frontend/client.ts` aus `backend/` generiert.

Gezielte Tests: `encore test ./user` oder `bun test backend/user/notification-model.test.ts` aus dem Projektstamm. Die Oberfläche wurde zusätzlich mit lokalen Testdaten auf Desktop und bei 320/375 Pixeln geprüft: Suche, Themenfilter, Pagination, Archiv und Wiederherstellung, Einstellungen, Veröffentlichungsdialog, Lesestatus, Fehler- und Leerzustände sowie dunkles Theme.
