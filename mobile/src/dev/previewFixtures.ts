/**
 * Design-preview fixtures (dev only).
 *
 * Loaded exclusively behind `__DEV__ && EXPO_PUBLIC_DESIGN_PREVIEW === '1'`,
 * which Metro constant-folds away in release bundles. Images are served from a
 * local static server (`adb reverse tcp:8099 tcp:8099`), so the repository does
 * not carry fixture artwork.
 */
import type { QueryClient } from '@tanstack/react-query';
import i18n from 'i18next';

import { queryKeys } from '@/hooks/queries';
import type { Avatar, AvatarMemory } from '@/types/avatar';
import type { Doku } from '@/types/doku';
import type { Story } from '@/types/story';

const ASSET_HOST = 'http://localhost:8099';
const cover = (file: string) => `${ASSET_HOST}/covers/${file}`;
const portrait = (file: string) => `${ASSET_HOST}/avatars/${file}`;
const dokuArt = (file: string) => `${ASSET_HOST}/doku/dokuDomain__${file}.webp`;

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const USER_ID = 'preview-user';

export const previewAvatars: Avatar[] = [
  {
    id: 'av-mila',
    userId: USER_ID,
    name: 'Mila',
    description: 'Mutige Entdeckerin mit einem Herz für Tiere und einer Tasche voller Fragen.',
    imageUrl: portrait('847c104b-f79e-44e2-891e-da2dbbd7c317.webp'),
    avatarRole: 'child',
    status: 'complete',
    config: { age: '7', appearance: 'Braune Haare, rosa Kleid', hobbies: 'Tiere, Malen, Höhlen erkunden' },
    narrativeProfile: {
      dominantPersonality: 'Neugierig und warmherzig',
      traits: ['neugierig', 'hilfsbereit', 'fantasievoll'],
      quirk: 'Sammelt glänzende Steine in ihrer Jackentasche',
      catchphrase: 'Das schauen wir uns genauer an!',
    },
    personalityTraits: {
      knowledge: {
        value: 64,
        subcategories: {
          biology: { value: 28, description: 'Hat gelernt, warum Glühwürmchen leuchten' },
          history: { value: 21, description: 'Hat die Burg von König Ottokar erforscht' },
          astronomy: { value: 15, description: 'Hat den Polarstern am Nachthimmel gefunden' },
        },
      },
      creativity: { value: 38 },
      vocabulary: { value: 22 },
      courage: { value: 47 },
      curiosity: { value: 58 },
      teamwork: { value: 31 },
      empathy: { value: 52 },
      persistence: { value: 19 },
      logic: { value: 12 },
    },
    createdAt: daysAgo(42),
    updatedAt: daysAgo(1),
  } as unknown as Avatar,
  {
    id: 'av-funki',
    userId: USER_ID,
    name: 'Funki',
    description: 'Ein kleiner Drache, der lieber Kekse backt als Feuer spuckt.',
    imageUrl: portrait('drache.webp'),
    avatarRole: 'companion',
    status: 'complete',
    personalityTraits: {
      knowledge: { value: 12, subcategories: { nature: { value: 12, description: 'Kennt jetzt alle Pilze im Zauberwald' } } },
      creativity: { value: 41 },
      courage: { value: 33 },
      curiosity: { value: 26 },
      teamwork: { value: 44 },
      empathy: { value: 37 },
    },
    createdAt: daysAgo(30),
    updatedAt: daysAgo(2),
  } as unknown as Avatar,
  {
    id: 'av-felix',
    userId: USER_ID,
    name: 'Felix Fuchs',
    description: 'Detektiv mit Spürnase. Kein Rätsel ist ihm zu knifflig.',
    imageUrl: portrait('detektive.webp'),
    avatarRole: 'companion',
    status: 'complete',
    personalityTraits: { logic: { value: 56 }, curiosity: { value: 49 }, persistence: { value: 31 }, vocabulary: { value: 18 } },
    createdAt: daysAgo(21),
    updatedAt: daysAgo(3),
  } as unknown as Avatar,
  {
    id: 'av-rosi',
    userId: USER_ID,
    name: 'Oma Rosi',
    description: 'Backt die besten Zimtschnecken im ganzen Tal und kennt jedes Märchen auswendig.',
    imageUrl: portrait('oma.webp'),
    avatarRole: 'companion',
    status: 'complete',
    isShared: true,
    personalityTraits: { empathy: { value: 61 }, vocabulary: { value: 40 }, teamwork: { value: 22 } },
    createdAt: daysAgo(12),
    updatedAt: daysAgo(4),
  } as unknown as Avatar,
  {
    id: 'av-gobbo',
    userId: USER_ID,
    name: 'Gobbo',
    description: 'Frecher Kobold mit einem Sack voller Murmeln.',
    imageUrl: portrait('goblin.webp'),
    avatarRole: 'companion',
    status: 'complete',
    personalityTraits: {},
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
  } as unknown as Avatar,
];

