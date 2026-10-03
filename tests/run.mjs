// Tester för Fettförbränningsveckan. Kör med:  npm install && npm test   (eller: bun install && bun tests/run.mjs)
// Del 1 testar beräkningarna direkt, del 2 kör hela appen i en simulerad webbläsare och klickar runt.

import { JSDOM } from "jsdom";
import fs from "fs";
const TERMS_VERSION = Number(fs.readFileSync(new URL("../public/js/app.js", import.meta.url), "utf8").match(/const TERMS_VERSION = (\d+)/)[1]);
const todayStr = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };

// ---------- Del 1: beräkningar ----------
const memory = {};
globalThis.localStorage = { getItem: (k) => memory[k] ?? null, setItem: (k, v) => (memory[k] = String(v)), removeItem: (k) => delete memory[k] };
const { computeTargets } = await import("../public/js/nutrition.js");
const prefs = await import("../public/js/preferences.js");
const menu = await import("../public/js/menu.js");
const { buildProgram, parseTrainingDays } = await import("../public/js/training.js");
const { weekIndexOf } = await import("../public/js/util.js");
const unit = (label, cond) => { console.log((cond ? "OK   " : "FEL  ") + label); if (!cond) process.exitCode = 1; };
console.log("# Beräkningar");

const man = computeTargets({ sex: "m", age: 40, weight: 95, height: 180, bodyFat: NaN, activity: 1.375, rate: 1 });
unit("Kalorimål för exempelmannen är 1 750 kcal", man.target === 1750);
unit("Underskottet begränsas till 1 000 kcal", Math.round(man.deficit) === 1000);
const small = computeTargets({ sex: "k", age: 30, weight: 55, height: 160, bodyFat: NaN, activity: 1.2, rate: 1 });
unit("Kalorimålet går aldrig under 1 200 kcal för kvinnor", small.target >= 1200);

prefs.loadPreferences();
const today = weekIndexOf(new Date());
let repeats = 0;
for (let w = today; w < today + 52; w++) {
  const a = menu.weekPlan(w, "F0").map((d) => d[1]), b = menu.weekPlan(w + 1, "F0").map((d) => d[1]);
  if (a.some((id) => b.includes(id))) repeats++;
}
unit("Två veckor i följd delar aldrig eftermiddagsrätt (ett år)", repeats === 0);

let tomatoOffSeason = 0;
for (let w = today; w < today + 52; w++) {
  const week = menu.buildWeek(w, man, "F0");
  if (week.season !== "sommar" && ["tomat", "gurka", "paprika"].some((f) => week.shopping[f])) tomatoOffSeason++;
}
unit("Tomat, gurka och paprika bara på sommaren", tomatoOffSeason === 0);

prefs.setExclusions({ allergens: ["fisk", "skaldjur"], foods: [] });
menu.invalidateMenu();
const noFish = menu.buildWeek(today, man, "F0");
unit("Fiskallergi: ingen fisk eller skaldjur i inköpslistan", !["sej", "torsk", "lax", "rakor"].some((f) => noFish.shopping[f]));
prefs.setExclusions({ allergens: ["apelsin", "mandarin", "clementin"], foods: ["x_rodbetor", "x_tonfisk"] });
menu.invalidateMenu();

const week = menu.buildWeek(today, man, "F0");
const kcal = week.plan.flat().reduce((s, id) => s + week.recipes[id].m.k, 0) / 7;
unit("Veckans recept landar inom 5 % av kalorimålet", Math.abs(kcal - man.target) / man.target < 0.05);

const tueThuSat = buildProgram("gym", parseTrainingDays("1,3,5", [0, 2, 4]).days);
unit("Gymdagar tis/tor/lör ger helkropp, överkropp och ben", tueThuSat.schedule[1].label === "Helkropp" && tueThuSat.schedule[3].label === "Överkropp" && tueThuSat.schedule[5].label === "Ben");
const inARow = buildProgram("gym", [0, 1, 2]);
unit("Tre dagar i rad varnar för samma muskler två dagar i rad", inARow.clash);
unit("Fel antal gymdagar behåller senaste giltiga val", parseTrainingDays("1,3", [0, 2, 4]).days.join() === "0,2,4");

// BMI och föreslagen målvikt (ExRx/WHO: normalvikt 18,5–24,9)
const nutrition = await import("../public/js/nutrition.js");
unit("BMI räknas som vikt / längd²", Math.abs(nutrition.bmiOf(95, 180) - 29.32) < 0.01);
unit("Över BMI 25: målvikt vid BMI 24,9, avrundad nedåt till halvt kilo", nutrition.recommendedGoal(95, 180) === 80.5 && nutrition.bmiOf(80.5, 180) <= 24.9 && nutrition.recommendedGoal(110, 165) === 67.5);
unit("BMI 25 eller lägre: ingen föreslagen målvikt", nutrition.recommendedGoal(70, 180) === null && nutrition.recommendedGoal(81, 180) === null);
const forecastTargets = computeTargets({ sex: "m", age: 40, weight: 95, height: 180, bodyFat: NaN, activity: 1.375, rate: 1 });
const forecast = nutrition.goalForecast(forecastTargets, 85);
unit("Prognosen räknar veckor med appens underskott", Math.abs(forecast.weeks - 10 / nutrition.kgPerWeek(forecastTargets.deficit)) < 1e-9 && nutrition.goalForecast(forecastTargets, 96) === null);

