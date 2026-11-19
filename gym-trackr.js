// @ts-check

export const VERSION = "0.2.0"; // x-release-please-version
export const MARKER = "⚠ Ende geschätzt";
export const GOAL = 20;
export const WINDOW_DAYS = 90;

/** @typedef {{start:{dateTime?:string,date?:string}, end:{dateTime?:string,date?:string}, summary?:string, description?:string|null, uid?:string}} CalEvent */
/** @typedef {{minutes:number|null, estimated:boolean, visits:{uid?:string,start:string,end:string,minutes:number|null,estimated:boolean}[]}} Day */

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** @param {unknown} v */
const isInstant = (v) => typeof v === "string" && !Number.isNaN(Date.parse(v));

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
  if (!Array.isArray(events)) throw new TypeError("events must be an array");
  for (const e of events) {
    const allDay = e?.start?.date !== undefined;
    const start = /** @type {string} */ (
      allDay ? e.start.date : e?.start?.dateTime
    );
    const end = /** @type {string} */ (allDay ? e.end?.date : e?.end?.dateTime);
    // Skip malformed events instead of failing the whole card.
    if (allDay ? !DATE_KEY.test(start) : !isInstant(start) || !isInstant(end))
      continue;
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
    d.visits.push({
      uid: typeof e.uid === "string" ? e.uid : undefined,
      start,
      end,
      minutes,
      estimated,
    });
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
 * @param {string} from YYYY-MM-DD
 * @param {string} to YYYY-MM-DD
 * @returns {{date:string, inRange:boolean}[][]} columns = weeks, Monday first
 */
export function weekGrid(from, to) {
  if (!DATE_KEY.test(from) || !DATE_KEY.test(to) || from > to) return [];
  const mondayOffset = (new Date(`${from}T00:00:00Z`).getUTCDay() + 6) % 7;
  const cols = [];
  for (
    let start = addDays(from, -mondayOffset);
    start <= to;
    start = addDays(start, 7)
  ) {
    cols.push(
      Array.from({ length: 7 }, (_, i) => {
        const date = addDays(start, i);
        return { date, inRange: date >= from && date <= to };
      }),
    );
  }
  return cols;
}

/**
 * @param {"window"|number} view
 * @param {number} delta -1 or 1
 * @param {number} firstYear
 * @param {number} currentYear
 * @returns {"window"|number}
 */
export function navigate(view, delta, firstYear, currentYear) {
  if (view === "window") return delta < 0 ? currentYear : view;
  if (delta < 0) return Math.max(view - 1, firstYear);
  return view >= currentYear ? "window" : view + 1;
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
 * @param {string} dayKey YYYY-MM-DD
 * @param {string} start HH:MM
 * @param {string} end HH:MM
 * @returns {{start:string,end:string}|null} naive local ISO (HA reads naive values in its own time zone); end rolls to the next day if <= start
 */
export function visitTimes(dayKey, start, end) {
  const t = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!DATE_KEY.test(dayKey) || !t.test(start) || !t.test(end) || start === end)
    return null;
  return {
    start: `${dayKey}T${start}:00`,
    end: `${end > start ? dayKey : addDays(dayKey, 1)}T${end}:00`,
  };
}

/** @param {string} key YYYY-MM-DD */
export const dayTitle = (key) =>
  new Intl.DateTimeFormat("de-DE", {
    timeZone: "UTC",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${key}T00:00:00Z`));

/**
 * @param {string} key YYYY-MM-DD
 * @param {Day|undefined} day
 * @param {string} [error]
 * @param {string} [timeZone]
 */
export function renderDialog(key, day, error, timeZone = "UTC") {
  const visits = (day?.visits ?? [])
    .map((v) => {
      const est = v.estimated
        ? ' <span class="check">Ende geschätzt</span>'
        : "";
      if (v.minutes === null)
        return `<div class="visit"><span>ganztägig</span>${v.uid ? ` <button class="del" data-act="delete" data-uid="${esc(v.uid)}">Löschen</button>` : ""}</div>`;
      const s = hhmm(v.start, timeZone);
      const e = hhmm(v.end, timeZone);
      if (!v.uid)
        return `<div class="visit"><span>${s}–${e}</span>${est}</div>`;
      return `<div class="visit" data-uid="${esc(v.uid)}"><label>Start <input type="time" data-f="start" value="${s}"></label><label>Ende <input type="time" data-f="end" value="${e}"></label>${est}<button class="primary" data-act="save" data-uid="${esc(v.uid)}">Speichern</button><button class="del" data-act="delete" data-uid="${esc(v.uid)}">Löschen</button></div>`;
    })
    .join("");
  return `<div class="dhead"><b>${esc(dayTitle(key))}</b><button data-act="close" aria-label="Schließen">×</button></div>
${visits}
<div class="visit add"><span>+ Besuch hinzufügen</span><label>Start <input type="time" data-f="start" value="18:00"></label><label>Ende <input type="time" data-f="end" value="19:00"></label><button class="primary" data-act="add">Hinzufügen</button></div>
${error ? `<p class="err">${esc(error)}</p>` : ""}`;
}

/**
 * @param {{state:"loading"}
 *  | {state:"error", entity:string}
 *  | {state:"ok", view:"window"|number, firstYear:number, currentYear:number, today:string, days:Map<string,Day>, timeZone?:string}} model
 * @returns {string}
 */
export function renderCard(model) {
  if (model.state === "loading") return "<ha-card>Lade…</ha-card>";
  if (model.state === "error")
    return `<ha-card><div class="msg">Kalender nicht erreichbar: ${esc(model.entity)}</div></ha-card>`;
  const { view, firstYear, today, days } = model;
  const tz = model.timeZone ?? "UTC";
  const count = countVisits(days, today);
  const check = estimatedCount(days);
  const win = view === "window";
  const cols = (
    win
      ? weekGrid(addDays(today, -(WINDOW_DAYS - 1)), today)
      : weekGrid(`${view}-01-01`, `${view}-12-31`)
  )
    .map(
      (week) =>
        `<div class="week">${week
          .map((c) => {
            if (!c.inRange) return '<div class="cell out"></div>';
            const d = days.get(c.date);
            const cls = `cell l${level(d)}${d?.estimated ? " estimated" : ""}`;
            const tip = esc(tooltip(c.date, d, tz));
            return `<button class="${cls}" data-day="${c.date}" title="${tip}" aria-label="${tip}"></button>`;
          })
          .join("")}</div>`,
    )
    .join("");
  const prevOff = win ? false : view <= firstYear;
  return `<ha-card>
<div class="head"><span class="count">${count} / ${GOAL}</span> <span class="sub">(letzte ${WINDOW_DAYS} Tage)</span> <span class="goal">${esc(goalText(count))}</span>${check > 0 ? ` <span class="check">${check} Einträge prüfen</span>` : ""}</div>
<div class="nav"><button data-nav="-1" aria-label="Zurück"${prevOff ? " disabled" : ""}><ha-icon icon="mdi:chevron-left"></ha-icon></button><button data-view aria-label="Ansicht wechseln">${win ? "Jahr" : "90 Tage"}</button><button data-nav="1" aria-label="Weiter"${win ? " disabled" : ""}><ha-icon icon="mdi:chevron-right"></ha-icon></button><span>${win ? "Letzte 90 Tage" : view}</span></div>
<div class="${win ? "" : "scroll"}"><div class="grid${win ? " window" : ""}">${cols}</div></div>
</ha-card>`;
}

export const STYLE = `
:host{display:block;--gt-green:#2da44e}
ha-card{padding:16px;color:var(--primary-text-color)}
.sub,.goal{color:var(--secondary-text-color)}
.check{color:var(--error-color)}
.count{font-weight:500}
.nav{display:flex;align-items:center;gap:8px;margin:8px 0}
button{height:var(--control-height,42px);min-width:var(--control-height,42px);border-radius:var(--control-border-radius,12px);border:none;background:rgba(var(--rgb-primary-text-color,255,255,255),.05);color:var(--primary-text-color);font:inherit;font-weight:500;padding:0 12px;cursor:pointer}
button:hover{background:rgba(var(--rgb-primary-text-color,255,255,255),.1)}
button:disabled{opacity:.4;cursor:default}
button.primary{background:var(--gt-green);color:#fff}
button.del{color:var(--error-color)}
button.cell{padding:0;height:auto;min-width:0;border-radius:2px}
dialog{background:var(--card-background-color);color:var(--primary-text-color);border:none;border-radius:var(--ha-card-border-radius,12px);padding:16px;min-width:min(360px,90vw)}
.dhead{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.visit{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:8px 0}
.visit input{font:inherit;color:inherit;background:transparent;border:1px solid var(--divider-color);border-radius:6px;padding:4px}
.err{color:var(--error-color)}
.scroll{overflow-x:auto}
.grid{display:flex;gap:3px;width:max-content}
.week{display:flex;flex-direction:column;gap:3px}
.cell{width:12px;height:12px;border-radius:2px;box-sizing:border-box;background:var(--divider-color);border:none}
.grid.window{display:grid;grid-auto-flow:column;grid-template-rows:repeat(7,auto);grid-auto-columns:1fr;gap:3px;width:100%}
.window .week{display:contents}
.window .cell{aspect-ratio:1;width:auto;height:auto}
.cell.out{visibility:hidden}
.l1{background:color-mix(in srgb,var(--gt-green) 35%,var(--card-background-color))}
.l2{background:color-mix(in srgb,var(--gt-green) 65%,var(--card-background-color))}
.l3{background:var(--gt-green)}
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

/** @param {unknown} entity */
export const isValidEntity = (entity) =>
  typeof entity === "string" && /^calendar\.[a-z0-9_]+$/.test(entity);

/**
 * @param {string} requested entity the response was fetched for
 * @param {string} current entity the card is configured with now
 */
export const isStaleResponse = (requested, current) => requested !== current;

class GymTrackrCard extends (globalThis.HTMLElement ?? class {}) {
  /** @type {string} */ entity = "";
  /** @type {any} */ model = { state: "loading" };
  /** @type {"window"|number} */ view = "window";
  /** @type {number|undefined} */ lastFetch;
  lastFailed = false;
  /** @type {any} */ root;
  /** @type {any} */ hassObj;
  /** @type {string|undefined} */ openDay;
  /** @type {string|undefined} */ dialogError;

  /** @param {{entity?:string}} config */
  setConfig(config) {
    if (!isValidEntity(config?.entity))
      throw new Error("entity (calendar.*) erforderlich");
    if (config.entity !== this.entity) this.lastFetch = undefined;
    this.entity = /** @type {string} */ (config.entity);
  }

  getCardSize() {
    return 4;
  }

  /** @param {any} h */
  set hass(h) {
    this.hassObj = h;
    if (!shouldFetch(Date.now(), this.lastFetch, this.lastFailed)) return;
    this.lastFetch = Date.now();
    this.#load(h);
  }

  /** @param {any} h */
  async #load(h) {
    const entity = this.entity;
    try {
      const tz = h.config.time_zone;
      const end = new Date(Date.now() + 86400000).toISOString();
      const events = await h.callApi(
        "GET",
        `calendars/${entity}?start=2000-01-01T00:00:00Z&end=${end}`,
      );
      if (isStaleResponse(entity, this.entity)) return false;
      const today = dayKey(new Date().toISOString(), tz);
      const days = aggregateDays(events, tz);
      const currentYear = Number(today.slice(0, 4));
      this.lastFailed = false;
      this.model = {
        state: "ok",
        view:
          typeof this.view === "number"
            ? Math.min(this.view, currentYear)
            : this.view,
        firstYear: firstYear(days, currentYear),
        currentYear,
        today,
        days,
        timeZone: tz,
      };
      this.#render(); // dialog body is only redrawn by its own actions, so typing survives refreshes
      return true;
    } catch {
      this.lastFailed = true;
      if (this.openDay) return false; // keep the card and open dialog as they are
      this.model = { state: "error", entity: this.entity };
      this.#render();
    }
  }

  #renderDialog() {
    const dlg = this.root.querySelector("dialog");
    if (!this.openDay || this.model.state !== "ok") return;
    dlg.innerHTML = renderDialog(
      this.openDay,
      this.model.days.get(this.openDay),
      this.dialogError,
      this.model.timeZone,
    );
    if (!dlg.open) dlg.showModal();
  }

  /** @param {any} ev */
  async #dialogClick(ev) {
    const btn = ev.target.closest?.("button[data-act]");
    if (!btn) return;
    const act = btn.getAttribute("data-act");
    if (act === "close") return this.root.querySelector("dialog").close();
    const uid = btn.getAttribute("data-uid");
    const row = btn.closest(".visit");
    const val = (/** @type {string} */ f) =>
      row.querySelector(`[data-f=${f}]`)?.value ?? "";
    const t = visitTimes(this.openDay ?? "", val("start"), val("end"));
    const entity = this.entity;
    const h = this.hassObj;
    /** @type {any} */ let msg;
    if (act === "delete")
      msg = { type: "calendar/event/delete", entity_id: entity, uid };
    else if (!t) {
      this.dialogError = "Ungültige Zeiten";
      return this.#renderDialog();
    } else {
      const event = { summary: "Gym", dtstart: t.start, dtend: t.end };
      msg =
        act === "add"
          ? { type: "calendar/event/create", entity_id: entity, event }
          : {
              type: "calendar/event/update",
              entity_id: entity,
              uid,
              event: { ...event, description: "" },
            };
    }
    try {
      await h.callWS(msg);
      this.dialogError = (await this.#load(h))
        ? undefined
        : "Aktualisieren fehlgeschlagen";
    } catch {
      this.dialogError = "Speichern fehlgeschlagen";
    }
    this.#renderDialog();
  }

  /** @param {boolean} [toEnd] scroll to the right end (entering current year) */
  #render(toEnd = false) {
    if (!this.root) {
      this.root = this.attachShadow({ mode: "open" });
      this.root.innerHTML = `<style>${STYLE}</style><div id="card"></div><dialog></dialog>`;
      const dlg = this.root.querySelector("dialog");
      dlg.addEventListener("click", (/** @type {any} */ ev) =>
        this.#dialogClick(ev),
      );
      dlg.addEventListener("close", () => {
        this.openDay = undefined;
      });
    }
    // Keep the scroll position across refreshes; first render shows today (right end).
    const before = this.root.querySelector(".scroll")?.scrollLeft;
    this.root.querySelector("#card").innerHTML = renderCard(this.model);
    const scroll = this.root.querySelector(".scroll");
    if (scroll)
      scroll.scrollLeft = toEnd
        ? scroll.scrollWidth
        : (before ?? scroll.scrollWidth);
    const m = this.model;
    const go = (/** @type {"window"|number} */ v) => {
      this.view = m.view = v;
      this.#render(typeof v === "number" && v === m.currentYear);
    };
    for (const b of this.root.querySelectorAll("[data-nav]"))
      b.addEventListener("click", () =>
        go(
          navigate(
            m.view,
            Number(b.getAttribute("data-nav")),
            m.firstYear,
            m.currentYear,
          ),
        ),
      );
    for (const b of this.root.querySelectorAll("[data-day]"))
      b.addEventListener("click", () => {
        this.dialogError = undefined;
        this.openDay = b.getAttribute("data-day");
        this.#renderDialog();
      });
    this.root
      .querySelector("[data-view]")
      ?.addEventListener("click", () =>
        go(m.view === "window" ? m.currentYear : "window"),
      );
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
