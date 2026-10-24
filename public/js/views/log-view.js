// Logg: nyckeltal, viktkurva, råd och tabell.

import { $, esc, fmt, signed, todayStr, dateToDay, dayToDate, svDate } from "../util.js";
import { entries, entryFor, logStats, sevenDayAverage, formatHms, CARDIO, paceText, secondsPerKm, cardioText, intensityMinutes, WEEKLY_INTENSITY_GOAL, MEAL_NAMES } from "../log.js";
import { parseClock, fastingHours, formatDuration } from "../fasting.js";
import { tile } from "./components.js";
import { goalFor, hasGoal, weekProgress, bestEstimate } from "../goals.js";

/** Anteckningen och dagens ersatta måltider, t.ex. "Eftermiddagsmåltid: Huel shake (400 kcal)". */
const noteText = (e) => [e.note, ...(e.swaps || []).map((x) => `${MEAL_NAMES[x.meal]}: ${x.n} (${fmt(x.k)} kcal)`),
  e.eaten?.length ? `Ätit: ${e.eaten.map((m) => MEAL_NAMES[m].toLowerCase()).join(", ")}` : ""].filter(Boolean).join(" · ");

export function renderLog(planKgPerWeek, goal, planStartWeight) {
  const stats = logStats(planKgPerWeek, goal);
  renderTiles(stats);
  renderAdvice(stats);
  drawChart(stats, planStartWeight);
  renderGoals();
  renderTable(stats);
}

/** Löpmålen: veckans framsteg, de senaste veckorna och tidsmålet med bästa uppskattning. */
export function renderGoals() {
  const goal = goalFor("lopning");
  const form = { "g-week-km": goal.weekKm, "g-week-runs": goal.weekRuns, "g-dist": goal.distKm };
  for (const [id, v] of Object.entries(form)) if (document.activeElement !== $(id)) $(id).value = v == null ? "" : String(v).replace(".", ",");
  if (document.activeElement !== $("g-time")) $("g-time").value = goal.timeS ? formatHms(goal.timeS) : "";
  if (!hasGoal(goal)) {
    $("l-goal-status").innerHTML = `<p class="hint">Sätt ett veckomål, t.ex. 10 km eller 3 pass i veckan, och gärna ett tidsmål som
      5 km på 30 minuter. Här ser du sedan hur det går vecka för vecka.</p>`;
    $("l-goal-edit").open = true;
    return;
  }
  const weeks = weekProgress("lopning", 5);
  const hit = (w) => (goal.weekKm == null || w.km >= goal.weekKm - 1e-9) && (goal.weekRuns == null || w.runs >= goal.weekRuns);
  const meter = (value, target) => `<div class="meter${value >= target ? " done" : ""}"><i style="width:${Math.min(100, (value / target) * 100)}%"></i></div>`;
  const now = weeks[0];
  const km = (x) => fmt(x, x % 1 ? 1 : 0); // 10 km, 6,2 km
  let html = "";
  if (goal.weekKm != null) {
    const left = goal.weekKm - now.km;
    html += `<div class="goal-line"><b>${km(now.km)} av ${km(goal.weekKm)} km den här veckan</b>${meter(now.km, goal.weekKm)}` +
      `<span>${left > 0 ? `${km(left)} km kvar` : "Veckomålet är nått"}</span></div>`;
  }
  if (goal.weekRuns != null) {
    html += `<div class="goal-line"><b>${now.runs} av ${goal.weekRuns} pass den här veckan</b>${meter(now.runs, goal.weekRuns)}</div>`;
  }
  if (goal.weekKm != null || goal.weekRuns != null) {
    html += `<ul class="goal-weeks" aria-label="Tidigare veckor">${weeks.slice(1).reverse().map((w) =>
      `<li class="${hit(w) ? "hit" : ""}">v. ${w.week}: ${km(w.km)} km · ${w.runs} pass${hit(w) ? " ✓" : ""}</li>`).join("")}</ul>`;
  }
  if (goal.distKm != null && goal.timeS != null) {
    const target = { a: "lopning", km: goal.distKm, s: goal.timeS };
    const best = bestEstimate("lopning", goal.distKm);
    const dist = `${fmt(goal.distKm, goal.distKm % 1 ? 1 : 0)} km`;
    html += `<div class="goal-line"><b>Mål: ${dist} på ${formatHms(goal.timeS)} (${paceText(target)})</b>`;
    if (!best) html += `<span>Spring minst ${fmt(goal.distKm / 2, 1)} km och logga tiden, så räknas din nuvarande tid ut.</span></div>`;
    else {
      const gap = best.seconds - goal.timeS;
      const from = best.from.km === goal.distKm ? `sprungen ${svDate(best.date)}` : `beräknat från ${fmt(best.from.km, best.from.km % 1 ? 2 : 0)} km på ${formatHms(best.from.s)} ${svDate(best.date)}`;
      html += meter(goal.timeS, best.seconds) +
        `<span>Din bästa tid de senaste 8 veckorna: ${formatHms(best.seconds)} (${paceText({ ...target, s: best.seconds })}, ${from}). ` +
        (gap > 0 ? `${formatHms(gap).replace(/^00:/, "")} kvar till målet.` : "Målet är nått! Sätt ett nytt.") + `</span></div>`;
    }
  }
  $("l-goal-status").innerHTML = html;
}

