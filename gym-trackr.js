// @ts-check

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
