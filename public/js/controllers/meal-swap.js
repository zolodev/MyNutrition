// Ersätt en måltid (Idag → Recept för i dag): åt man något annat än planen, t.ex. en Huel-shake i stället för
// eftermiddagsmåltiden, sparas det i dagens logg (setSwap i log.js) och Idag räknar om dagens kalorier och protein.
// Den planerade rätten kan samtidigt flyttas till en annan dag i veckan (byter plats med den dagens rätt, swapMeals i
// menu.js); Ångra flyttar tillbaka den.
// Senast använda ersättningar och färdiga produkter (data/meal-replacements.js) visas som snabbval.
// Mellanmål och snacks utöver planen läggs till på samma sätt (addSnack i log.js) och delar snabbvalen.

import { $, esc, num, fmt, todayStr, todayIndex, weekIndexOf, checkDecimal, DAYS } from "../util.js";
import { swapMeals } from "../menu.js";
import { fillMoveOptions, plannedTitle } from "../views/today.js";
import { setSwap, recentSwaps, addSnack, removeSnack, MEAL_NAMES } from "../log.js";
import { MEAL_REPLACEMENTS } from "../data/meal-replacements.js";

let update = () => {}; // ritar om appen; sätts av initMealSwap()
const message = (text) => ($("sw-msg").textContent = text);

function renderRecent() {
  const recent = recentSwaps();
  for (const id of ["sw-recent", "sn-recent"]) {
    $(id).innerHTML = recent.map((x, i) =>
      `<button type="button" class="chip-btn" data-swap-pick="${i}">${esc(x.n)} · ${fmt(x.k)} kcal</button>`).join("");
    $(id).hidden = !recent.length;
  }
}

/** Färdiga produkter, t.ex. Huel, som snabbval. */
function renderProducts() {
  for (const id of ["sw-products", "sn-products"]) $(id).innerHTML = MEAL_REPLACEMENTS.map((x, i) =>
    `<button type="button" class="chip-btn" data-swap-product="${i}">${esc(x.n)} · ${fmt(x.k)} kcal · ${fmt(x.p)} g P</button>`).join("");
}

/** Snabbval: fyll i namn, kalorier och protein i ett formulär (prefix "sw" eller "sn"). */
function fillPick(ev, prefix) {
  const recent = ev.target.closest("[data-swap-pick]")?.dataset.swapPick;
  const product = ev.target.closest("[data-swap-product]")?.dataset.swapProduct;
  const pick = recent != null ? recentSwaps()[recent] : product != null ? MEAL_REPLACEMENTS[product] : null;
  if (!pick) return;
  $(`${prefix}-name`).value = pick.n;
  $(`${prefix}-k`).value = String(pick.k).replace(".", ",");
  $(`${prefix}-p`).value = String(pick.p).replace(".", ",");
}

$("sn-form").addEventListener("click", (ev) => fillPick(ev, "sn"));
$("sn-form").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const snack = { n: $("sn-name").value, k: num($("sn-k").value), p: num($("sn-p").value) ?? 0 };
  if (!snack.n.trim() || snack.k == null) return ($("sn-msg").textContent = "Fyll i vad du åt och hur många kalorier det var.");
  const invalid = [$("sn-k"), $("sn-p")].find((el) => !checkDecimal(el));
  if (invalid) return invalid.reportValidity();
  addSnack(todayStr(), snack);
  $("sn-form").reset();
  $("sn-msg").textContent = `${snack.n.trim()} är tillagt. Dagens summa är uträknad på nytt.`;
  renderRecent();
  update();
});
$("sn-list").addEventListener("click", (ev) => {
  const i = ev.target.closest("[data-snack-remove]")?.dataset.snackRemove;
  if (i == null) return;
  removeSnack(todayStr(), Number(i));
  $("sn-msg").textContent = "";
  update();
});

$("sw-form").addEventListener("click", (ev) => fillPick(ev, "sw"));

$("sw-form").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const meal = Number($("sw-meal").value);
  const swap = { n: $("sw-name").value, k: num($("sw-k").value), p: num($("sw-p").value) ?? 0 };
  if (!swap.n.trim() || swap.k == null) return message("Fyll i vad du åt och hur många kalorier det var.");
  const invalid = [$("sw-k"), $("sw-p")].find((el) => !checkDecimal(el));
  if (invalid) return invalid.reportValidity();
  const target = $("sw-move-field").hidden || $("sw-move").value === "" ? null : Number($("sw-move").value);
  const was = plannedTitle(meal);
  setSwap(todayStr(), meal, { ...swap, was, moved: target ?? undefined });
  if (target != null) swapMeals(weekIndexOf(new Date()), meal, todayIndex(), target);
  $("sw-form").reset();
  message(`${MEAL_NAMES[meal]} är ersatt med ${swap.n.trim()}.` + (target != null ? ` ${was} är flyttad till ${DAYS[target].toLowerCase()}.` : "") + " Dagens summa är uträknad på nytt.");
  renderRecent();
  update();
});

// Ersätt en viss måltid: öppna formuläret med den måltiden vald
$("td-food").addEventListener("click", (ev) => {
  const meal = ev.target.closest("[data-swap-meal]")?.dataset.swapMeal;
  if (meal == null) return;
  $("sw-box").open = true;
  $("sw-meal").value = meal;
  fillMoveOptions(Number(meal));
  message("");
  $("sw-box").scrollIntoView({ block: "start", behavior: "smooth" });
  $("sw-name").focus({ preventScroll: true });
});

// Ångra en ersättning direkt i listan med dagens måltider
$("td-food").addEventListener("click", (ev) => {
  const meal = ev.target.closest("[data-unswap]")?.dataset.unswap;
  if (meal == null) return;
  const removed = setSwap(todayStr(), Number(meal), null);
  if (removed?.moved != null) swapMeals(weekIndexOf(new Date()), Number(meal), todayIndex(), removed.moved); // flytta tillbaka
  message("");
  update();
});

$("sw-meal").addEventListener("change", () => fillMoveOptions(Number($("sw-meal").value)));

/** Koppla formuläret till appen. */
export function initMealSwap(deps) {
  update = deps.update;
  renderRecent();
  renderProducts();
}
