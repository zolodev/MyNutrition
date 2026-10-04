// Loggen: dagliga poster och statistik. Posterna sparas bara i webbläsaren (se storage.js).

import { load, save, dateToDay, dayToDate, todayStr, fmt } from "./util.js";

const LOG_KEY = "ffv-log";
export let entries = [];

// ---------- Kondition ----------
// Varje pass loggas med aktivitet, distans och tid. Tempot jämförs per aktivitet, så att olika distanser går att
// jämföra: min/km för löpning och promenad, min/500 m för rodd (som på roddmaskinen) och km/h för cykling.

export const CARDIO = {
  lopning: { n: "Löpning", pace: "km" },
  promenad: { n: "Promenad", pace: "km" },
  rodd: { n: "Rodd", pace: "500m" },
  cykel: { n: "Cykling", pace: "kmh" },
  annat: { n: "Annat", pace: "km" },
};

const inRange = (x, lo, hi) => (typeof x === "number" && x >= lo && x <= hi ? x : null);

/** Ett konditionspass { a: aktivitet, km, s: sekunder, hrMax }, eller null om distans eller tid saknas. Maxpulsen är valfri. */
export function cleanCardio(c) {
  if (!c || !CARDIO[c.a]) return null;
  const km = inRange(c.km, 0.01, 500), s = inRange(c.s, 1, 86400);
  if (!km || !s) return null;
  const hrMax = inRange(c.hrMax, 30, 240);
  const pass = { a: c.a, km, s, hrMax: hrMax != null ? Math.round(hrMax) : null };
  if (c.u === "m") pass.u = "m"; // distansen skrevs i meter; sparas alltid i km
  return pass;
}

/**
 * Intensitetsminuter för en dag: måttliga + 2 × höga (som Garmin och liknande klockor räknar).
 * WHO rekommenderar minst 150 sådana minuter i veckan. null om inget är loggat.
 */
export const intensityMinutes = (e) => (e.imMod == null && e.imVig == null ? null : (e.imMod || 0) + 2 * (e.imVig || 0));
export const WEEKLY_INTENSITY_GOAL = 150;

/** Tid "8:57" (mm:ss), "01:05:30" (hh:mm:ss) eller "45" (minuter) → sekunder. null om det inte går att tolka. */
export function parseWorkoutTime(text) {
  const t = String(text || "").trim();
  const hms = t.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
  if (hms) return +hms[1] * 3600 + +hms[2] * 60 + +hms[3];
  const ms = t.match(/^(\d{1,3})[:.,](\d{1,2})$/);
  if (ms) return +ms[1] * 60 + +ms[2];
  return /^\d+$/.test(t) ? +t * 60 : null;
}

/**
 * Skriv en tid medan man knappar in siffror: kolonerna sätts från höger, som på ett stoppur.
 * "857" → "8:57", "10530" → "1:05:30", "010530" → "01:05:30". Text med egna kolon lämnas orörd.
 */