function renderTiles(s) {
  const goalTile = s.goal
    ? tile({ label: "Kvar till målvikt", value: s.toGoal > 0 ? fmt(s.toGoal, 1) : "0", unit: "kg",
        sub: s.toGoal <= 0 ? "Målvikten är nådd" : s.goalDate ? `Ca ${s.goalDate} med ${s.goalBasis}` : "Takten räcker inte för en prognos än" })
    : tile({ label: "Målvikt", value: "–", sub: "Fyll i målvikt i Profil" });

  if (!s.weighIns.length) {
    $("l-tiles").innerHTML = tile({ label: "Nu", value: "–", sub: "Logga din första vikt" }) + tile({ label: "Takt", value: "–", sub: "Visas efter ca 10 dagar" }) +
      (s.goal ? tile({ label: "Målvikt", value: fmt(s.goal, 1), unit: "kg", sub: "Fyll i vikt för att se tid kvar" }) : goalTile);
    return;
  }
  const change = s.nowAvg - s.start.weight;
  const trend = (x) => (x < 0 ? "down" : x > 0 ? "up" : "");
  const c = s.cardio;
  const test = c
    ? tile({ label: `Kondition: ${CARDIO[c.a].n.toLowerCase()}`, value: paceText(c.last), subClass: trend(secondsPerKm(c.last) - secondsPerKm(c.first)),
        sub: c.first !== c.last
          ? `${secondsPerKm(c.last) < secondsPerKm(c.first) ? "Snabbare" : secondsPerKm(c.last) > secondsPerKm(c.first) ? "Långsammare" : "Samma"} än första (${paceText(c.first)}) · bäst ${paceText(c.best)}`
          : "Första passet loggat" })
    : s.testLast
      ? tile({ label: "Testtid", value: formatHms(s.testLast.test), sub: "Äldre testtid utan distans. Logga aktivitet, distans och tid för att jämföra tempo." })
      : tile({ label: "Kondition", value: "–", sub: "Logga aktivitet, distans och tid" });

  $("l-tiles").innerHTML =
    tile({ label: "Nu, 7-dagarssnitt", value: fmt(s.nowAvg, 1), unit: "kg", sub: `${signed(change)} kg sedan ${s.start.date}`, subClass: trend(change) }) +
    (s.rateKgPerWeek != null
      ? tile({ label: "Takt, senaste 3 v", value: signed(s.rateKgPerWeek, 2), unit: "kg/v", sub: `${fmt(s.ratePct, 2)} % av vikten per vecka`, subClass: trend(s.rateKgPerWeek) })
      : tile({ label: "Takt", value: "–", sub: "Behöver minst 4 vägningar över 10 dagar" })) +
    goalTile +
    tile({ label: "Mående, 7 dagar", value: s.mood7 != null ? fmt(s.mood7, 1) : "–", unit: s.mood7 != null ? "av 5" : "",
      sub: s.mood7 != null && s.moodPrev != null ? `${signed(s.mood7 - s.moodPrev)} mot veckan innan` : "Logga mående varje dag" }) +
    tile({ label: "Prestation, 30 dagar", value: s.perf.up, unit: "bättre", sub: `${s.perf.same} samma · ${s.perf.down} sämre` }) +
    test +
    tile({ label: "Intensitetsminuter, 7 dagar", value: s.intensity7 != null ? fmt(s.intensity7) : "–", unit: s.intensity7 != null ? `av ${WEEKLY_INTENSITY_GOAL} min` : "",
      subClass: s.intensity7 != null && s.intensity7 >= WEEKLY_INTENSITY_GOAL ? "down" : "",
      sub: s.intensity7 == null ? "Logga måttliga och höga minuter från klockan" : s.intensity7 >= WEEKLY_INTENSITY_GOAL ? "WHO:s rekommendation för veckan är nådd" : `${fmt(WEEKLY_INTENSITY_GOAL - s.intensity7)} min kvar till WHO:s rekommendation` });
}

