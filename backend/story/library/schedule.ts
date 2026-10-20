/** Weekly release slots in the series' time zone (pure; used by the API and the tests). */

import type { SeriesInfo } from "./types";

/** UTC instant of a wall-clock time in a time zone (Europe/Berlin switches between +1 and +2). */
export function zonedTime(year: number, month: number, day: number, hour: number, timeZone: string): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour));
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    .formatToParts(guess)
    .reduce<Record<string, number>>((acc, part) => (part.type === "literal" ? acc : { ...acc, [part.type]: Number(part.value) }), {});
  const shown = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute);
  return new Date(guess.getTime() - (shown - guess.getTime()));
}

/** The first release slot (weekday + hour, local time) strictly after `after`. */
export function nextReleaseSlot(cadence: SeriesInfo["releaseCadence"], after: Date): Date {
  for (let offset = 0; offset < 15; offset += 1) {
    const day = new Date(after.getTime() + offset * 86_400_000);
    const local = new Intl.DateTimeFormat("en-US", { timeZone: cadence.timezone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" })
      .formatToParts(day)
      .reduce<Record<string, string>>((acc, part) => ({ ...acc, [part.type]: part.value }), {});
    const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(local.weekday);
    if (weekday !== cadence.weekday) continue;
    const slot = zonedTime(Number(local.year), Number(local.month), Number(local.day), cadence.hourLocal, cadence.timezone);
    if (slot.getTime() > after.getTime()) return slot;
  }
  return new Date(after.getTime() + 7 * 86_400_000);
}
