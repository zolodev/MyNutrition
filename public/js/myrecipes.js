// Egna recept: användaren bygger ett recept av livsmedel och gram. Ett eget frukostrecept kan väljas som
// frukost varje dag. Recepten sparas i webbläsaren och läggs till i RECIPES, så att de skalas, anpassas
// efter allergier och hamnar i inköpslistan precis som de inbyggda.

import { FOOD } from "./data/foods.js";
import { RECIPES } from "./data/recipes.js";
import { load, save } from "./util.js";

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
  for (const r of myRecipes) RECIPES[r.id] = { t: r.t, g: r.g, items: r.items.filter(([f]) => FOOD[f]), how: r.how || "Eget recept.", mine: true };
}

/** Kontrollera ett recept från formuläret eller en import. Ger null om det saknar namn eller ingredienser. */
export function cleanRecipe(r) {
  if (!r || typeof r.t !== "string" || !r.t.trim() || !Array.isArray(r.items)) return null;
  const items = r.items
    .filter((x) => Array.isArray(x) && typeof x[0] === "string" && x[1] > 0 && x[1] <= 2000)
    .map(([f, g]) => [f, Math.round(g)]);
  if (!items.length) return null;
  return {
    id: /^MR_[\w-]+$/.test(r.id) ? r.id : "MR_" + Math.random().toString(36).slice(2, 9),
    t: r.t.trim().slice(0, 60),
    g: RECIPE_TYPES.some(([g]) => g === r.g) ? r.g : "b",
    items,
    how: typeof r.how === "string" ? r.how.trim().slice(0, 500) : "",
  };
}
