import type { PollDTO } from "../api-types";
import { pollHours } from "../heatmap";
import type { BusyInterval } from "./google";

// Grid slots are wall-clock hours in the Poll's timezone; Google returns busy
// intervals as absolute instants. To compare them we convert each slot's
// wall-clock start/end into an absolute UTC instant, DST included.

function offsetMs(timeZone: string, instantMs: number): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(new Date(instantMs))) p[part.type] = part.value;
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUTC - instantMs;
}

/** Absolute UTC ms for a wall-clock time in `timeZone` (handles DST). */
export function zonedToUtcMs(
  timeZone: string,
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
): number {
  const guess = Date.UTC(year, month - 1, day, hour, 0, 0);
  const off = offsetMs(timeZone, guess);
  let utc = guess - off;
  const off2 = offsetMs(timeZone, utc);
  if (off2 !== off) utc = guess - off2;
  return utc;
}

function slotBoundsMs(poll: PollDTO, dateISO: string, hour: number): [number, number] {
  const [y, m, d] = dateISO.split("-").map(Number);
  return [zonedToUtcMs(poll.timezone, y, m, d, hour), zonedToUtcMs(poll.timezone, y, m, d, hour + 1)];
}

/** [timeMin, timeMax] ISO strings spanning the whole Poll window. */
export function pollWindowUtc(poll: PollDTO): [string, string] {
  const first = poll.dates[0];
  const last = poll.dates[poll.dates.length - 1];
  const [minMs] = slotBoundsMs(poll, first, poll.dayStartHour);
  const [, maxMs] = slotBoundsMs(poll, last, poll.dayEndHour - 1);
  return [new Date(minMs).toISOString(), new Date(maxMs).toISOString()];
}

/** Set of free "di-hi" keys: a slot is free when no busy interval overlaps it. */
export function busyToFreeSet(poll: PollDTO, busy: BusyInterval[]): Set<string> {
  const ranges = busy.map((b) => [Date.parse(b.start), Date.parse(b.end)] as const);
  const hours = pollHours(poll);
  const free = new Set<string>();
  poll.dates.forEach((date, di) => {
    hours.forEach((hour, hi) => {
      const [start, end] = slotBoundsMs(poll, date, hour);
      const busyHere = ranges.some(([bs, be]) => bs < end && be > start);
      if (!busyHere) free.add(`${di}-${hi}`);
    });
  });
  return free;
}
