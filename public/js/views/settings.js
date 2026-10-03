// Inställningar: allergier, ingredienser att ta bort och egna livsmedel.

import { $, esc, fmt } from "../util.js";
import { FOOD, CATEGORIES, SUBSTITUTES, ALLERGENS, EXTRA_PRODUCTS, categoryOf } from "../data/foods.js";
import { RECIPES, SEASONAL, SEASONS } from "../data/recipes.js";
import { exclusions, myFoods, isExcluded } from "../preferences.js";
import { adaptRecipe, allDinnersIn, seasonOf, inSeason, fillSeasonalNames } from "../menu.js";
import { myRecipes, RECIPE_TYPES } from "../myrecipes.js";
import { SUPPLEMENTS, using } from "../supplements.js";
import { macros } from "../nutrition.js";

const checkbox = (attr, id, label, checked) =>
  `<label class="chip-check"><input type="checkbox" ${attr}="${id}"${checked ? " checked" : ""}><span>${esc(label)}</span></label>`;
const shortName = (allergen) => allergen.n.split(" (")[0];

/** Alla livsmedel som kan förekomma i recepten, inklusive säsongsvarianter och ersättare. */
function recipeFoods() {
  const ids = new Set(Object.values(SUBSTITUTES).flat());
  for (const r of Object.values(RECIPES)) for (const [f] of r.items) {
    if (f[0] === "@") Object.values(SEASONAL[f.slice(1)]).forEach((x) => ids.add(x));
    else ids.add(f);
  }
  return [...ids].filter((id) => FOOD[id] && !FOOD[id].mine);
}

export function renderSettings(week) {
  renderSummary(seasonOf(week));
  $("ex-allergens").innerHTML = ALLERGENS.map((a) => checkbox("data-allergen", a.id, a.n, exclusions.allergens.has(a.id))).join("");
  renderIngredientPicker();
  renderMyFoodForm();
  renderMyFoods();
  renderMyRecipes();
  $("supps").innerHTML = SUPPLEMENTS.map(([id, name]) => checkbox("data-supp", id, name, using.has(id)).replace("chip-check", "chip-check positive")).join("");
}

// ---------- Mina recept ----------

/** En rad i receptformuläret: livsmedel och gram. */
export function recipeItemRow(food = "", grams = "") {
  const options = Object.keys(FOOD).sort((a, b) => FOOD[a].n.localeCompare(FOOD[b].n, "sv"))
    .map((id) => `<option value="${id}"${id === food ? " selected" : ""}>${esc(FOOD[id].n)}</option>`).join("");
  return `<div class="mr-item"><select data-mr-food aria-label="Livsmedel"><option value="">Välj livsmedel</option>${options}</select>` +
    `<input type="number" data-mr-grams min="1" max="2000" step="5" placeholder="gram" value="${grams}" aria-label="Gram">` +
    `<button type="button" class="linkbtn" data-mr-remove>Ta bort</button></div>`;
}

/** Ingredienserna som står i formuläret just nu. */
export function readRecipeItems() {
  return [...document.querySelectorAll("#mr-items .mr-item")]
    .map((row) => [row.querySelector("[data-mr-food]").value, Number(row.querySelector("[data-mr-grams]").value)])
    .filter(([food, grams]) => food && grams > 0);
}

export function updateRecipeSum() {
  const items = readRecipeItems();
  const m = macros(items);
  $("mr-sum").textContent = items.length ? `Per portion innan skalning: ${fmt(m.k)} kcal · ${fmt(m.p)} g protein · ${fmt(m.c)} g kolhydrater · ${fmt(m.f)} g fett` : "";
}

function renderMyRecipes() {
  if (!$("mr-type").options.length) $("mr-type").innerHTML = RECIPE_TYPES.map(([g, n]) => `<option value="${g}">${n}</option>`).join("");
  if (!$("mr-items").children.length) $("mr-items").innerHTML = recipeItemRow() + recipeItemRow();
  const typeName = Object.fromEntries(RECIPE_TYPES);
  $("mr-list").innerHTML = myRecipes.map((r) => {
    const m = macros(r.items.filter(([f]) => FOOD[f]));
    return `<div class="row my-food"><span class="main"><b>${esc(r.t)}</b><small>${typeName[r.g]} · ${fmt(m.k)} kcal · ${fmt(m.p)} g protein per portion</small>` +
      `<small>${r.items.map(([f, g]) => `${esc(FOOD[f]?.n || f)} ${fmt(g)} g`).join(", ")}</small></span>` +
      `<button type="button" class="linkbtn" data-mrdel="${r.id}">Ta bort</button></div>`;
  }).join("");
}

