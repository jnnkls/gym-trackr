// @ts-check
/** @typedef {import("../gym-trackr.js").CalEvent} CalEvent */
/** @typedef {import("../gym-trackr.js").Day} Day */

/**
 * @param {string} startIso
 * @param {string} endIso
 * @param {string} [description]
 * @returns {CalEvent}
 */
export const ev = (startIso, endIso, description) => ({
  start: { dateTime: startIso },
  end: { dateTime: endIso },
  summary: "Gym",
  description: description ?? null,
});

/**
 * @param {number} [minutes]
 * @returns {Day}
 */
export const day = (minutes = 30) => ({
  minutes,
  estimated: false,
  visits: [],
});
