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
unit("Mål-BMI är mitt i normalvikt: (18,5 + 24,9) / 2 = 21,7", Math.abs(nutrition.TARGET_BMI - 21.7) < 1e-9);
unit("Över BMI 25: målvikt vid BMI 21,7, avrundad till halvt kilo", nutrition.recommendedGoal(95, 180) === 70.5 && nutrition.recommendedGoal(110, 165) === 59 && Math.abs(nutrition.bmiOf(70.5, 180) - 21.7) < 0.1);
unit("BMI 25 eller lägre: ingen föreslagen målvikt", nutrition.recommendedGoal(70, 180) === null && nutrition.recommendedGoal(81, 180) === null);
const forecastTargets = computeTargets({ sex: "m", age: 40, weight: 95, height: 180, bodyFat: NaN, activity: 1.375, rate: 1 });
const forecast = nutrition.goalForecast(forecastTargets, 85);
unit("Prognosen räknar veckor med appens underskott", Math.abs(forecast.weeks - 10 / nutrition.kgPerWeek(forecastTargets.deficit)) < 1e-9 && nutrition.goalForecast(forecastTargets, 96) === null);

// Hushållsmått i egna recept
const nutr = await import("../public/js/nutrition.js");
unit("Mått räknas om till gram: 2 st ägg, 1,5 dl äggvita, 4 msk mjölk, 0,75 dl riven ost", nutr.gramsOf("agg", 2, "st") === 120 && nutr.gramsOf("aggvita", 1.5, "dl") === 154.5 && Math.abs(nutr.gramsOf("mjolk", 4, "msk") - 61.8) < 1e-9 && nutr.gramsOf("ost", 0.75, "dl") === 30);
unit("Bara mått som går att räkna om erbjuds", nutr.unitsFor("agg").includes("st") && !nutr.unitsFor("agg").includes("dl") && nutr.unitsFor("aggvita").includes("dl") && nutr.unitsFor("kyckling").join() === "g,kg");
unit("Mängden visas i receptets mått", nutr.formatAmount("aggvita", 155, "dl") === "1,5 dl (155 g)" && nutr.formatAmount("mjolk", 62, "msk") === "4 msk (62 g)" && nutr.formatAmount("ost", 30, "dl") === "0,75 dl (30 g)" && nutr.formatAmount("aggvita", 155) === "155 g");

// Kondition: tider och tempo
const logMod = await import("../public/js/log.js");
unit("Tider tolkas som min:sek, h:min:sek eller minuter", logMod.parseWorkoutTime("8:57") === 537 && logMod.parseWorkoutTime("1:05:30") === 3930 && logMod.parseWorkoutTime("45") === 2700 && logMod.parseWorkoutTime("19:00:99x") === null);
unit("Tempo: min/km för löpning, min/500 m för rodd, km/h för cykling", logMod.paceText({ a: "lopning", km: 1.14, s: 537 }) === "7:51/km" && logMod.paceText({ a: "rodd", km: 2, s: 570 }) === "2:23/500 m" && logMod.paceText({ a: "cykel", km: 10, s: 1200 }) === "30,0 km/h");
unit("Intensitetsminuter: måttliga + 2 × höga", logMod.intensityMinutes({ imMod: 47, imVig: 50 }) === 147 && logMod.intensityMinutes({ imMod: 30 }) === 30 && logMod.intensityMinutes({}) === null);
unit("Snittpuls sparas inte längre, maxpuls gör det", !("hrAvg" in logMod.cleanCardio({ a: "lopning", km: 1, s: 300, hrAvg: 150, hrMax: 171 })) && logMod.cleanCardio({ a: "lopning", km: 1, s: 300, hrMax: 171 }).hrMax === 171);
unit("Tid som hh:mm:ss och mm:ss", logMod.parseWorkoutTime("01:05:30") === 3930 && logMod.parseWorkoutTime("00:08:57") === 537 && logMod.parseWorkoutTime("08:57") === 537);
unit("Tider skrivs ut som hh:mm:ss", logMod.formatHms(537) === "00:08:57" && logMod.formatHms(3930) === "01:05:30");
unit("Siffror får kolon från höger som på ett stoppur", logMod.formatWorkoutInput("857") === "8:57" && logMod.formatWorkoutInput("0857") === "08:57" && logMod.formatWorkoutInput("10530") === "1:05:30" && logMod.formatWorkoutInput("010530") === "01:05:30" && logMod.formatWorkoutInput("8:5") === "8:5");
unit("Ett pass utan distans eller tid räknas inte", logMod.cleanCardio({ a: "lopning", km: 1 }) === null && logMod.cleanCardio({ a: "simning", km: 1, s: 60 }) === null);

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
const fruitsIn = (wk) => new Set(Object.values(wk.recipes).filter((r) => wk.plan.flat().includes(r.id)).flatMap((r) => r.items.map(([f]) => f)).filter((f) => ["ananas", "papaya", "kiwi", "mango"].includes(f)));
unit("Frukten med enzymer varierar mellan rätterna och veckorna", fruitsIn(hisWeek).size >= 2 && new Set([...fruitsIn(hisWeek), ...fruitsIn(menu.buildWeek(today + 2, man, "F0"))]).size >= 3);
prefs.setExclusions({ allergens: [...prefs.exclusions.allergens], foods: [...prefs.exclusions.foods, "x_kiwi"] }); menu.invalidateMenu();
unit("Bortvald kiwi ersätts av en annan frukt", ![...fruitsIn(menu.buildWeek(today + 1, man, "F0")), ...fruitsIn(menu.buildWeek(today + 2, man, "F0"))].includes("kiwi") && fruitsIn(menu.buildWeek(today + 1, man, "F0")).size >= 1);
prefs.setExclusions({ allergens: [...prefs.exclusions.allergens], foods: [...prefs.exclusions.foods].filter((f) => f !== "x_kiwi") }); menu.invalidateMenu();
unit("Samma kod: samma rätter för man och kvinna", JSON.stringify(hisWeek.plan) === JSON.stringify(herWeek.plan));
unit("Samma kod: portionerna anpassas efter personen", hisWeek.recipes[hisWeek.plan[0][1]].m.k !== herWeek.recipes[herWeek.plan[0][1]].m.k);
unit("Samma kod: samma träningspass", JSON.stringify(buildProgram("gym", [1, 3, 5]).schedule) === JSON.stringify(buildProgram("gym", [1, 3, 5]).schedule));
menu.setPlanRandomness(7, {}); menu.invalidateMenu();
unit("Annan kod: andra rätter", JSON.stringify(menu.buildWeek(today + 1, man, "F0").plan) !== JSON.stringify(hisWeek.plan));
menu.setPlanRandomness(0, {}); menu.invalidateMenu();

