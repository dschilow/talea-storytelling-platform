Prompt für KI-Frontend-Designer

Cinematische Scroll-Landingpage für die KI-Kinderstory-App „Talea“

Rolle: Du bist ein Senior-Produktdesigner & Frontend-Entwickler mit Fokus auf cinematische Scroll-Webseiten, kindgerechte Illustration und hochwertige Micro-Animationen.
Aufgabe: Erstelle das komplette Frontend-Design (inkl. Layout, Illustrationskonzept und Animationslogik) für eine Landingpage der Kinder-Storytelling-Plattform „Talea“. Die Seite soll sich anfühlen wie ein interaktiver Animationsfilm / Spielfilm, der sich durch Scrollen entfaltet.

1. Kontext & Ziel

Produkt: „Talea“ – eine KI-gestützte Storytelling-Plattform für Kinder & Familien.

Kernfeatures, die erklärt werden müssen:

Story-Generierung: Individuelle Geschichten, personalisiert fürs Kind.

Avatare: Kinder-Avatare als Hauptfiguren in den Geschichten.

Dokus: Kindgerechte Dokus (Checker-Tobi-Style) zu beliebigen Themen.

Avatar-Gedächtnis: Avatare merken sich Erlebnisse & Entscheidungen.

Weiterentwicklung der Avatare: Werte, Eigenschaften & Wissen wachsen mit jeder Story und Doku.

Gefühl:

Cinematisch, wie ein moderner Animationsfilm (Pixar, Disney, Netflix Kids).

Gleichzeitig klar, strukturiert und hochwertig wie eine Premium-SaaS-Landingpage.

Spielerisch und magisch, aber nicht überladen.

2. Zielgruppe & Stimmung

Zielgruppe:

Primär: Eltern (25–45), die etwas Modernes & Pädagogisch-Wertvolles für ihre Kinder suchen.

Sekundär: Kinder (4–12), die über Visuals & Animationen begeistert werden sollen.

Tonalität:

Warm, einladend, vertrauenswürdig.

Magisch, aber sicher und kontrolliert (kein „zu wildes“ Chaos).

Visuelle Stimmung:

Sanfte Verläufe, Pastell-Farben, weiche Formen.

2D-Illustrationen im Storybook-/Cartoon-Stil.

Deutliche Lesbarkeit, große Typografie, viel Luft/Whitespace.

3. Technischer Rahmen & Animations-Techniken

Setze das Design so auf, dass es realistisch im Web umsetzbar ist.

Framework-Vorschlag:

React / Next.js (oder vergleichbares SPA/SSR-Framework).

Scroll-Animationen: z. B. GSAP + ScrollTrigger oder Framer Motion + useScroll + position: sticky.

Illustration & Animation:

Hauptstil: Vektorbasierte SVG-Illustrationen (Hintergründe, Figuren, Objekte).

Komplexere Charakterbewegungen:

Kleine Loop-Animationen über Lottie (JSON) oder GSAP-animierte SVG-Gruppen (Arme winken, Augen blinzeln, Haare bewegen sich).

Parallax & Zoom:

Mehrere Ebenen (Background / Midground / Foreground) als separate SVG-Layer, die sich unterschiedlich schnell bewegen.

Zoom-Effekte durch scale & translate auf große, hochauflösende SVG-Welten.

Performance & Zugänglichkeit:

GPU-freundliche CSS-Transforms (transform, opacity), keine übertriebenen Filter.

Respektiere prefers-reduced-motion: Bei aktivierter Option Animationen deutlich reduzieren (nur Fade/Slide).

Mobile: weniger Parallax, vereinfachte Animationen, dafür saubere Lesbarkeit.

4. Overarching Konzept: Das magische Buch & die Märchenwelt
4.1 Grundidee

Die Landingpage ist selbst eine Geschichte, die beim Scrollen erzählt wird.

Einstieg: geschlossenes Buch auf dunklem, subtil animiertem Hintergrund (Sterne, Partikel).

Beim Scrollen „öffnet“ sich das Buch und wir tauchen hinein in eine Märchenwelt-Landkarte.

In dieser Welt gibt es verschiedene „Orte“ / „Inseln“, die jeweils ein Feature der App repräsentieren:

Storywald (Story-Generierung)

Avatar-Werkstatt (Avatare)

Wissensberge / Sternen-Observatorium (Dokus)

Erinnerungsbaum (Avatar-Gedächtnis)

Entwicklungspfad / Werte-Garten (Weiterentwicklung der Avatare)

Eltern-Lounge (Lernziele, Kontrolle, Sicherheit)

4.2 Scroll-Mechanik

Nutze ein Kapitel-basiertes Scroll-Narrativ, inspiriert von filmischen „Chapters“:

Jede Sektion ist ein „Kapitel“ mit einem fixierten (sticky) Canvas.

