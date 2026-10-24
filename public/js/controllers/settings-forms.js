// Inställningarnas formulär: allergier och livsmedel (anpassa), Mina recept och Tillskott.
// Undersidorna i sig styrs av navigation.js; listorna ritas i views/settings.js.

import { $, $$, esc, num, confirmDialog, scrollToElement, DAYS } from "../util.js";
import { exclusions, saveExclusions, myFoods, addMyFood, removeMyFood, cleanMyFood, cleanWord, mealPrefs, setMealPrefs, treatName } from "../preferences.js";
import { invalidateMenu } from "../menu.js";
import { FOOD, ALTERNATIVES } from "../data/foods.js";
import { renderIngredientPicker, recipeItemRow, readRecipeItems, updateRecipeSum, syncItemUnits, fillRecipeForm } from "../views/settings.js";
import { myRecipes, addMyRecipe, updateMyRecipe, removeMyRecipe, cleanRecipe } from "../myrecipes.js";
import { setUsing, cleanMySupp, addMySupp, removeMySupp, mySupps } from "../supplements.js";

let update = () => {}; // ritar om appen; sätts av initSettingsForms()
let saveProfile = () => {}; // sparar profilen, t.ex. när valt frukostrecept ändras

/** Allergier, bortval eller egna ord har ändrats: spara, bygg om menyn och rita om. */
const preferencesChanged = () => {
  saveExclusions();
  invalidateMenu();
  update();
};

// Allergier och livsmedel

$("anpassa").addEventListener("change", (ev) => {
  const { allergen, food } = ev.target.dataset;
  const set = allergen ? exclusions.allergens : food ? exclusions.foods : null;
  if (!set) return;
  const id = allergen || food;
  if (ev.target.checked) set.add(id);
  else set.delete(id);
  preferencesChanged();
});
$("ex-search").addEventListener("input", renderIngredientPicker);
// Egna ord att välja bort, t.ex. "lax"
$("ex-word-form").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const word = cleanWord($("ex-word").value);
  if (word.length < 2) return;
  exclusions.words.add(word);
  $("ex-word").value = "";
  preferencesChanged();
});
$("ex-words").addEventListener("click", (ev) => {
  const word = ev.target.closest("[data-word-del]")?.dataset.wordDel;
  if (!word) return;
  exclusions.words.delete(word);
  preferencesChanged();
});
$("mf").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const kcal = num($("mf-k").value);
  const food = cleanMyFood({
    n: $("mf-name").value, k: kcal, p: num($("mf-p").value) || 0, c: num($("mf-c").value) || 0, f: num($("mf-f").value) || 0,
    cat: $("mf-cat").value, replaces: $("mf-rep").value, always: $("mf-mode").value === "always",
    allergens: $$("[data-mfallergen]:checked").map((x) => x.dataset.mfallergen),
  });
  if (!food || kcal == null) return ($("mf-msg").textContent = "Fyll i namn och kalorier per 100 g.");
  if (food.p + food.c + food.f > 100.5) return ($("mf-msg").textContent = "Protein, kolhydrater och fett kan inte bli mer än 100 g per 100 g.");
  addMyFood(food);
  $("mf").reset();
  for (const x of $$("[data-mfallergen]")) x.checked = false;
  $("mf-msg").textContent = `${food.n} är tillagt.`;
  invalidateMenu();
  update();
});
$("mf-list").addEventListener("click", async (ev) => {
  const id = ev.target.closest("[data-mfdel]")?.dataset.mfdel;
  if (!id || !(await confirmDialog(`Är du säker på att du vill ta bort ${myFoods.find((m) => m.id === id)?.n || "livsmedlet"}?`))) return;
  removeMyFood(id);
  invalidateMenu();
  update();
});

// Mina recept

/** Egna frukostrecept blir val i Profil → Frukost. */
export function syncBreakfastOptions() {
  const select = $("bmeal");
  const chosen = select.value;
  for (const option of [...select.options]) if (option.dataset.mine) option.remove();
  const rotate = [...select.options].find((o) => o.value === "rot");
  for (const r of myRecipes.filter((x) => x.g === "b")) {
    const option = Object.assign(document.createElement("option"), { value: r.id, textContent: `Samma varje dag: ${r.t} (eget recept)` });
    option.dataset.mine = "1";
    select.insertBefore(option, rotate);
  }
  select.value = [...select.options].some((o) => o.value === chosen) ? chosen : "F0";
}

$("mr-add").addEventListener("click", () => $("mr-items").insertAdjacentHTML("beforeend", recipeItemRow()));
$("mr-items").addEventListener("click", (ev) => {
  if (!ev.target.matches("[data-mr-remove]")) return;
  ev.target.closest(".mr-item").remove();
  updateRecipeSum();
});
$("mr-items").addEventListener("input", updateRecipeSum);
$("mr-items").addEventListener("change", (ev) => {
  if (ev.target.matches("[data-mr-food]")) syncItemUnits(ev.target.closest(".mr-item"));
  updateRecipeSum();
});
let editingRecipe = null; // id för receptet som ändras, annars null (nytt recept)

