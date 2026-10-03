// Appens styrning: läser profilen, räknar om och ritar alla vyer, kopplar knappar och formulär och sköter flikarna.

import { $, $$, num, radioValue, setRadio, load, save, remove, todayStr, dayToDate, dateToDay, svDate, weekIndexOf, confirmDialog, toast, checkDecimal, formatClockInput, isClockText, DAYS_SHORT } from "./util.js";
import { computeTargets, kgPerWeek, recommendedGoal } from "./nutrition.js";
import { loadPreferences, exclusions, saveExclusions, setExclusions, myFoods, addMyFood, removeMyFood, cleanMyFood, cleanWord } from "./preferences.js";
import { buildWeek, invalidateMenu, initSeed, planRandomness, setPlanRandomness } from "./menu.js";
import { encodePlan, decodePlan, prettyCode, randomSeed } from "./plancode.js";
import { SEASONS } from "./data/recipes.js";
import { parseTrainingDays, buildProgram, SWAP_TEXT } from "./training.js";
import { loadLog, entries, entryFor, upsertEntry, removeEntry, cleanEntry, isIsoDate, parseWorkoutTime, formatWorkoutInput, formatHms, cleanCardio, CARDIO, intensityMinutes, setMealTimes } from "./log.js";
import { renderTargets, renderGoalAdvice } from "./views/profile.js";
import { renderToday, renderFasting } from "./views/today.js";
import { renderFastingToday, renderFastingNow, todaysFasting } from "./views/fasting-view.js";
import { formatClock, parseClock } from "./fasting.js";
import { WINDOW } from "./day.js";
import { weekLabel, renderWeekGrid, renderCheatTable, renderRecipes, renderShopping, updateShoppingProgress } from "./views/food.js";
import { renderProgram } from "./views/training-view.js";
import { renderLog, cardioRow } from "./views/log-view.js";
import { renderReport } from "./views/report.js";
import { renderSettings, renderIngredientPicker, recipeItemRow, readRecipeItems, updateRecipeSum } from "./views/settings.js";
import { loadMyRecipes, myRecipes, addMyRecipe, removeMyRecipe, cleanRecipe } from "./myrecipes.js";
import { exportText, readBackup, describe, restore, hasStoredData, eraseAll } from "./backup.js";
import { setUsing, cleanMySupp, addMySupp, removeMySupp, mySupps } from "./supplements.js";
import { openWizard } from "./wizard.js";
import { unlockStorage, keys as storageKeys } from "./storage.js";
import "./pwa.js";

// ---------- Tillstånd ----------

const TODAY_WEEK = weekIndexOf(new Date());
const state = {
  week: TODAY_WEEK, // veckan som visas under Mat
  trainingDays: [0, 2, 4], // senaste giltiga val av gymdagar
  subview: "vecka", // senast valda underflik under Mat
};

// ---------- Profilen ----------
// Sparas som { fältets id: värde } under "ffv", så att äldre sparade uppgifter och exporter fortsätter fungera.

const PROFILE_KEY = "ffv";
const PROFILE_FIELDS = ["age", "weight", "height", "bf", "act", "bfast", "bmeal", "goal", "tdays-val", "exswap"];
const PROFILE_RADIOS = ["sex", "rate", "eq"];

function readProfile() {
  const days = parseTrainingDays($("tdays-val").value, state.trainingDays);
  state.trainingDays = days.days;
  return {
    sex: radioValue("sex"),
    age: num($("age").value) || 40,
    weight: num($("weight").value) || 80,
    height: num($("height").value) || 175,
    bodyFat: num($("bf").value),
    activity: +$("act").value,
    rate: +radioValue("rate"),
    equipment: radioValue("eq"),
    breakfastHour: +$("bfast").value || 7,
    breakfastChoice: $("bmeal").value,
    swapPeriod: Number($("exswap").value) || 1,
    goal: num($("goal").value),
    days,
  };
}

const profileAsJson = () => Object.fromEntries([...PROFILE_FIELDS.map((id) => [id, $(id).value]), ...PROFILE_RADIOS.map((n) => [n, radioValue(n)])]);

function applyProfile(saved) {
  for (const id of PROFILE_FIELDS) if (saved[id] != null) $(id).value = saved[id];
  for (const name of PROFILE_RADIOS) if (saved[name] != null) setRadio(name, saved[name]);
  // Äldre versioner sparade bara antal gymdagar
  if (saved["tdays-val"] == null && saved.days) $("tdays-val").value = saved.days == 4 ? "0,1,3,4" : "0,2,4";
  syncDayButtons();
}

function showSaved(text) {
  $("saved").hidden = false;
  $("saved-hint").hidden = true;
  $("saved-text").textContent = text;
}

