// Rapport: en överskådlig sammanställning av allt loggat för en period, att visa en personlig tränare, dietist eller
// läkare. Sidan har en egen utskriftslayout, så den kan skrivas ut eller sparas som PDF.

import { $, esc, fmt, signed, todayStr, dateToDay, dayToDate, mondayOf, isoWeekNumber, DAY_MS } from "../util.js";
import { entries, sevenDayAverage, CARDIO, paceText, secondsPerKm, cardioText, intensityMinutes, WEEKLY_INTENSITY_GOAL, formatHms } from "../log.js";
import { parseClock, fastingHours, formatDuration } from "../fasting.js";
import { bmiOf } from "../nutrition.js";
import { tile } from "./components.js";

const EPOCH_DAY = Date.UTC(2024, 0, 1) / DAY_MS; // veckor räknas från måndagen 2024-01-01, som i util.js
const weekOfDay = (day) => Math.floor((day - EPOCH_DAY) / 7);
const value = (v, d = 1) => (v != null ? fmt(v, d) : "–");
const average = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Fastan natten efter en dag i timmar: från dagens sista måltid till nästa dags första. */
function nightFast(e, byDate) {
  const last = parseClock(e.lastMeal);
  const next = parseClock(byDate.get(dayToDate(dateToDay(e.date) + 1))?.firstMeal);
  return last != null && next != null ? fastingHours(last, next) : null;
}

/**
 * Rita rapporten. `period` = "all" eller antal dagar bakåt ("84", "28"). `profile`, `targets` och `labels`
 * (texter för aktivitetsnivå, utrustning och gymdagar) kommer från Profil.
 */
export function renderReport({ period, profile, targets, labels }) {
  const today = dateToDay(todayStr());
  const from = period === "all" ? -Infinity : today - Number(period) + 1;
  const list = entries.filter((e) => dateToDay(e.date) >= from && dateToDay(e.date) <= today);
  const byDate = new Map(entries.map((e) => [e.date, e]));
  const allWeighIns = entries.filter((e) => e.weight != null).map((e) => ({ ...e, day: dateToDay(e.date) }));
  const weighIns = allWeighIns.filter((e) => e.day >= from);

  $("rp-period-text").textContent = list.length
    ? `${list[0].date} – ${list[list.length - 1].date} · ${list.length} loggade dagar`
    : "Inga loggade dagar i perioden. Logga under Logg så fylls rapporten i.";
  renderSummary(weighIns, allWeighIns, list, profile, targets);
  drawChart(weighIns, allWeighIns, profile.goal);
  renderWeeks(list, allWeighIns, byDate);
  renderCardio(list);
  renderProfile(profile, targets, labels);
  renderDays(list, allWeighIns, byDate);
  $("rp-foot").textContent = `Skapad ${todayStr()} med Fettförbränningsveckan. Rekommendationer baserade på ExRx, inte medicinsk rådgivning. Uppgifterna är egenrapporterade.`;
}

