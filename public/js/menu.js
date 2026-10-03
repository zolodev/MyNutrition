// Veckomenyn: säsong, anpassning efter allergier, veckorotation, portionsskalning och inköpslista.

import { FOOD, GASSY, DIGESTIVE_FRUITS } from "./data/foods.js";
import { RECIPES, SEASONAL, NONE } from "./data/recipes.js";
import { substituteFor, adaptInstructions, isExcluded } from "./preferences.js";
import { macros, scaleItems, solveScaling } from "./nutrition.js";
import { DAY_MS, DAYS, mondayOf, seededRandom, shuffle, load, save } from "./util.js";

const SALTS_KEY = "ffv-salt";
const SEED_KEY = "ffv-seed";
const TRAINING_SEED_KEY = "ffv-tseed"; // eget frö för övningarna; saknas det följer träningen receptfröet
const SEED_MIX = 1000003; // fröet blandas in i alla slumptal; frö 0 ger samma menyer som innan plankoden fanns
const SATURDAY = 5;
const MAIN_SHARE_LIMIT = 0.3; // en ingrediens med minst så stor andel av protein eller kalorier är huvudingrediens

// ---------- Säsong ----------

/** Säsong för en vecka, efter månaden på veckans torsdag. */
export function seasonOf(week) {
  const month = new Date(mondayOf(week).getTime() + 3 * DAY_MS).getUTCMonth();
  if (month >= 10 || month <= 1) return "vinter";
  if (month <= 4) return "var";
  if (month <= 7) return "sommar";
  return "host";
}

export const inSeason = (id, season) => !RECIPES[id].se || RECIPES[id].se.includes(season);
const resolveSeasonal = (foodId, season) => (foodId[0] === "@" ? SEASONAL[foodId.slice(1)][season] : foodId);

/** Byt {namn} i en text mot kortnamnet på den råvara som faktiskt används. */
export function fillSeasonalNames(text, season) {
  return text.replace(/\{(\w+)\}/g, (_, slot) => {
    const original = SEASONAL[slot][season];
    const food = FOOD[substituteFor(original) || original];
    return food.s || food.n.toLowerCase();
  });
}

// ---------- Anpassning efter allergier och bortval ----------

let adaptedCache = {};
let dinnerChain = {};

/** Töm cacharna när allergier, egna livsmedel eller omslumpningar ändras. */
export function invalidateMenu() {
  adaptedCache = {};
  dinnerChain = {};
}

/**
 * Anpassa ett recept för en säsong och användarens bortval:
 * bortvalda livsmedel byts mot en ersättare, små ingredienser utan ersättare stryks,
 * och hela rätten stryks (ok: false) om en huvudingrediens saknar ersättare.
 */
export function adaptRecipe(id, season) {
  const key = season + "|" + id;
  if (adaptedCache[key]) return adaptedCache[key];
  const items = RECIPES[id].items.map(([f, g]) => [resolveSeasonal(f, season), g]);
  const total = macros(items);
  const result = { ok: true, items: [], subs: [], dropped: [] };
  for (const [food, grams] of items) {
    const replacement = substituteFor(food);
    if (replacement === food) result.items.push([food, grams]);
    else if (replacement) {
      result.items.push([replacement, grams]);
      result.subs.push([food, replacement]);
    } else {
      const share = Math.max(total.p ? (FOOD[food].p * grams) / 100 / total.p : 0, total.k ? (FOOD[food].k * grams) / 100 / total.k : 0);
      if (share >= MAIN_SHARE_LIMIT) {
        result.ok = false;
        break;
      }
      result.dropped.push(food);
    }
  }
  if (!result.items.length) result.ok = false;
  return (adaptedCache[key] = result);
}

/** Rätter av en typ (b, d, m, x) som passar säsongen och användarens bortval. */
export const recipesFor = (type, season) =>
  Object.keys(RECIPES).filter((id) => RECIPES[id].g === type && inSeason(id, season) && adaptRecipe(id, season).ok);

