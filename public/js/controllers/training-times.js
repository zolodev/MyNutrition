// Profil → Träningstider: en rad per gymdag med egen tid (från–till). Tomt = planens tid, räknat från frukosten.
// Tiderna sparas i trainingtimes.js och används av Idag, veckoschemat och tillskottstipsen.

import { $, DAYS } from "../util.js";
import { formatClock } from "../fasting.js";
import { customTime, setTrainingTime, strengthTime } from "../trainingtimes.js";

let update = () => {}; // ritar om appen; sätts av initTrainingTimes()

/** Rita raderna för de valda gymdagarna. Ritas inte om medan man skriver i en av dem. */
export function renderTrainingTimes(days, breakfast) {
  if ($("tt-list").contains(document.activeElement)) return;
  $("tt-list").innerHTML = days.map((d) => {
    const own = customTime(d);
    const plan = strengthTime(-1, breakfast); // planens tid (ingen egen tid för dag -1)
    const field = (key, label) =>
      `<input type="text" inputmode="numeric" data-clock data-tt="${d}" data-tt-key="${key}" value="${own?.[key] || ""}" ` +
      `placeholder="${formatClock(plan[key])}" aria-label="${DAYS[d]}, ${label}">`;
    return `<div class="tt-row"><span class="tt-day">${DAYS[d]}</span>${field("from", "från")}<span aria-hidden="true">–</span>${field("to", "till")}` +
      (own ? `<button type="button" class="linkbtn" data-tt-clear="${d}">Planens tid</button>` : "") + "</div>";
  }).join("");
}

// Sparas när båda tiderna är ifyllda och slutet ligger efter början; tomma fält tar bort den egna tiden
$("tt-list").addEventListener("change", (ev) => {
  const day = ev.target.dataset.tt;
  if (day == null) return;
  const row = ev.target.closest(".tt-row");
  const from = row.querySelector('[data-tt-key="from"]'), to = row.querySelector('[data-tt-key="to"]');
  if (!from.value && !to.value) setTrainingTime(day, null);
  else if (from.value && to.value) {
    const ok = setTrainingTime(day, { from: from.value, to: to.value });
    to.setCustomValidity(ok ? "" : "Sluttiden måste vara efter starttiden, t.ex. 16:00–18:00");
    if (!ok) return to.reportValidity();
  } else return;
  ev.target.blur();
  update();
});
$("tt-list").addEventListener("click", (ev) => {
  const day = ev.target.closest("[data-tt-clear]")?.dataset.ttClear;
  if (day == null) return;
  setTrainingTime(day, null);
  update();
});

/** Koppla träningstiderna till appen. */
export function initTrainingTimes(deps) {
  update = deps.update;
}
