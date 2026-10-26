import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { sanitizeCharacter } from "../../backend/story/character-pool-import";
import { COMIC_ROLES } from "../../backend/story/character-bible-core";
import { leadNames, folds, revisions } from "./editorial-2026-10-26";

const source = resolve(process.argv[2] || "C:/Users/DimitriSc/Downloads/talea-characters-2026-10-26T08-47-19-727Z.json");
const out = resolve(process.argv[3] || "exports/character-pool/2026-10-26");
if (source.startsWith(out + "\\") || source.startsWith(out + "/")) throw new Error("Keep the source outside the output directory.");
const originalBytes = await readFile(source);
const sourceRows: Record<string, any>[] = JSON.parse(originalBytes.toString("utf8"));
if (!Array.isArray(sourceRows) || !sourceRows.length) throw new Error("Expected a nonempty array.");
const groups = new Map<string, Record<string, any>[]>();
for (const row of sourceRows) {
  const key = String(row.name || "").normalize("NFC").trim().toLocaleLowerCase("de-DE");
  groups.set(key, [...(groups.get(key) || []), row]);
}
const pictured = [...groups.values()].map(group => {
  const withImage = group.filter(row => typeof row.imageUrl === "string" && row.imageUrl.trim());
  if (withImage.length !== 1) throw new Error(`Review image ambiguity for ${group[0].name}: ${withImage.length} pictured records.`);
  return structuredClone(withImage[0]);
});
for (const name of Object.keys(folds)) if (!pictured.some(row => row.name === name)) throw new Error(`Missing merge source ${name}`);
for (const { into } of Object.values(folds)) if (!pictured.some(row => row.name === into) || folds[into]) throw new Error(`Invalid merge target ${into}`);
const outputRows = pictured.filter(row => !folds[row.name]);
if (outputRows.length !== Object.keys(revisions).length) throw new Error(`Editorial coverage mismatch: ${outputRows.length} figures, ${Object.keys(revisions).length} revisions.`);
for (const name of leadNames) if (!outputRows.some(row => row.name === name)) throw new Error(`Missing leading figure ${name}`);
const changes: any[] = [];
const warnings: string[] = [];
for (const row of outputRows) {
  const revision = revisions[row.name];
  if (!revision) throw new Error(`Missing editorial review: ${row.name}`);
  const { score, ...fields } = revision;
  const before = structuredClone(row);
  Object.assign(row, fields, { bibleVersion: 2, updatedAt: "2026-10-26T09:00:00.000Z", canLead: leadNames.has(row.name) });
  if (!row.canLead && ["main", "protagonist"].includes(row.role)) row.role = "companion";
  row.maxScreenTime = row.canLead ? Math.max(65, row.maxScreenTime) : Math.min(45, row.maxScreenTime);
  // Nice helpers may cause complications without being cast as opposing figures.
  if (["Bo Bücherfuchs", "Drache Fauchi", "Eichhörnchen Flitz", "Silberhorn der Hirsch", "Tilda Tüftel"].includes(row.name)) row.canOppose = false;
  if (row.canOppose && !row.villainStyle) {
    row.villainStyle = ["Brumm der Steinwächter", "Die Alte Eiche", "Troll Grummel", "Schattenjunge Finn", "Tante Sorgenfalt", "Graumund der Gleichgültige", "Der Letzte Wehmueter", "Hexe Kräuterweis"].includes(row.name) ? "misunderstood" : "comic";
  }
  if (!row.canOppose) delete row.villainStyle;
  if (!COMIC_ROLES.includes(row.comicRole)) throw new Error(`Invalid comic role: ${row.name}`);
  for (const [field, max] of Object.entries({ want: 120, fear: 100, secret: 120, runningGag: 200, introLine: 140 })) {
    if (!row[field] || typeof row[field] !== "string") throw new Error(`Missing ${field}: ${row.name}`);
    if (row[field].length > max) warnings.push(`${row.name}: ${field} ${row[field].length}/${max}`);
  }
  const imported = sanitizeCharacter(row, 0, new Date("2026-10-26T09:00:00Z"));
  for (const field of ["id", "imageUrl", "want", "fear", "secret", "runningGag", "gesture", "canLead", "canOppose", "villainStyle", "bibleVersion", "introLine", "signatureVisual", "comicRole"]) {
    if ((imported as any)[field] !== row[field]) throw new Error(`Import round-trip mismatch ${row.name}.${field}`);
  }
  if (row.id !== before.id || row.imageUrl !== before.imageUrl || JSON.stringify(row.visualProfile) !== JSON.stringify(before.visualProfile)) throw new Error(`Visual identity changed: ${row.name}`);
  if (row.isActive !== before.isActive) throw new Error(`Unexpected activation change: ${row.name}`);
  changes.push({ id: row.id, name: row.name, active: row.isActive, sourceConceptScore: score, usageAtExport: before.totalUsageCount || 0,
    fields: Object.keys(row).filter(key => JSON.stringify(row[key]) !== JSON.stringify(before[key])) });
}
const byName = new Map(outputRows.map(row => [row.name, row]));
const retainedIds = new Set(outputRows.map(row => row.id));
const removed = sourceRows.filter(row => !retainedIds.has(row.id));
const mapping = removed.map(row => {
  const canonical = byName.get(folds[row.name]?.into || row.name);
  if (!canonical) throw new Error(`Unmapped removal: ${row.name}`);
  return { sourceId: row.id, sourceName: row.name, canonicalId: canonical.id, canonicalName: canonical.name,
    reason: folds[row.name]?.reason || "Gleichnamige bildlose Dublette; der Bilddatensatz bleibt maßgeblich." };
});
const filename = "talea-characters-2026-10-26-optimiert.json";
const json = JSON.stringify(outputRows, null, 2) + "\n";
const sha256 = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const manifest = { source, sourceSHA256: sha256(originalBytes), outputSHA256: sha256(json), sourceRows: sourceRows.length,
  uniqueNamesBefore: groups.size, outputRows: outputRows.length, active: outputRows.filter(row => row.isActive).length,
  leadingFigures: outputRows.filter(row => row.canLead).length,
  supportingFigures: outputRows.filter(row => !row.canLead).length,
  sameNameDuplicatesRemoved: sourceRows.length - pictured.length, similarNamedFiguresFolded: Object.keys(folds).length,
  removedRows: removed.length, preservedImages: outputRows.length, newFigures: 0, imagesGenerated: 0,
  productionWrites: 0, warnings, changes, mapping };
