// Logg: formuläret för en dag (vikt, midja, kondition, intensitetsminuter, mående, anteckning) och tabellen
// med det som är loggat. Själva datan och reglerna för den finns i log.js; tabellen och raderna ritas i views/log-view.js.

import { $, $$, num, radioValue, todayStr, dayToDate, dateToDay, svDate, confirmDialog, checkDecimal } from "../util.js";
import { entries, entryFor, upsertEntry, removeEntry, cleanEntry, isIsoDate, parseWorkoutTime, formatWorkoutInput, formatHms, cleanCardio, CARDIO, intensityMinutes } from "../log.js";
import { cardioRow } from "../views/log-view.js";

let update = () => {}; // ritar om appen; sätts av initLogForm()


const logMessage = (text) => ($("l-msg").textContent = text);

/** Skriv datumet som ÅÅÅÅ-MM-DD medan man knappar in siffror (mobilens sifferknappsats saknar bindestreck). */
function formatDateInput(value) {
  const d = value.replace(/\D/g, "").slice(0, 8);
  return d.slice(0, 4) + (d.length > 4 ? "-" + d.slice(4, 6) : "") + (d.length > 6 ? "-" + d.slice(6, 8) : "");
}

function fillLogForm(date) {
  const e = entryFor(date) || { date };
  $("l-date").value = date;
  $("l-weight").value = e.weight ?? "";
  $("l-waist").value = e.waist ?? "";
  $("l-cardio").innerHTML = e.cardio?.length ? e.cardio.map((c) => cardioRow(c)).join("") : cardioRow({}, lastUnit());
  $("l-im-mod").value = e.imMod ?? "";
  $("l-im-vig").value = e.imVig ?? "";
  showIntensityTotal();
  $("l-note").value = e.note || "";
  for (const el of $$('input[name="l-mood"]')) el.checked = +el.value === e.mood;
  const notTrained = !!entryFor(date) && e.perf == null && e.trained === false;
  for (const el of $$('input[name="l-perf"]')) el.checked = el.value === "none" ? notTrained : +el.value === e.perf;
}

/**
 * Läs konditionsraderna. Tomma rader hoppas över; en halvt ifylld rad ger ett felmeddelande.
 * Ger { list } eller { error }.
 */
function readCardio() {
  const list = [];
  for (const row of $$("#l-cardio .cardio-row")) {
    const a = row.querySelector("[data-c-a]").value;
    const distText = row.querySelector("[data-c-dist]").value.trim(), timeText = row.querySelector("[data-c-time]").value.trim();
    if (!distText && !timeText) continue;
    const unit = row.querySelector("[data-c-unit]").value;
    const dist = num(distText);
    const pass = cleanCardio({ a, km: dist != null && unit === "m" ? dist / 1000 : dist, u: unit, s: parseWorkoutTime(timeText),
      hrMax: num(row.querySelector("[data-c-hrmax]").value) });
    if (!pass) return { error: `Fyll i både distans och tid (min:sek) för ${CARDIO[a].n.toLowerCase()}, t.ex. 1,14 km eller 1122 m och 8:57.` };
    list.push(pass);
  }
  return { list };
}

/** Visa intensitetsminuterna för dagen medan man skriver: måttliga + 2 × höga. */
function showIntensityTotal() {
  const total = intensityMinutes({ imMod: num($("l-im-mod").value), imVig: num($("l-im-vig").value) });
  $("l-im-total").textContent = total != null
    ? `= ${total} intensitetsminuter (måttliga + 2 × höga). WHO rekommenderar minst 150 i veckan.`
    : "Totalen räknas som måttliga + 2 × höga, som på Garmin och liknande klockor. WHO rekommenderar minst 150 minuter i veckan.";
}
for (const id of ["l-im-mod", "l-im-vig"]) $(id).addEventListener("input", showIntensityTotal);

/** Enheten för en ny rad: samma som raden ovanför, annars den som användes senast i loggen. */
const lastUnit = () =>
  [...$$("#l-cardio [data-c-unit]")].pop()?.value ||
  entries.flatMap((e) => e.cardio).pop()?.u || "km";

