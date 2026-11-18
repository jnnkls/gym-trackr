// @ts-check

export const VERSION = "0.1.0"; // x-release-please-version
export const MARKER = "⚠ Ende geschätzt";
export const GOAL = 20;
export const WINDOW_DAYS = 90;

/** @typedef {{start:{dateTime?:string,date?:string}, end:{dateTime?:string,date?:string}, summary?:string, description?:string|null}} CalEvent */
/** @typedef {{minutes:number|null, estimated:boolean, visits:{start:string,end:string,minutes:number|null,estimated:boolean}[]}} Day */

/**
 * @param {string} iso
 * @param {string} timeZone
 * @returns {string} YYYY-MM-DD of that instant in timeZone
 */
export function dayKey(iso, timeZone) {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date(iso));
}

/**
 * @param {CalEvent[]} events
 * @param {string} timeZone
 * @returns {Map<string, Day>}
 */
export function aggregateDays(events, timeZone) {
  /** @type {Map<string, Day>} */
  const days = new Map();
  for (const e of events) {
    const allDay = e.start.date !== undefined;
    const start = /** @type {string} */ (
      allDay ? e.start.date : e.start.dateTime
    );
    const end = /** @type {string} */ (allDay ? e.end.date : e.end.dateTime);
    const key = allDay ? start : dayKey(start, timeZone);
    const minutes = allDay
      ? null
      : Math.max(
          0,
          Math.round(
            (new Date(end).getTime() - new Date(start).getTime()) / 60000,
          ),
        );
    const estimated = (e.description ?? "").includes(MARKER);
    const d = days.get(key) ?? { minutes: null, estimated: false, visits: [] };
    if (minutes !== null) d.minutes = (d.minutes ?? 0) + minutes;
    d.estimated ||= estimated;
    d.visits.push({ start, end, minutes, estimated });
    days.set(key, d);
  }
  return days;
}

/**
 * @param {string} key YYYY-MM-DD
 * @param {number} delta days
 */
function addDays(key, delta) {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/**
 * @param {Map<string, Day>} days
 * @param {string} today YYYY-MM-DD
 */
export function countVisits(days, today) {
  const from = addDays(today, -(WINDOW_DAYS - 1));
  return [...days.keys()].filter((k) => k >= from && k <= today).length;
}

/** @param {Map<string, Day>} days */
export function estimatedCount(days) {
  return [...days.values()].filter((d) => d.estimated).length;
}

/** @param {number} count */
export function goalText(count) {
  return count >= GOAL ? "Ziel erreicht" : `noch ${GOAL - count} bis zum Ziel`;
}

/**
 * @param {Day|undefined} day
 * @returns {0|1|2|3}
 */
export function level(day) {
  if (!day) return 0;
  const m = day.minutes ?? 0;
  return m >= 90 ? 3 : m >= 45 ? 2 : 1;
}

/**
 * @param {number} year
 * @returns {{date:string, inYear:boolean}[][]} columns = weeks, Monday first
 */
export function yearGrid(year) {
  const jan1 = `${year}-01-01`;
  const dec31 = `${year}-12-31`;
  const mondayOffset = (new Date(`${jan1}T00:00:00Z`).getUTCDay() + 6) % 7;
  const cols = [];
  for (
    let start = addDays(jan1, -mondayOffset);
    start <= dec31;
    start = addDays(start, 7)
  ) {
    cols.push(
      Array.from({ length: 7 }, (_, i) => {
        const date = addDays(start, i);
        return { date, inYear: date.startsWith(`${year}-`) };
      }),
    );
  }
  return cols;
}

/**
 * @param {Map<string, Day>} days
 * @param {number} currentYear
 */
export function firstYear(days, currentYear) {
  const years = [...days.keys()].map((k) => Number(k.slice(0, 4)));
  return years.length ? Math.min(...years) : currentYear;
}

/** @param {string} s */
const esc = (s) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      /** @type {Record<string,string>} */ ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] ?? c,
  );

/** @param {string} key YYYY-MM-DD */
const germanDate = (key) => {
  const [y, m, d] = key.split("-");
  return `${Number(d)}.${Number(m)}.${y}`;
};

/**
 * @param {string} iso
 * @param {string} timeZone
 */
const hhmm = (iso, timeZone) =>
  new Intl.DateTimeFormat("de-DE", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));

/**
 * @param {string} key
 * @param {Day|undefined} d
 * @param {string} timeZone
 */
function tooltip(key, d, timeZone) {
  const date = germanDate(key);
  if (!d) return date;
  const lines = d.visits.map((v) =>
    v.minutes === null
      ? `${date}: Dauer unbekannt`
      : `${date}: ${hhmm(v.start, timeZone)}–${hhmm(v.end, timeZone)} (${v.minutes} min)`,
  );
  if (!lines.length) lines.push(date);
  if (d.estimated) lines.push("Ende geschätzt – bitte prüfen");
  return lines.join("\n");
}

/**
 * @param {{state:"loading"}
 *  | {state:"error", entity:string}
 *  | {state:"ok", year:number, firstYear:number, currentYear:number, today:string, days:Map<string,Day>, timeZone?:string}} model
 * @returns {string}
 */