// Plankod
const { encodePlan, decodePlan } = await import("../public/js/plancode.js");
const sample = { seed: 123456789, salts: { 143: 98765 }, equipment: "db", days: [1, 3, 5], breakfast: "F2" };
const decoded = decodePlan(encodePlan(sample));
unit("Plankoden går att läsa tillbaka", JSON.stringify(decoded) === JSON.stringify({ ...sample, salts: { 143: 98765 }, swapPeriod: 1, trainingSeed: sample.seed }));
unit("Plankoden bär med ett eget träningsfrö", (() => { const c = encodePlan({ ...sample, trainingSeed: 4242 }); return c.includes("+") && decodePlan(c).trainingSeed === 4242 && decodePlan(c).seed === sample.seed && JSON.stringify(decodePlan(c).salts) === '{"143":98765}'; })());
unit("Kod utan träningsfrö ger träningen samma frö som recepten", decodePlan("00ABCD-H1A0").trainingSeed === decodePlan("00ABCD-H1A0").seed);
unit("Plankoden bär med hur ofta övningarna byts", decodePlan(encodePlan({ ...sample, swapPeriod: 4 })).swapPeriod === 4);
unit("Äldre plankod utan bytesintervall läses som varje vecka", decodePlan("00ABCD-H1A0").swapPeriod === 1);

// Träningen varierar men passindelningen ligger fast
const names = (p) => p.sessions.map((s) => s.items.filter((i) => !i.circuit).map((i) => i.name).join("|")).join("||");
const wk = (week, extra = {}) => buildProgram("gym", [0, 2, 4], { seed: 98765, week, period: 1, ...extra });
unit("Passindelningen är densamma varje vecka", [140, 141, 142, 143].every((w) => wk(w).sessions.map((s) => s.name).join() === "Helkropp,Överkropp,Ben"));
unit("Övningarna byts från vecka till vecka", names(wk(140)) !== names(wk(141)) && names(wk(141)) !== names(wk(142)));
unit("Helkropp och ben får olika knäböjsvarianter samma vecka", wk(141).sessions[0].items[0].name !== wk(141).sessions[2].items[0].name);
unit("Varannan vecka: två veckor i rad är lika", names(wk(140, { period: 2 })) === names(wk(141, { period: 2 })) && names(wk(141, { period: 2 })) !== names(wk(142, { period: 2 })));
unit("Samma frö och vecka ger samma övningar, annat frö andra", names(wk(141)) === names(wk(141)) && names(wk(141)) !== names(buildProgram("gym", [0, 2, 4], { seed: 1, week: 141 })));
unit("Fyra pass: underkropp A och B får olika övningar", (() => { const p = buildProgram("gym", [0, 1, 3, 4], { seed: 5, week: 141 }); return p.sessions[0].items[0].name !== p.sessions[2].items[0].name; })());
unit("Plankoden tål mellanrum och små bokstäver", JSON.stringify(decodePlan(" " + encodePlan(sample).toLowerCase().replace("-", " -") + " ")) === JSON.stringify(decoded));
unit("Felaktig plankod avvisas", decodePlan("hej") === null);
const woman = computeTargets({ sex: "k", age: 35, weight: 70, height: 168, bodyFat: NaN, activity: 1.375, rate: 0.75 });
menu.setPlanRandomness(424242, {}); menu.invalidateMenu();
const hisWeek = menu.buildWeek(today + 1, man, "F0"), herWeek = menu.buildWeek(today + 1, woman, "F0");
unit("Samma kod: samma rätter för man och kvinna", JSON.stringify(hisWeek.plan) === JSON.stringify(herWeek.plan));
unit("Samma kod: portionerna anpassas efter personen", hisWeek.recipes[hisWeek.plan[0][1]].m.k !== herWeek.recipes[herWeek.plan[0][1]].m.k);
unit("Samma kod: samma träningspass", JSON.stringify(buildProgram("gym", [1, 3, 5]).schedule) === JSON.stringify(buildProgram("gym", [1, 3, 5]).schedule));
menu.setPlanRandomness(7, {}); menu.invalidateMenu();
unit("Annan kod: andra rätter", JSON.stringify(menu.buildWeek(today + 1, man, "F0").plan) !== JSON.stringify(hisWeek.plan));
menu.setPlanRandomness(0, {}); menu.invalidateMenu();

// Fastan
const fasting = await import("../public/js/fasting.js");
const skipped = fasting.fastingDay({ planned: 7, first: 12, last: null, yesterdayLast: 20 });
unit("Hoppad frukost, första måltid 12:00: fönster 12–20, måltid 19:00, fasta klar 12:00", skipped.windowEnd === 20 && skipped.nextMeal === 19 && fasting.formatClock(skipped.fastEnd) === "12:00");
unit("Varning: planerad frukost 07:00 i morgon ger bara 11 h", skipped.tonightIfPlanned === 11);
unit("Sista måltiden loggad 18:30 stänger fönstret och flyttar fastan", fasting.fastingDay({ planned: 7, first: 7, last: 18.5 }).fastEnd === 34.5);
unit("Läget kl 22: fastar sedan 20, 2 h av 16", (() => { const n = fasting.fastingNow(skipped, 22, 20); return n.state === "fasting" && n.elapsed === 2 && n.left === 14; })());
unit("Läget kl 13: ätfönstret öppet, 7 h kvar", (() => { const n = fasting.fastingNow(skipped, 13, 20); return n.state === "eating" && n.left === 7; })());
unit("Läget kl 06: fastar sedan i går 20:00, 10 h", fasting.fastingNow(skipped, 6, 20).elapsed === 10);

// Tillskott
const supps = await import("../public/js/supplements.js");
const gymTips = supps.supplementTips({ start: 7, kind: "str", weight: 95 });
unit("Gymdag: PWO 10:30, vassle 13:00, kreatin med måltiden 14:00", gymTips.map((t) => `${fasting.formatClock(t.at)} ${t.name}`).join(", ") === "10:30 PWO, 13:00 Vassle, 14:00 Kreatin");
unit("Gymdag: vassle behövs inte när måltiden kommer strax efter passet", gymTips.find((t) => t.name === "Vassle").text.startsWith("Behövs inte"));
const lateTips = supps.supplementTips({ start: 12, kind: "str", weight: 95 });
unit("Sent pass: varning för koffein", lateTips.find((t) => t.name === "PWO").text.includes("koffeinfri"));
unit("Vilodag: ingen PWO, kreatin med frukosten", (() => { const t = supps.supplementTips({ start: 7, kind: "rest", weight: 95 }); return !t.some((x) => x.name === "PWO") && t.find((x) => x.name === "Kreatin").at === 7; })());

