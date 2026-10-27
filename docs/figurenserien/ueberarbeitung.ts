/** Apply the dated editorial review to the preserved draft, then export separately. */
import { readFile, writeFile } from "node:fs/promises";
const draft = await readFile("docs/figurenserien/serienbibeln-entwurf.md", "utf8");
const parts = draft.split(/^## \d\. /m);
if (parts.length !== 6) throw new Error("Five draft series are required");

const revisions = [
`### Verbindliche Welt- und Zeitregeln nach Lektorat

Die Fee kann, solange sie erkennbar genug ist, Dinge so leicht wie ein Mensch ihrer Größe berühren, tragen und Pfannkuchen essen. Beim Verblassen wird ihr Griff schwächer; sie setzt einen Gegenstand vorher ab. Für andere ist sie meist nur wegen ihrer Scheu unauffällig, nicht beliebig unsichtbar. Die Wegwarte ist ein fester Ort. Wer drinnen ist, erkennt den Ausgang auch bei klarem Wetter; draußen ist der Eingang bei dichtem Nebel leichter zu erkennen.

Ihre Suche gilt Dingen und vermissten Wegen, nicht Menschen als Dingen. Vor der Entdeckung der Gabe nimmt sie nur ein unverständliches Schimmern wahr. Erst eine konkrete Angabe zum Vermissten und zu dessen letztem bekannten Ort zeigt ihr von dort die nächste nachweisbare Wegkreuzung, nicht Ziel, Besitzer oder Lösung. An jeder neuen Kreuzung braucht sie einen neuen konkreten Hinweis. Wird die Spur falsch gedeutet, hilft sie nicht weiter. Ihr eigener Heimweg bleibt für sie unlesbar: Ihr fehlen die konkreten Angaben zum Ausgangspunkt. Die alte Eiche berichtet später von einer Wegwarte mit mehreren Betreibern; ein unabhängig gefundener Arbeitsplan bestätigt das. Ein Holzzeichen in einem Brief deutet irreführend auf die Eiche selbst; erst ein von einer früheren Betreiberin identifiziertes gleiches Zeichen auf einer Karte korrigiert die Vermutung. Niemand behauptet diese Hinweise, bevor sie in der jeweiligen Familie erzählt wurden.

### Persönlicher Ursprung: das Kind im Nebel

**Davor fest:** Die Fee hat ihren Heimweg verloren. Sie kennt ihre Suchgabe noch nicht; Kind und Avatare begegnen ihr zum ersten Mal. Die Wegwarte wird noch nicht betrieben.

**Wunsch und erster Versuch:** Ein Avatar will zum verabredeten Treffpunkt am See und bemerkt ein Kind, das zurück nach Hause möchte. Ein zunächst kaum sichtbares Schimmern lockt die Fee und die Gruppe zu einer Kreuzung mit zwei fast gleichen Stegen. Sie wählen nach einer vagen Vermutung den kürzeren Steg, dessen Ende aber wegen Reparatur gesperrt ist: Sie verlieren Zeit und müssen zur Kreuzung zurück. Die Fee will aus Scheu schweigen; das Kind kann den letzten vertrauten Ort selbst benennen.

**Wahl und Folge:** Ein Avatar kann anhand der unterschiedlichen Spuren die Fehlannahme überprüfen oder aus dem Gespräch einen neuen Hinweis gewinnen. Um die Gruppe zusammenzuhalten, verzichtet er auf die schnelle eigene Abkürzung und markiert den gemeinsam überprüften Rückweg. Nun fragt die Fee selbst nach dem letzten vertrauten Ort; damit wird aus ihrem Schimmern eine lesbare Spur bis zur nächsten Kreuzung. Kind und Fee entscheiden gemeinsam an der Kreuzung weiter, die Avatare steuern den überprüften Weg bei. Der Rückweg führt an der verlassenen Wegwarte vorbei. Das Kind kommt heim; die Fee beschließt am folgenden Morgen, dort ein erstes Regal für Fundstücke aufzustellen. Bei mehreren Avataren sind Beiträge variierbar; ein einzelner kann sowohl nachfragen als auch den Weg markieren. Die persönliche Art der Markierung und die Begegnung sind Familiengeschichte, nicht globaler Kanon.

### Stoff für vier Erzählbögen

Jeder Fall nennt Wunsch → Gegenkraft → Komplikation → Entscheidung → Ergebnis. Die Anordnung ist ein flexibler Vorrat, keine Behauptung, dass alle Fälle bereits passiert sind.

**1–10: Rückgabestelle aufbauen**
1. Fee will einen Hut zurückgeben → ein Vogel braucht sein Nest → der Besitzer möchte den Hut zur Feier → sie wartet mit der Rückgabe, bis ein Ersatznest fertig ist → beide erhalten, was sie brauchen; der erste bestätigte Fall ist vermerkt.
2. Milo will eine Lieferung pünktlich bringen → ein Schild ist am See spiegelverkehrt zu lesen → seine Eile führt zur falschen Tür → er prüft die Adresse mit einem Avatar → die Zustellung gelingt; Milo ergänzt seine Regeln um eine Rückfrage.
3. Fee will einen Schlüssel zurückgeben → zwei Geschwister beanspruchen ihn → ein verfrühter Verdacht verletzt eines → Fee gibt ihren Irrtum zu und fragt nach → es ist der gemeinsame Werkstattschlüssel; beide bestimmen künftig die Aufbewahrung.

**11–20: Alte Wege lesen**
1. Fee sucht Betreiber der Wegwarte → alte Eiche fürchtet Grabungen nahe ihrer Wurzeln → ein Brief weist irrtümlich auf sie → Fee schützt die Wurzeln und untersucht einen Arbeitsplan → ein ehemaliger gemeinsamer Betrieb ist belegt.
2. Riko möchte eine glänzende Dose behalten → die Besitzerin erkennt sie, scheut aber deren Erinnerung → Riko hat sie ungefragt geputzt → er bietet sie zurück und akzeptiert ein Nein → sie verwahrt die Dose selbst; Rückgabe ist kein Zwang.
3. Ein Avatar will den schnellsten Weg markieren → ein Holzzeichen scheint nach Hause zu weisen → eine andere Reisende erkennt dasselbe Zeichen auf ihrer Karte als Werkstattmarke → die Fee verwirft ihre Lieblingsdeutung → eine falsche Heimspur ist abgeschlossen.

**21–30: Wege teilen**
1. Milo verlangt den gewohnten Pfad → der umgestürzte Baum schützt einen Tierbau → eine Umleitung stört einen Bootsplatz → Fee entscheidet sich mit den Betroffenen für gestaffelte Wege → ein neuer Pfad wird dauerhaft markiert.
2. Die Eiche will keinen neuen Wegweiser → Riko braucht eine Aussichtsstelle → sein provisorischer Pfosten fällt um → beide testen einen Platz ohne Wurzelschaden → Riko betreut den neuen Pfosten.
3. Fee möchte ein Fundstück sofort zustellen → die Eigentümerin ist verreist und eine Nachbarin will es an sich nehmen → ein Versprechen kollidiert mit der Eile → Fee verwahrt es bis zur Rückkehr → die Eigentümerin bestätigt den sicheren Umgang.

**31–40: Heimweg und Wahl**
1. Fee will eine frühere Betreiberin finden → diese möchte nicht über alle früheren Wege sprechen → ein alter Plan weckt eine falsche Erwartung → Fee bietet Hilfe ohne Gegenleistung → die Betreiberin bestätigt ein Zeichen, verrät aber keine fertige Lösung.
2. Ein Avatar will die Fee auf dem möglichen Heimweg begleiten → die Wegwarte braucht gleichzeitig Betreuung → Milo kann nur eine Aufgabe übernehmen → Fee bittet Riko um einen konkreten Dienst und geht mit → die Rückgabestelle bleibt offen, ein neuer Ort wird erreicht.
3. Fee sucht einen alten Treffpunkt → Bewohner haben den Ort inzwischen verändert → ihre alte Erinnerung passt nicht mehr → sie fragt nach den Menschen statt nach einem unveränderten Haus → sie findet eine frühere Weggemeinschaft und wählt die Wegwarte zugleich als Zuhause.

**Variabler Humor:** sichtbare wandernde Fundstücke; eine überlange Dienstregel, die einmal tatsächlich hilft; die Fee hält ein Lob nicht aus und nimmt später ein unbemerktes Dankeschön an. Die Eiche löst einmal einen Fall richtig, weil sie Veränderungen sorgfältig bemerkt.`,
`### Verbindlicher Serienmotor und Zeitregel nach Lektorat

Die Höhle ist Funkelflugs Zuhause, aber der Motor sind Wege, Reichweiten und Nachbarschaften am Drachenberg: Wer kann wohin, wie treffen sich unterschiedlich große Wesen, wo erzeugen Flügel Zugluft, wem gehört welcher Platz? Nicht jede Folge ist ein Fest. Er landet nach Sprüngen, kann nicht fliegen; seine kleinen Flügel bleiben begrenzt. Die Funken entstehen unwillkürlich und sind kein Lösungszauber. Auf dem Berg gibt es sichere Bodenwege. Oma Schuppe bevorzugt ausgerechnet eine enge, windgeschützte Ecke für ihre empfindlichen Pflanzen; Mucks verfolgt einmal selbst einen riesigen Plan für seinen Bau.

Der Ursprung und die ersten Bergfolgen liegen nahe beieinander. Im Pilot vertraut Funkelflug nur den anwesenden Avataren an, dass seine vermeintlichen Flüge Sprünge sind. Gegenüber anderen behauptet er anfangs weiter Großartiges. Erst in einer tatsächlich erzählten späteren Folge übt er öffentlich. Ein später neu hinzukommender Avatar kennt das Geheimnis nicht automatisch.

### Persönlicher Ursprung: Funken am Berg

**Davor fest:** Funkelflug schämt sich für seine kleinen Flügel. Der erste Dank der frierenden Wanderer steht noch bevor. Ein betreutes, bereits vorbereitetes Lagerfeuer ist vorhanden; ein Erwachsener übernimmt dessen sichere Betreuung.

**Wunsch und erster Versuch:** Ein Avatar möchte, dass alle Wanderer vor Einbruch der Kühle am Treffpunkt zusammenkommen. Funkelflug will ihnen einen vermeintlichen Flug vorführen und lockt sie zu einem Aussichtspunkt. Doch der Bodenweg dorthin ist für einen langsamen Wanderer zu steil; die Gruppe kommt auseinander und der Auftritt kann nicht beginnen. Beim Zurückspringen niest er Funken in die vorbereitete Feuerstelle. Der Erwachsene beaufsichtigt sie; das Feuer allein bringt die Getrennten nicht zusammen.

**Wahl und Folge:** Der Avatar kann den flachen Weg erkunden oder die Wanderer nach einem geeigneten Treffpunkt fragen. Beide Wege zeigen, dass Funkelflugs geplanter Aussichtspunkt die Gruppe trennt. Der Avatar gibt den Wunsch auf den spektakulären Ausblick auf und schlägt die Höhle am Fuß des Berges vor. Funkelflug verzichtet auf seinen Auftritt, gesteht den anwesenden Avataren seine Sprünge und führt die Gruppe über den Bodenweg zusammen. Die Wanderer wärmen sich am beaufsichtigten Feuer und danken ihm; daraus entsteht sein Wunsch nach einer Höhle für alle Größen. Die konkrete gemeinsame Route und das vertraute Geheimnis sind persönlicher Zustand.

### Stoff für vier Erzählbögen

**1–10: Wege statt Flügel**
1. Funkelflug will den Gipfel zeigen → Mucks braucht einen ungestörten Bodenweg → große Schritte versperren dessen Eingang → Funkelflug wählt einen Umweg → beide erreichen den Aussichtspunkt und markieren den alternativen Pfad.
2. Oma will ihre Pflanzen geschützt aufstellen → Funkelflug bietet den größten Platz → Flügelzug trocknet die Erde aus → er reserviert ihre enge Nische → ihre Pflanzenecke bleibt bestehen.
3. Ein Avatar will eine Brücke überqueren → ein großer Drache passt nicht auf den schmalen Steg → Funkelflug erkundet den unteren Pfad → die Gruppe teilt sich kurz und verabredet einen Treffpunkt → beide Wege werden künftig genutzt.

**11–20: Der Berg als Nachbarschaft**
1. Mucks plant einen riesigen Vorratsraum → sein Aushub blockiert Funkelflugs Zugang → eine gemeinsame Probe zeigt lockeren Boden → Mucks verkleinert den Plan, Funkelflug bietet Ablageplatz → der Bau bleibt sicher und beide behalten Zugang.
2. Funkelflug will einen Windweg freihalten → ein großer Drache braucht den Landeplatz → flatternde Tücher zeigen unerwartet starke Böen → er setzt seine genaue Bodenkenntnis ein → ein windarmer Zeitplan entsteht.
3. Ein Avatar möchte eine Botschaft zur Hochebene bringen → der direkte Pfad ist überflutet → ein erfahrener Drache bietet an zu fliegen, kann aber den kleinen Eingang nicht erreichen → Funkelflug übernimmt das letzte Stück → eine feste Übergabestelle wird eingerichtet.

**21–30: Die Karte der Bodenwege**
1. Funkelflug will den schnellsten Bergweg kartieren → Oma braucht einen flachen Weg → seine erste Karte berücksichtigt nur ihn selbst → er zeichnet Höhen und Pausenplätze statt einer Siegerroute ein → mehrere geeignete Wege stehen fest.
2. Ein junger Drache hält seine kleinen Schritte für ein Hindernis → Funkelflug will imponieren → ein enger Spalt verlangt gerade kleine Schritte → er bittet den Jungen um Führung → dessen Route ergänzt die Karte.
3. Zwei Bergbewohner beanspruchen einen Durchgang → ein Felssturz macht Teilen vorübergehend unmöglich → Funkelflug verzichtet auf die eigene Abkürzung → ein zeitlich geteiltes Wegerecht wird vereinbart.

**31–40: Offen üben, Neues entdecken**
1. Funkelflug will einen Sprung üben → Publikum erscheint → ein Avatar bietet Schutz vor Blicken, aber der beste Übungsplatz ist offen → Funkelflug entscheidet sich für einen kleinen öffentlichen Versuch → andere kennen nun sein Üben, nicht eine plötzliche Flugfähigkeit.
2. Mucks will seinen Plan verteidigen → Oma entdeckt eine seltene Pflanze am Bauplatz → Funkelflug braucht selbst den Weg → er organisiert eine Erkundung mit beiden → der Bau wird versetzt und die Pflanze bleibt.
3. Funkelflug möchte einen neuen Pfad eröffnen → der alte Wegweiser führt unabsichtlich zur Höhle zurück → ein Avatar bemerkt die verwechselte Markierung → Funkelflug berichtigt die Karte öffentlich → der Berg bekommt einen verlässlichen neuen Rundweg.

**Humor:** Ein großes Schild blockiert den kleinen Zugang; ein zu kleiner Becher ist für einen großen Gast unbrauchbar; Funkelflugs ehrwürdige Pose hilft einmal, weil sie einen wackelnden Wegweiser ruhig hält.`,
`### Verbindliches Ensemble nach Lektorat

Johann kennt die Hausordnung besser als der Graf und besteht gerade deshalb auf seinem freien Tag; der Graf schätzt seine Genauigkeit und ärgert sich, wenn sie gegen ihn angewandt wird. Bäcker Braun widerspricht beim Backen, bittet den Grafen aber um dessen präzises Gedächtnis für einen alten Lieferweg. Ada begründet eine Regel manchmal besser als der Graf; er bewundert ihr Schachspiel und will trotzdem ungern verlieren. Der Graf ist ein zuverlässiger Beobachter, seine Gebäcknase und sein Gedächtnis dürfen einmal entscheidend sein. Der Mittwochstisch ist nur ein Teil einer Beziehungskomödie; ein Besuch bei anderen kann schon früh vorkommen.

### Persönlicher Ursprung: ein Platz am Mittwochstisch

**Davor fest:** Die alten Gäste sind fortgezogen. Der Graf vermisst sie, hat den Tisch aber noch nicht wieder eröffnet. Er probiert eine Einladung aus und legt sie absichtlich auf das Fenstersims; beim Lüften weht sie in den Garten.

**Wunsch und erster Versuch:** Ein Avatar möchte dem Grafen den Zettel zurückgeben und herausfinden, ob er wirklich willkommen ist. Der Graf behauptet, der Satz „Bitte kommen Sie nicht“ gelte weiterhin, während er bereits Tassen deckt. Der Avatar nimmt die Regel ernst und will gehen; der Graf ruft ihn zu einer Frage zurück, ohne ihn einzuladen. Ein Versuch, durch die offene Tür gleichzeitig Abstand zu halten und Kekse zu überreichen, scheitert an seiner eigenen Türregel.

**Wahl und Folge:** Ein Avatar kann vorschlagen, zunächst vor der Tür gemeinsam zu sitzen, oder eine klare Einladung erbitten. Er verzichtet auf die bequeme Annahme, der Graf meine alles nicht so, und verlangt eine verständliche Abmachung. Der Graf muss seine eigene Regel sichtbar ändern: Er unterschreibt eine Einladung und erklärt, dass mittwochs ein Gast Platz hat. Gemeinsam erproben sie eine Sitzordnung; ein wackliger Stuhl bleibt zunächst leer und wird später repariert. Der Tisch ist wieder eröffnet, ohne dass das ganze Haus plötzlich voller Freunde ist. Die gemeinsam formulierte Ausnahme gehört zur persönlichen Beziehung.

### Stoff für vier Erzählbögen

**1–10: Hausordnung und erste Besuche**
1. Graf will absolute Ruhe → Ada möchte ein Schachspiel erklären → seine Flüsterregel macht beide unverständlich → er erlaubt Spielzüge in normaler Lautstärke → die Ausnahme wird notiert.
2. Johann will seinen freien Tag behalten → Graf braucht Hilfe beim Tisch → ein falscher Handgriff verklemmt die Schublade → der Graf fragt die Avatare und respektiert Johanns Pause → die Schublade wird später gemeinsam geöffnet.
3. Graf möchte bei Braun Brot kaufen → Braun will sein eigenes Rezept testen → der Graf kritisiert vorschnell die Kruste → er probiert einen ganzen Bissen und benennt ehrlich, was er mag → Braun ändert nur, was er selbst überzeugend findet.

**11–20: Geschichten des Hauses**
1. Graf will eine alte Vase richtig einordnen → Ada erinnert eine andere Familiengeschichte → der erste Hinweis verweist auf zwei ähnliche Vasen → beide prüfen eine alte Zeichnung → die korrekte Zuordnung wird dauerhaft festgehalten.
2. Graf besucht Braun → dort gilt eine fremde Küchenordnung → er verstellt ungewollt den Teigplatz → er befolgt die fremde Regel und entdeckt dank seiner Nase den richtigen Backzeitpunkt → Braun lädt ihn erneut ein.
3. Johann möchte einen Nachmittag für sich → Graf vermisst einen Brief → beide beschuldigen das Aufräumen → der Graf findet ihn im eigenen Regelbuch → er entschuldigt sich und ändert seine Ablage.

**21–30: Regeln auf Reisen**
1. Ada möchte ein Spiel ohne Zuschauer → Graf möchte kommentieren → seine Einwürfe verraten einen Zug → er entscheidet, als Spieler statt Schiedsrichter teilzunehmen → Ada gewinnt und der Graf verlangt eine Revanche.
2. Braun bittet den Grafen um einen alten Lieferweg → ein umgebautes Tor widerspricht dessen Erinnerung → der Graf überprüft mit einem Avatar eine zweite Landmarke → die neue Karte bewahrt beide Wege.
3. Eine Nachbarin möchte den Garten vorübergehend nutzen → Graf braucht Ruhe für eine eigene Verabredung → die Zeiten überschneiden sich → er handelt eine befristete Aufteilung aus → beide Zusagen werden eingehalten.

**31–40: Neue Rollen**
1. Graf will eine fremde Feier heimlich verbessern → Gastgeberin möchte ihre eigene Planung → sein Tischplan verwirrt die Gäste → er fragt, welche Aufgabe tatsächlich fehlt → er übernimmt freiwillig nur diese Aufgabe.
2. Johann will eine eigene Hausgeschichte erzählen → Graf erinnert ein anderes Ende → ein alter Brief belegt beide Perspektiven → Graf lässt Johanns Fassung neben seiner stehen → das Hausbuch enthält zwei Stimmen.
3. Ada möchte ein Schachturnier → Graf fürchtet Lärm und möchte dennoch mitspielen → seine neue Regel schließt ihn selbst aus → er streicht die Regel statt das Spiel → ein regelmäßiges kleines Turnier entsteht.

**Humor:** Eine Hausregel verhindert den Besuch; ihre Ausnahme wird länger als die Regel; Johann wendet sie später korrekt gegen den Grafen an. Dessen genaues Erinnern löst auch einmal ein Problem, statt bloß Pedanterie zu sein.`,
`### Verbindliche Kompass- und Zeitregeln nach Lektorat

Der Kompass benötigt ein erreichbares, durch eine reale Ortsangabe bestimmtes Ziel: zum Beispiel den sichtbaren Leuchtturm oder einen Ort auf einer zuverlässigen Karte. Ein vager Wunsch wie „die Insel mit dem Tor“ genügt nicht; seine Nadel bleibt stehen. Er zeigt eine grobe Richtung, keine Entfernung, sichere Route, Person oder Wahrheit. Auch wiederholtes Anpeilen eines unbestimmten Zieles liefert keine Position.

Zur Reisecrew zählen vor Fahrtbeginn ausdrücklich benannte, anwesende und an der Entscheidung beteiligte Menschen und sprechende Figuren. Stumme Tiere und Schlafende werden nicht zur Abstimmung herangezogen. Die Crew nennt laut ein bestimmtes Ziel und jede beteiligte Person legt freiwillig einen Finger auf den Kompass; wer nicht mitmacht oder Einwände äußert, löst kein Ergebnis aus. Die Nadel erkennt keine verborgenen Gefühle und beweist nicht, ob jemand ehrlich ist. In Geschichten wird freiwilliges Mitmachen gezeigt; Druck ist kein gutes Verfahren und keine Gedankenlesung. Eine neue Abmachung ersetzt die vorherige.

Beim Ursprung trägt die erfahrene Bootsführerin **Käthe** die Verantwortung für die Küstenfahrt. Die Gruppe landet zuerst sicher an einer bekannten Bucht; ein vereinbartes Lichtsignal erreicht Frau Wellenreiter am sichtbaren Leuchtturm. Einige Wochen später erhält Blubbert für ein kleines Boot selbst die Kapitänsrolle. Die Avatare sind nicht plötzlich Jahre älter; dieselben Teilnehmenden erinnern den Ursprung. Zwischenzeitlich kann die Crew wechseln. Blubbert erzählt neuen Crewmitgliedern die Regel zunächst unvollständig, weil er Anerkennung sucht; alte Weggefährten wissen es besser und dürfen seinen Rückfall ansprechen. Neu hinzukommende Avatare kennen nur, was ihnen erzählt wird.

### Persönlicher Ursprung: die Muschel im Nebel

**Davor fest:** Blubbert ist Matrose, Käthe führt die kurze Küstenfahrt. Die Avatare und Crew kennen den Kompass noch nicht. Am Ende findet Blubbert die Muschel; der konkrete gemeinsame Weg dahin ist persönlich.

**Wunsch und erster Versuch:** Ein Avatar möchte rechtzeitig ein verabredetes Bild am Leuchtturm übergeben, Blubbert will zur vertrauten Bucht zurück. In dichtem Nebel bringt Käthe alle vorsorglich an den Strand einer Bucht. Blubbert findet dort die Muschel, nennt allein den Leuchtturm und erhält keine Richtung. Die Gruppe probiert eine zweite, ebenfalls bekannte Ortsangabe; wieder bleibt die Nadel still, weil nur er sie hält. Der Avatar will den Leuchtturm nicht ohne gemeinsame Absprache aufsuchen, denn die Crew möchte zusammenbleiben.

**Wahl und Folge:** Der Avatar kann vorschlagen, jedes Ziel laut mit allen zu besprechen, oder zuerst beobachten, wer beim Versuch mitmacht. So entsteht die überprüfbare Idee eines gemeinsamen Fingerkontakts. Alle wägen den kurzen Weg zum sichtbaren Leuchtturm gegen das Warten ab und benennen den Turm; freiwillig legen sie die Finger auf. Die Nadel zeigt grob dorthin. Käthe prüft anhand der Küstenmerkmale den sicheren Weg; mit dem vereinbarten Lichtsignal machen sie Frau Wellenreiter auf sich aufmerksam. Das Bild kommt später als geplant an. Blubbert entscheidet, den Kompass für gemeinsame Fahrten aufzubewahren. Dass die anwesenden Avatare die Regel kennen, bleibt persönliche Kontinuität.

### Stoff für vier Erzählbögen

**1–10: Mannschaft und Küste**
1. Blubbert will eine Kiste schnell liefern → Pia braucht Platz für empfindliche Werkzeuge → beides passt nicht sicher nebeneinander → er wählt zwei kurze Fahrten → die Lieferung gelingt später, das Werkzeug bleibt ganz.
2. Avatar will eine Sandbank besuchen → Frau Wellenreiter meldet steigendes Wasser → die alte Skizze zeigt den Weg nur bei Ebbe → Blubbert erkennt die Gefahr und wählt einen anderen Landgang → die Karte erhält eine Gezeitenangabe.
3. Blubbert will einen fremden Einfall als eigenen ausgeben → ein alter Mitfahrer erinnert sich → eine neue Crewfrau versteht die Regel falsch → Blubbert erklärt den Kompass und nennt den Urheber → die Crew kennt die Abmachung.

**11–20: Karten widersprechen sich**
1. Crew sucht ein bekanntes Tor → zwei Zeichnungen zeigen andere Dächer → ein Sturm hat das Tor vor Jahren versetzt → Pia vergleicht Bauzeichen → der alte Standort wird von der aktuellen Lage getrennt.
2. Blubbert will ein Paket direkt bringen → Hafenpersonal benötigt vorher eine Anmeldung → der Kompass zeigt nur die Richtung, nicht die Hafenregel → er wartet und meldet die Crew an → künftige Besuche werden einfacher.
3. Ein Avatar hält eine blasse Linie für einen Weg → Blubbert erkennt eine alte Wasserstandslinie → die Crew prüft beide Deutungen vor Ort → sie korrigiert die Karte ohne den Avatar bloßzustellen → ein Irrtum ist dokumentiert.

**21–30: Andere Ziele**
1. Pia will Material für eine Reparatur → Blubbert will eine Inselspur verfolgen → beide Ziele kosten einen Tag → er entscheidet mit der Crew für die Reparatur → das Boot ist vorbereitet, die Spur muss später verfolgt werden.
2. Lotta nimmt einen glänzenden Knopf → die Crew verdächtigt sie auch beim Kartenverlust → eine nasse Tasche enthält die Karte → Blubbert widerruft seine Anschuldigung → Lottas Nest bleibt unbehelligt.
3. Blubbert will die bekannte Bucht anlaufen → eine Bewohnerin braucht Zugang für ihr Boot → der übliche Liegeplatz ist belegt → die Crew verhandelt einen anderen Platz → eine neue Hafenbeziehung entsteht.

**31–40: Die Insel mit Bewohnern**
1. Eine verlässliche Karte macht ein Küstenziel bestimmbar → die Crew will sofort aufbrechen → Pia erkennt eine nötige Reparatur → Blubbert verschiebt die Fahrt → das sichere Boot erreicht später die Küste.
2. Blubbert will das Tor allein benennen → Bewohner nutzen dort einen Garten → ein alter Name auf seiner Karte ist unvollständig → er fragt nach und verzeichnet beide Namen mit Erlaubnis → die Karte wird berichtigt.
3. Crew möchte die Insel erkunden → ein Weg ist aus gutem Grund gesperrt → ein Umweg kostet den geplanten Besuch eines Aussichtspunkts → Blubbert respektiert die Grenze → die Crew entdeckt mit Erlaubnis einen anderen Ort.

**Humor:** Blubbert nennt einen fremden Einfall seinen; er bemerkt die Formulierung später selbst; schließlich wird einer seiner guten Einfälle versehentlich Pia zugeschrieben. Seine Segelkenntnis löst auch einmal einen Irrtum der Avatare.`,
`### Verbindlicher Serienmotor nach Lektorat

Tildas Ideenfenster liefert Fragen, nicht automatisch Maschinenaufträge. Manche einfache Lösung funktioniert, manche scheitert an anderer Nutzung; manchmal ist eine größere Konstruktion sinnvoll. Tilda darf gut bauen und ein Avatar irren. Eine alte Erfindung kann erhalten, repariert, zweckentfremdet oder dokumentiert werden. Für den Raumkonflikt will Herr Seidel zeitweise Lagerfläche wegen einer nachvollziehbaren Schulveranstaltung nutzen; historische Nutzung belegt keine Eigentumsrechte. Spätere Werkstattfolgen handeln von Entwürfen und ihrer Weitergabe, nicht bloß von Raumverteilung.

### Persönlicher Ursprung: der rollende Bücherwagen

**Davor fest:** Tilda tüftelt bereits aus Küchenutensilien; das Ideenfenster gibt es noch nicht. Ein Erwachsener betreut den ungefährlichen Versuch mit einem leichten, leeren Wagen in einem abgegrenzten Bereich.

**Wunsch und erster Versuch:** Ein Avatar möchte Bücher rechtzeitig zum Vorlesetisch bringen. Tilda verspricht eine schnelle Fahrt und überhört dessen Hinweis auf den abschüssigen Boden. Der Wagen rollt im abgesicherten Bereich an der Haltestelle vorbei. Die Vorleserunde muss warten. Tilda möchte sofort erneut probieren, der Avatar möchte vorher klären, wie der Wagen halten soll.

**Wahl und Folge:** Der Avatar vergleicht mit Tilda zwei sichere Möglichkeiten: eine am Ziel angelegte weiche Begrenzung und eine einfache von einem Erwachsenen eingebaute Bremse. Die Begrenzung stoppt den leeren Wagen, versperrt aber den Zugang zum Vorlesetisch. Der Avatar entscheidet sich trotz Zeitverlust für die Bremse, damit das Buch zugänglich bleibt. Tilda gibt ihr schnelles Versprechen auf und bittet den Erwachsenen um den Einbau; sie prüft mit dem Avatar den Halt, bevor Bücher geladen werden. Die Vorleserunde beginnt verspätet. Tilda notiert zunächst „Was könnte im Weg sein?“; in späteren tatsächlich erzählten Versuchen kommen Fragen nach Zweck und Nutzenden hinzu. Auf Nachfrage der anderen entsteht später das Ideenfenster. Die gemeinsame Wahl bleibt Familiengeschichte.

### Stoff für vier Erzählbögen

**1–10: Was soll es können?**
1. Tilda will ein Buch offenhalten → Mina braucht einen freien Blick auf die Bilder → ein großer Halter verdeckt die Seite → Tilda zeigt ihre einfache Klammer → die Klammer wird im Vorleseraum genutzt.
2. Kuno will Knöpfe finden → Tilda sortiert nach Farben → Kuno benötigt Größen → sie entwickeln zwei herausnehmbare Einsätze statt einer Universalordnung → beide können den Kasten nutzen.
3. Ein Avatar möchte schnell etwas tragen → die einfache Tasche reißt beim Test mit leerer Ersatzlast → Tilda entscheidet sich für verstärkte Nähte statt ein neues Fahrzeug → die reparierte Tasche bleibt verfügbar.

**11–20: Nutzung verändert Ideen**
1. Mina will eine schöne Markierung → Tilda befürchtet Unlesbarkeit → Minas Farbflächen weisen im Halbdunkel besser als kleine Schrift → Tilda übernimmt den Entwurf → die Markierungen bleiben.
2. Ein funktionierender Rollwagen wird für Pflanzen statt Bücher benutzt → Erde fällt durch die Ablage → Tilda will ihn ersetzen → die Nutzerin wünscht einen Einsatz → ein herausnehmbarer Boden erweitert den Wagen.
3. Kuno möchte eine winzige Klammer → sie geht beim Aufräumen verloren → ein Avatar schlägt ein größeres Etui vor → Kuno entscheidet selbst über den Aufbewahrungsort → die kleine Lösung bleibt auffindbar.

**21–30: Reparieren statt ersetzen**
1. Herr Seidel braucht den Raum zeitweise für Veranstaltungsmaterial → Tilda braucht eine Werkbank → ein großer Entwurf blockiert den Zugang → sie verhandelt feste Zeiten und dokumentiert den Aufbau → die Werkbank bleibt zu vereinbarten Zeiten nutzbar.
2. Ein altes Regal wackelt → Tilda plant einen Neubau → Mina erkennt eine gute alte Steckverbindung → Tilda repariert diese mit Unterstützung → das Regal und seine Geschichte bleiben erhalten.
3. Ein Avatar will einen schnellen Sortierer → Tilda baut nach klarer Vorgabe → zwei Nutzende brauchen gegensätzliche Fächer → sie entscheiden sich für zwei austauschbare Einsätze → beide Zwecke funktionieren ohne falschen Universalanspruch.

**31–40: Ideen weitergeben**
1. Tilda will einen Entwurf erklären → eine neue Bastlerin versteht die Zeichnung anders → das nachgebaute Modell funktioniert für einen anderen Zweck → Tilda ergänzt die Anleitung und würdigt die neue Idee → zwei Versionen sind dokumentiert.
2. Kuno will ein kaputtes Spielzeug behalten → Tilda will neue Teile einsetzen → ein Ersatzteil verändert den Klang → Kuno wählt nach einem Probetest die Reparatur des Originals → sein Spielzeug behält seine Eigenart.
3. Mina und ein Avatar möchten eine gemeinsame Konstruktion → ihre Wünsche widersprechen sich bei der Bedienung → Tilda will beides durch eine komplizierte Steuerung lösen → nach getrennten Proben bauen sie zwei Bedienelemente → beide können das Gerät selbst nutzen.

**Humor:** Tilda führt stolz einen Hebel vor, der die falsche Klappe öffnet; Kunos besonders kleines Werkzeug ist schwer zu finden; Minas auffällige Markierung löst unerwartet das Orientierungsproblem. Funktionierende Erfindungen dürfen ebenfalls Freude und Witz erzeugen.`
];

const finalParts = parts.slice(1).map((part, index) => {
  const titleEnd = part.indexOf("\n");
  const title = index === 1 ? "Funkelflug und die Wege am Drachenberg" : part.slice(0, titleEnd);
  const metaEnd = part.indexOf("\n\n", titleEnd + 2);
  const meta = index === 1
    ? part.slice(titleEnd, metaEnd).replace("Was macht einen kleinen Drachen zu einem guten Gastgeber?", "Wie findet ein kleiner Drache seinen eigenen Weg durch einen Berg für große und kleine Wesen?")
    : part.slice(titleEnd, metaEnd);
  const profile = part.match(/### Die Figur und was davor geschah\n\n([\s\S]*?)\n\n### Regeln, Ensemble und Handlungsmotor/)?.[1];
  if (!profile) throw new Error(`Missing figure profile ${index + 1}`);
  const castSection = part.split("### Regeln, Ensemble und Handlungsmotor")[1]?.split("### Erste persönliche Folge")[0];
  const cast = index === 0 ? "" : (castSection?.split("\n").filter((line) => line.startsWith("- **")).join("\n") || "");
  return `## ${index + 1}. ${title}${meta}\n\n### Figurenprofil und Serienzustand\n\nDas Profil beschreibt die Figur nach ihrem Ursprung. Für die erste Folge gelten die unten ausdrücklich genannten früheren Voraussetzungen und die gestufte Entwicklung.\n\n${profile}${cast ? `\n\n### Wiederkehrende Figuren\n\n${cast}` : ""}\n\n${revisions[index]}\n`;
});
const intro = `# Fünf persönliche Talea-Figurenserien: überarbeitete Bibeln\n\nStand: 27. Oktober 2026. Überarbeitet nach [Sol-6.1-Lektorat](sol-6.1-lektorat.md); der [geprüfte Erstentwurf](serienbibeln-entwurf.md) bleibt unverändert. Die IDs beziehen sich auf den lokalen Figurenpool-Export, nicht auf einen überprüften Live-Import. Diese Bibeln sind redaktionelle Pilotkonzepte, keine Änderung veröffentlichter Originals oder Origins.\n\nDie erste persönliche Folge zeigt ein Schlüsselereignis aus der Vorgeschichte. Feststehender Figurenkern und persönliche Erlebnisse sind getrennt: Nur anwesende Avatare erinnern gemeinsame Ereignisse. Nach einem neuen Einstieg werden etablierte Zustände knapp erklärt, aber nicht erneut begründet. Jeder Fall ist eine Möglichkeit; Fortschritt, Hinweise und Konsequenzen gelten erst nach einer tatsächlich gespeicherten Folge. Die vier Bögen sind Stoffvorrat, keine feste lineare Pflicht und kein Beweis, dass 40 Folgen schon geschrieben oder getestet wären. Alter, Sprache, Intensität und Besetzungsgröße bestimmen die konkrete Ausführung.\n\n`;
const editorial = `## Nachvollzug des Sol-Lektorats und offene Erprobung\n\nDie Überarbeitung trennt fünf Serienmotoren, ersetzt Requisitengags durch zwölf ausgearbeitete Fälle je Welt, ordnet Suchgabe, Körperlichkeit, Ausgang und Heimatbelege der Nebelfee sowie den Kompass, die Crew, den sicheren Fahrtenrahmen und Blubberts Zeitsprung. Funkelflugs Drachenberg erhält einen Außenmotor und gestufte Offenheit. Griesgrams Beziehungen, Hausregeln und Besuche bei anderen sind ausgebaut. Tildas Bau- und Reparaturverläufe variieren; ihre drei Fragen entstehen schrittweise. Alle Ursprünge enthalten je einen eigenen Avatarwunsch, einen fehlgehenden Versuch, eine Wahl mit Preis und einen persönlichen Einfluss auf den bleibenden Zustand. Die Fälle benennen Ziel, Gegenkraft, Komplikation, Entscheidung und Ergebnis.\n\nOffen bleiben der Abgleich mit aktuellen Live-Profilen und veröffentlichten Origins, echte Modellfolgen mit einem und zwei Avataren, eine spätere Folge mit neuem Avatar sowie der Vergleich mit den vollständigen Originals und eine Rückmeldung echter Familien. Die vierzig Folgen sind ein Entwicklungsrahmen, keine Garantie für dauerhaft unterhaltsame Texte. Keine ungeprüfte persönliche Folge darf einen vorgesehenen künftigen Meilenstein als bereits passiert behaupten.\n`;
await writeFile("docs/figurenserien/serienbibeln.md", intro + finalParts.join("\n") + "\n" + editorial, "utf8");
