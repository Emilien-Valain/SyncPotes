import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PollDTO } from "./api-types";
import { computeHeatmap, pollHours, type HeatParticipant } from "./heatmap";

// The Threshold is the product's central privacy rule: below it a slot is not
// merely dimmed, it discloses nothing — no count, no names. These tests pin
// that down, plus the "best slot" selection the whole UI is built around.

const poll = (over: Partial<PollDTO> = {}): PollDTO => ({
  slug: "test",
  name: "Test",
  timezone: "Europe/Paris",
  threshold: 2,
  dayStartHour: 18,
  dayEndHour: 21, // → hours 18, 19, 20
  dates: ["2026-08-14", "2026-08-15"],
  expiresAt: "2026-08-22T00:00:00.000Z",
  ...over,
});

const person = (id: string, ...free: string[]): HeatParticipant => ({
  id,
  name: id,
  mode: "manual",
  free: new Set(free),
});

const cell = (h: ReturnType<typeof computeHeatmap>, di: number, hi: number) =>
  h.rows[di].cells[hi];

describe("pollHours", () => {
  it("spans start inclusive to end exclusive", () => {
    assert.deepEqual(pollHours({ dayStartHour: 18, dayEndHour: 21 }), [18, 19, 20]);
  });

  it("is empty when the window is degenerate", () => {
    assert.deepEqual(pollHours({ dayStartHour: 18, dayEndHour: 18 }), []);
  });
});

describe("computeHeatmap", () => {
  it("builds one cell per date × hour", () => {
    const h = computeHeatmap(poll(), [], 2);
    assert.equal(h.rows.length, 2);
    assert.equal(h.hours.length, 3);
    for (const row of h.rows) assert.equal(row.cells.length, 3);
    assert.deepEqual(h.rows.map((r) => r.date), ["2026-08-14", "2026-08-15"]);
  });

  it("counts and names everyone free at a slot that meets the Threshold", () => {
    const h = computeHeatmap(poll(), [person("a", "0-0"), person("b", "0-0")], 2);
    const c = cell(h, 0, 0);
    assert.equal(c.count, 2);
    assert.deepEqual(c.names.map((n) => n.name), ["a", "b"]);
  });

  it("discloses nothing below the Threshold — not the count, not the names", () => {
    const h = computeHeatmap(poll(), [person("a", "0-0"), person("b", "0-1")], 2);
    for (const [di, hi] of [[0, 0], [0, 1]] as const) {
      const c = cell(h, di, hi);
      assert.equal(c.count, 0, "count must not leak a sub-Threshold slot");
      assert.equal(c.lvl, 0);
      assert.equal(c.best, false);
      assert.deepEqual(c.names, []);
    }
  });

  it("counts every hidden slot, including the empty ones", () => {
    const h = computeHeatmap(poll(), [person("a", "0-0"), person("b", "0-0")], 2);
    assert.equal(h.hidden, 5); // 6 slots, 1 visible
  });

  it("treats a Threshold below 1 as 1 rather than revealing empty slots", () => {
    const h = computeHeatmap(poll(), [person("a", "0-0")], 0);
    assert.equal(cell(h, 0, 0).count, 1);
    assert.equal(cell(h, 0, 1).count, 0, "nobody free is still nothing to show");
    assert.equal(h.hidden, 5);
  });

  it("marks every slot tied at the maximum as best", () => {
    const h = computeHeatmap(
      poll(),
      [person("a", "0-0", "1-2"), person("b", "0-0", "1-2"), person("c", "0-1")],
      2,
    );
    assert.equal(h.maxCount, 2);
    assert.equal(cell(h, 0, 0).best, true);
    assert.equal(cell(h, 1, 2).best, true);
    assert.equal(cell(h, 0, 1).best, false);
  });

  it("never lets a hidden slot win, even when it has the most people", () => {
    // 3 free at 0-0 but the Threshold is 4: nothing is visible, so nothing wins.
    const h = computeHeatmap(
      poll(),
      [person("a", "0-0"), person("b", "0-0"), person("c", "0-0")],
      4,
    );
    assert.equal(h.maxCount, 0);
    assert.equal(h.best.length, 0);
    assert.equal(cell(h, 0, 0).best, false);
    assert.equal(h.hidden, 6);
  });

  it("returns at most three best slots, in grid order", () => {
    const all = ["0-0", "0-1", "0-2", "1-0", "1-1"];
    const h = computeHeatmap(poll(), [person("a", ...all), person("b", ...all)], 2);
    assert.equal(h.best.length, 3);
    assert.deepEqual(h.best.map((b) => [b.di, b.hi]), [[0, 0], [0, 1], [0, 2]]);
  });

  it("caps the heat level at 5 while keeping the true count", () => {
    const many = Array.from({ length: 7 }, (_, i) => person(`p${i}`, "0-0"));
    const h = computeHeatmap(poll(), many, 2);
    assert.equal(cell(h, 0, 0).count, 7);
    assert.equal(cell(h, 0, 0).lvl, 5);
  });

  it("ignores free keys outside the Poll's grid", () => {
    const h = computeHeatmap(poll(), [person("a", "9-9", "0-0"), person("b", "0-0")], 2);
    assert.equal(cell(h, 0, 0).count, 2);
    assert.equal(h.maxCount, 2);
  });

  it("reports the participant count even when nobody clears the Threshold", () => {
    const h = computeHeatmap(poll(), [person("a", "0-0"), person("b", "0-1")], 2);
    assert.equal(h.participantsCount, 2);
  });
});
