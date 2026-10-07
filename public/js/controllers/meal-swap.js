// Ersätt en måltid (Idag → Recept för i dag): åt man något annat än planen, t.ex. en Huel-shake i stället för
// eftermiddagsmåltiden, sparas det i dagens logg (setSwap i log.js) och Idag räknar om dagens kalorier och protein.
// Den planerade rätten kan samtidigt flyttas till en annan dag i veckan (byter plats med den dagens rätt, swapMeals i
// menu.js); Ångra flyttar tillbaka den.
// Senast använda ersättningar och färdiga produkter (data/meal-replacements.js) visas som snabbval.

import { $, esc, num, fmt, todayStr, todayIndex, weekIndexOf, checkDecimal, DAYS } from "../util.js";
import { swapMeals } from "../menu.js";
import { fillMoveOptions, plannedTitle } from "../views/today.js";
import { setSwap, recentSwaps, MEAL_NAMES } from "../log.js";
import { MEAL_REPLACEMENTS } from "../data/meal-replacements.js";

let update = () => {}; // ritar om appen; sätts av initMealSwap()
const message = (text) => ($("sw-msg").textContent = text);

function renderRecent() {
  const recent = recentSwaps();
  $("sw-recent").innerHTML = recent.map((x, i) =>
    `<button type="button" class="chip" data-swap-pick="${i}">${esc(x.n)} · ${fmt(x.k)} kcal</button>`).join("");
  $("sw-recent").hidden = !recent.length;
}

/** Färdiga produkter, t.ex. Huel, som snabbval. */
function renderProducts() {
  $("sw-products").innerHTML = MEAL_REPLACEMENTS.map((x, i) =>
    `<button type="button" class="chip" data-swap-product="${i}">${esc(x.n)} · ${fmt(x.k)} kcal · ${fmt(x.p)} g P</button>`).join("");
}

$("sw-form").addEventListener("click", (ev) => {
  const recent = ev.target.closest("[data-swap-pick]")?.dataset.swapPick;
  const product = ev.target.closest("[data-swap-product]")?.dataset.swapProduct;
  const pick = recent != null ? recentSwaps()[recent] : product != null ? MEAL_REPLACEMENTS[product] : null;
  if (!pick) return;
  $("sw-name").value = pick.n;
  $("sw-k").value = String(pick.k).replace(".", ",");
  $("sw-p").value = String(pick.p).replace(".", ",");
});

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
