# Rundgang: Funktionsprüfung und Überarbeitung

Stand: 9. Oktober 2026. Geprüft wurden die tatsächlich eingebundenen Routen in `frontend/App.tsx`, die Navigation und die jeweiligen Bildschirme. Der Rundgang richtet sich an Kinder und ihre Familien; Verwaltungswerkzeuge für Administratoren gehören nicht dazu.

Der bisherige Rundgang mit acht Seiten war unvollständig und erklärte die meisten Funktionen über längere Texte. Kleine interaktive Beispiele ersetzten keine verständliche Darstellung der Bereiche.

| Bereich | Bisher | Im neuen Rundgang |
| --- | --- | --- |
| Startseite, Navigation, Profilwechsel | Kaum erklärt | Eigene Seite mit Zuhause, Menü und Kinderprofil |
| Mitteilungen | Nicht erklärt | Glocke auf der Zuhause-Seite; Suche, Themen, Lesestatus und Archiv in den Details |
| Avatare | Vorhanden | Gestalten, Entwicklung, Erinnerungen und Bearbeiten |
| Geschichten erstellen | Vorhanden | Helden, Welten, Stimmung, eigene Ideen, Lernziel und Märchenvorlagen |
| Bibliothek und Figuren | Kaum erklärt | Eigene Seite mit Suche, Filtern und Charaktergeschichten |
| Lesen und Vorlesen | Vorhanden | Kino-, Buch- und Scroll-Ansicht; verfügbares Vorlese-Audio |
| Wissens-Dokus | Vorhanden | Erstellen, Entdecken, Themenwahl und Wiederholen |
| Audio-Dokus und Wiedergabeliste | Fehlten | Eigene Hörwelt-Seite |
| Lernkosmos | Fehlte | Eigene Seite mit Planeten, Monden und Lernfortschritt |
| Reisekarte | Fehlte | Eigene Seite mit Stationen, Aufgaben und Belohnungen |
| Wissens-Quiz und Mitternachts-Alibi | Fehlten | Eigene Seite; Einzelspiel und Familienspiel unterschieden |
| Schatzkammer und Tagebuch | Teilweise erklärt | Fundstücke, Erinnerungen und Mitnehmen in Geschichten |
| Tavi-Chat | Fehlte | Eigene Seite mit Fragen, Ideen und Erstellung im Chat |
| Offline-Nutzung | Fehlte | Vorher speichern, Gerätbindung und Audio erklären |
| Familienprofile und Elterneinstellungen | Teilweise erklärt | Profile, PIN, Lernziele, Grenzen und Einstellungen |

## Gestaltung

16 Seiten einschließlich Begrüßung und Abschluss bilden ein bebildertes Entdeckerbuch. Jede Seite hat eine große Illustration, eine kurze Einladung und drei antippbare Entdeckungen. Weitere Hinweise und die Navigation zum Bereich sind aufklappbar. Eine bebilderte Ortsübersicht erlaubt es, direkt zu einem Thema zu springen.

Tavi kann auf Wunsch jede Seite vorlesen. Audio beginnt erst nach einem Klick und folgt danach dem Seitenwechsel. Beim Schließen, beim Öffnen der Ortsübersicht und beim Verlassen des Browser-Tabs wird es angehalten. Bilder und Vorleseclips werden lokal als WebP beziehungsweise MP3 ausgeliefert; zur Laufzeit braucht der Rundgang keine Generierungs-API.

Planabhängige Funktionen werden als solche erklärt. Der Rundgang verspricht Kindern weder die administrativ beschränkte Audio-Doku-Erstellung noch den PDF-Export. Die Reisekarte ist eine zusätzliche Route; es wird keine derzeit fehlende Startseiten-Kachel dafür behauptet.

Die Rundgang-Version steigt auf 2. Wer die alte Version abgeschlossen hat, bekommt die ergänzte Version einmal erneut angeboten. Schließen ist jederzeit möglich. Über das Profilmenü lässt sich der Rundgang wieder starten.

## Prüfung

Alle 16 Seiten und 42 antippbaren Erklärungen wurden in einer lokalen Komponenten-Vorschau geprüft. Die 14 Orte der Übersicht sind direkt anwählbar. Geprüft wurden außerdem Abschluss und Neustart, Versionsspeicherung, Tastaturbedienung und Fokusführung, Vorlesen mit Seitenwechsel und Pause sowie Rückmeldungen bei fehlenden Bildern oder Audios.

Darstellung geprüft bei 320 × 568, 390 × 844, 768 × 1024, 1440 × 900 sowie 844 × 390 Pixeln im Querformat und im Dunkelmodus. Die Navigation bleibt erreichbar; längere Inhalte scrollen im mittleren Bereich. Die neuen Dateien bestehen die gezielte TypeScript-Prüfung; der vollständige Frontend-Produktionsbuild ist erfolgreich. Alle Medien sind vorhanden; die MP3s sind gültige Mono-Dateien mit kurzen Erklärungen von ungefähr 14 bis 18 Sekunden.
