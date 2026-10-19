# Android: gemeinsame Weboberfläche

Stand: 16. Oktober 2026.

Die Android-App enthält den Build von `../frontend/` direkt in der APK. Damit
verwenden Web und Android dieselben React-Komponenten, Routen, Designs,
Übersetzungen und Geschäftsabläufe sowie denselben Encore-Backenddienst und
dieselbe Clerk-Instanz. Die bisherigen separaten React-Native-Bildschirme werden
vom App-Einstieg nicht mehr geladen.

Android ergänzt Systemfunktionen für Zurück, sichere Bildschirmränder, Dateiexport,
Haptik, Hintergrund-Audio, Sperrbildschirm-Steuerung und die vorhandene private
Alibi-Sprachausgabe. Eine an Hauptframe und Host-Instanz gebundene Kennung schützt
die native Schnittstelle auch auf älteren WebView-Versionen.

## Nachgewiesen

- Mobile-TypeScript-Prüfung bestanden.
- Finale APK mit `assembleRelease` erfolgreich gebaut; alle 1.680 Webdateien
  anschließend direkt aus der fertigen APK gelesen und mit ihren SHA-256-Werten
  verglichen. WebView-Debugging ist für diese APK abgeschaltet.
- 48 automatisierte Tests bestanden, 160 Assertions, keine Fehler. Darunter
  Backend-Verträge, native Protokollgrenzen, vollständige App-Links und
  Unterbrechungs-/Wiederaufnahmefälle des Spiels.
- 19 Ansichten bei gleichem Mobilformat jeweils als Browser und als Android mit
  Test-Brücke gerendert: gleiche erhobene DOM-/Stilwerte, keine unbehandelten
  JavaScript-Fehler. Darunter Geschichten, Avatare, Dokus, Erstellungsabläufe,
  Einstellungen, Spiele, Kosmos, Elternansicht, Karte, Admin und alle drei
  Story-Reader. Die statischen Screenshotpaare stimmen überein; die bewegte
  3D-Szene erzeugte 0,33 Prozent abweichende Pixel.
- Sechs gezielte Android-Zurück-Prüfungen bestanden: Kartenmenü, Profilmenü,
  Playlist, Reader-Bildansicht, Rückkehr zur Startseite und native
  Beenden-Bestätigung.
- Alle 1.543 öffentlichen Webdateien bytegenau übernommen; die Integritätsprüfung
  kontrolliert zusätzlich jeden Eintrag im Android-Paketmanifest. Originalfonts
  sind im Paket enthalten. Der Web-Service-Worker ist nur im Android-Build
  deaktiviert; die Website behält ihre PWA.
- Auf Android API 36 tatsächlich geprüft: Original-Startseite und Clerk-Formular,
  geladene Originalfonts, lokaler Medienzugriff mit HTTP-Range/206, native
  Audiowiedergabe einschließlich MediaSession und Status-Rückmeldung sowie
  PDF-Erzeugung mit Android-Teilen-Dialog. Es wurde kein externer Empfänger gewählt.
- Finale Übergabe-APK erneut im Emulator installiert: gemeinsame Anmeldeansicht
  einschließlich Clerk-Eingabeformular vollständig geladen, native
  Startabdeckung erfolgreich geschlossen, kein WebView-DevTools-Socket vorhanden.
- Der Offline-Reader hat nach Prozessneustart eine zuvor lokal gespeicherte
  synthetische Geschichte ohne WLAN und mobile Daten gerendert. Das prüft die
  gemeinsame IndexedDB-Bibliothek und benötigt keinen Produktionsinhalt.

Die lokalen Vergleichsberichte und Screenshots liegen in `artifacts/`, unter
anderem `parity-report.json` und `native-back-report.json`. Diese erzeugten
Dateien sind nicht Teil des Quellcodes.

## Grenzen der Prüfung

Die Ansichtsvergleiche nutzen isolierte Konto- und Backend-Fixtures. Sie beweisen
die Darstellung und getesteten Interaktionen, keinen vollständigen Durchlauf
sämtlicher Produktionsfunktionen. Einige Admin-/Wizard-/Audiobibliothek-Endpunkte
fehlen in den Fixtures und sind im Vergleichsbericht gesondert aufgeführt.
Es wurden keine kostenpflichtigen KI-Aufrufe und keine Produktionsänderungen
ausgeführt.

Echter Kontologin einschließlich gegebenenfalls aktivierter OAuth-Anbieter,
Kamera, Weiterverarbeitung exportierter Dateien und die physische Trennung von
Hörer und Lautsprecher benötigen noch einen Test auf einem Android-Handy. Die
Emulatorsitzung zeigte einmal einen ANR im emulierten EGL-Grafikkanal unter hoher
Speicher-/I/O-Last; die Diagnose enthält keinen entsprechenden JavaScript-
Fehler. Eine vollständige Hardware-Freigabe ist damit nicht behauptet.

Der normale Web-Produktionsbuild ist geprüft. Die vollständige TypeScript-Prüfung
des bestehenden Webprojekts meldet weiterhin vorhandene Fehler außerhalb der
neuen Plattformanbindung; diese wurde nicht als fehlerfrei ausgegeben.

## Installation und bestehende Daten

Installierbare APK: `artifacts/Talea-Android.apk`. Sie ist mit dem bereits im
Projekt verwendeten Entwicklungsschlüssel signiert. Für eine Veröffentlichung
im Play Store muss ein Upload-Schlüssel konfiguriert werden.

Nach dem Wechsel vom alten nativen Frontend einmal erneut anmelden. Konten,
Profile, Avatare, Geschichten und Fortschritt bleiben im gemeinsamen Backend.
Alte native Offline-Downloads erneut in der gemeinsamen Offline-Bibliothek
speichern. Die vorhandenen alten Cache-Dateien werden dabei nicht gelöscht.

Build- und Architekturdetails stehen in [README.md](README.md).
