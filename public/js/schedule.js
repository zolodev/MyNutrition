// Veckoschema: när varje aktivitet ligger varje veckodag – gympass, intervaller, promenad och egna aktiviteter
// (t.ex. promenad till och från jobbet). Ingen tid är hårdkodad: utan eget schema föreslår appen tider räknat från
// frukosten (day.js), och allt går att flytta, slå av och på eller lägga till under Inställningar → Veckoschema.
// Råden i scheduleAdvice() förklarar vad som är bra eller mindre bra, men blockerar aldrig något.
//
// Vilka dagar som är gymdagar bestäms av Gymdagar i profilen (tdays); här bestäms bara tiderna.
// Data: "ffv-schedule" = { days: { "0": { str, int, walk, extra } } } (0 = måndag). Ett fält som saknas betyder
// planens förslag; `false` betyder avslaget; { from, to, label? } är en egen tid. `session` (från 0.15.0) är ett
// valt gympass för dagen, t.ex. "H" för helkropp (se applyChoices i training.js). Okända fält behålls.
// `extra` = [{ label, from, to, hard? }]: egna aktiviteter och pass. `hard: true` (från 0.20.0) markerar ett hårt pass
// som CrossFit eller Hyrox, som räknas som träning i råden; saknas fältet är det en lättare aktivitet.

import { load, save } from "./util.js";
import { parseClock } from "./fasting.js";
import { STRENGTH, INTERVALS, WINDOW, MEAL_AT } from "./day.js";
import { customTime } from "./trainingtimes.js"; // egna träningstider från 0.8.0, läses fortfarande

const KEY = "ffv-schedule";
export const KINDS = { str: "Gympass", int: "Intervaller", walk: "Promenad", other: "Egen aktivitet" };

let saved = load(KEY, null) || {};
const days = () => (saved.days && typeof saved.days === "object" ? saved.days : {});

// ---------- Arbetstid ----------
// { from, to, days: [0–6] } i "ffv-schedule".work, t.ex. 08:00–17:00 måndag–fredag. Förslagen läggs utanför
// arbetstiden, och scheduleAdvice() varnar när något krockar med den.

/** Arbetstiden ({ from, to, days } med tider som "HH:MM"), eller null. */
export function getWork() {
  const w = saved.work;
  return w && parseClock(w.from) != null && parseClock(w.to) != null && parseClock(w.to) > parseClock(w.from) && Array.isArray(w.days) ? w : null;
}
/** Spara arbetstiden, eller ta bort den med null. */
export function setWork(work) {
  saved = { ...saved };
  if (work) saved.work = { from: work.from, to: work.to, days: [...new Set(work.days)].filter((d) => d >= 0 && d <= 6).sort() };
  else delete saved.work;
  save(KEY, saved);
}
/** Arbetstiden en veckodag i timmar ({ from, to }), eller null. */
export function workOn(day) {
  const w = getWork();
  return w && w.days.includes(day) ? { from: parseClock(w.from), to: parseClock(w.to) } : null;
}
/** Flytta ett förslag som krockar med arbetstiden till efter den (en halvtimme efter arbetsdagens slut). */
function outsideWork(time, work) {
  if (!time || !work || time.to <= work.from || time.from >= work.to) return time;
  const start = work.to + 0.5;
  return { from: start, to: start + (time.to - time.from) };
}

/** Användarens egna inställningar för en veckodag (tomt objekt = planens förslag). */
export const dayOverrides = (day) => days()[day] || {};
export const hasOverrides = (day) => Object.keys(dayOverrides(day)).length > 0;

function store(day, change) {
  const next = { ...dayOverrides(day) };
  change(next);
  saved = { ...saved, days: { ...days(), [day]: next } };
  if (!Object.keys(next).length) delete saved.days[day];
  save(KEY, saved);
}

/**
 * Sätt en aktivitet en veckodag: `value` = { from, to, label? } (egen tid), `false` (avslagen) eller `undefined`
 * (tillbaka till planens förslag).
 */
export function setActivity(day, kind, value) {
  store(day, (d) => (value === undefined ? delete d[kind] : (d[kind] = value)));
}

/** Egna aktiviteter en veckodag: [{ label, from, to }]. */
export function setExtras(day, list) {
  store(day, (d) => (list.length ? (d.extra = list) : delete d.extra));
}

const sameLabel = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
const extrasOn = (day) => (Array.isArray(dayOverrides(day).extra) ? dayOverrides(day).extra : []);

/**
 * Lägg in ett eget pass ({ label, from, to, hard }) på flera veckodagar, t.ex. CrossFit onsdag, fredag och lördag.
 * Finns ett pass med samma namn redan en av dagarna ersätts det, så att det inte blir dubbelt.
 */