function saveProfile() {
  const ok = save(PROFILE_KEY, profileAsJson());
  showSaved(ok
    ? `Sparat i den här webbläsaren ${new Date().toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}`
    : "Webbläsaren tillåter inte att uppgifterna sparas (t.ex. privat läge).");
}

// ---------- Målvikt och villkor ----------

let suggestedGoal = null; // senaste förslaget, så att det följer med om vikten ändras men aldrig skriver över ett eget val

/** Fyll i målvikten vid BMI 21,7 (mitt i normalvikt) som förslag när BMI är över 25 och användaren inte har valt en egen. */
function suggestGoal() {
  const recommended = recommendedGoal(num($("weight").value), num($("height").value));
  const current = num($("goal").value);
  if (recommended != null && (current == null || current === suggestedGoal)) {
    $("goal").value = String(recommended).replace(".", ",");
    suggestedGoal = recommended;
  }
}

function showGoalAdvice() {
  const profile = readProfile();
  renderGoalAdvice({ weight: num($("weight").value), height: num($("height").value), goal: num($("goal").value), targets: computeTargets(profile) });
}

// Godkända villkor gäller enheten (följer inte med i exporten). Höj versionen när villkoren ändras.
const TERMS_KEY = "ffv-terms";
const TERMS_VERSION = 4; // 4: uppgifterna sparas i IndexedDB (localStorage som reserv)
const termsAccepted = () => load(TERMS_KEY, null)?.version === TERMS_VERSION;
/** Godkänn villkoren: först nu får appen skriva till lagringen (se storage.js). */
function acceptTerms() {
  save(TERMS_KEY, { version: TERMS_VERSION, accepted: new Date().toISOString() });
  return unlockStorage();
}

function syncDayButtons() {
  const chosen = new Set(String($("tdays-val").value).split(","));
  for (const el of $$("[data-day]")) el.checked = chosen.has(el.dataset.day);
}

function showTrainingDaysMessage({ valid, picked }) {
  const msg = $("tdays-msg");
  msg.className = valid ? "" : "bad";
  msg.textContent = valid
    ? `${picked.length} dagar: ${picked.length === 3 ? "helkropp, överkropp och ben" : "över- och underkropp två gånger var"}.`
    : `Välj 3 eller 4 dagar (nu ${picked.length}). Planen använder ${state.trainingDays.map((d) => DAYS_SHORT[d]).join(", ")} så länge.`;
}

// Sifferfält tar både 85,5 och 85.5; kontrollera talet medan man skriver (före formulärens egna lyssnare)
document.addEventListener("input", (ev) => {
  if (ev.target.matches?.("input[data-decimal]")) checkDecimal(ev.target);
}, true);

// Klockslag (data-clock) skrivs alltid som HH:MM, 24 timmar, oavsett webbläsarens språk
document.addEventListener("input", (ev) => {
  if (!ev.target.matches?.("input[data-clock]")) return;
  const formatted = formatClockInput(ev.target.value);
  if (formatted !== ev.target.value) ev.target.value = formatted;
  ev.target.setCustomValidity("");
}, true);
document.addEventListener("change", (ev) => {
  if (!ev.target.matches?.("input[data-clock]")) return;
  const el = ev.target;
  if (el.value) el.value = formatClockInput(el.value, { final: true });
  el.setCustomValidity(!el.value || isClockText(el.value) ? "" : "Skriv klockslaget som HH:MM, t.ex. 07:30 eller 19:45");
}, true);

// Informationsikoner (data-info): visa eller dölj förklaringen som knappen pekar på med aria-controls
document.addEventListener("click", (ev) => {
  const button = ev.target.closest?.("[data-info]");
  if (!button) return;
  const text = $(button.getAttribute("aria-controls"));
  text.hidden = !text.hidden;
  button.setAttribute("aria-expanded", String(!text.hidden));
});

// ---------- Rita om allt ----------

// Inköpslistan: det man har bockat av ("har hemma") gäller i alla veckor tills man själv bockar ur det.
const SHOP_KEY = "ffv-shop";
const boughtFoods = () => new Set(load(SHOP_KEY, []));

/**
 * Äldre versioner sparade avbockningar per vecka (ffv-shop-<vecka>). Flytta dem till den gemensamma listan:
 * det som är avbockat för den här och kommande veckor följer med, gamla veckor tas bort.
 */
function migrateShopping() {
  const weekly = storageKeys().filter((k) => /^ffv-shop-\d+$/.test(k));
  if (!weekly.length) return;
  const bought = boughtFoods();
  for (const k of weekly) {
    if (Number(k.slice("ffv-shop-".length)) >= TODAY_WEEK) for (const food of load(k, [])) bought.add(food);
    remove(k);
  }
  save(SHOP_KEY, [...bought]);
}

