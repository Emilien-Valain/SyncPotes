import { randomBytes } from "node:crypto";
import { Effect } from "effect";
import type { MeDTO, ParticipantDTO, PollDTO } from "../api-types";
import { computeHeatmap, pollHours, type HeatParticipant } from "../heatmap";
import { Db } from "./db";
import { GoogleCalendar } from "./google";
import { PollExpired, PollNotFound, ValidationError } from "./errors";
import type { JoinContext } from "./identity";
import { busyToFreeSet, pollWindowUtc } from "./time";

// Domain programs. Each is an Effect over the Db / GoogleCalendar services; the
// route handlers just run them. All business rules (validation, expiry,
// dedupe-on-rejoin) live here, not in the routes.

interface PollRow {
  slug: string;
  name: string;
  timezone: string;
  threshold: number;
  day_start_hour: number;
  day_end_hour: number;
  dates: (string | Date)[];
  expires_at: string | Date;
}

// Cookie-borne ids reach the database as parameters; anything that is not a
// uuid would make Postgres raise instead of simply not matching.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ownedId = (ctx: JoinContext): string | undefined =>
  ctx.participantId && UUID_RE.test(ctx.participantId) ? ctx.participantId : undefined;

const WORDS = [
  "mure", "vive", "sauge", "brume", "cedre", "lilas", "onde", "givre",
  "flamme", "houle", "menthe", "sable", "ambre", "orage", "prune", "tilleul",
];
const word = () => WORDS[randomBytes(1)[0] % WORDS.length];
const makeSlug = () => `${randomBytes(3).toString("hex")}-${word()}-${word()}`;

// pg parses a Postgres `date` into a JS Date at *local* midnight, so reading it
// back through toISOString() shifts the day whenever the server's offset is
// ahead of UTC (Europe/Paris in summer turns 2026-08-14 into 2026-08-13).
// A calendar date carries no instant — format it from local components.
const toISODate = (d: string | Date): string =>
  typeof d === "string"
    ? d.slice(0, 10)
    : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const rowToPoll = (r: PollRow): PollDTO => ({
  slug: r.slug,
  name: r.name,
  timezone: r.timezone,
  threshold: r.threshold,
  dayStartHour: r.day_start_hour,
  dayEndHour: r.day_end_hour,
  dates: r.dates.map(toISODate),
  expiresAt: new Date(r.expires_at).toISOString(),
});