// Fastan
const fasting = await import("../public/js/fasting.js");
{
  const day = fasting.fastingDay({ planned: 7, first: null, last: null, yesterdayLast: null });
  const at0045 = fasting.fastingNow(day, 0.75, null);
  unit("Kl. 00:45 utan loggade tider: fastat 9 h 45 min sedan 15:00 i går, 6 h 15 min kvar", Math.abs(at0045.elapsed - 9.75) < 1e-9 && Math.abs(at0045.left - 6.25) < 1e-9 && at0045.state === "fasting");
  unit("Kl. 00:45 med gårdagens sista måltid 19:30: fastat 5 h 15 min", Math.abs(fasting.fastingNow(day, 0.75, 19.5).elapsed - 5.25) < 1e-9);
  unit("Kl. 06:59 utan loggade tider: fastan är nästan klar, aldrig över ett dygn", fasting.fastingNow(day, 6.99, null).elapsed < 16 && fasting.fastingNow(day, 6.99, null).elapsed > 15.9);
  unit("Kl. 10:00 är ätfönstret öppet, 5 h kvar", fasting.fastingNow(day, 10, null).state === "eating" && fasting.fastingNow(day, 10, null).left === 5);
  unit("Kl. 16:00 har fastan pågått 1 h", fasting.fastingNow(day, 16, null).elapsed === 1);
}
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
{
  // Varje modul måste finnas i service workerns lista, annars fungerar appen inte offline
  const sw = fs.readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
  const jsFiles = fs.readdirSync(new URL("../public/js", import.meta.url), { recursive: true }).filter((f) => String(f).endsWith(".js"));
  const missing = jsFiles.filter((f) => !sw.includes(`"./js/${String(f).replaceAll("\\", "/")}"`));
  const headers = fs.readFileSync(new URL("../public/_headers", import.meta.url), "utf8");
  check("Cloudflare skickar Cache-Control: no-cache för alla filer, så att ny HTML aldrig blandas med gamla moduler", /^\/\*\n\s+Cache-Control: no-cache/m.test(headers));
  check("Service workern hämtar filerna från servern, inte webbläsarens cache, när en ny version installeras", sw.includes('cache: "reload"'));
  check(`Alla ${jsFiles.length} JS-filer finns i sw.js (CORE)${missing.length ? ": saknas " + missing.join(", ") : ""}`, !missing.length);
}

check("Laddningsskärmen finns och döljs när appen har startat", !!win.document.querySelector(".loading-screen") && !win.document.documentElement.classList.contains("booting") && !win.document.documentElement.classList.contains("boot-failed"));