await mkdir(out, { recursive: true });
await writeFile(join(out, "original-unveraendert.json"), originalBytes);
await writeFile(join(out, filename), json);
await writeFile(join(out, "entfernte-eintraege-archiv.json"), JSON.stringify(removed, null, 2) + "\n");
await writeFile(join(out, "pruefprotokoll.json"), JSON.stringify(manifest, null, 2) + "\n");
const table = (leading: boolean) => changes.filter(row => leadNames.has(row.name) === leading).map(row => {
  const edited = byName.get(row.name)!;
  return `| ${row.name} | ${row.sourceConceptScore.toFixed(1).replace(".", ",")} | ${row.usageAtExport} | ${leading ? edited.want : edited.role} |`;
}).join("\n");
const report = [
  "# Überarbeiteter Talea-Figurenpool · 26. Oktober 2026", "",
  "**Vor dem Import muss die Importkorrektur bereitgestellt sein.** Der bisherige Importcode im Repository löscht den gesamten Figurenpool und seine Geschichten-Zuordnungen; durch die Datenbankverknüpfungen können dabei auch Origins und deren Kapitel verschwinden. Außerdem übernimmt er die neuen Charakterbibeln nicht. Die lokale Korrektur aktualisiert vorhandene IDs und archiviert ausgelassene Einträge, ohne Geschichten oder Origins zu löschen. Sie ist noch nicht live bereitgestellt.", "",
  `Die Datei **${filename}** enthält **${outputRows.length} aktive Figuren: ${leadNames.size} mögliche Hauptfiguren und ${outputRows.length - leadNames.size} Nebenfiguren**. Alle behalten ihre bisherigen IDs, Bilder, visuellen Profile und Nutzungszähler. Hexen, Magier, Kobolde und fantastische Wesen bleiben erhalten und aktiv. Es wurden keine Bilder oder neuen Figuren erzeugt.`, "",
  "Ausgang: 128 Datensätze, 89 unterschiedliche Namen. Entfernt wurden 39 bildlose Namensdubletten. Vier weitere Figuren gehen in klar überlappenden Alltagsrollen auf:", "",
  ...Object.entries(folds).map(([name, fold]) => `- **${name} → ${fold.into}:** ${fold.reason}`), "",
  "Damit gibt es genau einen Bäcker: **Bäcker Braun**. Sein Bild bleibt; sein eigenes misslingendes Lieblingsbrot übernimmt den stärksten Ansatz der zusammengeführten Bäcker. Merlin und Sternenschweif bleiben beide: Merlin mit der verwunschenen, kaum aufzuräumenden Werkstatt, Sternenschweif mit seinem Papierdrachen ohne Magie.", "",
  "## Was die Figuren interessanter machen soll", "",
  "Die 85 Profile bekommen konkrete eigene Vorhaben und komische Handlungsmuster. Beispiele: Luna will ihre Überlegenheit behaupten; die Nebelfee findet fremde Heimwege, aber ihren eigenen nicht; Funkelflug möchte eine Drachenhöhle für große Gäste eröffnen; der Geräusche-Fresser sucht sein Lieblingsgeräusch im eigenen überfüllten Sack. Die Gags entstehen aus Verhalten und Folgen statt bloß aus dreimal stärker werdenden Gesten.", "",
  "Die 25 Hauptrollenmarkierungen sind ein redaktioneller Vorschlag. Jede dieser Figuren kann auch Nebenfigur sein. Die übrigen 60 bleiben aktiv und können eine Geschichte als Helfer, Nachbar, Auftraggeber, Hindernis oder Gegenspieler aufbauen. Ihre bisherigen Hauptrollen-Bezeichnungen werden nötigenfalls zu Begleiterrollen. Die Bildschirmzeit-Obergrenze beträgt für Hauptrollenkandidaten mindestens 65 %, für Nebenfiguren höchstens 45 %; das ist keine Pflichtauftrittsdauer. Kein weiterer Charakter wurde pauschal wegen geringer Nutzung deaktiviert.", "",
  "Bruno und Flusi wurden anhand ihrer echten Reihenbibeln als Handwerksbeispiele geprüft: eigener Wille, klare Stimme, körperliche Komik und eine begrenzte Funktion. Ihre Serienfiguren und Magieregeln wurden nicht in den allgemeinen Pool kopiert. Die Reihenbibeln und ihre Geschichten bleiben unverändert.", "",
  "## Mögliche Hauptfiguren", "",
  "Die Konzeptnoten beziehen sich auf die **Profile des Ausgangsexports**. Sie sind eine subjektive redaktionelle Einschätzung von Wunsch, Konflikt, Komik und Wiedererkennbarkeit; keine gemessene Beliebtheit bei Kindern und keine Vorher/Nachher-Bewertung erzeugter Geschichten. Die Nutzungszahl ist der Zähler des jeweiligen Bilddatensatzes beim Export, kein Beliebtheitsmaß.", "",
  "| Figur | Konzept vorher / 10 | Einsätze erfasst | Neues eigenes Vorhaben |", "| --- | ---: | ---: | --- |", table(true), "",
  "## Aktive Nebenfiguren", "",
  "Auch diese Profile wurden überarbeitet. Ihre Nebenrollenfreigabe bedeutet keine Qualitätsabwertung; eine vertraute Nebenfigur braucht keinen eigenen Hauptbogen in jeder Geschichte.", "",
  "| Figur | Konzept vorher / 10 | Einsätze erfasst | Besetzungsrolle |", "| --- | ---: | ---: | --- |", table(false), "",
  "## Talea-Folge und Import", "",
  "Der lokale Patch betrifft die tatsächliche **talea-folge-v1**: Wenn der Wunsch **Hauptrolle – Dein Avatar ist die Hauptfigur** abgewählt ist (`avatarIsHero: false`), enthält die Auswahl gezielt eine geeignete Hauptfigur. Deren eigener Wunsch und Entscheidung tragen die Handlung; die Avatare bleiben aktive Begleiter mit entscheidenden Beiträgen. Wenn Avatare als Helden gewählt sind, bleiben sie im Mittelpunkt. Die Hauptfigur darf aus Plan und Text nicht verschwinden. Die Rollenänderung ist noch nicht veröffentlicht.", "",
  "Die Importkorrektur behält vorhandene Datensätze per ID und überträgt die Charakterbibeln einschließlich `canLead`, `canOppose` und `bibleVersion`. Fehlende Einträge werden deaktiviert. Vorhandene Geschichten-Zuordnungen, Origins und Kapitel werden dabei nicht gelöscht; deren Text wird nicht nachträglich auf andere Figurennamen umgeschrieben. Die Zuordnung entfernter IDs zu ihren maßgeblichen Figuren steht im Prüfprotokoll. Ältere Zuordnungen bleiben unter ihrer ursprünglichen ID erhalten.", "",
  "## Dateien und Prüfung", "",
  `- **Import:** ${filename}`, "- **Unverändertes Original:** original-unveraendert.json", "- **Archiv der 43 entfernten Datensätze, nicht importieren:** entfernte-eintraege-archiv.json", "- **Feldänderungen, ID-Zuordnungen und Prüfsummen:** pruefprotokoll.json", "",
  "Die JSON-Prüfung kontrolliert Eindeutigkeit, 85 erhaltene Bilder und Identitäten, 25 Hauptrollen, einen Bäcker und die vollständige Übernahme der Bibelfelder durch den korrigierten Import. Inzwischen bestehen 119 lokale Tests für Rollen, Import, Storybook und Origins; die Modellantworten darin sind Testdaten. Die Syntax der neun berührten Laufzeitdateien wurde geprüft. Der vollständige Bundle-Build scheiterte an gesperrten übergeordneten Verzeichnissen im Sandbox-Dateisystem; eine Datenbankintegration und ein Live-Import wurden nicht ausgeführt.", "",
  "Das zusätzliche Lektorat des privaten Exports mit Codex-Modellen wurde von der automatischen Freigabe wegen der Datenübertragung abgelehnt. Der parallel gestartete Sol-Aufruf wurde angehalten; es liegt kein fertiges Modelllektorat vor. Die Datei ist lokal redigiert und geprüft. Die früheren Storynoten der Talea-Folge sind kein Nachweis für einen Qualitätsgewinn dieser neuen Rollenverteilung.", "",
  "**Späterer Stand:** Auf den anschließenden ausdrücklichen Auftrag, die aktuelle Talea-Folge zu testen und zu optimieren, wurde eine gesonderte Storyprüfung mit den benötigten ausgewählten Figurenprofilen durchgeführt. Fünf gepaarte Fälle, zwei zusätzliche Test-Seeds und frische Lektorate mit Luna/Sol sind im [aktuellen Pipeline-Testbericht](C:/MyProjects/Talea/talea-storytelling-platform/docs/story-examples/talea-folge-rollen-2026-10-26/README.md) dokumentiert. Die Konzeptnoten dieses Figurenberichts bleiben davon getrennt.", "",
  "```powershell", "bun scripts/character-pool/prepare-import.ts", "bun scripts/character-pool/verify-import.ts", "```", "",
  `Original SHA-256: ${manifest.sourceSHA256}`, `Import SHA-256: ${manifest.outputSHA256}`, "",
].join("\n");
await writeFile(join(out, "AENDERUNGEN.md"), report);
console.log(JSON.stringify({ ...Object.fromEntries(Object.entries(manifest).filter(([key]) => !["mapping", "changes"].includes(key))), out }, null, 2));
if (warnings.length) process.exitCode = 2;