export interface CreatePollInput {
  name: string;
  timezone: string;
  threshold: number;
  dayStartHour: number;
  dayEndHour: number;
  dates: string[]; // ISO yyyy-mm-dd
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const createPoll = (input: CreatePollInput) =>
  Effect.gen(function* () {
    const name = input.name?.trim();
    if (!name) return yield* new ValidationError({ message: "name is required" });
    if (!input.timezone) return yield* new ValidationError({ message: "timezone is required" });
    if (!(input.threshold >= 1)) return yield* new ValidationError({ message: "threshold must be >= 1" });
    if (!(input.dayEndHour > input.dayStartHour)) {
      return yield* new ValidationError({ message: "dayEndHour must be after dayStartHour" });
    }
    const dates = [...new Set(input.dates ?? [])].filter((d) => DATE_RE.test(d)).sort();
    if (dates.length === 0) return yield* new ValidationError({ message: "at least one valid date is required" });

    const last = dates[dates.length - 1];
    const expiresAt = new Date(`${last}T23:59:59Z`);
    expiresAt.setUTCDate(expiresAt.getUTCDate() + 7);

    const db = yield* Db;
    const slug = makeSlug();
    const res = yield* db.query<PollRow>(
      `INSERT INTO polls (slug, name, timezone, threshold, day_start_hour, day_end_hour, dates, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [slug, name, input.timezone, input.threshold, input.dayStartHour, input.dayEndHour, dates, expiresAt.toISOString()],
    );
    return rowToPoll(res.rows[0]);
  });

const getPollRow = (slug: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const res = yield* db.query<PollRow>(`SELECT * FROM polls WHERE slug = $1`, [slug]);
    const row = res.rows[0];
    if (!row) return yield* new PollNotFound({ slug });
    if (new Date(row.expires_at).getTime() < Date.now()) return yield* new PollExpired({ slug });
    return row;
  });

export const getPoll = (slug: string) => getPollRow(slug).pipe(Effect.map(rowToPoll));

const loadParticipants = (poll: PollDTO) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const hours = pollHours(poll);
    const hourIndex = new Map(hours.map((h, i) => [h, i]));
    const dateIndex = new Map(poll.dates.map((d, i) => [d, i]));

    const res = yield* db.query<{
      id: string; name: string; mode: "google" | "manual"; organizer: boolean;
      slot_date: string | Date | null; slot_hour: number | null;
    }>(
      `SELECT p.id, p.name, p.mode, p.organizer, f.slot_date, f.slot_hour
         FROM participants p
         LEFT JOIN free_slots f ON f.participant_id = p.id
        WHERE p.poll_slug = $1`,
      [poll.slug],
    );

    const byId = new Map<string, HeatParticipant & { organizer: boolean }>();
    for (const r of res.rows) {
      let p = byId.get(r.id);
      if (!p) {
        p = { id: r.id, name: r.name, mode: r.mode, organizer: r.organizer, free: new Set<string>() };
        byId.set(r.id, p);
      }
      if (r.slot_date != null && r.slot_hour != null) {
        const di = dateIndex.get(toISODate(r.slot_date));
        const hi = hourIndex.get(r.slot_hour);
        if (di !== undefined && hi !== undefined) p.free.add(`${di}-${hi}`);
      }
    }
    return [...byId.values()];
  });

export const getHeatmap = (slug: string, thresholdOverride?: number) =>
  Effect.gen(function* () {
    const poll = yield* getPoll(slug);
    const participants = yield* loadParticipants(poll);
    const K = thresholdOverride && thresholdOverride >= 1 ? thresholdOverride : poll.threshold;
    return computeHeatmap(poll, participants, K);
  });

export const listParticipants = (slug: string, meId?: string) =>
  Effect.gen(function* () {
    const poll = yield* getPoll(slug);
    const participants = yield* loadParticipants(poll);
    return participants.map<ParticipantDTO>((p) => ({
      id: p.id, name: p.name, mode: p.mode, organizer: p.organizer,
      freeCount: p.free.size, isMe: p.id === meId,
    }));
  });

// The caller's own row, slots included, so the client can pre-fill an edit
// rather than make them repaint from scratch. Resolves undefined when the
// cookie points at a row that is gone (removed, or the Poll was recreated).
export const getMe = (slug: string, meId: string) =>
  Effect.gen(function* () {
    const poll = yield* getPoll(slug);
    const participants = yield* loadParticipants(poll);
    const me = participants.find((p) => p.id === meId);
    if (!me) return undefined;
    return {
      id: me.id, name: me.name, mode: me.mode, organizer: me.organizer,
      free: [...me.free],
    } satisfies MeDTO;
  });

const insertFreeSlots = (participantId: string, poll: PollDTO, keys: string[]) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const hours = pollHours(poll);
    yield* db.query(`DELETE FROM free_slots WHERE participant_id = $1`, [participantId]);
    yield* Effect.forEach(
      keys,
      (key) => {
        const [di, hi] = key.split("-").map(Number);
        const date = poll.dates[di];
        const hour = hours[hi];
        if (date === undefined || hour === undefined) return Effect.void;
        return db.query(
          `INSERT INTO free_slots (participant_id, slot_date, slot_hour) VALUES ($1,$2,$3)
           ON CONFLICT DO NOTHING`,
          [participantId, date, hour],
        );
      },
      { discard: true },
    );
  });

export const joinManual = (
  slug: string,
  rawName: string,
  freeKeys: string[],
  ctx: JoinContext = {},
) =>
  Effect.gen(function* () {
    const poll = yield* getPoll(slug);
    const name = rawName?.trim();
    if (!name) return yield* new ValidationError({ message: "name is required" });

    const hours = pollHours(poll);
    const valid = (freeKeys ?? []).filter((k) => {
      const [di, hi] = k.split("-").map(Number);
      return Number.isInteger(di) && Number.isInteger(hi) && di >= 0 && di < poll.dates.length && hi >= 0 && hi < hours.length;
    });

    const db = yield* Db;

    // A browser that already owns a row in this Poll repaints it rather than
    // joining twice. The row may be gone (removed, or the Poll was recreated),
    // in which case we fall through to a fresh join.
    let id: string | undefined;
    const owned = ownedId(ctx);
    if (owned) {
      const upd = yield* db.query<{ id: string }>(
        `UPDATE participants SET name = $1, mode = 'manual'
          WHERE id = $2 AND poll_slug = $3 RETURNING id`,
        [name, owned, slug],
      );
      id = upd.rows[0]?.id;
    }
    if (!id) {
      const ins = yield* db.query<{ id: string }>(
        `INSERT INTO participants (poll_slug, name, mode, organizer)
         VALUES ($1,$2,'manual',$3) RETURNING id`,
        [slug, name, ctx.organizer === true],
      );
      id = ins.rows[0].id;
    }
    yield* insertFreeSlots(id, poll, valid);
    return { id };
  });

export const joinGoogle = (slug: string, code: string, ctx: JoinContext = {}) =>
  Effect.gen(function* () {
    const poll = yield* getPoll(slug);
    const google = yield* GoogleCalendar;
    const identity = yield* google.exchangeCode(code);
    const [timeMin, timeMax] = pollWindowUtc(poll);
    const busy = yield* google.freeBusy(identity.accessToken, timeMin, timeMax, poll.timezone);
    const free = busyToFreeSet(poll, busy);

    const db = yield* Db;

    // Organizer status is carried by the row this browser already owns, so
    // connecting Google after painting by hand doesn't demote the creator.
    const owned = ownedId(ctx);
    let organizer = ctx.organizer === true;
    if (owned && !organizer) {
      const prev = yield* db.query<{ organizer: boolean }>(
        `SELECT organizer FROM participants WHERE id = $1 AND poll_slug = $2`,
        [owned, slug],
      );
      organizer = prev.rows[0]?.organizer === true;
    }

    const res = yield* db.query<{ id: string }>(
      `INSERT INTO participants (poll_slug, name, mode, google_sub, organizer)
       VALUES ($1,$2,'google',$3,$4)
       ON CONFLICT (poll_slug, google_sub) DO UPDATE
         SET name = EXCLUDED.name,
             organizer = participants.organizer OR EXCLUDED.organizer
       RETURNING id`,
      [slug, identity.name, identity.sub, organizer],
    );
    const id = res.rows[0].id;

    // Same human under an older row (they joined by hand first): fold it in,
    // rather than leaving a stale twin in the grid.
    if (owned && owned !== id) {
      yield* db.query(`DELETE FROM participants WHERE id = $1 AND poll_slug = $2`, [owned, slug]);
    }

    yield* insertFreeSlots(id, poll, [...free]);
    return { id };
  });

/** Remove one participant (and, by cascade, their slots) from a live Poll. */
export const removeParticipant = (slug: string, participantId: string) =>
  Effect.gen(function* () {
    yield* getPoll(slug);
    if (!UUID_RE.test(participantId)) return { removed: false };
    const db = yield* Db;
    const res = yield* db.query(
      `DELETE FROM participants WHERE id = $1 AND poll_slug = $2`,
      [participantId, slug],
    );
    return { removed: (res.rowCount ?? 0) > 0 };
  });

export const cleanupExpired = () =>
  Effect.gen(function* () {
    const db = yield* Db;
    const res = yield* db.query<{ cleanup_expired: number }>(`SELECT cleanup_expired()`);
    return { deleted: Number(res.rows[0]?.cleanup_expired ?? 0) };
  });
