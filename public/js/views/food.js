// Mat: veckoöversikt, recept, inköpslista och fri lördagsmåltid.

import { $, esc, fmt, signed, hhmm, DAYS, DAY_MS, mondayOf, isoWeekNumber } from "../util.js";
import { FOOD, CATEGORIES, categoryOf, scaleGroupOf } from "../data/foods.js";
import { SEASONS, NONE } from "../data/recipes.js";
import { isExcluded } from "../preferences.js";
import { formatAmount, kgPerWeek } from "../nutrition.js";
import { recipesFor, totals } from "../menu.js";
import { CHEVRON, macroLine } from "./components.js";
import { MEAL_AT } from "../day.js";

const MEALS = ["Frukost", "Eftermiddagsmåltid", "Efterrätt", "Lördagsgodis"];

export function weekLabel(week) {
  const monday = mondayOf(week);
  const sunday = new Date(monday.getTime() + 6 * DAY_MS);
  const d = (x) => x.toISOString().slice(0, 10); // måndag och söndag är UTC-midnatt
  return { title: `Vecka ${isoWeekNumber(monday)}`, range: `${d(monday)} – ${d(sunday)}` };
}

// ---------- Veckan ----------

export function renderWeekGrid(week, schedule, breakfast) {
  const times = [hhmm(breakfast), hhmm(breakfast + MEAL_AT)];
  $("week").innerHTML = week.plan
    .map((day, i) => {
      const sum = totals(day, week.recipes);
      const meals = day
        .filter((id) => id !== NONE)
        .map((id, m) => `<li><a href="#rc-${id}"><small>${MEALS[m]}${times[m] ? " · " + times[m] : ""}</small>${esc(week.recipes[id].t)}</a></li>`)
        .join("");
      return `<div class="day"><h3>${DAYS[i]}</h3><span class="chip ${schedule[i].kind}">${schedule[i].label}</span><ul>${meals}</ul>` +
        `<div class="tot num">${fmt(sum.k)} kcal · ${fmt(sum.p)} g P · ${fmt(sum.c)} g K</div></div>`;
    })
    .join("");
}

/** Vad kostar en fri lördagsmåltid i veckans underskott? */
export function renderCheatTable(week, targets) {
  const weeklyDeficit = targets.deficit * 7;
  const saturday = week.plan[5].slice(1).reduce((sum, id) => sum + week.recipes[id].m.k, 0);
  const row = (label, extra) =>
    `<tr><td>${label}</td><td class="num">+${fmt(extra)} kcal</td>` +
    `<td class="num">${weeklyDeficit > 0 ? fmt(Math.min(100, (extra / weeklyDeficit) * 100)) : "–"} %</td>` +
    `<td class="num">${fmt(kgPerWeek(Math.max(0, weeklyDeficit - extra) / 7), 2)} kg</td></tr>`;
  const rounded = (extra) => fmt(Math.round((saturday + extra) / 100) * 100);
  $("cheat-table").innerHTML =
    `<thead><tr><th>Lördag</th><th>Över planen</th><th>Av veckans underskott</th><th>Viktnedgång den veckan</th></tr></thead><tbody>` +
    row("Enligt planen (med lördagsgodis)", 0) + row(`Fri måltid, ca ${rounded(500)} kcal`, 500) + row(`Stor fri måltid, ca ${rounded(1000)} kcal`, 1000) + row("Hel fuskdag", 2500) +
    `</tbody>`;
  $("cheat-plan").textContent = fmt(saturday);
}

// ---------- Recept ----------