Während der User scrollt, wechselt die Kamera-Position über dieselbe große Weltkarte (Pan, Zoom, Parallax).

Textboxen & UI-Elemente erscheinen synchron zum Kamerafokus.

Desktop:

Vollbild-Sektionen (100vh).

Sticky-Container, innerhalb derer sich Szene & Text dynamisch ändern.

Mobile:

Weniger extreme Zooms, mehr lineares Scrollen mit Fades & Sliden.

Weltkarte kann in vereinfachter Form gezeigt werden; Fokus auf Klarheit.

5. Seitenaufbau & Szenenbeschreibung
5.1 Szene 1 – Hero: Das Buch öffnet sich

Ziel: „Wow“-Moment + klares Value Proposition.

Bild / Szene:

Dunkler, leicht violett-blauer Hintergrund mit sanftem Sternenhimmel.

In der Mitte ein großes, illustriertes Buch mit „Talea“-Logo auf dem Cover.

Kleine funkelnde Partikel schweben darum.

Animation:

Beim ersten Scroll:

Buch dreht sich leicht, Cover öffnet sich langsam.

Ein Lichtstrahl und bunte Story-Elemente (kleine Avatare, Sterne, kleine Icons für Rakete, Dino, Buchstaben) steigen aus dem Buch auf.

Headline und Subline fahren weich ein (Fade + leichtes Up-Move).

Textvorschlag:

Headline: „Geschichten, die mit deinem Kind mitwachsen.“

Subline: „Talea verwandelt dein Kind in die Hauptfigur – mit personalisierten Märchen, Dokus und Avataren, die sich jede Erinnerung merken.“

CTA-Buttons:

Primär: „Jetzt kostenlos testen“

Sekundär: „Story-Demo ansehen“

UI-Elemente:

Kleinere Screenshots / Mockups der App als halbtransparente Karten rechts oder links, leicht animiert (schwebend).

5.2 Szene 2 – Weltkarte: Überblick über die Storywelt

Ziel: Alle Kernfeatures visuell als „Orte“ zeigen.

Bild / Szene:

Nach dem Öffnen des Buches zoomt die Kamera in eine farbige Märchenwelt:

Links unten: „Storywald“

Oben: „Wissensberge“ mit Observatorium

Rechts: „Avatar-Werkstatt“

Mitte: „Erinnerungsbaum“

Unten rechts: „Werte-Garten“ / Entwicklungspfad

Ecke: „Eltern-Lounge“ (kleine sichere Burg / Haus mit Dashboard)

Animation:

Kamera-Pan/Zoom über die Welt bei weiterem Scrollen.

Kleine Ambient-Animationen:

Wolken bewegen sich langsam.

Sterne blinken.

Kleine Avatare laufen / winken in loops.

UI-Elemente:

Kurze, fixierte Übersicht-Textbox:

„Eine App – eine Welt voller Geschichten, Wissen und Entwicklung.“

Kleine Legende mit Icons für die Orte.

5.3 Szene 3 – Story-Generierung (Storywald)

Ziel: Erklären, wie Kinder eigene Geschichten bekommen.

Bild / Szene:

Kamera zoomt in den Storywald:

Großes, freundliches Baumhaus.

Ein Kind-Avatar sitzt mit einem Elternteil bei einem leuchtenden Tablet / Buch.

Aus dem Bildschirm steigen kleine Szenen-Bubbles (Drache, Weltraum, Meerjungfrau, Dino etc.).

Animation:

Beim Scroll:

Bubbles erscheinen nacheinander.

Textbox wechselt in 2–3 Bullet-Punkte.

Avatar blinzelt / blättert / tippt.

Textvorschlag (kurz & klar):

Headline: „Jede Nacht eine neue, persönliche Geschichte.“

Bullet-Points:

„KI schreibt Geschichten mit deinem Kind als Held*in.“

„Wähle Thema, Länge & Stimmung mit wenigen Klicks.“

„Passend zum Alter – die Geschichten wachsen mit.“

5.4 Szene 4 – Avatare (Avatar-Werkstatt)

Ziel: Personaliserte Avatare visualisieren.

Bild / Szene:

Kamera zoomt zur Avatar-Werkstatt:

Eine Art cloudiges Atelier mit Spiegel, Farbpaletten, Frisuren, Kleidung.

Kinder-Avatar steht im Mittelpunkt, drumherum schweben UI-Elemente (Haare, Hautfarbe, Kleidung, Accessoires).

Animation:

Beim Scroll:

Avatar „wechselt“ sanft zwischen 3–4 Erscheinungsformen (Haarstil, Outfit, Accessoire), um Anpassbarkeit zu zeigen.

UI-Sticker (Buttons / Slider) fahren rein & raus.

Textvorschlag:

Headline: „Dein Kind als Hauptfigur.“

Punkte:

„Erstelle in Sekunden einen Avatar, der deinem Kind ähnlich sieht.“

„Mehrere Avatare für Geschwister & Freunde.“

„Nutzbar in Geschichten und Dokus.“

5.5 Szene 5 – Dokus (Wissensberge / Observatorium)

Ziel: Doku-Funktion erklären (Checker-Tobi-Style).

Bild / Szene:

Kamera fliegt zu den Wissensbergen:

Berggipfel mit Observatorium / Sternwarte.

Avatar-Kinder stehen mit Fernglas und Kamera, schauen auf eine große Projektionskugel (Globus / Welt / Thema).

Im Hintergrund Planeten, Bücher, kleine Infografiken.

Animation:

Beim Scroll:

Die Projektionskugel wechselt Themen-Icons (Weltraum, Dinosaurier, Ozean, Körper, Technik).

Kleine Info-Bubbles ploppen nacheinander auf.

Textvorschlag:

Headline: „Entdecke die Welt mit kindgerechten Dokus.“

Punkte:

„Wähle ein Thema – Talea erklärt es in Bildern & Geschichten.“

„Komplett kindgerecht, verständlich und spannend.“

„Perfekt als Ergänzung zu Schule & Neugier-Fragen.“

5.6 Szene 6 – Avatar-Gedächtnis (Erinnerungsbaum)

Ziel: „Gedächtnis“ der Avatare visuell machen.

Bild / Szene:

Kamera zoomt zum Erinnerungsbaum:

Großer, leuchtender Baum.

An den Ästen hängen kleine „Story-Früchte“ oder „Erinnerungs-Icons“.

Beim Überfahren/Scrollen sieht man Mini-Szenen.

Animation:

Beim Scroll:

Nach und nach leuchten mehr Früchte/Blätter auf.

Beim Erreichen bestimmter Scrollpositionen zoomt die Kamera kurz an einzelne Erinnerungen heran (Story-Schnappschüsse / Symbole).

Textvorschlag:

Headline: „Avatare, die sich alles merken.“

Punkte:

„Jede gelesene Geschichte wird als Erinnerung gespeichert.“

„Avatare erinnern sich an Entscheidungen und Erlebnisse.“

„Später nehmen sie darauf Bezug – ganz wie echte Freunde.“

5.7 Szene 7 – Weiterentwicklung der Avatare (Werte-Garten)

Ziel: Charakterentwicklung & Lernziele zeigen.

Bild / Szene:

Kamera verschiebt sich zum Werte-Garten / Entwicklungspfad:

Pfad aus leuchtenden Steinen / Level-Markern.

Neben dem Pfad stehen Symbole für Mut, Kreativität, Hilfsbereitschaft, Humor, Weisheit (z. B. Icons oder kleine Statuen).

Der Avatar geht den Pfad entlang.

Animation:

Beim Scroll:

Avatar bewegt sich Schritt für Schritt weiter.

Bei bestimmten Markern „füllen“ sich Werte-Balken oder Icons leuchten stärker.

Kleine Tooltips poppen auf („Mut +1“, „Neues Wort gelernt“ etc.).

Textvorschlag:

Headline: „Werte & Fähigkeiten wachsen mit jeder Story.“

Punkte:

„Definiere Lernziele (Mut, Wissen, Empathie, Wortschatz …).“

„Geschichten und Dokus richten sich nach diesen Zielen.“

„Ein Dashboard zeigt dir, wie sich dein Kind entwickelt.“

5.8 Szene 8 – Eltern-Lounge (Kontrolle & Sicherheit)

Ziel: Eltern von Sicherheit & Kontrolle überzeugen.

Bild / Szene:

Kamera zoomt zu einem ruhigen Haus / Schloss mit hellem Innenraum.

Im Vordergrund ein Tablet / Laptop mit einem Eltern-Dashboard-UI:

Kacheln mit „Nutzungszeit“, „Lernziele“, „Zuletzt gelesene Geschichten“, „Doku-Themen“.

Animation:

UI-Kacheln toggeln sanft durch verschiedene Ansichten.

Kleine Hinweise (Tooltips) blenden ein („Altersfilter aktiv“, „Werbefrei“, „Datenschutz-konform“).

Textvorschlag:

Headline: „Du behältst immer die Kontrolle.“

Punkte:

„Alters- und Inhaltsfilter per Klick einstellbar.“

„Transparente Übersicht über Themen & Lernfortschritte.“

„Datenschutz & Sicherheit nach höchsten Standards.“

5.9 Szene 9 – Pricing & CTA

Ziel: Klare Umwandlung (Sign-up).

Bild / Szene:

Rückkehr auf eine ruhige Szene mit halboffenem Buch & Avataren am Rand.

