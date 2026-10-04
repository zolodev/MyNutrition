// Inställningar: allergier, ingredienser att ta bort och egna livsmedel.

import { $, esc, fmt, num } from "../util.js";
import { FOOD, CATEGORIES, SUBSTITUTES, ALLERGENS, EXTRA_PRODUCTS, categoryOf } from "../data/foods.js";
import { RECIPES, SEASONAL, SEASONS } from "../data/recipes.js";
import { exclusions, myFoods, isExcluded } from "../preferences.js";
import { adaptRecipe, allDinnersIn, seasonOf, inSeason, fillSeasonalNames } from "../menu.js";
import { myRecipes, RECIPE_TYPES } from "../myrecipes.js";
import { SUPPLEMENTS, using, mySupps, SUPP_WHEN } from "../supplements.js";
import { macros, UNITS, unitsFor, gramsOf, formatQuantity } from "../nutrition.js";

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
  renderExcludedWords();
  renderMyFoodForm();
  renderMyFoods();
  renderMyRecipes();
  $("supps").innerHTML = SUPPLEMENTS.map(([id, name]) => checkbox("data-supp", id, name, using.has(id)).replace("chip-check", "chip-check positive")).join("");
  if (!$("ms-when").options.length) $("ms-when").innerHTML = Object.entries(SUPP_WHEN).map(([id, label]) => `<option value="${id}">${label}</option>`).join("");
  $("ms-list").innerHTML = mySupps.map((m) =>
    `<div class="row my-food"><span class="main"><b>${esc(m.n)}</b><small>${[m.dose && esc(m.dose), m.when === "clock" ? `kl. ${m.at}` : SUPP_WHEN[m.when].toLowerCase(), m.kcal && "innehåller kalorier"].filter(Boolean).join(" · ")}</small></span>` +
    `<button type="button" class="linkbtn" data-msdel="${m.id}">Ta bort</button></div>`).join("");
}

// ---------- Mina recept ----------

/** En rad i receptformuläret: livsmedel och gram. */
const OWN = "__own"; // egen ingrediens som inte finns i listan

/** En ingrediensrad i Mina recept: livsmedel (eller en egen ingrediens), mängd och mått. */
export function recipeItemRow() {
  const options = Object.keys(FOOD).sort((a, b) => FOOD[a].n.localeCompare(FOOD[b].n, "sv"))
    .map((id) => `<option value="${id}">${esc(FOOD[id].n)}</option>`).join("");
  // Som lista: bun 1.1 tappade en av strängarna när de slogs ihop med +
  return [
    `<div class="mr-item"><select data-mr-food aria-label="Livsmedel"><option value="">Välj livsmedel</option>${options}`,
    `<option value="${OWN}">Egen ingrediens (skriv själv)</option></select>`,
    `<input type="text" data-mr-name maxlength="40" placeholder="t.ex. salt" aria-label="Egen ingrediens" hidden>`,
    `<input type="text" inputmode="decimal" data-decimal data-mr-qty min="0.01" max="5000" placeholder="mängd" aria-label="Mängd">`,
    `<select data-mr-unit aria-label="Mått"><option value="g">g</option></select>`,
    `<button type="button" class="linkbtn" data-mr-remove>Ta bort</button></div>`,
  ].join("");
}

/** Måtten i en rad efter valt livsmedel: bara de som går att räkna om (st för ägg, dl för t.ex. äggvita). */
export function syncItemUnits(row) {
  const food = row.querySelector("[data-mr-food]").value;
  const own = food === OWN;
  row.querySelector("[data-mr-name]").hidden = !own;
  const units = own ? UNITS : food ? unitsFor(food) : ["g"];
  const select = row.querySelector("[data-mr-unit]");
  const current = select.value;
  select.innerHTML = units.map((u) => `<option value="${u}">${u}</option>`).join("");
  select.value = units.includes(current) && current !== "g" ? current : units.includes("st") ? "st" : "g";
}

/**
 * Läs ingredienserna: items = [livsmedel, gram, mängd, mått] för näringen, extra = egna ingredienser { n, q, u }.
 * Rader utan livsmedel eller mängd hoppas över.
 */
