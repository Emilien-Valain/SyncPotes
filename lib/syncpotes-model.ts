// Demo model for the SyncPotes front-end.
//
// Everything above the `deriveHeatmap` line is placeholder data that stands in
// for what the backend will eventually provide (per-person Busy blocks fetched
// from Google `freeBusy`, behind the Effect-TS IO boundary — see
// docs/adr/0001). `deriveHeatmap` is the pure "who is free per slot, filtered
// by Threshold" logic and is meant to survive that swap unchanged.

export type Mode = "google" | "manual";

export interface Person {
  name: string;
  initials: string;
  mode: Mode;
  organizer?: boolean;
}

export interface Day {
  dow: string;
  num: string;
}

export const DAYS: Day[] = [
  { dow: "mer", num: "19" },
  { dow: "jeu", num: "20" },
  { dow: "ven", num: "21" },
  { dow: "sam", num: "22" },
  { dow: "dim", num: "23" },
];

export const HOURS = [18, 19, 20, 21, 22];

export const PEOPLE: Person[] = [
  { name: "Marc", initials: "MA", mode: "google", organizer: true },
  { name: "Léa", initials: "LE", mode: "google" },
  { name: "Yanis", initials: "YA", mode: "google" },
  { name: "Chloé", initials: "CH", mode: "manual" },
  { name: "Sami", initials: "SA", mode: "manual" },
  { name: "Nadia", initials: "NA", mode: "google" },
];

// AV[dayIndex][hourIndex] = list of person indexes free in that slot.
export const AV: number[][][] = [
  [[0, 1], [0, 1, 3], [0, 1, 3], [0, 3], [3]],
  [[2], [0, 2], [0, 2, 4], [0, 2, 4], [2, 4]],
  [[1, 3], [0, 1, 2, 3], [0, 1, 2, 3, 4], [0, 1, 2, 3, 4], [1, 2, 4]],
  [[0, 4], [0, 3, 4], [1, 3, 4], [1, 3], [1]],
  [[0, 1, 2], [0, 1, 2, 3], [0, 2, 3], [2], []],
];

// Nadia (person index 5) is the "late joiner" who lights up extra slots.
export const NADIA: Record<string, 1> = {
  "1-3": 1, "2-2": 1, "2-3": 1, "2-4": 1, "4-1": 1, "4-2": 1,
};

export const SCREENS: [string, string][] = [
  ["create", "Créer"],
  ["share", "Partager"],
  ["join", "Rejoindre"],
  ["manual", "À la main"],
  ["heat", "Dispos"],
  ["people", "Participants"],
  ["empty", "En attente"],
  ["edge", "Pépins"],
];

export const label = (i: number): string => PEOPLE[i].name;

/** People currently in the poll (Nadia only once she has joined). */
export function participants(nadiaJoined: boolean): Person[] {
  return PEOPLE.filter((_, i) => i < 5 || nadiaJoined);
}

/** Person indexes free at a given day/hour, including Nadia once she joins. */
export function freeAt(di: number, hi: number, nadiaJoined: boolean): number[] {
  const ids = AV[di][hi].slice();
  if (nadiaJoined && NADIA[`${di}-${hi}`]) ids.push(5);
  return ids;
}

export interface Cell {
  key: string;
  di: number;
  hi: number;
  count: number;
  ids: number[];
  vis: boolean;
  lvl: number;
}

export interface HeatCellView {
  key: string;
  count: number | "";
  lvl: number;
  best: "0" | "1";
  names: { key: number; label: string }[];
  dots: { key: number }[];
}

export interface BestSlotView {
  key: string;
  lvl: number;
  hero: "0" | "1";
  rank: string;
  day: string;
  time: string;
  score: string;
  names: { key: number; label: string }[];
}

/**
 * Pure heatmap derivation: for a given Threshold K and participant count,
 * compute the visible grid, the "best slots", the legend numbers, and how
 * many slots are hidden below the Threshold. No React, no side effects.
 */
export function deriveHeatmap(K: number, nadiaJoined: boolean) {
  const parts = participants(nadiaJoined);

  const grid: Cell[][] = DAYS.map((_, di) =>
    HOURS.map((_, hi) => {
      const ids = freeAt(di, hi, nadiaJoined);
      const vis = ids.length >= K;
      return {
        key: `${di}-${hi}`,
        di,
        hi,
        count: ids.length,
        ids,
        vis,
        lvl: vis ? Math.min(5, ids.length) : 0,
      };
    }),
  );

  const flat = grid.flat();
  const visible = flat.filter((c) => c.vis);
  const maxC = Math.max(...visible.map((c) => c.count), 0);
  const hidden = flat.length - visible.length;

  const heatRows = DAYS.map((d, di) => ({
    key: d.num,
    dow: d.dow,
    num: d.num,
    cells: grid[di].map<HeatCellView>((c) => ({
      key: c.key,
      count: c.vis ? c.count : "",
      lvl: c.lvl,
      best: c.vis && c.count === maxC ? "1" : "0",
      names: c.vis ? c.ids.map((i) => ({ key: i, label: label(i) })) : [],
      dots: c.vis ? c.ids.map((i) => ({ key: i })) : [],
    })),
  }));

  const best: BestSlotView[] = visible
    .filter((c) => c.count === maxC)
    .slice(0, 3)
    .map((c, i) => ({
      key: c.key,
      lvl: c.lvl,
      hero: i === 0 ? "1" : "0",
      rank: i === 0 ? "Le meilleur créneau" : "Aussi bien",
      day: `${DAYS[c.di].dow} ${DAYS[c.di].num} août`,
      time: `${HOURS[c.hi]}:00`,
      score: `${c.count} libres sur ${parts.length}`,
      names: c.ids.map((i2) => ({ key: i2, label: label(i2) })),
    }));

  const revealAt = (k: number) => flat.filter((c) => c.count >= k).length;

  return { parts, grid, flat, visible, maxC, hidden, heatRows, best, revealAt };
}
