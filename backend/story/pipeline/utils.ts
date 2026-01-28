import crypto from "crypto";
import { CATEGORY_ALIAS_MAP, STORY_CATEGORIES } from "./constants";

export function normalizeCategory(input?: string): string {
  if (!input) return "";
  const normalized = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (CATEGORY_ALIAS_MAP[normalized]) return CATEGORY_ALIAS_MAP[normalized];
  for (const category of STORY_CATEGORIES) {
    const key = category
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[_\-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (normalized === key) return category;
  }
  return input;
}

export function hashRequest(payload: unknown): string {
  const json = JSON.stringify(payload);
  return crypto.createHash("sha256").update(json).digest("hex");
}

export function normalizeNameKey(value?: string): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export interface SeededRandom {
  next: () => number;
  int: (min: number, max: number) => number;
  pick: <T>(items: T[]) => T;
  shuffle: <T>(items: T[]) => T[];
}

export function createSeededRandom(seed: number): SeededRandom {
  let state = seed >>> 0;
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
  return {
    next,
    int: (min, max) => {
      if (max <= min) return min;
      const val = next();
      return Math.floor(val * (max - min + 1)) + min;
    },
    pick: (items) => {
      if (items.length === 0) {
        throw new Error("Cannot pick from empty array");
      }
      const idx = Math.floor(next() * items.length);
      return items[idx];
    },
    shuffle: (items) => {
      const arr = [...items];
      for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
  };
}

export function titleCase(text: string): string {
  return text
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