export function readRecipeItems() {
  const items = [], extra = [];
  for (const row of document.querySelectorAll("#mr-items .mr-item")) {
    const food = row.querySelector("[data-mr-food]").value;
    const q = num(row.querySelector("[data-mr-qty]").value);
    const u = row.querySelector("[data-mr-unit]").value;
    if (food === OWN) {
      const n = row.querySelector("[data-mr-name]").value.trim();
      if (n) extra.push({ n, q: q > 0 ? q : null, u: q > 0 ? u : "" });
      continue;
    }
    const grams = food ? gramsOf(food, q, u) : null;
    if (grams > 0) items.push([food, grams, q, u]);
  }
  return { items, extra };
}

/** Fyll formuläret med ett eget recept för att ändra det: ingredienserna i de mått de skrevs in i. */
export function fillRecipeForm(recipe) {
  $("mr-name").value = recipe.t;
  $("mr-type").value = recipe.g;
  $("mr-how").value = recipe.how || "";
  $("mr-items").innerHTML = "";
  const addRow = (food, quantity, unit, name) => {
    $("mr-items").insertAdjacentHTML("beforeend", recipeItemRow());
    const row = $("mr-items").lastElementChild;
    row.querySelector("[data-mr-food]").value = food;
    syncItemUnits(row);
    if (name) row.querySelector("[data-mr-name]").value = name;
    row.querySelector("[data-mr-qty]").value = quantity != null ? String(quantity).replace(".", ",") : "";
    if (unit && [...row.querySelector("[data-mr-unit]").options].some((o) => o.value === unit)) row.querySelector("[data-mr-unit]").value = unit;
  };
  for (const [f, g, q, u] of recipe.items) addRow(FOOD[f] ? f : "", q ?? g, q ? u : "g");
  for (const x of recipe.extra || []) addRow(OWN, x.q, x.u, x.n);
  updateRecipeSum();
}

export function updateRecipeSum() {
  const { items } = readRecipeItems();
  const m = macros(items.map(([f, g]) => [f, g]));
  $("mr-sum").textContent = items.length ? `Per portion innan skalning: ${fmt(m.k)} kcal · ${fmt(m.p)} g protein · ${fmt(m.c)} g kolhydrater · ${fmt(m.f)} g fett` : "";
}

function renderMyRecipes() {
  if (!$("mr-type").options.length) $("mr-type").innerHTML = RECIPE_TYPES.map(([g, n]) => `<option value="${g}">${n}</option>`).join("");
  if (!$("mr-items").children.length) $("mr-items").innerHTML = recipeItemRow() + recipeItemRow();
  const typeName = Object.fromEntries(RECIPE_TYPES);
  $("mr-list").innerHTML = myRecipes.map((r) => {
    const m = macros(r.items.filter(([f]) => FOOD[f]));
    return `<div class="row my-food"><span class="main"><b>${esc(r.t)}</b><small>${typeName[r.g]} · ${fmt(m.k)} kcal · ${fmt(m.p)} g protein per portion</small>` +
      `<small>${[...r.items.map(([f, g, q, u]) => `${esc(FOOD[f]?.n || f)} ${q ? `${formatQuantity(q, u)} ${u}` : `${fmt(g)} g`}`),
        ...(r.extra || []).map((x) => esc(x.q ? `${x.n} ${formatQuantity(x.q, x.u)} ${x.u}` : x.n))].join(", ")}</small></span>` +
      [`<span class="row-actions"><button type="button" class="linkbtn" data-mredit="${r.id}">Ändra</button>`,
        `<button type="button" class="linkbtn" data-mrdel="${r.id}">Ta bort</button></span></div>`].join("");
  }).join("");
}

/** Egna ord att välja bort, med vilka livsmedel varje ord träffar. */
function renderExcludedWords() {
  const names = [...Object.values(FOOD).filter((f) => !f.mine).map((f) => f.n), ...myFoods.map((m) => m.n)];
  $("ex-words").innerHTML = [...exclusions.words].map((w) => {
    const hits = names.filter((n) => n.toLowerCase().includes(w));
    return `<span class="chip-check word-chip"><span><b>${esc(w)}</b> <small>${hits.length ? esc(hits.slice(0, 4).join(", ")) + (hits.length > 4 ? ` och ${hits.length - 4} till` : "") : "träffar inget livsmedel än"}</small></span>` +
      `<button type="button" class="linkbtn" data-word-del="${esc(w)}" aria-label="Ta bort ${esc(w)}">Ta bort</button></span>`;
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