// Egna recept
const own = await import("../public/js/myrecipes.js");
const myBreakfast = own.cleanRecipe({ t: "Min proteinfrukost", g: "b", items: [["kvarg", 200], ["havre", 40], ["blabar", 100]], how: "Blanda." });
own.addMyRecipe(myBreakfast);
menu.invalidateMenu();
const withOwn = menu.buildWeek(today, man, myBreakfast.id);
unit("Eget frukostrecept kan väljas som frukost varje dag", withOwn.plan.every((d) => d[0] === myBreakfast.id) && withOwn.recipes[myBreakfast.id].items.length === 3);
unit("Eget recept utan namn avvisas", own.cleanRecipe({ t: " ", items: [["kvarg", 100]] }) === null);
own.removeMyRecipe(myBreakfast.id);
menu.invalidateMenu();

// Apelsinallergi är skild från citron och lime
memory["ffv-excl"] = JSON.stringify({ allergens: ["citrus"], foods: [] });
prefs.loadPreferences();
unit("Gammalt val 'citrus' blir apelsin, mandarin och clementin var för sig", ["apelsin", "mandarin", "clementin"].every((a) => prefs.exclusions.allergens.has(a)) && !prefs.exclusions.allergens.has("citron"));
prefs.exclusions.allergens.delete("mandarin"); prefs.saveExclusions(); prefs.loadPreferences();
unit("Urkryssad allergen läggs inte tillbaka vid nästa start", !prefs.exclusions.allergens.has("mandarin") && prefs.exclusions.allergens.has("apelsin"));
unit("Gamla grupper i en import översätts", JSON.stringify(prefs.migrateExclusions({ allergens: ["gluten", "baljvaxter"], foods: ["x_citron", "x_tonfisk"] })) === JSON.stringify({ allergens: ["vete", "rag", "korn", "havre", "bonor", "artor", "linser", "citron"], foods: ["x_tonfisk"] }));
for (const m of [{ id: "my_juice", n: "Apelsinjuice", k: 45 }, { id: "my_citron", n: "Citronkvarg", k: 70 }]) prefs.addMyFood(prefs.cleanMyFood(m));
unit("Eget livsmedel 'Apelsinjuice' stoppas av apelsinallergin", prefs.isExcluded("my_juice"));
unit("Eget livsmedel 'Citronkvarg' stoppas inte", !prefs.isExcluded("my_citron"));
unit("Recepten har citron när citron inte är bortvald", prefs.adaptInstructions("Rör kvarg med dill, citron och salt.").includes("citron"));
prefs.setExclusions({ allergens: ["citron"], foods: [] });
unit("Citron bortvald: citron byts, lime behålls", prefs.adaptInstructions("Dill, citron och lime.") === "Dill, en skvätt äppelcidervinäger och lime.");
prefs.setExclusions({ allergens: ["lime"], foods: [] });
unit("Lime bortvald: lime byts mot vinäger", prefs.adaptInstructions("Kvarg med lime och salt.") === "Kvarg med en skvätt äppelcidervinäger och salt.");
prefs.removeMyFood("my_juice"); prefs.removeMyFood("my_citron");
prefs.setExclusions({ allergens: ["apelsin", "mandarin", "clementin"], foods: ["x_rodbetor", "x_tonfisk"] });
delete globalThis.localStorage;

// ---------- Del 2: appen i en simulerad webbläsare ----------
const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8").replace(/<script type="module"[^>]*><\/script>/, "").replace(/<link rel="stylesheet"[^>]*>/g, "");
const dom = new JSDOM(html, { url: "https://example.org/app/index.html", pretendToBeVisual: true });
const win = dom.window;
const errors = [];
for (const k of ["document", "localStorage", "location", "navigator", "HTMLElement", "Event", "Blob"]) globalThis[k] = win[k];
globalThis.window = win; win.scrollTo = () => {}; win.HTMLElement.prototype.scrollIntoView = function () {};
win.addEventListener("error", (e) => errors.push(e.message));
const $ = (id) => win.document.getElementById(id);
const text = (id) => $(id).textContent.replace(/\s+/g, " ").trim();
await import("../public/js/main.js");
const fire = (el, type) => el.dispatchEvent(new win.Event(type, { bubbles: true }));
const go = (hash) => { win.location.hash = hash; fire(win, "hashchange"); };
const visible = () => [...win.document.querySelectorAll("[data-view]")].filter((v) => !v.hidden).map((v) => v.dataset.view).join(",");
const check = (label, cond) => { console.log((cond ? "OK   " : "FEL  ") + label); if (!cond) process.exitCode = 1; };
console.log("\n# Appen i en simulerad webbläsare (jsdom)");

check("Laddningsskärmen finns och döljs när appen har startat", !!win.document.querySelector(".loading-screen") && !win.document.documentElement.classList.contains("booting") && !win.document.documentElement.classList.contains("boot-failed"));