// Guiden första gången: villkor, dig, mål, träning, mat
const next = () => fire($("wz-next"), "click");
const typeIn = (id, value) => { $(id).value = value; fire($(id), "input"); };
check("Första gången startar guiden med villkoren och inget sparas", !$("wizard").hidden && win.localStorage.length === 0 && text("wz-progress") === "Steg 1 av 7" && text("wz-title") === "Innan du börjar");
check("Villkoren visas: rekommendationer, ExRx, localStorage, export, i befintligt skick", ["inte medicinsk rådgivning", "ExRx", "localStorage", "exportera", "befintligt skick"].every((t) => text("wz-terms").includes(t)));
check("Formuläret och importen visas inte förrän villkoren är godkända", $("wz-import").closest("[data-step]").hidden && $("age").closest("[data-step]").hidden);
const accept = (on = true) => { $("wz-accept").checked = on; fire($("wz-accept"), "change"); };
check("Kryssrutan ligger sist i villkorsrutan, efter texten", $("wz-accept").closest(".terms-scroll")?.lastElementChild === $("wz-accept").closest("label") && $("wz-terms").closest(".terms-scroll") === $("wz-accept").closest(".terms-scroll"));
check("Nästa är inaktiverad tills villkoren är godkända", $("wz-next").disabled);
next();
check("Utan kryss går det inte vidare", text("wz-progress") === "Steg 1 av 7");
fire($("wz-back"), "click"); check("Tillbaka på första steget gör inget", text("wz-progress") === "Steg 1 av 7");
accept(); check("Kryss aktiverar Nästa", !$("wz-next").disabled);
accept(false); check("Utan kryss igen är Nästa inaktiverad", $("wz-next").disabled);
accept(); next();
check("Nästa är aktiv på stegen efter villkoren", !$("wz-next").disabled);
check("Steg 2: import eller plankod på en egen sida, som går att hoppa över", text("wz-progress") === "Steg 2 av 7" && !$("wz-import").closest("[data-step]").hidden && !$("wz-code").closest("[data-step]").hidden && $("age").closest("[data-step]").hidden && text("wz-next") === "Hoppa över" && $("wz-body").hidden);
$("wz-code").value = "fel"; fire($("wz-code-go"), "click");
check("En felaktig plankod avvisas med förklaring", text("wz-code-msg").startsWith("Koden gick inte att läsa") && text("wz-next") === "Hoppa över");
next();
check("Steg 3: dig, utan import och plankod", text("wz-progress") === "Steg 3 av 7" && $("wz-import").closest("[data-step]").hidden && !$("age").closest("[data-step]").hidden);
check("Guiden kräver egna värden: exemplen är tömda och kön är inte valt", $("age").value === "" && $("weight").value === "" && !win.document.querySelector('input[name="sex"]:checked'));
next();
check("Nästa utan ifyllda fält stannar på steget och förklarar", text("wz-progress") === "Steg 3 av 7" && text("wz-msg").startsWith("Fyll i"));
win.document.querySelector('input[name="sex"][value="m"]').checked = true;
$("age").value = "40"; $("weight").value = "95"; $("height").value = "180";
next();
check("Steg 3: målet", text("wz-progress") === "Steg 4 av 7" && !$("goal").closest("[data-step]").hidden && $("age").closest("[data-step]").hidden);
check("BMI över 25: målvikten fylls i vid BMI 21,7, mitt i normalvikt (70,5 kg för 180 cm)", $("goal").value === "70,5");
check("Rutan visar BMI, uträkningen och att det är ett förslag", !$("goal-info").hidden && text("goal-info").includes("Ditt BMI är 29,3") && text("goal-info").includes("Rekommenderad målvikt: 70,5 kg") && text("goal-info").includes("mitt i normalviktsintervallet") && text("goal-info").includes("21,7 × 1,80² = 70,3 kg") && text("goal-info").includes("ifylld som förslag"));
check("Rutan visar en prognos med appens kalorimål", /Prognos: med appens kalorimål, [\d\s ]+ kcal per dag .* om ungefär \d+ veckor/.test(text("goal-info")));
check("Rutan säger att det är en rekommendation baserad på ExRx", text("goal-info").includes("rekommendation baserad på ExRx") && text("goal-info").includes("inte medicinsk rådgivning") && $("goal-info").querySelector('a[href="https://exrx.net/Calculators/BMI"]'));
typeIn("goal", "85");
check("Eget mål: inte längre markerat som förslag, prognosen räknas om", !text("goal-info").includes("ifylld som förslag") && text("goal-info").includes("når du 85,0 kg"));
fire($("wz-back"), "click"); next();
check("Ett eget mål skrivs inte över när man går tillbaka och fram", $("goal").value === "85");
typeIn("goal", "55");
check("Varnar för mål under BMI 18,5", text("goal-info").includes("under 18,5 (undervikt)"));
typeIn("goal", ""); next(); check("Målvikt krävs", text("wz-progress") === "Steg 4 av 7");
typeIn("goal", "85"); next();
check("Steg 4: träning, med gymdagar", text("wz-progress") === "Steg 5 av 7" && !$("tdays").closest("[data-step]").hidden);
next(); check("Steg 5: mat och allergier, inga förvalda", text("wz-progress") === "Steg 6 av 7" && text("wz-next") === "Nästa" && $("wz-allergens").querySelectorAll("input").length > 10 && !$("wz-allergens").querySelector(":checked"));
next();
check("Steg 6: Make it yours uppmanar till egna recept, loggning och rapport", text("wz-progress") === "Steg 7 av 7" && text("wz-title") === "Make it yours" && text("wz-next") === "Kom igång" && ["Egna recept", "Logga så mycket du kan", "Logg → Rapport", "personlig tränare, dietist eller läkare"].every((t) => text("wizard").includes(t)));
check("Fortfarande inget sparat innan Kom igång", win.localStorage.length === 0);
next();
check("Kom igång sparar profil och godkända villkor och stänger guiden", $("wizard").hidden && JSON.parse(win.localStorage.getItem("ffv")).weight === "95" && JSON.parse(win.localStorage.getItem("ffv-terms")).version === TERMS_VERSION && $("f").closest("[data-view]").dataset.view === "profil");
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
check("Inställningar visar en meny och inga undersidor", !$("installningar-meny").hidden && [...win.document.querySelectorAll("[data-page]")].every((p) => p.hidden));
go("sakerhetskopia"); check("En undersida öppnas via sitt namn och döljer menyn", visible() === "installningar" && $("installningar-meny").hidden && !$("backup").closest("[data-page]").hidden && !$("radera").closest("[data-page]").hidden && $("anpassa").closest("[data-page]").hidden);
go("tillskott"); check("En sektion öppnar sin undersida", !$("tillskott").closest("[data-page]").hidden && $("backup").closest("[data-page]").hidden);
check("Plankoden och säkerhetskopian ligger på samma undersida", $("plankod").closest("[data-page]") === $("backup").closest("[data-page]"));
check("Undersidor har en länk tillbaka till menyn", [...win.document.querySelectorAll("[data-page]")].every((p) => p.querySelector('.back-link[href="#installningar"]')));
check("Menyn länkar till varje undersida och till Om appen", [...win.document.querySelectorAll("[data-page]")].every((p) => $("installningar-meny").querySelector(`a[href="#${p.dataset.page}"]`)) && !!$("installningar-meny").querySelector('a[href="#om"]'));
for (const link of [...$("installningar-meny").querySelectorAll(".settings-menu a")]) {
  go("installningar");
  await new Promise((r) => setTimeout(r, 50)); // låt jsdoms egna hashchange från go() gå klart först
  link.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 50));
  const name = link.getAttribute("href").slice(1);
  const shown = name === "om" ? visible() === "om" : visible() === "installningar" && $("installningar-meny").hidden && ![...win.document.querySelectorAll("[data-page]")].find((p) => p.dataset.page === name).hidden;
  check(`Klick på ${link.querySelector("b").textContent} i menyn visar undersidan`, shown);
}
go("installningar"); check("Tillbaka till menyn", !$("installningar-meny").hidden && $("tillskott").closest("[data-page]").hidden);
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
check("Grafen visar planen hela vägen ner till målvikten", !!$("l-chart").querySelector(".plan-end") && /målvikten ca \d{4}-\d{2}-\d{2}/.test(text("l-key")));
const planLine = $("l-chart").querySelector(".plan"), planEnd = $("l-chart").querySelector(".plan-end");
check("Planlinjen slutar vid målvikten", Math.abs(Number(planLine.getAttribute("x2")) - Number(planEnd.getAttribute("cx"))) < 0.01 && Math.abs(Number(planLine.getAttribute("y2")) - Number(planEnd.getAttribute("cy"))) < 0.01);
// Kondition: aktivitet, distans och tid per pass, flera pass per dag, tempo per aktivitet
$("l-date").value = "2026-10-02"; fire($("l-date"), "input");
const cardioRows = () => [...$("l-cardio").querySelectorAll(".cardio-row")];
const setRow = (row, a, dist, t, unit = "km") => { row.querySelector("[data-c-a]").value = a; row.querySelector("[data-c-unit]").value = unit; row.querySelector("[data-c-dist]").value = dist; row.querySelector("[data-c-time]").value = t; };
check("Formuläret har en tom konditionsrad med aktivitet, distans och tid", cardioRows().length === 1 && cardioRows()[0].querySelector("[data-c-a]") && cardioRows()[0].querySelector("[data-c-dist]") && cardioRows()[0].querySelector("[data-c-time]"));
setRow(cardioRows()[0], "rodd", "2", "9:30");
fire($("l-cardio-add"), "click"); setRow(cardioRows()[1], "lopning", "1,14", "8:57");
cardioRows()[1].querySelector("[data-c-hrmax]").value = "171";
fire($("l-cardio-add"), "click"); setRow(cardioRows()[2], "lopning", "1.0", "5:23");
fire($("logf"), "submit");
const cardioEntry = JSON.parse(win.localStorage.getItem("ffv-log")).entries.find((e) => e.date === "2026-10-02");
check("Flera pass sparas med aktivitet, distans och tid", cardioEntry?.cardio.length === 3 && cardioEntry.cardio[1].a === "lopning" && cardioEntry.cardio[1].km === 1.14 && cardioEntry.cardio[1].s === 537);
check("Tabellen visar pass med tempo per aktivitet", text("l-table").includes("Löpning 1,14 km på 00:08:57 (7:51/km)") && text("l-table").includes("Rodd 2 km på 00:09:30 (2:23/500 m)"));
check("Maxpuls sparas per pass och visas, ingen snittpuls", cardioEntry.cardio[1].hrMax === 171 && !("hrAvg" in cardioEntry.cardio[1]) && text("l-table").includes("maxpuls 171") && cardioEntry.cardio[0].hrMax === null && !cardioRows()[0].querySelector("[data-c-hr]"));
const timeInput = cardioRows()[0].querySelector("[data-c-time]");
timeInput.value = "010530"; fire(timeInput, "input");
check("Tid skriven som siffror blir hh:mm:ss", timeInput.value === "01:05:30" && timeInput.placeholder === "hh:mm:ss");
timeInput.value = "8:57"; fire(timeInput, "input"); fire(timeInput, "change");
check("8:57 betyder 8 min 57 s och skrivs ut som 00:08:57", timeInput.value === "00:08:57" && timeInput.validity.valid);
timeInput.value = "8:5x"; fire(timeInput, "input"); fire(timeInput, "change");
check("Ogiltig tid markeras som fel", !timeInput.validity.valid);
timeInput.value = ""; fire(timeInput, "input");

