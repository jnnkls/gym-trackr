// @ts-check
import { expect, test } from "vitest";
import { renderCard } from "../gym-trackr.js";
import { day } from "./helpers.js";

test("renders counter and goal", () => {
  const days = new Map(
    Array.from({ length: 17 }, (_, i) => [
      `2026-11-${String(i + 1).padStart(2, "0")}`,
      day(),
    ]),
  );
  const html = renderCard({
    state: "ok",
    year: 2026,
    firstYear: 2026,
    currentYear: 2026,
    today: "2026-11-19",
    days,
  });
  expect(html).toContain("17 / 20");
  expect(html).toContain("noch 3 bis zum Ziel");
  expect(html).not.toContain("Einträge prüfen");
});

test("marks estimated days", () => {
  const days = new Map([["2026-11-10", { ...day(240), estimated: true }]]);
  const html = renderCard({
    state: "ok",
    year: 2026,
    firstYear: 2026,
    currentYear: 2026,
    today: "2026-11-19",
    days,
  });
  expect(html).toContain("1 Einträge prüfen");
  expect(html).toMatch(/class="cell l3 estimated"/);
});

test("renders error state", () => {
  expect(renderCard({ state: "error", entity: "calendar.gym" })).toContain(
    "Kalender nicht erreichbar: calendar.gym",
  );
});

test("renders loading state", () => {
  expect(renderCard({ state: "loading" })).toContain("Lade…");
});

test("empty disables both nav buttons", () => {
  const html = renderCard({
    state: "ok",
    year: 2026,
    firstYear: 2026,
    currentYear: 2026,
    today: "2026-11-19",
    days: new Map(),
  });
  expect(html).toContain("0 / 20");
  expect(html.match(/disabled/g)).toHaveLength(2);
});

test("escapes entity", () => {
  expect(renderCard({ state: "error", entity: "<img>" })).not.toContain(
    "<img>",
  );
});

test("tooltip shows times in time zone, all-day and empty cells", () => {
  const days = new Map([
    [
      "2026-11-10",
      {
        minutes: 60,
        estimated: false,
        visits: [
          {
            start: "2026-11-10T17:00:00Z",
            end: "2026-11-10T18:00:00Z",
            minutes: 60,
            estimated: false,
          },
        ],
      },
    ],
    [
      "2026-11-11",
      {
        minutes: null,
        estimated: false,
        visits: [
          {
            start: "2026-11-11",
            end: "2026-11-12",
            minutes: null,
            estimated: false,
          },
        ],
      },
    ],
  ]);
  const html = renderCard({
    state: "ok",
    year: 2026,
    firstYear: 2026,
    currentYear: 2026,
    today: "2026-11-19",
    days,
    timeZone: "Europe/Berlin",
  });
  expect(html).toContain('title="10.11.2026: 18:00–19:00 (60 min)"');
  expect(html).toContain('title="11.11.2026: Dauer unbekannt"');
  expect(html).toContain('title="12.11.2026"');
});