export function renderIngredientPicker() {
  const query = $("ex-search").value.trim().toLowerCase();
  const foods = recipeFoods();
  const html = CATEGORIES.map(([cat, name]) => {
    const all = cat === "extra" ? EXTRA_PRODUCTS : foods.filter((id) => categoryOf(id) === cat).map((id) => ({ id, n: FOOD[id].n }));
    const shown = all.filter((x) => !query || x.n.toLowerCase().includes(query)).sort((a, b) => a.n.localeCompare(b.n, "sv"));
    if (!shown.length) return "";
    const removed = all.filter((x) => exclusions.foods.has(x.id)).length;
    return `<details class="ex-cat"${query || removed ? " open" : ""}><summary>${esc(name)}${removed ? `<span>${removed} borttagna</span>` : ""}</summary>` +
      `<div class="chips">${shown.map((x) => checkbox("data-food", x.id, x.n, exclusions.foods.has(x.id))).join("")}</div></details>`;
  }).join("");
  $("ex-foods").innerHTML = html || `<p class="note">Ingen ingrediens matchar "${esc(query)}".</p>`;
}

/** Hur många rätter som passar valen under veckans säsong. */
function renderSummary(season) {
  const count = exclusions.allergens.size + exclusions.foods.size;
  if (!count) {
    $("ex-sum").textContent = "Inget är bortvalt. Alla recept används som de är.";
    return;
  }
  const dinners = allDinnersIn(season);
  const removed = dinners.filter((id) => !adaptRecipe(id, season).ok);
  const adapted = Object.keys(RECIPES).filter((id) => {
    const a = adaptRecipe(id, season);
    return inSeason(id, season) && a.ok && (a.subs.length || a.dropped.length);
  });
  const fitting = dinners.length - removed.length;
  $("ex-sum").innerHTML =
    `${count} val aktiva. ${SEASONS[season].n}: <b>${fitting} av ${dinners.length}</b> eftermiddagsrätter passar` +
    (removed.length ? ` (borttagna: ${removed.map((id) => esc(fillSeasonalNames(RECIPES[id].t, season))).join(", ")})` : "") +
    `. ${adapted.length} rätter är anpassade med ersättare.` +
    (fitting < 7 ? " <b>Färre än sju rätter passar, så samma rätt kan komma flera gånger i veckan.</b> Lägg gärna till egna livsmedel som ersättare." : "");
}

function renderMyFoodForm() {
  if (!$("mf-cat").options.length) {
    $("mf-cat").innerHTML = CATEGORIES.filter(([c]) => c !== "extra").map(([c, n]) => `<option value="${c}">${esc(n)}</option>`).join("");
    $("mf-allergens").innerHTML = ALLERGENS.map((a) => checkbox("data-mfallergen", a.id, shortName(a), false)).join("");
  }
  const keep = $("mf-rep").value;
  const options = recipeFoods().sort((a, b) => FOOD[a].n.localeCompare(FOOD[b].n, "sv"));
  $("mf-rep").innerHTML = `<option value="">Inget, bara i inköpslistan</option>` + options.map((id) => `<option value="${id}">${esc(FOOD[id].n)}</option>`).join("");
  $("mf-rep").value = keep;
}

function renderMyFoods() {
  $("mf-list").innerHTML = myFoods.map((m) => {
    const replaces = m.replaces && FOOD[m.replaces] ? ` · ersätter ${esc(FOOD[m.replaces].n.toLowerCase())} ${m.always ? "alltid" : "när den är bortvald"}` : "";
    const allergens = m.allergens.length ? ` · innehåller ${m.allergens.map((id) => esc(shortName(ALLERGENS.find((a) => a.id === id)).toLowerCase())).join(", ")}` : "";
    return `<div class="row my-food"><span class="main"><b>${esc(m.n)}</b>${isExcluded(m.id) ? '<small>Bortvald av dina allergival</small>' : ""}` +
      `<small>${fmt(m.k)} kcal · P ${fmt(m.p, 1)} · K ${fmt(m.c, 1)} · F ${fmt(m.f, 1)} per 100 g${replaces}${allergens}</small></span>` +
      `<button type="button" class="linkbtn" data-mfdel="${m.id}">Ta bort</button></div>`;
  }).join("");
}