function renderSummary(weighIns, allWeighIns, list, profile, targets) {
  const first = weighIns[0], last = weighIns[weighIns.length - 1];
  const nowAvg = last ? sevenDayAverage(allWeighIns, last.day) : null;
  const change = first ? nowAvg - first.weight : null;
  const weeks = first && last ? (last.day - first.day) / 7 : 0;
  const waists = list.filter((e) => e.waist != null);
  const moods = list.filter((e) => e.mood != null).map((e) => e.mood);
  const passes = list.flatMap((e) => e.cardio);
  const im = list.map(intensityMinutes).filter((x) => x != null);
  const imWeeks = Math.max(1, Math.ceil((dateToDay(list[list.length - 1]?.date ?? todayStr()) - dateToDay(list[0]?.date ?? todayStr()) + 1) / 7));
  const h = profile.height;

  $("rp-tiles").innerHTML =
    tile({ label: "Startvikt", value: value(first?.weight), unit: first ? "kg" : "", sub: first ? first.date : "Ingen vägning i perioden" }) +
    tile({ label: "Nu, 7-dagarssnitt", value: value(nowAvg), unit: last ? "kg" : "", sub: last ? `Senast vägd ${last.date}` : "–" }) +
    tile({ label: "Förändring", value: change != null ? signed(change) : "–", unit: change != null ? "kg" : "",
      sub: change != null ? `${signed((change / first.weight) * 100)} % · ${weeks >= 1 ? `${signed(change / weeks, 2)} kg/vecka` : "under en vecka"}` : "–",
      subClass: change < 0 ? "down" : change > 0 ? "up" : "" }) +
    tile({ label: "Midja", value: waists.length ? value(waists[waists.length - 1].waist) : "–", unit: waists.length ? "cm" : "",
      sub: waists.length > 1 ? `${signed(waists[waists.length - 1].waist - waists[0].waist)} cm sedan ${waists[0].date}` : waists.length ? waists[0].date : "Inte loggad" }) +
    tile({ label: "BMI", value: nowAvg && h ? fmt(bmiOf(nowAvg, h), 1) : "–", sub: first && h ? `Start ${fmt(bmiOf(first.weight, h), 1)} · normalvikt 18,5–24,9` : "–" }) +
    tile({ label: "Målvikt", value: value(profile.goal), unit: profile.goal ? "kg" : "",
      sub: profile.goal && nowAvg ? (nowAvg > profile.goal ? `${fmt(nowAvg - profile.goal, 1)} kg kvar` : "Nådd") : `Kalorimål ${fmt(targets.target)} kcal/dag` }) +
    tile({ label: "Mående", value: moods.length ? fmt(average(moods), 1) : "–", unit: moods.length ? "av 5" : "", sub: `${moods.length} dagar loggade` }) +
    tile({ label: "Konditionspass", value: passes.length, sub: passes.length ? `${fmt(passes.reduce((a, c) => a + c.km, 0), 1)} km på ${formatHms(passes.reduce((a, c) => a + c.s, 0))}` : "Inga pass loggade" }) +
    tile({ label: "Intensitetsminuter", value: im.length ? fmt(im.reduce((a, b) => a + b, 0) / imWeeks) : "–", unit: im.length ? "min/vecka" : "",
      sub: im.length ? `snitt per vecka · WHO rekommenderar minst ${WEEKLY_INTENSITY_GOAL}` : "Inte loggade" });
}

function drawChart(weighIns, allWeighIns, goal) {
  const W = 640, H = 240, L = 44, R = 70, T = 14, B = 28;
  const svg = $("rp-chart");
  if (weighIns.length < 2) {
    svg.innerHTML = `<text class="empty" x="${W / 2}" y="${H / 2}" text-anchor="middle">Minst två vägningar behövs för en kurva</text>`;
    return;
  }
  const x0 = weighIns[0].day, x1 = Math.max(weighIns[weighIns.length - 1].day, x0 + 7);
  const values = [...weighIns.map((e) => e.weight), ...(goal ? [goal] : [])];
  const y0 = Math.floor(Math.min(...values) - 1), y1 = Math.ceil(Math.max(...values) + 1);
  const sx = (d) => L + ((d - x0) / (x1 - x0)) * (W - L - R);
  const sy = (v) => T + ((y1 - v) / (y1 - y0)) * (H - T - B);
  let g = "";
  const yStep = y1 - y0 > 12 ? 4 : y1 - y0 > 6 ? 2 : 1;
  for (let v = Math.ceil(y0 / yStep) * yStep; v <= y1; v += yStep) g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${sy(v)}" y2="${sy(v)}"/><text class="axis" x="${L - 6}" y="${sy(v) + 4}" text-anchor="end">${v}</text>`;
  const span = x1 - x0, xStep = span > 240 ? 56 : span > 120 ? 28 : span > 50 ? 14 : 7;
  for (let d = x0; d <= x1; d += xStep) g += `<text class="axis" x="${sx(d)}" y="${H - 8}" text-anchor="middle">${dayToDate(d).slice(5)}</text>`;
  if (goal && goal > y0 && goal < y1) g += `<line class="goal" x1="${L}" x2="${W - R}" y1="${sy(goal)}" y2="${sy(goal)}"/><text class="lbl" x="${W - R + 6}" y="${sy(goal) + 4}">Mål ${fmt(goal, 1)}</text>`;
  for (const e of weighIns) g += `<circle class="raw" cx="${sx(e.day)}" cy="${sy(e.weight)}" r="3"/>`;
  g += `<path class="avg" d="${weighIns.map((e, i) => `${i ? "L" : "M"}${sx(e.day).toFixed(1)} ${sy(sevenDayAverage(allWeighIns, e.day)).toFixed(1)}`).join(" ")}"/>`;
  svg.innerHTML = g;
}