function update() {
  const profile = readProfile();
  showTrainingDaysMessage(profile.days);
  const targets = computeTargets(profile);
  const program = buildProgram(profile.equipment, profile.days.days, { seed: planRandomness().trainingSeed || 0, week: state.week, period: profile.swapPeriod });
  const week = buildWeek(state.week, targets, profile.breakfastChoice);
  const label = weekLabel(state.week);

  renderTargets(targets, profile.goal);
  renderProgram(program);
  $("prog-week").textContent = `Övningarna för ${label.title.toLowerCase()}${state.week === TODAY_WEEK ? " (denna vecka)" : ""}. De byts ${SWAP_TEXT[profile.swapPeriod]}; passindelningen är alltid densamma. Byt vecka under Mat → Veckan.`;

  $("wk-title").textContent = `${label.title} · ${SEASONS[week.season].n}`;
  $("wk-range").textContent = label.range + (state.week === TODAY_WEEK ? " · denna vecka" : state.week === TODAY_WEEK + 1 ? " · nästa vecka" : "");
  $("wk-today").hidden = state.week === TODAY_WEEK;
  renderWeekGrid(week, program.schedule, profile.breakfastHour);
  renderCheatTable(week, targets);
  renderRecipes(week, targets, profile.breakfastHour, label.title);
  renderShopping(week, label.title, boughtFoods());

  // Idag följer de verkliga måltidstiderna om de är loggade
  if (state.week === TODAY_WEEK) renderToday({ week, targets, program, breakfast: todaysFasting(profile.breakfastHour).day.start, weight: profile.weight });
  renderFastingToday(profile.breakfastHour);
  renderFasting(targets, profile.breakfastHour);
  renderLog(kgPerWeek(targets.deficit), profile.goal, profile.weight);
  renderSettings(state.week);
  renderPlanCode(profile);
  showGoalAdvice();
  renderReport({
    period: $("rp-period").value, profile, targets,
    labels: {
      activity: $("act").selectedOptions[0]?.textContent || "",
      equipment: { gym: "gym", db: "hantlar", bw: "kroppsvikt" }[profile.equipment],
      days: profile.days.days.map((d) => DAYS_SHORT[d].toLowerCase()).join(", "),
      breakfast: $("bfast").selectedOptions[0]?.textContent || "",
    },
  });
}

// ---------- Rapport ----------

$("rp-period").addEventListener("change", update);
$("rp-print").addEventListener("click", () => window.print());

function showWeek(week) {
  state.week = week;
  update();
}

const preferencesChanged = () => {
  saveExclusions();
  invalidateMenu();
  update();
};

// ---------- Profil ----------

$("f").addEventListener("submit", (e) => e.preventDefault());
$("tdays").addEventListener("change", () => {
  $("tdays-val").value = $$("[data-day]:checked").map((el) => el.dataset.day).join(",");
});
for (const type of ["input", "change"]) {
  $("f").addEventListener(type, () => {
    if (!$("wizard").hidden) return showGoalAdvice(); // guiden sparar allt när den är klar
    saveProfile();
    update();
  });
}
$("clear").addEventListener("click", async () => {
  if (!(await confirmDialog("Är du säker på att du vill rensa dina uppgifter?", "Profilen tas bort och guiden startar igen. Loggen, plankoden och dina egna recept finns kvar."))) return;
  remove(PROFILE_KEY);
  $("f").reset();
  syncDayButtons();
  runWizard(update);
});

/** Guiden fyller i profilen och allergierna; allt sparas först när användaren är klar. */
function runWizard(then) {
  suggestedGoal = null;
  const onStep = (key) => key === "goal" && (suggestGoal(), showGoalAdvice());
  openWizard({ allergens: exclusions.allergens, onStep }, ({ allergens }) => {
    acceptTerms();
    setExclusions({ allergens, foods: [...exclusions.foods], words: [...exclusions.words] });
    saveExclusions();
    invalidateMenu();
    saveProfile();
    then();
  });
}

// ---------- Fastan i dag ----------

const clockNow = () => new Date().toTimeString().slice(0, 5);
/** När ätfönstret stänger: 8 h efter första måltiden, t.ex. "07:30" → "15:30". */
const windowClose = (first) => formatClock(parseClock(first) + WINDOW);
$("fastan").addEventListener("click", (ev) => {
  const field = ev.target.dataset.now;
  if (!field) return;
  $(field).value = clockNow();
  saveMealTimes(field);
});
for (const id of ["fs-first", "fs-last"]) $(id).addEventListener("change", () => saveMealTimes(id));
$("fs-reset").addEventListener("click", () => {
  setMealTimes(todayStr(), { firstMeal: "", lastMeal: "" });
  update();
});
/**
 * Spara dagens måltidstider. När första måltiden fylls i räknas sista måltiden ut som 8 h senare (när ätfönstret
 * stänger), om den är tom eller fortfarande är den uträknade tiden. En tid användaren själv har skrivit behålls.
 */