// Guiden första gången: villkor, dig, mål, träning, mat
const next = () => fire($("wz-next"), "click");
const typeIn = (id, value) => { $(id).value = value; fire($(id), "input"); };
check("Första gången startar guiden med villkoren och inget sparas", !$("wizard").hidden && win.localStorage.length === 0 && text("wz-progress") === "Steg 1 av 5" && text("wz-title") === "Innan du börjar");
check("Villkoren visas: rekommendationer, ExRx, localStorage, export, i befintligt skick", ["inte medicinsk rådgivning", "ExRx", "localStorage", "exportera", "befintligt skick"].every((t) => text("wz-terms").includes(t)));
check("Formuläret och importen visas inte förrän villkoren är godkända", $("wz-import").closest("[data-step]").hidden && $("age").closest("[data-step]").hidden);
next();
check("Utan kryss går det inte vidare", text("wz-progress") === "Steg 1 av 5" && text("wz-msg").startsWith("Kryssa i"));
fire($("wz-back"), "click"); check("Tillbaka på första steget gör inget", text("wz-progress") === "Steg 1 av 5");
$("wz-accept").checked = true; next();
check("Steg 2: dig, med import överst", text("wz-progress") === "Steg 2 av 5" && !$("wz-import").closest("[data-step]").hidden && !$("age").closest("[data-step]").hidden);
check("Guiden kräver egna värden: exemplen är tömda och kön är inte valt", $("age").value === "" && $("weight").value === "" && !win.document.querySelector('input[name="sex"]:checked'));
next();
check("Nästa utan ifyllda fält stannar på steget och förklarar", text("wz-progress") === "Steg 2 av 5" && text("wz-msg").startsWith("Fyll i"));
win.document.querySelector('input[name="sex"][value="m"]').checked = true;
$("age").value = "40"; $("weight").value = "95"; $("height").value = "180";
next();
check("Steg 3: målet", text("wz-progress") === "Steg 3 av 5" && !$("goal").closest("[data-step]").hidden && $("age").closest("[data-step]").hidden);
check("BMI över 25: målvikten fylls i vid BMI 24,9 (80,5 kg för 180 cm)", $("goal").value === "80,5");
check("Rutan visar BMI, uträkningen och att det är ett förslag", !$("goal-info").hidden && text("goal-info").includes("Ditt BMI är 29,3") && text("goal-info").includes("Rekommenderad målvikt: 80,5 kg") && text("goal-info").includes("24,9 × 1,80²") && text("goal-info").includes("ifylld som förslag"));
check("Rutan visar en prognos med appens kalorimål", /Prognos: med appens kalorimål, [\d\s ]+ kcal per dag .* om ungefär \d+ veckor/.test(text("goal-info")));
check("Rutan säger att det är en rekommendation baserad på ExRx", text("goal-info").includes("rekommendation baserad på ExRx") && text("goal-info").includes("inte medicinsk rådgivning") && $("goal-info").querySelector('a[href="https://exrx.net/Calculators/BMI"]'));
typeIn("goal", "85");
check("Eget mål: inte längre markerat som förslag, prognosen räknas om", !text("goal-info").includes("ifylld som förslag") && text("goal-info").includes("når du 85,0 kg"));
fire($("wz-back"), "click"); next();
check("Ett eget mål skrivs inte över när man går tillbaka och fram", $("goal").value === "85");
typeIn("goal", "55");
check("Varnar för mål under BMI 18,5", text("goal-info").includes("under 18,5 (undervikt)"));
typeIn("goal", ""); next(); check("Målvikt krävs", text("wz-progress") === "Steg 3 av 5");
typeIn("goal", "85"); next();
check("Steg 4: träning, med gymdagar", text("wz-progress") === "Steg 4 av 5" && !$("tdays").closest("[data-step]").hidden);
next(); check("Steg 5: mat och allergier, inga förvalda", text("wz-progress") === "Steg 5 av 5" && text("wz-next") === "Klar" && $("wz-allergens").querySelectorAll("input").length > 10 && !$("wz-allergens").querySelector(":checked"));
check("Fortfarande inget sparat innan Klar", win.localStorage.length === 0);
next();
check("Klar sparar profil och godkända villkor och stänger guiden", $("wizard").hidden && JSON.parse(win.localStorage.getItem("ffv")).weight === "95" && JSON.parse(win.localStorage.getItem("ffv-terms")).version === TERMS_VERSION && $("f").closest("[data-view]").dataset.view === "profil");
check("Målviktsrutan visas också under Profil", !$("goal-info").hidden && $("goal-info").closest("[data-view]").dataset.view === "profil");


check("Idag har titel, dagens recept och tidslinje", text("td-title").length > 3 && $("td-food").querySelectorAll("details.recipe").length >= 3 && $("td-timeline").querySelectorAll(".tl-label").length === 4);
check("Dagens recept går att fälla ut med ingredienser", $("td-food").querySelector("details.recipe .ingredients li") !== null);
check("Dagens träning visas", text("td-train-title").length > 2 && ($("td-training").querySelectorAll("a.row.exercise").length >= 5 || $("td-training").querySelector(".plan-steps")));
check("Inga allergier eller bortval är ifyllda från början", !win.document.querySelector("[data-allergen]:checked, [data-food]:checked") && JSON.parse(win.localStorage.getItem("ffv-excl")).allergens.length === 0 && JSON.parse(win.localStorage.getItem("ffv-excl")).foods.length === 0);
check("Inget apelsintips utan bortvald apelsin", !text("td-supps").includes("apelsin"));
const orange = win.document.querySelector('[data-allergen="apelsin"]'); orange.checked = true; fire(orange, "change");
check("Apelsintipset visas när apelsin är bortvald", text("td-supps").includes("Du har valt bort apelsin"));
orange.checked = false; fire(orange, "change");
check("Profilens mål ritas", $("targets").querySelectorAll(".tile").length === 4);
check("Veckan har 7 dagar med länkar till recept", $("week").querySelectorAll(".day").length === 7 && $("week").querySelectorAll('a[href^="#rc-"]').length >= 21);
check("Recept är utfällbara rader", $("r-dinner").querySelectorAll("details.recipe > summary.row").length === 7);
check("Fastan ligger under Profil", $("fasta").closest("[data-view]").dataset.view === "profil");
check("Träningspass, en per rad, övningar är länkar", $("sessions").querySelectorAll(".session").length === 3 && $("sessions").querySelectorAll("a.row.exercise[href^='https://exrx.net/']").length >= 15);
check("Inköpslistan har kryssrutor", $("shop").querySelectorAll("[data-shop]").length > 10);
check("Tidslinjer ritas", $("tl-eat").querySelectorAll(".tl-label").length === 3 && $("tl-train").querySelectorAll(".tl-label").length === 5);