const chapterText = [
  `Der Wind trug den Duft von Salz und Abenteuer über die Klippen. Mila stand ganz vorne am Felsen und hielt ihre Laterne fest, als könnte sie damit die Nacht festhalten.

„Hörst du das?“, flüsterte sie. Funki legte den Kopf schief. Aus der Tiefe der Bucht stieg ein Ton auf, hell und zart, wie eine Melodie, die jemand vor langer Zeit vergessen hatte.

„Das ist die singende Muschel“, sagte Funki und seine kleinen Flügel zitterten. „Oma Rosi hat erzählt, dass sie nur in der Nacht der hundert Sterne singt.“

Mila zählte. Siebenundneunzig, achtundneunzig, neunundneunzig – und dann blitzte über dem Meer der hundertste Stern auf.`,
  `Der Pfad hinunter zur Bucht war schmal und rutschig. Funki leuchtete mit seinem Schwanz, der wie eine kleine Glut glomm, und Mila setzte jeden Schritt mit Bedacht.

Unten am Strand lag die Muschel, groß wie ein Wagenrad und schimmernd wie Perlmutt im Mondlicht. Doch sie war nicht allein: Ein alter Krebs mit einer Brille aus Seeglas bewachte sie.

„Wer die Muschel hören will, muss ihr zuerst etwas schenken“, knarzte er. „Etwas, das man nicht kaufen kann.“

Mila dachte nach. Dann griff sie in ihre Jackentasche und holte den glatten grünen Stein heraus, den sie im Sommer mit Opa gefunden hatte.`,
  `Als der Stein die Muschel berührte, wurde das Lied lauter. Es erzählte von Schiffen, die heimgefunden hatten, und von Kindern, die mutig genug gewesen waren, im Dunkeln zu fragen.

Funki schniefte. „Ich glaube, sie singt über uns“, sagte er leise.

Der alte Krebs nickte zufrieden. „Wer etwas Wertvolles teilt, dem schenkt das Meer ein Lied, das er nie vergisst.“

Auf dem Heimweg summte Mila die Melodie. Und als sie zu Hause ins Bett fiel, glaubte sie, ganz weit weg das Meer leise mitsingen zu hören.`,
];