function renderWeeks(list, allWeighIns, byDate) {
  const weeks = new Map();
  for (const e of list) {
    const w = weekOfDay(dateToDay(e.date));
    if (!weeks.has(w)) weeks.set(w, []);
    weeks.get(w).push(e);
  }
  let previous = null;
  const rows = [...weeks.entries()].map(([w, days]) => {
    const weights = days.filter((e) => e.weight != null).map((e) => e.weight);
    const avgWeight = average(weights);
    const change = avgWeight != null && previous != null ? avgWeight - previous : null;
    if (avgWeight != null) previous = avgWeight;
    const waists = days.filter((e) => e.waist != null);
    const moods = days.filter((e) => e.mood != null).map((e) => e.mood);
    const passes = days.flatMap((e) => e.cardio);
    const im = days.map(intensityMinutes).filter((x) => x != null);
    const imSum = im.reduce((a, b) => a + b, 0);
    const fasts = days.map((e) => nightFast(e, byDate)).filter((x) => x != null);
    return `<tr><td>v. ${isoWeekNumber(mondayOf(w))}<small class="block">${mondayOf(w).toISOString().slice(0, 10)}</small></td>` +
      `<td class="num">${value(avgWeight)}</td><td class="num">${change != null ? signed(change) : "–"}</td>` +
      `<td class="num">${waists.length ? value(waists[waists.length - 1].waist) : "–"}</td><td class="num">${moods.length ? fmt(average(moods), 1) : "–"}</td>` +
      `<td class="num">${passes.length || "–"}</td><td class="num">${passes.length ? fmt(passes.reduce((a, c) => a + c.km, 0), 1) + " km" : "–"}</td>` +
      `<td class="num">${im.length ? `${fmt(imSum)}${imSum >= WEEKLY_INTENSITY_GOAL ? " ✓" : ""}` : "–"}</td>` +
      `<td class="num">${fasts.length ? formatDuration(average(fasts)) : "–"}</td></tr>`;
  });
  $("rp-weeks").innerHTML = rows.length
    ? `<thead><tr><th>Vecka</th><th>Snittvikt</th><th>Mot veckan innan</th><th>Midja</th><th>Mående</th><th>Pass</th><th>Distans</th><th>Intensitetsmin. (mål ${WEEKLY_INTENSITY_GOAL})</th><th>Fasta, snitt</th></tr></thead><tbody>${rows.join("")}</tbody>`
    : `<tbody><tr><td class="note">Inga loggade veckor i perioden.</td></tr></tbody>`;
}