function saveMealTimes(changed) {
  const invalid = [$("fs-first"), $("fs-last")].find((el) => el.value && !isClockText(el.value));
  if (invalid) return invalid.reportValidity();
  const first = $("fs-first").value;
  if (changed === "fs-first" && first) {
    const before = entryFor(todayStr());
    const wasCalculated = !$("fs-last").value || (before?.firstMeal && before.lastMeal === windowClose(before.firstMeal));
    if (wasCalculated) $("fs-last").value = windowClose(first);
  }
  setMealTimes(todayStr(), { firstMeal: first, lastMeal: $("fs-last").value });
  update();
}
// Läget "du fastar / ätfönstret är öppet" uppdateras varje minut
setInterval(() => renderFastingNow(readProfile().breakfastHour), 60000);

// ---------- Plankod ----------

const EQUIPMENT_NAME = { gym: "gym", db: "hantlar", bw: "kroppsvikt" };
const currentPlanCode = (profile) =>
  encodePlan({ ...planRandomness(), equipment: profile.equipment, days: profile.days.days, breakfast: profile.breakfastChoice, swapPeriod: profile.swapPeriod });

function renderPlanCode(profile) {
  const code = currentPlanCode(profile);
  $("pc-code").textContent = prettyCode(code);
  const rerolled = Object.keys(planRandomness().salts).length;
  const breakfast = $("bmeal").selectedOptions[0]?.textContent.replace("Samma varje dag: ", "samma frukost varje dag, ") || "";
  $("pc-what").textContent =
    `Träning på ${EQUIPMENT_NAME[profile.equipment]} ${profile.days.days.map((d) => DAYS_SHORT[d].toLowerCase()).join(", ")}, nya övningar ${SWAP_TEXT[profile.swapPeriod]} · ${breakfast.toLowerCase()}` +
    (rerolled ? ` · ${rerolled} omslumpad${rerolled > 1 ? "e" : ""} vecka${rerolled > 1 ? "or" : ""}` : "");
}

const RESHUFFLE = {
  both: "Alla veckor får nya rätter och träningspassen nya övningar",
  menu: "Alla veckor får nya rätter; träningen behålls",
  training: "Träningspassen får nya övningar; recepten behålls",
};
const planMessage = (text) => ($("pc-msg").textContent = text);
$("pc-copy").addEventListener("click", async () => {
  const code = currentPlanCode(readProfile());
  try {
    await navigator.clipboard.writeText(code);
    planMessage(`Koden ${code} är kopierad.`);
  } catch {
    getSelection().selectAllChildren($("pc-code"));
    planMessage("Kopieringen nekades. Koden är markerad, så du kan kopiera den själv.");
  }
});
$("pc-new").addEventListener("click", async () => {
  const scope = $("pc-scope").value;
  const what = RESHUFFLE[scope];
  const choice = $("pc-scope").selectedOptions[0].textContent.toLowerCase();
  if (!(await confirmDialog(`Är du säker på att du vill slumpa om ${choice}?`, `${what}.`))) return;
  const { seed, salts, trainingSeed } = planRandomness();
  if (scope === "menu") setPlanRandomness(randomSeed(), {}, trainingSeed);
  else if (scope === "training") setPlanRandomness(seed, salts, randomSeed());
  else setPlanRandomness(randomSeed(), {});
  invalidateMenu();
  update();
  planMessage(`Klart: ${what.charAt(0).toLowerCase() + what.slice(1)}. Plankoden ovan är uppdaterad.`);
});
$("pc-form").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const plan = decodePlan($("pc-input").value);
  if (!plan) return planMessage("Koden gick inte att läsa. Den ser ut ungefär som 7K2Q XM-G150.");
  setPlanRandomness(plan.seed, plan.salts, plan.trainingSeed);
  setRadio("eq", plan.equipment);
  $("tdays-val").value = plan.days.join(",");
  $("bmeal").value = plan.breakfast;
  $("exswap").value = String(plan.swapPeriod);
  syncDayButtons();
  saveProfile();
  invalidateMenu();
  update();
  $("pc-input").value = "";
  planMessage("Planen är bytt. Du får samma rätter och samma träningsprogram som den som delade koden, med portioner efter din profil.");
});

// ---------- Mat: veckor och inköpslista ----------

$("wk-prev").addEventListener("click", () => showWeek(state.week - 1));
$("wk-next").addEventListener("click", () => showWeek(state.week + 1));
$("wk-today").addEventListener("click", () => showWeek(TODAY_WEEK));
$("shop").addEventListener("change", (ev) => {
  const food = ev.target.dataset.shop;
  if (!food) return;
  const bought = boughtFoods();
  if (ev.target.checked) bought.add(food);
  else bought.delete(food);
  save(SHOP_KEY, [...bought]);
  ev.target.closest(".shop-item").classList.toggle("done", ev.target.checked);
  updateShoppingProgress();
});
$("shop-clear").addEventListener("click", async () => {
  if (!(await confirmDialog("Är du säker på att du vill avmarkera allt i inköpslistan?", "Avbockningarna gäller alla veckor, så allt du har markerat som köpt eller hemma avmarkeras."))) return;
  save(SHOP_KEY, []);
  update();
});