export const previewStories: Story[] = [
  {
    id: 'st-muschel',
    userId: USER_ID,
    title: 'Das Geheimnis der singenden Muschel',
    summary: 'Mila und Funki folgen einer geheimnisvollen Melodie hinunter in die mondhelle Bucht.',
    config: { genre: 'adventure', style: 'warm', ageGroup: '6-8', avatars: [previewAvatars[0], previewAvatars[1]] as never },
    coverImageUrl: cover('reading-theater.webp'),
    estimatedReadingTime: 6,
    status: 'complete',
    isPublic: false,
    chapters: chapterText.map((content, index) => ({
      id: `st-muschel-${index}`,
      title: ['Die Nacht der hundert Sterne', 'Der Wächter der Bucht', 'Ein Lied für immer'][index],
      content,
      imageUrl: cover(['final-panorama.webp', 'audio-wave-garden.webp', 'hero-castle-island.webp'][index]),
      order: index,
    })),
    avatarDevelopments: [
      {
        avatarId: 'av-mila',
        changes: [
          { trait: 'courage', change: 3, description: 'Ist im Dunkeln den rutschigen Pfad zur Bucht hinuntergestiegen' },
          { trait: 'empathy', change: 2, description: 'Hat ihren Lieblingsstein verschenkt, um anderen ein Lied zu schenken' },
          { trait: 'knowledge.biology', change: 2, description: 'Hat gelernt, wie Muscheln im Meer wachsen' },
        ],
      },
      { avatarId: 'av-funki', changes: [{ trait: 'teamwork', change: 2, description: 'Hat Mila mit seinem Glutschwanz den Weg geleuchtet' }] },
    ],
    createdAt: daysAgo(1),
    updatedAt: daysAgo(0),
  } as unknown as Story,
  {
    id: 'st-burg',
    userId: USER_ID,
    title: 'Die schwebende Burg über den Wolken',
    summary: 'Ein Brief mit Siegel lädt Mila zum Fest der Wolkenkönigin ein.',
    config: { genre: 'fairy_tales', style: 'magic', ageGroup: '6-8' },
    coverImageUrl: cover('hero-castle-island.webp'),
    estimatedReadingTime: 8,
    status: 'complete',
    isPublic: false,
    createdAt: daysAgo(3),
    updatedAt: daysAgo(2),
  } as unknown as Story,
  {
    id: 'st-atelier',
    userId: USER_ID,
    title: 'Felix und das verschwundene Spiegelbild',
    summary: 'Im Spiegelsaal fehlt plötzlich ein Spiegelbild – ein Fall für Detektiv Felix.',
    config: { genre: 'magic', style: 'funny', ageGroup: '6-8' },
    coverImageUrl: cover('avatar-atelier-island.webp'),
    estimatedReadingTime: 7,
    status: 'complete',
    isPublic: false,
    createdAt: daysAgo(5),
    updatedAt: daysAgo(5),
  } as unknown as Story,
  {
    id: 'st-sterne',
    userId: USER_ID,
    title: 'Die Sternwarte am Ende der Welt',
    summary: 'Warum blinzeln Sterne? Funki baut ein Fernrohr aus Keksdosen.',
    config: { genre: 'scifi', style: 'curious', ageGroup: '6-8' },
    coverImageUrl: cover('doku-studio-island.webp'),
    estimatedReadingTime: 5,
    status: 'generating',
    isPublic: false,
    createdAt: daysAgo(0),
    updatedAt: daysAgo(0),
  } as unknown as Story,
  {
    id: 'st-karte',
    userId: USER_ID,
    title: 'Die Karte der tausend Inseln',
    summary: 'Eine alte Schatzkarte führt Oma Rosi und Mila von Insel zu Insel.',
    config: { genre: 'adventure', style: 'exciting', ageGroup: '6-8' },
    coverImageUrl: cover('journey-map.webp'),
    estimatedReadingTime: 9,
    status: 'complete',
    isPublic: false,
    createdAt: daysAgo(8),
    updatedAt: daysAgo(8),
  } as unknown as Story,
  {
    id: 'st-bibliothek',
    userId: USER_ID,
    title: 'Das flüsternde Bücherbaumhaus',
    summary: 'In der Bibliothek im Baum erzählen die Bücher nachts ihre eigenen Geschichten.',
    config: { genre: 'magic', style: 'warm', ageGroup: '6-8' },
    coverImageUrl: cover('quiz.webp'),
    estimatedReadingTime: 6,
    status: 'complete',
    isPublic: false,
    createdAt: daysAgo(11),
    updatedAt: daysAgo(11),
  } as unknown as Story,
  {
    id: 'st-nacht',
    userId: USER_ID,
    title: 'Mitternacht in Kicherwald',
    summary: 'Wer hat die goldene Uhr vom Marktplatz gestohlen?',
    config: { genre: 'modern', style: 'exciting', ageGroup: '6-8' },
    coverImageUrl: cover('alibi.webp'),
    estimatedReadingTime: 7,
    status: 'complete',
    isPublic: false,
    createdAt: daysAgo(14),
    updatedAt: daysAgo(14),
  } as unknown as Story,
];

const dokuSection = (title: string, content: string, image?: string) => ({
  title,
  content,
  keyFacts: [
    { title: 'Wusstest du?', fact: 'Manche Glühwürmchen blinken im Takt – ganze Wiesen leuchten dann gleichzeitig.' },
  ],
  imageUrl: image,
});