/** Alla eftermiddagsrätter för säsongen, även de som inte passar bortvalen (för sammanfattningen i Inställningar). */
export const allDinnersIn = (season) => Object.keys(RECIPES).filter((id) => RECIPES[id].g === "d" && inSeason(id, season));

// ---------- Veckorotation ----------
// Varje vecka har en fast, slumpad meny: samma vecka och samma frö ger alltid samma rätter. Fröet (se plancode.js)
// gör planen unik och delbar. Ett "salt" per vecka byter menyn när användaren slumpar om. Middagarna väljs vecka för vecka bland säsongens rätter som inte åts veckan innan,
// så två veckor i följd delar aldrig rätt. Säsongsrätterna (id som börjar på S) prioriteras, upp till tre per vecka.

let salts = load(SALTS_KEY, {}) || {};
let seed = load(SEED_KEY, null);
let trainingSeed = load(TRAINING_SEED_KEY, null);

/** Planens slumpfrö. Nya användare får ett eget; den som redan har en plan får 0, så att den inte ändras. */
export function initSeed(newUser, random) {
  if (seed == null) {
    seed = newUser ? random() : 0;
    save(SEED_KEY, seed);
  }
}
export const planRandomness = () => ({ seed, salts: { ...salts }, trainingSeed: trainingSeed ?? seed });
/** Byt frö, omslumpade veckor och träningens frö, t.ex. från en delad plankod. */
export function setPlanRandomness(newSeed, newSalts = {}, newTrainingSeed = newSeed) {
  seed = newSeed;
  salts = { ...newSalts };
  trainingSeed = newTrainingSeed;
  save(SEED_KEY, seed);
  save(TRAINING_SEED_KEY, trainingSeed);
  saveSalts();
}
function saveSalts() {
  dinnerChain = {};
  save(SALTS_KEY, salts);
}

function dinnersFor(week) {
  if (dinnerChain[week]) return dinnerChain[week];
  let start = week;
  while (start > 0 && !dinnerChain[start - 1]) start--;
  for (let w = start; w <= week; w++) {
    const salt = salts[w] || 0;
    const previous = w > 0 ? dinnerChain[w - 1] : [];
    const pool = recipesFor("d", seasonOf(w));
    const mix = (seed || 0) * SEED_MIX;
    const available = shuffle(pool.filter((id) => !previous.includes(id)), seededRandom(w * 104729 + salt * 7919 + 17 + mix));
    const seasonal = available.filter((id) => id[0] === "S").slice(0, 3);
    const picked = [...seasonal, ...available.filter((id) => !seasonal.includes(id)).slice(0, 7 - seasonal.length)];
    // Passar för få rätter: fyll på med förra veckans, och upprepa om banken ändå är mindre än sju
    if (picked.length < 7) picked.push(...shuffle(pool.filter((id) => !picked.includes(id)), seededRandom(w * 7 + salt + 3 + mix)).slice(0, 7 - picked.length));
    const mixed = shuffle(picked, seededRandom(w * 31 + salt + 5 + mix));
    dinnerChain[w] = DAYS.map((_, i) => (mixed.length ? mixed[i % mixed.length] : NONE));
  }
  return dinnerChain[week];
}

/**
 * Veckans plan: en rad per dag med [frukost, eftermiddagsmåltid, efterrätt], och på lördag även lördagsgodis.
 * `breakfastChoice` är ett frukost-id (samma varje dag) eller "rot" för en ny frukost varje dag.
 */
