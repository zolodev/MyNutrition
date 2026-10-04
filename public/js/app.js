// Appens styrning: läser profilen, räknar om och ritar alla vyer, kopplar knappar och formulär och sköter flikarna.

import { $, $$, num, signed, radioValue, setRadio, load, save, remove, todayStr, weekIndexOf, confirmDialog, checkDecimal, isClockText, DAYS_SHORT } from "./util.js";
import { computeTargets, kgPerWeek, recommendedGoal } from "./nutrition.js";
import { loadPreferences, exclusions, saveExclusions, setExclusions } from "./preferences.js";
import { buildWeek, invalidateMenu, initSeed, planRandomness, setPlanRandomness } from "./menu.js";
import { encodePlan, decodePlan, prettyCode, randomSeed } from "./plancode.js";
import { SEASONS } from "./data/recipes.js";
import { parseTrainingDays, buildProgram, SWAP_TEXT } from "./training.js";
import { loadLog, entries, entryFor, upsertEntry, cleanEntry, setMealTimes } from "./log.js";
import { renderTargets, renderGoalAdvice } from "./views/profile.js";
import { renderToday, renderFasting } from "./views/today.js";
import { renderFastingToday, renderFastingNow, todaysFasting } from "./views/fasting-view.js";
import { formatClock, parseClock } from "./fasting.js";
import { WINDOW } from "./day.js";
import { weekLabel, renderWeekGrid, renderCheatTable, renderRecipes, renderShopping, updateShoppingProgress } from "./views/food.js";
import { renderProgram } from "./views/training-view.js";
import { renderLog } from "./views/log-view.js";
import { renderReport } from "./views/report.js";
import { renderSettings } from "./views/settings.js";
import { loadMyRecipes } from "./myrecipes.js";
import { openWizard } from "./wizard.js";
import { unlockStorage, keys as storageKeys } from "./storage.js";
import { initNavigation } from "./controllers/navigation.js";
import { initSettingsForms, syncBreakfastOptions } from "./controllers/settings-forms.js";
import { initLogForm } from "./controllers/log-form.js";
import { initBackupForms, showImportReceipt } from "./controllers/backup-form.js";
import "./controllers/inputs.js";
import { APP_VERSION } from "./version.js";
import "./pwa.js";

// ---------- Tillstånd ----------

const TODAY_WEEK = weekIndexOf(new Date());
const state = {
  week: TODAY_WEEK, // veckan som visas under Mat → Veckan och Recept
  shopWeek: null, // veckan som inköpslistan visar; sätts vid start (se defaultShopWeek)
  trainingDays: [0, 2, 4], // senaste giltiga val av gymdagar
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

// ---------- Rita om allt ----------

// Inköpslistan: det man har bockat av ("har hemma") gäller i alla veckor tills man själv bockar ur det.
const SHOP_KEY = "ffv-shop";
const boughtFoods = () => new Set(load(SHOP_KEY, []));
// Inställning: inköpslistan öppnas alltid på nästa vecka (för den som handlar helgen före)
const SHOP_NEXT_KEY = "ffv-shop-next";
const defaultShopWeek = () => TODAY_WEEK + (load(SHOP_NEXT_KEY, false) ? 1 : 0);
/** " · denna vecka" eller " · nästa vecka" efter datumen, annars inget. */
const relativeWeek = (week) => (week === TODAY_WEEK ? " · denna vecka" : week === TODAY_WEEK + 1 ? " · nästa vecka" : "");

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
  $("wk-range").textContent = label.range + relativeWeek(state.week);
  $("wk-today").hidden = state.week === TODAY_WEEK;
  renderWeekGrid(week, program.schedule, profile.breakfastHour);
  renderCheatTable(week, targets);
  renderRecipes(week, targets, profile.breakfastHour, label.title);
  renderShoppingWeek(profile, targets, week);

  // Idag följer de verkliga måltidstiderna om de är loggade
  if (state.week === TODAY_WEEK) renderToday({ week, targets, program, breakfast: todaysFasting(profile.breakfastHour).day.start, weight: profile.weight });
  renderFastingToday(profile.breakfastHour);
  renderFasting(targets, profile.breakfastHour);
  renderLog(kgPerWeek(targets.deficit), profile.goal, profile.weight);
  renderSettings(state.week);
  renderPlanCode(profile);
  renderQuickWeight();
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

// ---------- Dagens vikt (överst på Idag) ----------

/** Visa dagens vikt om den är loggad, med förändringen mot förra vägningen. */
function renderQuickWeight() {
  const today = entryFor(todayStr());
  const previous = entries.filter((e) => e.weight != null && e.date < todayStr()).pop();
  if (document.activeElement !== $("qw-weight")) $("qw-weight").value = today?.weight != null ? String(today.weight).replace(".", ",") : "";
  $("qw-msg").textContent = today?.weight != null
    ? `Loggad i dag: ${String(today.weight).replace(".", ",")} kg${previous ? ` (${signed(today.weight - previous.weight)} kg mot ${previous.date})` : ""}. Ändra och spara om du vill.`
    : "Väg dig helst samma tid varje dag, till exempel på morgonen före frukost.";
}

$("qw-form").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const weight = num($("qw-weight").value);
  if (weight == null || !checkDecimal($("qw-weight"))) return $("qw-weight").reportValidity();
  // Bara vikten ändras; det som redan är loggat i dag (måltider, pass, mående …) ligger kvar
  upsertEntry(cleanEntry({ ...(entryFor(todayStr()) || {}), date: todayStr(), weight }));
  $("qw-weight").blur();
  update();
});

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
/** Använd en plankod: samma frön (rätter och övningar), utrustning, gymdagar, frukost och bytesintervall. */
function applyPlan(plan) {
  setPlanRandomness(plan.seed, plan.salts, plan.trainingSeed);
  setRadio("eq", plan.equipment);
  $("tdays-val").value = plan.days.join(",");
  $("bmeal").value = plan.breakfast;
  $("exswap").value = String(plan.swapPeriod);
  syncDayButtons();
  invalidateMenu();
}

