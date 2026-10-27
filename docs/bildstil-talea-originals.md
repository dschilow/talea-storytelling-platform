# Gemeinsamer Talea-Bildstil

Seit 27. Oktober 2026 verwenden die Bildgenerierungen den Stil von **Bruno, der Flunkerfisch** und **Die Monster-Müllabfuhr**: handgezeichnete Kinderbuchillustration, weiche Tuschkonturen, Gouache, freundliche runde Formen, ausdrucksstarke Gesichter, warme sanft gesättigte Farben und unbeschriftete Flächen.

Die verbindliche Beschreibung steht einmal in `backend/ai/image-style.ts` als `TALEA_IMAGE_STYLE`. Sie entspricht wörtlich `imageStyleEn` in den beiden Serien-Bibeln. Die bestehenden Exporte `ORIGINALS_IMAGE_STYLE` und `MODERN_CHILDRENS_BOOK_STYLE` verweisen auf diese gemeinsame Vorgabe.

Die Vorgabe gilt für Avatarporträts, Poolfiguren und ihre Batch-Neugenerierung, Gastporträts, Geschichtenbilder samt Cover und Ersatzvignetten, Bibliotheksserien, Charakter-Lebensgeschichten, Buchwerkstatt und ältere Geschichten-Pipelines. Auch Artefaktbilder, Dokubilder, Tavi-Bilder und neu erzeugte Wizard-Illustrationen nutzen sie. Komposition, Handlung, Figurenidentität und zur Szene passende Lichtstimmung werden weiterhin von den jeweiligen Bildbriefings bestimmt.

Der gemeinsame Runware-Adapter ergänzt die Stilbeschreibung auch dann, wenn ein alter Prompt sie wegen seiner Längenbegrenzung verloren hat. Vollständige Bildbeschreibungen behalten ihre Reihenfolge. Bekannte alte Stilzusätze in gespeicherten Poolbeschreibungen werden vor der Generierung entfernt; Namen, Kleidung, Farben und Handlung bleiben erhalten. Die Bereinigung betrifft ausschließlich positive Bildprompts.

Alte API-Stilwerte werden zur Kompatibilität mit bestehenden Clients weiter angenommen, wählen aber kein anderes Zeichenmedium mehr aus. Die Avataroberfläche bietet die früheren Disney-, Anime- und Realismus-Optionen nicht mehr an.

Bestehende Bilder, hochgeladene Fotos und gespeicherte Figurenprofile werden durch die Umstellung nicht neu geschrieben. Der Stil gilt bei der nächsten Bildgenerierung oder ausdrücklich ausgelösten Neugenerierung. Bildmodelle und Abrechnung werden von den jeweiligen Pipelines bestimmt; die Stilvereinheitlichung erzwingt keinen Modellwechsel in zusätzlichen Pipelines.