export function formatWorkoutInput(value) {
  if (!/^\d+$/.test(value)) return value;
  const d = value.slice(0, 6);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, -2)}:${d.slice(-2)}`;
  return `${d.slice(0, -4)}:${d.slice(-4, -2)}:${d.slice(-2)}`;
}

/** En tid som hh:mm:ss, t.ex. 537 sekunder → "00:08:57". */
export function formatHms(seconds) {
  if (seconds == null) return "–";
  const s = Math.round(seconds);
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((x) => String(x).padStart(2, "0")).join(":");
}

/** Kort form för tempo: sekunder → "7:51" eller "1:05:30". */
function formatWorkoutTime(seconds) {
  if (seconds == null) return "–";
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** Sekunder per km; lägre är bättre för alla aktiviteter (även cykling, som visas i km/h). */
export const secondsPerKm = (c) => c.s / c.km;

/** Tempot som text: "7:51/km", "2:23/500 m" eller "30,0 km/h". */
export function paceText(c) {
  const kind = CARDIO[c.a]?.pace;
  if (kind === "kmh") return `${fmt(c.km / (c.s / 3600), 1)} km/h`;
  if (kind === "500m") return `${formatWorkoutTime(secondsPerKm(c) / 2)}/500 m`;
  return `${formatWorkoutTime(secondsPerKm(c))}/km`;
}

const pulseText = (c) => (c.hrMax ? `maxpuls ${c.hrMax}` : "");

/** Distansen i den enhet den skrevs in: "1,14 km" eller "1 122 m". */
const distanceText = (c) => (c.u === "m" ? `${fmt(Math.round(c.km * 1000))} m` : `${fmt(c.km, c.km % 1 ? 2 : 0)} km`);

/** "Löpning 1,14 km på 00:08:57 (7:51/km) · maxpuls 171" */
export const cardioText = (c) =>
  `${CARDIO[c.a].n} ${distanceText(c)} på ${formatHms(c.s)} (${paceText(c)})` + (pulseText(c) ? ` · ${pulseText(c)}` : "");

// ---------- Poster ----------

/** Kontrollera och städa en post. Ger null om datumet saknas eller är felaktigt. */
export function cleanEntry(e) {
  if (!e || !isIsoDate(e.date)) return null;
  const perf = [1, 0, -1].includes(e.perf) ? e.perf : null;
  return {
    date: e.date,
    weight: inRange(e.weight, 30, 300),
    waist: inRange(e.waist, 40, 200),
    mood: inRange(e.mood, 1, 5),
    perf,
    trained: e.trained !== false && perf !== null,
    cardio: Array.isArray(e.cardio) ? e.cardio.map(cleanCardio).filter(Boolean).slice(0, 10) : [],
    imMod: inRange(e.imMod, 0, 1440), // intensitetsminuter, måttliga
    imVig: inRange(e.imVig, 0, 1440), // intensitetsminuter, höga
    test: inRange(e.test, 1, 36000), // äldre versioner: en testtid utan aktivitet och distans
    note: typeof e.note === "string" ? e.note.slice(0, 200) : "",
    firstMeal: isClock(e.firstMeal) ? e.firstMeal : null, // "HH:MM", för uppföljning av fastan
    lastMeal: isClock(e.lastMeal) ? e.lastMeal : null,
  };
}

const isClock = (s) => typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

/**
 * Spara när dagens första och sista måltid åts, utan att röra resten av dagens post.
 * Tomma värden tar bort tiden. Poster som bara hade måltidstider tas bort helt när tiderna töms.
 */
export function setMealTimes(date, { firstMeal, lastMeal }) {
  const current = entryFor(date) || { date };
  const next = cleanEntry({ ...current, firstMeal: firstMeal ?? current.firstMeal, lastMeal: lastMeal ?? current.lastMeal });
  if (firstMeal === "") next.firstMeal = null;
  if (lastMeal === "") next.lastMeal = null;
  const empty = ["weight", "waist", "mood", "perf", "test", "imMod", "imVig", "firstMeal", "lastMeal"].every((k) => next[k] == null) && !next.note && !next.cardio.length;
  if (empty) removeEntry(date);
  else upsertEntry(next);
}

/** ÅÅÅÅ-MM-DD och ett datum som faktiskt finns. */
export function isIsoDate(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function loadLog() {
  const saved = load(LOG_KEY, null);
  if (saved && Array.isArray(saved.entries)) entries = saved.entries.map(cleanEntry).filter(Boolean);
}
const saveLog = () => save(LOG_KEY, { entries });
const sortEntries = () => entries.sort((a, b) => (a.date < b.date ? -1 : 1));

/** Lägg till eller ersätt posten för ett datum. */
export function upsertEntry(entry) {
  const i = entries.findIndex((x) => x.date === entry.date);
  if (i >= 0) entries[i] = entry;
  else entries.push(entry);
  sortEntries();
  saveLog();
}

export function removeEntry(date) {
  entries = entries.filter((x) => x.date !== date);
  saveLog();
}

export const entryFor = (date) => entries.find((x) => x.date === date);



// ---------- Statistik ----------

/** Medelvikt för de sju dagarna fram till och med `day`. */
export function sevenDayAverage(weighIns, day) {
  const xs = weighIns.filter((e) => e.day > day - 7 && e.day <= day);
  return xs.length ? xs.reduce((a, e) => a + e.weight, 0) / xs.length : null;
}

/** Lutning i kg per dag med minsta kvadratmetoden. */
function slope(points) {
  const n = points.length;
  const mx = points.reduce((a, p) => a + p.day, 0) / n;
  const my = points.reduce((a, p) => a + p.weight, 0) / n;
  const sxx = points.reduce((a, p) => a + (p.day - mx) ** 2, 0);
  return sxx ? points.reduce((a, p) => a + (p.day - mx) * (p.weight - my), 0) / sxx : 0;
}

/**
 * Nyckeltal för loggen. `planKgPerWeek` är planens takt och `goal` målvikten (kan vara null).
 * Takten räknas på de senaste tre veckorna och kräver minst fyra vägningar över tio dagar.
 */
export function logStats(planKgPerWeek, goal) {
  const weighIns = entries.filter((e) => e.weight != null).map((e) => ({ ...e, day: dateToDay(e.date) }));
  const stats = { weighIns, goal, planKgPerWeek };
  if (!weighIns.length) return stats;

  const last = weighIns[weighIns.length - 1];
  stats.start = weighIns[0];
  stats.last = last;
  stats.nowAvg = sevenDayAverage(weighIns, last.day);

  const recent = weighIns.filter((e) => e.day > last.day - 21);
  const span = recent[recent.length - 1].day - recent[0].day;
  if (recent.length >= 4 && span >= 10) {
    stats.rateKgPerWeek = slope(recent) * 7;
    stats.ratePct = (-stats.rateKgPerWeek / stats.nowAvg) * 100;
    stats.rateDays = span;
  }

  const today = dateToDay(todayStr());
  const avgMood = (from, to) => {
    const xs = entries.filter((e) => e.mood != null && dateToDay(e.date) > from && dateToDay(e.date) <= to);
    return xs.length ? xs.reduce((a, e) => a + e.mood, 0) / xs.length : null;
  };
  stats.mood7 = avgMood(today - 7, today);
  stats.moodPrev = avgMood(today - 14, today - 7);

  const last30 = entries.filter((e) => e.perf != null && dateToDay(e.date) > today - 30);
  stats.perf = { up: last30.filter((e) => e.perf === 1).length, same: last30.filter((e) => e.perf === 0).length, down: last30.filter((e) => e.perf === -1).length };

  // Intensitetsminuter de senaste 7 dagarna (i dag och 6 dagar bakåt)
  const week = entries.filter((e) => intensityMinutes(e) != null && dateToDay(e.date) > today - 7 && dateToDay(e.date) <= today);
  stats.intensity7 = week.length ? week.reduce((sum, e) => sum + intensityMinutes(e), 0) : null;

  // Kondition: aktiviteten som loggats flest gånger, jämförd på tempo (första, senaste och bästa passet)
  const passes = entries.flatMap((e) => e.cardio.map((c) => ({ ...c, date: e.date })));
  if (passes.length) {
    const counts = {};
    for (const p of passes) counts[p.a] = (counts[p.a] || 0) + 1;
    const a = Object.keys(counts).reduce((x, y) => (counts[y] > counts[x] ? y : x));
    const list = passes.filter((p) => p.a === a);
    stats.cardio = { a, count: list.length, first: list[0], last: list[list.length - 1], best: list.reduce((x, p) => (secondsPerKm(p) < secondsPerKm(x) ? p : x)) };
  }
  const tests = entries.filter((e) => e.test != null);
  if (tests.length) {
    stats.testFirst = tests[0];
    stats.testLast = tests[tests.length - 1];
    stats.testBest = tests.reduce((a, e) => (e.test < a.test ? e : a));
  }

  if (goal && stats.nowAvg) {
    stats.toGoal = stats.nowAvg - goal;
    const losing = stats.rateKgPerWeek != null && stats.rateKgPerWeek < -0.05;
    const kgPerWeek = losing ? -stats.rateKgPerWeek : planKgPerWeek;
    stats.goalBasis = losing ? "din takt" : "planens takt";
    if (stats.toGoal > 0 && kgPerWeek > 0) stats.goalDate = dayToDate(Math.round(last.day + (stats.toGoal / kgPerWeek) * 7));
  }
  return stats;
}