// Intensitetsminuter: måttliga + 2 × höga, följs upp per 7 dagar mot WHO:s 150
$("l-date").value = todayStr(); fire($("l-date"), "input");
$("l-im-mod").value = "47"; fire($("l-im-mod"), "input");
$("l-im-vig").value = "50"; fire($("l-im-vig"), "input");
check("Totalen räknas medan man skriver: 47 + 2 × 50 = 147", text("l-im-total").startsWith("= 147 intensitetsminuter"));
const weightToday = JSON.parse(win.localStorage.getItem("ffv-log")).entries.find((e) => e.date === todayStr())?.weight;
fire($("logf"), "submit");
const todayEntry = JSON.parse(win.localStorage.getItem("ffv-log")).entries.find((e) => e.date === todayStr());
check("Intensitetsminuterna sparas och dagens vikt ligger kvar", todayEntry.imMod === 47 && todayEntry.imVig === 50 && (todayEntry.weight ?? null) === (weightToday ?? null));
check("Rutan visar intensitetsminuterna för 7 dagar mot WHO:s 150", text("l-tiles").includes("Intensitetsminuter, 7 dagar") && text("l-tiles").includes("147") && text("l-tiles").includes("3 min kvar till WHO:s rekommendation"));
check("Tabellen visar dagens intensitetsminuter", text("l-table").includes("Intensitetsminuter 147 (måttliga 47 + 2 × höga 50)"));

// Distans i meter: räknas om till km, visas i meter, och nästa rad får samma enhet
setRow(cardioRows()[0], "lopning", "1122", "5:23", "m");
fire($("logf"), "submit");
const meterPass = JSON.parse(win.localStorage.getItem("ffv-log")).entries.find((e) => e.date === todayStr()).cardio[0];
check("1122 m sparas som 1,122 km och kommer ihåg att det var meter", meterPass.km === 1.122 && meterPass.u === "m");
check("Passet visas i meter med tempo per km", text("l-table").includes("Löpning 1 122 m på 00:05:23 (4:48/km)"));
fire($("l-cardio-add"), "click");
check("En ny rad får samma enhet som raden ovanför", cardioRows()[1].querySelector("[data-c-unit]").value === "m");
$("l-date").value = "2026-08-17"; fire($("l-date"), "input");
check("En ny dag börjar med den senast använda enheten", cardioRows()[0].querySelector("[data-c-unit]").value === "m");
$("l-date").value = todayStr(); fire($("l-date"), "input");
check("Ändra en dag visar passet i meter igen", cardioRows()[0].querySelector("[data-c-dist]").value === "1122" && cardioRows()[0].querySelector("[data-c-unit]").value === "m");
check("Kondition jämförs på tempo för den vanligaste aktiviteten", text("l-tiles").includes("Kondition: löpning") && /Kondition:löpning(5:23|4:48)\/km/.test(text("l-tiles").replace(/\s/g, "")) && text("l-tiles").includes("Snabbare än första (7:51/km)"));
$("l-date").value = "2026-08-15"; fire($("l-date"), "input");
setRow(cardioRows()[0], "cykel", "10", "");
fire($("logf"), "submit");
check("Ett pass utan tid sparas inte och förklaras", text("l-msg").startsWith("Fyll i både distans och tid") && !JSON.parse(win.localStorage.getItem("ffv-log")).entries.some((e) => e.date === "2026-08-15"));
fire($("l-cardio-add"), "click"); fire(cardioRows()[1].querySelector("[data-c-remove]"), "click");
check("En rad går att ta bort", cardioRows().length === 1);
$("l-date").value = "2026-10-02"; fire($("l-date"), "input");
check("Ändra en dag fyller i dess pass igen", cardioRows().length === 3 && cardioRows()[1].querySelector("[data-c-dist]").value === "1,14" && cardioRows()[1].querySelector("[data-c-time]").value === "00:08:57");

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
check("Måltidstiden sparas i loggen, med uträknad sista måltid", $("l-table").textContent.includes("12:00–20:00"));
$("l-date").value = todayStr(); $("l-weight").value = "93.8"; fire($("logf"), "submit");
check("Loggformuläret behåller måltidstiden", $("l-table").textContent.includes("12:00–20:00"));
fire($("fs-reset"), "click");
check("Tillbaka till planens tider", text("fs-plan").includes("Ätfönster 07:00") && $("fs-reset").hidden);

// Eget frukostrecept via Inställningar
go("mina-recept");
$("mr-name").value = "Kvarg med havre";
const rows = $("mr-items").querySelectorAll(".mr-item");
rows[0].querySelector("[data-mr-food]").value = "kvarg"; rows[0].querySelector("[data-mr-qty]").value = "200";
rows[1].querySelector("[data-mr-food]").value = "havre"; rows[1].querySelector("[data-mr-qty]").value = "40";
fire($("mr-items"), "input");
check("Receptformuläret visar kcal och protein", text("mr-sum").includes("kcal"));
fire($("mr"), "submit");
const ownOption = [...$("bmeal").options].find((o) => o.textContent.includes("Kvarg med havre"));
check("Eget recept sparas och blir ett frukostval", text("mr-list").includes("Kvarg med havre") && !!ownOption);
$("bmeal").value = ownOption.value; fire($("f"), "change");
check("Eget frukostrecept visas på Idag och i inköpslistan", [...$("td-food").querySelectorAll("summary b")][0].textContent === "Kvarg med havre" && !!$("shop").querySelector('[data-shop="havre"]'));

// Eget recept med hushållsmått och en egen ingrediens: allt ska med i inköpslistan
$("mr-name").value = "Omelett med parmesan";
$("mr-items").innerHTML = "";
for (let i = 0; i < 3; i++) fire($("mr-add"), "click");
{
  const [white, egg, own] = $("mr-items").querySelectorAll(".mr-item");
  const pick = (row, food) => { row.querySelector("[data-mr-food]").value = food; fire(row.querySelector("[data-mr-food]"), "change"); };
  pick(white, "aggvita"); white.querySelector("[data-mr-unit]").value = "dl"; white.querySelector("[data-mr-qty]").value = "2";
  pick(egg, "agg"); egg.querySelector("[data-mr-qty]").value = "2";
  const select = own.querySelector("[data-mr-food]");
  pick(own, select.options[select.options.length - 1].value); // Egen ingrediens
  own.querySelector("[data-mr-name]").value = "Parmesanost"; own.querySelector("[data-mr-qty]").value = "2"; own.querySelector("[data-mr-unit]").value = "msk";
}
fire($("mr"), "submit");
const omelettOption = [...$("bmeal").options].find((o) => o.textContent.includes("Omelett med parmesan"));
$("bmeal").value = omelettOption.value; fire($("f"), "change");
check("Äggvita i dl från ett eget recept finns i inköpslistan", !!$("shop").querySelector('[data-shop="aggvita"]'));
check("En egen ingrediens från ett eget recept finns i inköpslistan, med mängden för veckan", /14 msk/.test($("shop").querySelector('[data-shop="x:parmesanost"]')?.closest(".shop-item")?.textContent || ""));
{
  const box = $("shop").querySelector('[data-shop="x:parmesanost"]');
  if (box) { box.checked = true; fire(box, "change"); }
  fire($("f"), "change");
  check("En egen ingrediens går att bocka av och förblir avbockad", !!$("shop").querySelector('[data-shop="x:parmesanost"]')?.checked);
}
$("bmeal").value = ownOption.value; fire($("f"), "change");

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
mrRow.querySelector("[data-mr-qty]").value = "150,5"; fire(mrRow.querySelector("[data-mr-qty]"), "input");
check("Gram i egna recept tar komma", text("mr-sum").length > 0 && mrRow.querySelector("[data-mr-qty]").validity.valid);
mrRow.remove(); fire($("mr-items"), "input");

