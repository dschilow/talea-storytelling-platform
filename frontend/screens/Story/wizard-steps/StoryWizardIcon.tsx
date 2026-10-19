import React, { useId } from 'react';

import { cn } from '@/lib/utils';

/**
 * Picture language of the story wizard, drawn as inline SVG: it paints with the
 * first frame (no signed image URL, no lazy load) and stays sharp at any size.
 *
 * Every glyph is two-tone on a 48×48 grid: the silhouette gets a soft tint of the
 * current colour plus an outline, details are lines, small accents are solid.
 * The colour comes from CSS `color`, so one glyph works on every tile and in
 * both themes. A child who cannot read yet picks by picture; the word below the
 * picture is for everyone else.
 */
export type StoryWizardIconName =
  // Worlds (mainCategory)
  | 'castle'
  | 'mountain'
  | 'wand'
  | 'fox'
  | 'rocket'
  | 'house'
  // Length
  | 'books1'
  | 'books2'
  | 'books3'
  // Feelings
  | 'laugh'
  | 'heartFace'
  | 'wow'
  | 'zany'
  | 'think'
  // Wishes
  | 'notes'
  | 'owl'
  | 'medal'
  | 'frogKing'
  | 'rainbow'
  | 'gift'
  // Learning
  | 'backpack'
  | 'calculator'
  | 'flask'
  | 'speech'
  | 'pyramid'
  | 'map'
  | 'friends'
  // Wizard chrome
  | 'people'
  | 'globe'
  | 'smile'
  | 'shootingStar'
  | 'sparkles'
  | 'sliders'
  | 'pencil'
  | 'gem'
  | 'openBook'
  | 'picture'
  | 'magnifier'
  | 'compass'
  | 'moon';

interface Glyph {
  /** Silhouette: tinted fill plus outline. */
  body?: React.ReactNode;
  /** Details drawn as lines on top of the silhouette. */
  line?: React.ReactNode;
  /** Small solid accents (eyes, flames, pins). */
  solid?: React.ReactNode;
  /** Shapes punched out of the solid accents (a pin's hole, a mouth's tongue). */
  cutout?: React.ReactNode;
}

/** A four-point twinkle with concave sides, centred on (cx, cy). */
function twinkle(cx: number, cy: number, r: number): string {
  const k = r * 0.2;
  return `M${cx} ${cy - r}Q${cx + k} ${cy - k} ${cx + r} ${cy}Q${cx + k} ${cy + k} ${cx} ${cy + r}Q${cx - k} ${cy + k} ${cx - r} ${cy}Q${cx - k} ${cy - k} ${cx} ${cy - r}Z`;
}

/** A five-point star centred on (cx, cy). */
function star(cx: number, cy: number, outer: number, inner = outer * 0.45): string {
  const points: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    points.push(`${(cx + radius * Math.cos(angle)).toFixed(2)} ${(cy + radius * Math.sin(angle)).toFixed(2)}`);
  }
  return `M${points.join('L')}Z`;
}

/** Books lying on top of each other, centred; the pile grows with the story. */
const bookStack = (count: 1 | 2 | 3) => {
  const height = 10;
  const top = 24 - (count * height) / 2;
  const books = [
    { x: 6, w: 36 },
    { x: 9.5, w: 31 },
    { x: 7.5, w: 32 },
  ]
    .slice(0, count)
    .map((book, index) => ({ ...book, y: top + (count - 1 - index) * height }));
  return {
    body: books.map((book) => <rect key={book.x} x={book.x} y={book.y} width={book.w} height={height} rx={2.2} />),
    // A band on the spine and the page block on the other end make a bar read as a book.
    line: books.map((book) => (
      <path
        key={book.x}
        d={`M${book.x + 6} ${book.y}v${height}M${book.x + book.w - 9} ${book.y + 3.4}h6M${book.x + book.w - 9} ${book.y + 6.6}h6`}
      />
    )),
  };
};