export const previewDokus: Doku[] = [
  {
    id: 'dk-gluehwuermchen',
    userId: USER_ID,
    title: 'Warum leuchten Glühwürmchen?',
    topic: 'Natur',
    summary: 'Ein kleines Licht mit großer Wirkung: So entsteht das Leuchten im Bauch der Käfer.',
    coverImageUrl: dokuArt('nature'),
    isPublic: false,
    status: 'complete',
    content: {
      sections: [
        dokuSection('Ein Licht ohne Wärme', 'Glühwürmchen erzeugen Licht durch eine chemische Reaktion in ihrem Hinterleib. Dabei entsteht fast keine Wärme – deshalb nennt man es kaltes Licht.', dokuArt('nature')),
        dokuSection('Leuchten als Sprache', 'Die Käfer blinken, um einander zu finden. Jede Art hat ihren eigenen Blinkrhythmus – wie ein Morsecode der Natur.'),
      ],
    },
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
  } as unknown as Doku,
  {
    id: 'dk-mars',
    userId: USER_ID,
    title: 'Die Reise zum roten Planeten',
    topic: 'Weltraum',
    summary: 'Wie lange dauert der Flug zum Mars – und was würden wir dort entdecken?',
    coverImageUrl: dokuArt('space'),
    isPublic: false,
    status: 'complete',
    createdAt: daysAgo(4),
    updatedAt: daysAgo(4),
  } as unknown as Doku,
  {
    id: 'dk-dinos',
    userId: USER_ID,
    title: 'Riesen der Urzeit',
    topic: 'Dinosaurier',
    summary: 'Vom winzigen Compsognathus bis zum gewaltigen Argentinosaurus.',
    coverImageUrl: dokuArt('dinosaurs'),
    isPublic: false,
    status: 'complete',
    createdAt: daysAgo(6),
    updatedAt: daysAgo(6),
  } as unknown as Doku,
  {
    id: 'dk-ozean',
    userId: USER_ID,
    title: 'Geheimnisse der Tiefsee',
    topic: 'Ozeane',
    summary: 'Leuchtende Fische, Riesenkalmare und Berge unter Wasser.',
    coverImageUrl: dokuArt('oceans'),
    isPublic: false,
    status: 'generating',
    createdAt: daysAgo(0),
    updatedAt: daysAgo(0),
  } as unknown as Doku,
  {
    id: 'dk-roboter',
    userId: USER_ID,
    title: 'Wie denken Roboter?',
    topic: 'Technik',
    summary: 'Sensoren, Programme und ein bisschen Mathe: So lernen Maschinen.',
    coverImageUrl: dokuArt('tech'),
    isPublic: false,
    status: 'complete',
    createdAt: daysAgo(9),
    updatedAt: daysAgo(9),
  } as unknown as Doku,
];

const previewMemories: AvatarMemory[] = [
  {
    id: 'mem-1',
    storyId: 'st-muschel',
    storyTitle: 'Das Geheimnis der singenden Muschel',
    experience: 'Mila hat im Dunkeln den Weg zur Bucht gefunden und ihren Lieblingsstein verschenkt.',
    summary: 'Hat im Dunkeln den Weg zur Bucht gefunden und ihren Lieblingsstein verschenkt.',
    emotionalImpact: 'positive',
    memoryTier: 'core',
    personalityChanges: [
      { trait: 'Mut', change: 3 },
      { trait: 'Empathie', change: 2 },
    ],
    createdAt: daysAgo(1),
  },
  {
    id: 'mem-2',
    storyId: 'st-burg',
    storyTitle: 'Die schwebende Burg über den Wolken',
    experience: 'Mila hat der Wolkenkönigin geholfen, die verlorene Krone zu finden.',
    summary: 'Hat der Wolkenkönigin geholfen, die verlorene Krone wiederzufinden.',
    emotionalImpact: 'positive',
    memoryTier: 'episodic',
    personalityChanges: [{ trait: 'Teamgeist', change: 2 }],
    createdAt: daysAgo(3),
  },
];

/** Seeds every query the main screens read, so they render without a backend. */
export function seedPreviewData(client: QueryClient) {
  // The app is German-first; preview what a German device shows.
  void i18n.changeLanguage('de');
  const profileId = null;
  client.setQueryData(queryKeys.avatars(profileId), previewAvatars);
  client.setQueryData(queryKeys.stories(profileId), previewStories);
  client.setQueryData(queryKeys.dokus(profileId), previewDokus);
  client.setQueryData(queryKeys.publicDokus(), previewDokus.slice(1));
  for (const avatar of previewAvatars) {
    client.setQueryData(queryKeys.avatar(avatar.id, profileId), avatar);
    client.setQueryData(queryKeys.avatarMemories(avatar.id), avatar.id === 'av-mila' ? previewMemories : []);
  }
  for (const story of previewStories) client.setQueryData(queryKeys.story(story.id, profileId), story);
  for (const doku of previewDokus) client.setQueryData(queryKeys.doku(doku.id, profileId), doku);
}
