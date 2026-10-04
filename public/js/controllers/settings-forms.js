// Inställningarnas formulär: allergier och livsmedel (anpassa), Mina recept och Tillskott.
// Undersidorna i sig styrs av navigation.js; listorna ritas i views/settings.js.

import { $, $$, num, confirmDialog } from "../util.js";
import { exclusions, saveExclusions, myFoods, addMyFood, removeMyFood, cleanMyFood, cleanWord } from "../preferences.js";
import { invalidateMenu } from "../menu.js";
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
    : recipe.g === "b" ? `${recipe.t} är sparat. Välj det som frukost under Profil.` : `${recipe.t} är sparat och kan komma med i veckans meny.`;
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
    $("mr").scrollIntoView({ behavior: "smooth", block: "start" });
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

/** Koppla formulären till appen. */
export function initSettingsForms(deps) {
  ({ update, saveProfile } = deps);
}
