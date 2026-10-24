import React, { useEffect } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { LEGAL_INFO_COMPLETE, LEGAL_OPERATOR as op, LEGAL_PAGES } from './legalInfo';

// Draft texts (status 24.10.2026), written for a German operator selling
// subscriptions to consumers. They are no substitute for a legal review; see
// legalInfo.ts. Keep the list of processors in sync with the backend when a
// provider is added or removed.

const H2: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="mt-10 text-xl font-semibold text-[var(--talea-text-primary)]">{children}</h2>
);
const H3: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="mt-6 font-semibold text-[var(--talea-text-primary)]">{children}</h3>
);
const P: React.FC<{ children: React.ReactNode }> = ({ children }) => <p className="mt-3">{children}</p>;
const UL: React.FC<{ children: React.ReactNode }> = ({ children }) => <ul className="mt-3 list-disc space-y-1.5 pl-5">{children}</ul>;

const OperatorAddress: React.FC = () => (
  <address className="mt-3 not-italic">
    {op.name}<br />
    {op.representative && <>vertreten durch {op.representative}<br /></>}
    {op.street}<br />
    {op.postalCodeCity}<br />
    {op.country}
  </address>
);

const Contact: React.FC = () => (
  <P>
    E-Mail: <a className="underline" href={`mailto:${op.email}`}>{op.email}</a><br />
    Telefon: {op.phone}
  </P>
);

function Impressum() {
  return <>
    <H2>Angaben gemäß § 5 DDG</H2>
    <OperatorAddress />
    <H2>Kontakt</H2>
    <Contact />
    {op.register && <><H2>Registereintrag</H2><P>{op.register}</P></>}
    {op.vatId && <><H2>Umsatzsteuer-ID</H2><P>Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: {op.vatId}</P></>}
    <H2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</H2>
    <P>{op.responsibleForContent || `${op.name}, Anschrift wie oben`}</P>
    <H2>Verbraucherstreitbeilegung</H2>
    <P>Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</P>
    <H2>Hinweis zu KI-Inhalten</H2>
    <P>Geschichten, Dokus, Bilder und Stimmen in Talea werden mit Hilfe künstlicher Intelligenz erzeugt. Sie werden automatisch geprüft, können aber Fehler enthalten. Personen und Fachleute in Geschichten und Dokus sind erfundene Figuren, sofern nicht ausdrücklich anders angegeben.</P>
  </>;
}

