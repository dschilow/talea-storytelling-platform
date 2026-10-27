/** Export the reviewed editorial sections as the seed data for the series pipeline. */
import { readFile, writeFile } from "node:fs/promises";

const source = await readFile("docs/figurenserien/serienbibeln.md", "utf8");
const specs = [
  { id: "nebelfee", characterId: "6b5e29b8-2b82-42d4-80ef-8749ebd4eab9", characterName: "Die Nebelfee", title: "Die Nebelfee und das Haus der verlorenen Wege", description: "Eine scheue Fee bringt Verlorenes zurück und sucht dabei ihren eigenen Heimweg.", genres: ["fairy_tales", "adventure", "magic"] },
  { id: "funkelflug", characterId: "9abcfc66-9434-4fa3-b985-8aca94bcec20", characterName: "Funkelflug", title: "Funkelflug und die Wege am Drachenberg", description: "Ein kleiner Drache erkundet den Drachenberg und findet Wege für große und kleine Wesen.", genres: ["fairy_tales", "adventure", "animals"] },
  { id: "graf-griesgram", characterId: "2a301ab9-749c-4b69-b3de-4b35fde5934e", characterName: "Graf Griesgram", title: "Graf Griesgram und die unerwünschten Gäste", description: "Ein grummeliger Graf deckt heimlich den Tisch für Besuch.", genres: ["modern"] },
  { id: "kapitaen-blubbert", characterId: "f30ea3db-46db-412f-9049-a7ab23447892", characterName: "Kapitän Blubbert", title: "Kapitän Blubbert und die Insel ohne Karte", description: "Ein Kapitän und seine Crew suchen eine Insel und entscheiden gemeinsam über ihren Kurs.", genres: ["adventure", "magic"] },
  { id: "tilda-tueftel", characterId: "ae2748f6-7f63-4392-928f-04508f84ed80", characterName: "Tilda Tüftel", title: "Tilda Tüftel und die Werkstatt der fast perfekten Ideen", description: "Eine junge Erfinderin und ihre Freunde suchen Lösungen für überraschende Dorfprobleme.", genres: ["modern", "adventure"] },
];

const sections = source.split(/^## \d\. /m).slice(1);
if (sections.length !== specs.length) throw new Error(`Expected ${specs.length} series sections, got ${sections.length}`);
const bibles = specs.map((spec, index) => ({ ...spec, bible: sections[index].split(/^## Nachvollzug/m)[0].trim() }));
await writeFile("backend/story/character-series/series-bibles.json", `${JSON.stringify(bibles, null, 2)}\n`, "utf8");