// Om appen och villkoren
go("om");
check("Om appen är en egen sida", visible() === "om" && text("om").includes("ExRx") && text("om").includes("rekommendationer"));
check("Om appen länkar till GitHub-repot och MIT-licensen", !!$("om").querySelector('a[href="https://github.com/zolodev/MyNutrition"]') && text("om").includes("MIT-licensen") && !!$("om").querySelector('a[href$="/LICENSE"]'));
go("villkor");
check("Ingen koppling till Claude någonstans i appen", !win.document.documentElement.innerHTML.toLowerCase().includes("claude"));
check("Villkoren förklarar hur man drar tillbaka godkännandet och att appen inte har någon koppling till ExRx", text("terms-text").includes("Dra tillbaka ditt godkännande") && text("terms-text").includes("Inställningar → Säkerhetskopia och delning → Radera all data") && text("terms-text").includes("Varken appen eller utvecklaren är anknuten till"));
check("Inställningar har Radera all data", $("erase-all").closest("[data-view]").dataset.view === "installningar");
check("Villkoren säger att appen kan innehålla fel och är ett hobbyprojekt", text("terms-text").includes("Appen kan innehålla fel") && text("terms-text").includes("personligt hobbyprojekt"));
check("Villkoren går att läsa igen och är samma text som i guiden", visible() === "om" && text("villkor").includes("befintligt skick") && text("terms-text") === text("wz-terms"));
check("Varje flik har en rad om rekommendationer och länk till villkoren", !!win.document.querySelector('.app-note a[href="#villkor"]') && !win.document.querySelector(".app-note").closest("[data-view]"));
go("installningar");
check("Inställningar länkar till Om appen", !!$("installningar-meny").querySelector('a[href="#om"]'));

// Inköpslistan: det man bockat av gäller i alla veckor tills man själv bockar ur det
go("inkop");
const shopFoods = () => new Set([...win.document.querySelectorAll("[data-shop]")].map((el) => el.dataset.shop));
const thisWeek = shopFoods();
fire($("wk-next"), "click");
const shared = [...shopFoods()].find((f) => thisWeek.has(f));
fire($("wk-prev"), "click");
const shopBox = () => win.document.querySelector(`[data-shop="${shared}"]`);
shopBox().checked = true; fire(shopBox(), "change");
check("Avbockning sparas i den gemensamma listan", JSON.parse(win.localStorage.getItem("ffv-shop")).includes(shared) && !Object.keys(win.localStorage).some((k) => /^ffv-shop-\d+$/.test(k)));
fire($("wk-next"), "click");
check("Avbockad vara är avbockad även nästa vecka", shopBox().checked && shopBox().closest(".shop-item").classList.contains("done"));
shopBox().checked = false; fire(shopBox(), "change");
fire($("wk-prev"), "click");
check("Bockar man ur den gäller det alla veckor", !shopBox().checked && !JSON.parse(win.localStorage.getItem("ffv-shop")).includes(shared));
shopBox().checked = true; fire(shopBox(), "change");
fire($("shop-clear"), "click"); await tick();
check("Avmarkera alla frågar först, eftersom det gäller alla veckor", $("confirm").hasAttribute("open") && text("confirm-detail").includes("alla veckor"));
await answer(false);
check("Nej behåller avbockningarna", shopBox().checked);
fire($("shop-clear"), "click"); await tick(); await answer(true);
check("Ja avmarkerar allt", !win.document.querySelector("[data-shop]:checked") && JSON.parse(win.localStorage.getItem("ffv-shop")).length === 0);

// Svenska format: 24-timmarsklocka och datum som ÅÅÅÅ-MM-DD
check("Inga inbyggda tidsfält (de visar AM/PM i engelska webbläsare)", !win.document.querySelector('input[type="time"], input[type="date"], input[type="datetime-local"]'));
go("fastan");
$("fs-first").value = "730"; fire($("fs-first"), "input"); fire($("fs-first"), "change");
check("Klockslag skrivs som HH:MM: 730 blir 07:30", $("fs-first").value === "07:30");
$("fs-last").value = "1945"; fire($("fs-last"), "input");
check("1945 blir 19:45 medan man skriver", $("fs-last").value === "19:45");
fire($("fs-last"), "change");
check("Måltidstiderna sparas i 24-timmarsformat", JSON.parse(win.localStorage.getItem("ffv-log")).entries.some((e) => e.firstMeal === "07:30" && e.lastMeal === "19:45"));
$("fs-last").value = "2500"; fire($("fs-last"), "input"); fire($("fs-last"), "change");
check("Ogiltigt klockslag sparas inte", !$("fs-last").validity.valid && JSON.parse(win.localStorage.getItem("ffv-log")).entries.some((e) => e.lastMeal === "19:45"));
$("fs-last").value = "19:45"; fire($("fs-last"), "input"); fire($("fs-last"), "change");
check("Veckans datum visas som ÅÅÅÅ-MM-DD", /^\d{4}-\d{2}-\d{2} – \d{4}-\d{2}-\d{2}/.test(text("wk-range")));
check("Prognosen visar datum som ÅÅÅÅ-MM-DD", /\(\d{4}-\d{2}-\d{2}\)/.test(text("goal-info")) && /\(\d{4}-\d{2}-\d{2}\)/.test(text("projection")));
check("Ingen region skrivs ut (säsongen gäller hela Sverige)", !/norrland/i.test(win.document.body.textContent));
{
  // iPhone zoomar in i fält med mindre text än 16 px: inga fält får ha mindre, och pekskärmar har ett skydd
  const css = fs.readFileSync(new URL("../public/css/app.css", import.meta.url), "utf8");
  const small = [...css.matchAll(/([^{}]*(?:input|select|textarea|backup-text)[^{}]*)\{[^}]*font-size:\s*0\.\d+rem/g)].map((m) => m[1].trim());
  check("Inga textfält har mindre text än 16 px (iPhone zoomar annars in)", small.length === 0);
  check("Pekskärmar har minst 16 px i alla fält", /@media \(pointer: coarse\)[^@]*max\(1rem, 16px\) !important/.test(css));
}
check("Inga AM/PM någonstans", !/\b(AM|PM)\b/.test(win.document.body.textContent));
fire($("fs-reset"), "click");