// ---------- Inställningar ----------

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

// ---------- Mina recept ----------

/** Egna frukostrecept blir val i Profil → Frukost. */
function syncBreakfastOptions() {
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
$("mr").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const recipe = cleanRecipe({ t: $("mr-name").value, g: $("mr-type").value, items: readRecipeItems(), how: $("mr-how").value });
  if (!recipe) return ($("mr-msg").textContent = "Ge receptet ett namn och minst en ingrediens med gram.");
  addMyRecipe(recipe);
  syncBreakfastOptions();
  $("mr").reset();
  $("mr-items").innerHTML = "";
  $("mr-sum").textContent = "";
  $("mr-msg").textContent = recipe.g === "b" ? `${recipe.t} är sparat. Välj det som frukost under Profil.` : `${recipe.t} är sparat och kan komma med i veckans meny.`;
  invalidateMenu();
  update();
});
$("mr-list").addEventListener("click", async (ev) => {
  const id = ev.target.closest("[data-mrdel]")?.dataset.mrdel;
  if (!id || !(await confirmDialog(`Är du säker på att du vill ta bort receptet ${myRecipes.find((r) => r.id === id)?.t || ""}?`))) return;
  removeMyRecipe(id);
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

// ---------- Logg ----------

const logMessage = (text) => ($("l-msg").textContent = text);

/** Skriv datumet som ÅÅÅÅ-MM-DD medan man knappar in siffror (mobilens sifferknappsats saknar bindestreck). */
function formatDateInput(value) {
  const d = value.replace(/\D/g, "").slice(0, 8);
  return d.slice(0, 4) + (d.length > 4 ? "-" + d.slice(4, 6) : "") + (d.length > 6 ? "-" + d.slice(6, 8) : "");
}

function fillLogForm(date) {
  const e = entryFor(date) || { date };
  $("l-date").value = date;
  $("l-weight").value = e.weight ?? "";
  $("l-waist").value = e.waist ?? "";
  $("l-cardio").innerHTML = e.cardio?.length ? e.cardio.map((c) => cardioRow(c)).join("") : cardioRow({}, lastUnit());
  $("l-im-mod").value = e.imMod ?? "";
  $("l-im-vig").value = e.imVig ?? "";
  showIntensityTotal();
  $("l-note").value = e.note || "";
  for (const el of $$('input[name="l-mood"]')) el.checked = +el.value === e.mood;
  const notTrained = !!entryFor(date) && e.perf == null && e.trained === false;
  for (const el of $$('input[name="l-perf"]')) el.checked = el.value === "none" ? notTrained : +el.value === e.perf;
}

/**
 * Läs konditionsraderna. Tomma rader hoppas över; en halvt ifylld rad ger ett felmeddelande.
 * Ger { list } eller { error }.
 */
function readCardio() {
  const list = [];
  for (const row of $$("#l-cardio .cardio-row")) {
    const a = row.querySelector("[data-c-a]").value;
    const distText = row.querySelector("[data-c-dist]").value.trim(), timeText = row.querySelector("[data-c-time]").value.trim();
    if (!distText && !timeText) continue;
    const unit = row.querySelector("[data-c-unit]").value;
    const dist = num(distText);
    const pass = cleanCardio({ a, km: dist != null && unit === "m" ? dist / 1000 : dist, u: unit, s: parseWorkoutTime(timeText),
      hrMax: num(row.querySelector("[data-c-hrmax]").value) });
    if (!pass) return { error: `Fyll i både distans och tid (min:sek) för ${CARDIO[a].n.toLowerCase()}, t.ex. 1,14 km eller 1122 m och 8:57.` };
    list.push(pass);
  }
  return { list };
}

/** Visa intensitetsminuterna för dagen medan man skriver: måttliga + 2 × höga. */
function showIntensityTotal() {
  const total = intensityMinutes({ imMod: num($("l-im-mod").value), imVig: num($("l-im-vig").value) });
  $("l-im-total").textContent = total != null
    ? `= ${total} intensitetsminuter (måttliga + 2 × höga). WHO rekommenderar minst 150 i veckan.`
    : "Totalen räknas som måttliga + 2 × höga, som på Garmin och liknande klockor. WHO rekommenderar minst 150 minuter i veckan.";
}
for (const id of ["l-im-mod", "l-im-vig"]) $(id).addEventListener("input", showIntensityTotal);

/** Enheten för en ny rad: samma som raden ovanför, annars den som användes senast i loggen. */
const lastUnit = () =>
  [...$$("#l-cardio [data-c-unit]")].pop()?.value ||
  entries.flatMap((e) => e.cardio).pop()?.u || "km";

$("l-cardio-add").addEventListener("click", () => $("l-cardio").insertAdjacentHTML("beforeend", cardioRow({}, lastUnit())));
// Tid: kolonerna sätts medan man skriver siffror (857 → 8:57, 10530 → 1:05:30)
$("l-cardio").addEventListener("input", (ev) => {
  if (!ev.target.matches("[data-c-time]")) return;
  const formatted = formatWorkoutInput(ev.target.value);
  if (formatted !== ev.target.value) ev.target.value = formatted;
  ev.target.setCustomValidity("");
});
// När fältet lämnas skrivs tiden ut som hh:mm:ss: 8:57 betyder 8 min 57 s, alltså 00:08:57
$("l-cardio").addEventListener("change", (ev) => {
  if (!ev.target.matches("[data-c-time]") || !ev.target.value.trim()) return;
  const seconds = parseWorkoutTime(ev.target.value);
  if (seconds != null) ev.target.value = formatHms(seconds);
  ev.target.setCustomValidity(seconds != null ? "" : "Skriv tiden som hh:mm:ss eller mm:ss, t.ex. 00:08:57 eller 8:57");
});
// Byt enhet: rimliga gränser och exempel för km eller meter
$("l-cardio").addEventListener("change", (ev) => {
  if (!ev.target.matches("[data-c-unit]")) return;
  const input = ev.target.closest(".input-unit").querySelector("[data-c-dist]");
  const m = ev.target.value === "m";
  Object.assign(input, { min: m ? "10" : "0.01", max: m ? "500000" : "500", placeholder: m ? "t.ex. 1122" : "t.ex. 1,14" });
  checkDecimal(input);
});
$("l-cardio").addEventListener("click", (ev) => {
  if (!ev.target.matches("[data-c-remove]")) return;
  ev.target.closest(".cardio-row").remove();
  if (!$("l-cardio").children.length) $("l-cardio").insertAdjacentHTML("beforeend", cardioRow({}, lastUnit()));
});

$("l-date").value = todayStr();
$("l-date").addEventListener("input", (ev) => {
  const formatted = formatDateInput(ev.target.value);
  if (formatted !== ev.target.value) ev.target.value = formatted;
  if (isIsoDate(formatted)) fillLogForm(formatted);
});
$("logf").addEventListener("click", (ev) => {
  const offset = ev.target.dataset.dateOffset;
  if (offset != null) fillLogForm(dayToDate(dateToDay(todayStr()) + Number(offset)));
});
$("logf").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const date = $("l-date").value.trim();
  if (!isIsoDate(date)) return logMessage("Skriv datumet som ÅÅÅÅ-MM-DD, t.ex. " + todayStr() + ".");
  const cardio = readCardio();
  if (cardio.error) return logMessage(cardio.error);
  const perf = radioValue("l-perf");
  const existing = entryFor(date);
  const entry = cleanEntry({
    firstMeal: existing?.firstMeal, lastMeal: existing?.lastMeal,
    date, weight: num($("l-weight").value), waist: num($("l-waist").value), mood: radioValue("l-mood") ? +radioValue("l-mood") : null,
    perf: perf && perf !== "none" ? +perf : null, trained: perf ? perf !== "none" : false, cardio: cardio.list, test: existing?.test, imMod: num($("l-im-mod").value), imVig: num($("l-im-vig").value), note: $("l-note").value.trim(),
  });
  if (entry.weight == null && entry.mood == null && entry.perf == null && !entry.cardio.length && intensityMinutes(entry) == null && entry.test == null && entry.waist == null && !entry.note) return logMessage("Fyll i minst ett värde.");
  upsertEntry(entry);
  update();
  logMessage(`Sparat för ${entry.date} (${svDate(entry.date, { weekday: "long" })}).`);
});
$("l-table").addEventListener("click", async (ev) => {
  const edit = ev.target.closest("[data-edit]")?.dataset.edit;
  const del = ev.target.closest("[data-del]")?.dataset.del;
  if (edit) {
    fillLogForm(edit);
    $("logf").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  if (del && (await confirmDialog(`Är du säker på att du vill ta bort loggen för ${del}?`))) {
    removeEntry(del);
    update();
    logMessage("Posten är borttagen.");
  }
});

// ---------- Export och import ----------
// Allt sparat följer med (se backup.js). Importen varnar om den skriver över något och laddar sedan om sidan,
// så att alla delar av appen läser in de nya uppgifterna från början.

const IMPORTED_KEY = "ffv-imported"; // sessionStorage: visa ett kvitto efter omladdningen

const backupMessage = (text) => ($("backup-msg").textContent = text);

async function importBackup(text, say) {
  const backup = readBackup(text);
  if (backup.error) return say(backup.error);
  const what = describe(backup.data);
  const replaced = backup.replaceAll ? "allt som är sparat här" : "motsvarande uppgifter";
  if (hasStoredData() && !(await confirmDialog(
    "Det finns redan sparade uppgifter på den här enheten. Vill du skriva över dem?",
    `Importen ersätter ${replaced} med: ${what}. Det går inte att ångra; exportera först om du vill behålla det som finns.`,
  ))) return say("Importen avbröts. Inget har ändrats.");
  try {
    if (!$("wizard").hidden) acceptTerms(); // importen i guiden kommer efter villkorssteget
    await restore(backup);
  } catch {
    return say("Webbläsaren tillåter inte att uppgifterna sparas (t.ex. privat läge).");
  }
  try {
    sessionStorage.setItem(IMPORTED_KEY, what);
  } catch {
    /* kvittot är inte nödvändigt */
  }
  location.reload();
}

/** Läs en vald fil som text och importera den. */
async function importFile(input, say) {
  const file = input.files?.[0];
  input.value = "";
  if (file) importBackup(await file.text(), say);
}

$("l-export").addEventListener("click", () => {
  const data = exportText();
  const filename = `fettforbranning-${todayStr()}.json`;
  try {
    const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: filename });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    backupMessage(`Allt är exporterat till ${filename}.`);
  } catch {
    backupMessage("Kunde inte spara filen här. Använd Kopiera allt i stället.");
  }
});
$("l-copy").addEventListener("click", async () => {
  const text = exportText();
  try {
    await navigator.clipboard.writeText(text);
    $("l-copytext").hidden = true;
    backupMessage("Allt är kopierat. Klistra in texten under Inställningar → Säkerhetskopia och flytt på den andra enheten.");
  } catch {
    // T.ex. när webbläsaren nekar urklipp: visa texten så att den kan markeras och kopieras för hand
    Object.assign($("l-copytext"), { value: text, hidden: false });
    $("l-copytext").select();
    backupMessage("Kopieringen nekades. Texten visas nedan: markera allt och kopiera.");
  }
});
$("l-import").addEventListener("change", (ev) => importFile(ev.target, backupMessage));
$("l-paste-go").addEventListener("click", () => importBackup($("l-paste").value, backupMessage));