const GLYPHS: Record<StoryWizardIconName, Glyph> = {
  castle: {
    body: (
      <>
        <path d="M6 42V22h11v20Z" />
        <path d="M31 42V22h11v20Z" />
        <path d="M17 42V15h14v27Z" />
        <path d="M4.5 22 11.5 12 17 22Z" />
        <path d="M31 22 36.5 12 43.5 22Z" />
        <path d="M15.5 15 24 4 32.5 15Z" />
      </>
    ),
    line: <path d="M20.5 42v-6a3.5 3.5 0 0 1 7 0v6" />,
    solid: (
      <>
        <circle cx="11.5" cy="29.5" r="1.9" />
        <circle cx="36.5" cy="29.5" r="1.9" />
        <rect x="22.2" y="20" width="3.6" height="5.4" rx="1.8" />
      </>
    ),
  },
  mountain: {
    body: <path d="M3 41 18.5 13l7.5 12.5 5-7L45 41Z" />,
    line: (
      <>
        <path d="m13.6 21.8 2.6 2 2.3-2.3 2.3 2.3 1.9-1.6" />
        <path d="M18.5 13V3.5" />
      </>
    ),
    solid: <path d="M18.5 3.5h8.2l-2.2 2.9 2.2 2.9h-8.2Z" />,
  },
  wand: {
    body: (
      <>
        <rect x="0" y="-2.7" width="25" height="5.4" rx="2.7" transform="translate(7 40.5) rotate(-45)" />
        <path d={star(33, 15, 9)} />
      </>
    ),
    line: <path d="M0 -2.7v5.4" transform="translate(7 40.5) rotate(-45) translate(17 0)" />,
    solid: (
      <>
        <path d={twinkle(10.5, 12, 4.2)} />
        <path d={twinkle(40, 33, 3.4)} />
      </>
    ),
  },
  fox: {
    body: (
      <path d="M8.5 5.5 19 13q5-1.4 10 0l10.5-7.5q1.4 9-.9 14.6l4.4 5.6Q33.5 35 24 42 14.5 35 5 25.7l4.4-5.6Q7.1 14.5 8.5 5.5Z" />
    ),
    line: (
      <>
        <path d="M11.5 11.5 15 14.6M36.5 11.5 33 14.6" />
        <path d="M9.5 26.6q7.4.4 10.5 6M38.5 26.6q-7.4.4-10.5 6" />
      </>
    ),
    solid: (
      <>
        <ellipse cx="17.5" cy="22.2" rx="2" ry="2.4" />
        <ellipse cx="30.5" cy="22.2" rx="2" ry="2.4" />
        <path d="M21.4 34.6h5.2L24 37.9Z" />
      </>
    ),
  },
  rocket: {
    body: (
      <>
        <path d="M16.2 24.5 9 32v5.5l7.4-3.4Z" />
        <path d="M31.8 24.5 39 32v5.5l-7.4-3.4Z" />
        <path d="M24 4c6.6 4.6 9 13.4 8 27H16c-1-13.6 1.4-22.4 8-27Z" />
      </>
    ),
    line: (
      <>
        <circle cx="24" cy="17" r="3.8" />
        <path d="M19 31v3h10v-3" />
      </>
    ),
    solid: (
      <>
        <path d="M20.6 36.5c0 3.6 1.4 6 3.4 8 2-2 3.4-4.4 3.4-8Z" />
        <circle cx="7.5" cy="12" r="1.5" />
        <circle cx="41" cy="16" r="1.5" />
        <circle cx="38" cy="6.5" r="1.1" />
      </>
    ),
  },
  house: {
    body: (
      <>
        <path d="M31 12.6V7.5h5v9.4" />
        <path d="M9.5 21.5v18.5a2 2 0 0 0 2 2h25a2 2 0 0 0 2-2V21.5" />
        <path d="M5 23.5 24 6.5l19 17" />
      </>
    ),
    line: (
      <>
        <path d="M14.5 42v-9.5a3.5 3.5 0 0 1 7 0V42" />
        <rect x="27" y="28" width="8" height="7.5" rx="1.5" />
        <path d="M31 28v7.5M27 31.75h8" />
      </>
    ),
  },
  books1: bookStack(1),
  books2: bookStack(2),
  books3: bookStack(3),
  laugh: {
    body: <circle cx="24" cy="24" r="18" />,
    line: <path d="M14.8 20.5q3.1-3.8 6.2 0M27 20.5q3.1-3.8 6.2 0" />,
    solid: <path d="M14.5 26.5h19a9.5 9.5 0 0 1-19 0Z" />,
    cutout: <path d="M19.5 33.6a6.5 4 0 0 1 9 0" strokeWidth={2.4} />,
  },
  heartFace: {
    body: (
      <path d="M24 42C10 33 5 25.5 5 17.5 5 11.6 9.4 7 15 7c3.8 0 7 2.2 9 5.6C26 9.2 29.2 7 33 7c5.6 0 10 4.6 10 10.5C43 25.5 38 33 24 42Z" />
    ),
    line: <path d="M14.8 19.5q2.6 2.8 5.2 0M28 19.5q2.6 2.8 5.2 0M19.5 26q4.5 4.4 9 0" />,
    solid: (
      <>
        <circle cx="13.5" cy="25" r="1.8" opacity={0.5} />
        <circle cx="34.5" cy="25" r="1.8" opacity={0.5} />
      </>
    ),
  },
  wow: {
    body: <circle cx="24" cy="25" r="17.5" />,
    line: (
      <>
        <circle cx="17.5" cy="22" r="4" />
        <circle cx="30.5" cy="22" r="4" />
        <path d="M13 14.5l5.2-2M35 14.5l-5.2-2" />
        <path d="M6 7.5 8.8 10.8M24 2.5v3.2M42 7.5l-2.8 3.3" />
      </>
    ),
    solid: (
      <>
        <circle cx="17.5" cy="22.4" r="1.8" />
        <circle cx="30.5" cy="22.4" r="1.8" />
        <ellipse cx="24" cy="33" rx="3.4" ry="4.2" />
      </>
    ),
  },
  zany: {
    body: (
      <>
        <circle cx="24" cy="24" r="18" />
        <path d="M27.4 31.2v4.6a3.3 3.3 0 0 0 6.6 0V29" />
      </>
    ),
    line: (
      <>
        <circle cx="16.5" cy="19.5" r="4.6" />
        <path d="M13.6 28c5.2 5.4 14.8 5.6 20.6-.4" />
      </>
    ),
    solid: (
      <>
        <circle cx="17.6" cy="20.6" r="2" />
        <circle cx="31.2" cy="19" r="2.2" />
      </>
    ),
  },
  // Eyes up towards a thought cloud: "zum Nachdenken".
  think: {
    body: (
      <>
        <circle cx="20" cy="28.5" r="14" />
        <path d="M32 13.2a4.2 4.2 0 0 1 1.6-7.6 5.2 5.2 0 0 1 9.6.4 3.9 3.9 0 0 1 .2 7.6Z" />
      </>
    ),
    line: (
      <>
        <path d="M12.8 21.4q2.2-1.7 4.6-.7M21.8 20.7q2.2-1.7 4.6-.7" />
        <path d="M15.6 35q3.6 2 7.4.2" />
      </>
    ),
    solid: (
      <>
        <circle cx="16.6" cy="25" r="2" />
        <circle cx="25.4" cy="25" r="2" />
        <circle cx="31.4" cy="17.4" r="1.6" />
      </>
    ),
  },
  notes: {
    body: (
      <>
        <ellipse cx="13.5" cy="37" rx="5.5" ry="4.3" transform="rotate(-20 13.5 37)" />
        <ellipse cx="33.5" cy="32.5" rx="5.5" ry="4.3" transform="rotate(-20 33.5 32.5)" />
      </>
    ),
    line: <path d="M18.6 35.4V12.5M38.6 30.9V8" />,
    solid: <path d="M17.3 9.5 39.9 4.5v7.4L17.3 17Z" />,
  },
  owl: {
    body: (
      <path d="M9.5 5 17 9.6q7-2.5 14 0L38.5 5q1.1 7.5 0 13.5V29c0 8.5-6 13-14.5 13S9.5 37.5 9.5 29V18.5Q8.4 12.5 9.5 5Z" />
    ),
    line: (
      <>
        <circle cx="18" cy="20" r="5" />
        <circle cx="30" cy="20" r="5" />
        <path d="M18.5 34q2.75 2.2 5.5 0 2.75 2.2 5.5 0" />
      </>
    ),
    solid: (
      <>
        <circle cx="18" cy="20.4" r="2.2" />
        <circle cx="30" cy="20.4" r="2.2" />
        <path d="M21.9 25.6h4.2L24 29.2Z" />
      </>
    ),
  },
  medal: {
    body: (
      <>
        <path d="M13.5 4h7.4l5.4 13h-7.4Z" />
        <path d="M34.5 4h-7.4l-5.4 13h7.4Z" />
        <circle cx="24" cy="29.5" r="12.5" />
      </>
    ),
    solid: <path d={star(24, 29.8, 7)} />,
  },
  // The frog king: bulging eyes on a wide head, a small crown between them.
  frogKing: {
    body: (
      <>
        <ellipse cx="24" cy="30.5" rx="19" ry="11" />
        <circle cx="13.6" cy="19.5" r="6.3" />
        <circle cx="34.4" cy="19.5" r="6.3" />
        <path d="m20.8 13-.6-7.3 2.5 2.4L24 4.1l1.3 4 2.5-2.4-.6 7.3Z" />
      </>
    ),
    line: <path d="M12.5 31q11.5 7.5 23 0" />,
    solid: (
      <>
        <circle cx="13.6" cy="20.1" r="2.7" />
        <circle cx="34.4" cy="20.1" r="2.7" />
        <circle cx="21.6" cy="26.4" r="1" />
        <circle cx="26.4" cy="26.4" r="1" />
      </>
    ),
  },
  rainbow: {
    body: <path d="M5 34a19 19 0 0 1 38 0h-8.5a10.5 10.5 0 0 0-21 0Z" />,
    line: <path d="M9.3 34a14.7 14.7 0 0 1 29.4 0" />,
    solid: (
      <>
        <path d="M3 41.5h11.3a3.6 3.6 0 0 0 .2-7.2 4.7 4.7 0 0 0-8.7-.8A4 4 0 0 0 3 41.5Z" />
        <path d="M45 41.5H33.7a3.6 3.6 0 0 1-.2-7.2 4.7 4.7 0 0 1 8.7-.8 4 4 0 0 1 2.8 8Z" />
      </>
    ),
  },
  gift: {
    body: (
      <>
        <rect x="10" y="26" width="28" height="16" rx="2" />
        <rect x="7" y="18.5" width="34" height="7.5" rx="2" />
        <path d="M24 18.5c-3-7.5-11-8.5-11.2-3.6-.1 2.6 3.4 3.6 11.2 3.6Z" />
        <path d="M24 18.5c3-7.5 11-8.5 11.2-3.6.1 2.6-3.4 3.6-11.2 3.6Z" />
      </>
    ),
    line: (
      <>
        <path d="M24 18.5V42" />
        <path d="M39.5 9.5 42 6M42.5 14.5l3.4-1.2M6 9.5 3.5 6" />
      </>
    ),
  },
  backpack: {
    body: (
      <>
        <rect x="9.5" y="12" width="29" height="30" rx="7.5" />
        <path d="M9.5 23V19.5A7.5 7.5 0 0 1 17 12h14a7.5 7.5 0 0 1 7.5 7.5V23Z" />
      </>
    ),
    line: (
      <>
        <path d="M19 12V9a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3" />
        <rect x="16" y="29" width="16" height="8.5" rx="2.5" />
      </>
    ),
    solid: <rect x="21.5" y="21" width="5" height="4.5" rx="1.4" />,
  },
  calculator: {
    body: <rect x="10.5" y="4.5" width="27" height="39" rx="4.5" />,
    line: <rect x="15" y="9" width="18" height="8" rx="1.8" />,
    solid: (
      <>
        {[17.5, 24, 30.5].flatMap((x) =>
          [24.5, 31, 37.5].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.9} />)
        )}
      </>
    ),
  },
  flask: {
    body: <path d="M20.5 5.5V17L10.3 36.5a3.6 3.6 0 0 0 3.2 5.3h21a3.6 3.6 0 0 0 3.2-5.3L27.5 17V5.5Z" />,
    line: (
      <>
        <path d="M18 5.5h12" />
        <path d="M14.6 29h18.8" />
      </>
    ),
    solid: (
      <>
        <circle cx="21" cy="35.5" r="1.9" />
        <circle cx="27.4" cy="33" r="1.4" />
        <circle cx="34.5" cy="10" r="1.6" />
        <circle cx="38.5" cy="4.8" r="1.1" />
      </>
    ),
  },
  speech: {
    body: <path d="M9 7h30a4 4 0 0 1 4 4v19a4 4 0 0 1-4 4H21l-8.5 7.5V34H9a4 4 0 0 1-4-4V11a4 4 0 0 1 4-4Z" />,
    line: <path d="m17.5 28 6.5-15 6.5 15M20 22.5h8" />,
  },
  pyramid: {
    body: <path d="M3.5 41 22 12l18.5 29Z" />,
    line: <path d="m22 12 5.5 29M6.5 41h37" />,
    solid: <circle cx="38" cy="11" r="4.2" />,
  },
  map: {
    body: <path d="M5 12.5 16 8.5l16 4 11-4V36l-11 4-16-4-11 4Z" />,
    line: <path d="M16 8.5V36M32 12.5V40" />,
    solid: <path d="M24 32s-7-6.6-7-12a7 7 0 0 1 14 0c0 5.4-7 12-7 12Z" />,
    cutout: <circle cx="24" cy="19.8" r="2.4" fill="#000" stroke="none" />,
  },
  friends: {
    body: (
      <>
        <circle cx="14.5" cy="18" r="5" />
        <circle cx="33.5" cy="18" r="5" />
        <path d="M4.5 41c0-7.2 4.4-12 10-12s10 4.8 10 12Z" />
        <path d="M23.5 41c0-7.2 4.4-12 10-12s10 4.8 10 12Z" />
      </>
    ),
    solid: (
      <path d="M24 13.4c-3.4-2.2-5-4-5-5.8a2.5 2.5 0 0 1 5-1.1 2.5 2.5 0 0 1 5 1.1c0 1.8-1.6 3.6-5 5.8Z" />
    ),
  },
  people: {
    body: (
      <>
        <circle cx="31.5" cy="15" r="5.5" />
        <path d="M21.5 40c0-7.5 4.5-12.5 10-12.5s10 5 10 12.5Z" />
        <circle cx="16" cy="17.5" r="6.2" />
        <path d="M4.5 41c0-8.2 5-13.8 11.5-13.8S27.5 32.8 27.5 41Z" />
      </>
    ),
  },
  globe: {
    body: <circle cx="24" cy="24" r="18" />,
    line: (
      <>
        <path d="M24 6c-4.6 4.8-7 10.8-7 18s2.4 13.2 7 18M24 6c4.6 4.8 7 10.8 7 18s-2.4 13.2-7 18" />
        <path d="M7 18h34M7 30h34" />
      </>
    ),
  },
  smile: {
    body: <circle cx="24" cy="24" r="18" />,
    line: <path d="M16.5 28q7.5 7 15 0" />,
    solid: (
      <>
        <circle cx="18" cy="19.5" r="2.3" />
        <circle cx="30" cy="19.5" r="2.3" />
      </>
    ),
  },
  shootingStar: {
    body: <path d={star(31, 17, 11.5)} />,
    line: <path d="M20.5 27.5 6 42M15 22.5 8 26M26 33l-3.5 7.5" />,
  },
  sparkles: {
    body: <path d={twinkle(19, 27, 14)} />,
    solid: (
      <>
        <path d={twinkle(36.5, 11.5, 7)} />
        <path d={twinkle(38, 36, 4.5)} />
      </>
    ),
  },
  sliders: {
    body: (
      <>
        <circle cx="17" cy="15" r="4.8" />
        <circle cx="31" cy="33" r="4.8" />
      </>
    ),
    line: <path d="M6 15h6.2M21.8 15H42M6 33h20.2M35.8 33H42" />,
  },
  pencil: {
    body: <path d="M33 6.5 41.5 15 17.5 39 6 42l3-11.5Z" />,
    line: <path d="m28 11.5 8.5 8.5M9 30.5l8.5 8.5" />,
    solid: <path d="m6 42 1.4-5.8 4.4 4.4Z" />,
  },
  gem: {
    body: <path d="M14 8h20l8 10.5L24 42 6 18.5Z" />,
    line: <path d="M6 18.5h36M18.5 18.5 24 8l5.5 10.5M18.5 18.5 24 42l5.5-23.5" />,
  },
  openBook: {
    body: (
      <>
        <path d="M24 12.5C19.5 9 13 8 5.5 8.5v28.5c7.5-.5 14 .6 18.5 4Z" />
        <path d="M24 12.5C28.5 9 35 8 42.5 8.5v28.5c-7.5-.5-14 .6-18.5 4Z" />
      </>
    ),
    line: <path d="M10.5 16.5c3.4 0 6.4.5 9 1.6M10.5 23.5c3.4 0 6.4.5 9 1.6M37.5 16.5c-3.4 0-6.4.5-9 1.6M37.5 23.5c-3.4 0-6.4.5-9 1.6" />,
  },
  picture: {
    body: <rect x="5" y="8.5" width="38" height="31" rx="4.5" />,
    line: <path d="m5.5 34 11.5-11.5 9 9 5-5 11.5 11" />,
    solid: <circle cx="33" cy="17.5" r="3.6" />,
  },
  magnifier: {
    body: (
      <>
        <rect x="0" y="-3.2" width="15" height="6.4" rx="3.2" transform="translate(29.3 29.3) rotate(45)" />
        <circle cx="20.5" cy="20.5" r="13" />
      </>
    ),
    line: <path d="M16.6 17.2a4 4 0 1 1 5.8 3.6c-1.2.6-1.9 1.5-1.9 2.7v.5" />,
    solid: <circle cx="20.5" cy="27.6" r="1.7" />,
  },
  compass: {
    body: <circle cx="24" cy="24" r="18" />,
    line: (
      <>
        <path d="m19.6 24 4.4 13.5 4.4-13.5" />
        <path d="M24 6v3M42 24h-3M24 42v-3M6 24h3" />
      </>
    ),
    solid: <path d="m24 10.5 4.4 13.5h-8.8Z" />,
  },
  moon: {
    body: <path d="M27 7a17 17 0 1 0 14.6 25.8A13.8 13.8 0 0 1 27 7Z" />,
    solid: (
      <>
        <path d={twinkle(38, 11, 4.4)} />
        <path d={twinkle(30.5, 21, 2.6)} />
      </>
    ),
  },
};