/** Råd efter två veckor, med samma gränser som under Uppföljning. */
function renderAdvice(s) {
  const el = $("l-advice");
  el.hidden = !(s.ratePct != null && s.rateDays >= 14);
  if (el.hidden) return;
  const pct = fmt(s.ratePct, 2);
  const good = s.ratePct >= 0.5 && s.ratePct <= 1.2;
  el.className = "flag" + (good ? " good" : "");
  el.innerHTML = s.ratePct < 0.5
    ? `<b>Justera</b><span>Du går ner ${pct} % i veckan, under 0,5 %. Sänk kalorimålet med 150–200 kcal eller lägg till 2 000 steg om dagen.</span>`
    : s.ratePct > 1.2
      ? `<b>Justera</b><span>Du går ner ${pct} % i veckan, över 1,2 %. Höj kalorimålet med 150–200 kcal för att skydda musklerna.</span>`
      : `<b>Bra takt</b><span>${pct} % i veckan ligger inom 0,5–1,2 %. Fortsätt som nu.</span>`;
}

// Hur många dagar bakåt viktkurvan visar (knapparna ovanför den); 0 = hela planen ner till målvikten.
// Gäller bara medan appen är öppen.
let range = 30;
let last = null; // senaste underlaget, så att kurvan kan ritas om när perioden byts
$("l-range").addEventListener("click", (ev) => {
  const btn = ev.target.closest("[data-range]");
  if (!btn) return;
  range = Number(btn.dataset.range);
  for (const b of $("l-range").querySelectorAll("[data-range]")) b.setAttribute("aria-pressed", String(b === btn));
  if (last) drawChart(...last);
});
// Rita om när kurvans bredd går över eller under gränsen för smal skärm, t.ex. när Logg visas första gången
// (dold ritas den i det breda formatet) eller när telefonen vrids
let wasNarrow = null;
if (typeof ResizeObserver === "function") {
  new ResizeObserver(([entry]) => {
    const width = entry.contentRect.width;
    if (!width || !last) return;
    const narrow = width < 520;
    if (narrow !== wasNarrow) drawChart(...last);
  }).observe($("l-chart"));
}

/**
 * Viktkurva: vägningar, 7-dagarssnitt, planens linje och målvikt. Utan vägningar ritas bara planen.
 * Med en period (range) visas bara de senaste dagarna, och skalan anpassas efter dem så att trenden syns tydligt.
 */