function Datenschutz() {
  return <>
    <P>Wir nehmen den Schutz eurer Daten und besonders der Daten eurer Kinder ernst. Hier steht, welche Daten Talea verarbeitet, wofür und wer daran beteiligt ist.</P>

    <H2>1. Verantwortlicher</H2>
    <OperatorAddress />
    <Contact />

    <H2>2. Welche Daten wir verarbeiten</H2>
    <UL>
      <li><strong>Konto:</strong> E-Mail-Adresse, Name (falls angegeben), Anmeldedaten und Sitzungsinformationen.</li>
      <li><strong>Kinderprofile und Avatare:</strong> was ihr als Eltern eingebt, etwa Vorname, Alter, Interessen, Aussehen und Persönlichkeit der Avatare sowie Elterneinstellungen (Tabu-Themen, Lernziele, Limits). Bitte gebt keine Nachnamen, Adressen oder Fotos eurer Kinder ein, wenn es dafür keinen Grund gibt.</li>
      <li><strong>Erstellte Inhalte und Fortschritt:</strong> Geschichten, Dokus, Bilder, Wünsche und Ideen aus dem Geschichten-Assistenten, Erinnerungen der Avatare, Quiz-Ergebnisse, Lese- und Lernfortschritt, gesammelte Schätze.</li>
      <li><strong>Nachrichten an Tavi:</strong> der Inhalt der Chats mit dem Assistenten Tavi.</li>
      <li><strong>Abo und Zahlung:</strong> gewählter Plan, Laufzeit, Rechnungen. Zahlungsdaten (z. B. Kartennummer) gibt ihr direkt bei unserem Zahlungsdienstleister ein; wir sehen sie nicht.</li>
      <li><strong>Technische Daten:</strong> IP-Adresse, Zeitpunkt, aufgerufene Adresse, Browser-Informationen und Fehlermeldungen in Server-Protokollen.</li>
    </UL>

    <H2>3. Zwecke und Rechtsgrundlagen</H2>
    <UL>
      <li>Bereitstellung von Talea, Konto, Abo und Abrechnung: Art. 6 Abs. 1 lit. b DSGVO (Vertrag).</li>
      <li>Erzeugen persönlicher Geschichten, Dokus, Bilder und Audios mit KI-Diensten: Art. 6 Abs. 1 lit. b DSGVO, denn das ist die Leistung, die ihr bestellt.</li>
      <li>Sicherheit, Missbrauchs- und Kinderschutzprüfung der eingegebenen Wünsche, Fehlersuche: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einem sicheren Angebot).</li>
      <li>Aufbewahrung von Rechnungen: Art. 6 Abs. 1 lit. c DSGVO (gesetzliche Pflicht).</li>
    </UL>
    <P>Das Konto führt immer ein Elternteil oder eine andere volljährige Person. Daten über Kinder verarbeiten wir nur, soweit die Eltern sie eingeben, und nur, um die Inhalte für ihr Kind zu erstellen. Wir nutzen sie nicht für Werbung, verkaufen sie nicht und erstellen keine Werbeprofile.</P>

    <H2>4. Dienstleister, die Daten in unserem Auftrag verarbeiten</H2>
    <P>Wir arbeiten mit diesen Anbietern zusammen. Sie dürfen die Daten nur für die beschriebenen Zwecke nutzen (Auftragsverarbeitung nach Art. 28 DSGVO):</P>
    <UL>
      <li><strong>Railway Corporation</strong> (USA): Server, Datenbanken und Dateispeicher, auf denen Talea läuft.</li>
      <li><strong>Clerk, Inc.</strong> (USA): Anmeldung, Kontoverwaltung und Abo-Verwaltung.</li>
      <li><strong>Stripe</strong> (Stripe Payments Europe Ltd., Irland, und Stripe, Inc., USA): Zahlungsabwicklung für Abos.</li>
      <li><strong>OpenRouter, Inc.</strong> (USA): leitet Anfragen an KI-Sprachmodelle weiter, deren Anbieter die Texte erzeugen (z. B. OpenAI, Google, Moonshot AI).</li>
      <li><strong>OpenAI</strong> (USA) und <strong>Google</strong> (Gemini, USA/EU): Erzeugung und Prüfung von Texten.</li>
      <li><strong>Runware, Inc.</strong> (USA): Erzeugung der Bilder.</li>
      <li><strong>ElevenLabs</strong> (USA/EU) und weitere Sprachdienste: Erzeugung der Stimmen für Hörspiele, Audio-Dokus und das Vorlesen.</li>
    </UL>
    <P>An die KI-Dienste übermitteln wir nur, was für den jeweiligen Inhalt nötig ist: zum Beispiel Vorname, Alter und Beschreibung eines Avatars, die gewählte Welt und euren Wunsch. E-Mail-Adresse und Zahlungsdaten erhalten sie nicht.</P>

    <H2>5. Übermittlung in Länder außerhalb der EU</H2>
    <P>Einige Dienstleister sitzen in den USA oder verarbeiten dort Daten. Die Übermittlung stützen wir auf einen Angemessenheitsbeschluss der EU-Kommission (EU-U.S. Data Privacy Framework), soweit der Anbieter danach zertifiziert ist, und andernfalls auf die Standardvertragsklauseln der EU-Kommission (Art. 46 Abs. 2 lit. c DSGVO).</P>

    <H2>6. Speicherung im Browser</H2>
    <P>Talea speichert auf eurem Gerät, was für den Betrieb nötig ist: die Anmeldung, Einstellungen wie Sprache und Darstellung und, wenn ihr das wollt, Geschichten und Audios zum Offline-Lesen. Das ist für den von euch gewünschten Dienst unbedingt erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG). Wir setzen keine Werbe- oder Analyse-Cookies ein. Schriften und Bilder laden wir von unseren eigenen Servern.</P>

    <H2>7. Wie lange wir Daten speichern</H2>
    <P>Inhalte, Profile und Fortschritt speichern wir, solange euer Konto besteht. Einzelne Geschichten, Dokus, Tagebucheinträge und Kinderprofile könnt ihr jederzeit selbst löschen. Wenn ihr die Löschung eures Kontos verlangt (eine E-Mail genügt), löschen wir das Konto und die zugehörigen Daten, soweit wir sie nicht wegen gesetzlicher Pflichten aufbewahren müssen (Rechnungen: bis zu 10 Jahre). Server-Protokolle werden nach kurzer Zeit automatisch gelöscht.</P>

    <H2>8. Eure Rechte</H2>
    <P>Ihr habt das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 21). Schreibt uns dafür an <a className="underline" href={`mailto:${op.email}`}>{op.email}</a>. Außerdem könnt ihr euch bei einer Datenschutz-Aufsichtsbehörde beschweren, etwa bei der Behörde eures Bundeslandes.</P>

    <H2>9. Keine automatisierten Entscheidungen</H2>
    <P>Wir treffen keine Entscheidungen mit rechtlicher Wirkung allein durch automatisierte Verarbeitung (Art. 22 DSGVO). Die KI erstellt Inhalte; sie entscheidet nicht über euch.</P>

    <P>Stand: {op.lastUpdated}</P>
  </>;
}