export const STORY_WIZARD_ICON_NAMES = Object.keys(GLYPHS) as StoryWizardIconName[];

interface StoryWizardIconProps {
  name: StoryWizardIconName;
  className?: string;
  style?: React.CSSProperties;
  /** Tint strength of the silhouette; selected tiles use a stronger tint. */
  tint?: number;
  /** Line weight on the 48-unit grid. */
  strokeWidth?: number;
}

export const StoryWizardIcon: React.FC<StoryWizardIconProps> = ({
  name,
  className,
  style,
  tint = 0.22,
  strokeWidth = 2.6,
}) => {
  const glyph = GLYPHS[name];
  // React ids contain characters that break `url(#…)` references in some browsers.
  const maskId = `talea-wiz-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cn('shrink-0', className)}
      style={style}
    >
      {glyph.cutout ? (
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
            <rect width="48" height="48" fill="#fff" />
            <g stroke="#000" fill="#000">{glyph.cutout}</g>
          </mask>
        </defs>
      ) : null}
      {/* One group opacity, so overlapping silhouettes never stack into darker patches. */}
      {glyph.body ? (
        <g fill="currentColor" stroke="none" opacity={tint} style={{ transition: 'opacity 180ms ease' }}>
          {glyph.body}
        </g>
      ) : null}
      {glyph.body}
      {glyph.line}
      {glyph.solid ? (
        <g fill="currentColor" stroke="none" mask={glyph.cutout ? `url(#${maskId})` : undefined}>
          {glyph.solid}
        </g>
      ) : null}
    </svg>
  );
};

export default StoryWizardIcon;
