// @ts-check
import { expect, test } from "vitest";
import { renderCard, STYLE, shouldFetch } from "../gym-trackr.js";
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
    view: 2026,
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
    view: 2026,
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

const base = {
  state: /** @type {const} */ ("ok"),
  firstYear: 2025,
  currentYear: 2026,
  today: "2026-11-19",
  days: new Map(),
};

test("window view: title, 90 cells, next disabled, toggle Jahr", () => {
  const html = renderCard({ ...base, view: "window" });
  expect(html).toContain("0 / 20");
  expect(html).toContain("Letzte 90 Tage");
  expect(html).toContain('class="grid window"');
  const all = html.match(/class="cell l/g)?.length ?? 0;
  expect(all).toBe(90);
  expect(html).toMatch(/data-nav="1"[^>]*disabled/);
  expect(html).not.toMatch(/data-nav="-1"[^>]*disabled/);
  expect(html).toMatch(/data-view[^>]*>Jahr</);
});

test("year view: both nav enabled, toggle 90 Tage", () => {
  const html = renderCard({ ...base, view: 2026 });
  expect(html).toContain("<span>2026</span>");
  expect(html).not.toContain("disabled");
  expect(html).toMatch(/data-view[^>]*>90 Tage</);
});

test("year view at firstYear disables back", () => {
  const html = renderCard({ ...base, view: 2025 });
  expect(html).toMatch(/data-nav="-1"[^>]*disabled/);
  expect(html).not.toMatch(/data-nav="1"[^>]*disabled/);
});

test("green colours, no primary-color", () => {
  expect(STYLE).toContain("#2da44e");
  expect(STYLE).not.toContain("--primary-color");
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
    view: 2026,
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

test("shouldFetch: 5 min normally, 30 s backoff after failure", () => {
  expect(shouldFetch(1000, undefined, false)).toBe(true);
  expect(shouldFetch(1000 + 299_999, 1000, false)).toBe(false);
  expect(shouldFetch(1000 + 300_000, 1000, false)).toBe(true);
  expect(shouldFetch(1000 + 29_999, 1000, true)).toBe(false);
  expect(shouldFetch(1000 + 30_000, 1000, true)).toBe(true);
});