// Fastan i dag: sista måltiden räknas ut från den första, men en egen tid behålls
const setClock = (id, v) => { $(id).value = v; fire($(id), "input"); fire($(id), "change"); };
setClock("fs-first", "0800");
const mealsToday = () => JSON.parse(win.localStorage.getItem("ffv-log")).entries.find((e) => e.date === todayStr());
check("Första måltiden fyller i sista måltiden 8 h senare och loggar båda", $("fs-last").value === "16:00" && mealsToday().firstMeal === "08:00" && mealsToday().lastMeal === "16:00");
check("Hjälptexten säger att tiden är uträknad och kan ändras", text("fs-last-hint").startsWith("Uträknad: 8 h efter första måltiden"));
setClock("fs-first", "0900");
check("Ändras första måltiden räknas en uträknad sista måltid om", $("fs-last").value === "17:00" && mealsToday().lastMeal === "17:00");
setClock("fs-last", "1830");
check("En egen sista måltid loggas", mealsToday().lastMeal === "18:30" && text("fs-last-hint") === "Loggad");
setClock("fs-first", "0930");
check("En egen sista måltid skrivs inte över när första måltiden ändras", $("fs-last").value === "18:30" && mealsToday().firstMeal === "09:30" && mealsToday().lastMeal === "18:30");
fire($("fs-reset"), "click");

// Egna ord att välja bort, t.ex. lax som inte finns i listan
go("anpassa");
$("ex-word").value = " Lax "; fire($("ex-word-form"), "submit");
check("Ett eget ord sparas bland bortvalen", JSON.parse(win.localStorage.getItem("ffv-excl")).words.includes("lax"));
check("Ordet visar vilka livsmedel det träffar", text("ex-words").includes("lax") && text("ex-words").includes("Laxfilé"));
$("mf-name").value = "Varmrökt lax"; $("mf-k").value = "190"; fire($("mf"), "submit");
check("Ordet stoppar också egna livsmedel med samma ord", text("mf-list").includes("Varmrökt lax") && text("mf-list").includes("Bortvald av dina allergival"));
$("ex-word").value = "koriander"; fire($("ex-word-form"), "submit");
check("Ett ord som inte träffar något säger det", text("ex-words").includes("koriander träffar inget livsmedel än"));
fire($("ex-words").querySelector('[data-word-del="koriander"]'), "click");
fire($("ex-words").querySelector('[data-word-del="lax"]'), "click");
check("Ord går att ta bort", !text("ex-words").includes("lax") && JSON.parse(win.localStorage.getItem("ffv-excl")).words.length === 0); // Varmrökt lax är fortfarande bortvald av fiskallergin från ett tidigare test
fire([...$("mf-list").querySelectorAll(".my-food")].find((r) => r.textContent.includes("Varmrökt lax")).querySelector("[data-mfdel]"), "click"); await tick(); await answer(true);

// Tillskott: kasein och egna tillskott
go("tillskott");
const casein = win.document.querySelector('[data-supp="casein"]');
check("Kasein finns bland tillskotten", !!casein);
casein.checked = true; fire(casein, "change");
check("Kasein får ett tips med eftermiddagsmåltiden, inte före sängen", text("td-supps").includes("Kasein") && text("td-supps").includes("Ta det inte före sängen, då bryter det fastan"));
$("ms-name").value = "BCAA"; $("ms-dose").value = "5 g"; $("ms-when").value = "breakfast"; fire($("ms-when"), "change"); $("ms-kcal").checked = true;
fire($("ms-form"), "submit");
check("Eget tillskott sparas och visas i listan", JSON.parse(win.localStorage.getItem("ffv-mysupps"))[0]?.n === "BCAA" && text("ms-list").includes("BCAA") && text("ms-list").includes("5 g"));
check("Eget tillskott med frukosten får ett tips på Idag inom ätfönstret", text("td-supps").includes("BCAA") && text("td-supps").includes("5 g. Med frukosten. Innehåller kalorier eller aminosyror: räkna in det"));
$("ms-name").value = "Magnesium"; $("ms-when").value = "clock"; fire($("ms-when"), "change");
check("Eget klockslag visar fältet för klockslag", !$("ms-at-field").hidden);
fire($("ms-form"), "submit");
check("Utan klockslag sparas det inte", text("ms-msg").startsWith("Fyll i namn och klockslag") && JSON.parse(win.localStorage.getItem("ffv-mysupps")).length === 1);
$("ms-name").value = "Proteinbar"; $("ms-at").value = "22:00"; $("ms-kcal").checked = true; fire($("ms-form"), "submit");
check("Ett tillskott med kalorier utanför ätfönstret varnar för fastan", text("td-supps").includes("22:00 Proteinbar") && text("td-supps").includes("utanför ätfönstret, så det bryter fastan"));
fire($("ms-list").querySelector("[data-msdel]"), "click"); await tick(); await answer(true);
check("Ett eget tillskott tas bort efter bekräftelse", !text("ms-list").includes("BCAA") && JSON.parse(win.localStorage.getItem("ffv-mysupps")).length === 1);

// Installera appen: banner med Ja/Nej, knapp under Inställningar, webbläsarens egen fråga när den finns
check("Bannern frågar om appen ska installeras lokalt", !$("install-banner").hidden && text("install-banner").includes("Vill du installera appen lokalt?") && text("install-accept") === "Ja, installera" && text("install-decline") === "Nej, visa inte igen");
check("Inställningar har Installera appen lokalt", !$("install-settings").hidden && $("install-settings").closest("[data-view]").dataset.view === "installningar");
fire($("install-settings"), "click"); await tick();
check("Utan webbläsarens egen fråga visas hur man installerar, med en OK-knapp", $("confirm").hasAttribute("open") && text("confirm-text") === "Installera appen lokalt" && text("confirm-detail").length > 20 && $("confirm").querySelector('[data-answer="no"]').hidden && $("confirm").querySelector('[data-answer="yes"]').textContent === "OK");
fire($("confirm").querySelector('[data-answer="yes"]'), "click"); await tick();
fire($("install-decline"), "click");
check("Nej, visa inte igen döljer bannern och sparas", $("install-banner").hidden && win.localStorage.getItem("ffv-install-declined") === "true");
let prompted = 0;
const bip = new win.Event("beforeinstallprompt");
Object.assign(bip, { prompt: () => prompted++, userChoice: Promise.resolve({ outcome: "accepted" }) });
win.dispatchEvent(bip);
check("Webbläsarens egen fråga: knappen i sidhuvudet visas, bannern förblir dold efter Nej", !$("install").hidden && $("install-banner").hidden);
fire($("install-settings"), "click"); await tick();
check("Knappen under Inställningar öppnar webbläsarens egen fråga", prompted === 1 && !$("confirm").hasAttribute("open"));
$("shop-clear").hidden = false; fire($("shop-clear"), "click"); await tick();
check("Bekräftelsedialogen har Ja och Nej igen nästa gång", !$("confirm").querySelector('[data-answer="no"]').hidden && $("confirm").querySelector('[data-answer="no"]').textContent === "Nej" && $("confirm").querySelector('[data-answer="yes"]').textContent === "Ja");
fire($("confirm").querySelector('[data-answer="no"]'), "click"); await tick();

