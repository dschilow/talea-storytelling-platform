/**
 * CosmosAssetsRegistry.ts - Domain definitions & visual mapping
 *
 * Base MVP domains + dynamic domain extension for future growth.
 */

import type { CosmosDomain } from "./CosmosTypes";

export const COSMOS_DOMAINS: CosmosDomain[] = [
  {
    id: "nature",
    label: "Natur & Tiere",
    icon: "🌿",
    color: "#4ade80",
    emissiveColor: "#22c55e",
    orbitRadius: 5,
    orbitSpeed: 0.15,
    startAngle: 0,
  },
  {
    id: "space",
    label: "Weltraum",
    icon: "🚀",
    color: "#818cf8",
    emissiveColor: "#6366f1",
    orbitRadius: 7,
    orbitSpeed: 0.12,
    startAngle: Math.PI * 0.25,
  },
  {
    id: "history",
    label: "Geschichte & Kulturen",
    icon: "🏛️",
    color: "#f59e0b",
    emissiveColor: "#d97706",
    orbitRadius: 9,
    orbitSpeed: 0.1,
    startAngle: Math.PI * 0.5,
  },
  {
    id: "tech",
    label: "Technik & Erfindungen",
    icon: "⚙️",
    color: "#06b6d4",
    emissiveColor: "#0891b2",
    orbitRadius: 11,
    orbitSpeed: 0.08,
    startAngle: Math.PI * 0.75,
  },
  {
    id: "body",
    label: "Mensch & Körper",
    icon: "🫀",
    color: "#f472b6",
    emissiveColor: "#ec4899",
    orbitRadius: 13,
    orbitSpeed: 0.07,
    startAngle: Math.PI * 1.0,
  },
  {
    id: "earth",
    label: "Erde & Klima",
    icon: "🌍",
    color: "#34d399",
    emissiveColor: "#10b981",
    orbitRadius: 15,
    orbitSpeed: 0.06,
    startAngle: Math.PI * 1.25,
  },
  {
    id: "art",
    label: "Kunst & Musik",
    icon: "🎨",
    color: "#c084fc",
    emissiveColor: "#a855f7",
    orbitRadius: 17,
    orbitSpeed: 0.05,
    startAngle: Math.PI * 1.5,
  },
  {
    id: "logic",
    label: "Logik & Rätsel",
    icon: "🧩",
    color: "#fb923c",
    emissiveColor: "#f97316",
    orbitRadius: 19,
    orbitSpeed: 0.04,
    startAngle: Math.PI * 1.75,
  },
];

const EXTRA_ICONS = ["🪐", "🛰️", "🌌", "✨", "🧠", "🔬", "📡", "🌠"];

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function toTitleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function hslToHex(h: number, s: number, l: number): string {
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function buildDynamicDomain(id: string, index: number): CosmosDomain {
  const seed = hashString(id);
  const hue = seed % 360;
  const color = hslToHex(hue, 68, 0.58);
  const emissiveColor = hslToHex((hue + 18) % 360, 72, 0.5);
  const icon = EXTRA_ICONS[seed % EXTRA_ICONS.length];
  const orbitRadius = 21 + index * 2.2;
  const orbitSpeed = Math.max(0.02, 0.035 - index * 0.002);
  const startAngle = ((seed % 628) / 100) % (Math.PI * 2);

  return {
    id,
    label: toTitleCase(id),
    icon,
    color,
    emissiveColor,
    orbitRadius,
    orbitSpeed,
    startAngle,
  };
}

export function resolveCosmosDomains(domainIds?: string[]): CosmosDomain[] {
  const baseIds = new Set(COSMOS_DOMAINS.map((domain) => domain.id));
  const incoming = Array.from(new Set((domainIds || []).filter(Boolean)));
  const extras = incoming
    .filter((id) => !baseIds.has(id))
    .sort()
    .map((id, index) => buildDynamicDomain(id, index));

  return [...COSMOS_DOMAINS, ...extras];
}

export function getDomainById(id: string, domains: CosmosDomain[] = COSMOS_DOMAINS): CosmosDomain | undefined {
  return domains.find((domain) => domain.id === id);
}

export function getDomainColor(id: string, domains: CosmosDomain[] = COSMOS_DOMAINS): string {
  return getDomainById(id, domains)?.color ?? "#888888";
}
