// Serializable DTOs shared between the API routes and (eventually) the client.
// These mirror the demo view-models in lib/syncpotes-model.ts, but are shaped
// for real data over the wire rather than the mockup's French label strings.

export type ParticipantMode = "google" | "manual";

export interface PollDTO {
  slug: string;
  name: string;
  timezone: string;
  threshold: number;
  dayStartHour: number;
  dayEndHour: number;
  dates: string[]; // ISO yyyy-mm-dd, ordered
  expiresAt: string; // ISO timestamp
}

export interface SlotNameDTO {
  id: string;
  name: string;
  mode: ParticipantMode;
}

export interface HeatCellDTO {
  di: number; // date index into poll.dates
  hi: number; // hour index into hours
  count: number;
  lvl: number; // 0..5 heat level (0 = below threshold, hidden)
  best: boolean;
  names: SlotNameDTO[];
}

export interface HeatRowDTO {
  date: string;
  cells: HeatCellDTO[];
}

export interface BestSlotDTO {
  di: number;
  hi: number;
  count: number;
  names: SlotNameDTO[];
}

export interface HeatmapDTO {
  poll: PollDTO;
  hours: number[];
  rows: HeatRowDTO[];
  participantsCount: number;
  hidden: number;
  maxCount: number;
  best: BestSlotDTO[];
}

export interface ParticipantDTO {
  id: string;
  name: string;
  mode: ParticipantMode;
  organizer: boolean;
  freeCount: number;
  /** True for the row the requesting browser owns — the only one it may remove. */
  isMe: boolean;
}

/**
 * The caller's own row, including the slots themselves so the client can
 * pre-fill an edit. Only ever returned for the row the sp_me_<slug> cookie
 * owns: one participant's full availability is more than the grid discloses,
 * so it is never part of the public heatmap payload.
 */
export interface MeDTO {
  id: string;
  name: string;
  mode: ParticipantMode;
  organizer: boolean;
  /** Slot keys, "di-hi", indexing poll.dates and hours. */
  free: string[];
}
