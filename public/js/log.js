// Loggen: dagliga poster, statistik och synk till claude-kontot.
// Poster sparas i webbläsaren. I den publicerade claude-sidan sparas de även privat i användarens konto
// (db-capability, data/users/<id>), så att loggen följer med mellan enheter.

import { load, save, dateToDay, dayToDate, todayStr } from "./util.js";

const LOG_KEY = "ffv-log";
export let entries = [];

// ---------- Poster ----------

/** Kontrollera och städa en post. Ger null om datumet saknas eller är felaktigt. */
export function cleanEntry(e) {
  if (!e || !isIsoDate(e.date)) return null;
  const inRange = (x, lo, hi) => (typeof x === "number" && x >= lo && x <= hi ? x : null);
  const perf = [1, 0, -1].includes(e.perf) ? e.perf : null;
  return {
    date: e.date,
    weight: inRange(e.weight, 30, 300),
    waist: inRange(e.waist, 40, 200),
    mood: inRange(e.mood, 1, 5),
    perf,
    trained: e.trained !== false && perf !== null,
    test: inRange(e.test, 1, 36000),
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
  const empty = ["weight", "waist", "mood", "perf", "test", "firstMeal", "lastMeal"].every((k) => next[k] == null) && !next.note;
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
export function upsertEntry(entry, { sync = true } = {}) {
  const i = entries.findIndex((x) => x.date === entry.date);
  if (i >= 0) entries[i] = entry;
  else entries.push(entry);
  sortEntries();
  saveLog();
  if (sync) cloudWrite([entry]);
}

export function removeEntry(date) {
  const entry = entries.find((x) => x.date === date);
  entries = entries.filter((x) => x.date !== date);
  saveLog();
  if (entry) cloudWrite([entry], true);
}

export function importEntries(list) {
  const clean = list.map(cleanEntry).filter(Boolean);
  for (const e of clean) upsertEntry(e, { sync: false });
  cloudWrite(clean);
  return clean.length;
}

export const entryFor = (date) => entries.find((x) => x.date === date);

/** Testtid "18:45" eller "18" (minuter) → sekunder. null om det inte går att tolka. */
export function parseTestTime(text) {
  const t = String(text || "").trim();
  const m = t.match(/^(\d{1,3})[:.,](\d{1,2})$/);
  if (m) return +m[1] * 60 + +m[2];
  return /^\d+$/.test(t) ? +t * 60 : null;
}
export const formatTestTime = (seconds) => (seconds == null ? "–" : `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`);

// ---------- Synk till claude-kontot (bara i den publicerade sidan) ----------

let cloud = null;
let onCloudChange = () => {};
let onStatus = () => {};

async function cloudWrite(list, remove = false) {
  if (!cloud) return;
  for (const e of list) {
    try {
      const ref = cloud.doc("d-" + e.date);
      await (remove ? ref.delete() : ref.set(e));
    } catch {
      cloud = null;
      onStatus("Kunde inte spara i kontot just nu. Loggen sparas i den här webbläsaren.");
      return;
    }
  }
}

/**
 * Anslut till kontots privata lagring om sidan körs på claude.ai. Lokala poster som saknas i kontot laddas upp.
 * `changed` anropas när loggen ändrats utifrån, `status` med en text om var loggen sparas.
 */
export async function connectCloud({ changed, status }) {
  onCloudChange = changed;
  onStatus = status;
  try {
    if (typeof window.claude?.use !== "function") return;
    const [db, user] = await Promise.all([window.claude.use("db"), window.claude.use("user")]);
    const uid = db && user ? await user.id() : null;
    if (!uid) return;
    const collection = db.collection("data/users/" + uid);
    let first = true;
    collection.onSnapshot(
      (snap) => {
        const remote = snap.docs.filter((d) => d.id.startsWith("d-")).map((d) => cleanEntry(d.data())).filter(Boolean);
        if (first) {
          first = false;
          cloud = collection;
          onStatus("Loggen sparas privat i ditt claude-konto och i den här webbläsaren. Bara du kan se den.");
          const known = new Set(remote.map((e) => e.date));
          const localOnly = entries.filter((e) => !known.has(e.date));
          entries = remote;
          for (const e of localOnly) upsertEntry(e, { sync: false });
          if (localOnly.length) cloudWrite(localOnly);
        } else {
          entries = remote;
          sortEntries();
        }
        saveLog();
        onCloudChange();
      },
      () => {
        cloud = null;
        onStatus("Loggen sparas i den här webbläsaren. Exportera då och då som säkerhetskopia.");
      },
    );
  } catch {
    /* ingen claude-miljö: loggen finns bara lokalt */
  }
}

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