$("l-cardio-add").addEventListener("click", () => $("l-cardio").insertAdjacentHTML("beforeend", cardioRow({}, lastUnit())));
// Tid: kolonerna sätts medan man skriver siffror (857 → 8:57, 10530 → 1:05:30)
$("l-cardio").addEventListener("input", (ev) => {
  if (!ev.target.matches("[data-c-time]")) return;
  const formatted = formatWorkoutInput(ev.target.value);
  if (formatted !== ev.target.value) ev.target.value = formatted;
  ev.target.setCustomValidity("");
});
// När fältet lämnas skrivs tiden ut som hh:mm:ss: 8:57 betyder 8 min 57 s, alltså 00:08:57
$("l-cardio").addEventListener("change", (ev) => {
  if (!ev.target.matches("[data-c-time]") || !ev.target.value.trim()) return;
  const seconds = parseWorkoutTime(ev.target.value);
  if (seconds != null) ev.target.value = formatHms(seconds);
  ev.target.setCustomValidity(seconds != null ? "" : "Skriv tiden som hh:mm:ss eller mm:ss, t.ex. 00:08:57 eller 8:57");
});
// Byt enhet: rimliga gränser och exempel för km eller meter
$("l-cardio").addEventListener("change", (ev) => {
  if (!ev.target.matches("[data-c-unit]")) return;
  const input = ev.target.closest(".input-unit").querySelector("[data-c-dist]");
  const m = ev.target.value === "m";
  Object.assign(input, { min: m ? "10" : "0.01", max: m ? "500000" : "500", placeholder: m ? "t.ex. 1122" : "t.ex. 1,14" });
  checkDecimal(input);
});
$("l-cardio").addEventListener("click", (ev) => {
  if (!ev.target.matches("[data-c-remove]")) return;
  ev.target.closest(".cardio-row").remove();
  if (!$("l-cardio").children.length) $("l-cardio").insertAdjacentHTML("beforeend", cardioRow({}, lastUnit()));
});

$("l-date").addEventListener("input", (ev) => {
  const formatted = formatDateInput(ev.target.value);
  if (formatted !== ev.target.value) ev.target.value = formatted;
  if (isIsoDate(formatted)) fillLogForm(formatted);
});
$("logf").addEventListener("click", (ev) => {
  const offset = ev.target.dataset.dateOffset;
  if (offset != null) fillLogForm(dayToDate(dateToDay(todayStr()) + Number(offset)));
});
$("logf").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const date = $("l-date").value.trim();
  if (!isIsoDate(date)) return logMessage("Skriv datumet som ÅÅÅÅ-MM-DD, t.ex. " + todayStr() + ".");
  const cardio = readCardio();
  if (cardio.error) return logMessage(cardio.error);
  const perf = radioValue("l-perf");
  const existing = entryFor(date);
  const entry = cleanEntry({
    firstMeal: existing?.firstMeal, lastMeal: existing?.lastMeal, swaps: existing?.swaps,
    date, weight: num($("l-weight").value), waist: num($("l-waist").value), mood: radioValue("l-mood") ? +radioValue("l-mood") : null,
    perf: perf && perf !== "none" ? +perf : null, trained: perf ? perf !== "none" : false, cardio: cardio.list, test: existing?.test, imMod: num($("l-im-mod").value), imVig: num($("l-im-vig").value), note: $("l-note").value.trim(),
  });
  if (entry.weight == null && entry.mood == null && entry.perf == null && !entry.cardio.length && intensityMinutes(entry) == null && entry.test == null && entry.waist == null && !entry.note) return logMessage("Fyll i minst ett värde.");
  upsertEntry(entry);
  update();
  logMessage(`Sparat för ${entry.date} (${svDate(entry.date, { weekday: "long" })}).`);
});
$("l-table").addEventListener("click", async (ev) => {
  const edit = ev.target.closest("[data-edit]")?.dataset.edit;
  const del = ev.target.closest("[data-del]")?.dataset.del;
  if (edit) {
    fillLogForm(edit);
    $("logf").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  if (del && (await confirmDialog(`Är du säker på att du vill ta bort loggen för ${del}?`))) {
    removeEntry(del);
    update();
    logMessage("Posten är borttagen.");
  }
});

/** Öppna loggen med dagens (eller en annan dags) post ifylld, t.ex. för att ändra ett pass som loggats automatiskt. */
export function openLogFor(date) {
  fillLogForm(date);
  location.hash = "logf";
}
// Knappar och länkar med data-edit-log (t.ex. efter ett avslutat pass) öppnar dagens post i loggen
document.addEventListener("click", (ev) => {
  if (!ev.target.closest?.("[data-edit-log]")) return;
  ev.preventDefault();
  openLogFor(todayStr());
});

/** Koppla loggen till appen. Anropas när loggen är inläst (loadLog). */
export function initLogForm(deps) {
  update = deps.update;
  $("l-date").value = todayStr();
  $("l-cardio").innerHTML = cardioRow({}, lastUnit());
}
