// Allergier, ingredienser användaren inte äter och egna livsmedel. Sparas i webbläsaren.

import { FOOD, CATEGORIES, EXTRA_PRODUCTS, SUBSTITUTES, LEGACY_ALLERGENS, LEGACY_PRODUCTS, allergenById, setCategory } from "./data/foods.js";
import { load, save, readList, stableId, DAYS } from "./util.js";

const EXCLUSIONS_KEY = "ffv-excl";
const MY_FOODS_KEY = "ffv-myfoods";
const EXCLUSIONS_VERSION = 2; // 2 = en allergen per val

/** Bortvalda allergener och livsmedel. Inget är bortvalt från början; varje användare väljer själv. */
export const exclusions = { allergens: new Set(), foods: new Set(), words: new Set() };
/** Egna ord att välja bort (t.ex. "lax"): små bokstäver, 2–40 tecken. */
export const cleanWord = (w) => (typeof w === "string" ? w.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 40) : "");

// ---------- Måltider: efterrätter, fuskdag med godis och billiga råvaror ----------
// "ffv-meals" = { dessertDays: [0–6], treat, cheap, cheatDay }. Saknas något gäller som tidigare: efterrätt alla
// dagar, godis och fri måltid på lördag och vanliga råvaror. Okända fält behålls (se skillen datakompatibilitet).
const MEALS_KEY = "ffv-meals";
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
function cleanMealPrefs(m) {
  const saved = m && typeof m === "object" ? m : {};
  return {
    ...saved,
    dessertDays: Array.isArray(saved.dessertDays) ? ALL_DAYS.filter((d) => saved.dessertDays.includes(d)) : ALL_DAYS,
    treat: saved.treat !== false,
    cheap: saved.cheap === true,
    // Fuskdag: dagen för godiset och den fria måltiden (0 = måndag). Lördag som tidigare om inget är valt.
    cheatDay: Number.isInteger(saved.cheatDay) && saved.cheatDay >= 0 && saved.cheatDay <= 6 ? saved.cheatDay : 5,
  };
}
/** Godiset på fuskdagen heter efter dagen, t.ex. "Fredagsgodis" eller "Lördagsgodis". */
export const treatName = () => `${DAYS[mealPrefs.cheatDay]}sgodis`;
export let mealPrefs = cleanMealPrefs(load(MEALS_KEY, null));
/** Ändra inställningarna för måltider, t.ex. { dessertDays: [0, 2] } eller { cheap: true }. */
export function setMealPrefs(changes) {
  mealPrefs = cleanMealPrefs({ ...mealPrefs, ...changes });
  save(MEALS_KEY, mealPrefs);
}

/** Egna livsmedel: { id, n, k, p, c, f, cat, allergens, replaces, always } */
export let myFoods = [];
let unreadableFoods = [];

export function loadPreferences() {
  const saved = load(EXCLUSIONS_KEY, { v: EXCLUSIONS_VERSION, allergens: [], foods: [] });
  setExclusions(migrateExclusions(saved));
  const { kept, rejected } = readList(load(MY_FOODS_KEY, []), (m, i) =>
    cleanMyFood(m && !/^my_[\w-]+$/.test(m.id) ? { ...m, id: stableId("my_", `${i}:${m.n}`) } : m));
  myFoods = kept;
  unreadableFoods = rejected; // ligger kvar orörda och skrivs tillbaka vid sparning
  registerMyFoods();
}

/**
 * Äldre sparade val (utan versionsnummer) hade allergener i grupper, och några allergener låg bland
 * ingredienserna. Översätt dem en gång till dagens enskilda allergener.
 */
export function migrateExclusions(saved) {
  if (saved.v === EXCLUSIONS_VERSION) return saved;
  const allergens = new Set();
  for (const a of saved.allergens || []) for (const id of LEGACY_ALLERGENS[a] || [a]) allergens.add(id);
  const foods = [];
  for (const f of saved.foods || []) (LEGACY_PRODUCTS[f] ? allergens.add(LEGACY_PRODUCTS[f]) : foods.push(f));
  return { allergens: [...allergens], foods };
}

export function setExclusions({ allergens = [], foods = [], words = [] }) {
  exclusions.allergens = new Set(allergens.filter((a) => allergenById(a)));
  exclusions.foods = new Set(foods.filter((f) => typeof f === "string"));
  exclusions.words = new Set(words.map(cleanWord).filter((w) => w.length >= 2));
}

export const saveExclusions = () =>
  save(EXCLUSIONS_KEY, { v: EXCLUSIONS_VERSION, allergens: [...exclusions.allergens], foods: [...exclusions.foods], words: [...exclusions.words] });