// Radera all data (Inställningar): drar också tillbaka godkännandet av villkoren
$("erase-all").addEventListener("click", async () => {
  const sure = await confirmDialog(
    "Är du säker på att du vill radera all data och dra tillbaka ditt godkännande?",
    "Allt som är sparat i den här webbläsaren raderas: profil, logg, plankod, allergier, egna livsmedel och recept och ditt godkännande av villkoren. Det går inte att ångra. Exportera först under Inställningar → Säkerhetskopia och flytt om du vill behålla något.",
  );
  if (!sure) return;
  try {
    await eraseAll();
  } catch {
    /* ingen lagring att radera */
  }
  window.history.replaceState(null, "", location.pathname); // börja om från början (utan #installningar), med villkoren
  location.reload();
});

// Import som första steg i guiden
const wizardMessage = (text) => ($("wz-msg").textContent = text);
$("wz-import").addEventListener("change", (ev) => importFile(ev.target, wizardMessage));
$("wz-paste-toggle").addEventListener("click", (ev) => {
  $("wz-paste").hidden = !$("wz-paste").hidden;
  ev.currentTarget.setAttribute("aria-expanded", String(!$("wz-paste").hidden));
  if (!$("wz-paste").hidden) $("wz-paste-text").focus();
});
$("wz-paste-go").addEventListener("click", () => importBackup($("wz-paste-text").value, wizardMessage));