function drawChart(s, planStartWeight) {
  last = [s, planStartWeight];
  const svg = $("l-chart");
  // Smal skärm (mobil): ett smalare och högre koordinatsystem, så att texten inte krymper ihop och kurvan blir högre
  const narrow = svg.getBoundingClientRect().width > 0 && svg.getBoundingClientRect().width < 520;
  wasNarrow = narrow;
  const W = narrow ? 380 : 640, H = narrow ? 300 : 260, L = 40, R = narrow ? 62 : 92, T = 14, B = 28;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const base = s.weighIns[0] || { day: dateToDay(todayStr()), weight: planStartWeight };
  const planAt = (day) => base.weight - (s.planKgPerWeek * (day - base.day)) / 7;
  // Planen ritas hela vägen ner till målvikten (samma takt som prognosen i Profil), högst tre år framåt
  const goalDay = s.goal && s.goal < base.weight && s.planKgPerWeek > 0 ? base.day + Math.min(((base.weight - s.goal) / s.planKgPerWeek) * 7, 3 * 365) : null;
  const lastLogged = s.weighIns.length ? s.weighIns[s.weighIns.length - 1].day : base.day;
  const zoom = range > 0 && s.weighIns.length > 0;
  // Det synliga intervallet x0–x1 (dagar)
  const x1 = zoom ? Math.max(lastLogged, dateToDay(todayStr())) + 2 : Math.max(lastLogged, base.day + 14, goalDay ?? 0) + 7;
  // Senaste vägningen syns alltid, även om den är äldre än perioden
  const x0 = zoom ? Math.max(base.day, Math.min(x1 - 2 - range, lastLogged - 7)) : base.day;
  const visible = s.weighIns.filter((e) => e.day >= x0 && e.day <= x1);
  const planFrom = Math.max(x0, base.day), planTo = Math.min(goalDay ?? x1, x1);
  const values = zoom
    ? [...visible.map((e) => e.weight), ...visible.map((e) => sevenDayAverage(s.weighIns, e.day)), ...(s.planKgPerWeek > 0 ? [planAt(planFrom), planAt(planTo)] : [])]
    : [...s.weighIns.map((e) => e.weight), base.weight, goalDay != null ? planAt(goalDay) : planAt(x1), ...(s.goal ? [s.goal] : [])];
  // Inzoomat räcker en halv kilo marginal, så att små förändringar syns
  const pad = zoom ? 0.5 : 1;
  const y0 = Math.floor((Math.min(...values) - pad) * 2) / 2, y1 = Math.ceil((Math.max(...values) + pad) * 2) / 2;
  const sx = (day) => L + ((day - x0) / (x1 - x0)) * (W - L - R);
  const sy = (v) => T + ((y1 - v) / (y1 - y0)) * (H - T - B);

  let g = "";
  const yStep = y1 - y0 > 12 ? 4 : y1 - y0 > 6 ? 2 : y1 - y0 > 3 ? 1 : 0.5;
  for (let v = Math.ceil(y0 / yStep) * yStep; v <= y1; v += yStep) g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${sy(v)}" y2="${sy(v)}"/><text class="axis" x="${L - 6}" y="${sy(v) + 4}" text-anchor="end">${fmt(v, v % 1 ? 1 : 0)}</text>`;
  const span = x1 - x0;
  const xStep = (span > 500 ? 91 : span > 240 ? 56 : span > 120 ? 28 : span > 50 ? 14 : span > 20 ? 7 : 3) * (narrow ? 2 : 1);
  for (let d = x0; d <= x1 - 3; d += xStep) g += `<text class="axis" x="${sx(d)}" y="${H - 8}" text-anchor="middle">${svDate(dayToDate(d))}</text>`;
  if (s.goal && s.goal > y0 && s.goal < y1) g += `<line class="goal" x1="${L}" x2="${W - R}" y1="${sy(s.goal)}" y2="${sy(s.goal)}"/><text class="lbl" x="${W - R + 6}" y="${sy(s.goal) + 4}">Mål ${fmt(s.goal, 1)}</text>`;
  if (s.planKgPerWeek > 0 && planTo > planFrom) {
    g += `<line class="plan" x1="${sx(planFrom)}" y1="${sy(planAt(planFrom))}" x2="${sx(planTo)}" y2="${sy(planAt(planTo))}"/>`;
    if (goalDay != null && goalDay <= x1) g += `<circle class="plan-end" cx="${sx(goalDay)}" cy="${sy(planAt(goalDay))}" r="4"/>`;
    else g += `<text class="lbl" x="${W - R + 6}" y="${sy(planAt(x1)) + 4}">Plan</text>`;
  }
  const keyPlan = s.planKgPerWeek > 0
    ? `<span><i style="border-color:var(--c-plan);border-top-style:dashed"></i>Plan ${fmt(s.planKgPerWeek, 2)} kg/vecka${goalDay != null ? `, målvikten ca ${dayToDate(Math.round(goalDay))}` : ""}</span>`
    : "";

  if (!s.weighIns.length) {
    g += `<text class="empty" x="${(L + W - R) / 2}" y="${T + 16}" text-anchor="middle">Logga din vikt så ritas kurvan mot planen</text>`;
    svg.innerHTML = g;
    $("l-key").innerHTML = keyPlan;
    return;
  }

  for (const e of visible) g += `<circle class="raw" cx="${sx(e.day)}" cy="${sy(e.weight)}" r="${zoom ? 4 : 3}"/>`;
  const averages = visible.map((e) => [e.day, sevenDayAverage(s.weighIns, e.day)]);
  g += `<path class="avg" d="${averages.map(([d, v], i) => `${i ? "L" : "M"}${sx(d).toFixed(1)} ${sy(v).toFixed(1)}`).join(" ")}"/>`;
  const [lastDay, lastAvg] = averages[averages.length - 1];
  g += `<circle class="avg-end" cx="${sx(lastDay)}" cy="${sy(lastAvg)}" r="5"/><text class="lbl" x="${sx(lastDay) + 9}" y="${sy(lastAvg) - 8}">${fmt(lastAvg, 1)} kg</text>`;
  g += `<line class="cross" x1="0" x2="0" y1="${T}" y2="${H - B}" visibility="hidden"/><rect class="hit" x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent"/>`;
  svg.innerHTML = g;
  svg.setAttribute("aria-label", `Viktkurva: 7-dagarssnitt ${fmt(lastAvg, 1)} kg`);
  $("l-key").innerHTML = `<span><i style="border-color:var(--c-weight)"></i>7-dagarssnitt</span><span>● enskilda vägningar</span>${keyPlan}${s.goal ? '<span><i style="border-color:var(--muted);border-top-style:dotted"></i>Målvikt</span>' : ""}`;

  // Visa närmaste vägning när man pekar på diagrammet
  const hit = svg.querySelector(".hit"), cross = svg.querySelector(".cross"), tip = $("l-tip");
  const show = (ev) => {
    const box = svg.getBoundingClientRect();
    const day = x0 + ((((ev.clientX - box.left) / box.width) * W - L) / (W - L - R)) * (x1 - x0);
    const e = visible.reduce((a, b) => (Math.abs(b.day - day) < Math.abs(a.day - day) ? b : a));
    const cx = sx(e.day);
    cross.setAttribute("x1", cx);
    cross.setAttribute("x2", cx);
    cross.setAttribute("visibility", "visible");
    tip.hidden = false;
    tip.style.left = (cx / W) * box.width + 8 + "px";
    tip.style.top = (sy(e.weight) / H) * box.height + 8 + "px";
    tip.innerHTML = `<b>${e.date}</b><br>Vikt ${fmt(e.weight, 1)} kg · snitt ${fmt(sevenDayAverage(s.weighIns, e.day), 1)} kg${e.mood ? `<br>Mående ${e.mood}/5` : ""}`;
  };
  hit.addEventListener("pointermove", show);
  hit.addEventListener("pointerdown", show);
  // Ett långt tryck ska visa vägningen, inte öppna telefonens meny för markering
  svg.oncontextmenu = (ev) => ev.preventDefault();
  hit.addEventListener("pointerleave", () => {
    cross.setAttribute("visibility", "hidden");
    tip.hidden = true;
  });
}