/** Töm receptformuläret och gå tillbaka till att lägga till ett nytt recept. */
function resetRecipeForm() {
  editingRecipe = null;
  $("mr").reset();
  $("mr-items").innerHTML = "";
  $("mr-sum").textContent = "";
  $("mr-save").textContent = "Spara recept";
  $("mr-cancel").hidden = true;
}

$("mr").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const { items, extra } = readRecipeItems();
  const recipe = cleanRecipe({ id: editingRecipe, t: $("mr-name").value, g: $("mr-type").value, items, extra, how: $("mr-how").value });
  if (!recipe) return ($("mr-msg").textContent = "Ge receptet ett namn och minst en ingrediens från listan med mängd.");
  const edited = !!editingRecipe;
  if (edited) updateMyRecipe(recipe);
  else addMyRecipe(recipe);
  syncBreakfastOptions();
  if (edited) saveProfile(); // ett ändrat frukostrecept är fortfarande valt
  resetRecipeForm();
  $("mr-msg").textContent = edited ? `Ändringarna i ${recipe.t} är sparade.`
    : recipe.g === "b" ? `${recipe.t} är sparat. Välj det som frukost under Profil.`
    : recipe.g === "s" ? `${recipe.t} är sparat. Välj vilka dagar du vill ha tillbehör under Inställningar → Måltider.` : `${recipe.t} är sparat och kan komma med i veckans meny.`;
  invalidateMenu();
  update();
});
$("mr-cancel").addEventListener("click", () => {
  resetRecipeForm();
  $("mr-msg").textContent = "";
  update();
});
$("mr-list").addEventListener("click", async (ev) => {
  const editId = ev.target.closest("[data-mredit]")?.dataset.mredit;
  if (editId) {
    const recipe = myRecipes.find((r) => r.id === editId);
    if (!recipe) return;
    editingRecipe = editId;
    fillRecipeForm(recipe);
    $("mr-save").textContent = "Spara ändringar";
    $("mr-cancel").hidden = false;
    $("mr-msg").textContent = `Du ändrar ${recipe.t}.`;
    scrollToElement($("mr"), { smooth: true });
    return;
  }
  const id = ev.target.closest("[data-mrdel]")?.dataset.mrdel;
  if (!id || !(await confirmDialog(`Är du säker på att du vill ta bort receptet ${myRecipes.find((r) => r.id === id)?.t || ""}?`))) return;
  removeMyRecipe(id);
  if (id === editingRecipe) resetRecipeForm();
  syncBreakfastOptions();
  saveProfile();
  invalidateMenu();
  update();
});
// Egna tillskott
$("ms-when").addEventListener("change", () => ($("ms-at-field").hidden = $("ms-when").value !== "clock"));
$("ms-form").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const supp = cleanMySupp({ n: $("ms-name").value, dose: $("ms-dose").value, when: $("ms-when").value, at: $("ms-at").value, kcal: $("ms-kcal").checked });
  if (!supp) return ($("ms-msg").textContent = $("ms-when").value === "clock" ? "Fyll i namn och klockslag (HH:MM)." : "Fyll i ett namn.");
  addMySupp(supp);
  $("ms-form").reset();
  $("ms-at-field").hidden = true;
  $("ms-msg").textContent = `${supp.n} är tillagt och visas på Idag.`;
  update();
});
$("ms-list").addEventListener("click", async (ev) => {
  const id = ev.target.closest("[data-msdel]")?.dataset.msdel;
  if (!id || !(await confirmDialog(`Är du säker på att du vill ta bort ${mySupps.find((m) => m.id === id)?.n || "tillskottet"}?`))) return;
  removeMySupp(id);
  update();
});
$("supps").addEventListener("change", () => {
  setUsing($$("[data-supp]:checked").map((el) => el.dataset.supp));
  update();
});