// ---------- Flikar ----------
// Varje flik är en vy (#idag, #mat, ...). En länk till en sektion eller ett recept öppnar fliken den ligger i.

const VIEWS = ["idag", "mat", "traning", "logg", "profil", "installningar", "om", "rapport"];
const markCurrent = (el, on) => (on ? el.setAttribute("aria-current", "page") : el.removeAttribute("aria-current"));

function route() {
  const hash = decodeURIComponent(location.hash.slice(1)) || "idag";
  const target = document.getElementById(hash);
  const view = target?.closest("[data-view]")?.dataset.view || (VIEWS.includes(hash) ? hash : "idag");

  if (view === "idag" && state.week !== TODAY_WEEK) showWeek(TODAY_WEEK);
  for (const el of $$("[data-view]")) el.hidden = el.dataset.view !== view;
  for (const el of $$("[data-tab]")) markCurrent(el, el.dataset.tab === (view === "rapport" ? "logg" : view));

  if (view === "mat") {
    state.subview = target?.closest("[data-subview]")?.dataset.subview || state.subview;
    for (const el of $$("[data-subview]")) el.hidden = el.dataset.subview !== state.subview;
    for (const el of $$("[data-sub]")) markCurrent(el, el.dataset.sub === state.subview);
  }

  // Ett recept öppnas och visas; en sektion som är först i sin vy behöver ingen scroll
  if (target?.matches("details")) target.open = true;
  const isViewStart = !target || (target.matches("section") && target === target.parentElement.firstElementChild);
  if (isViewStart) document.querySelector(".views").scrollTop = 0;
  else target.scrollIntoView({ block: "start" });
}