// Plankod i guidens andra steg: fyller i planen; profilen fylls i i nästa steg och allt sparas när guiden är klar
$("wz-code-go").addEventListener("click", () => {
  const plan = decodePlan($("wz-code").value);
  if (!plan) return ($("wz-code-msg").textContent = "Koden gick inte att läsa. Den ser ut ungefär som 7K2Q XM-G150.");
  applyPlan(plan);
  $("wizard").dataset.planCode = "1";
  $("wz-next").textContent = "Nästa";
  $("wz-code-msg").textContent = `Koden är inläst: träning på ${EQUIPMENT_NAME[plan.equipment]} ${plan.days.map((d) => DAYS_SHORT[d].toLowerCase()).join(", ")}. Fyll i dina uppgifter i nästa steg.`;
});

$("pc-form").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const plan = decodePlan($("pc-input").value);
  if (!plan) return planMessage("Koden gick inte att läsa. Den ser ut ungefär som 7K2Q XM-G150.");
  applyPlan(plan);
  saveProfile();
  invalidateMenu();
  update();
  $("pc-input").value = "";
  planMessage("Planen är bytt. Du får samma rätter och samma träningsprogram som den som delade koden, med portioner efter din profil.");
});

// ---------- Mat: veckor och inköpslista ----------

/** Inköpslistan har en egen vecka, så att den kan visa nästa vecka medan Veckan visar den här. */
function renderShoppingWeek(profile, targets, shownWeek) {
  state.shopWeek ??= defaultShopWeek();
  const week = state.shopWeek === state.week ? shownWeek : buildWeek(state.shopWeek, targets, profile.breakfastChoice);
  const label = weekLabel(state.shopWeek);
  const preferred = defaultShopWeek();
  $("shop-wk-title").textContent = label.title;
  $("shop-wk-range").textContent = label.range + relativeWeek(state.shopWeek);
  $("shop-wk-default").hidden = state.shopWeek === preferred;
  $("shop-wk-default").textContent = preferred === TODAY_WEEK ? "Till denna vecka" : "Till nästa vecka";
  renderShopping(week, label.title, boughtFoods());
}
const showShopWeek = (week) => {
  state.shopWeek = week;
  update();
};
$("shop-prev").addEventListener("click", () => showShopWeek(state.shopWeek - 1));
$("shop-next").addEventListener("click", () => showShopWeek(state.shopWeek + 1));
$("shop-wk-default").addEventListener("click", () => showShopWeek(defaultShopWeek()));
// Inställningar → Inköpslista
$("shop-next-week").addEventListener("change", (ev) => {
  save(SHOP_NEXT_KEY, ev.target.checked);
  showShopWeek(defaultShopWeek());
});

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

// ---------- Start ----------

for (const el of $$("[data-app-version]")) el.textContent = `Version ${APP_VERSION}`;
loadPreferences();
loadMyRecipes();
loadLog();
initSettingsForms({ update, saveProfile });
initLogForm({ update });
initBackupForms({ acceptTerms });
syncBreakfastOptions();
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
  state.shopWeek = defaultShopWeek();
  $("shop-next-week").checked = load(SHOP_NEXT_KEY, false);
  update();
  initNavigation({ onToday: () => state.week !== TODAY_WEEK && showWeek(TODAY_WEEK) });
  showImportReceipt();
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
