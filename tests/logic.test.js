// @ts-check
import { expect, test } from "vitest";
import {
  aggregateDays,
  countVisits,
  dayTitle,
  estimatedCount,
  firstYear,
  goalText,
  isStaleResponse,
  isValidEntity,
  level,
  monthLabels,
  navigate,
  renderCard,
  tipText,
  visitTimes,
  weekGrid,
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
  const g = weekGrid("2026-01-01", "2026-12-31");
  expect(g[0][0]).toEqual({ date: "2025-12-29", inRange: false });
  expect(g.flat().filter((c) => c.inRange)).toHaveLength(365);
  expect(g.every((col) => col.length === 7)).toBe(true);
  expect(g.at(-1)?.some((c) => c.date === "2026-12-31")).toBe(true);
});
test("week grid 90-day window", () => {
  const g = weekGrid("2026-08-22", "2026-11-19");
  expect(g.flat().filter((c) => c.inRange)).toHaveLength(90);
  expect(g[0][0].date).toBe("2026-08-17");
  expect(g.at(-1)?.some((c) => c.date === "2026-11-19")).toBe(true);
});
test("week grid rejects garbage", () => {
  expect(weekGrid("x", "2026-01-01")).toEqual([]);
  expect(weekGrid("2026-02-01", "2026-01-01")).toEqual([]);
});
test("navigate between window and years", () => {
  expect(navigate("window", -1, 2025, 2026)).toBe(2026);
  expect(navigate("window", 1, 2025, 2026)).toBe("window");
  expect(navigate(2026, 1, 2025, 2026)).toBe("window");
  expect(navigate(2025, 1, 2025, 2026)).toBe(2026);
  expect(navigate(2026, -1, 2025, 2026)).toBe(2025);
  expect(navigate(2025, -1, 2025, 2026)).toBe(2025);
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

test("malformed events are skipped, valid ones kept", () => {
  /** @type {any[]} */
  const bad = [
    ev("2026-11-19T10:00:00Z", "xx"),
    ev("garbage", "2026-11-19T10:00:00Z"),
    { start: { date: "junk" }, end: { date: "junk" } },
    { start: { dateTime: "2026-11-19T10:00:00Z" } },
    {},
    null,
    "str",
  ];
  const d = aggregateDays(
    [...bad, ev("2026-11-19T10:00:00+01:00", "2026-11-19T10:30:00+01:00")],
    TZ,
  );
  expect([...d.keys()]).toEqual(["2026-11-19"]);
  expect(get(d, "2026-11-19").minutes).toBe(30);
  expect(Number.isFinite(firstYear(d, 2026))).toBe(true);
});
test("non-array response is rejected", () => {
  expect(() => aggregateDays(/** @type {any} */ ({}), TZ)).toThrow();
  expect(() => aggregateDays(/** @type {any} */ (null), TZ)).toThrow();
});
test("renderCard survives garbage years", () => {
  for (const year of [Number.NaN, -1, 5, 999, 1e9]) {
    expect(() =>
      renderCard({
        state: "ok",
        view: year,
        firstYear: 2026,
        currentYear: 2026,
        today: "2026-11-19",
        days: new Map(),
      }),
    ).not.toThrow();
  }
});
test("entity must be calendar.<id> without path or query characters", () => {
  expect(isValidEntity("calendar.gym")).toBe(true);
  expect(isValidEntity("calendar.gym_2")).toBe(true);
  for (const e of [
    "calendar.gym/../../config",
    "calendar.gym?start=1990#",
    "calendar.",
    "calendar.Gym",
    "sensor.x",
    "",
    undefined,
  ])
    expect(isValidEntity(e)).toBe(false);
});
test("response for another entity is stale", () => {
  expect(isStaleResponse("calendar.a", "calendar.b")).toBe(true);
  expect(isStaleResponse("calendar.a", "calendar.a")).toBe(false);
});

test("visitTimes builds naive local ISO and rolls past midnight", () => {
  expect(visitTimes("2026-11-19", "18:00", "19:30")).toEqual({
    start: "2026-11-19T18:00:00",
    end: "2026-11-19T19:30:00",
  });
  expect(visitTimes("2026-11-19", "23:30", "00:45")?.end).toBe(
    "2026-11-20T00:45:00",
  );
  expect(visitTimes("2026-11-19", "18:00", "18:00")).toBeNull();
  expect(visitTimes("2026-11-19", "", "18:00")).toBeNull();
});

test("dayTitle is German weekday + date", () => {
  expect(dayTitle("2026-11-19")).toBe("Do., 19.11.2026");
});

test("aggregateDays keeps uid on visits", () => {
  const e = {
    ...ev("2026-11-19T17:00:00Z", "2026-11-19T18:00:00Z"),
    uid: "u1",
  };
  const d = aggregateDays(
    [e, ev("2026-11-19T19:00:00Z", "2026-11-19T20:00:00Z")],
    "UTC",
  );
  expect(d.get("2026-11-19")?.visits.map((v) => v.uid)).toEqual([
    "u1",
    undefined,
  ]);
});

test("monthLabels: full year has 12 labels", () => {
  const l = monthLabels(weekGrid("2026-01-01", "2026-12-31"));
  expect(l).toHaveLength(12);
  expect(l[0]).toEqual({ col: 0, label: "Jan" });
  expect(l.map((x) => x.label)).toContain("Dez");
});

test("monthLabels: window keeps labels at month starts", () => {
  // col0 = Mon Aug 17 (first in range Aug 22), Sep 7 = col3, Oct 5 = col7, Nov 2 = col11; gaps 3,4,4 all >= 2
  expect(monthLabels(weekGrid("2026-08-22", "2026-11-19"))).toEqual([
    { col: 0, label: "Aug" },
    { col: 3, label: "Sep" },
    { col: 7, label: "Okt" },
    { col: 11, label: "Nov" },
  ]);
});

test("monthLabels: drops a label followed by another one column later", () => {
  // col0 starts Mon Jan 26 (Jan), col1 starts Mon Feb 2 (Feb): Jan would overlap Feb and is dropped
  expect(monthLabels(weekGrid("2026-01-26", "2026-03-01"))).toEqual([
    { col: 1, label: "Feb" },
  ]);
  expect(monthLabels([])).toEqual([]);
});

test("tipText: empty, timed, estimated and all-day", () => {
  expect(tipText("2026-11-19", undefined, "Europe/Berlin")).toEqual([
    "Do., 19.11.2026",
    "Kein Besuch",
  ]);
  const timed = {
    minutes: 70,
    estimated: true,
    visits: [
      {
        start: "2026-11-19T17:00:00Z",
        end: "2026-11-19T18:10:00Z",
        minutes: 70,
        estimated: true,
      },
    ],
  };
  expect(tipText("2026-11-19", timed, "Europe/Berlin")).toEqual([
    "Do., 19.11.2026",
    "18:00–19:10 (70 min)",
    "Ende geschätzt – bitte prüfen",
  ]);
  const allDay = {
    minutes: null,
    estimated: false,
    visits: [
      {
        start: "2026-11-19",
        end: "2026-11-20",
        minutes: null,
        estimated: false,
      },
    ],
  };
  expect(tipText("2026-11-19", allDay, "UTC")).toContain(
    "ganztägig (Dauer unbekannt)",
  );
});
