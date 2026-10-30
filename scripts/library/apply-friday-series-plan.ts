/** Keep the season generator's actual briefs aligned with the reviewed editorial plan. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
const root = resolve(import.meta.dir, "../..");
const directory = join(root, "backend/story/library/seed/series");
const editorial = readFileSync(join(root, "docs/talea-originals/2026-10-30/serienredaktion.md"), "utf8");
for (const [key, section] of [["bruno-der-flunkerfisch", "Bruno: Abenteuer"], ["die-monster-muellabfuhr", "Monster: Abenteuer"]]) {
  const path = join(directory, `${key}.season-1.json`);
  const season = JSON.parse(readFileSync(path, "utf8"));
  const table = editorial.split(`## ${section}`)[1].split("\n## ")[0];
  for (const line of table.split("\n").filter(line => /^\| \d+ /.test(line))) {
    const cells = line.split("|").map(s => s.trim()).filter(Boolean);
    const entry = season.episodes.find((e: any) => e.episode === Number(cells[0].match(/^\d+/)![0]));
    entry.plan["Erzählform und Folgenhandlung"] = cells[1];
    entry.plan["Bleibende Entwicklung und spätere Auszahlung"] = cells[2];
  }
  if (key.startsWith("bruno")) {
    season.episodes[2].plan.Flunkerei = "„Unsere Lehrerin ist ein Roboter. Ein echter. Mit Akku.“";
    season.episodes[3].plan["Druck und Mutmoment"] = "Mats will Ellas Aufräumplan ausweichen, behauptet seine Flugkunst und traut sich oben nicht, Angst zuzugeben. Die Wahrheit berichtigt zuerst die Flugbehauptung, dann benennt Mats seine Angst. Keine Wiederholung der Lia-Angeberhandlung aus Folge 3.";
    const e5 = season.episodes[4];
    e5.logline = "Oma Rosi behauptet vor Bruno: Ich bin zwanzig! Plötzlich ist sie wirklich zwanzig. Beim Rollentausch mit den Enkeln zeigt sich, was ihr an ihrem heutigen Leben wichtig ist.";
    e5.plan.Flunkerei = "„Ich bin zwanzig!“";
    e5.plan["Auflösung und Motivation"] = "Oma selbst muss das echte Alter zugeben; kein Kind kann sie erlösen. Sie genießt zunächst ihre neue Beweglichkeit, möchte aber als Oma ernst genommen werden. Keine Krankheits- oder Unfallszenen.";
    const e6 = season.episodes[5];
    e6.logline = "Frau Grimmbach behauptet vor Bruno bewusst falsch, sie habe Kaiser schon Maschinen bauen sehen. Prompt baut der Kater eine Fischfangmaschine. Ausgerechnet Grimmbach muss mit ihrem Heft helfen und die Wahrheit sagen.";
    e6.plan.Flunkerei = "„Kaiser kann Maschinen bauen. Das habe ich selbst gesehen.“";
    e6.plan["Wer flunkert"] = "Frau Grimmbach, bewusst und gegen besseres Wissen; bloße Katzenliebe löst nichts aus";
    const e7 = season.episodes[6];
    e7.logline = "Ella flunkert, Papa sei Astronaut und führe heute ein schwereloses Training in ihrer Küche vor. Papa und die Kaffeetassen schweben, während Ella versucht, die Suche nach dem Zylinder zu verbergen.";
    e7.plan.Flunkerei = "„Mein Papa ist Astronaut. Er zeigt uns heute ein schwereloses Training in unserer Küche!“";
    e7.plan["Ort der Flunkerei"] = "Im Wohnzimmer vor dem Aquarium, als Papa nach der Suche der Kinder fragt. Die Vorführung findet erst danach in der Küche statt.";
    const e8 = season.episodes[7];
    e8.plan.Flunkerei = "„Heute beginnt meine Geburtstagsfeier jede Stunde wieder ganz von vorn!“";
    e8.logline = "Mats behauptet, seine Geburtstagsfeier beginne heute jede Stunde ganz von vorn. Nach der vierten Torte will niemand mehr feiern. Er bemerkt die müden Gäste und entscheidet sich selbst für die Wahrheit.";
    const e9 = season.episodes[8];
    e9.title = "Bruno wird still";
    e9.logline = "Mats behauptet vor dem Aquarium aus Ärger, Bruno sei alles egal. Mats beendet den Zauber mit der Wahrheit, aber das verletzte Vertrauen bleibt. Bruno entscheidet sich selbst, von Brunello zu erzählen.";
    e9.plan = { ...e9.plan, Flunkerei: "„Unserem Bruno ist alles egal.“", "Wer flunkert": "Mats", "Was wörtlich passiert": "Bruno wird gleichgültig und still. Mats sagt vor Ella die Wahrheit, der Zauber endet früh. Erst im anschließenden echten Gespräch gesteht Bruno freiwillig seine Herkunft." };
    e9.plan["Ton"] = "Komisch blass statt krank: Bruno ignoriert Extra-Flocken und nennt seine Burg nur Stein. Kein Bild einer Erkrankung, keine Behauptung, Depression lasse sich durch ein Geständnis heilen.";
    season.episodes[9].plan["Magieregel und freie Wahl"] = "Der Assistent bringt keine neue Magie. Er kann nur erklären, welche ursprüngliche Flunkerei Bruno berichtigen könnte. Wahrheit über eine andere Sache löst diesen alten Zauber nicht. Brunos heutiger Bleibewunsch ist freiwillig; die Kinder drängen ihn nicht. Die finale Dialogführung muss gesondert lektoriert werden.";
  } else {
    season.episodes[4].plan["Flusis Erinnerung"] = "Das Wort König erinnert Flusi an einen nächtlichen Klang im staubigen Waschsalon, wo er früher als Staubfluse lebte. Der erinnerte Staub bringt ihn zum Niesen. Kein neuer magischer Wort-Alarm, kein Verrat.";
    season.episodes[7].logline = "Die Knäuelbande hat Gertrud mit einer falschen Pannenmeldung in einen Hof beim alten Waschsalon gelockt. Gertrud wollte helfen. Die Crew und frühere Pensionsgäste folgen einer Wollspur, um sie zurückzuholen.";
    season.episodes[7].clue = "Die Knäuelbande hat Gertrud mit einer falschen Pannenspur im Auftrag Seiner Majestät weggelockt. Die Spur führt zum alten Waschsalon.";
    const e9 = season.episodes[8];
    e9.logline = "Oma hat sich den Fuß verknackst. Jona leitet erstmals den Einsatz, Mama Sina fährt Gertrud und Oma begleitet per Funk. Beim Schattenschreck aus vergessenen Schattenspielfiguren findet Jona den Waschsalonschlüssel.";
    e9.plan.Monster = "Schattenschreck";
    e9.plan.Ursprung = "Vergessene Schattenspielfiguren";
    e9.plan["Schwäche → Fangtrick"] = "Warmes Licht macht die vergessenen Figuren wieder erkennbar → Jona setzt mit Gertruds Scheinwerfern eine kleine Schattenspielbühne in Szene";
    e9.plan["Erwachsene Begleitung"] = "Mama Sina fährt und bleibt beim Einsatz; Jona führt die Ermittlungen und die Absprachen, Oma hilft per Funk. Kein Kind fährt ein Kraftfahrzeug oder wird allein losgeschickt.";
    e9.clue = "Unter den Schattenspielfiguren liegt der Schlüssel zum alten Waschsalon. Jona erkennt das Zeichen, das Mama in Folge 7 beschrieben hat.";
    e9.plan["Schlüssel vorbereitet"] = "Die Schattenspielfiguren stammen aus dem früheren Waschsalon-Schaufenster und wurden mit dem alten Schlüssel in einer Kiste aufbewahrt. Mama hat in Folge 7 das Zeichen am Schlüsselanhänger beschrieben. Kein zufälliger neuer Gegenstand löst das Finale.";
    season.episodes[9].plan["Vorbereitung und Auflösung"] = "Seit Folge 4 sammelt der Schnüffler noch ungepaarte Socken in einer eigenen Kiste. Die Kronensocke ist ein abgefallener Teil der Krone. Der passende Partner beruhigt den einsamen König. Er behält seine Sockengestalt und wird eingeladen; ganz heißt nicht aufgelöst.";
  }
  writeFileSync(path, JSON.stringify(season, null, 2) + "\n");
}
for (const key of ["bruno-der-flunkerfisch", "die-monster-muellabfuhr"]) {
  const path = join(directory, `${key}.bible.json`);
  const seed = JSON.parse(readFileSync(path, "utf8"));
  const season = JSON.parse(readFileSync(join(directory, `${key}.season-1.json`), "utf8"));
  const bible = seed.bible;
  seed.series.activeBibleVersion = 2;
  bible.version = 2;
  bible.seasonArcs[0].clues = season.episodes.map((e: any) => ({ episode: e.episode, clue: e.clue }));
  const principle = "Die Folgenformel ist ein flexibler Vorrat, keine zwingende Szenenreihenfolge. Jede Folge löst ein eigenes Problem und verändert eine Beziehung oder eine Erkenntnis dauerhaft; frühere Hinweise verursachen spätere Handlungen. Bereits Gelerntes bleibt erhalten.";
  if (!bible.world.rules.includes(principle)) bible.world.rules.push(principle);
  if (key.startsWith("bruno")) {
    const rule = "Bruno kann den Zauber weder auslösen noch stoppen. Er ist nur der Fisch, bei dem es passiert.";
    if (!bible.world.rules.includes(rule)) throw new Error("Brunos unveränderliche Magieregel fehlt.");
    const recurrence = "Lia, neue Klassenfreundin von Mats aus Folge 3, kommt als Gast in 4 und 8 wieder. Sie baut gern kleine Bühnen und macht bei Unsicherheit Geräusche mit der Zunge. Sie hört Bruno nicht sprechen; eine Erweiterung seines Vertrautenkreises erfordert eine eigene Kanonentscheidung.";
    if (!bible.world.rules.includes(recurrence)) bible.world.rules.push(recurrence);
    bible.world.rules = bible.world.rules.map((s: string) => s === "Der Zauber endet nur, wenn der Flunkerer laut vor mindestens einer anderen Person die Wahrheit sagt." ? "Der jeweilige Zauber endet nur, wenn der Flunkerer laut vor mindestens einer anderen Person die Wahrheit über seine konkrete Flunkerei sagt. Eine wahre Aussage über etwas anderes löst ihn nicht auf." : s);
    bible.world.rules = bible.world.rules.map((s: string) => s === "Wenn der Zauber endet, vergessen Erwachsene alles Magische. Kinder erinnern sich. Was jemand während des Zaubers aufgeschrieben hat, bleibt auf dem Papier stehen." ? "Wenn ein Zauber endet, vergessen die Erwachsenen, die ihn miterlebt haben, dessen magische Vorgänge. Kinder erinnern sich. Andere, weiterhin bestehende Zauber werden nicht vergessen. Was jemand selbst während des Zaubers aufgeschrieben hat, bleibt auf dem Papier stehen." : s);
    bible.seasonArcs[0].resolution = "Bruno war der Bühnenzauberer Der Große Brunello. Das runde Glas und die Steinburg gehörten zu seiner Requisite. Privat, außerhalb eines Spiels oder einer Bühnenrolle, behauptete er vor dem Glas und seinem Assistenten wider besseres Wissen: Ich bin bereits ein Goldfisch in diesem Glas. Er wollte einen unmöglichen Trick als bereits gelungen ausgeben; sein Stolz verhinderte den Widerruf. Der Zauber machte die Behauptung wörtlich wahr. Sein alter Assistent, der Mann mit dem Fischhut, erinnert sich, weil dieser alte Zauber nie beendet wurde. Er gab Bruno an die Brandts in der Hoffnung, dass Bruno dort ohne Angeberei angenommen würde. Im Finale bietet er keine neue Magie, sondern erklärt die Möglichkeit, die konkrete alte Behauptung zu berichtigen. Die Kinder lassen Bruno frei wählen. Bruno möchte bleiben und sagt seine heutige größte Wahrheit: Ich will bei euch bleiben. Sie betrifft nicht die alte Flunkerei und beendet sie nicht. Bruno bleibt aus eigenem Wunsch Fisch. Die exakte Dialogführung und die Frage, wie er sein früheres Versagen ehrlich anerkennt und zugleich seine heutige Gestalt frei behalten kann, brauchen beim Schreiben des Finales ein eigenes Lektorat; keine Wortklauberei als fertige emotionale Auflösung ausgeben.";
  } else {
    const material = "Neue Monster werden fürsorglich und passend zu ihrem Material gereinigt: Wasser nur, wenn es ihnen bekommt. Brotkrümel werden sanft trocken gebürstet. Ein freiwillig beachtetes Stopp ist Rücksicht, keine zweite magische Schwäche.";
    if (!bible.world.rules.includes(material)) bible.world.rules.push(material);
    const adult = "Auf Nachteinsätzen bleibt eine erwachsene Person bei Jona. Oma ist die Stammfahrerin; Mama Sina darf als ehemalige Azubine vertreten, während Jona die Einsatzleitung übernimmt. Gertrud bleibt der einzige Wagen.";
    if (!bible.world.rules.includes(adult)) bible.world.rules.push(adult);
    bible.canonInvariants = bible.canonInvariants.map((s: string) => s === "Oma Hilde ist die Fahrerin, Gertrud der einzige Wagen." ? "Oma Hilde ist die Stammfahrerin, Gertrud der einzige Wagen. Als erwachsene ehemalige Azubine darf Mama Sina vertreten; Jona fährt nie selbst." : s);
    bible.seasonArcs[0].mystery = "Wer ruft nachts die vergessenen Dinge wach, und wer schaut heimlich durch die Klappe der Monster-Pension? Kein Pensionsgast fehlt; trotzdem häufen sich neue Notrufe.";
    bible.seasonArcs[0].resolution = "Der einsame Sockenkönig entstand im alten Waschsalon aus verlorenen Einzelsocken. Die Kronensocke aus Folge 1 ist eine abgefallene Zacke seiner gestrickten Krone. Nachts summt er einen Ruf, der lange vergessene Dinge früher erwachen lässt; daher kommen die zusätzlichen Notrufe aus anderen Haushalten. Er öffnet die Pensionsklappe von außen, um zu schauen, ob jemand seinem Ruf gefolgt ist. Er befreit keine Pensionsgäste; die nassen Abdrücke stammen von seinem Weg vom Waschsalon. Seine einzige ursprungsbezogene Schwäche ist die Sehnsucht jeder Einzelsocke nach ihrem Partner. Jona findet den Partner der Kronensocke in der seit Folge 4 wachsenden Kiste des Schnüfflers. Der König wird ruhig und weich. Die Krake deckt den Tisch, das Gähnmonster bringt Decken, die Crew lädt ihn ein. Ganz bedeutet, dass er mit den Partnersocken zusammengehört; er löst sich nicht auf und bleibt eine Sockengestalt. Er wird Nachtportier. Sein Ruf begrüßt künftig die von Oma gebrachten neuen Gäste; vergessene Dinge werden nicht mehr ungewollt vorzeitig geweckt. Die Klappe ist nun ein betreuter Eingang.";
    bible.characters = bible.characters.map((c: any) => c.id === "sockenkoenig" ? { ...c, personality: "Ein riesiges Monster aus verlorenen Einzelsocken der Stadt. Einsam, nicht böse. Sein nächtlicher Ruf weckt vergessene Dinge früher; er schaut von außen durch die Pensionsklappe, ob ihm jemand gefolgt ist, und befreit keine Pensionsgäste." } : c);
  }
  writeFileSync(path, JSON.stringify(seed, null, 2) + "\n");
}
console.log("Staffelbriefe 3–10 und Serienregeln mit der redaktionellen Weiterentwicklung abgeglichen.");