export function addExtraOnDays(dayList, x) {
  for (const day of dayList) setExtras(day, [...extrasOn(day).filter((e) => !sameLabel(e.label, x.label)), { ...x }]);
}

/** Ta bort ett eget pass (på namnet) från alla veckodagar. */
export function removeExtraEverywhere(label) {
  for (let day = 0; day < 7; day++) if (extrasOn(day).some((e) => sameLabel(e.label, label))) setExtras(day, extrasOn(day).filter((e) => !sameLabel(e.label, label)));
}

/** Egna pass per namn: [{ label, hard, times: [{ day, from, to }] }], i veckodagsordning. */
export function ownSessions() {
  const out = [];
  for (let day = 0; day < 7; day++) for (const e of extrasOn(day)) {
    if (!e || !e.label) continue;
    let s = out.find((x) => sameLabel(x.label, e.label));
    if (!s) out.push((s = { label: e.label, hard: false, times: [] }));
    s.hard = s.hard || e.hard === true;
    s.times.push({ day, from: e.from, to: e.to });
  }
  return out;
}

/** Valda gympass per veckodag: { dag: pass-id }, t.ex. { 5: "H" }. */
export function sessionChoices() {
  const out = {};
  for (const [d, o] of Object.entries(days())) if (typeof o?.session === "string") out[Number(d)] = o.session;
  return out;
}

/** Välj gympass för en veckodag, eller låt planen välja med undefined. */
export function setSession(day, id) {
  store(day, (d) => (id ? (d.session = id) : delete d.session));
}

/**
 * Passupplägg i "ffv-schedule".split: "auto" (appens förslag: helkropp, överkropp och ben eller över/under-split)
 * eller "full" (helkropp varje pass, oavsett antal dagar). Saknas fältet gäller "auto".
 */
export const getSplit = () => (saved.split === "full" ? "full" : "auto");
export function setSplit(split) {
  saved = { ...saved };
  if (split === "full") saved.split = "full";
  else delete saved.split;
  save(KEY, saved);
}

// ---------- Flyttade pass en enskild vecka ----------
// "ffv-trainmoves" = { vecka: [[frånDag, tillDag], …] }: t.ex. när man inte kan träna en dag. Gäller bara den veckan;
// gymdagarna i profilen ändras inte. Dagarna byter plats i tur och ordning (buildProgram i training.js).

const MOVES_KEY = "ffv-trainmoves";
let moves = load(MOVES_KEY, {}) || {};

/** Veckans flyttade pass: [[frånDag, tillDag], …]. */
export const trainMovesFor = (week) => (Array.isArray(moves[week]) ? moves[week].filter((m) => Array.isArray(m) && m.length === 2) : []);

/** Flytta veckans pass från en dag till en annan (dagarna byter plats). */
export function addTrainMove(week, from, to) {
  moves = { ...moves, [week]: [...(Array.isArray(moves[week]) ? moves[week] : []), [from, to]] };
  save(MOVES_KEY, moves);
}

/** Ta bort veckans flyttar, så att passen ligger enligt planen igen. */
export function resetTrainMoves(week) {
  moves = { ...moves };
  delete moves[week];
  save(MOVES_KEY, moves);
}

/** Ta bort alla egna inställningar för en veckodag. */
export function resetDay(day) {
  store(day, (d) => Object.keys(d).forEach((k) => delete d[k]));
}

const hours = (t) => {
  const from = parseClock(t?.from), to = parseClock(t?.to);
  return from != null && to != null && to > from ? { from, to } : null;
};

/**
 * Planens förslag för en veckodag, i timmar efter midnatt. `kind` = dagens typ i programmet ("str", "int" eller
 * "rest"), `breakfast` = frukosten i timmar.
 */
export function suggestion(day, kind, breakfast) {
  const own = hours(customTime(day)); // egen tid från 0.8.0 (Profil → Träningstider)
  const work = workOn(day);
  return {
    str: kind === "str" ? own || outsideWork({ from: breakfast + STRENGTH[0], to: breakfast + STRENGTH[1] }, work) : null,
    int: kind === "int" ? outsideWork({ from: breakfast + INTERVALS[0], to: breakfast + INTERVALS[1] }, work) : null,
    // Promenad 20–30 min efter eftermiddagsmåltiden sänker blodsockret; på vilodagar föreslås den alltid
    walk: kind === "rest" ? outsideWork({ from: breakfast + WINDOW, to: breakfast + WINDOW + 0.5 }, work) : null,
  };
}

/**
 * Dagens aktiviteter, sorterade på tid: [{ kind, label, from, to, custom }]. Egna tider och val går före planens
 * förslag. Gympass finns bara på gymdagar (Profil → Gymdagar).
 */
