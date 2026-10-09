**Talea: Was du im Videogenerator eingibst**

Konkreter Arbeitsablauf für `heygen/heygen-video-1`, Stand 8. Oktober 2026. Das Drehbuch ist vorbereitet; Startbilder, neue Videos und neue ElevenLabs-Sprachclips sind noch nicht erzeugt.

**Der einfache Ablauf**

1. Die Sprechertexte zuerst in ElevenLabs erzeugen und probeweise auf die 90-Sekunden-Zeitleiste legen. Namen, Zeiten und Regiehinweise werden nicht mitgesprochen. Falls ein Einsatz länger als geplant wird, die Szene anpassen statt die Sprache hektisch zu beschleunigen.
2. Figurenreferenzen festlegen. Für jede generierte Filmszene zunächst ein passendes Startbild erstellen. Die untenstehenden Bildprompts gehören in einen Bildgenerator. Bestehende passende Bilder können stattdessen verwendet werden. Beim Erstellen der Startbilder immer dieselben freigegebenen Figurenreferenzen verwenden.
3. Im Videogenerator das fertige Bild ausdrücklich als **Startbild / First frame** auswählen, fünf Sekunden einstellen und nur den zugehörigen **Videoprompt** einfügen. Ein nur allgemein angehängtes Referenzbild hat eine andere Funktion als ein festes Startbild.
4. Jeden Clip prüfen und herunterladen. Die Clips in der Reihenfolge S01 bis S18 schneiden. Die sieben App-Szenen werden mit echten Bildschirmaufnahmen erstellt; das Schlussbild wird im Schnitt aufgebaut.
5. Den generierten Ton stummschalten. ElevenLabs-Sprache, Musik und Geräusche als getrennte Spuren einsetzen. Logo, Untertitel und URL erst im Schnitt hinzufügen.

Die erste Fassung benötigt damit **zehn generierte Clips à fünf Sekunden**, **sieben App-Szenen à fünf Sekunden** und **ein Schlussbild à fünf Sekunden**. Die fertige Länge bleibt 90 Sekunden. Für die aufwendigere Fassung aus dem ursprünglichen Drehbuch können App-Bilder in die animierten Tablets eingesetzt und zusätzliche Familienreaktionen ergänzt werden. Eine App-Aufnahme ist eine Bildschirmaufzeichnung und wird nicht von HeyGen erfunden.

**Warum nicht sechs Clips à 15 Sekunden?**

