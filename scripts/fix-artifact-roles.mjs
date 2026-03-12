import fs from "fs";

const path = "c:/MyProjects/Talea/talea-storytelling-platform/Logs/logs/talea-artifacts-2026-03-12T13-05-26-431Z.json";
const d = JSON.parse(fs.readFileSync(path, "utf8"));

// Transform storyRole from RPG-style to children's-book-style:
// - No combat/violence language
// - Focus on what the artifact SHOWS or HINTS, not what it SOLVES
// - Evocative, story-friendly descriptions that guide the LLM
const roleMap = {
  "Finden von Abenteuern": "Zeigt versteckte Wege und vergessene Pfade — aber nur dem, der genau hinsieht.",
  "Finden neuer Wege": "Dreht sich und zittert, wenn ein verborgener Weg in der Naehe ist.",
  "Schutz vor Alpträumen": "Leuchtet sanft im Dunkeln und summt leise, wenn etwas Bedrohliches naeher kommt.",
  "Herstellung von magischen Tränken": "Blubbert und dampft, wenn die richtige Zutat in der Naehe ist.",
  "Überwindung von Angst": "Wird warm in der Hand, wenn jemand Mut braucht — aber es nimmt die Angst nicht weg, es erinnert nur daran, dass man schon einmal mutig war.",
  "Zerstörung von Hindernissen": "Vibriert, wenn eine Wand oder Mauer ein Geheimnis verbirgt.",
  "Kraftvolle Angriffe": "Knistert und funkelt — aber nur, wenn es jemand mit guten Absichten beruehrt.",
  "Enthüllung großer Geheimnisse": "Die Seiten rascheln von allein, wenn eine wichtige Antwort darin steht.",
  "Zerstörung von Barrieren": "Brummt und vibriert in der Naehe von verborgenen Tueren oder Durchgaengen.",
  "Sicht über große Entfernungen": "Zeigt Bilder von weit entfernten Orten — aber nur fuer einen kurzen Augenblick.",
  "Kampf gegen böse Kräfte": "Funkelt, wenn etwas nicht so ist, wie es scheint. Warnt ohne Worte.",
  "Befestigung oder Klettern": "Haelt fester, je mehr man ihr vertraut — aber sie kann nicht alles tragen.",
  "Macht über Kälte": "Bildet wunderschoene Eisblumen, die wie eine Landkarte aussehen.",
  "Kampf gegen Feuer": "Wird eiskalt, wenn Gefahr droht — wie ein Warnsignal das man fuehlen kann.",
  "Finden versteckter Details": "Vergroessert nicht nur Dinge, sondern zeigt auch was sich dahinter verbirgt.",
  "Stabilität und Schutz": "Wird schwer und warm, wenn der Traeger in Sicherheit ist — leicht und kuehl, wenn Gefahr naeher kommt.",
  "Zeitlose Existenz": "Wer ihn beruehrt, sieht fuer einen Moment, wie die Welt frueher aussah.",
  "Schutz und Geborgenheit": "Wird warm, wenn die Familie an einen denkt — wie eine unsichtbare Umarmung.",
  "Kontrolle über Flammen": "Gluehen sanft, wenn ein Geheimnis in der Naehe verborgen liegt.",
  "Erzeugen von Wärme oder Licht": "Funkelt im Dunkeln und zeigt den Weg — aber nur ein kleines Stueck.",
  "Befreiung von Flüchen": "Summt und vibriert in der Naehe von Verwunschenem — zeigt wo der Bann sitzt, nicht wie man ihn bricht.",
  "Rückgewinnung von Glück": "Leuchtet heller, je gluecklicher die Menschen in der Naehe sind. Wird traurig-dunkel, wenn jemand Kummer hat.",
  "Erinnerung an Freunde": "Wird warm, wenn ein Freund an dich denkt — egal wie weit weg.",
  "Verbindung mit Freunden": "Zwei Stuecke vom selben Kristall: wenn einer leuchtet, leuchtet der andere auch.",
  "Wiederherstellung von Erinnerungen": "Zeigt vergessene Momente als kurze, leuchtende Bilder in der Luft.",
  "Verstehen versteckter Wahrheiten": "Fluestert Gedanken die man sonst nicht hoeren koennte — aber man muss genau zuhoeren.",
  "Schutz von Geheimnissen": "Verschliesst sich fester, je wichtiger das Geheimnis darin ist.",
  "Kommunikation mit Übernatürlichem": "Beschlaegt sich wie ein Spiegel und zeigt dann Gesichter von denen, die man vermisst.",
  "Kampf gegen Ungerechtigkeit": "Leuchtet rot, wenn jemand in der Naehe ungerecht behandelt wird.",
  "Bringung von Glück": "Wer sie findet, dem passiert heute etwas Unerwartetes — aber ob das Glueck ist, entscheidet man selbst.",
  "Verkauf für Hilfe": "Glaenzt so schoen, dass jeder sie haben will — aber wer sie hergibt, bekommt etwas Wertvolleres zurueck.",
  "Beruhigung von Konflikten": "Spielt von allein eine Melodie, wenn zwei sich streiten — so schoen, dass man vergisst, worueber man wuetend war.",
  "Genesung von Verletzungen": "Duftet nach Sommer und Wiese. Wer es riecht, fuehlt sich sofort ein bisschen besser.",
  "Heilung schwerer Verletzungen": "Leuchtet in der Farbe dessen, was am meisten fehlt: Mut ist golden, Hoffnung ist gruen.",
  "Rettung aus kritischer Lage": "Wird heiss, wenn echte Gefahr droht — ein Warnsignal das durch die Haut spricht.",
  "Überwindung der Hoffnungslosigkeit": "Funkelt selbst im tiefsten Dunkel — wie ein Stern der sich weigert auszugehen.",
  "Verbindung zu besserer Zukunft": "Zeigt fuer einen Augenblick, wie die Welt aussehen KOENNTE — wenn man mutig genug ist.",
  "Verteidigung gegen Angriffe": "Wird groesser, je aengstlicher der Traeger ist — als wollte es sagen: Ich beschuetze dich.",
  "Navigation in verwirrender Situation": "Zeigt immer in die Richtung der Wahrheit — auch wenn der Weg dahin nicht der kuerzeste ist.",
  "Navigation in der Natur": "Dreht sich langsam und zeigt zum naechsten sicheren Ort.",
  "Kraft für schwierige Aufgaben": "Schmeckt nach dem Lieblingsessen — und danach fuehlen sich die Beine staerker an.",
  "Beschwörung von Helfern": "Wenn man hineinblaest, antworten Stimmen aus der Ferne.",
  "Beschwörung von Zaubersprüchen": "Spielt eine Melodie, die Dinge zum Schweben bringt — aber nur kleine Dinge.",
  "Vision der Zukunft": "Zeigt schemenhafte Bilder von dem, was VIELLEICHT passiert — nie sicher, immer raetselhaft.",
  "Erkennung von Geheimnissen": "Vergroessert nicht nur Dinge — durch sie sieht man auch Fussspuren die laengst verschwunden sind.",
  "Kampf gegen eine dunkle Kreatur": "Gluehen im Dunkeln und summt leise — je lauter das Summen, desto naeher die Gefahr.",
  "Licht in Dunkelheit": "Leuchtet so hell wie der Mut dessen, der sie traegt.",
  "Kampf gegen Dunkelheit": "Strahlt heller, je dunkler die Umgebung wird — als haette es Angst vor dem Nichts.",
  "Heilung von Herzwunden": "Leuchtet rosa, wenn jemand in der Naehe traurig ist — wie ein stilles Zeichen: Du bist nicht allein.",
  "Verbindung zu wichtigen Personen": "Wird warm, wenn jemand Wichtiges an dich denkt.",
  "Flucht oder schnelle Flucht": "Machen den Traeger leicht wie eine Feder — aber nur fuer eine kurze Strecke.",
  "Schutz vor Betrug": "Vibriert sanft, wenn jemand die Unwahrheit sagt.",
  "Finden von magischen Orten": "Die Nadel dreht sich wild, wenn Magie in der Luft liegt.",
  "Merken von Zaubersprüchen": "Schreibt mit, was man sagt — aber nur die wirklich wichtigen Saetze.",
  "Enthüllung von versteckten Wahrheiten": "Neue Eintraege erscheinen ueber Nacht — als haette jemand heimlich geschrieben.",
  "Inspiration und Wissen": "Oeffnet sich immer auf der Seite, die man gerade braucht — als wuesste es mehr als man selbst.",
  "Verständnis für andere": "Wer es beruehrt, spuert fuer einen Moment, was der andere fuehlt.",
  "Magische Effekte in der Nacht": "Gluehen im Mondlicht und machen leise Geraeusche — wie ein Geheimnis das erzaehlt werden will.",
  "Sicht in Dunkelheit": "Laesst den Traeger im Dunkeln sehen — aber alles sieht ein bisschen anders aus als bei Licht.",
  "Kommunikation mit Natur": "Wird warm und summt, wenn man ihn in der Naehe von alten Baeumen haelt.",
  "Kampf gegen immaterielle Gegner": "Durchschneidet Nebel und Schatten — und zeigt was sich dahinter verbirgt.",
  "Vorahnung von Ereignissen": "Zeigt Wege die noch niemand gegangen ist — aber sie verschwinden, sobald man sie zu lange ansieht.",
  "Wiederbelebung oder Heilung": "Gluehen warm und die Luft riecht nach Fruehling — wenn jemand in der Naehe Trost braucht.",
  "Energiequelle für Maschinen": "Summt und vibriert — je naeher man einer Loesung kommt, desto lauter.",
  "Schutz in gefährlichen Situationen": "Haelt Regen, Wind und Kaelte ab — und fluestert leise ermutigende Worte.",
  "Transport von wichtigen Dingen": "Passt immer genau das hinein, was man gerade am dringendsten braucht.",
  "Entzifferung von alten Texten": "Gluehen neben alten Schriften — und ploetzlich kann man sie lesen.",
  "Verstecken in der Dunkelheit": "Wer es traegt, wird fast unsichtbar — aber nur, solange er ganz still steht.",
  "Schleichende Mission": "Leuchtet nicht, klingt nicht, riecht nicht — das perfekte Werkzeug fuer Leisetreter.",
  "Verkleidung für Missionen": "Veraendert das Gesicht des Traegers — aber die Augen bleiben immer gleich.",
  "Finden eines Schatzes": "Zeigt mit einem goldenen Pfeil in die Richtung dessen, was am wertvollsten ist — aber das muss kein Gold sein.",
  "Kontrolle über das Schicksal": "Zieht sich zusammen und loest sich, als wuerde jemand daran spinnen — jede Entscheidung veraendert sein Muster.",
  "Kommunikation mit Geistern": "Schreibt von allein Worte auf, die niemand diktiert hat.",
  "Erkennung von innerem Selbst": "Zeigt nicht das Gesicht, sondern das, was dahinter liegt — Angst, Mut, Neugier, alles gleichzeitig.",
  "Wärme und Trost in schwierigen Zeiten": "Wird warm wie eine Umarmung — besonders wenn man sich allein fuehlt.",
  "Erkennung von Illusionen": "Zeigt die Welt so, wie sie wirklich ist — manchmal schoener, manchmal erschreckender.",
  "Hilfreiche Ratschläge": "Gibt kurze, kryptische Antworten — die erst spaeter Sinn ergeben.",
  "Überwindung von Hindernissen": "Huepft von allein und zieht den Traeger ueber Hindernisse — aber nur, wenn man lacht.",
  "Navigation und Orientierung": "Zeigt im Dunkeln die Sterne — selbst wenn der Himmel bewoelkt ist.",
  "Erschaffung von Licht": "Flammt auf wenn man sie braucht und wird ruhiger, wenn die Gefahr vorbei ist.",
  "Schnelle Flucht oder Bewegung": "Bringt den Traeger an einen sicheren Ort — aber man kann nicht bestimmen welchen.",
  "Test Role": "Testobjekt.",
  "Heilung emotionaler Schmerzen": "Wird leicht und warm, wenn jemand in der Naehe weint — und die Traenen trocknen schneller.",
  "Schutz guter Träume": "Faengt schlechte Traeume ein und verwandelt sie in schoene — aber er kann nur einen pro Nacht.",
  "Zugang zu verschlossenen Orten": "Passt in jedes Schloss — aber oeffnet nur Tueren hinter denen etwas Wichtiges wartet.",
  "Verstecken vor Feinden": "Macht den Traeger unsichtbar — aber nur, solange er an jemanden denkt, den er liebt.",
  "Finden von verlorenen Dingen": "Zittert und summt, wenn etwas Verlorenes in der Naehe ist.",
  "Verstehen von versteckten Wahrheiten": "Hoert Dinge, die andere nicht hoeren — leise Wahrheiten hinter lauten Worten.",
  "Erkennung von Betrug": "Wird bitter, wenn jemand die Unwahrheit sagt.",
  "Enthüllung von Lügen": "Gluehen hell, wenn eine Luege in der Naehe gesprochen wird.",
  "Kontrolle über Wasser": "Veraendert die Farbe je nach Stimmung des Wassers — ruhig ist blau, aufgeregt ist gruen.",
  "Zugang zu großem Wissen": "Fluestert altes Wissen — aber nur eine Frage pro Tag.",
  "Kontrolle über Wetter": "Summt bei Wetteraenderung und zeigt Wolkenbilder die Geschichten erzaehlen.",
  "Zugang zu vergessener Information": "Gluehen warm wenn man ihn ueber alte Schriften haelt — und die Worte werden lesbar.",
  "Fokus für Zauberkraft": "Verstaerkt die Wuensche dessen, der darin steht — aber nur ehrliche Wuensche.",
  "Ausführung von Zaubersprüchen": "Zittert und funkelt in der Hand — als wollte er etwas sagen, das man noch nicht versteht.",
  "Entkommen aus einer Falle": "Zeigt eine Sekunde der Zukunft — gerade genug um eine Entscheidung zu aendern.",
  "Beruhigung wilder Kräfte": "Wird schwer und ruhig in der Hand — und die Wut in der Naehe verebbt wie eine Welle.",
  "Rückkehr nach Hause": "Wird warm und leuchtet in Richtung Zuhause — egal wie weit weg man ist.",
};

let changed = 0;
const notFound = [];
for (const art of d) {
  const newRole = roleMap[art.storyRole];
  if (newRole) {
    art.storyRole = newRole;
    changed++;
  } else {
    notFound.push(art.storyRole);
  }
}

fs.writeFileSync(path, JSON.stringify(d, null, 2), "utf8");
console.log(`Changed: ${changed} / ${d.length}`);
if (notFound.length) console.log("Not found:", [...new Set(notFound)]);
