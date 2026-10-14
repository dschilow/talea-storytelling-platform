import React, { useId } from 'react';

import { cn } from '@/lib/utils';

/**
 * Talea navigation icons, drawn as inline SVG so they render with the first
 * paint: no network request, no lazy image, no swap from a fallback.
 *
 * Every glyph has two states, like SF Symbols: idle is an outline, active is a
 * solid silhouette in the same colour. Inner details (the heart door, the
 * avatar's face, the die's pips) are drawn as lines while idle and punched out
 * of the silhouette while active, so the icon stays readable on any background,
 * including the glass tab bar.
 */
export type NavIconName =
  | 'home'
  | 'stories'
  | 'avatars'
  | 'dokus'
  | 'game'
  | 'tavi'
  | 'notifications'
  | 'settings'
  | 'newStory';

interface Glyph {
  /** Silhouette: outlined while idle, filled while active. */
  body: React.ReactNode;
  /** Inner details: lines while idle, cut out of the filled body while active. */
  cutout?: React.ReactNode;
  /** Strokes outside the body that stay lines in both states (rays, handles, smoke). */
  lines?: React.ReactNode;
}

// Paths draw on a 24×24 grid. `h.01` with a round cap renders a dot as wide as the stroke.
const GLYPHS: Record<NavIconName, Glyph> = {
  home: {
    body: (
      <>
        <path d="M4.5 10.4 11 5a1.6 1.6 0 0 1 2 0l6.5 5.4v8.1a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2Z" />
        <path d="M16.4 7.8V5.3a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v4.2" />
      </>
    ),
    cutout: <path d="M12 17.6c-1.6-1.05-2.6-2.1-2.6-3.25a1.4 1.4 0 0 1 2.6-.7 1.4 1.4 0 0 1 2.6.7c0 1.15-1 2.2-2.6 3.25Z" />,
  },
  stories: {
    body: (
      <path d="M12 6.8C10.2 5.4 7.6 4.9 4.1 5.1a.9.9 0 0 0-.85.9v11.5a.9.9 0 0 0 .95.9c3.35-.15 5.85.4 7.8 1.8 1.95-1.4 4.45-1.95 7.8-1.8a.9.9 0 0 0 .95-.9V6a.9.9 0 0 0-.85-.9c-3.5-.2-6.1.3-7.9 1.7Z" />
    ),
    cutout: (
      <>
        <path d="M12 8.6v9.2" />
        <path d="M6.3 9.3c1.3 0 2.4.2 3.4.6M6.3 12.5c1.3 0 2.4.2 3.4.6M17.7 9.3c-1.3 0-2.4.2-3.4.6M17.7 12.5c-1.3 0-2.4.2-3.4.6" />
      </>
    ),
  },
  avatars: {
    body: (
      <>
        <circle cx="12" cy="9" r="4.4" />
        <path d="M4.85 20.3c.7-2.9 3.6-4.8 7.15-4.8s6.45 1.9 7.15 4.8a.75.75 0 0 1-.73.93H5.58a.75.75 0 0 1-.73-.93Z" />
      </>
    ),
    cutout: (
      <>
        <path d="M10.3 8.7h.01M13.7 8.7h.01" strokeWidth={2.2} />
        <path d="M10.5 10.9a2.1 2.1 0 0 0 3 0" />
      </>
    ),
  },
  dokus: {
    body: (
      <path d="M12 3.4a5.8 5.8 0 0 0-3.55 10.4c.7.55 1.1 1.35 1.1 2.25v.7h4.9v-.7c0-.9.4-1.7 1.1-2.25A5.8 5.8 0 0 0 12 3.4Z" />
    ),
    cutout: <path d="M9.2 8.6a3.1 3.1 0 0 1 2.2-2.1" />,
    lines: (
      <>
        <path d="M9.6 19.3h4.8M10.6 21.5h2.8" />
        <path d="M2.9 9.2h1.3M19.8 9.2h1.3M4.9 3.4l.9.9M19.1 3.4l-.9.9" />
      </>
    ),
  },
  game: {
    body: <rect x="4.6" y="4.6" width="14.8" height="14.8" rx="3.8" transform="rotate(-10 12 12)" />,
    cutout: (
      <g transform="rotate(-10 12 12)" strokeWidth={2.3}>
        <path d="M8.6 8.6h.01M15.4 8.6h.01M12 12h.01M8.6 15.4h.01M15.4 15.4h.01" />
      </g>
    ),
  },
  tavi: {
    body: (
      <>
        <path d="M4.6 15.1c0-2.3 3.15-3.85 7.15-3.85 2.35 0 4.25.5 5.6 1.4l3.3-2.15c.4-.25.85.2.6.6l-2.95 4.5c-1.3 1.95-3.65 3.05-6.6 3.05-3.95 0-7.1-1.2-7.1-3.55Z" />
        <path d="M9.3 11.5c0-1.4 1.1-2.45 2.45-2.45s2.45 1.05 2.45 2.45" />
        <path d="M9.6 18.5 8.9 20.6h5.7l-.7-2.1" />
      </>
    ),
    cutout: <path d="M7.4 14.5c.7-.95 1.85-1.5 3.2-1.65" />,
    lines: (
      <>
        <path d="M11.75 9.05V7.8" />
        <path d="M5.1 13.4c-1.9-.55-2.85.75-2.3 1.85.4.8 1.35 1.05 2.15.85" />
        <path d="M20.3 8.3c-1.15-.5-1.25-1.95-.2-2.55 1.05-.6.85-2.05-.4-2.55" />
      </>
    ),
  },
  notifications: {
    body: (
      <path d="M6.2 16.2V11a5.8 5.8 0 0 1 11.6 0v5.2l1.45 1.85a.6.6 0 0 1-.47.97H5.22a.6.6 0 0 1-.47-.97Z" />
    ),
    cutout: <path d="M9 10.4a3.2 3.2 0 0 1 1.8-2.45" />,
    lines: (
      <>
        <path d="M12 5.2V3.6" />
        <path d="M10 21a2.15 2.15 0 0 0 4 0" />
      </>
    ),
  },
  settings: {
    body: (
      <path d="M10.7 5.32L10.99 3.16L13.01 3.16L13.3 5.32A6.8 6.8 0 0 1 15.8 6.36L17.54 5.03L18.97 6.46L17.64 8.2A6.8 6.8 0 0 1 18.68 10.7L20.84 10.99L20.84 13.01L18.68 13.3A6.8 6.8 0 0 1 17.64 15.8L18.97 17.54L17.54 18.97L15.8 17.64A6.8 6.8 0 0 1 13.3 18.68L13.01 20.84L10.99 20.84L10.7 18.68A6.8 6.8 0 0 1 8.2 17.64L6.46 18.97L5.03 17.54L6.36 15.8A6.8 6.8 0 0 1 5.32 13.3L3.16 13.01L3.16 10.99L5.32 10.7A6.8 6.8 0 0 1 6.36 8.2L5.03 6.46L6.46 5.03L8.2 6.36A6.8 6.8 0 0 1 10.7 5.32Z" />
    ),
    cutout: <circle cx="12" cy="12" r="2.6" />,
  },
  newStory: {
    body: <path d="M19.8 4.2c-5.9 0-10.7 3.9-12 9.7l-.65 2.95 2.95-.65c5.8-1.3 9.7-6.1 9.7-12Z" />,
    lines: <path d="M4.2 19.8 13.6 10.4" />,
  },
};

interface NavIconProps {
  name: NavIconName;
  active?: boolean;
  className?: string;
  /** Line weight on the 24-unit grid; the default matches the app's lucide icons. */
  strokeWidth?: number;
}

export const NavIcon: React.FC<NavIconProps> = ({ name, active = false, className, strokeWidth = 1.8 }) => {
  const glyph = GLYPHS[name];
  // React ids contain characters that break `url(#…)` references in some browsers.
  const maskId = `talea-nav-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const transition = 'fill-opacity 180ms ease, opacity 180ms ease';

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cn('shrink-0', className)}
    >
      {glyph.cutout ? (
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
            <rect width="24" height="24" fill="#fff" />
            <g stroke="#000">{glyph.cutout}</g>
          </mask>
        </defs>
      ) : null}
      <g
        mask={active && glyph.cutout ? `url(#${maskId})` : undefined}
        style={{ fill: 'currentColor', fillOpacity: active ? 1 : 0, transition }}
      >
        {glyph.body}
      </g>
      {glyph.cutout ? <g style={{ opacity: active ? 0 : 1, transition }}>{glyph.cutout}</g> : null}
      {glyph.lines}
    </svg>
  );
};

export default NavIcon;
