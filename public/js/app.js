// Appens styrning: läser profilen, räknar om och ritar alla vyer, kopplar knappar och formulär och sköter flikarna.

import { $, $$, num, radioValue, setRadio, load, save, remove, todayStr, dayToDate, dateToDay, svDate, weekIndexOf, confirmClick, DAYS_SHORT } from "./util.js";
import { computeTargets, kgPerWeek } from "./nutrition.js";
import {
  loadPreferences, exclusions, saveExclusions, setExclusions, migrateExclusions, exclusionsAsJson, myFoods, addMyFood, removeMyFood, mergeMyFoods, cleanMyFood,
} from "./preferences.js";
import { buildWeek, invalidateMenu, isRerolled, rerollWeek, resetWeek, initSeed, planRandomness, setPlanRandomness } from "./menu.js";
import { encodePlan, decodePlan, prettyCode, randomSeed } from "./plancode.js";
import { SEASONS } from "./data/recipes.js";
import { parseTrainingDays, buildProgram } from "./training.js";
import { loadLog, entries, entryFor, upsertEntry, removeEntry, importEntries, cleanEntry, isIsoDate, parseTestTime, formatTestTime, connectCloud, setMealTimes } from "./log.js";
import { renderTargets } from "./views/profile.js";
import { renderToday, renderFasting } from "./views/today.js";
import { renderFastingToday, renderFastingNow, todaysFasting } from "./views/fasting-view.js";
import { weekLabel, renderWeekGrid, renderCheatTable, renderRecipes, renderShopping, updateShoppingProgress } from "./views/food.js";
import { renderProgram } from "./views/training-view.js";
import { renderLog } from "./views/log-view.js";
import { renderSettings, renderIngredientPicker, recipeItemRow, readRecipeItems, updateRecipeSum } from "./views/settings.js";
import { loadMyRecipes, myRecipes, addMyRecipe, removeMyRecipe, mergeMyRecipes, cleanRecipe } from "./myrecipes.js";
import { setUsing } from "./supplements.js";

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
    age: +$("age").value || 40,
    weight: +$("weight").value || 80,
    height: +$("height").value || 175,
    bodyFat: parseFloat($("bf").value),
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

function saveProfile() {
  const ok = save(PROFILE_KEY, profileAsJson());
  $("saved").hidden = false;
  $("saved-hint").hidden = true;
  $("exnote").hidden = true;
  $("saved-text").textContent = ok
    ? `Sparat i den här webbläsaren ${new Date().toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}`
    : "Webbläsaren tillåter inte att uppgifterna sparas (t.ex. privat läge).";
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

// ---------- Rita om allt ----------

const shoppingKey = () => "ffv-shop-" + state.week;

function update() {
  const profile = readProfile();
  showTrainingDaysMessage(profile.days);
  const targets = computeTargets(profile);
  const program = buildProgram(profile.equipment, profile.days.days, { seed: planRandomness().seed || 0, week: state.week, period: profile.swapPeriod });
  const week = buildWeek(state.week, targets, profile.breakfastChoice);
  const label = weekLabel(state.week);

  renderTargets(targets, profile.goal);
  renderProgram(program);
  const swapText = { 1: "varje vecka", 2: "varannan vecka", 4: "var fjärde vecka" }[profile.swapPeriod];
  $("prog-week").textContent = `Övningarna för ${label.title.toLowerCase()}${state.week === TODAY_WEEK ? " (denna vecka)" : ""}. De byts ${swapText}; passindelningen är alltid densamma. Byt vecka under Mat → Veckan.`;

  $("wk-title").textContent = `${label.title} · ${SEASONS[week.season].n}`;
  $("wk-range").textContent = label.range + (state.week === TODAY_WEEK ? " · denna vecka" : state.week === TODAY_WEEK + 1 ? " · nästa vecka" : "");
  $("wk-today").hidden = state.week === TODAY_WEEK;
  $("wk-reset").hidden = !isRerolled(state.week);
  renderWeekGrid(week, program.schedule, profile.breakfastHour);
  renderCheatTable(week, targets);
  renderRecipes(week, targets, profile.breakfastHour, label.title);
  renderShopping(week, label.title, new Set(load(shoppingKey(), [])));

  // Idag följer de verkliga måltidstiderna om de är loggade
  if (state.week === TODAY_WEEK) renderToday({ week, targets, program, breakfast: todaysFasting(profile.breakfastHour).day.start, weight: profile.weight });
  renderFastingToday(profile.breakfastHour);
  renderFasting(targets, profile.breakfastHour);
  renderLog(kgPerWeek(targets.deficit), profile.goal, profile.weight);
  renderSettings(state.week);
  renderPlanCode(profile);
  $("td-profile").hidden = $("exnote").hidden;
}

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
    saveProfile();
    update();
  });
}
$("clear").addEventListener("click", () => {
  remove(PROFILE_KEY);
  $("f").reset();
  syncDayButtons();
  $("saved").hidden = true;
  $("saved-hint").hidden = false;
  $("exnote").hidden = false;
  update();
});