/** Fastan natten efter en dag: från dagens sista måltid till nästa dags första. */
function nightFast(e) {
  const last = parseClock(e.lastMeal);
  const next = parseClock(entryFor(dayToDate(dateToDay(e.date) + 1))?.firstMeal);
  return last != null && next != null ? formatDuration(fastingHours(last, next)) : "–";
}

/** Dagens konditionspass för tabellen; äldre testtider utan distans visas som "Test". */
function conditioning(e) {
  const parts = e.cardio.map(cardioText);
  if (e.test != null) parts.push(`Test ${formatHms(e.test)}`);
  if (intensityMinutes(e) != null) parts.push(`Intensitetsminuter ${intensityMinutes(e)} (måttliga ${e.imMod ?? 0} + 2 × höga ${e.imVig ?? 0})`);
  return parts.length ? parts.map(esc).join("<br>") : "–";
}

/** En rad i loggformuläret: aktivitet, distans (km eller meter), tid och puls. `unit` är förvald enhet för en ny rad. */
export function cardioRow(c = {}, unit = "km") {
  const u = c.km != null ? c.u || "km" : unit;
  const distance = c.km == null ? "" : u === "m" ? String(Math.round(c.km * 1000)) : String(c.km).replace(".", ",");
  const options = Object.entries(CARDIO).map(([id, a]) => `<option value="${id}"${id === (c.a || "lopning") ? " selected" : ""}>${a.n}</option>`).join("");
  const field = (label, input) => `<label class="cardio-field"><span>${label}</span>${input}</label>`;
  return `<div class="cardio-row">` +
    field("Aktivitet", `<select data-c-a>${options}</select>`) +
    field("Distans", `<span class="input-unit"><input type="text" inputmode="decimal" data-decimal data-c-dist min="${u === "m" ? 10 : 0.01}" max="${u === "m" ? 500000 : 500}" placeholder="${u === "m" ? "t.ex. 1122" : "t.ex. 1,14"}" value="${distance}">` +
      `<select data-c-unit aria-label="Enhet"><option value="km"${u === "km" ? " selected" : ""}>km</option><option value="m"${u === "m" ? " selected" : ""}>m</option></select></span>`) +
    field("Tid", `<input type="text" inputmode="numeric" data-c-time maxlength="8" placeholder="hh:mm:ss" value="${c.s != null ? formatHms(c.s) : ""}">`) +
    field("Maxpuls", `<input type="text" inputmode="numeric" data-decimal data-c-hrmax min="30" max="240" placeholder="valfritt" value="${c.hrMax ?? ""}">`) +
    `<button type="button" class="linkbtn" data-c-remove aria-label="Ta bort passet">Ta bort</button></div>`;
}