export function renderCard(model) {
  if (model.state === "loading") return "<ha-card>Lade…</ha-card>";
  if (model.state === "error")
    return `<ha-card><div class="msg">Kalender nicht erreichbar: ${esc(model.entity)}</div></ha-card>`;
  const { year, firstYear, currentYear, today, days } = model;
  const tz = model.timeZone ?? "UTC";
  const count = countVisits(days, today);
  const check = estimatedCount(days);
  const cols = yearGrid(year)
    .map(
      (week) =>
        `<div class="week">${week
          .map((c) => {
            if (!c.inYear) return '<div class="cell out"></div>';
            const d = days.get(c.date);
            const cls = `cell l${level(d)}${d?.estimated ? " estimated" : ""}`;
            return `<div class="${cls}" title="${esc(tooltip(c.date, d, tz))}"></div>`;
          })
          .join("")}</div>`,
    )
    .join("");
  return `<ha-card>
<div class="head"><span class="count">${count} / ${GOAL}</span> <span class="sub">(letzte ${WINDOW_DAYS} Tage)</span> <span class="goal">${esc(goalText(count))}</span>${check > 0 ? ` <span class="check">${check} Einträge prüfen</span>` : ""}</div>
<div class="nav"><button data-nav="-1" aria-label="Vorheriges Jahr"${year === firstYear ? " disabled" : ""}>&lt;</button><span>${year}</span><button data-nav="1" aria-label="Nächstes Jahr"${year === currentYear ? " disabled" : ""}>&gt;</button></div>
<div class="scroll"><div class="grid">${cols}</div></div>
</ha-card>`;
}

const STYLE = `
:host{display:block}
ha-card{padding:16px;color:var(--primary-text-color)}
.sub,.goal{color:var(--secondary-text-color)}
.check{color:var(--error-color)}
.nav{display:flex;align-items:center;gap:8px;margin:8px 0}
.scroll{overflow-x:auto}
.grid{display:flex;gap:3px;width:max-content}
.week{display:flex;flex-direction:column;gap:3px}
.cell{width:12px;height:12px;border-radius:2px;box-sizing:border-box;background:var(--divider-color)}
.cell.out{visibility:hidden}
.l1{background:color-mix(in srgb,var(--primary-color) 35%,var(--card-background-color))}
.l2{background:color-mix(in srgb,var(--primary-color) 65%,var(--card-background-color))}
.l3{background:var(--primary-color)}
.cell.estimated{outline:2px solid var(--error-color);outline-offset:-2px}
`;

const REFRESH_MS = 5 * 60 * 1000;
const RETRY_MS = 30 * 1000;

/**
 * @param {number} now ms
 * @param {number|undefined} lastAttempt ms of the last fetch start, undefined if never
 * @param {boolean} lastFailed whether that attempt failed
 */
export function shouldFetch(now, lastAttempt, lastFailed) {
  return (
    lastAttempt === undefined ||
    now - lastAttempt >= (lastFailed ? RETRY_MS : REFRESH_MS)
  );
}

class GymTrackrCard extends (globalThis.HTMLElement ?? class {}) {
  /** @type {string} */ entity = "";
  /** @type {any} */ model = { state: "loading" };
  /** @type {number|undefined} */ year;
  /** @type {number|undefined} */ lastFetch;
  lastFailed = false;
  /** @type {any} */ root;

  /** @param {{entity?:string}} config */
  setConfig(config) {
    if (!config?.entity?.startsWith("calendar."))
      throw new Error("entity (calendar.*) erforderlich");
    if (config.entity !== this.entity) this.lastFetch = undefined;
    this.entity = config.entity;
  }

  getCardSize() {
    return 4;
  }

  /** @param {any} h */
  set hass(h) {
    if (!shouldFetch(Date.now(), this.lastFetch, this.lastFailed)) return;
    this.lastFetch = Date.now();
    this.#load(h);
  }

  /** @param {any} h */
  async #load(h) {
    try {
      const tz = h.config.time_zone;
      const end = new Date(Date.now() + 86400000).toISOString();
      const events = await h.callApi(
        "GET",
        `calendars/${this.entity}?start=2000-01-01T00:00:00Z&end=${end}`,
      );
      const today = dayKey(new Date().toISOString(), tz);
      const days = aggregateDays(events, tz);
      const currentYear = Number(today.slice(0, 4));
      this.lastFailed = false;
      this.model = {
        state: "ok",
        year: Math.min(this.year ?? currentYear, currentYear),
        firstYear: firstYear(days, currentYear),
        currentYear,
        today,
        days,
        timeZone: tz,
      };
    } catch {
      this.lastFailed = true;
      this.model = { state: "error", entity: this.entity };
    }
    this.#render();
  }

  #render() {
    this.root ??= this.attachShadow({ mode: "open" });
    this.root.innerHTML = `<style>${STYLE}</style>${renderCard(this.model)}`;
    for (const b of this.root.querySelectorAll("[data-nav]"))
      b.addEventListener("click", () => {
        this.year = this.model.year + Number(b.getAttribute("data-nav"));
        this.model.year = this.year;
        this.#render();
      });
  }
}

if (globalThis.customElements && !customElements.get("gym-trackr-card")) {
  customElements.define("gym-trackr-card", GymTrackrCard);
  console.info(`GYM-TRACKR-CARD v${VERSION}`);
  /** @type {any} */ (globalThis.window).customCards ??= [];
  /** @type {any} */ (globalThis.window).customCards.push({
    type: "gym-trackr-card",
    name: "Gym Trackr",
    description: "Gym-Besuche als Heatmap",
  });
}