export function weekPlan(week, breakfastChoice) {
  const season = seasonOf(week);
  const random = seededRandom(week * 2654435761 + (salts[week] || 0) * 97 + 3 + (seed || 0) * SEED_MIX);
  const spread = (pool) => {
    if (!pool.length) return DAYS.map(() => NONE);
    const order = shuffle(pool, random);
    return DAYS.map((_, i) => order[i % order.length]);
  };
  const dinners = dinnersFor(week);
  const desserts = spread(recipesFor("m", season));
  const breakfastPool = recipesFor("b", season);
  const fixedBreakfast = breakfastPool.includes(breakfastChoice) ? breakfastChoice : breakfastPool.includes("F0") ? "F0" : breakfastPool[0] || NONE;
  const breakfasts = breakfastChoice === "rot" ? spread(breakfastPool) : DAYS.map(() => fixedBreakfast);
  const treat = shuffle(recipesFor("x", season), random)[0] || NONE;
  return DAYS.map((_, i) => (i === SATURDAY ? [breakfasts[i], dinners[i], desserts[i], treat] : [breakfasts[i], dinners[i], desserts[i]]));
}

// ---------- Veckans recept, skalade efter målen ----------

/**
 * Bygg veckans meny: säsongsanpassade och skalade recept, dagssummor och inköpslista.
 * Returnerar { season, plan, recipes, factors, shopping }. `recipes[id]` har t, how, items, m (makron), subs, dropped.
 */
/** Vilken frukt med enzymer en rätt får en viss vecka: olika för olika rätter och veckor, aldrig en bortvald. */
function digestiveFruit(recipeId, week) {
  const start = [...recipeId].reduce((h, c) => h + c.charCodeAt(0), 0) + week;
  for (let i = 0; i < DIGESTIVE_FRUITS.length; i++) {
    const fruit = DIGESTIVE_FRUITS[(start + i) % DIGESTIVE_FRUITS.length];
    if (!isExcluded(fruit)) return fruit;
  }
  return null;
}

export function buildWeek(week, targets, breakfastChoice) {
  const season = seasonOf(week);
  const plan = weekPlan(week, breakfastChoice);

  // Säsongsanpassa och anpassa efter bortval. Måltider med ägg, kål eller baljväxter får 100 g frukt med enzymer;
  // frukten växlar mellan rätterna och veckorna, och bortvalda frukter hoppas över.
  const base = {};
  for (const id of Object.keys(RECIPES)) {
    const recipe = RECIPES[id];
    const adapted = adaptRecipe(id, season);
    const items = adapted.ok ? adapted.items.slice() : [];
    if ((recipe.g === "b" || recipe.g === "d") && items.some(([f]) => GASSY.has(f))) {
      const fruit = digestiveFruit(id, week);
      if (fruit) items.push([fruit, 100]);
    }
    base[id] = {
      ...recipe, id, items, subs: adapted.subs, dropped: adapted.dropped,
      t: fillSeasonalNames(recipe.t, season),
      how: adaptInstructions(fillSeasonalNames(recipe.how, season)),
    };
  }

  // Skala allt utom lördagsgodiset så att veckan träffar målen
  const eaten = plan.flat();
  const scalable = eaten.filter((id) => base[id].g !== "x").flatMap((id) => base[id].items);
  const fixed = eaten.filter((id) => base[id].g === "x").flatMap((id) => base[id].items);
  const factors = solveScaling(scalable, fixed, targets);

  const recipes = {};
  for (const id of Object.keys(base)) {
    const items = base[id].g === "x" ? base[id].items : scaleItems(base[id].items, factors);
    recipes[id] = { ...base[id], items, m: macros(items) };
  }

  const shopping = {};
  for (const id of eaten) for (const [food, grams] of recipes[id].items) shopping[food] = (shopping[food] || 0) + grams;

  return { season, plan, recipes, factors, shopping };
}

/** Summa kcal, protein, kolhydrater och fett för en lista recept-id. */
export function totals(ids, recipes) {
  return ids.reduce((sum, id) => {
    const m = recipes[id].m;
    return { k: sum.k + m.k, p: sum.p + m.p, c: sum.c + m.c, f: sum.f + m.f };
  }, { k: 0, p: 0, c: 0, f: 0 });
}