export function addMyFood(food) {
  myFoods.push(food);
  saveMyFoods();
}

export function removeMyFood(id) {
  myFoods = myFoods.filter((m) => m.id !== id);
  saveMyFoods();
}

/** Lägg till egna livsmedel från en import; befintliga med samma id behålls. */
function saveMyFoods() {
  save(MY_FOODS_KEY, [...myFoods, ...unreadableFoods]);
  registerMyFoods();
}

/** Gör de egna livsmedlen kända i FOOD så att de kan användas i recept och inköpslista. */
function registerMyFoods() {
  for (const id of Object.keys(FOOD)) if (FOOD[id].mine) delete FOOD[id];
  for (const m of myFoods) {
    FOOD[m.id] = { n: m.n, k: m.k, p: m.p, c: m.c, f: m.f, mine: true };
    setCategory(m.id, m.cat);
  }
}

/** Kontrollera och städa ett eget livsmedel (från formuläret eller en import). Ger null om det är ogiltigt. */
export function cleanMyFood(m) {
  if (!m || typeof m.n !== "string" || !m.n.trim()) return null;
  const nutrient = (x) => (typeof x === "number" && x >= 0 && x <= 900 ? x : 0);
  return {
    id: /^my_[\w-]+$/.test(m.id) ? m.id : "my_" + Math.random().toString(36).slice(2, 9),
    n: m.n.trim().slice(0, 60),
    k: nutrient(m.k), p: nutrient(m.p), c: nutrient(m.c), f: nutrient(m.f),
    cat: CATEGORIES.some(([c]) => c === m.cat) ? m.cat : "skafferi",
    allergens: Array.isArray(m.allergens) ? m.allergens.filter((a) => allergenById(a)) : [],
    replaces: typeof m.replaces === "string" ? m.replaces : "",
    always: !!m.always,
  };
}

/** Är livsmedlet bortvalt, direkt eller via en allergen? Egna livsmedel känns också igen på namnet. */
export function isExcluded(foodId) {
  if (exclusions.foods.has(foodId)) return true;
  const mine = myFoods.find((m) => m.id === foodId);
  const name = mine ? " " + mine.n.toLowerCase() + " " : "";
  for (const id of exclusions.allergens) {
    const allergen = allergenById(id);
    if (allergen.foods.includes(foodId)) return true;
    if (mine && (mine.allergens.includes(id) || allergen.words.some((w) => name.includes(w)))) return true;
  }
  // Bortvalda produkter (t.ex. kiwi) stoppar både appens livsmedel och egna livsmedel med samma namn
  const anyName = name || (FOOD[foodId] ? " " + FOOD[foodId].n.toLowerCase() + " " : "");
  for (const product of EXTRA_PRODUCTS) if (exclusions.foods.has(product.id) && anyName.includes(product.word)) return true;
  for (const word of exclusions.words) if (anyName.includes(word)) return true; // egna ord, t.ex. "lax"
  return false;
}

/**
 * Vilket livsmedel ska användas i stället för `foodId`?
 * Ett eget livsmedel som "alltid" ersätter vinner. Annars originalet om det inte är bortvalt,
 * annars ett eget livsmedel som ersätter det, annars första tillåtna i SUBSTITUTES. null = inget passar.
 */
export function substituteFor(foodId) {
  const always = myFoods.find((m) => m.replaces === foodId && m.always && !isExcluded(m.id));
  if (always) return always.id;
  if (!isExcluded(foodId)) return foodId;
  const mine = myFoods.find((m) => m.replaces === foodId && !isExcluded(m.id));
  if (mine) return mine.id;
  return (SUBSTITUTES[foodId] || []).find((s) => !isExcluded(s)) ?? null;
}

/** Ändra instruktionstext när en allergen som nämns i texten är bortvald. */
export function adaptInstructions(text) {
  let t = text;
  if (exclusions.allergens.has("soja") || exclusions.allergens.has("vete")) t = t.replace(/soja, /g, "salt, ").replace(/ soja\b/g, " salt"); // soja innehåller oftast vete
  if (exclusions.allergens.has("senap") || exclusions.foods.has("x_senap")) t = t.replace(/ med senap och dill/g, " med dill").replace(/senap, /g, "");
  if (exclusions.allergens.has("citron")) t = t.replace(/\bcitron\b/g, "en skvätt äppelcidervinäger");
  if (exclusions.allergens.has("lime")) t = t.replace(/\blime\b/g, "en skvätt äppelcidervinäger");
  return t;
}