/** Vit fisk kan bytas mot lax: 75 % av fiskvikten och ingen olja ger ungefär samma kalorier. */
function salmonAlternative(recipe) {
  const fish = recipe.items.find(([id]) => id === "sej" || id === "torsk");
  if (!fish || isExcluded("lax")) return "";
  const [fishId, fishGrams] = fish;
  const oil = recipe.items.find(([id]) => id === "olja");
  const salmon = Math.round((fishGrams * 0.75) / 5) * 5;
  const kcal = (FOOD.lax.k * salmon - FOOD[fishId].k * fishGrams) / 100 - (oil ? (FOOD.olja.k * oil[1]) / 100 : 0);
  const protein = (FOOD.lax.p * salmon - FOOD[fishId].p * fishGrams) / 100;
  return `<p class="alt"><b>Alternativ med lax:</b> ${fmt(salmon)} g laxfilé i stället för ${fmt(fishGrams)} g ${FOOD[fishId].n.toLowerCase()}${oil ? ", och hoppa över oljan" : ""}. Ger ${signed(kcal, 0)} kcal och ${signed(protein, 0)} g protein per portion.</p>`;
}

function adaptationNote(recipe) {
  const changes = [
    ...recipe.subs.map(([from, to]) => `${esc(FOOD[from].n.toLowerCase())} → ${esc(FOOD[to].n.toLowerCase())}`),
    ...recipe.dropped.map((id) => `utan ${esc(FOOD[id].n.toLowerCase())}`),
  ];
  return changes.length ? `<p class="adapt">Anpassat efter dina val: ${changes.join("; ")}.</p>` : "";
}

/**
 * Ett recept som rad; trycker man på raden fälls ingredienser och instruktion ut.
 * `usedOn` = text om när rätten äts (null för lördagsgodisalternativ, false för att inte visa raden alls).
 */
export function recipeRow(recipe, kind, usedOn, withId = false) {
  return `<details class="recipe"${withId ? ` id="rc-${recipe.id}"` : ""}>` +
    `<summary class="row"><span class="kind">${kind}</span><span class="main"><b>${esc(recipe.t)}</b>${recipe.se ? '<small>Säsongsrätt</small>' : ""}</span>` +
    `<span class="end">${fmt(recipe.m.k)} kcal · ${fmt(recipe.m.p)} g P ${CHEVRON}</span></summary>` +
    `<div class="recipe-body">${macroLine(recipe.m)}` +
    `<ul class="ingredients">${recipe.items.map(([id, g]) => `<li><span>${esc(FOOD[id].n)}</span><span class="q">${formatAmount(id, g)}</span></li>`).join("")}</ul>` +
    `<p>${esc(recipe.how)}</p>${salmonAlternative(recipe)}${adaptationNote(recipe)}` +
    (usedOn === false ? "" : `<p class="used">${usedOn ? `Äts: ${usedOn}` : "Byt mot veckans lördagsgodis om du hellre vill ha detta."}</p>`) + `</div></details>`;
}

