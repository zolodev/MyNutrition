// Tester för Fettförbränningsveckan. Kör med:  npm install && npm test   (eller: bun install && bun tests/run.mjs)
// Del 1 testar beräkningarna direkt, del 2 kör hela appen i en simulerad webbläsare och klickar runt.

import { JSDOM } from "jsdom";
import fs from "fs";
const todayStr = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };

// ---------- Del 1: beräkningar ----------
const memory = {};
globalThis.localStorage = { getItem: (k) => memory[k] ?? null, setItem: (k, v) => (memory[k] = String(v)), removeItem: (k) => delete memory[k] };
const { computeTargets } = await import("../js/nutrition.js");
const prefs = await import("../js/preferences.js");
const menu = await import("../js/menu.js");
const { buildProgram, parseTrainingDays } = await import("../js/training.js");
const { weekIndexOf } = await import("../js/util.js");
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

// Plankod
const { encodePlan, decodePlan } = await import("../js/plancode.js");
const sample = { seed: 123456789, salts: { 143: 98765 }, equipment: "db", days: [1, 3, 5], breakfast: "F2" };
const decoded = decodePlan(encodePlan(sample));
unit("Plankoden går att läsa tillbaka", JSON.stringify(decoded) === JSON.stringify({ ...sample, salts: { 143: 98765 }, swapPeriod: 1 }));
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
const fasting = await import("../js/fasting.js");
const skipped = fasting.fastingDay({ planned: 7, first: 12, last: null, yesterdayLast: 20 });
unit("Hoppad frukost, första måltid 12:00: fönster 12–20, måltid 19:00, fasta klar 12:00", skipped.windowEnd === 20 && skipped.nextMeal === 19 && fasting.formatClock(skipped.fastEnd) === "12:00");
unit("Varning: planerad frukost 07:00 i morgon ger bara 11 h", skipped.tonightIfPlanned === 11);
unit("Sista måltiden loggad 18:30 stänger fönstret och flyttar fastan", fasting.fastingDay({ planned: 7, first: 7, last: 18.5 }).fastEnd === 34.5);
unit("Läget kl 22: fastar sedan 20, 2 h av 16", (() => { const n = fasting.fastingNow(skipped, 22, 20); return n.state === "fasting" && n.elapsed === 2 && n.left === 14; })());
unit("Läget kl 13: ätfönstret öppet, 7 h kvar", (() => { const n = fasting.fastingNow(skipped, 13, 20); return n.state === "eating" && n.left === 7; })());
unit("Läget kl 06: fastar sedan i går 20:00, 10 h", fasting.fastingNow(skipped, 6, 20).elapsed === 10);

// Tillskott
const supps = await import("../js/supplements.js");
const gymTips = supps.supplementTips({ start: 7, kind: "str", weight: 95 });
unit("Gymdag: PWO 10:30, vassle 13:00, kreatin med måltiden 14:00", gymTips.map((t) => `${fasting.formatClock(t.at)} ${t.name}`).join(", ") === "10:30 PWO, 13:00 Vassle, 14:00 Kreatin");
unit("Gymdag: vassle behövs inte när måltiden kommer strax efter passet", gymTips.find((t) => t.name === "Vassle").text.startsWith("Behövs inte"));
const lateTips = supps.supplementTips({ start: 12, kind: "str", weight: 95 });
unit("Sent pass: varning för koffein", lateTips.find((t) => t.name === "PWO").text.includes("koffeinfri"));
unit("Vilodag: ingen PWO, kreatin med frukosten", (() => { const t = supps.supplementTips({ start: 7, kind: "rest", weight: 95 }); return !t.some((x) => x.name === "PWO") && t.find((x) => x.name === "Kreatin").at === 7; })());

// Egna recept
const own = await import("../js/myrecipes.js");
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
prefs.mergeMyFoods([{ id: "my_juice", n: "Apelsinjuice", k: 45 }, { id: "my_citron", n: "Citronkvarg", k: 70 }]);
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
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8").replace(/<script type="module"[^>]*><\/script>/, "").replace(/<link rel="stylesheet"[^>]*>/g, "");
const dom = new JSDOM(html, { url: "https://example.org/app/index.html", pretendToBeVisual: true });
const win = dom.window;
const errors = [];
for (const k of ["document", "localStorage", "location", "navigator", "HTMLElement", "Event", "Blob"]) globalThis[k] = win[k];
globalThis.window = win; win.scrollTo = () => {}; win.HTMLElement.prototype.scrollIntoView = function () {};
win.addEventListener("error", (e) => errors.push(e.message));
const $ = (id) => win.document.getElementById(id);
const text = (id) => $(id).textContent.replace(/\s+/g, " ").trim();
await import("../js/app.js");
const fire = (el, type) => el.dispatchEvent(new win.Event(type, { bubbles: true }));
const go = (hash) => { win.location.hash = hash; fire(win, "hashchange"); };
const visible = () => [...win.document.querySelectorAll("[data-view]")].filter((v) => !v.hidden).map((v) => v.dataset.view).join(",");
const check = (label, cond) => { console.log((cond ? "OK   " : "FEL  ") + label); if (!cond) process.exitCode = 1; };
console.log("\n# Appen i en simulerad webbläsare (jsdom)");

check("Idag har titel, dagens recept och tidslinje", text("td-title").length > 3 && $("td-food").querySelectorAll("details.recipe").length >= 3 && $("td-timeline").querySelectorAll(".tl-label").length === 4);
check("Dagens recept går att fälla ut med ingredienser", $("td-food").querySelector("details.recipe .ingredients li") !== null);
check("Dagens träning visas", text("td-train-title").length > 2 && ($("td-training").querySelectorAll("a.row.exercise").length >= 5 || $("td-training").querySelector(".plan-steps")));
check("Kom igång visas utan sparad profil", !$("td-profile").hidden);
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
check("Profilen sparas", JSON.parse(localStorage.getItem("ffv"))["tdays-val"] === "1,3,5" && $("td-profile").hidden);

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
swipe(-120, 200, $("week")); check("Svep i veckoschemat (scrollar i sidled) byter inte flik", !win.document.querySelector('[data-subview="vecka"]').hidden);
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
check("Inga JS-fel", errors.length === 0);
if (errors.length) console.log(errors);

// Appen har en minuttimer för fastans läge; avsluta när testerna är klara.
process.exit(process.exitCode ?? 0);
