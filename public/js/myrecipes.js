// Egna recept: användaren bygger ett recept av livsmedel i valfritt mått (gram, st, dl, msk …) och egna ingredienser
// som kryddor (räknas inte i näringen). Ett eget frukostrecept kan väljas som
// frukost varje dag. Recepten sparas i webbläsaren och läggs till i RECIPES, så att de skalas, anpassas
// efter allergier och hamnar i inköpslistan precis som de inbyggda.

import { FOOD } from "./data/foods.js";
import { RECIPES } from "./data/recipes.js";
import { load, save } from "./util.js";
import { UNITS } from "./nutrition.js";

const KEY = "ffv-myrecipes";
export const RECIPE_TYPES = [["b", "Frukost"], ["m", "Efterrätt eller tillägg"], ["d", "Eftermiddagsmåltid"]];
export let myRecipes = [];

export function loadMyRecipes() {
  myRecipes = load(KEY, []).map(cleanRecipe).filter(Boolean);
  register();
}

export function addMyRecipe(recipe) {
  myRecipes.push(recipe);
  persist();
}

/** Ersätt ett befintligt recept (samma id), t.ex. efter att det har ändrats. */
export function updateMyRecipe(recipe) {
  myRecipes = myRecipes.map((r) => (r.id === recipe.id ? recipe : r));
  persist();
}

export function removeMyRecipe(id) {
  myRecipes = myRecipes.filter((r) => r.id !== id);
  persist();
}

/** Lägg till recept från en import; befintliga med samma id behålls. */
function persist() {
  save(KEY, myRecipes);
  register();
}

function register() {
  for (const id of Object.keys(RECIPES)) if (RECIPES[id].mine) delete RECIPES[id];
  for (const r of myRecipes) {
    const items = r.items.filter(([f]) => FOOD[f]);
    RECIPES[r.id] = {
      t: r.t, g: r.g, items: items.map(([f, g]) => [f, g]), how: r.how || "Eget recept.", mine: true,
      units: Object.fromEntries(items.filter(([, , , u]) => u && u !== "g").map(([f, , , u]) => [f, u])), // visas i användarens mått
      extra: r.extra, // egna ingredienser, t.ex. salt; ingår inte i näringen
    };
  }
}

/**
 * Kontrollera ett recept från formuläret eller en import. Ger null om det saknar namn eller ingredienser.
 * items: [livsmedel, gram, mängd, mått] (mängd och mått är det användaren skrev, t.ex. 2 och "st"; äldre recept har
 * bara gram). extra: egna ingredienser { n, q, u } som inte finns i livsmedelslistan.
 */
export function cleanRecipe(r) {
  if (!r || typeof r.t !== "string" || !r.t.trim() || !Array.isArray(r.items)) return null;
  const unit = (u) => (UNITS.includes(u) ? u : null);
  const items = r.items
    .filter((x) => Array.isArray(x) && typeof x[0] === "string" && x[1] > 0 && x[1] <= 5000)
    .map(([f, g, q, u]) => (q > 0 && unit(u) ? [f, Math.round(g), q, u] : [f, Math.round(g)]));
  const extra = (Array.isArray(r.extra) ? r.extra : [])
    .filter((x) => typeof x?.n === "string" && x.n.trim())
    .map((x) => ({ n: x.n.trim().slice(0, 40), q: x.q > 0 ? x.q : null, u: unit(x.u) || "" }))
    .slice(0, 20);
  if (!items.length) return null;
  return {
    id: /^MR_[\w-]+$/.test(r.id) ? r.id : "MR_" + Math.random().toString(36).slice(2, 9),
    t: r.t.trim().slice(0, 60),
    g: RECIPE_TYPES.some(([g]) => g === r.g) ? r.g : "b",
    items,
    extra,
    how: typeof r.how === "string" ? r.how.trim() : "", // ingen gräns för beskrivningen
  };
}