function Agb() {
  return <>
    <H2>1. Geltungsbereich und Anbieter</H2>
    <P>Diese Bedingungen gelten für die Nutzung von Talea (www.talea.website und die Talea-App). Anbieter und Vertragspartner ist {op.name}, {op.street}, {op.postalCodeCity}.</P>

    <H2>2. Leistungen</H2>
    <P>Talea erstellt mit Hilfe künstlicher Intelligenz persönliche Geschichten, Wissens-Dokus, Bilder und Audios für Kinder und stellt redaktionell produzierte Inhalte (Talea Originals, Hörspiele, Audio-Dokus) bereit. Umfang und Kontingente der einzelnen Pläne stehen auf der Preisseite und unter „Abo & Nutzung“. KI-Inhalte werden automatisch geprüft, können aber Fehler enthalten; Talea ersetzt keine fachliche Beratung.</P>

    <H2>3. Konto und Nutzung durch Kinder</H2>
    <P>Ein Konto darf nur eine volljährige Person anlegen. Kinder nutzen Talea über die Kinderprofile dieses Kontos und unter der Verantwortung der Eltern. Zugangsdaten sind geheim zu halten.</P>

    <H2>4. Vertragsschluss</H2>
    <P>Der kostenlose Plan kommt mit der Registrierung zustande. Ein bezahltes Abo kommt zustande, wenn ihr im Bezahlvorgang auf die Schaltfläche „Zahlungspflichtig abonnieren“ (bei einer Testphase: „Kostenlos testen, danach zahlungspflichtig“) klickt. Vorher seht ihr Plan, Preis, Abrechnungszeitraum und Beginn.</P>

    <H2>5. Preise und Zahlung</H2>
    <P>Es gelten die im Bezahlvorgang angezeigten Preise und die dort angezeigte Währung. Das Abo wird für den jeweiligen Abrechnungszeitraum im Voraus über unseren Zahlungsdienstleister abgerechnet. Endet eine kostenlose Testphase, beginnt das bezahlte Abo automatisch, sofern ihr nicht vorher kündigt.</P>

    <H2>6. Laufzeit und Kündigung</H2>
    <P>Abos verlängern sich automatisch um den gewählten Abrechnungszeitraum und können jederzeit zum Ende des laufenden Zeitraums gekündigt werden: in Talea unter Einstellungen → „Abo & Nutzung“ → „Abo verwalten & kündigen“ oder per E-Mail an {op.email}. Bis zum Ende des bezahlten Zeitraums bleiben alle Leistungen des Plans nutzbar; danach gilt der kostenlose Plan. Bereits erstellte Inhalte bleiben lesbar. Das Recht zur außerordentlichen Kündigung bleibt unberührt.</P>

    <H2>7. Inhalte und Nutzungsrechte</H2>
    <P>Die für euch erstellten Geschichten, Dokus und Bilder dürft ihr privat nutzen, ausdrucken und in der Familie teilen. Eingaben (Wünsche, Beschreibungen) dürfen keine Rechte Dritter verletzen und keine Inhalte enthalten, die für Kinder ungeeignet sind; solche Eingaben lehnt Talea ab.</P>

    <H2>8. Haftung</H2>
    <P>Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei Verletzung von Leben, Körper oder Gesundheit und nach dem Produkthaftungsgesetz. Bei leicht fahrlässiger Verletzung wesentlicher Vertragspflichten ist die Haftung auf den vertragstypischen, vorhersehbaren Schaden begrenzt. Im Übrigen ist die Haftung für leichte Fahrlässigkeit ausgeschlossen.</P>

    <H2>9. Änderungen</H2>
    <P>Änderungen dieser Bedingungen oder der Preise teilen wir mindestens sechs Wochen vorher per E-Mail mit. Preiserhöhungen für ein laufendes Abo gelten nur, wenn ihr zustimmt; andernfalls könnt ihr zum Änderungszeitpunkt kündigen.</P>

    <H2>10. Schlussbestimmungen</H2>
    <P>Es gilt deutsches Recht. Für Verbraucher gilt diese Rechtswahl nur, soweit dadurch nicht zwingende Schutzvorschriften des Staates entzogen werden, in dem sie ihren gewöhnlichen Aufenthalt haben.</P>

    <H2>Widerrufsbelehrung</H2>
    <H3>Widerrufsrecht</H3>
    <P>Ihr habt das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsschlusses. Um euer Widerrufsrecht auszuüben, müsst ihr uns ({op.name}, {op.street}, {op.postalCodeCity}, E-Mail: {op.email}, Telefon: {op.phone}) mittels einer eindeutigen Erklärung (z. B. eine E-Mail) über euren Entschluss, diesen Vertrag zu widerrufen, informieren. Ihr könnt dafür das unten stehende Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist. Zur Wahrung der Widerrufsfrist reicht es aus, dass ihr die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absendet.</P>
    <H3>Folgen des Widerrufs</H3>
    <P>Wenn ihr diesen Vertrag widerruft, haben wir euch alle Zahlungen, die wir von euch erhalten haben, unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über euren Widerruf bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das ihr bei der ursprünglichen Transaktion eingesetzt habt, es sei denn, mit euch wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden euch wegen dieser Rückzahlung Entgelte berechnet. Habt ihr verlangt, dass die Dienstleistung während der Widerrufsfrist beginnen soll, so habt ihr uns einen angemessenen Betrag zu zahlen, der dem Anteil der bis zum Widerruf bereits erbrachten Dienstleistungen im Vergleich zum Gesamtumfang der im Vertrag vorgesehenen Dienstleistungen entspricht.</P>
    <H3>Muster-Widerrufsformular</H3>
    <P>(Wenn ihr den Vertrag widerrufen wollt, füllt bitte dieses Formular aus und sendet es zurück.)</P>
    <P>An {op.name}, {op.street}, {op.postalCodeCity}, E-Mail: {op.email}:<br />
      Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über die Erbringung der folgenden Dienstleistung (*): Talea-Abo (Plan: ______)<br />
      Bestellt am (*) ______<br />
      Name des/der Verbraucher(s): ______<br />
      Anschrift des/der Verbraucher(s): ______<br />
      E-Mail-Adresse des Talea-Kontos: ______<br />
      Datum: ______<br />
      (*) Unzutreffendes streichen.</P>

    <P>Stand: {op.lastUpdated}</P>
  </>;
}

