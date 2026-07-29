import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PollDTO } from "../api-types";
import { busyToFreeSet, pollWindowUtc, zonedToUtcMs } from "./time";

// Grid slots are wall-clock hours in the Poll's timezone; Google answers in
// absolute instants. Everything here is about that conversion staying correct
// across the DST boundary — Europe/Paris is UTC+2 until 2026-10-25 and UTC+1
// after, so a 18h slot is a different instant on either side.

const poll = (over: Partial<PollDTO> = {}): PollDTO => ({
  slug: "test",
  name: "Test",
  timezone: "Europe/Paris",
  threshold: 2,
  dayStartHour: 18,
  dayEndHour: 21, // → hours 18, 19, 20
  dates: ["2026-08-14"],
  expiresAt: "2026-08-22T00:00:00.000Z",
  ...over,
});

const iso = (ms: number) => new Date(ms).toISOString();

describe("zonedToUtcMs", () => {
  it("resolves summer wall-clock time at UTC+2", () => {
    assert.equal(iso(zonedToUtcMs("Europe/Paris", 2026, 8, 14, 18)), "2026-08-14T16:00:00.000Z");
  });

  it("resolves winter wall-clock time at UTC+1", () => {
    assert.equal(iso(zonedToUtcMs("Europe/Paris", 2026, 12, 5, 18)), "2026-12-05T17:00:00.000Z");
  });

  it("resolves both sides of the autumn DST change", () => {
    assert.equal(iso(zonedToUtcMs("Europe/Paris", 2026, 10, 24, 18)), "2026-10-24T16:00:00.000Z");
    assert.equal(iso(zonedToUtcMs("Europe/Paris", 2026, 10, 26, 18)), "2026-10-26T17:00:00.000Z");
  });

  it("honours the Poll's timezone rather than the server's", () => {
    assert.equal(iso(zonedToUtcMs("UTC", 2026, 8, 14, 18)), "2026-08-14T18:00:00.000Z");
    assert.equal(iso(zonedToUtcMs("America/New_York", 2026, 8, 14, 18)), "2026-08-14T22:00:00.000Z");
  });
});

describe("pollWindowUtc", () => {
  it("spans the first slot's start to the last slot's end", () => {
    assert.deepEqual(pollWindowUtc(poll()), [
      "2026-08-14T16:00:00.000Z",
      "2026-08-14T19:00:00.000Z", // 21h Paris, the exclusive end of the 20h slot
    ]);
  });

  it("keeps each end at its own UTC offset across a DST change", () => {
    const [min, max] = pollWindowUtc(poll({ dates: ["2026-10-24", "2026-10-26"] }));
    assert.equal(min, "2026-10-24T16:00:00.000Z"); // CEST, UTC+2
    assert.equal(max, "2026-10-26T20:00:00.000Z"); // CET, UTC+1
  });
});

describe("busyToFreeSet", () => {
  it("marks every slot free when the calendar is empty", () => {
    assert.deepEqual([...busyToFreeSet(poll(), [])].sort(), ["0-0", "0-1", "0-2"]);
  });

  it("removes a slot the busy block covers exactly", () => {
    const free = busyToFreeSet(poll(), [
      { start: "2026-08-14T16:00:00Z", end: "2026-08-14T17:00:00Z" }, // 18h–19h Paris
    ]);
    assert.equal(free.has("0-0"), false);
    assert.equal(free.has("0-1"), true);
  });

  it("removes a slot a busy block only partly overlaps", () => {
    const free = busyToFreeSet(poll(), [
      { start: "2026-08-14T16:45:00Z", end: "2026-08-14T17:15:00Z" }, // 18h45–19h15
    ]);
    assert.equal(free.has("0-0"), false, "18h slot is nibbled at the end");
    assert.equal(free.has("0-1"), false, "19h slot is nibbled at the start");
    assert.equal(free.has("0-2"), true);
  });

  it("treats a busy block that merely touches a boundary as not overlapping", () => {
    const free = busyToFreeSet(poll(), [
      { start: "2026-08-14T17:00:00Z", end: "2026-08-14T18:00:00Z" }, // exactly 19h–20h
    ]);
    assert.equal(free.has("0-0"), true, "18h slot ends where the block begins");
    assert.equal(free.has("0-1"), false);
    assert.equal(free.has("0-2"), true, "20h slot begins where the block ends");
  });

  it("removes every slot a long block spans", () => {
    const free = busyToFreeSet(poll(), [
      { start: "2026-08-14T10:00:00Z", end: "2026-08-14T22:00:00Z" },
    ]);
    assert.equal(free.size, 0);
  });

  it("indexes slots by date position, not by calendar order", () => {
    const p = poll({ dates: ["2026-08-14", "2026-08-15"] });
    const free = busyToFreeSet(p, [
      { start: "2026-08-15T16:00:00Z", end: "2026-08-15T17:00:00Z" }, // second date, 18h
    ]);
    assert.equal(free.has("0-0"), true);
    assert.equal(free.has("1-0"), false);
  });

  it("applies the right UTC offset on each side of a DST change", () => {
    const p = poll({ dates: ["2026-10-24", "2026-10-26"] });
    const free = busyToFreeSet(p, [
      { start: "2026-10-24T16:00:00Z", end: "2026-10-24T17:00:00Z" }, // CEST → 18h
      { start: "2026-10-26T17:00:00Z", end: "2026-10-26T18:00:00Z" }, // CET  → 18h
    ]);
    assert.equal(free.has("0-0"), false);
    assert.equal(free.has("1-0"), false);
    assert.equal(free.has("0-1"), true);
    assert.equal(free.has("1-1"), true);
  });

  it("ignores busy blocks outside the Poll's window", () => {
    const free = busyToFreeSet(poll(), [
      { start: "2026-08-13T16:00:00Z", end: "2026-08-13T19:00:00Z" },
      { start: "2026-08-14T06:00:00Z", end: "2026-08-14T09:00:00Z" },
    ]);
    assert.equal(free.size, 3);
  });
});