// Dagens vikt överst på Idag, under dagens information och ovanför fastan
go("idag");
const sectionsToday = [...win.document.querySelectorAll('[data-view="idag"] > section')].map((x) => x.id);
check("Dagens vikt ligger under dagens information och ovanför Periodisk fasta", sectionsToday.indexOf("dagens-vikt") === sectionsToday.indexOf("idag") + 1 && sectionsToday.indexOf("fastan") === sectionsToday.indexOf("dagens-vikt") + 1);
const beforeQuick = JSON.parse(win.localStorage.getItem("ffv-log")).entries.find((e) => e.date === todayStr());
$("qw-weight").value = "93,4"; fire($("qw-form"), "submit");
const afterQuick = JSON.parse(win.localStorage.getItem("ffv-log")).entries.find((e) => e.date === todayStr());
check("Dagens vikt sparas på dagens datum", afterQuick.weight === 93.4 && text("qw-msg").startsWith("Loggad i dag: 93,4 kg"));
check("Det som redan var loggat i dag ligger kvar", (beforeQuick?.imMod ?? null) === afterQuick.imMod && JSON.stringify(beforeQuick?.cardio ?? []) === JSON.stringify(afterQuick.cardio));
$("qw-weight").value = "abc"; fire($("qw-weight"), "input"); fire($("qw-form"), "submit");
check("En felaktig vikt sparas inte", JSON.parse(win.localStorage.getItem("ffv-log")).entries.find((e) => e.date === todayStr()).weight === 93.4);

// Rapport: sammanställning av allt loggat, att skriva ut eller spara som PDF
go("logg");
check("Logg länkar till rapporten", !!$("logg").querySelector('a[href="#rapport"]'));
go("rapport");
check("Rapporten är en egen sida och Logg är markerad i menyn", visible() === "rapport" && win.document.querySelector('a[data-tab="logg"]').getAttribute("aria-current") === "page");
check("Rapporten sammanfattar vikt, förändring, midja, BMI, mål, mående, kondition och intensitetsminuter", ["Startvikt", "Nu, 7-dagarssnitt", "Förändring", "Midja", "BMI", "Målvikt", "Mående", "Konditionspass", "Intensitetsminuter"].every((t) => text("rp-tiles").includes(t)));
check("Rapporten visar perioden och antal loggade dagar", /\d{4}-\d{2}-\d{2} – \d{4}-\d{2}-\d{2} · \d+ loggade dagar/.test(text("rp-period-text")));
check("Vecka för vecka har rader med veckonummer", $("rp-weeks").querySelectorAll("tbody tr").length >= 1 && /v\. \d+/.test(text("rp-weeks")));
check("Kondition per aktivitet med tempo och maxpuls", text("rp-cardio").includes("Löpning") && text("rp-cardio").includes("/km") && text("rp-cardio").includes("Högsta maxpuls"));
check("Profil och plan finns med", text("rp-profile").includes("Kalorimål") && text("rp-profile").includes("Makron per dag"));
check("Alla loggade dagar finns med", $("rp-days").querySelectorAll("tbody tr").length === JSON.parse(win.localStorage.getItem("ffv-log")).entries.length);
check("Rapporten säger att det är rekommendationer och egenrapporterat", text("rp-foot").includes("inte medicinsk rådgivning") && text("rp-foot").includes("egenrapporterade"));
const allDays = $("rp-days").querySelectorAll("tbody tr").length;
$("rp-period").value = "28"; fire($("rp-period"), "change");
check("Kortare period visar färre eller lika många dagar", $("rp-days").querySelectorAll("tbody tr").length <= allDays);
$("rp-period").value = "all"; fire($("rp-period"), "change");
let printed = 0; win.print = () => printed++;
fire($("rp-print"), "click");
check("Skriv ut eller spara som PDF startar utskriften", printed === 1);

// Eget recept med hushållsmått och egna ingredienser (proteinrik fettsnål omelett)
go("mina-recept");
const addRow = (food, qty, unit, name) => {
  fire($("mr-add"), "click");
  const row = $("mr-items").lastElementChild;
  row.querySelector("[data-mr-food]").value = food; fire(row.querySelector("[data-mr-food]"), "change");
  if (name) row.querySelector("[data-mr-name]").value = name;
  row.querySelector("[data-mr-qty]").value = qty;
  if (unit) row.querySelector("[data-mr-unit]").value = unit;
  fire(row.querySelector("[data-mr-qty]"), "input");
  return row;
};
$("mr-items").innerHTML = "";
$("mr-name").value = "Proteinrik fettsnål omelett"; $("mr-type").value = "b";
const eggRow = addRow("agg", "2");
check("Ägg får måttet st förvalt", eggRow.querySelector("[data-mr-unit]").value === "st");
addRow("aggvita", "1,5", "dl"); addRow("mjolk", "4", "msk"); addRow("ost", "0,75", "dl");
const chickenRow = addRow("kyckling", "");
check("Kycklingfilé kan bara anges i g eller kg", [...chickenRow.querySelectorAll("[data-mr-unit] option")].map((o) => o.value).join() === "g,kg");
chickenRow.remove();
const saltRow = addRow("__own", "1", "krm", "Salt");
check("Egen ingrediens visar ett namnfält och alla mått", !saltRow.querySelector("[data-mr-name]").hidden && saltRow.querySelectorAll("[data-mr-unit] option").length === 9);
addRow("__own", "1", "krm", "Peppar");
fire($("mr"), "submit");
const omelett = JSON.parse(win.localStorage.getItem("ffv-myrecipes")).find((r) => r.t === "Proteinrik fettsnål omelett");
check("Receptet sparas med gram och dina mått", omelett && JSON.stringify(omelett.items) === JSON.stringify([["agg", 120, 2, "st"], ["aggvita", 155, 1.5, "dl"], ["mjolk", 62, 4, "msk"], ["ost", 30, 0.75, "dl"]]));
check("Salt och peppar sparas som egna ingredienser", JSON.stringify(omelett.extra) === JSON.stringify([{ n: "Salt", q: 1, u: "krm" }, { n: "Peppar", q: 1, u: "krm" }]));
const breakfastBefore = $("bmeal").value;
$("bmeal").value = omelett.id; fire($("f"), "change");
const omelettText = text("td-food");
check("Receptet visas med dina mått, skalade efter kalorimålet", / st \(\d+ g\)/.test(omelettText) && / dl \(\d+ g\)/.test(omelettText) && / msk \(\d+ g\)/.test(omelettText));
check("Egna ingredienser visas i receptet", omelettText.includes("Salt") && omelettText.includes("1 krm") && omelettText.includes("Peppar"));
check("Listan visar ingredienserna i dina mått", text("mr-list").includes("Ägg 2 st") && text("mr-list").includes("Äggvita, flytande 1,5 dl") && text("mr-list").includes("Salt 1 krm"));
check("Så gör du-rutan är högre", Number($("mr-how").getAttribute("rows")) >= 8);