function renderTable(s) {
  if (!entries.length) {
    $("l-table").innerHTML = `<tbody><tr><td class="note">Inga loggade dagar ännu. Fyll i formuläret ovan, eller importera en tidigare export.</td></tr></tbody>`;
    return;
  }
  const perf = (p) => (p === 1 ? "Bättre" : p === 0 ? "Samma" : p === -1 ? "Sämre" : "–");
  const value = (v, d = 1) => (v != null ? fmt(v, d) : "–");
  $("l-table").innerHTML =
    `<thead><tr><th>Datum</th><th>Vikt</th><th>7-d snitt</th><th>Midja</th><th>Mående</th><th>Prestation</th><th>Kondition</th><th>Måltider</th><th>Fasta efter</th><th>Anteckning</th><th></th></tr></thead><tbody>` +
    entries.slice().reverse().map((e) =>
      `<tr><td class="num">${e.date}</td><td class="num">${value(e.weight)}</td><td class="num">${value(e.weight != null ? sevenDayAverage(s.weighIns, dateToDay(e.date)) : null)}</td>` +
      `<td class="num">${value(e.waist)}</td><td class="num">${e.mood ?? "–"}</td><td>${perf(e.perf)}</td><td>${conditioning(e)}</td><td class="num">${e.firstMeal || e.lastMeal ? `${e.firstMeal || "?"}–${e.lastMeal || "?"}` : "–"}</td><td class="num">${nightFast(e)}</td><td>${esc(noteText(e))}</td>` +
      `<td><button type="button" class="linkbtn" data-edit="${e.date}">Ändra</button> <button type="button" class="linkbtn" data-del="${e.date}">Ta bort</button></td></tr>`).join("") +
    `</tbody>`;
}