function renderCardio(list) {
  const passes = list.flatMap((e) => e.cardio.map((c) => ({ ...c, date: e.date })));
  const rows = Object.keys(CARDIO).map((a) => {
    const xs = passes.filter((p) => p.a === a);
    if (!xs.length) return "";
    const best = xs.reduce((x, p) => (secondsPerKm(p) < secondsPerKm(x) ? p : x));
    const maxHr = Math.max(0, ...xs.map((p) => p.hrMax || 0));
    return `<tr><td>${CARDIO[a].n}</td><td class="num">${xs.length}</td><td class="num">${fmt(xs.reduce((s, p) => s + p.km, 0), 1)} km</td>` +
      `<td class="num">${formatHms(xs.reduce((s, p) => s + p.s, 0))}</td><td class="num">${paceText(xs[0])}</td><td class="num">${paceText(xs[xs.length - 1])}</td>` +
      `<td class="num">${paceText(best)}<small class="block">${best.date}</small></td><td class="num">${maxHr || "–"}</td></tr>`;
  }).join("");
  $("rp-cardio").innerHTML = rows
    ? `<thead><tr><th>Aktivitet</th><th>Pass</th><th>Distans</th><th>Tid</th><th>Tempo, första</th><th>Tempo, senaste</th><th>Bästa tempo</th><th>Högsta maxpuls</th></tr></thead><tbody>${rows}</tbody>`
    : `<tbody><tr><td class="note">Inga konditionspass i perioden.</td></tr></tbody>`;
}

function renderProfile(profile, targets, labels) {
  const row = (term, desc) => `<dt>${term}</dt><dd>${desc}</dd>`;
  $("rp-profile").innerHTML =
    row("Kön och ålder", `${profile.sex === "k" ? "Kvinna" : "Man"}, ${profile.age} år`) +
    row("Längd och vikt i profilen", `${fmt(profile.height)} cm, ${fmt(profile.weight, 1)} kg${profile.bodyFat ? `, kroppsfett ${fmt(profile.bodyFat, 1)} %` : ""}`) +
    row("Vardagsaktivitet", esc(labels.activity)) +
    row("Takt", `${String(profile.rate).replace(".", ",")} % av vikten per vecka`) +
    row("Kalorimål", `${fmt(targets.target)} kcal/dag (underhåll ca ${fmt(targets.tdee)} kcal)`) +
    row("Makron per dag", `protein ${targets.protein} g, kolhydrater ${targets.carbs} g, fett ${targets.fat} g`) +
    row("Målvikt", profile.goal ? `${fmt(profile.goal, 1)} kg` : "–") +
    row("Träning", esc(`${labels.equipment}, ${labels.days}`)) +
    row("Fasta", `16:8, frukost ${labels.breakfast}`);
}

function renderDays(list, allWeighIns, byDate) {
  const perf = (p) => (p === 1 ? "Bättre" : p === 0 ? "Samma" : p === -1 ? "Sämre" : "–");
  $("rp-days").innerHTML = list.length
    ? `<thead><tr><th>Datum</th><th>Vikt</th><th>7-d snitt</th><th>Midja</th><th>Mående</th><th>Prestation</th><th>Kondition</th><th>Intensitetsmin.</th><th>Måltider</th><th>Fasta efter</th><th>Anteckning</th></tr></thead><tbody>` +
      list.slice().reverse().map((e) =>
        `<tr><td class="num">${e.date}</td><td class="num">${value(e.weight)}</td><td class="num">${value(e.weight != null ? sevenDayAverage(allWeighIns, dateToDay(e.date)) : null)}</td>` +
        `<td class="num">${value(e.waist)}</td><td class="num">${e.mood ?? "–"}</td><td>${perf(e.perf)}</td>` +
        `<td>${e.cardio.length ? e.cardio.map((c) => esc(cardioText(c))).join("<br>") : "–"}</td><td class="num">${intensityMinutes(e) ?? "–"}</td>` +
        `<td class="num">${e.firstMeal || e.lastMeal ? `${e.firstMeal || "?"}–${e.lastMeal || "?"}` : "–"}</td><td class="num">${nightFast(e, byDate) != null ? formatDuration(nightFast(e, byDate)) : "–"}</td><td>${esc(e.note)}</td></tr>`).join("") +
      `</tbody>`
    : `<tbody><tr><td class="note">Inga loggade dagar i perioden.</td></tr></tbody>`;
}