const DOCUMENTS: Record<string, { title: string; body: () => React.ReactElement }> = {
  '/impressum': { title: 'Impressum', body: Impressum },
  '/datenschutz': { title: 'Datenschutzerklärung', body: Datenschutz },
  '/agb': { title: 'Allgemeine Geschäftsbedingungen', body: Agb },
};

export default function LegalPage() {
  const { pathname } = useLocation();
  const doc = DOCUMENTS[pathname];
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  if (!doc || !LEGAL_INFO_COMPLETE) return <Navigate to="/" replace />;
  const Body = doc.body;
  return (
    <div className="min-h-screen bg-[var(--talea-page-solid,#FFF7EC)] px-4 pb-20 pt-6 text-[15px] leading-7 text-[var(--talea-text-secondary,#4b5563)] sm:px-6">
      <main className="mx-auto max-w-3xl">
        <Link to="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--talea-text-primary,#1f2937)]">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />Zu Talea
        </Link>
        <h1 className="mt-6 text-3xl font-semibold text-[var(--talea-text-primary,#1f2937)] sm:text-4xl" style={{ fontFamily: 'var(--talea-font-display)' }}>{doc.title}</h1>
        <Body />
        <nav aria-label="Rechtliches" className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-[var(--talea-border-light,#e5e7eb)] pt-6 text-sm font-semibold">
          {LEGAL_PAGES.filter(page => page.path !== pathname).map(page => <Link key={page.path} to={page.path} className="underline-offset-4 hover:underline">{page.label}</Link>)}
        </nav>
      </main>
    </div>
  );
}
