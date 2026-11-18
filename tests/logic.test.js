// @ts-check
import { expect, test } from "vitest";
import {
  aggregateDays,
  countVisits,
  estimatedCount,
  firstYear,
  goalText,
  level,
  yearGrid,
} from "../gym-trackr.js";
import { day, ev } from "./helpers.js";

const TZ = "Europe/Berlin";

/** @param {string} k @param {Map<string, import("../gym-trackr.js").Day>} d */
const get = (d, k) => /** @type {import("../gym-trackr.js").Day} */ (d.get(k));

test("midnight visit counts for start day", () => {
  const d = aggregateDays(
    [ev("2026-03-01T23:30:00+01:00", "2026-03-02T00:45:00+01:00")],
    TZ,
  );
  expect([...d.keys()]).toEqual(["2026-03-01"]);
  expect(get(d, "2026-03-01").minutes).toBe(75);
});
test("DST night uses real elapsed time", () => {
  const d = aggregateDays(
    [ev("2026-10-25T01:30:00+02:00", "2026-10-25T03:30:00+01:00")],
    TZ,
  );
  expect(get(d, "2026-10-25").minutes).toBe(180);
});
test("two visits same day add minutes, count once", () => {
  const d = aggregateDays(
    [
      ev("2026-11-10T07:00:00+01:00", "2026-11-10T07:30:00+01:00"),
      ev("2026-11-10T18:00:00+01:00", "2026-11-10T18:40:00+01:00"),
    ],
    TZ,
  );
  expect(get(d, "2026-11-10").minutes).toBe(70);
  expect(countVisits(d, "2026-11-19")).toBe(1);
});
test("all-day event", () => {
  const d = aggregateDays(
    [
      {
        start: { date: "2025-06-03" },
        end: { date: "2025-06-04" },
        summary: "Gym",
      },
    ],
    TZ,
  );
  expect(get(d, "2025-06-03").minutes).toBeNull();
  expect(level(d.get("2025-06-03"))).toBe(1);
});
test("end before start", () => {
  const d = aggregateDays(
    [ev("2026-11-10T18:00:00+01:00", "2026-11-10T17:00:00+01:00")],
    TZ,
  );
  expect(get(d, "2026-11-10").minutes).toBe(0);
  expect(level(d.get("2026-11-10"))).toBe(1);
});
test("estimated marker", () => {
  const d = aggregateDays(
    [
      ev(
        "2026-11-10T18:00:00+01:00",
        "2026-11-10T22:00:00+01:00",
        "⚠ Ende geschätzt",
      ),
    ],
    TZ,
  );
  expect(get(d, "2026-11-10").estimated).toBe(true);
  expect(estimatedCount(d)).toBe(1);
});
test("all-day plus timed visit: null + n = n", () => {
  const d = aggregateDays(
    [
      { start: { date: "2026-11-10" }, end: { date: "2026-11-11" } },
      ev("2026-11-10T18:00:00+01:00", "2026-11-10T18:40:00+01:00"),
    ],
    TZ,
  );
  expect(get(d, "2026-11-10").minutes).toBe(40);
  expect(get(d, "2026-11-10").visits).toHaveLength(2);
});
test("90-day window is today-89..today", () => {
  const d = new Map([
    ["2026-08-21", day()],
    ["2026-08-22", day()],
    ["2026-11-19", day()],
    ["2026-11-20", day()],
  ]);
  expect(countVisits(d, "2026-11-19")).toBe(2);
});
test("goal text", () => {
  expect(goalText(17)).toBe("noch 3 bis zum Ziel");
  expect(goalText(20)).toBe("Ziel erreicht");
  expect(goalText(25)).toBe("Ziel erreicht");
});
test("levels", () => {
  expect(
    [undefined, 1, 44, 45, 89, 90, 240].map((m) =>
      level(m === undefined ? undefined : day(m)),
    ),
  ).toEqual([0, 1, 1, 2, 2, 3, 3]);
});
test("year grid 2026", () => {
  const g = yearGrid(2026);
  expect(g[0][0]).toEqual({ date: "2025-12-29", inYear: false });
  expect(g.flat().filter((c) => c.inYear)).toHaveLength(365);
  expect(g.every((col) => col.length === 7)).toBe(true);
  expect(g.at(-1)?.some((c) => c.date === "2026-12-31")).toBe(true);
});
test("empty", () => {
  const d = aggregateDays([], TZ);
  expect(countVisits(d, "2026-11-19")).toBe(0);
  expect(firstYear(d, 2026)).toBe(2026);
});
test("firstYear takes min key year", () => {
  expect(
    firstYear(
      new Map([
        ["2024-05-01", day()],
        ["2026-01-01", day()],
      ]),
      2026,
    ),
  ).toBe(2024);
});