go("mat"); check("Fliken Mat visar veckan", visible() === "mat" && !win.document.querySelector('[data-subview="vecka"]').hidden);
const rid = $("week").querySelector('a[href^="#rc-"]').getAttribute("href").slice(1);
go(rid); check("Länk till recept öppnar Mat → Recept och fäller ut receptet", visible() === "mat" && !win.document.querySelector('[data-subview="recept"]').hidden && $(rid).open);
go("inkop"); check("#inkop öppnar Handla", !win.document.querySelector('[data-subview="inkop"]').hidden);
go("traning"); check("Fliken Träning", visible() === "traning");
go("installningar"); check("Inställningar via kugghjulet", visible() === "installningar" && win.document.querySelector('a[data-tab="installningar"]').getAttribute("aria-current") === "page");
go("idag"); check("Tillbaka till Idag", visible() === "idag");


// Innehållet i varje del, inte bara rubrikerna
const firstRecipe = $("r-dinner").querySelector("details.recipe");
check("Receptkort har ingredienser och instruktion", firstRecipe.querySelectorAll(".ingredients li").length >= 3 && firstRecipe.querySelector(".recipe-body p").textContent.length > 20);
check("Frukost, efterrätter och lördagsgodis finns", $("r-breakfast").children.length >= 1 && $("r-other").children.length >= 1 && $("r-treat").children.length >= 1);
check("Dagssummor i veckan", [...$("week").querySelectorAll(".tot")].every((t) => /kcal · \d+ g P · \d+ g K/.test(t.textContent)));
check("Fusktabellen har fyra rader", $("cheat-table").querySelectorAll("tbody tr").length === 4);
check("Uträkningen har steg", $("steps").querySelectorAll("li").length >= 4);
check("Inställningar: allergener och ingredienser", $("ex-allergens").querySelectorAll("input").length === 27 && $("ex-foods").querySelectorAll("details").length >= 6);
check("Loggens nyckeltal", $("l-tiles").querySelectorAll(".tile").length >= 3);
check("Bålcirkel finns i ett pass", $("sessions").querySelectorAll(".circuit a.row").length === 4);
check("Övningsrader har set och vila", [...$("sessions").querySelectorAll("a.row.exercise")].slice(0, 3).every((a) => /×/.test(a.textContent)));

// Profil: ändra gymdagar till tis/tor/lör
for (const el of win.document.querySelectorAll("[data-day]")) el.checked = ["1", "3", "5"].includes(el.dataset.day);
fire($("tdays"), "change");
check("Gymdagar sparas och schemat följer", $("tdays-val").value === "1,3,5" && text("prog-sub").startsWith("Helkropp på tisdag"));
check("Profilen sparas", JSON.parse(localStorage.getItem("ffv"))["tdays-val"] === "1,3,5");

// Allergi: fisk
const fish = win.document.querySelector('[data-allergen="fisk"]'); fish.checked = true; fire(fish, "change");
check("Fiskallergi tar bort fisk ur inköpslistan", !$("shop").querySelector('[data-shop="sej"],[data-shop="torsk"]') && text("ex-sum").includes("val aktiva"));
fish.checked = false; fire(fish, "change");

// Eget livsmedel
$("mf-name").value = "Kycklinglårfilé"; $("mf-k").value = "140"; $("mf-p").value = "19"; $("mf-f").value = "7"; $("mf-cat").value = "kott"; $("mf-rep").value = "kyckling"; $("mf-mode").value = "always";
fire($("mf"), "submit");
check("Eget livsmedel läggs till och ersätter", $("mf-list").textContent.includes("Kycklinglårfilé") && (!$("shop").querySelector('[data-shop="kyckling"]')));

// Logg: datum skrivs med siffror och får bindestreck
$("l-date").value = "20261001"; fire($("l-date"), "input");
check("Datum formateras ÅÅÅÅ-MM-DD", $("l-date").value === "2026-10-01");
$("l-weight").value = "94.2"; fire($("logf"), "submit");
check("Loggpost sparas med ISO-datum", text("l-msg").startsWith("Sparat för 2026-10-01") && $("l-table").textContent.includes("2026-10-01"));
$("l-date").value = "2026-13-40"; fire($("logf"), "submit");
check("Ogiltigt datum avvisas", text("l-msg").startsWith("Skriv datumet som ÅÅÅÅ-MM-DD"));

// Shopping-avbockning
const item = $("shop").querySelector("[data-shop]"); item.checked = true; fire(item, "change");
check("Avbockning sparas och räknas", text("shop-progress").startsWith("1 av"));


// Plankod i Inställningar
const myCode = text("pc-code");
check("Plankoden visas", /^[0-9A-Z]{4} [0-9A-Z]{2}-[GHK][0-9A-Z]{3}/.test(myCode));
const dinnersBefore = [...$("week").querySelectorAll('a[href^="#rc-"]')].map((a) => a.getAttribute("href")).join();
$("pc-input").value = "00ABCD-H1A0"; fire($("pc-form"), "submit");
check("En delad kod byter utrustning, gymdagar och rätter", win.document.querySelector('input[name="eq"]:checked').value === "db" && $("tdays-val").value === "1,3,5" &&
  [...$("week").querySelectorAll('a[href^="#rc-"]')].map((a) => a.getAttribute("href")).join() !== dinnersBefore && text("pc-code").replace(" ", "").startsWith("00ABCD-H1A0"));
const idagMeals = [...$("td-food").querySelectorAll("summary b")].map((b) => b.textContent).join("|");
win.document.querySelector('input[name="sex"][value="k"]').checked = true; fire($("f"), "change");
check("Byte till kvinna: samma rätter, nya portioner", [...$("td-food").querySelectorAll("summary b")].map((b) => b.textContent).join("|") === idagMeals && text("pc-code").replace(" ", "").startsWith("00ABCD-H1A0"));
$("pc-input").value = "ogiltig"; fire($("pc-form"), "submit");
check("Ogiltig kod avvisas med förklaring", text("pc-msg").startsWith("Koden gick inte att läsa"));

