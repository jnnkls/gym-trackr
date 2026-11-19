// @ts-check
import { expect, test } from "vitest";
import {
  fitWeeks,
  LABEL_COL_PX,
  renderCard,
  renderDialog,
  STYLE,
  shouldFetch,
} from "../gym-trackr.js";
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

test("cell aria-labels show times in time zone, all-day and empty cells", () => {
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
  expect(html).not.toContain("title=");
  expect(html).toContain('aria-label="Di., 10.11.2026, 18:00–19:00 (60 min)"');
  expect(html).toContain(
    'aria-label="Mi., 11.11.2026, ganztägig (Dauer unbekannt)"',
  );
  expect(html).toContain('aria-label="Do., 12.11.2026, Kein Besuch"');
});

test("shouldFetch: 5 min normally, 30 s backoff after failure", () => {
  expect(shouldFetch(1000, undefined, false)).toBe(true);
  expect(shouldFetch(1000 + 299_999, 1000, false)).toBe(false);
  expect(shouldFetch(1000 + 300_000, 1000, false)).toBe(true);
  expect(shouldFetch(1000 + 29_999, 1000, true)).toBe(false);
  expect(shouldFetch(1000 + 30_000, 1000, true)).toBe(true);
});

/** @param {Record<string, any>} o */
const visit = (o) => ({
  start: "2026-11-19T17:00:00Z",
  end: "2026-11-19T18:30:00Z",
  minutes: 90,
  estimated: false,
  ...o,
});

test("renderDialog timed estimated visit", () => {
  const html = renderDialog(
    "2026-11-19",
    { ...day(), visits: [visit({ uid: "abc", estimated: true })] },
    undefined,
    "Europe/Berlin",
  );
  expect(html).toContain('data-uid="abc"');
  for (const s of [
    "Ende geschätzt",
    "Speichern",
    "Löschen",
    'value="18:00"',
    'value="19:30"',
    "Do., 19.11.2026",
  ])
    expect(html).toContain(s);
});

test("renderDialog all-day visit has no time inputs for it", () => {
  const html = renderDialog("2026-11-19", {
    ...day(),
    visits: [visit({ uid: "x", minutes: null })],
  });
  expect(html).toContain("ganztägig");
  expect(html.split('<div class="visit add">')[0]).not.toContain('type="time"');
});

test("renderDialog empty day offers adding", () => {
  expect(renderDialog("2026-11-19", undefined)).toContain("Hinzufügen");
});

test("renderDialog escapes uid and error", () => {
  const html = renderDialog(
    "2026-11-19",
    { ...day(), visits: [visit({ uid: '"><img src=x>' })] },
    "<u>",
  );
  expect(html).not.toContain("<img");
  expect(html).not.toContain("<u>");
});

test("renderCard: in-range cells are buttons, out cells are not", () => {
  const html = renderCard({
    state: "ok",
    view: 2026,
    firstYear: 2026,
    currentYear: 2026,
    today: "2026-11-19",
    days: new Map(),
  });
  expect(html).toMatch(/<button class="cell l0" data-day="2026-01-01"/);
  expect(html).toContain('<div class="cell out"></div>');
  expect(html).not.toMatch(/<button class="cell out/);
});

test("year-view cell buttons keep their 12px size", () => {
  // regression: button.cell{height:auto} outranked .cell{height:12px} and collapsed the year grid
  const rule = STYLE.match(/button\.cell\{[^}]*\}/)?.[0] ?? "";
  expect(rule).not.toMatch(/height/);
  expect(STYLE).toMatch(/\.cell\{[^}]*height:12px/);
});

test("renderCard: weekday labels, legend and month labels", () => {
  const html = renderCard({ ...base, view: 2026 });
  expect(html).toContain('<div class="wd">Mo</div>');
  expect(html).toContain('<div class="wd">Fr</div>');
  expect(html).toContain("Weniger");
  expect(html).toContain("Mehr");
  expect(html).toContain('<div class="m">Jan</div>');
  expect(html).toContain('<div class="m">Dez</div>');
  expect(html).not.toContain("title=");
});

test("window view has month labels and 90 cells despite legend swatches", () => {
  const html = renderCard({ ...base, view: "window" });
  expect(html).toContain('<div class="m">Okt</div>');
  expect(html.match(/class="cell l/g)?.length).toBe(90);
});

test("90-day view uses the same compact 12px cells and plain weekday labels", () => {
  // regression: window view stretched cells to card width; sticky .wd had an opaque background box
  expect(STYLE).not.toMatch(/\.window/);
  const wd = STYLE.match(/\.wd\{[^}]*\}/)?.[0] ?? "";
  expect(wd).not.toMatch(/background|sticky/);
});

test("fitWeeks: whole weeks after the label column, clamped to 0..53", () => {
  expect(fitWeeks(LABEL_COL_PX + 15 * 26)).toBe(26);
  expect(fitWeeks(LABEL_COL_PX + 15 * 26 - 1)).toBe(25);
  expect(fitWeeks(5)).toBe(0);
  expect(fitWeeks(100000)).toBe(53);
});

test("window view with weeks fills the width and dims days before the 90-day window", () => {
  const html = renderCard({ ...base, view: "window", weeks: 26 });
  const buttons = [
    ...html.matchAll(/<button class="(cell [^"]*)" data-day="([^"]+)"/g),
  ];
  const normal = buttons.filter((b) => !b[1].includes("dim"));
  const dim = buttons.filter((b) => b[1].includes("dim"));
  expect(normal).toHaveLength(90);
  expect(dim.length).toBeGreaterThan(0);
  expect(dim.every((b) => b[2] < "2026-08-22")).toBe(true);
  expect(buttons.every((b) => b[2] <= base.today)).toBe(true);
  expect(html).toContain(">Jun<");
  expect(STYLE).toMatch(/\.cell\.dim\{opacity:\.35\}/);
});

test("window view with fewer weeks than the 90 days need is unchanged", () => {
  const cells = (/** @type {string} */ h) =>
    h.match(/<(?:button|div) class="cell[^"]*"[^>]*>/g);
  const plain = renderCard({ ...base, view: "window" });
  const small = renderCard({ ...base, view: "window", weeks: 5 });
  expect(cells(small)).toEqual(cells(plain));
  expect(small).not.toContain("dim");
});