// Ändra ett eget recept i efterhand
const omelettRow = () => [...$("mr-list").querySelectorAll(".row")].find((r) => r.querySelector("b")?.textContent === "Proteinrik fettsnål omelett");
fire(omelettRow().querySelector("[data-mredit]"), "click");
const formRows = [...$("mr-items").querySelectorAll(".mr-item")];
check("Ändra fyller formuläret med receptet, i dina mått", $("mr-name").value === "Proteinrik fettsnål omelett" && $("mr-type").value === "b" && formRows.length === 6 &&
  formRows[0].querySelector("[data-mr-qty]").value === "2" && formRows[0].querySelector("[data-mr-unit]").value === "st" &&
  formRows[1].querySelector("[data-mr-qty]").value === "1,5" && formRows[1].querySelector("[data-mr-unit]").value === "dl" &&
  formRows[4].querySelector("[data-mr-name]").value === "Salt" && !formRows[4].querySelector("[data-mr-name]").hidden && text("mr-save") === "Spara ändringar" && !$("mr-cancel").hidden);
formRows[0].querySelector("[data-mr-qty]").value = "3"; $("mr-how").value = "Vispa allt och stek på medelvärme. " + "Långt steg. ".repeat(400);
fire($("mr"), "submit");
const edited = JSON.parse(win.localStorage.getItem("ffv-myrecipes")).filter((r) => r.t === "Proteinrik fettsnål omelett");
check("Ändringen sparas på samma recept, utan kopia", edited.length === 1 && edited[0].id === omelett.id && JSON.stringify(edited[0].items[0]) === JSON.stringify(["agg", 180, 3, "st"]) && edited[0].how.startsWith("Vispa allt och stek på medelvärme.") && edited[0].how.length > 4000 && !$("mr-how").hasAttribute("maxlength") && text("mr-msg").startsWith("Ändringarna i"));
check("Ett ändrat frukostrecept är fortfarande valt som frukost", $("bmeal").value === omelett.id && text("td-food").includes("Vispa allt och stek"));
check("Efter sparandet går formuläret tillbaka till nytt recept", text("mr-save") === "Spara recept" && $("mr-cancel").hidden && $("mr-name").value === "");
fire(omelettRow().querySelector("[data-mredit]"), "click"); fire($("mr-cancel"), "click");
fire($("l-copy"), "click"); await tick();
check("En lång beskrivning följer med i exporten", JSON.parse($("l-copytext").value).data["ffv-myrecipes"].find((r) => r.t === "Proteinrik fettsnål omelett").how.length > 4000);
check("Avbryt tömmer formuläret utan att ändra något", $("mr-name").value === "" && text("mr-save") === "Spara recept" && JSON.parse(win.localStorage.getItem("ffv-myrecipes")).filter((r) => r.t === "Proteinrik fettsnål omelett").length === 1);
$("bmeal").value = breakfastBefore; fire($("f"), "change");
fire(omelettRow().querySelector("[data-mrdel]"), "click"); await tick(); await answer(true);

// Rensa mina uppgifter: bekräfta, guiden startar igen, loggen finns kvar
const logBefore = win.localStorage.getItem("ffv-log");
go("profil"); fire($("clear"), "click");
check("Rensa frågar först", $("confirm").hasAttribute("open"));
await answer(true);
check("Rensa öppnar guiden och tar bort profilen", !$("wizard").hidden && win.localStorage.getItem("ffv") == null && win.localStorage.getItem("ffv-log") === logBefore);
accept(); next();
$("wz-code").value = "00ABCD-H1A0"; fire($("wz-code-go"), "click");
check("En plankod i guiden fyller i utrustning och gymdagar och ger Nästa i stället för Hoppa över", text("wz-code-msg").startsWith("Koden är inläst") && win.document.querySelector('input[name="eq"]:checked').value === "db" && text("wz-next") === "Nästa");
next();
win.document.querySelector('input[name="sex"][value="m"]').checked = true;
$("age").value = "41"; $("weight").value = "92"; $("height").value = "180"; next(); $("goal").value = "84"; next(); next(); next(); next();
check("Plankoden från guiden sparas när guiden är klar", text("pc-code").replace(" ", "").startsWith("00ABCD-H1A0") && JSON.parse(win.localStorage.getItem("ffv")).eq === "db");
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
go("backup"); fire($("l-copy"), "click"); await tick();
check("Export och import ligger under Inställningar", visible() === "installningar" && $("l-export").closest("section").id === "backup" && $("backup").closest("[data-page]").dataset.page === "sakerhetskopia" && !$("backup").closest("[data-page]").hidden);
check("Logg länkar till exporten under Inställningar", !!$("logg").closest("[data-view]").querySelector('a[href="#backup"]'));
const exportedText = $("l-copytext").value;
const exportedData = JSON.parse(exportedText).data;
check("Kopiera allt visar texten när urklipp nekas", !$("l-copytext").hidden && text("backup-msg").startsWith("Kopieringen nekades"));
check("Exporten innehåller profil, logg, plan, allergier och tillskott", ["ffv", "ffv-log", "ffv-seed", "ffv-excl"].every((k) => k in exportedData) && exportedData["ffv-log"].entries.length > 0 && exportedData.ffv.weight === "92");
check("Exporten innehåller allt sparat utom det som bara gäller enheten", Object.keys(win.localStorage).filter((k) => k.startsWith("ffv") && k !== "ffv-swipe-hint" && k !== "ffv-install-declined" && k !== "ffv-terms").every((k) => k in exportedData) && !("ffv-swipe-hint" in exportedData));
// Gymdagarna följer med i exporten, både som data och läsbart i översikten
go("profil");
for (const d of ["0", "1", "2", "3", "4", "5", "6"]) { const el = win.document.querySelector(`[data-day="${d}"]`); el.checked = ["1", "3", "5"].includes(d); }
fire($("tdays"), "change");
fire($("l-copy"), "click"); await tick();
const withDays = JSON.parse($("l-copytext").value);
check("Valda gymdagar (tis, tor, lör) finns i exporten", withDays.data.ffv["tdays-val"] === "1,3,5" && withDays.oversikt.Gymdagar === "tisdag, torsdag, lördag");
check("Exportens översikt visar profilen i klartext", withDays.oversikt["Kön"] && withDays.oversikt["Loggade dagar"] > 0 && /^\d{2}:\d{2}$/.test(withDays.oversikt["Frukost klockan"]));
$("l-paste").value = "{ trasig"; fire($("l-paste-go"), "click"); await tick();
check("Trasig importtext avvisas utan att något ändras", text("backup-msg").startsWith("Texten är inte en giltig export") && win.localStorage.getItem("ffv-log") === JSON.stringify(exportedData["ffv-log"]));

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
  "ffv-shop-1": JSON.stringify(["gammal_vara"]),
  [`ffv-shop-${Math.floor((Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) - Date.UTC(2024, 0, 1)) / 864e5 / 7)}`]: JSON.stringify(["havregryn", "agg"]),
  "ffv-shop-99999": JSON.stringify(["kvarg"]),
});

// Appen har en minuttimer för fastans läge; avsluta när testerna är klara.
process.exit(process.exitCode ?? 0);
