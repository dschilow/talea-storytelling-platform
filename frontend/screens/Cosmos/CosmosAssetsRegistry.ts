/**
 * CosmosAssetsRegistry.ts - Domain definitions & visual mapping
 *
 * 8 Wissens-Domänen als Planeten im Kosmos.
 * Erweiterbar: Einfach neuen Eintrag hinzufügen.
 */

import type { CosmosDomain } from './CosmosTypes';

export const COSMOS_DOMAINS: CosmosDomain[] = [
  {
    id: 'nature',
    label: 'Natur & Tiere',
    icon: '🌿',
    color: '#4ade80',
    emissiveColor: '#22c55e',
    orbitRadius: 5,
    orbitSpeed: 0.15,
    startAngle: 0,
  },
  {
    id: 'space',
    label: 'Weltraum',
    icon: '🚀',
    color: '#818cf8',
    emissiveColor: '#6366f1',
    orbitRadius: 7,
    orbitSpeed: 0.12,
    startAngle: Math.PI * 0.25,
  },
  {
    id: 'history',
    label: 'Geschichte & Kulturen',
    icon: '🏛️',
    color: '#f59e0b',
    emissiveColor: '#d97706',
    orbitRadius: 9,
    orbitSpeed: 0.1,
    startAngle: Math.PI * 0.5,
  },
  {
    id: 'tech',
    label: 'Technik & Erfindungen',
    icon: '⚙️',
    color: '#06b6d4',
    emissiveColor: '#0891b2',
    orbitRadius: 11,
    orbitSpeed: 0.08,
    startAngle: Math.PI * 0.75,
  },
  {
    id: 'body',
    label: 'Mensch & Körper',
    icon: '🫀',
    color: '#f472b6',
    emissiveColor: '#ec4899',
    orbitRadius: 13,
    orbitSpeed: 0.07,
    startAngle: Math.PI * 1.0,
  },
  {
    id: 'earth',
    label: 'Erde & Klima',
    icon: '🌍',
    color: '#34d399',
    emissiveColor: '#10b981',
    orbitRadius: 15,
    orbitSpeed: 0.06,
    startAngle: Math.PI * 1.25,
  },
  {
    id: 'art',
    label: 'Kunst & Musik',
    icon: '🎨',
    color: '#c084fc',
    emissiveColor: '#a855f7',
    orbitRadius: 17,
    orbitSpeed: 0.05,
    startAngle: Math.PI * 1.5,
  },
  {
    id: 'logic',
    label: 'Logik & Rätsel',
    icon: '🧩',
    color: '#fb923c',
    emissiveColor: '#f97316',
    orbitRadius: 19,
    orbitSpeed: 0.04,
    startAngle: Math.PI * 1.75,
  },
];

export function getDomainById(id: string): CosmosDomain | undefined {
  return COSMOS_DOMAINS.find(d => d.id === id);
}

export function getDomainColor(id: string): string {
  return getDomainById(id)?.color ?? '#888888';
}
