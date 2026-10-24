// Mål för konditionen, först löpning (Logg → Löpmål): veckomål (km och antal pass) och ett tidsmål, t.ex. 5 km på
// under 30 minuter. Framstegen räknas ut från konditionspassen i loggen.
//
// Data: "ffv-goals" = { lopning: { weekKm, weekRuns, distKm, timeS } }, nyckel per aktivitet i CARDIO (log.js), så
// att fler aktiviteter kan få mål senare. Alla fält är valfria (null = inget mål). Okända fält och aktiviteter
// behålls när något sparas.

import { load, save, dateToDay, dayToDate, todayStr, isoWeekNumber, DAY_MS } from "./util.js";
import { entries } from "./log.js";

const KEY = "ffv-goals";
const positive = (x, max) => (typeof x === "number" && Number.isFinite(x) && x > 0 && x <= max ? x : null);

/** Ett mål med giltiga värden: { weekKm, weekRuns, distKm, timeS }, okända fält behålls. */
export function cleanGoal(g) {
  const goal = g && typeof g === "object" ? g : {};
  const runs = positive(goal.weekRuns, 14);
  return { ...goal, weekKm: positive(goal.weekKm, 500), weekRuns: runs && Math.round(runs), distKm: positive(goal.distKm, 100), timeS: positive(goal.timeS, 86400) };
}

let saved = load(KEY, null);
if (!saved || typeof saved !== "object") saved = {};

export const goalFor = (activity) => cleanGoal(saved[activity]);
export const hasGoal = (g) => g.weekKm != null || g.weekRuns != null || (g.distKm != null && g.timeS != null);

/** Spara målen för en aktivitet; null tar bort ett mål. */
export function setGoal(activity, goal) {
  saved = { ...saved, [activity]: cleanGoal({ ...(saved[activity] || {}), ...goal }) };
  save(KEY, saved);
}

/** Måndagen (dagnummer) i veckan för ett dagnummer. Dag 0 (1970-01-01) var en torsdag. */
const mondayOf = (day) => day - ((day + 3) % 7);

/**
 * Pass och kilometer per vecka för en aktivitet, den här veckan först och sedan `count - 1` veckor bakåt:
 * [{ monday: "2026-10-19", week: 43, km, runs }].
 */
export function weekProgress(activity, count = 5, list = entries, today = todayStr()) {
  const start = mondayOf(dateToDay(today));
  return Array.from({ length: count }, (_, i) => {
    const monday = start - 7 * i;
    const sessions = list.filter((e) => { const d = dateToDay(e.date); return d >= monday && d < monday + 7; })
      .flatMap((e) => (e.cardio || []).filter((c) => c.a === activity));
    return { monday: dayToDate(monday), week: isoWeekNumber(new Date(monday * DAY_MS)), km: sessions.reduce((s, c) => s + c.km, 0), runs: sessions.length };
  });
}

/** Riegels formel: förväntad tid över en annan distans, T2 = T1 × (D2 / D1)^1,06. */
export const riegel = (seconds, km, toKm) => seconds * Math.pow(toKm / km, 1.06);

/**
 * Bästa uppskattade tid över `distKm` de senaste `days` dagarna: { seconds, from (passet), date }, eller null.
 * Bara pass på minst halva distansen räknas, eftersom uppskattningen blir osäker från kortare pass.
 */
export function bestEstimate(activity, distKm, days = 56, list = entries, today = todayStr()) {
  const end = dateToDay(today);
  let best = null;
  for (const e of list) {
    const d = dateToDay(e.date);
    if (d > end || d <= end - days) continue;
    for (const c of e.cardio || []) {
      if (c.a !== activity || c.km < distKm * 0.5) continue;
      const seconds = riegel(c.s, c.km, distKm);
      if (!best || seconds < best.seconds) best = { seconds, from: c, date: e.date };
    }
  }
  return best;
}
