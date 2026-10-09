export type ChapterId =
  | 'welcome' | 'home' | 'avatar' | 'story' | 'library' | 'reading'
  | 'doku' | 'audio' | 'cosmos' | 'journey' | 'games' | 'treasure'
  | 'tavi' | 'offline' | 'parents' | 'start';

export interface TourDiscovery {
  label: string;
  symbol: string;
  explanation: string;
  chapter?: ChapterId;
}

export interface ChapterMeta {
  id: ChapterId;
  label: string;
  title: string;
  lede: string;
  imageAlt: string;
  accent: string;
  discoveries: TourDiscovery[];
  details: string;
  location?: string;
  destination?: string;
  narration: string;
}

/** A picture, one short invitation and three discoveries per page. */
export const CHAPTERS: ChapterMeta[] = [
  {
    id: 'welcome', label: 'Willkommen', title: 'Komm mit nach Talea!', accent: '#81ab9e',
    lede: 'Ich bin Tavi. Wir erfinden Geschichten, entdecken Wissen und spielen zusammen. Wohin möchtest du zuerst?',
    imageAlt: 'Tavi begrüßt ein Kind und einen Fuchs vor einem Geschichtenhaus, einem Teleskop und einer Spielewiese.',
    discoveries: [
      { label: 'Geschichten', symbol: '📖', explanation: 'Hier wird deine Idee zum Abenteuer.', chapter: 'story' },
      { label: 'Wissen', symbol: '🔭', explanation: 'Hier finden wir Antworten auf deine Fragen.', chapter: 'doku' },
      { label: 'Spielen', symbol: '🎲', explanation: 'Hier wird geknobelt und gemeinsam gelacht.', chapter: 'games' },
    ],
    details: 'Über „Alle Orte“ kannst du jede Seite direkt auswählen. Den Rundgang findest du später wieder im Profilmenü unter „Rundgang starten“. Mit „Tavi erzählt“ werden die Seiten vorgelesen.',
    narration: 'Hallo! Ich bin Tavi. Schön, dass du da bist! In Talea kannst du Geschichten erfinden, Wissen entdecken und spielen. Tippe auf Weiter, oder such dir in Alle Orte ein Ziel aus. Wenn du möchtest, lese ich dir jede Seite vor.',
  },
  {
    id: 'home', label: 'Dein Zuhause', title: 'Alles beginnt hier.', accent: '#d5a36c',
    lede: 'Auf der Startseite warten deine letzten Geschichten, deine Helden und neues Wissen auf dich.',
    imageAlt: 'Ein Kind öffnet in einem gemütlichen Baumhaus ein Buch. Daneben warten ein Fuchs, Wissensbücher und kleine Planeten.',
    discoveries: [
      { label: 'Startseite', symbol: '🏡', explanation: 'Hier findest du deine letzten Abenteuer wieder.' },
      { label: 'Menü', symbol: '🧭', explanation: 'Die Bilder im Menü führen zu Geschichten, Avataren, Dokus und Spiel.' },
      { label: 'Neuigkeiten', symbol: '🔔', explanation: 'Die Glocke zeigt neue Inhalte, Nachrichten und geteilte Abenteuer.' },
    ],
    details: 'Am Computer steht das Menü links, auf dem Handy unten. Über das Profilmenü wechselst du dein Kinderprofil und erreichst Wiedergabeliste, Einstellungen und Rundgang. Die Glocke öffnet Mitteilungen über neue Audio-Dokus, Figuren, Neuigkeiten und geteilte Inhalte. Dort kannst du suchen, Themen auswählen, Nachrichten als gelesen markieren und archivieren.',
    location: 'Startseite · Menü · Profilbild · Mitteilungs-Glocke', destination: '/',
    narration: 'Das ist dein Zuhause in Talea. Auf der Startseite findest du deine letzten Geschichten, deine Helden und deine Dokus wieder. Die Bilder im Menü zeigen dir den Weg. Die Glocke meldet neue Inhalte und Nachrichten. Über das Profilbild wählst du dein eigenes Kinderprofil.',
  },
  {
    id: 'avatar', label: 'Avatare', title: 'Wer ist dein Held?', accent: '#8aaea0',
    lede: 'Ein Fuchs, ein Drache oder du selbst? Gestalte deinen Helden. Mit jedem Abenteuer lernt er dazu.',
    imageAlt: 'Ein Kind gestaltet einen Fuchs und einen kleinen freundlichen Drachen im Heldenatelier. Tavi hält Pinsel und Farbpalette bereit.',
    discoveries: [
      { label: 'Gestalten', symbol: '🎨', explanation: 'Wähle Name, Aussehen und die Art deines Helden.' },
      { label: 'Wachsen', symbol: '🌱', explanation: 'Wer im Abenteuer anderen hilft, übt zum Beispiel Teamgeist.' },
      { label: 'Erinnern', symbol: '📔', explanation: 'Im Tagebuch findest du Erlebnisse deines Helden wieder.' },
    ],
    details: 'Du kannst Avatare neu erstellen, ansehen und bearbeiten. Die neun Grundeigenschaften starten bei null und wachsen durch tatsächliche Erlebnisse. Wissen kann neue Spezialgebiete bekommen. Tagebuch und Schatzkammer liegen im Avatarprofil.',
    location: 'Avatare → Held auswählen', destination: '/avatar',
    narration: 'Wer soll dein Held sein? Ein Fuchs, ein Drache oder du selbst? In Avatare gestaltest du sein Aussehen und gibst ihm einen Namen. In Geschichten kann er mutiger, neugieriger und hilfsbereiter werden. Sein Tagebuch erinnert an eure Erlebnisse.',
  },
  {
    id: 'story', label: 'Geschichten erfinden', title: 'Deine Idee wird ein Abenteuer.', accent: '#c99bba',
    lede: 'Such deine Helden aus. Wähle eine Welt und erzähl uns deinen Wunsch. Talea macht eine Geschichte daraus.',
    imageAlt: 'Aus dem aufgeschlagenen Buch eines Kindes wachsen ein Märchenschloss, eine Waldexpedition und eine kleine Rakete. Sein Fuchs reist mit.',
    discoveries: [
      { label: 'Helden', symbol: '🦊', explanation: 'Deine Avatare können zusammen die Hauptrolle spielen.' },
      { label: 'Welt & Gefühl', symbol: '🏰', explanation: 'Lustig, spannend oder gemütlich? Du bestimmst die Richtung.' },
      { label: 'Dein Wunsch', symbol: '✨', explanation: 'Deine eigene Idee und ein Lernziel können mit ins Abenteuer.' },
    ],
    details: 'Der Geschichten-Wizard bietet Helden, Genre und Welt, Alter und Länge, Stimmung, eigene Wünsche, Lernmodus und eine Zusammenfassung. Du kannst auch ein Märchen als Vorlage nehmen oder einen Schatz mitnehmen. Neue Geschichten verbrauchen Story-Münzen aus eurem Plan.',
    location: 'Geschichten → Neue Geschichte', destination: '/story',
    narration: 'Jetzt bist du dran! Wähle deine Helden und eine Welt für eure Geschichte. Soll sie lustig, spannend oder gemütlich sein? Du kannst einen eigenen Wunsch erzählen, etwas Neues lernen oder ein Märchen als Vorlage nehmen. Talea schreibt daraus euer Abenteuer.',
  },
  {
    id: 'library', label: 'Deine Bibliothek', title: 'Deine Abenteuer bleiben hier.', accent: '#c4a076',
    lede: 'In Geschichten stehen deine Bücher bereit. Such ein Abenteuer aus und entdecke auch die Welt der Figuren.',
    imageAlt: 'Ein Kind und sein Fuchs ziehen ein bebildertes Abenteuerbuch aus einem bunten Bücherregal. Tavi zeigt mit einer Lupe auf Buchrücken und Figuren.',
    discoveries: [
      { label: 'Wiederfinden', symbol: '📚', explanation: 'Deine fertigen Geschichten warten hier auf dich.' },
      { label: 'Suchen', symbol: '🔎', explanation: 'Finde ein Buch über seinen Titel, seine Welt oder seine Helden.' },
      { label: 'Figuren', symbol: '🐉', explanation: 'Lerne Figuren und ihre eigenen Geschichten kennen.' },
    ],
    details: 'Die Bibliothek hat Suche, Filter für Genre, Alter, Länge und Avatare, Sortierung sowie Listen- und Kachelansicht. Der Reiter „Charaktere“ zeigt Figurengeschichten. Im Buchmenü findest du je nach Plan die Offline-Speicherung.',
    location: 'Geschichten → Geschichten oder Charaktere', destination: '/stories',
    narration: 'Deine Abenteuer verschwinden nicht! In Geschichten findest du deine Bücher wieder. Such nach einem Titel oder wähle eine Welt und einen Helden als Filter. Im Reiter Charaktere kannst du auch die Geschichten anderer Figuren kennenlernen.',
  },
  {
    id: 'reading', label: 'Lesen & Hören', title: 'So magst du deine Geschichte.', accent: '#cc998e',
    lede: 'Schau dir die Bilder an, lies selbst oder lass dir vorlesen. Du kannst die Ansicht wechseln.',
    imageAlt: 'Dasselbe Kind erlebt sein Fuchsabenteuer in drei Szenen: mit großen Kinobildern, mit einem offenen Buch und mit Kopfhörern.',
    discoveries: [
      { label: 'Kino', symbol: '🎬', explanation: 'Große Bilder begleiten dich Szene für Szene.' },
      { label: 'Buch & Scroll', symbol: '📖', explanation: 'Lies Kapitel für Kapitel oder scrolle durch die Geschichte.' },
      { label: 'Vorlesen', symbol: '🔊', explanation: 'Mit dem Audio-Player kannst du zuhören und pausieren.' },
    ],
    details: 'Geschichten haben Kino-, klassische und Scroll-Ansicht. Vorlese-Audio wird über die Audio-Aktionen gestartet oder erstellt, wenn es verfügbar ist. Ein gespeichertes Abenteuer kannst du später erneut lesen.',
    location: 'Geschichten → Buch öffnen', destination: '/stories',
    narration: 'Wie möchtest du dein Abenteuer erleben? Im Kino-Modus siehst du große Bilder. In der Buchansicht liest du Kapitel für Kapitel. Du kannst auch durch die Geschichte scrollen. Mit dem Audio-Player lässt du dir vorlesen, wenn Audio für dein Abenteuer bereitsteht.',
  },
  {
    id: 'doku', label: 'Wissens-Dokus', title: 'Warum leuchten die Sterne?', accent: '#8caabf',
    lede: 'Dinos, Sterne oder Erfindungen: Wähle dein Lieblingsthema. Eine Doku erklärt es mit Bildern und kleinen Fragen.',
    imageAlt: 'Ein Kind untersucht neben Tavi einen Dinosaurierknochen, eine leuchtende Sternenkarte und eine kleine Maschine auf einem Entdeckertisch.',
    discoveries: [
      { label: 'Dein Thema', symbol: '🦕', explanation: 'Du kannst eine Doku zu deiner eigenen Frage erstellen.' },
      { label: 'Entdecken', symbol: '🔭', explanation: 'Stöbere auch in Dokus, die schon bereitstehen.' },
      { label: 'Mitdenken', symbol: '💡', explanation: 'Bilder, kleine Fragen und Mitmach-Ideen helfen beim Verstehen.' },
    ],
    details: 'Unter Dokus gibt es „Meine“, „Entdecken“ und „Hörwelt“. Neue Dokus bieten Themenwahl, Alter und Wissenstiefe; vorhandene Dokus lassen sich durchsuchen und filtern. Neue Dokus brauchen Doku-Münzen. Fragen und Quiz helfen beim Wiederholen.',
    location: 'Dokus → Meine oder Entdecken', destination: '/doku',
    narration: 'Warum leuchten die Sterne? Wie lebten die Dinosaurier? In Dokus finden wir Antworten auf deine Fragen. Wähle ein Thema oder entdecke eine Doku, die schon da ist. Bilder, kleine Fragen und Mitmach-Ideen helfen dir beim Verstehen.',
  },
  {
    id: 'audio', label: 'Audio-Dokus', title: 'Kopfhörer auf. Welt entdecken!', accent: '#d59b85',
    lede: 'In der Hörwelt erzählen Stimmen von spannenden Themen. Tippe auf Play und hör einfach zu.',
    imageAlt: 'Ein Kind und sein Fuchs hören mit Kopfhörern zu. Aus einem Grammophon schweben ein freundlicher Dinosaurier, ein Planet und Meeresfische.',
    discoveries: [
      { label: 'Hörwelt', symbol: '🎧', explanation: 'Hier stehen die Audio-Dokus zum Anhören.' },
      { label: 'Play & Pause', symbol: '▶️', explanation: 'Du bestimmst, wann die Hörreise startet oder eine Pause macht.' },
      { label: 'Hörliste', symbol: '🎶', explanation: 'In der Wiedergabeliste findest du deine nächsten Hörabenteuer.' },
    ],
    details: 'Die Hörwelt liegt im Audio-Reiter unter Dokus. Der globale Player bietet Wiedergabe, Pause und eine Wiedergabeliste im Profilmenü. Der Zugriff auf einzelne Folgen hängt vom Familienplan ab; die App zeigt gesperrte Folgen an.',
    location: 'Dokus → Hörwelt · Profil → Wiedergabeliste', destination: '/doku',
    narration: 'Kopfhörer auf, wir gehen auf Wissensreise! In Dokus findest du die Hörwelt mit Audio-Dokus. Wähle eine Folge und tippe auf Play. Mit Pause hältst du an. Deine Wiedergabeliste findest du über das Profilbild. Manche Folgen gehören zu eurem Familienabo.',
  },
  {
    id: 'cosmos', label: 'Dein Lernkosmos', title: 'Dein Wissen wird eine Welt.', accent: '#a29aca',
    lede: 'Jedes Wissensgebiet hat einen Planeten. Schau dich um und entdecke, was du schon gelernt hast.',
    imageAlt: 'Ein Kind und Tavi schweben sicher in einer fantasievollen Sternenwelt mit einem Dinosaurierplaneten, einem Naturplaneten und kleinen Wissensmonden.',
    discoveries: [
      { label: 'Planeten', symbol: '🪐', explanation: 'Ein Planet steht für ein Wissensgebiet.' },
      { label: 'Monde', symbol: '🌙', explanation: 'Auf den Monden findest du einzelne Themen.' },
      { label: 'Wiederholen', symbol: '⭐', explanation: 'Öffne ein Thema und wiederhole dein Wissen mit Dokus und Quiz.' },
    ],
    details: 'Die Kosmos-Kachel auf der Startseite öffnet die 3D-Übersicht. Tippe auf Planeten und Themenmonde, um Lernfortschritt, passende Dokus und Quiz zu sehen. Die Ansichten heißen „Übersicht“, „Planet“ und „Monde“.',
    location: 'Startseite → Mein Lernkosmos', destination: '/cosmos',
    narration: 'Dein Wissen bekommt eine eigene Sternenwelt! Im Lernkosmos steht jeder Planet für ein Wissensgebiet. Kleine Monde zeigen einzelne Themen. Tippe auf einen Planeten und schau, was du schon entdeckt hast. Dort findest du auch Dokus und Quiz zum Wiederholen.',
  },
  {
    id: 'journey', label: 'Die Reisekarte', title: 'Ein Schritt. Eine neue Entdeckung.', accent: '#89ad96',
    lede: 'Auf der Reisekarte führt ein Weg zu Geschichten, Dokus und Quiz. Wähle einen offenen Stopp.',
    imageAlt: 'Ein Kind und sein Fuchs folgen einem geschwungenen Weg über eine bunte Entdeckerkarte mit Buchstation, Teleskopstation, Quizinsel und Schatztruhe.',
    discoveries: [
      { label: 'Stopp wählen', symbol: '🗺️', explanation: 'Ein offener Stopp zeigt dein nächstes Abenteuer.' },
      { label: 'Aufgabe lösen', symbol: '🏁', explanation: 'Lies, entdecke oder beantworte Fragen an der Station.' },
      { label: 'Weiterreisen', symbol: '🎁', explanation: 'Schau nach erledigten Aufgaben, welche Stopps und Belohnungen warten.' },
    ],
    details: 'Die Reisekarte bündelt Stationen für Geschichten, Dokus und Quiz. Offene und gesperrte Stopps sowie Aufgaben und Belohnungen werden angezeigt. Sie ist ein zusätzlicher Lernpfad; der Lernkosmos zeigt deine Wissensgebiete.',
    location: 'Reisekarte', destination: '/map',
    narration: 'Auf der Reisekarte wartet dein nächster Schritt! Wähle einen offenen Stopp. Dort kannst du eine Geschichte lesen, eine Doku entdecken oder ein Quiz spielen. Danach schaust du, wohin dein Weg weiterführt und welche Belohnungen auf dich warten.',
  },
  {
    id: 'games', label: 'Spiele & Quiz', title: 'Knobeln macht zusammen Spaß.', accent: '#b09dc9',
    lede: 'Spiele ein Wissens-Quiz oder löse mit deiner Familie einen Fall im Mitternachts-Alibi.',
    imageAlt: 'Ein Kind löst ein freundliches Bilderquiz, während vier Familienmitglieder mit Tierfiguren, einer Dorfkarte und Tavi als Detektiv einen Rätselabend spielen.',
    discoveries: [
      { label: 'Wissens-Quiz', symbol: '❓', explanation: 'Beantworte Fragen aus den Dokus und übe dein Wissen.' },
      { label: 'Mitternachts-Alibi', symbol: '🕵️', explanation: 'Vier bis acht Spieler suchen gemeinsam nach dem Dieb.' },
      { label: 'Gemeinsam', symbol: '🤝', explanation: 'Für das Rätselspiel holst du deine Familie oder Freunde dazu.' },
    ],
    details: 'Im Bereich „Spiel“ wählst du zwischen Wissens-Quiz und Mitternachts-Alibi. Das Quiz ist allein spielbar. Das Alibi-Spiel ist für vier bis acht Personen und erklärt seine Regeln mit Kommissar Tavi. Ein Quiz lässt sich außerdem aus dem Lernkosmos oder einer Doku starten.',
    location: 'Spiel → Wissens-Quiz oder Mitternachts-Alibi', destination: '/spiel',
    narration: 'Jetzt wird geknobelt! Im Bereich Spiel wartet ein Wissens-Quiz mit Fragen aus den Dokus. Das kannst du allein spielen. Für Mitternachts-Alibi holst du deine Familie oder Freunde dazu: Vier bis acht Spieler suchen mit Kommissar Tavi nach dem Dieb.',
  },
  {
    id: 'treasure', label: 'Schätze & Tagebuch', title: 'Was hast du unterwegs gefunden?', accent: '#d3ad62',
    lede: 'Dein Held sammelt Erinnerungen und Fundstücke. Ein Schatz kann dich beim nächsten Abenteuer begleiten.',
    imageAlt: 'Ein Fuchs und ein Kind öffnen eine Schatztruhe mit einem Kompass, einer leuchtenden Feder und einem Tagebuch voller Abenteuerbilder.',
    discoveries: [
      { label: 'Schatzkammer', symbol: '💎', explanation: 'Hier liegen die Fundstücke aus den Geschichten deines Helden.' },
      { label: 'Mitnehmen', symbol: '🎒', explanation: 'Wähle beim nächsten Geschichtenstart einen Schatz als Begleiter.' },
      { label: 'Tagebuch', symbol: '📔', explanation: 'Blättere durch die Erinnerungen deines Helden.' },
    ],
    details: 'Wähle unter Avatare einen Helden und öffne „Schatzkammer“ oder „Tagebuch“. Fundstücke können im Geschichten-Wizard als Begleiter gewählt werden. Weiterentwicklung und Erinnerungen ergeben sich aus dem jeweiligen Abenteuer.',
    location: 'Avatare → Held → Schatzkammer oder Tagebuch', destination: '/avatar',
    narration: 'Was hast du im Abenteuer gefunden? In der Schatzkammer deines Helden liegen seine Fundstücke. Vielleicht ein Kompass oder eine Zauberfeder! Einen Schatz kannst du beim nächsten Geschichtenstart mitnehmen. Im Tagebuch schaust du auf eure Erlebnisse zurück.',
  },
  {
    id: 'tavi', label: 'Mit Tavi sprechen', title: 'Eine Frage? Ich bin da!', accent: '#77acac',
    lede: 'Frag mich, was dich neugierig macht. Zusammen finden wir Ideen und planen dein nächstes Abenteuer.',
    imageAlt: 'Tavi sitzt auf Augenhöhe neben einem Kind und seinem Fuchs. Über ihnen schweben bildliche Gedankenblasen mit Sternen, einem Buch und einer Glühbirne.',
    discoveries: [
      { label: 'Fragen', symbol: '💬', explanation: 'Öffne Tavi im Menü und schreib deine Frage.' },
      { label: 'Ideen finden', symbol: '💡', explanation: 'Ich helfe dir, ein Thema oder eine Geschichtenidee zu finden.' },
      { label: 'Loslegen', symbol: '✨', explanation: 'Wenn euer Plan es erlaubt, starte ich Geschichten und Dokus im Chat.' },
    ],
    details: 'Der Tavi-Menüpunkt öffnet den Chat. Er beantwortet Fragen und hilft bei Ideen. Geschichten und Dokus direkt im Chat zu erstellen hängt vom Plan ab. Nachrichten und neue Inhalte zählen zu den jeweiligen Kontingenten.',
    location: 'Menü → Tavi',
    narration: 'Eine Frage? Ich bin da! Öffne Tavi im Menü und schreib mir, was du wissen möchtest. Wir finden zusammen eine Idee für deine nächste Geschichte oder Doku. Wenn euer Familienplan es erlaubt, kann ich auch direkt im Chat etwas für dich erstellen.',
  },
  {
    id: 'offline', label: 'Für unterwegs', title: 'Dein Abenteuer reist mit.', accent: '#89acc0',
    lede: 'Speichere passende Inhalte vorher mit Internet. Dann kannst du sie auch unterwegs ohne Netz lesen oder hören.',
    imageAlt: 'Ein Kind und sein Fuchs packen Buch und Kopfhörer in einen Rucksack. Im Zug liest das Kind entspannt, während draußen eine Landschaft vorbeizieht.',
    discoveries: [
      { label: 'Vorher speichern', symbol: '⬇️', explanation: 'Mit Internet auf „Offline speichern“ tippen.' },
      { label: 'Unterwegs', symbol: '🚆', explanation: 'Gespeicherte Inhalte auf diesem Gerät ohne Internet öffnen.' },
      { label: 'Audio einpacken', symbol: '🎧', explanation: 'Speichere auch das Audio, wenn du unterwegs zuhören möchtest.' },
    ],
    details: 'Offline-Speicherung und ihre Anzahl hängen vom Plan ab. Inhalte bleiben auf dem Gerät und im jeweiligen Profil. Zum Offline-Hören muss das Audio ebenfalls gespeichert sein. Neue Geschichten, neue Dokus und Tavi brauchen Internet. Gespeicherte Audios verwaltest du unter Einstellungen.',
    location: 'Buchmenü → Offline speichern · Einstellungen → Audio', destination: '/stories',
    narration: 'Dein Abenteuer reist mit! Speichere passende Geschichten und Dokus vorher mit Internet über Offline speichern. Dann kannst du sie auf diesem Gerät ohne Netz öffnen. Zum Zuhören brauchst du auch das gespeicherte Audio. Neue Geschichten und neue Dokus brauchen weiterhin Internet.',
  },
  {
    id: 'parents', label: 'Mit deiner Familie', title: 'Jeder hat seine eigene Welt.', accent: '#b29eaa',
    lede: 'Du hast dein eigenes Profil. Deine Eltern helfen dir beim Einstellen, damit eure Abenteuer gut zu dir passen.',
    imageAlt: 'Ein Elternteil und zwei Kinder mit verschiedenfarbigen kleinen Bücherregalen richten zusammen eine gemütliche Geschichtenwelt ein. Tavi hält einen goldenen Schlüssel.',
    discoveries: [
      { label: 'Dein Profil', symbol: '🙂', explanation: 'Deine Helden und dein Lernfortschritt gehören zu deinem Kinderprofil.' },
      { label: 'Eltern helfen', symbol: '🔑', explanation: 'Deine Eltern legen passende Themen, Lernziele und Grenzen fest.' },
      { label: 'Einstellungen', symbol: '⚙️', explanation: 'Hier stellt ihr zusammen Darstellung, Sprache und euer Konto ein.' },
    ],
    details: 'Für Eltern: Profile, Alter, Interessen und Lernziele werden in den Einstellungen verwaltet. Der Elternbereich hat PIN-Schutz sowie Tabu-Themen und Tageslimits. Plan und Kontingente gelten für die Familie; profilbezogene Budgets hängen vom Plan ab. Konto, Darstellung und Audio-Bibliothek liegen ebenfalls in den Einstellungen.',
    location: 'Profilmenü → Einstellungen · Elternbereich', destination: '/settings',
    narration: 'Jeder hat seine eigene Welt! Über dein Profil findest du deine Helden und deinen Lernfortschritt. Deine Eltern helfen bei Themen, Lernzielen und Grenzen. Die Elterneinstellungen sind mit einer PIN geschützt. In Einstellungen könnt ihr auch gemeinsam eure Darstellung und euer Konto anpassen.',
  },
  {
    id: 'start', label: 'Los geht’s', title: 'Welches Abenteuer wird deins?', accent: '#8baa98',
    lede: 'Jetzt kennst du die Wege. Erfinde deinen ersten Helden oder schau dich in Talea um.',
    imageAlt: 'Ein Kind, sein Fuchs und Tavi gehen durch ein offenes Tor in eine freundliche Welt mit Schloss, Planeten, Büchern und Entdeckerpfaden.',
    discoveries: [
      { label: 'Mein Held', symbol: '🦊', explanation: 'Gestalte zuerst einen Avatar, der dich begleitet.', chapter: 'avatar' },
      { label: 'Mein Abenteuer', symbol: '📖', explanation: 'Deine eigene Geschichte beginnt mit einer Idee.', chapter: 'story' },
      { label: 'Meine Frage', symbol: '🔭', explanation: 'Worüber möchtest du mehr wissen?', chapter: 'doku' },
    ],
    details: 'Mit „Ersten Helden gestalten“ öffnest du den Avatar-Wizard. „Selbst entdecken“ schließt den Rundgang. Du kannst ihn jederzeit im Profilmenü erneut starten.',
    narration: 'Jetzt kennst du die Wege in Talea! Welches Abenteuer wird deins? Gestalte deinen ersten Helden oder schau dich selbst um. Wenn du mich später noch einmal brauchst, findest du den Rundgang im Profilmenü. Ich freue mich auf unsere Abenteuer!',
  },
];

export const tourImage = (id: ChapterId) => `/onboarding/images/${id}.webp`;
export const tourAudio = (id: ChapterId) => `/onboarding/audio/${id}.mp3`;