// Fastan i dag: hoppa över frukosten och ät först 12:00
go("idag");
$("fs-first").value = "12:00"; fire($("fs-first"), "change");
const plan = text("fs-plan");
check("Fastan räknas om från 12:00", plan.includes("Ätfönster 12:00–20:00") && plan.includes("Eftermiddagsmåltiden kl. 19:00") && plan.includes("klar i morgon 12:00"));
check("Varning om kort fasta till planerad frukost", /bara 11 h fasta/.test(plan));
check("Idag följer den nya tiden", $("td-food").querySelector(".kind").textContent.startsWith("12:00") && text("td-sub").startsWith("Frukost 12:00"));
check("Läget just nu visas", /Du fastar|Ätfönstret är öppet|Fastan är klar/.test(text("fs-now")));
check("Måltidstiden sparas i loggen", $("l-table").textContent.includes("12:00–?"));
$("l-date").value = todayStr(); $("l-weight").value = "93.8"; fire($("logf"), "submit");
check("Loggformuläret behåller måltidstiden", $("l-table").textContent.includes("12:00–?"));
fire($("fs-reset"), "click");
check("Tillbaka till planens tider", text("fs-plan").includes("Ätfönster 07:00") && $("fs-reset").hidden);

// Eget frukostrecept via Inställningar
go("installningar");
$("mr-name").value = "Kvarg med havre";
const rows = $("mr-items").querySelectorAll(".mr-item");
rows[0].querySelector("[data-mr-food]").value = "kvarg"; rows[0].querySelector("[data-mr-grams]").value = "200";
rows[1].querySelector("[data-mr-food]").value = "havre"; rows[1].querySelector("[data-mr-grams]").value = "40";
fire($("mr-items"), "input");
check("Receptformuläret visar kcal och protein", text("mr-sum").includes("kcal"));
fire($("mr"), "submit");
const ownOption = [...$("bmeal").options].find((o) => o.textContent.includes("Kvarg med havre"));
check("Eget recept sparas och blir ett frukostval", text("mr-list").includes("Kvarg med havre") && !!ownOption);
$("bmeal").value = ownOption.value; fire($("f"), "change");
check("Eget frukostrecept visas på Idag och i inköpslistan", [...$("td-food").querySelectorAll("summary b")][0].textContent === "Kvarg med havre" && !!$("shop").querySelector('[data-shop="havre"]'));

// Tillskott på Idag
check("Tillskottstips visas på Idag", !$("td-supps-box").hidden && /Kreatin/.test(text("td-supps")));
for (const el of win.document.querySelectorAll("[data-supp]")) el.checked = false;
fire($("supps"), "change");
check("Utan tillskott visas inga tips", $("td-supps-box").hidden);

// Svep mellan flikar
const swipe = (dx, x0 = 200, target = win.document.querySelector("#idag")) => {
  const touch = (x) => ({ clientX: x, clientY: 300 });
  const ev = (type, x) => { const e = new win.Event(type, { bubbles: true }); Object.defineProperty(e, "changedTouches", { value: [touch(x)] }); Object.defineProperty(e, "touches", { value: type === "touchstart" ? [touch(x)] : [] }); return e; };
  target.dispatchEvent(ev("touchstart", x0));
  target.dispatchEvent(ev("touchend", x0 + dx));
  fire(win, "hashchange");
};
go("idag");
swipe(-120); check("Svep vänster från Idag öppnar Mat → Veckan", visible() === "mat" && !win.document.querySelector('[data-subview="vecka"]').hidden);
swipe(-120, 200, $("vecka")); check("Svep vänster igen öppnar Recept", !win.document.querySelector('[data-subview="recept"]').hidden);
swipe(120, 200, $("recept")); check("Svep höger går tillbaka till Veckan", !win.document.querySelector('[data-subview="vecka"]').hidden);
swipe(-30, 200, $("vecka")); check("Kort rörelse byter inte flik", !win.document.querySelector('[data-subview="vecka"]').hidden);
swipe(-120, 200, $("cheat-table")); check("Svep i en tabell som scrollar i sidled byter inte flik", !win.document.querySelector('[data-subview="vecka"]').hidden);
go("profil"); swipe(-120, 200, $("profil").querySelector(".sec-head")); check("Svep vänster från Profil (sista) stannar kvar", visible() === "profil");
go("idag");