Drei Pricing-Karten (Starter / Familie / Premium) als Story-Karten.

Animation:

Karten „flippen“ leicht beim Hover.

Wichtigste Option („Familie“) leicht hervorgehoben (Glow / leichte Skalierung).

Inhalte (Beispiel, nur visuell andeuten – KI kann Details selbst füllen):

Starter: wenige Stories pro Monat.

Familie: mehrere Kinder, mehr Geschichten, Dokus.

Premium: unbegrenzt, alle Features.

CTA:

„Jetzt kostenlos testen“ (großer Button).

Darunter: „Video-Demo ansehen“ / „Beispielstory lesen“.

5.10 Szene 10 – Footer als kleiner Epilog

Ziel: Abrunden & Vertrauen.

Bild / Szene:

Buch schließt sich halb und glimmt noch leicht.

Kleine Icons für Kontakt, Newsletter, Social Media.

Inhalte:

Kurzer Claim.

Datenschutz, Impressum, Links.

„Made with ❤️ für Kinder & Familien.“

6. Avatare & Illustrationen – Detailvorgaben

Avatar-Stil:

2D, kindgerecht, runde Formen, große Augen, freundliche Mimik.

Diversität: Verschiedene Hautfarben, Haarstrukturen, Hilfsmittel (Brille, Hörgerät etc.).

Technische Umsetzung Avatare:

Export als modulare SVGs:

Layer für Körper, Kopf, Haare, Augen, Mund, Kleidung, Accessoires.

So können Animationen (z. B. Augen blinzeln) über GSAP/Framer Motion erfolgen.

Optionale Lottie-Animationen für:

Winkbewegung

Lachen

„Entdeckerpose“ (Fernglas hochheben)

Farbschema (Beispiel, kannst du verfeinern):

Primär: warmes Violett (#7C4DFF)

Sekundär: türkis-grün (#24C5A8)

Akzent: sonniges Gelb (#FFCE45)

Hintergrund: sehr dunkles Blau/Anthrazit (#05081A) in Hero, hellere Pastells in den Szenen.

Typografie:

Headline-Font: Runde, moderne Sans-Serif mit Charakter (z. B. kindlich, aber sauber).

Body-Font: gut lesbare Sans-Serif, große x-Höhe.

Große Headline-Größen, klare Hierarchie (H1, H2, H3, Body, Caption).

7. UI- & Komponentendesign

Buttons:

Groß, rund, gefüllt, mit sanftem Glow/Hover.

Micro-Animation beim Hover: leichtes Pulsieren + Schatten.

Cards:

Abgerundete Ecken, leichte Schatten, hoverbare Flächen.

Nutze Icons/Illustrationen statt nur Text.

Icons:

Eigenes Icon-Set im gleichen Illustrationsstil (Vektor).

Themen: Buch, Planet, Herz, Stern, Zahnrad, Schloss (für Sicherheit), Schild (Datenschutz), etc.

8. Responsives Verhalten

Desktop (ab ca. 1024px):

Vollbild-Sektionen mit Sticky-Szenen, starke Parallax-Effekte, Cinematic-Scroll.

Tablet:

Reduzierte Parallax-Stärke, Text minimal größer.

Mobile (bis ca. 768px):

Weniger Zoom & Pan, dafür klare, vertikal gestapelte Szenen.

Alle Texte extrem gut lesbar, Buttons groß.

Animationen auf essentielle Fades/Slides reduziert, Avatare in simpler Loop-Animation.

9. Accessibility & Details

Kontrastwerte beachten (mind. WCAG AA).

Alle wichtigen Inhalte auch verständlich, wenn Animationen reduziert sind.

CTAs gut erreichbar, Fokuszustände klar sichtbar.

Sprache: UI-Texte in Deutsch, warm & verständlich.

10. Deine Ausgabe

Erzeuge als Ergebnis:

Ein vollständiges visuelles Konzept der Landingpage:

Sektionsaufteilung (Hero, Weltkarte, 5 Feature-Szenen, Eltern-Lounge, Pricing, Footer).

Wireframes / Layoutbeschreibung für Desktop & Mobile.

Ein detailliertes Animationskonzept:

Welche Elemente wann wie auf Scroll animiert werden (Pan/Zoom/Parallax, Fades, Micro-Animationen).

Technische Hinweise für SVG/Lottie/GSAP/Framer Motion.

Styleguide-Auszug:

Farben, Typografie, Komponentenstil (Buttons, Cards, Icons).

Beispieltexte (kurz) für jede Sektion auf Deutsch, so dass die Seite sofort nutzbar ist.

Nutze dieses Briefing, um eine maximal professionelle, kindgerechte, filmische Scroll-Landingpage für „Talea“ zu gestalten, die alle genannten Features klar und emotional vermittelt.