// ---------- Fastan i dag ----------

const clockNow = () => new Date().toTimeString().slice(0, 5);
$("fastan").addEventListener("click", (ev) => {
  const field = ev.target.dataset.now;
  if (!field) return;
  $(field).value = clockNow();
  saveMealTimes();
});
for (const id of ["fs-first", "fs-last"]) $(id).addEventListener("change", saveMealTimes);
$("fs-reset").addEventListener("click", () => {
  setMealTimes(todayStr(), { firstMeal: "", lastMeal: "" });
  update();
});
function saveMealTimes() {
  setMealTimes(todayStr(), { firstMeal: $("fs-first").value, lastMeal: $("fs-last").value });
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
    `Träning på ${EQUIPMENT_NAME[profile.equipment]} ${profile.days.days.map((d) => DAYS_SHORT[d].toLowerCase()).join(", ")}, nya övningar ${{ 1: "varje vecka", 2: "varannan vecka", 4: "var fjärde vecka" }[profile.swapPeriod]} · ${breakfast.toLowerCase()}` +
    (rerolled ? ` · ${rerolled} omslumpad${rerolled > 1 ? "e" : ""} vecka${rerolled > 1 ? "or" : ""}` : "");
}

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
$("pc-new").addEventListener("click", (ev) => {
  if (!confirmClick(ev.currentTarget)) return planMessage("Alla veckor får nya rätter. Tryck på Bekräfta för att fortsätta.");
  setPlanRandomness(randomSeed(), {});
  invalidateMenu();
  update();
  planMessage("Du har fått en ny plankod med nya rätter för alla veckor.");
});
$("pc-form").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const plan = decodePlan($("pc-input").value);
  if (!plan) return planMessage("Koden gick inte att läsa. Den ser ut ungefär som 7K2Q XM-G150.");
  setPlanRandomness(plan.seed, plan.salts);
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
$("wk-reroll").addEventListener("click", () => {
  rerollWeek(state.week);
  update();
});
$("wk-reset").addEventListener("click", () => {
  resetWeek(state.week);
  update();
});
$("shop").addEventListener("change", (ev) => {
  const food = ev.target.dataset.shop;
  if (!food) return;
  const checked = new Set(load(shoppingKey(), []));
  if (ev.target.checked) checked.add(food);
  else checked.delete(food);
  save(shoppingKey(), [...checked]);
  ev.target.closest(".shop-item").classList.toggle("done", ev.target.checked);
  updateShoppingProgress();
});
$("shop-clear").addEventListener("click", () => {
  save(shoppingKey(), []);
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
$("mf-list").addEventListener("click", (ev) => {
  const button = ev.target.closest("[data-mfdel]");
  if (!button || !confirmClick(button)) return;
  removeMyFood(button.dataset.mfdel);
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
$("mr-list").addEventListener("click", (ev) => {
  const button = ev.target.closest("[data-mrdel]");
  if (!button || !confirmClick(button)) return;
  removeMyRecipe(button.dataset.mrdel);
  syncBreakfastOptions();
  saveProfile();
  invalidateMenu();
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
  $("l-test").value = e.test != null ? formatTestTime(e.test) : "";
  $("l-note").value = e.note || "";
  for (const el of $$('input[name="l-mood"]')) el.checked = +el.value === e.mood;
  const notTrained = !!entryFor(date) && e.perf == null && e.trained === false;
  for (const el of $$('input[name="l-perf"]')) el.checked = el.value === "none" ? notTrained : +el.value === e.perf;
}

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
  const testText = $("l-test").value.trim();
  const test = parseTestTime(testText);
  if (testText && test == null) return logMessage("Skriv testtiden som minuter:sekunder, t.ex. 18:45.");
  const perf = radioValue("l-perf");
  const existing = entryFor(date);
  const entry = cleanEntry({
    firstMeal: existing?.firstMeal, lastMeal: existing?.lastMeal,
    date, weight: num($("l-weight").value), waist: num($("l-waist").value), mood: radioValue("l-mood") ? +radioValue("l-mood") : null,
    perf: perf && perf !== "none" ? +perf : null, trained: perf ? perf !== "none" : false, test, note: $("l-note").value.trim(),
  });
  if (entry.weight == null && entry.mood == null && entry.perf == null && entry.test == null && entry.waist == null && !entry.note) return logMessage("Fyll i minst ett värde.");
  upsertEntry(entry);
  update();
  logMessage(`Sparat för ${entry.date} (${svDate(entry.date, { weekday: "long" })}).`);
});
$("l-table").addEventListener("click", (ev) => {
  const edit = ev.target.closest("[data-edit]");
  const del = ev.target.closest("[data-del]");
  if (edit) {
    fillLogForm(edit.dataset.edit);
    $("logf").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  if (del && confirmClick(del)) {
    removeEntry(del.dataset.del);
    update();
    logMessage("Posten är borttagen.");
  }
});

// ---------- Export och import ----------

const exportJson = () =>
  JSON.stringify({ app: "fettforbranningsveckan", version: 1, exported: new Date().toISOString(), goal: num($("goal").value),
    settings: load(PROFILE_KEY, null) || profileAsJson(), plan: planRandomness(), exclusions: exclusionsAsJson(), myFoods, myRecipes, entries }, null, 2);

$("l-export").addEventListener("click", async () => {
  const data = exportJson();
  const filename = `fettforbranning-logg-${todayStr()}.json`;
  // I claude.ai sparas filer via downloads-capability; i en vanlig webbläsare via en nedladdningslänk.
  const downloads = typeof window.claude?.use === "function" ? await window.claude.use("downloads").catch(() => null) : null;
  try {
    if (downloads) {
      await downloads.save({ filename, data });
    } else {
      const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
      const link = Object.assign(document.createElement("a"), { href: url, download: filename });
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
    logMessage(`Exporterade ${entries.length} dagar till ${filename}.`);
  } catch (e) {
    logMessage(e?.code === "declined" ? "Exporten avbröts." : "Kunde inte spara filen här. Använd Kopiera JSON i stället.");
  }
});
$("l-copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(exportJson());
    logMessage("JSON är kopierad. Klistra in i en textfil och spara som .json.");
  } catch {
    logMessage("Kopieringen nekades av webbläsaren.");
  }
});
$("l-import").addEventListener("change", async (ev) => {
  const file = ev.target.files?.[0];
  ev.target.value = "";
  if (!file) return;
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    return logMessage("Filen är inte giltig JSON.");
  }
  const list = Array.isArray(data) ? data : data.entries || [];
  if (!list.length && !data.settings && !data.exclusions && !data.myFoods) return logMessage("Hittade inga loggposter i filen.");
  const count = importEntries(list);
  if (data.settings && typeof data.settings === "object") {
    applyProfile(data.settings);
    saveProfile();
  }
  if (typeof data.goal === "number") $("goal").value = data.goal;
  if (data.exclusions && typeof data.exclusions === "object") {
    setExclusions(migrateExclusions(data.exclusions));
    saveExclusions();
  }
  if (Array.isArray(data.myFoods)) mergeMyFoods(data.myFoods);
  if (Array.isArray(data.myRecipes)) {
    mergeMyRecipes(data.myRecipes);
    syncBreakfastOptions();
    if (data.settings?.bmeal) $("bmeal").value = data.settings.bmeal;
  }
  if (data.plan && Number.isInteger(data.plan.seed)) setPlanRandomness(data.plan.seed, data.plan.salts || {});
  invalidateMenu();
  update();
  logMessage(`Importerade ${count} dagar${data.settings ? " och dina inställningar" : ""}.`);
});

// ---------- Flikar ----------
// Varje flik är en vy (#idag, #mat, ...). En länk till en sektion eller ett recept öppnar fliken den ligger i.

const VIEWS = ["idag", "mat", "traning", "logg", "profil", "installningar"];
const markCurrent = (el, on) => (on ? el.setAttribute("aria-current", "page") : el.removeAttribute("aria-current"));

function route() {
  const hash = decodeURIComponent(location.hash.slice(1)) || "idag";
  const target = document.getElementById(hash);
  const view = target?.closest("[data-view]")?.dataset.view || (VIEWS.includes(hash) ? hash : "idag");

  if (view === "idag" && state.week !== TODAY_WEEK) showWeek(TODAY_WEEK);
  for (const el of $$("[data-view]")) el.hidden = el.dataset.view !== view;
  for (const el of $$("[data-tab]")) markCurrent(el, el.dataset.tab === view);

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
  if (view === "installningar") return SWIPE_ORDER.indexOf("profil");
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
    const hint = document.createElement("div");
    hint.className = "swipe-hint";
    hint.textContent = "Svep åt vänster eller höger för att byta flik";
    document.body.append(hint);
    save(SWIPE_HINT_KEY, true);
    setTimeout(() => hint.remove(), 4000);
  }
}

// ---------- Start ----------

loadPreferences();
loadMyRecipes();
syncBreakfastOptions();
loadLog();
const savedProfile = load(PROFILE_KEY, null);
initSeed(!savedProfile && !Object.keys(load("ffv-salt", {}) || {}).length, randomSeed);
if (savedProfile) {
  applyProfile(savedProfile);
  $("exnote").hidden = true;
  $("saved").hidden = false;
  $("saved-hint").hidden = true;
  $("saved-text").textContent = "Dina sparade uppgifter är inlästa";
}
syncDayButtons();
update();
window.addEventListener("hashchange", route);
route();
enableSwipeNavigation();
connectCloud({ changed: update, status: (text) => ($("l-where").textContent = text) });

// ---------- PWA: offline och installation ----------
// Service workern registreras bara när sidan körs som egen webbplats (inte inbäddad i claude.ai och inte från disk).

if ("serviceWorker" in navigator && window.self === window.top && location.protocol !== "file:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
// Förslaget att installera visas en gång per besök tills användaren installerar eller väljer "Inte nu" (sparas i ffv-install-declined).
// Chrome och Edge ger ett beforeinstallprompt-event; Safari på iPhone/iPad saknar det, där visas istället hur man lägger till appen.
const INSTALL_DECLINED_KEY = "ffv-install-declined";
const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const canSuggestInstall = () => window.self === window.top && !isStandalone() && !load(INSTALL_DECLINED_KEY, false);
let installPrompt = null;

function hideInstall() {
  $("install").hidden = true;
  $("install-banner").hidden = true;
}

async function install() {
  if (!installPrompt) return;
  const prompt = installPrompt;
  installPrompt = null;
  hideInstall();
  prompt.prompt();
  const choice = await prompt.userChoice.catch(() => null);
  if (choice?.outcome === "dismissed") save(INSTALL_DECLINED_KEY, true);
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e;
  $("install").hidden = false;
  if (canSuggestInstall()) $("install-banner").hidden = false;
});
if (isIos && canSuggestInstall()) {
  $("install-text").textContent = "Tryck på dela-knappen och välj Lägg till på hemskärmen, så öppnas Fettförbränning som en egen app och fungerar offline.";
  $("install-accept").hidden = true;
  $("install-banner").hidden = false;
}
$("install").addEventListener("click", install);
$("install-accept").addEventListener("click", install);
$("install-decline").addEventListener("click", () => {
  save(INSTALL_DECLINED_KEY, true);
  $("install-banner").hidden = true;
});
window.addEventListener("appinstalled", () => {
  installPrompt = null;
  hideInstall();
});