// Övningsväxling i appen
go("traning");
const before = [...$("sessions").querySelectorAll("a.row.exercise b")].map((b) => b.textContent).join("|");
check("Träning visar vilken vecka övningarna gäller", /Övningarna för vecka \d+/.test(text("prog-week")) && text("prog-week").includes("varje vecka"));
fire($("wk-next"), "click");
check("Nästa vecka har andra övningar men samma pass", [...$("sessions").querySelectorAll("a.row.exercise b")].map((b) => b.textContent).join("|") !== before && [...$("sessions").querySelectorAll(".session h3")].map((h) => h.textContent).join() === "Helkropp,Överkropp,Ben");
fire($("wk-today"), "click");
$("exswap").value = "4"; fire($("f"), "change");
check("Bytesintervallet syns i plankoden", text("pc-code").replace(" ", "").split(".")[0].endsWith("4") && text("prog-week").includes("var fjärde vecka"));
$("exswap").value = "1"; fire($("f"), "change");
// Slumpa om mat och träning under Inställningar
check("Mat har ingen slumpknapp och veckan ligger inte i en karusell", !$("wk-reroll") && !$("week").closest(".scroll-x") && $("pc-new").closest("[data-view]").dataset.view === "installningar");
const exercises = () => [...$("sessions").querySelectorAll("a.row.exercise b")].map((b) => b.textContent).join("|");
const dinners = () => [...$("week").querySelectorAll('.day li:not(:first-child) a[href^="#rc-"]')].map((a) => a.getAttribute("href")).join();
const tick = () => new Promise((r) => setTimeout(r, 0));
const answer = async (yes) => { fire($("confirm").querySelector(`[data-answer="${yes ? "yes" : "no"}"]`), "click"); await tick(); };
const reshuffle = async (scope) => { $("pc-scope").value = scope; fire($("pc-new"), "click"); await answer(true); };
check("Recept och träning är förvalt", $("pc-scope").value === "both");
const codeBefore = text("pc-code"), exBefore = exercises(), dinnersBefore2 = dinners();
fire($("pc-new"), "click");
check("Slumpa om öppnar en modal som frågar om valet", $("confirm").hasAttribute("open") && text("confirm-text") === "Är du säker på att du vill slumpa om recept och träning?");
await answer(false);
check("Nej stänger modalen och ändrar inget", !$("confirm").hasAttribute("open") && text("pc-code") === codeBefore && dinners() === dinnersBefore2);
fire($("pc-new"), "click"); await answer(true);
check("Ja slumpar om: nytt frö, nya rätter och nya övningar", !$("confirm").hasAttribute("open") && text("pc-code") !== codeBefore && dinners() !== dinnersBefore2 && exercises() !== exBefore);
$("pc-scope").value = "training"; fire($("pc-new"), "click");
check("Frågan följer valet i listan", text("confirm-text") === "Är du säker på att du vill slumpa om bara träningen?");
await answer(false);
let ex0 = exercises(), d0 = dinners();
await reshuffle("menu");
check("Bara recepten: nya rätter, samma övningar", dinners() !== d0 && exercises() === ex0 && text("pc-code").includes("+"));
ex0 = exercises(); d0 = dinners();
await reshuffle("training");
check("Bara träningen: nya övningar, samma rätter", exercises() !== ex0 && dinners() === d0);
const sharedCode = text("pc-code"), sharedEx = exercises(), sharedD = dinners();
await reshuffle("both");
$("pc-input").value = sharedCode; fire($("pc-form"), "submit");
check("En kod med eget träningsfrö ger tillbaka samma rätter och övningar", exercises() === sharedEx && dinners() === sharedD && text("pc-code") === sharedCode);
check("Passindelningen är densamma efter omslumpning", [...$("sessions").querySelectorAll(".session h3")].map((h) => h.textContent).join() === "Helkropp,Överkropp,Ben");
// Ta bort en loggpost via modalen
go("logg");
const delDate = win.document.querySelector("[data-del]").dataset.del;
fire(win.document.querySelector(`[data-del="${delDate}"]`), "click");
check("Ta bort frågar i en modal", $("confirm").hasAttribute("open") && text("confirm-text").includes(delDate));
await answer(false);
check("Nej behåller posten", !!win.document.querySelector(`[data-del="${delDate}"]`));
fire(win.document.querySelector(`[data-del="${delDate}"]`), "click"); await answer(true);
check("Ja tar bort posten", !win.document.querySelector(`[data-del="${delDate}"]`) && text("l-msg") === "Posten är borttagen.");
// Decimaler: både komma och punkt fungerar i alla sifferfält
const type = (id, value) => { $(id).value = value; fire($(id), "input"); };
const weightBefore = $("weight").value;
type("weight", "85,5"); const withComma = text("targets");
type("weight", "85.5"); const withDot = text("targets");
type("weight", "85"); const whole = text("targets");
check("Vikt 85,5 och 85.5 ger samma mål, skilt från 85", withComma === withDot && withComma !== whole && $("weight").validity.valid);
type("bf", "28,5"); const bfComma = text("targets"); type("bf", "28.5");
check("Kroppsfett med komma räknas (inte avrundat till 28)", text("targets") === bfComma && (type("bf", "28"), text("targets")) !== bfComma);
type("bf", "");
type("weight", "8x"); check("Text som inte är ett tal markeras som fel", !$("weight").validity.valid && $("weight").validationMessage.startsWith("Skriv ett tal"));
type("weight", "500"); check("Värde utanför intervallet markeras som fel", !$("weight").validity.valid && $("weight").validationMessage === "Ange ett värde mellan 40 och 250");
type("weight", weightBefore);
check("Etiketten säger kroppsfett", text("f").includes("Kroppsfett (%)"));
const infoBtn = $("f").querySelector('[aria-controls="bf-info"]');
check("Förklaringen om kroppsfett är dold tills man trycker på i-ikonen", $("bf-info").hidden && infoBtn.getAttribute("aria-expanded") === "false");
fire(infoBtn, "click");
check("i-ikonen visar förklaringen", !$("bf-info").hidden && infoBtn.getAttribute("aria-expanded") === "true" && text("bf-info").includes("Katch-McArdle") && text("bf-info").includes("Lämna fältet tomt"));
fire(infoBtn, "click"); check("Ett tryck till döljer den igen", $("bf-info").hidden);
go("logg");
$("l-date").value = "2026-09-20"; type("l-weight", "94,2"); type("l-waist", "101.5"); fire($("logf"), "submit");
const decimalEntry = JSON.parse(win.localStorage.getItem("ffv-log")).entries.find((e) => e.date === "2026-09-20");
check("Loggen tar vikt med komma och midja med punkt", decimalEntry?.weight === 94.2 && decimalEntry?.waist === 101.5);
fire($("mr-add"), "click");
const mrRow = $("mr-items").lastElementChild;
mrRow.querySelector("[data-mr-food]").value = mrRow.querySelector("[data-mr-food] option:nth-child(2)").value;
mrRow.querySelector("[data-mr-grams]").value = "150,5"; fire(mrRow.querySelector("[data-mr-grams]"), "input");
check("Gram i egna recept tar komma", text("mr-sum").length > 0 && mrRow.querySelector("[data-mr-grams]").validity.valid);
mrRow.remove(); fire($("mr-items"), "input");

