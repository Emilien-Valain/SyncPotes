import type {
  BestSlotDTO,
  HeatCellDTO,
  HeatmapDTO,
  HeatRowDTO,
  ParticipantMode,
  PollDTO,
  SlotNameDTO,
} from "./api-types";

// Server-side counterpart of lib/syncpotes-model.ts#deriveHeatmap, but pure over
// real data: given each participant's set of free "di-hi" slots and a Threshold,
// compute the visible grid, best slots, and hidden count. No React, no DB — this
// is the algorithm both the demo and the backend agree on.

export interface HeatParticipant {
  id: string;
  name: string;
  mode: ParticipantMode;
  free: Set<string>; // keys of the form `${di}-${hi}`
}

export function pollHours(poll: Pick<PollDTO, "dayStartHour" | "dayEndHour">): number[] {
  const hours: number[] = [];
  for (let h = poll.dayStartHour; h < poll.dayEndHour; h++) hours.push(h);
  return hours;
}

export function computeHeatmap(
  poll: PollDTO,
  participants: HeatParticipant[],
  threshold: number,
): HeatmapDTO {
  const hours = pollHours(poll);
  const K = Math.max(1, threshold);

  interface Slot {
    di: number;
    hi: number;
    ids: SlotNameDTO[];
    vis: boolean;
  }

  const slots: Slot[][] = poll.dates.map((_, di) =>
    hours.map((_, hi) => {
      const key = `${di}-${hi}`;
      const ids = participants
        .filter((p) => p.free.has(key))
        .map<SlotNameDTO>((p) => ({ id: p.id, name: p.name, mode: p.mode }));
      return { di, hi, ids, vis: ids.length >= K };
    }),
  );

  const flat = slots.flat();
  const visible = flat.filter((s) => s.vis);
  const maxCount = Math.max(0, ...visible.map((s) => s.ids.length));
  const hidden = flat.length - visible.length;

  const rows: HeatRowDTO[] = poll.dates.map((date, di) => ({
    date,
    cells: slots[di].map<HeatCellDTO>((s) => ({
      di: s.di,
      hi: s.hi,
      count: s.vis ? s.ids.length : 0,
      lvl: s.vis ? Math.min(5, s.ids.length) : 0,
      best: s.vis && s.ids.length === maxCount,
      names: s.vis ? s.ids : [],
    })),
  }));

  const best: BestSlotDTO[] = visible
    .filter((s) => s.ids.length === maxCount)
    .slice(0, 3)
    .map((s) => ({ di: s.di, hi: s.hi, count: s.ids.length, names: s.ids }));

  return {
    poll,
    hours,
    rows,
    participantsCount: participants.length,
    hidden,
    maxCount,
    best,
  };
}