export function renderRecipes(week, targets, breakfast, weekTitle) {
  const { plan, recipes, season, factors } = week;
  $("recipe-title").textContent = `Recept ${weekTitle.toLowerCase()}`;

  const usedOn = {};
  plan.forEach((day, d) => day.forEach((id, m) => (usedOn[id] ||= []).push(`${DAYS[d].toLowerCase()} ${MEALS[m].toLowerCase()}`)));
  const withId = new Set(); // varje recept får sitt id (som Idag länkar till) på första förekomsten
  const row = (id, kind) => {
    const first = !withId.has(id);
    withId.add(id);
    return recipeRow(recipes[id], kind, usedOn[id]?.join(", "), first);
  };
  const unique = (meal) => [...new Set(plan.map((day) => day[meal]))].filter((id) => id !== NONE);
  const treat = plan[5][3];

  $("r-dinner").innerHTML = plan.map((day, d) => (day[1] === NONE ? "" : row(day[1], `${DAYS[d].slice(0, 3)} ${hhmm(breakfast + MEAL_AT)}`))).join("");
  $("r-breakfast").innerHTML = unique(0).map((id) => row(id, `Frukost ${hhmm(breakfast)}`)).join("");
  $("r-other").innerHTML = unique(2).map((id) => row(id, "Efterrätt")).join("");
  $("r-treat").innerHTML = [treat, ...recipesFor("x", season).filter((id) => id !== treat)]
    .filter((id) => id !== NONE)
    .map((id) => row(id, id === treat ? "Lördag" : "Alternativ"))
    .join("");

  const sum = totals(plan.flat(), recipes);
  const perDay = (x) => fmt(x / 7);
  const produceCarbs = plan.flat().reduce((s, id) => s + recipes[id].items.filter(([f]) => scaleGroupOf(f) === "o").reduce((z, [f, g]) => z + (FOOD[f].c * g) / 100, 0), 0) / 7;
  $("plan-macros").innerHTML =
    `Veckans recept ger i snitt <b class="num">${perDay(sum.k)} kcal</b>, <b class="num">${perDay(sum.p)} g protein</b>, <b class="num">${perDay(sum.c)} g kolhydrater</b> och <b class="num">${perDay(sum.f)} g fett</b> per dag. Av kolhydraterna kommer ca ${fmt(produceCarbs)} g från grönsaker, bär och frukt.` +
    (sum.c / 7 > targets.carbs + 15 ? ` Det är över kolhydratmålet på ${targets.carbs} g: vill du ner dit, hoppa över potatisen, riset eller pastan i eftermiddagsmåltiden ett par dagar i veckan och ta mer grönsaker.` : "");
  $("scale-note").innerHTML =
    `${SEASONS[season].n} (${SEASONS[season].months}): bara färska grönsaker som odlas i Sverige och helst nära dig, inga frysta grönsaker eller konserverade tomater. Tomat, gurka och paprika bara på sommaren (juni–augusti); resten av året blir det kålrot, morötter, rotfrukter, kål och lingon i stället. ` +
    `Två måltider om dagen, så portionerna är större än vanligt. Proteinkällorna är skalade med <b class="num">${fmt(factors.p, 2)}</b>, kolhydratkällorna (gryn, ris, pasta, potatis, bröd, baljväxter) med <b class="num">${fmt(factors.c, 2)}</b> och fettkällorna (olja, ost) med <b class="num">${fmt(factors.f, 2)}</b>, så att veckan landar nära ${fmt(targets.target)} kcal och ${fmt(targets.protein)} g protein per dag. Grönsaker, bär och frukt ligger kvar på fulla mängder för mättnadens skull.`;
}

// ---------- Inköpslista ----------

function shoppingAmount(id, grams) {
  if (FOOD[id].per) return formatAmount(id, grams);
  return grams >= 1000 ? `${fmt(grams / 1000, 1)} kg` : `${fmt(Math.ceil(grams / 50) * 50)} g`;
}

/** `checked` = Set med livsmedel som är avbockade den här veckan. */
export function renderShopping(week, weekTitle, checked) {
  $("shop-title").textContent = `Inköpslista ${weekTitle.toLowerCase()}`;
  $("shop").innerHTML = CATEGORIES.map(([cat, name]) => {
    const foods = Object.keys(week.shopping).filter((id) => categoryOf(id) === cat).sort((a, b) => FOOD[a].n.localeCompare(FOOD[b].n, "sv"));
    if (!foods.length) return "";
    return `<div class="shop-group"><h4>${esc(name)}</h4>${foods
      .map((id) => `<label class="shop-item${checked.has(id) ? " done" : ""}"><input type="checkbox" data-shop="${id}"${checked.has(id) ? " checked" : ""}><span class="name">${esc(FOOD[id].n)}</span><span class="q">${shoppingAmount(id, week.shopping[id])}</span></label>`)
      .join("")}</div>`;
  }).join("");
  updateShoppingProgress();
}

export function updateShoppingProgress() {
  const all = document.querySelectorAll("[data-shop]").length;
  const done = document.querySelectorAll("[data-shop]:checked").length;
  $("shop-progress").textContent = all ? `${done} av ${all} avbockade` : "";
  $("shop-clear").hidden = !done;
}