// Om appen och villkoren
go("om");
check("Om appen är en egen sida", visible() === "om" && text("om").includes("ExRx") && text("om").includes("rekommendationer"));
check("Om appen länkar till GitHub-repot och MIT-licensen", !!$("om").querySelector('a[href="https://github.com/zolodev/MyNutrition"]') && text("om").includes("MIT-licensen") && !!$("om").querySelector('a[href$="/LICENSE"]'));
go("villkor");
check("Ingen koppling till Claude någonstans i appen", !win.document.documentElement.innerHTML.toLowerCase().includes("claude"));
check("Villkoren förklarar hur man drar tillbaka godkännandet och att appen inte har någon koppling till ExRx", text("terms-text").includes("Dra tillbaka ditt godkännande") && text("terms-text").includes("Inställningar → Radera all data") && text("terms-text").includes("Varken appen eller utvecklaren är anknuten till"));
check("Inställningar har Radera all data", $("erase-all").closest("[data-view]").dataset.view === "installningar");
check("Villkoren säger att appen kan innehålla fel och är ett hobbyprojekt", text("terms-text").includes("Appen kan innehålla fel") && text("terms-text").includes("personligt hobbyprojekt"));
check("Villkoren går att läsa igen och är samma text som i guiden", visible() === "om" && text("villkor").includes("befintligt skick") && text("terms-text") === text("wz-terms"));
check("Varje flik har en rad om rekommendationer och länk till villkoren", !!win.document.querySelector('.app-note a[href="#villkor"]') && !win.document.querySelector(".app-note").closest("[data-view]"));
go("installningar");
check("Inställningar länkar till Om appen", !!$("om-appen").querySelector('a[href="#om"]'));

// Rensa mina uppgifter: bekräfta, guiden startar igen, loggen finns kvar
const logBefore = win.localStorage.getItem("ffv-log");
go("profil"); fire($("clear"), "click");
check("Rensa frågar först", $("confirm").hasAttribute("open"));
await answer(true);
check("Rensa öppnar guiden och tar bort profilen", !$("wizard").hidden && win.localStorage.getItem("ffv") == null && win.localStorage.getItem("ffv-log") === logBefore);
$("wz-accept").checked = true; next();
win.document.querySelector('input[name="sex"][value="m"]').checked = true;
$("age").value = "41"; $("weight").value = "92"; $("height").value = "180"; next(); $("goal").value = "84"; next(); next(); next();
check("Guiden sparar den nya profilen", $("wizard").hidden && JSON.parse(win.localStorage.getItem("ffv")).weight === "92" && $("f").closest("[data-view]").dataset.view === "profil");
check("Inga JS-fel", errors.length === 0);
if (errors.length) console.log(errors);

// Uppdatering: starta appen på nytt med det som sparats, och med sparad data i ett äldre format
const { spawnSync } = await import("child_process");
const os = await import("os"), path = await import("path");
const reload = (name, storage) => {
  const file = path.join(os.tmpdir(), `ffv-reload-${process.pid}-${name}.json`);
  fs.writeFileSync(file, JSON.stringify(storage));
  const r = spawnSync(process.execPath, [new URL("./reload.mjs", import.meta.url).pathname, file, name], { stdio: "inherit" });
  fs.rmSync(file, { force: true });
  if (r.status !== 0) process.exitCode = 1;
};
// Export av allt: kopiera (urklipp saknas i jsdom, så texten visas för att kopieras för hand)
go("logg"); fire($("l-copy"), "click"); await tick();
const exportedText = $("l-copytext").value;
const exportedData = JSON.parse(exportedText).data;
check("Kopiera allt visar texten när urklipp nekas", !$("l-copytext").hidden && text("l-msg").startsWith("Kopieringen nekades"));
check("Exporten innehåller profil, logg, plan, allergier och tillskott", ["ffv", "ffv-log", "ffv-seed", "ffv-excl"].every((k) => k in exportedData) && exportedData["ffv-log"].entries.length > 0 && exportedData.ffv.weight === "92");
check("Exporten innehåller allt sparat utom det som bara gäller enheten", Object.keys(win.localStorage).filter((k) => k.startsWith("ffv") && k !== "ffv-swipe-hint" && k !== "ffv-install-declined" && k !== "ffv-terms").every((k) => k in exportedData) && !("ffv-swipe-hint" in exportedData));
$("l-paste").value = "{ trasig"; fire($("l-paste-go"), "click"); await tick();
check("Trasig importtext avvisas utan att något ändras", text("l-msg").startsWith("Texten är inte en giltig export") && win.localStorage.getItem("ffv-log") === JSON.stringify(exportedData["ffv-log"]));

console.log("\n# Import i en ren webbläsare");
const importScenario = (scenario) => {
  const file = path.join(os.tmpdir(), `ffv-export-${process.pid}.json`);
  fs.writeFileSync(file, exportedText);
  const r = spawnSync(process.execPath, [new URL("./backup.mjs", import.meta.url).pathname, scenario, file], { stdio: "inherit" });
  fs.rmSync(file, { force: true });
  if (r.status !== 0) process.exitCode = 1;
};
for (const scenario of ["guide", "skriv-över", "äldre", "radera"]) importScenario(scenario);

console.log("\n# Lagring: IndexedDB med localStorage som reserv");
for (const mode of [[], ["ny-användare"]]) {
  const r = spawnSync(process.execPath, [new URL("./storage.mjs", import.meta.url).pathname, ...mode], { stdio: "inherit" });
  if (r.status !== 0) process.exitCode = 1;
}

console.log("\n# Uppdatering: appen startas om med sparad data");
reload("första start", {});
reload("omstart", Object.fromEntries(Object.keys(win.localStorage).map((k) => [k, win.localStorage.getItem(k)])));
reload("äldre format", {
  ffv: JSON.stringify({ age: "45", weight: "95", height: "182", sex: "m", act: "1.55", rate: "0.75", eq: "gym", days: "4" }),
  "ffv-log": JSON.stringify({ entries: [{ date: "2026-09-01", weight: 97.5 }, { date: "2026-09-08", weight: 96.4, waist: 104, note: "bra vecka" }] }),
  "ffv-seed": "123456",
});

// Appen har en minuttimer för fastans läge; avsluta när testerna är klara.
process.exit(process.exitCode ?? 0);