// ---------- Svep mellan flikar ----------
// Svep åt vänster går till nästa flik, åt höger till föregående. Mat räknas som tre steg (veckan, recept, handla).
// Svep som börjar i något som själv scrollar i sidled, i formulärfält eller nära skärmkanten (telefonens bakåtgest)
// ignoreras, liksom svep som mest går uppåt eller nedåt.

const SWIPE_ORDER = ["idag", "vecka", "recept", "inkop", "traning", "logg", "profil"];
const SWIPE_MIN_PX = 60;
const EDGE_PX = 24;
const SWIPE_HINT_KEY = "ffv-swipe-hint";

function currentStep() {
  const view = $$("[data-view]").find((el) => !el.hidden)?.dataset.view;
  if (view === "mat") return SWIPE_ORDER.indexOf(state.subview);
  if (view === "installningar" || view === "om") return SWIPE_ORDER.indexOf("profil");
  if (view === "rapport") return SWIPE_ORDER.indexOf("logg");
  return SWIPE_ORDER.indexOf(view);
}

function swipeTo(direction) {
  const next = currentStep() + direction;
  if (next < 0 || next >= SWIPE_ORDER.length) return;
  location.hash = SWIPE_ORDER[next];
  const shown = $$("[data-view]").find((el) => !el.hidden);
  shown?.classList.remove("slide-from-left", "slide-from-right");
  void shown?.offsetWidth; // starta om animationen
  shown?.classList.add(direction > 0 ? "slide-from-right" : "slide-from-left");
}

function enableSwipeNavigation() {
  const area = document.querySelector(".views");
  let start = null;
  area.addEventListener("touchstart", (ev) => {
    const t = ev.changedTouches[0];
    const ignore = ev.touches.length > 1 || t.clientX < EDGE_PX || t.clientX > window.innerWidth - EDGE_PX ||
      ev.target.closest(".scroll-x, .timeline, .chart, input, select, textarea, .seg, .daypick, .chips");
    start = ignore ? null : { x: t.clientX, y: t.clientY, time: Date.now() };
  }, { passive: true });
  area.addEventListener("touchend", (ev) => {
    if (!start) return;
    const t = ev.changedTouches[0];
    const dx = t.clientX - start.x, dy = t.clientY - start.y;
    const quick = Date.now() - start.time < 700;
    start = null;
    if (quick && Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * 1.5) swipeTo(dx < 0 ? 1 : -1);
  }, { passive: true });

  // Visa en kort hjälptext första gången på en pekskärm
  if ("ontouchstart" in window && !load(SWIPE_HINT_KEY, false)) {
    toast("Svep åt vänster eller höger för att byta flik");
    save(SWIPE_HINT_KEY, true);
  }
}

// ---------- Start ----------

loadPreferences();
loadMyRecipes();
syncBreakfastOptions();
loadLog();
$("l-cardio").innerHTML = cardioRow({}, lastUnit());
syncDayButtons();

/**
 * Starta appen. En ny användare (från guiden) får ett eget slumpfrö. Den som hade en profil eller omslumpade veckor
 * innan fröet fanns behåller frö 0, så att menyerna inte ändras.
 */
function start(newUser = false) {
  // Be om beständig lagring, så att webbläsaren inte rensar profilen och loggen när utrymmet blir trångt
  navigator.storage?.persist?.().catch(() => {});
  initSeed(newUser && !Object.keys(load("ffv-salt", {}) || {}).length, randomSeed);
  migrateShopping();
  syncDayButtons();
  update();
  window.addEventListener("hashchange", route);
  route();
  enableSwipeNavigation();
  try {
    const imported = sessionStorage.getItem(IMPORTED_KEY);
    sessionStorage.removeItem(IMPORTED_KEY);
    if (imported) toast(`Importen är klar: ${imported}.`, 5000);
  } catch {
    /* ingen sessionStorage */
  }
}

const savedProfile = load(PROFILE_KEY, null);
if (savedProfile) {
  applyProfile(savedProfile);
  showSaved("Dina sparade uppgifter är inlästa");
  if (termsAccepted()) {
    unlockStorage();
    start();
  }
  // Har en profil men har inte godkänt (nuvarande) villkor: visa bara villkoren först
  else openWizard({ termsOnly: true }, () => {
    acceptTerms();
    start();
  });
} else {
  runWizard(() => start(true)); // första gången: inget sparas och inget frö skapas förrän guiden är klar
}