15 Sekunden sind die Obergrenze, keine Pflichtlänge. Für diesen Film ist pro Clip eine kleine Handlung vorgesehen. Kurze Einstellungen lassen sich leichter austauschen und halten die App-Erklärung übersichtlich. HeyGen Video 1 unterstützt laut aktueller Anbieterbeschreibung 5–15 Sekunden. [OpenRouter: Modellbeschreibung](https://openrouter.ai/heygen/heygen-video-1)

**Startbild, Endbild und Figurenreferenz unterscheiden**

| Eingabe | Aufgabe |
|---|---|
| Figurenreferenz | Zeigt, wie Mila, Ben, Tavi oder Fips aussehen sollen. |
| Startbild / First frame | Legt die Bildkomposition am Anfang des Clips fest. |
| Festes Endbild / Last frame | Legt bei Modellen mit dieser Funktion das Zielbild fest. |
| Letzter brauchbarer Frame eines erzeugten Clips | Kann exportiert und als Startbild der Fortsetzung verwendet werden. |

Die aktuelle Runware-Dokumentation für HeyGen Video 1.0 erlaubt ein festes Startbild, aber kein festes Endbild. Ihr Startbildmodus kann dort auch nicht gleichzeitig mit allgemeinen Bild-, Video- oder Audioreferenzen verwendet werden. Darum werden die Figuren bereits in das Startbild eingebaut; die ElevenLabs-Spur kommt beim empfohlenen Ablauf anschließend in den Schnitt. Deine Oberfläche kann andere Felder zeigen. [Runware: unterstützte Eingaben](https://runware.ai/docs/models/heygen-video-1-0)

**So setzt du eine Kamerafahrt fort**

Clip A erzeugen → den letzten brauchbaren Frame exportieren → diesen Frame als Startbild von Clip B einsetzen → die Bewegung im Prompt fortsetzen → am passenden Frame schneiden.

Das hilft bei der Bildkontinuität, garantiert aber keine identische Bewegungsgeschwindigkeit, Mimik oder Beleuchtung. Wenn der letzte Frame unsauber ist, einen früheren sauberen Frame wählen und Clip A dort beenden. Die ursprünglichen Figurenreferenzen zusätzlich beim Erstellen neuer Startbilder heranziehen; sonst können kleine Veränderungen von Clip zu Clip wachsen.

Ein allgemeiner Fortsetzungsprompt für fünf Sekunden:

```text
Continue naturally from the supplied first frame. Keep every visible character, costume, prop and background detail unchanged. Continue the existing slow camera movement in the same direction, with no camera reset. The characters complete the small movement already in progress, then settle into a calm pose. Preserve the same lighting and spatial arrangement. One continuous shot, no internal cut, no new characters or objects. No dialogue, no music and no text.
```

Für einen Wechsel vom Kinderzimmer in die Fantasiewelt oder von der Landschaft zur App wird ein neues Startbild verwendet. Dort ist ein bewusster Schnitt sinnvoll. Schneide auf einen Blick, eine Handbewegung oder einen musikalischen Akzent. Eine durchgehende Musik- und Sprecherfassung verbindet die Einstellungen. Automatische Überblendungen zwischen unterschiedlichen Gesichtern können Doppelkonturen erzeugen.

**Einstellungen für jeden generierten Clip**

- Modell: `heygen/heygen-video-1` in deiner Oberfläche auswählen. Runware verwendet für dasselbe Modell die eigene Kennung `heygen:video@1.0`; diese Kennung nicht in ein OpenRouter-Modellfeld kopieren.
- Modus: Bild zu Video mit festem Startbild, sofern die Oberfläche ihn freigibt.
- Dauer: **5 Sekunden**.
- Format: Startbild im **Hochformat 9:16** anlegen. Im dokumentierten Startbildmodus bestimmt das Bild die Form des Videos. [Runware: Startbildmodus](https://runware.ai/docs/models/heygen-video-1-0/guides/image-to-video)
- Auflösung: die für dein Konto angebotene passende Qualität. Ausgabeauflösung und das spätere Exportformat 1080 × 1920 sind unterschiedliche Einstellungen.
- Automatische Prompt-Umschreibung: wenn einstellbar, für diese fertigen Prompts deaktivieren.
- Audio: deaktivieren, wenn möglich; ansonsten im Schnitt entfernen.
- Kein Endbild voraussetzen. Die unten vorgeschlagenen Startbildnamen sind geplante Dateinamen, keine bereits erzeugten Dateien.

**Figuren über alle Szenen gleich halten**

**Mila:** Braune Haut, große braune Augen, schwarze Locken in zwei kleinen seitlichen Buns. Zuhause senfgelber Baumwollpyjama. Im Abenteuer dieselbe Figur mit pflaumenrosa Umhang, kleinem goldenen Verschluss und senfgelbem Oberteil. Wach, neugierig, hilfsbereit; natürliche Kindergestik.

**Ben:** Helle Haut, grüne Augen, kurze kastanienbraune Locken. Zuhause mintgrüner Pyjama mit hellem Rand. Im Abenteuer salbeigrüne Tunika, brauner Schulterriemen und kleiner türkisfarbener Anhänger. Humor durch Reaktion und Timing, nicht durch Auslachen.

**Mama:** Etwa Mitte dreißig, warme braune Haut, dunkle lockige Haare locker zusammengebunden, cremefarbene Strickjacke. Zugewandt und gelassen. Sie bleibt im echten Zuhause und begleitet die App-Nutzung.

**Tavi:** Bestehendes Talea-Maskottchen als 3D-Figur: türkisfarbene Haut, rote Kopfbedeckung mit goldener Fassung und blauer Feder, goldene Armreifen und Ohrringe, schwebender geschwungener Unterkörper. Kleine goldene Lampe. Runde freundliche Gesichtszüge; lebhafte Augen und kleine Gesten. Referenz frontend/public/tavi.png.

**Fips:** Kleiner himmelblauer Drache, etwa bis Milas Hüfte, cremefarbener Bauch, zwei kurze stumpfe Hörner, kleine dunkelblaue Flügel, blaue Augen, weiche runde Schnauze. Eine winzige rote Laterne mit warmem Licht. Schüchtern, freundlich; niest genau drei kleine goldene Funken. Keine bedrohliche Gestaltung.

Die vorhandenen Markenreferenzen sind `frontend/public/tavi.png` und `frontend/public/landing-assets/journey/cinematic-world.webp`. Für Mila, Ben und Mama können passende Einzelbilder aus dem bisherigen Film als Ausgangspunkt dienen. Fips wird für die echten App-Beispiele als gespeicherte Fantasiefigur angelegt und in beiden Beispielgeschichten gewählt.

**Reihenfolge im Schnitt**

| Zeit | Szene | Herstellung |
|---|---|---|
| 0:00–0:05 | S01: Es war einmal … ich! | KI-Clip, 5 Sekunden |
| 0:05–0:10 | S02: Eure eigenen Helden | Echte App-Aufnahme, 5 Sekunden |
| 0:10–0:15 | S03: Das Atelier der Helden | KI-Clip, 5 Sekunden |
| 0:15–0:20 | S04: Eine Idee bekommt Flügel | Echte App-Aufnahme, 5 Sekunden |
| 0:20–0:25 | S05: Die Geschichte öffnet sich | KI-Clip, 5 Sekunden |
| 0:25–0:30 | S06: Willkommen in Talea | KI-Clip, 5 Sekunden |
| 0:30–0:35 | S07: Ein Drache braucht Licht | KI-Clip, 5 Sekunden |
| 0:35–0:40 | S08: Wir gehen zusammen | KI-Clip, 5 Sekunden |
| 0:40–0:45 | S09: Ein kleiner Schritt bleibt | KI-Clip, 5 Sekunden |
| 0:45–0:50 | S10: Der Held kommt wieder | KI-Clip, 5 Sekunden |
| 0:50–0:55 | S11: Geschichten sehen und lesen | Echte App-Aufnahme, 5 Sekunden |
| 0:55–1:00 | S12: Geschichten hören | Echte App-Aufnahme, 5 Sekunden |
| 1:00–1:05 | S13: Eine Frage öffnet die nächste Tür | KI-Clip, 5 Sekunden |
| 1:05–1:10 | S14: Wissen wird eine Entdeckung | Echte App-Aufnahme, 5 Sekunden |
| 1:10–1:15 | S15: Rätseln, raten, lachen | Echte App-Aufnahme, 5 Sekunden |
| 1:15–1:20 | S16: Eltern geben den Rahmen | Echte App-Aufnahme, 5 Sekunden |
| 1:20–1:25 | S17: Kommt Fips morgen wieder? | KI-Clip, 5 Sekunden |
| 1:25–1:30 | S18: Das Tor bleibt offen | Schlussgrafik, 5 Sekunden |

**Die Eingaben pro Szene**

Bildprompt und Videoprompt werden nacheinander in unterschiedliche Generatoren eingegeben. Nur den Inhalt des jeweiligen Textkastens kopieren. Die Startbild-Prompts legen den Zustand **vor** der Handlung fest; der Videoprompt beschreibt die Bewegung. Die fünf Sekunden sind ein Schnittziel, keine Zusicherung für die Sprechdauer der erzeugten Stimme.

**S01 · 0:00–0:05 · Es war einmal … ich!**

Geplanter Startbild-Dateiname: `S01_start.png`. Das Startbild muss zuerst erstellt oder aus vorhandenem Material gewählt werden.

**In den Bildgenerator:**

```text
A single polished cinematic frame from an original high-end 3D family animated feature. Appealing rounded character design, detailed soft hair and cloth, expressive eyes, physically plausible materials, warm volumetric light, cinematic depth and clear silhouettes. Vertical 9:16 composition. Match the supplied approved character references exactly. No captions, logos, watermarks or readable text. Tablet displays are blank compositing plates; actual Talea screens will be inserted separately.

Seven-year-old girl with warm brown skin, large brown eyes and black curly hair in two small side buns. Mustard yellow cotton pajamas at home. In the fantasy world the same face and hairstyle, with a dusty plum-pink cape, a small gold clasp and a mustard shirt. Curious, observant and kind.
Eight-year-old boy with fair skin, green eyes and short chestnut curls. Mint-green pajamas with pale piping at home. In the fantasy world a sage-green tunic, brown shoulder strap and small turquoise pendant. Playful, attentive, never mocking.
Mother in her mid-thirties with warm brown skin, dark curly hair loosely tied back, a cream knit cardigan and relaxed posture. Warm, attentive, present with her children in the real home.

Medium close three-shot in a cozy evening children's room. The mother sits between Mila and Ben under one cream blanket and holds a tablet. Mila is relaxed, her hands resting on the blanket before she raises a finger. Ben watches her. Warm bedside lamp, mustard and teal accents. Home pajamas, no fantasy costumes.
```

**Danach in den Videogenerator, zusammen mit diesem Startbild, Dauer 5 Sekunden:**

```text
Animate the supplied first frame as one continuous five-second shot. The girl gently straightens, raises one index finger with delighted confidence and smiles. The boy gives a small amused eyebrow reaction; the mother watches warmly. Slowly push toward the girl. Keep the tablet and blanket stable. Use facial reactions rather than visible spoken dialogue.

Keep the first frame's original high-end 3D family animation look, lighting, faces, wardrobe and proportions consistent. One shot, no internal cuts. No generated dialogue, no music, no captions, no logos and no invented app interface. Any generated sound will be discarded; the final ElevenLabs voiceover is added in editing.
```

**ElevenLabs-Einsätze:**

- Mama: „Es war einmal …“
- Mila: „Ich!“

**Einblendung im Schnitt:** Keine zusätzliche Texteinblendung; Talea über den echten App-Bildschirm erkennbar.

**S02 · 0:05–0:10 · Eure eigenen Helden**

Echte Avatar-Auswahl aufnehmen: ein ausgewählter Held, ein sichtbarer Tap. Vollbild ist für die erste Fassung einfacher als ein Bildschirm im generierten Tablet.

Für die einfache Fassung wird hier kein HeyGen-Prompt benötigt. Ruhige Vollbildaufnahme im Schnitt auf fünf Sekunden begrenzen. Für eine spätere aufwendigere Fassung die Aufnahme in ein animiertes Tablet einsetzen.

**ElevenLabs-Einsätze:**

- Erzählerin: „In Talea beginnt euer Abenteuer mit euren eigenen Helden.“

**Einblendung im Schnitt:** „Eigene Helden gestalten“

**S03 · 0:10–0:15 · Das Atelier der Helden**

Geplanter Startbild-Dateiname: `S03_start.png`. Das Startbild muss zuerst erstellt oder aus vorhandenem Material gewählt werden.

**In den Bildgenerator:**

```text
A single polished cinematic frame from an original high-end 3D family animated feature. Appealing rounded character design, detailed soft hair and cloth, expressive eyes, physically plausible materials, warm volumetric light, cinematic depth and clear silhouettes. Vertical 9:16 composition. Match the supplied approved character references exactly. No captions, logos, watermarks or readable text. Tablet displays are blank compositing plates; actual Talea screens will be inserted separately.

Seven-year-old girl with warm brown skin, large brown eyes and black curly hair in two small side buns. Mustard yellow cotton pajamas at home. In the fantasy world the same face and hairstyle, with a dusty plum-pink cape, a small gold clasp and a mustard shirt. Curious, observant and kind.
Eight-year-old boy with fair skin, green eyes and short chestnut curls. Mint-green pajamas with pale piping at home. In the fantasy world a sage-green tunic, brown shoulder strap and small turquoise pendant. Playful, attentive, never mocking.
Use only the fantasy wardrobe in this image.

In a softly lit magical atelier, fantasy Mila and Ben stand beside a round gold mirror. Mila's dusty plum-pink cape is slightly loose above her shoulders, still clear of her eyes. Ben is in his sage-green tunic. Golden reflections, believable fabric, playful quiet anticipation.
```

**Danach in den Videogenerator, zusammen mit diesem Startbild, Dauer 5 Sekunden:**

```text
Animate the supplied first frame as one continuous five-second shot. The girl's loose cape briefly folds over her eyes; she catches and lowers it, then smiles. The boy reacts with a small affectionate smile. Slow lateral camera move. Preserve the mirror, both faces and both fantasy costumes.

Keep the first frame's original high-end 3D family animation look, lighting, faces, wardrobe and proportions consistent. One shot, no internal cuts. No generated dialogue, no music, no captions, no logos and no invented app interface. Any generated sound will be discarded; the final ElevenLabs voiceover is added in editing.
```

**ElevenLabs-Einsätze:**

- Erzählerin: „Gestaltet ihr Aussehen. Gebt ihnen eine Persönlichkeit.“

**Einblendung im Schnitt:** „Aussehen · Persönlichkeit“

**S04 · 0:15–0:20 · Eine Idee bekommt Flügel**

Echten Story-Wizard aufnehmen. Beispielidee eingeben: „Ein Drache, der Angst im Dunkeln hat.“ Nur fiktive Testdaten verwenden.

Für die einfache Fassung wird hier kein HeyGen-Prompt benötigt. Ruhige Vollbildaufnahme im Schnitt auf fünf Sekunden begrenzen. Für eine spätere aufwendigere Fassung die Aufnahme in ein animiertes Tablet einsetzen.

**ElevenLabs-Einsätze:**

- Mila: „Ein Drache … der Angst im Dunkeln hat.“

**Einblendung im Schnitt:** „Eure Idee. Eure Geschichte.“

**S05 · 0:20–0:25 · Die Geschichte öffnet sich**

Geplanter Startbild-Dateiname: `S05_start.png`. Das Startbild muss zuerst erstellt oder aus vorhandenem Material gewählt werden.

**In den Bildgenerator:**

```text
A single polished cinematic frame from an original high-end 3D family animated feature. Appealing rounded character design, detailed soft hair and cloth, expressive eyes, physically plausible materials, warm volumetric light, cinematic depth and clear silhouettes. Vertical 9:16 composition. Match the supplied approved character references exactly. No captions, logos, watermarks or readable text. Tablet displays are blank compositing plates; actual Talea screens will be inserted separately.



An ornate original closed storybook floats a few centimeters above a wooden table in the warm magical atelier. Golden edges, unlettered cover, sturdy spine. Leave room above the book for its opening pages. No characters and no readable text.
```

**Danach in den Videogenerator, zusammen mit diesem Startbild, Dauer 5 Sekunden:**

```text
Animate the supplied first frame as one continuous five-second shot. The floating book opens once. Between its pages appears a small glowing floating island. Slowly move the camera toward the open book. Preserve the table, spine and page geometry. The golden glow grows gently; no flashing transition and no generated lettering.

Keep the first frame's original high-end 3D family animation look, lighting, faces, wardrobe and proportions consistent. One shot, no internal cuts. No generated dialogue, no music, no captions, no logos and no invented app interface. Any generated sound will be discarded; the final ElevenLabs voiceover is added in editing.
```

**ElevenLabs-Einsätze:**

- Erzählerin: „Talea macht mit KI daraus eure persönliche Geschichte.“

**Einblendung im Schnitt:** „Persönliche KI-Geschichten mit Bildern“

**S06 · 0:25–0:30 · Willkommen in Talea**

Geplanter Startbild-Dateiname: `S06_start.png`. Das Startbild muss zuerst erstellt oder aus vorhandenem Material gewählt werden.

**In den Bildgenerator:**

```text
A single polished cinematic frame from an original high-end 3D family animated feature. Appealing rounded character design, detailed soft hair and cloth, expressive eyes, physically plausible materials, warm volumetric light, cinematic depth and clear silhouettes. Vertical 9:16 composition. Match the supplied approved character references exactly. No captions, logos, watermarks or readable text. Tablet displays are blank compositing plates; actual Talea screens will be inserted separately.

Seven-year-old girl with warm brown skin, large brown eyes and black curly hair in two small side buns. Mustard yellow cotton pajamas at home. In the fantasy world the same face and hairstyle, with a dusty plum-pink cape, a small gold clasp and a mustard shirt. Curious, observant and kind.
Eight-year-old boy with fair skin, green eyes and short chestnut curls. Mint-green pajamas with pale piping at home. In the fantasy world a sage-green tunic, brown shoulder strap and small turquoise pendant. Playful, attentive, never mocking.
Use the supplied Talea Tavi reference: friendly turquoise genie, rounded face, expressive eyes, red turban with gold setting and a blue feather, gold wrist cuffs and small hoop earrings, floating curved lower body, small golden lamp. Translate the existing mascot into polished three-dimensional character animation while preserving its recognizable design.
Use only the fantasy wardrobe in this image.

Wide establishing composition from child height. Fantasy Mila and Ben stand on a broad safe stone balcony above peach clouds. Tavi floats beside them. Beyond are original floating islands, a golden-lit story castle, a garden of giant books and a small distant observatory. Tavi's hands rest before his welcoming gesture.
```

**Danach in den Videogenerator, zusammen mit diesem Startbild, Dauer 5 Sekunden:**

```text
Animate the supplied first frame as one continuous five-second shot. The turquoise genie makes one gracious welcoming hand gesture toward the floating islands. The children turn their eyes toward the view. Slow restrained camera arc, drifting clouds, no flying through the landscape. Preserve the castle layout, costume details and faces.

Keep the first frame's original high-end 3D family animation look, lighting, faces, wardrobe and proportions consistent. One shot, no internal cuts. No generated dialogue, no music, no captions, no logos and no invented app interface. Any generated sound will be discarded; the final ElevenLabs voiceover is added in editing.
```

**ElevenLabs-Einsätze:**

- Tavi: „Willkommen in Talea!“

**Einblendung im Schnitt:** „Talea“ klein im Schnitt; Landschaft bleibt frei.

**S07 · 0:30–0:35 · Ein Drache braucht Licht**

Geplanter Startbild-Dateiname: `S07_start.png`. Das Startbild muss zuerst erstellt oder aus vorhandenem Material gewählt werden.

**In den Bildgenerator:**

```text
A single polished cinematic frame from an original high-end 3D family animated feature. Appealing rounded character design, detailed soft hair and cloth, expressive eyes, physically plausible materials, warm volumetric light, cinematic depth and clear silhouettes. Vertical 9:16 composition. Match the supplied approved character references exactly. No captions, logos, watermarks or readable text. Tablet displays are blank compositing plates; actual Talea screens will be inserted separately.

Eight-year-old boy with fair skin, green eyes and short chestnut curls. Mint-green pajamas with pale piping at home. In the fantasy world a sage-green tunic, brown shoulder strap and small turquoise pendant. Playful, attentive, never mocking.
Small sky-blue dragon about the height of Mila's hip, cream belly, two short blunt horns, small deep-blue wings, blue eyes and a soft rounded muzzle. A tiny red lantern with warm light is his recurring prop. Shy and lovable, with one gentle comic sneeze producing three small golden sparks.
Use only the fantasy wardrobe in this image.

At the edge of a warm luminous forest, the small blue dragon holds his unlit tiny red lantern and hides partly behind one leaf smaller than his face. Fantasy Ben stands close by, ready to crouch. Dragon and leaf remain clearly visible, with reassuring golden light between the trees.
```

**Danach in den Videogenerator, zusammen mit diesem Startbild, Dauer 5 Sekunden:**

```text
Animate the supplied first frame as one continuous five-second shot. The boy gently crouches beside the dragon. The dragon attempts to hide a little more behind his comically undersized leaf, then peeks over it. Small sideways camera reveal at dragon eye level. Keep the red lantern unlit and in the dragon's hands. No threatening darkness.

Keep the first frame's original high-end 3D family animation look, lighting, faces, wardrobe and proportions consistent. One shot, no internal cuts. No generated dialogue, no music, no captions, no logos and no invented app interface. Any generated sound will be discarded; the final ElevenLabs voiceover is added in editing.
```

**ElevenLabs-Einsätze:**

- Ben: „Du brauchst wohl ein Nachtlicht.“

**Einblendung im Schnitt:** Keine.

**S08 · 0:35–0:40 · Wir gehen zusammen**

Geplanter Startbild-Dateiname: `S08_start.png`. Das Startbild muss zuerst erstellt oder aus vorhandenem Material gewählt werden.

**In den Bildgenerator:**

```text
A single polished cinematic frame from an original high-end 3D family animated feature. Appealing rounded character design, detailed soft hair and cloth, expressive eyes, physically plausible materials, warm volumetric light, cinematic depth and clear silhouettes. Vertical 9:16 composition. Match the supplied approved character references exactly. No captions, logos, watermarks or readable text. Tablet displays are blank compositing plates; actual Talea screens will be inserted separately.

Seven-year-old girl with warm brown skin, large brown eyes and black curly hair in two small side buns. Mustard yellow cotton pajamas at home. In the fantasy world the same face and hairstyle, with a dusty plum-pink cape, a small gold clasp and a mustard shirt. Curious, observant and kind.
Small sky-blue dragon about the height of Mila's hip, cream belly, two short blunt horns, small deep-blue wings, blue eyes and a soft rounded muzzle. A tiny red lantern with warm light is his recurring prop. Shy and lovable, with one gentle comic sneeze producing three small golden sparks.
Use only the fantasy wardrobe in this image.

Close two-shot in the same luminous forest. Fantasy Mila kneels beside the small blue dragon. He holds his unlit tiny red lantern. Mila's hand holds one small golden light spark just above the lantern. The dragon peers from behind his small leaf. Gentle eye-level staging.
```

**Danach in den Videogenerator, zusammen mit diesem Startbild, Dauer 5 Sekunden:**

```text
Animate the supplied first frame as one continuous five-second shot. The gold spark gently lights the red lantern. The dragon emerges slightly from behind the leaf and meets the girl's eyes. Very slow camera push-in. Preserve the same single red lantern in the dragon's hands; do not add another lantern. Subtle warm reflections, no sudden flash.

Keep the first frame's original high-end 3D family animation look, lighting, faces, wardrobe and proportions consistent. One shot, no internal cuts. No generated dialogue, no music, no captions, no logos and no invented app interface. Any generated sound will be discarded; the final ElevenLabs voiceover is added in editing.
```

**ElevenLabs-Einsätze:**

- Mila: „Komm. Wir gehen zusammen.“

**Einblendung im Schnitt:** Keine.

**S09 · 0:40–0:45 · Ein kleiner Schritt bleibt**

Geplanter Startbild-Dateiname: `S09_start.png`. Das Startbild muss zuerst erstellt oder aus vorhandenem Material gewählt werden.

**In den Bildgenerator:**

```text
A single polished cinematic frame from an original high-end 3D family animated feature. Appealing rounded character design, detailed soft hair and cloth, expressive eyes, physically plausible materials, warm volumetric light, cinematic depth and clear silhouettes. Vertical 9:16 composition. Match the supplied approved character references exactly. No captions, logos, watermarks or readable text. Tablet displays are blank compositing plates; actual Talea screens will be inserted separately.

Seven-year-old girl with warm brown skin, large brown eyes and black curly hair in two small side buns. Mustard yellow cotton pajamas at home. In the fantasy world the same face and hairstyle, with a dusty plum-pink cape, a small gold clasp and a mustard shirt. Curious, observant and kind.
Eight-year-old boy with fair skin, green eyes and short chestnut curls. Mint-green pajamas with pale piping at home. In the fantasy world a sage-green tunic, brown shoulder strap and small turquoise pendant. Playful, attentive, never mocking.
Small sky-blue dragon about the height of Mila's hip, cream belly, two short blunt horns, small deep-blue wings, blue eyes and a soft rounded muzzle. A tiny red lantern with warm light is his recurring prop. Shy and lovable, with one gentle comic sneeze producing three small golden sparks.
Use only the fantasy wardrobe in this image.

Medium-wide static composition in the same luminous forest. Fantasy Mila and Ben stand beside the small blue dragon. His red lantern is now lit. One golden spark floats near his nose. All three faces are readable with enough empty space for a tiny sneeze effect.
```

**Danach in den Videogenerator, zusammen mit diesem Startbild, Dauer 5 Sekunden:**

```text
Animate the supplied first frame as one continuous five-second shot. The dragon sniffs the golden spark, then gives one gentle sneeze producing three tiny golden sparks. The boy blinks in surprise, then smiles; the girl smiles reassuringly. Static camera. Preserve the dragon, lantern and costumes. No explosion or large flames.

Keep the first frame's original high-end 3D family animation look, lighting, faces, wardrobe and proportions consistent. One shot, no internal cuts. No generated dialogue, no music, no captions, no logos and no invented app interface. Any generated sound will be discarded; the final ElevenLabs voiceover is added in editing.
```

Im Schnitt die Drachenreaktion auf ungefähr vier Sekunden kürzen und danach ungefähr eine Sekunde das echte Avatarprofil zeigen. Falls sich exakt drei Funken nicht zuverlässig erzeugen lassen, den kleinen Effekt im Schnitt ergänzen.

**ElevenLabs-Einsätze:**

- Erzählerin: „Eure Helden sammeln Erinnerungen und entwickeln sich weiter.“

**Einblendung im Schnitt:** „Helden entwickeln sich weiter“

**S10 · 0:45–0:50 · Der Held kommt wieder**

Geplanter Startbild-Dateiname: `S10_start.png`. Das Startbild muss zuerst erstellt oder aus vorhandenem Material gewählt werden.

**In den Bildgenerator:**

```text
A single polished cinematic frame from an original high-end 3D family animated feature. Appealing rounded character design, detailed soft hair and cloth, expressive eyes, physically plausible materials, warm volumetric light, cinematic depth and clear silhouettes. Vertical 9:16 composition. Match the supplied approved character references exactly. No captions, logos, watermarks or readable text. Tablet displays are blank compositing plates; actual Talea screens will be inserted separately.

Seven-year-old girl with warm brown skin, large brown eyes and black curly hair in two small side buns. Mustard yellow cotton pajamas at home. In the fantasy world the same face and hairstyle, with a dusty plum-pink cape, a small gold clasp and a mustard shirt. Curious, observant and kind.
Small sky-blue dragon about the height of Mila's hip, cream belly, two short blunt horns, small deep-blue wings, blue eyes and a soft rounded muzzle. A tiny red lantern with warm light is his recurring prop. Shy and lovable, with one gentle comic sneeze producing three small golden sparks.
Use only the fantasy wardrobe in this image.

Close two-shot at the open compartment window of a whimsical sky train on a bright new day. Fantasy Mila recognizes the same small blue dragon. He holds the same lit tiny red lantern at chest height, ready to raise it. Peach clouds and a soft distant landscape outside; safe staging inside the train.
```

**Danach in den Videogenerator, zusammen mit diesem Startbild, Dauer 5 Sekunden:**

```text
Animate the supplied first frame as one continuous five-second shot. The dragon proudly raises his tiny red lantern slightly. The girl meets his eyes and smiles in recognition. Gentle camera tracking parallel to the slowly moving sky train. Keep both characters safely inside and preserve the same lantern. No visible speaking required.

Keep the first frame's original high-end 3D family animation look, lighting, faces, wardrobe and proportions consistent. One shot, no internal cuts. No generated dialogue, no music, no captions, no logos and no invented app interface. Any generated sound will be discarded; the final ElevenLabs voiceover is added in editing.
```

**ElevenLabs-Einsätze:**

- Fips: „Du wieder! Die Laterne hab ich noch.“

**Einblendung im Schnitt:** „Neue Abenteuer. Vertraute Helden.“

**S11 · 0:50–0:55 · Geschichten sehen und lesen**

Echte bebilderte Geschichte im Reader zeigen. Eine ruhige kleine Scrollbewegung genügt.

Für die einfache Fassung wird hier kein HeyGen-Prompt benötigt. Ruhige Vollbildaufnahme im Schnitt auf fünf Sekunden begrenzen. Für eine spätere aufwendigere Fassung die Aufnahme in ein animiertes Tablet einsetzen.

**ElevenLabs-Einsätze:**

- Erzählerin: „Gemeinsam lesen. Mit Bildern, die eure Geschichte lebendig machen.“

**Einblendung im Schnitt:** „Lesen mit Bildern“

**S12 · 0:55–1:00 · Geschichten hören**

Echte Vorlesefunktion zeigen und starten. Bei Bedarf eine ruhige Familienaufnahme aus S17 einsetzen; abweichende sichtbare Mundbewegungen vermeiden.

Für die einfache Fassung wird hier kein HeyGen-Prompt benötigt. Ruhige Vollbildaufnahme im Schnitt auf fünf Sekunden begrenzen. Für eine spätere aufwendigere Fassung die Aufnahme in ein animiertes Tablet einsetzen.

**ElevenLabs-Einsätze:**

- Erzählerin: „Oder zurücklehnen und Geschichten vorlesen lassen.“

**Einblendung im Schnitt:** „Auch zum Zuhören“

**S13 · 1:00–1:05 · Eine Frage öffnet die nächste Tür**

Geplanter Startbild-Dateiname: `S13_start.png`. Das Startbild muss zuerst erstellt oder aus vorhandenem Material gewählt werden.

**In den Bildgenerator:**

```text
A single polished cinematic frame from an original high-end 3D family animated feature. Appealing rounded character design, detailed soft hair and cloth, expressive eyes, physically plausible materials, warm volumetric light, cinematic depth and clear silhouettes. Vertical 9:16 composition. Match the supplied approved character references exactly. No captions, logos, watermarks or readable text. Tablet displays are blank compositing plates; actual Talea screens will be inserted separately.

Seven-year-old girl with warm brown skin, large brown eyes and black curly hair in two small side buns. Mustard yellow cotton pajamas at home. In the fantasy world the same face and hairstyle, with a dusty plum-pink cape, a small gold clasp and a mustard shirt. Curious, observant and kind.
Use the supplied Talea Tavi reference: friendly turquoise genie, rounded face, expressive eyes, red turban with gold setting and a blue feather, gold wrist cuffs and small hoop earrings, floating curved lower body, small golden lamp. Translate the existing mascot into polished three-dimensional character animation while preserving its recognizable design.

Close two-shot of Mila in mustard pajamas in the warm home, beside a tablet. Tavi floats at her eye level as an imaginative companion. Mila looks curiously toward him. A subtle star constellation glows above them. He has not yet raised his pointing hand.
```

**Danach in den Videogenerator, zusammen mit diesem Startbild, Dauer 5 Sekunden:**

```text
Animate the supplied first frame as one continuous five-second shot. The girl looks up with curiosity. The genie gives a thoughtful expression and points once toward the faint stars above them. Gentle camera move with clear eye contact. Preserve the genie design and the girl's identity. No visible speaking required.

Keep the first frame's original high-end 3D family animation look, lighting, faces, wardrobe and proportions consistent. One shot, no internal cuts. No generated dialogue, no music, no captions, no logos and no invented app interface. Any generated sound will be discarded; the final ElevenLabs voiceover is added in editing.
```

**ElevenLabs-Einsätze:**

- Mila: „Warum funkeln Sterne eigentlich?“
- Tavi: „Finden wir’s heraus!“

**Einblendung im Schnitt:** „Fragen stellen mit Tavi“

**S14 · 1:05–1:10 · Wissen wird eine Entdeckung**

Echte Wissens-Doku und Tavi zeigen, beispielsweise zwei ruhige Ausschnitte von je 2,5 Sekunden.

Für die einfache Fassung wird hier kein HeyGen-Prompt benötigt. Ruhige Vollbildaufnahme im Schnitt auf fünf Sekunden begrenzen. Für eine spätere aufwendigere Fassung die Aufnahme in ein animiertes Tablet einsetzen.

**ElevenLabs-Einsätze:**

- Erzählerin: „Tavi hilft beim Entdecken. Dokus erklären eure Lieblingsthemen.“

**Einblendung im Schnitt:** „Wissens-Dokus entdecken“

**S15 · 1:10–1:15 · Rätseln, raten, lachen**

Echte Quizfrage, Auswahl und Rückmeldung zeigen. Den Spielebereich bei Bedarf als kurzen zusätzlichen Ausschnitt einsetzen.

Für die einfache Fassung wird hier kein HeyGen-Prompt benötigt. Ruhige Vollbildaufnahme im Schnitt auf fünf Sekunden begrenzen. Für eine spätere aufwendigere Fassung die Aufnahme in ein animiertes Tablet einsetzen.

**ElevenLabs-Einsätze:**

- Erzählerin: „Mit Quizfragen und Spielen entdeckt ihr gemeinsam noch mehr.“

**Einblendung im Schnitt:** „Quiz & Spiele“

**S16 · 1:15–1:20 · Eltern geben den Rahmen**

Echte vorhandene Einstellung im Elternbereich zeigen, zum Beispiel ein Tageslimit. Private Profilinformationen ausblenden.

Für die einfache Fassung wird hier kein HeyGen-Prompt benötigt. Ruhige Vollbildaufnahme im Schnitt auf fünf Sekunden begrenzen. Für eine spätere aufwendigere Fassung die Aufnahme in ein animiertes Tablet einsetzen.

**ElevenLabs-Einsätze:**

- Erzählerin: „Themen und Tageslimits legt ihr im Elternbereich fest.“

**Einblendung im Schnitt:** „Eltern bestimmen den Rahmen“

**S17 · 1:20–1:25 · Kommt Fips morgen wieder?**

Geplanter Startbild-Dateiname: `S17_start.png`. Das Startbild muss zuerst erstellt oder aus vorhandenem Material gewählt werden.

**In den Bildgenerator:**

```text
A single polished cinematic frame from an original high-end 3D family animated feature. Appealing rounded character design, detailed soft hair and cloth, expressive eyes, physically plausible materials, warm volumetric light, cinematic depth and clear silhouettes. Vertical 9:16 composition. Match the supplied approved character references exactly. No captions, logos, watermarks or readable text. Tablet displays are blank compositing plates; actual Talea screens will be inserted separately.

Seven-year-old girl with warm brown skin, large brown eyes and black curly hair in two small side buns. Mustard yellow cotton pajamas at home. In the fantasy world the same face and hairstyle, with a dusty plum-pink cape, a small gold clasp and a mustard shirt. Curious, observant and kind.
Eight-year-old boy with fair skin, green eyes and short chestnut curls. Mint-green pajamas with pale piping at home. In the fantasy world a sage-green tunic, brown shoulder strap and small turquoise pendant. Playful, attentive, never mocking.
Mother in her mid-thirties with warm brown skin, dark curly hair loosely tied back, a cream knit cardigan and relaxed posture. Warm, attentive, present with her children in the real home.

Intimate medium three-shot of the same family under the same cream blanket in the cozy home. Mila looks toward her mother; Ben holds a small childlike dragon drawing. The tablet rests securely on a cushion. Soft warm lamp light, home pajamas, no fantasy costumes.
```

**Danach in den Videogenerator, zusammen mit diesem Startbild, Dauer 5 Sekunden:**

```text
Animate the supplied first frame as one continuous five-second shot. The girl looks up at her mother with hopeful curiosity. The mother smiles and gently draws both children closer. The boy keeps holding his drawing. Slow restrained camera pullback. Preserve the family, blanket, tablet and drawing. Use subtle reactions rather than visible spoken dialogue.

Keep the first frame's original high-end 3D family animation look, lighting, faces, wardrobe and proportions consistent. One shot, no internal cuts. No generated dialogue, no music, no captions, no logos and no invented app interface. Any generated sound will be discarded; the final ElevenLabs voiceover is added in editing.
```

**ElevenLabs-Einsätze:**

- Mila: „Kommt Fips morgen wieder?“
- Mama: „Er wartet schon.“

**Einblendung im Schnitt:** Keine.

**S18 · 1:25–1:30 · Das Tor bleibt offen**

Die vorhandene Talea-Welt als ruhiges Hintergrundbild verwenden. Im Schnitt das originale Logo, „Kostenlos ausprobieren“ und „talea.website“ einsetzen. Fünf Sekunden stehen lassen. Eine dezente Kamerafahrt über das Bild kann im Schnitt angelegt werden; dafür ist keine neue Videogenerierung nötig.

**ElevenLabs-Einsätze:**

- Erzählerin: „Talea. Wo ihr zur Geschichte werdet.“

**Einblendung im Schnitt:** Original-Logo · „Kostenlos ausprobieren“ · „talea.website“; optionale kleine Zeile „Zum Start: 3 Geschichten in 7 Tagen“ nur nach erneuter Angebotsprüfung.

**Sprache und Lippensynchronisation**

Eine Erzählerstimme kann über die Bilder gelegt werden, ohne dass eine Figur dazu sichtbar spricht. Kinder- und Tavi-Dialoge sollten für die einfache Fassung als Off-Ton oder über Blickreaktionen laufen. Wenn eine Figur in Nahaufnahme sichtbar die Worte spricht, muss ihr Mund zur fertigen ElevenLabs-Datei passen; das entsteht durch nachträgliches Auflegen der Datei allein nicht.

HeyGen Video 1 bietet in seinem Referenzmodus auch Audioreferenzen an. Die Dokumentation unterscheidet zwischen einer Stimme als Beispiel und der Wiedergabe einer gelieferten Aufnahme. Für eine lippensynchrone Fassung müsste die jeweilige fertige ElevenLabs-Datei ausdrücklich als Aufnahme zugewiesen werden; dieser Referenzmodus ist beim dokumentierten Anbieter ein anderer Weg als das feste Startbild. Deshalb zunächst einen kurzen Test machen und diese beiden Modi nicht als frei kombinierbar voraussetzen. [Runware: Audioreferenzen](https://runware.ai/docs/models/heygen-video-1-0/guides/audio-references)

**Dein erster praktischer Schritt**

Zuerst nur das Startbild für **S01** erstellen. Es zeigt alle drei Familienfiguren im Kinderzimmer. Wenn die Gesichter, Hände, das Tablet und die Bildkomposition passen, daraus mit dem S01-Videoprompt fünf Sekunden animieren. Erst nach diesem kurzen Test die restlichen Startbilder und Clips produzieren.

Die neue Anleitung ist eine Generierungsvorlage. Sie enthält noch keine generierten Bilder, Videos oder Sprachdateien.