// Måltider: efterrätt vilka dagar och fuskdag med godis (mealPrefs i preferences.js). Billiga råvaror (också i
// mealPrefs) väljs under Inställningar → Inköpslista.
/** Visa de sparade valen. */
export function renderMealPrefs() {
  const { dessertDays, treat, cheap } = mealPrefs;
  $("ml-dessert-on").checked = dessertDays.length > 0;
  for (const el of $$("[data-dessert-day]")) {
    el.checked = dessertDays.includes(Number(el.dataset.dessertDay));
    el.disabled = !dessertDays.length;
  }
  // Tillbehör: egna recept av typen tillbehör, de valda dagarna
  const sides = myRecipes.filter((r) => r.g === "s");
  $("ml-side-on").checked = mealPrefs.sideDays.length > 0;
  for (const el of $$("[data-side-day]")) {
    el.checked = mealPrefs.sideDays.includes(Number(el.dataset.sideDay));
    el.disabled = !mealPrefs.sideDays.length;
  }
  $("ml-side-hint").innerHTML = sides.length
    ? `Dina tillbehör: ${sides.map((r) => esc(r.t)).join(", ")}${sides.length > 1 ? " (de turas om)" : ""}. Ändra eller lägg till fler under <a href="#mina-recept">Mina recept</a>.`
    : `Du har inga tillbehör än. Lägg till ett under <a href="#mina-recept">Mina recept</a> och välj Måltid: Tillbehör till eftermiddagsmåltiden.`;
  $("ml-swaps").innerHTML = Object.entries(ALTERNATIVES).map(([from, alts]) =>
    `<label class="swap-row"><span>${esc(FOOD[from].n)}</span><select data-swap-food="${from}" aria-label="Byt ${esc(FOOD[from].n.toLowerCase())} mot">` +
    `<option value="">Som i receptet</option>${alts.map((to) => `<option value="${to}"${mealPrefs.swaps[from] === to ? " selected" : ""}>${esc(FOOD[to].n)}</option>`).join("")}</select></label>`).join("");
  $("ml-treat").checked = treat;
  $("ml-cheap").checked = cheap;
  $("ml-cheat-day").value = String(mealPrefs.cheatDay);
  // Texter som nämner fuskdagen, t.ex. "Fuska på fredagen" och "Fredagsgodiset"
  const day = DAYS[mealPrefs.cheatDay].toLowerCase();
  const words = { def: `${day}en`, gen: `${day}ens`, Gen: `${DAYS[mealPrefs.cheatDay]}ens`, treat: `${treatName().toLowerCase()}et`, Treat: `${treatName()}et`, Name: treatName() };
  for (const el of $$("[data-cheat]")) el.textContent = words[el.dataset.cheat];
}
$("maltider").addEventListener("change", (ev) => {
  if (ev.target === $("ml-dessert-on")) setMealPrefs({ dessertDays: ev.target.checked ? [0, 1, 2, 3, 4, 5, 6] : [] });
  else if (ev.target.matches("[data-dessert-day]")) setMealPrefs({ dessertDays: $$("[data-dessert-day]:checked").map((el) => Number(el.dataset.dessertDay)) });
  else if (ev.target === $("ml-side-on")) setMealPrefs({ sideDays: ev.target.checked ? [0, 1, 2, 3, 4, 5, 6] : [] });
  else if (ev.target.matches("[data-side-day]")) setMealPrefs({ sideDays: $$("[data-side-day]:checked").map((el) => Number(el.dataset.sideDay)) });
  else if (ev.target === $("ml-treat")) setMealPrefs({ treat: ev.target.checked });
  else if (ev.target === $("ml-cheat-day")) setMealPrefs({ cheatDay: Number(ev.target.value) });
  else return;
  const days = (n) => (n === 7 ? "alla dagar" : n ? `${n} ${n === 1 ? "dag" : "dagar"} i veckan` : "aldrig");
  $("ml-msg").textContent = `Sparat. Efterrätt ${days(mealPrefs.dessertDays.length)}, tillbehör ${days(mealPrefs.sideDays.length)}, fuskdag ${DAYS[mealPrefs.cheatDay].toLowerCase()}${mealPrefs.treat ? ` med ${treatName().toLowerCase()}` : " utan godis"}. Veckans meny och inköpslista är uppdaterade.`;
  invalidateMenu();
  update();
});

// Billiga råvaror ligger under Inställningar → Inköpslista men sparas med de andra valen för måltider
$("ml-swaps").addEventListener("change", (ev) => {
  const from = ev.target.dataset.swapFood;
  if (!from) return;
  const swaps = { ...mealPrefs.swaps };
  if (ev.target.value) swaps[from] = ev.target.value;
  else delete swaps[from];
  setMealPrefs({ swaps });
  $("ml-cheap-msg").textContent = ev.target.value ? `Sparat. ${FOOD[from].n} byts mot ${FOOD[ev.target.value].n.toLowerCase()} i recepten och inköpslistan.` : `Sparat. ${FOOD[from].n} används som i recepten.`;
  invalidateMenu();
  update();
});
$("ml-cheap").addEventListener("change", (ev) => {
  setMealPrefs({ cheap: ev.target.checked });
  $("ml-cheap-msg").textContent = ev.target.checked ? "Sparat. Veckans rätter och inköpslista bygger nu på billiga råvaror." : "Sparat. Veckans rätter använder vanliga råvaror igen.";
  invalidateMenu();
  update();
});

/** Koppla formulären till appen. */
export function initSettingsForms(deps) {
  ({ update, saveProfile } = deps);
}
