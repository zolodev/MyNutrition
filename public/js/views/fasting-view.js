// Idag: fastan i dag, med verkliga måltidstider, nästa måltid och läget just nu.

import { $, esc, todayStr, dateToDay, dayToDate } from "../util.js";
import { entryFor } from "../log.js";
import { WINDOW, FASTING } from "../day.js";
import { fastHours, parseClock, formatClock, formatDuration, fastingDay, fastingHours, fastingNow } from "../fasting.js";

const yesterdayStr = () => dayToDate(dateToDay(todayStr()) - 1);
const nowHours = () => {
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
};

/** Dagens schema från loggade tider (eller planen). Används också av resten av Idag. */
export function todaysFasting(planned) {
  const today = entryFor(todayStr()) || {};
  const yesterday = entryFor(yesterdayStr()) || {};
  return {
    day: fastingDay({ planned, first: parseClock(today.firstMeal), last: parseClock(today.lastMeal), yesterdayLast: parseClock(yesterday.lastMeal) }),
    today,
    yesterdayLast: parseClock(yesterday.lastMeal),
  };
}

/** Snitt av fastan de senaste sju nätterna där både sista måltiden och nästa dags första måltid är loggade. */
function averageFast() {
  const end = dateToDay(todayStr());
  const nights = [];
  for (let d = end - 7; d < end; d++) {
    const last = parseClock(entryFor(dayToDate(d))?.lastMeal);
    const next = parseClock(entryFor(dayToDate(d + 1))?.firstMeal);
    if (last != null && next != null) nights.push(fastingHours(last, next));
  }
  return nights.length ? { hours: nights.reduce((a, b) => a + b, 0) / nights.length, nights: nights.length } : null;
}

export function renderFastingToday(planned) {
  $("fastan").hidden = !FASTING; // utan fasta (Profil → Fasta) visas inte fastan i dag
  if (!FASTING) return;
  const { day, today, yesterdayLast } = todaysFasting(planned);
  if (document.activeElement !== $("fs-first")) $("fs-first").value = today.firstMeal || "";
  if (document.activeElement !== $("fs-last")) $("fs-last").value = today.lastMeal || "";
  if (document.activeElement !== $("fs-ylast")) $("fs-ylast").value = yesterdayLast != null ? formatClock(yesterdayLast) : "";
  $("fs-first-hint").textContent = today.firstMeal ? "Loggad" : `Tomt = enligt planen (${formatClock(planned)})`;
  const calculated = today.firstMeal && today.lastMeal === formatClock(parseClock(today.firstMeal) + WINDOW);
  $("fs-last-hint").textContent = calculated
    ? `Uträknad: ${WINDOW} h efter första måltiden. Ändra om du slutade äta en annan tid.`
    : today.lastMeal ? "Loggad" : `Tomt = ${WINDOW} h efter första måltiden (${formatClock(day.start + WINDOW)})`;
  $("fs-reset").hidden = !today.firstMeal && !today.lastMeal;

  const items = [
    `<li><b>Ätfönster</b> ${formatClock(day.start)}–${formatClock(day.windowEnd)}</li>`,
    `<li><b>Eftermiddagsmåltiden</b> kl. ${formatClock(day.nextMeal)}</li>`,
    `<li><b>Fastan</b> börjar ${formatClock(day.windowEnd)} och är klar i morgon ${formatClock(day.fastEnd)} (${fastHours()} h)</li>`,
  ];
  if (day.tonightIfPlanned < fastHours() - 0.01) {
    items.push(`<li class="warn">Frukost i morgon ${formatClock(planned)} enligt planen ger bara ${formatDuration(day.tonightIfPlanned)} fasta. Ät tidigast ${formatClock(day.fastEnd)} för ${fastHours()} h, eller ta det som en kortare natt.</li>`);
  }
  if (day.earliestToday != null && today.firstMeal) {
    const lastNight = fastingHours(yesterdayLast, day.start);
    items.push(`<li${lastNight < fastHours() - 0.01 ? ' class="warn"' : ""}>Fastan i natt blev ${formatDuration(lastNight)}.</li>`);
  }
  const avg = averageFast();
  if (avg) items.push(`<li>Snitt de senaste nätterna: <b>${formatDuration(avg.hours)}</b> (${avg.nights} ${avg.nights === 1 ? "natt" : "nätter"} loggade)</li>`);
  $("fs-plan").innerHTML = items.join("");
  renderFastingNow(planned);
}

/** Läget just nu. Anropas också en gång i minuten. */
export function renderFastingNow(planned) {
  if (!FASTING) return;
  const { day, today, yesterdayLast } = todaysFasting(planned);
  const now = fastingNow(day, nowHours(), yesterdayLast);
  // Knapp för att själv styra fastan: starta den nu (sista måltiden = nu), bryta den (första måltiden = nu) eller
  // starta om den efter att ha ätit något sent (sista måltiden = nu). Hanteras i app.js.
  const action = now.state === "eating" ? ["start", "Starta fastan nu"]
    : today.firstMeal ? ["start", "Jag åt nyss: starta om fastan nu"] : ["break", "Bryt fastan nu (jag äter)"];
  $("fs-action").dataset.action = action[0];
  $("fs-action").textContent = action[1];
  if (now.state === "eating") {
    $("fs-now").innerHTML = `<b>Ätfönstret är öppet</b><span>${esc(formatDuration(now.left))} kvar, stänger ${formatClock(day.windowEnd)}</span>` +
      `<div class="meter"><i style="width:${Math.min(100, ((WINDOW - now.left) / WINDOW) * 100)}%"></i></div>`;
  } else {
    const done = now.left === 0;
    $("fs-now").innerHTML = `<b>${done ? "Fastan är klar" : "Du fastar"}</b><span>${esc(formatDuration(now.elapsed))} av ${fastHours()} h${done ? "" : `, ${esc(formatDuration(now.left))} kvar`}</span>` +
      `<div class="meter fasting"><i style="width:${Math.min(100, (now.elapsed / fastHours()) * 100)}%"></i></div>`;
  }
}