export function daySchedule(day, kind, breakfast) {
  const o = dayOverrides(day);
  const plan = suggestion(day, kind, breakfast);
  const items = [];
  const add = (k, value, label) => {
    if (value === false) return;
    const own = hours(value);
    const time = own || plan[k];
    if (time) items.push({ kind: k, label: (own && value.label) || label, ...time, custom: !!own });
  };
  if (kind === "str") add("str", o.str, KINDS.str);
  add("int", o.int, KINDS.int);
  add("walk", o.walk, KINDS.walk);
  for (const x of Array.isArray(o.extra) ? o.extra : []) {
    const t = hours(x);
    if (t) items.push({ kind: "other", label: x.label || KINDS.other, ...t, custom: true, hard: x.hard === true });
  }
  return items.sort((a, b) => a.from - b.from);
}

/** Det första passet en dag (gympass eller intervaller), eller null. Används för PWO och vassle. */
export const workoutOf = (items) => items.find((x) => x.kind === "str") || items.find((x) => x.kind === "int") || items.find((x) => x.hard) || null;

const clock = (h) => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;

/**
 * Råd för en dag: [{ level: "warn" | "tip", text }] med motivering. Blockerar aldrig.
 * `eat` = { from, to } ätfönstret i timmar, `nextIsLegs` = nästa dag är ett benpass, `work` = arbetstiden i timmar.
 */
export function scheduleAdvice(items, { eat, nextIsLegs = false, work = null }) {
  const advice = [];
  for (const x of work ? items.filter((i) => i.from < work.to && i.to > work.from && i.kind !== "walk") : []) {
    advice.push({ level: "warn", text: `${x.label} ${clock(x.from)}–${clock(x.to)} krockar med arbetstiden ${clock(work.from)}–${clock(work.to)}. Flytta den till före eller efter jobbet.` });
  }
  const str = items.find((x) => x.kind === "str"), int = items.find((x) => x.kind === "int");
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    if (items[j].from < items[i].to) advice.push({ level: "warn", text: `${items[i].label} och ${items[j].label.toLowerCase()} överlappar (${clock(items[j].from)}). Flytta en av dem.` });
  }
  if (str && str.to > eat.to) advice.push({ level: "warn", text: `Gympasset slutar ${clock(str.to)}, efter att ätfönstret stängt ${clock(eat.to)}. Proteinet efter passet bryter då fastan. Flytta frukosten senare de här dagarna, så flyttas ätfönstret med, eller ta proteinet före ${clock(eat.to)}.` });
  if (str && str.to <= eat.from) advice.push({ level: "tip", text: "Du tränar före första måltiden, alltså fastande. Det går bra för de flesta; ät proteinrikt direkt efter passet." });
  if (str && int) advice.push({ level: "warn", text: "Intervaller och gympass samma dag: kör intervallerna efter gympasset, eller en annan dag, så att styrkan inte påverkas (intervaller före styrka ger sämre pass)." });
  if (int && nextIsLegs) advice.push({ level: "tip", text: "Intervaller dagen före ett benpass kan ge trötta ben. Lägg dem hellre efter benpasset eller på en annan dag." });
  // Hårda egna pass (CrossFit, Hyrox …) belastar hela kroppen som ett extra träningspass
  const hard = items.find((x) => x.hard);
  if (hard && str) advice.push({ level: "warn", text: `${hard.label} och gympass samma dag blir två hårda pass. Kör gympasset lättare (färre set), eller flytta gymdagen under Profil → Gymdagar så att du får minst en vilodag i veckan.` });
  if (hard && int) advice.push({ level: "tip", text: `${hard.label} är redan ett hårt konditionspass. Hoppa över intervallerna den här dagen.` });
  if (hard && nextIsLegs && !str) advice.push({ level: "tip", text: `${hard.label} dagen före ett benpass kan ge trötta ben. Kör benpasset lite lättare, eller byt pass för dagen efter.` });
  if (hard && hard.to > eat.to) advice.push({ level: "tip", text: `${hard.label} slutar ${clock(hard.to)}, efter att ätfönstret stängt ${clock(eat.to)}, så proteinet efter passet bryter fastan. Flytta frukosten senare de här dagarna (ätfönstret flyttas med), eller ät proteinrikt före ${clock(eat.to)}.` });
  const late = [str, int, hard].filter(Boolean).find((x) => x.to > 21);
  if (late) advice.push({ level: "tip", text: `${late.label} slutar sent (${clock(late.to)}). Hård träning sent kan försämra sömnen; välj koffeinfri PWO.` });
  const walk = items.find((x) => x.kind === "walk");
  if (walk && eat.from + MEAL_AT <= walk.from && walk.from <= eat.from + MEAL_AT + 1.5) advice.push({ level: "tip", text: "Bra: en promenad strax efter eftermiddagsmåltiden sänker blodsockret." });
  return advice;
}
