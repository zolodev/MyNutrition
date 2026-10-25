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
unit("Veckans recept går inte över kalorimålet (högst 5 %) och hamnar högst 15 % under", kcal <= man.target * 1.05 && kcal >= man.target * 0.85);

const tueThuSat = buildProgram("gym", parseTrainingDays("1,3,5", [0, 2, 4]).days);
unit("Gymdagar tis/tor/lör ger helkropp, överkropp och ben", tueThuSat.schedule[1].label === "Helkropp" && tueThuSat.schedule[3].label === "Överkropp" && tueThuSat.schedule[5].label === "Ben");
{
  const auto = buildProgram("gym", [0, 2, 5]);
  const picked = buildProgram("gym", [0, 2, 5], {}, { 5: "H" });
  const sessions = (p) => [0, 2, 5].map((d) => p.schedule[d].session).sort().join();
  unit("Valt pass: helkropp på lördag, passet byter plats och alla tre pass finns kvar",
    picked.schedule[5].session === "H" && sessions(picked) === sessions(auto) && picked.chosen && !auto.chosen);
  unit("Valt pass som inte finns i programmet hoppas över", JSON.stringify(buildProgram("gym", [0, 2, 5], {}, { 5: "UA", 3: "H" }).schedule) === JSON.stringify(auto.schedule));
  unit("Valt pass: ben två dagar i rad ger en varning (clash), men blockeras inte", buildProgram("gym", [0, 4, 5], {}, { 4: "B", 5: "H" }).clash);
}
{
  const all = buildProgram("gym", [0, 1, 2, 3, 4, 5, 6], {}, { 5: "Ö" }, [], "full");
  unit("Helkropp varje pass: alla sju dagar får helkropp, sparade val av andra pass hoppas över",
    all.schedule.every((x) => x.kind === "str" && x.session === "H") && all.ids.join() === "H" && all.title === "Helkropp varje pass" && all.clash);
  const four = buildProgram("db", [0, 2, 4, 5], {}, {}, [], "full");
  unit("Helkropp varje pass gäller även fyra dagar, med hantlar", [0, 2, 4, 5].every((d) => four.schedule[d].label === "Helkropp") && four.sessions.length === 1);
  unit("Utan upplägg blir det appens förslag som förut", buildProgram("gym", [0, 2, 4, 5]).ids.join() === "UA,OA,UB,OB");
  const { trainingDaysAdvice } = await import("../public/js/training.js");
  unit("Råd för helkropp varje dag: varning med motivering", trainingDaysAdvice(7, "full").level === "warn" && trainingDaysAdvice(3, "full").level === "ok");
}
{
  const plan = buildProgram("gym", [0, 2, 4]);
  const moved = buildProgram("gym", [0, 2, 4], {}, {}, [[0, 5]]);
  unit("Flytt en vecka: måndagens pass hamnar på lördag och måndag blir vilodag",
    moved.schedule[5].session === plan.schedule[0].session && moved.schedule[0].kind !== "str" && moved.moved && !plan.moved && moved.summary.includes("lördag"));
  unit("Flytt en vecka till en gymdag: passen byter plats", (() => { const m = buildProgram("gym", [0, 2, 4], {}, {}, [[0, 2]]); return m.schedule[0].session === plan.schedule[2].session && m.schedule[2].session === plan.schedule[0].session; })());
  unit("Ogiltiga flyttar hoppas över", JSON.stringify(buildProgram("gym", [0, 2, 4], {}, {}, [[0, 9], [1, 1], ["x", 2]]).schedule) === JSON.stringify(plan.schedule));
}
const inARow = buildProgram("gym", [0, 1, 2]);
unit("Tre dagar i rad varnar för samma muskler två dagar i rad", inARow.clash);
unit("Inga gymdagar behåller senaste val", parseTrainingDays("", [0, 2, 4]).days.join() === "0,2,4");
{
  const { trainingDaysAdvice } = await import("../public/js/training.js");
  const two = parseTrainingDays("1,3", [0, 2, 4]);
  unit("2 gymdagar går att välja (blockeras inte) och ger helkropp varje gång", two.valid && !two.recommended && two.days.join() === "1,3" && buildProgram("gym", two.days).schedule[1].label === "Helkropp" && buildProgram("gym", two.days).schedule[3].label === "Helkropp");
  const five = buildProgram("gym", [0, 1, 2, 3, 4]);
  unit("5 gymdagar går att välja och ger ett pass varje vald dag", [0, 1, 2, 3, 4].every((d) => five.schedule[d].kind === "str") && five.sessions.length === 4);
  unit("Fler än 4 eller färre än 3 dagar ger en varning med motivering, 3–4 dagar ger ok", trainingDaysAdvice(5).level === "warn" && /återhämtning/.test(trainingDaysAdvice(5).text) && trainingDaysAdvice(2).level === "warn" && trainingDaysAdvice(4).level === "ok");
}

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
{
  const late = fasting.fastingDay({ planned: 7, first: null, last: null, yesterdayLast: 21 });
  unit("Sen måltid i går 21:00: dagens start flyttas till 13:00 i stället för att börja om vid frukost 07:00", late.start === 13 && late.windowEnd === 21);
  const at8 = fasting.fastingNow(late, 8, 21);
  unit("Kl. 08 efter sen måltid: fastan fortsätter räkna, 11 h av 16", at8.state === "fasting" && Math.abs(at8.elapsed - 11) < 1e-9);
  unit("Normal kväll (15:00): frukosten ligger kvar enligt planen", fasting.fastingDay({ planned: 7, first: null, last: null, yesterdayLast: 15 }).start === 7);
  unit("Loggad första måltid gäller alltid", fasting.fastingDay({ planned: 7, first: 9, last: null, yesterdayLast: 21 }).start === 9);
}
{
  const goals = await import("../public/js/goals.js");
  const list = [
    { date: "2026-10-19", cardio: [{ a: "lopning", km: 4, s: 1560 }] },
    { date: "2026-10-21", cardio: [{ a: "lopning", km: 3, s: 1140 }, { a: "rodd", km: 2, s: 570 }] },
    { date: "2026-10-14", cardio: [{ a: "lopning", km: 5, s: 1860 }] },
    { date: "2026-08-01", cardio: [{ a: "lopning", km: 5, s: 1500 }] },
  ];
  const weeks = goals.weekProgress("lopning", 3, list, "2026-10-24");
  unit("Löpmål: veckans km och pass räknas måndag–söndag, bara löpning", weeks[0].monday === "2026-10-19" && weeks[0].km === 7 && weeks[0].runs === 2 && weeks[1].km === 5 && weeks[1].runs === 1 && weeks[2].runs === 0 && weeks[0].week === 43);
  const best = goals.bestEstimate("lopning", 5, 56, list, "2026-10-24");
  unit("Löpmål: bästa uppskattade 5 km-tid de senaste 8 veckorna (Riegel), äldre pass räknas inte", best.date === "2026-10-14" && best.seconds === 1860);
  unit("Riegel: 4 km på 26:00 motsvarar ungefär 32:56 på 5 km", Math.round(goals.riegel(1560, 4, 5)) === 1976);
  const clean = goals.cleanGoal({ weekKm: 10, weekRuns: 2.6, distKm: -1, timeS: "x", own: 1 });
  unit("Löpmål: ogiltiga värden blir null, okända fält behålls", clean.weekKm === 10 && clean.weekRuns === 3 && clean.distKm === null && clean.timeS === null && clean.own === 1);
}

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
const myOmelet = own.cleanRecipe({ t: "Min omelett", g: "b", items: [["agg", 120, 2, "st"], ["aggvita", 150], ["ost", 20]], how: "Vispa och stek." });
own.addMyRecipe(myOmelet);
menu.invalidateMenu();
unit("Eget recept visas och räknas som det är skrivet (ingen skalning, ingen extra frukt)",
  JSON.stringify(menu.buildWeek(today, man, myOmelet.id).recipes[myOmelet.id].items) === JSON.stringify([["agg", 120], ["aggvita", 150], ["ost", 20]]));
own.removeMyRecipe(myOmelet.id);
menu.invalidateMenu();
{
  const side = own.cleanRecipe({ t: "Pizzasallad", g: "s", items: [["vitkal", 100], ["olja", 5]], extra: [{ n: "Vinäger", q: 1, u: "msk" }], how: "Strimla kålen fint." });
  own.addMyRecipe(side);
  prefs.setMealPrefs({ sideDays: [0, 3] });
  menu.invalidateMenu();
  const wk = menu.buildWeek(today, man, "F0");
  unit("Tillbehör läggs till eftermiddagsmåltiden de valda dagarna (måltid 4), som det är skrivet",
    wk.plan[0][4] === side.id && wk.plan[3][4] === side.id && !wk.plan[1][4] && JSON.stringify(wk.recipes[side.id].items) === JSON.stringify([["vitkal", 100], ["olja", 5]]));
  unit("Tillbehöret kommer med i inköpslistan", wk.extras["x:vinäger"]?.amounts.msk === 2 && wk.shopping.vitkal >= 200);
  prefs.setMealPrefs({ sideDays: [] });
  menu.invalidateMenu();
  unit("Inga tillbehör utan valda dagar", menu.buildWeek(today, man, "F0").plan.every((d) => !d[4]));
  own.removeMyRecipe(side.id);
  menu.invalidateMenu();
}
{
  const { RECIPES: ALL } = await import("../public/js/data/recipes.js");
  const withElk = Object.keys(ALL).find((id) => ALL[id].items.some(([f]) => f === "algfars"));
  prefs.setMealPrefs({ swaps: { algfars: "notfars" } });
  menu.invalidateMenu();
  const r = menu.buildWeek(today, man, "F0").recipes[withElk];
  unit("Vald billigare råvara: älgfärs blir nötfärs i ingredienserna och i namnet", r.items.some(([f]) => f === "notfars") && !r.items.some(([f]) => f === "algfars") && !/älgfärs/i.test(r.t + r.how));
  prefs.setMealPrefs({ swaps: { renskav: "kyckling" }, cheap: true });
  menu.invalidateMenu();
  unit("Billiga råvaror: rätt med renskav tas med när ett alternativ är valt", menu.recipesFor("d", menu.seasonOf(today)).some((id) => ALL[id].items.some(([f]) => f === "renskav")));
  prefs.setMealPrefs({ swaps: {}, cheap: false });
  menu.invalidateMenu();
}
unit("Eget recept utan namn avvisas", own.cleanRecipe({ t: " ", items: [["kvarg", 100]] }) === null);
own.removeMyRecipe(myBreakfast.id);
menu.invalidateMenu();

// Kryddor och smaksättning: allt som nämns i ett recept ska finnas som ingrediens med mängd, och komma med i inköpslistan
{
  const { RECIPES } = await import("../public/js/data/recipes.js");
  const SPICES = ["curry", "enbär", "lagerblad", "kanel", "dill", "chili", "spiskummin", "soja", "ingefära", "tacokrydda", "oregano", "timjan", "kryddpeppar", "senap", "gräslök", "vitlök", "paprikapulver", "vanilj", "persilja", "citron", "lime"];
  const missing = Object.entries(RECIPES).flatMap(([id, r]) => SPICES.filter((w) => (r.how || "").toLowerCase().includes(w) && !(r.extra || []).some((x) => x.n.toLowerCase().includes(w.replace("vitlök", "vitlök")))).map((w) => `${id}: ${w}`));
  unit(`Varje krydda i receptens text finns som ingrediens med mängd${missing.length ? " (saknas: " + missing.join(", ") + ")" : ""}`, missing.length === 0);
  unit("Kryddorna har mängd per portion", Object.values(RECIPES).every((r) => (r.extra || []).every((x) => x.q > 0 && x.u)));
  const curry = RECIPES.D15.extra.find((x) => x.n === "Curry");
  unit("Kycklingcurryn anger hur mycket curry (2 tsk)", curry?.q === 2 && curry.u === "tsk");
  const wk = menu.buildWeek(today, man, "rot");
  const list = menu.shoppingList(wk);
  unit("Kryddorna hamnar i inköpslistan, summerade per mått", Object.keys(list.extras).length > 0 && Object.values(list.extras).every((x) => Object.keys(x.amounts).length));
  const dinnerMonday = wk.plan[0][1];
  const without = menu.shoppingList(wk, [[0, 1]]);
  const [food, grams] = wk.recipes[dinnerMonday].items[0];
  unit("En ersatt måltid räknas bort ur inköpslistan", Math.abs((list.shopping[food] - (without.shopping[food] || 0)) - grams) < 0.01);
}

// En bortvald råvara som byts ut får inte stå kvar i rättens namn eller text (t.ex. "med bulgur" när det blir ris)
{
  const { TEXT_FORMS } = await import("../public/js/data/foods.js");
  const mentions = (text, word) => new RegExp(`(^|[^a-zåäöé])${word}(?=$|[^a-zåäöé])`, "i").test(text) || (word.length > 4 && text.toLowerCase().includes(word));
  const left = [];
  for (const food of Object.keys(TEXT_FORMS)) {
    prefs.setExclusions({ allergens: [], foods: [food], words: [] });
    menu.invalidateMenu();
    const wk = menu.buildWeek(today, man, "rot");
    for (const [id, r] of Object.entries(wk.recipes)) {
      const sub = (r.subs || []).find(([from, to]) => from === food && TEXT_FORMS[to] && !TEXT_FORMS[to][0].includes(TEXT_FORMS[from][0]));
      if (sub && TEXT_FORMS[food].some((w) => mentions(r.t, w) || mentions(r.how, w))) left.push(`${food} i ${id} (${r.t})`);
    }
  }
  prefs.setExclusions({ allergens: [], foods: [], words: [] });
  menu.invalidateMenu();
  unit(`En bortvald råvara som byts ut syns inte i rättens namn eller text${left.length ? ": " + left.slice(0, 5).join("; ") : ""}`, left.length === 0);
  const bulgur = (() => { prefs.setExclusions({ allergens: [], foods: ["bulgur"], words: [] }); menu.invalidateMenu(); return menu.buildWeek(today, man, "rot").recipes.D8; })();
  unit("Utan bulgur heter rätten \"Kycklingfärsbiffar med ris och tzatziki\" och texten säger \"Koka riset\"", bulgur.t === "Kycklingfärsbiffar med ris och tzatziki" && bulgur.how.includes("Koka riset") && !bulgur.items.some(([f]) => f === "bulgur"));
  prefs.setExclusions({ allergens: [], foods: [], words: [] });
  prefs.setMealPrefs({ cheap: true });
  menu.invalidateMenu();
  const cheapTorsk = menu.buildWeek(today, man, "rot").recipes.D4;
  unit("Billiga råvaror: \"Torsk med …\" blir \"Sej med …\"", cheapTorsk.t.startsWith("Sej med") && !/torsk/i.test(cheapTorsk.how));
  prefs.setMealPrefs({ cheap: false });
  menu.invalidateMenu();
}

// Eget kalorimål, efterrätter per dag, lördagsgodis och billiga råvaror
{
  const base = { sex: "m", age: 43, weight: 101, height: 183, bodyFat: 28, activity: 1.375, rate: 0.5 };
  const auto = computeTargets(base);
  unit("Eget kalorimål ersätter det beräknade", computeTargets({ ...base, kcal: 1800 }).target === 1800 && auto.target !== 1800);
  const low = computeTargets({ ...base, kcal: 1000 });
  unit("Ett kalorimål under golvet höjs till 1 500 kcal (män) med en förklaring", low.target === 1500 && low.flags.some((f) => f.includes("medicinsk uppföljning")));
  unit("Ett kalorimål över underhållsbehovet ger en varning", computeTargets({ ...base, kcal: 3500 }).flags.some((f) => f.includes("går inte ner i vikt")));

  const before = menu.buildWeek(today, man, "rot");
  prefs.setMealPrefs({ dessertDays: [0, 2], treat: false });
  menu.invalidateMenu();
  const fewer = menu.buildWeek(today, man, "rot");
  unit("Efterrätt bara valda dagar (måndag och onsdag)", fewer.plan.every((day, d) => (day[2] !== "NONE") === [0, 2].includes(d)));
  unit("Lördagsgodiset går att stänga av", fewer.plan[5][3] === "NONE");
  unit("Övriga rätter blir desamma när efterrätter tas bort", fewer.plan.every((day, d) => day[0] === before.plan[d][0] && day[1] === before.plan[d][1]));
  prefs.setMealPrefs({ dessertDays: [] });
  menu.invalidateMenu();
  unit("Efterrätter går att stänga av helt", menu.buildWeek(today, man, "rot").plan.every((day) => day[2] === "NONE"));

  prefs.setMealPrefs({ dessertDays: [0, 1, 2, 3, 4, 5, 6], treat: true });
  menu.invalidateMenu();
  const saturdayWeek = menu.buildWeek(today, man, "rot");
  prefs.setMealPrefs({ cheatDay: 4 });
  menu.invalidateMenu();
  const fridayWeek = menu.buildWeek(today, man, "rot");
  unit("Fuskdag fredag: samma godis flyttas till fredagen och lördagen blir en vanlig dag", fridayWeek.plan[4][3] === saturdayWeek.plan[5][3] && fridayWeek.plan[5].length === 3 && prefs.treatName() === "Fredagsgodis");
  unit("Fuskdagen ändrar inga andra rätter", fridayWeek.plan.every((day, d) => day.slice(0, 3).join() === saturdayWeek.plan[d].slice(0, 3).join()));
  prefs.setMealPrefs({ cheatDay: 5 });
  prefs.setMealPrefs({ dessertDays: [0, 1, 2, 3, 4, 5, 6], treat: true, cheap: true });
  menu.invalidateMenu();
  const cheap = menu.buildWeek(today, man, "rot");
  const used = cheap.plan.flat().flatMap((id) => cheap.recipes[id].items.map(([f]) => f));
  unit("Billiga råvaror: inga räkor, renskav, älgskav, älgkött, älgfärs eller torsk i veckan", !used.some((f) => ["rakor", "renskav", "algskav", "algkott", "algfars", "torsk"].includes(f)) && cheap.plan.every((day) => day[1] !== "NONE"));
  prefs.setMealPrefs({ cheap: false });
  menu.invalidateMenu();
}

// Ingen sparad post får gå förlorad: poster som inte går att läsa ligger kvar och skrivs tillbaka vid sparning
{
  const broken = { t: "Gammalt recept", g: "d", ingredients: [["kvarg", 200]] }; // okänt format: klarar inte kontrollen
  memory["ffv-myrecipes"] = JSON.stringify([{ t: "Utan id", g: "b", items: [["kvarg", 200]] }, broken]);
  own.loadMyRecipes();
  const firstId = own.myRecipes[0]?.id;
  own.loadMyRecipes();
  unit("Recept utan giltigt id får samma id vid varje start", /^MR_/.test(firstId) && own.myRecipes[0].id === firstId);
  unit("Recept som inte går att läsa visas som olästa i stället för att försvinna", own.myRecipes.length === 1 && own.unreadableRecipes().join() === "Gammalt recept");
  own.addMyRecipe(own.cleanRecipe({ t: "Nytt", g: "b", items: [["havre", 40]] }));
  const savedRecipes = JSON.parse(memory["ffv-myrecipes"]);
  unit("När ett annat recept sparas ligger det olästa receptet kvar orört", savedRecipes.length === 3 && savedRecipes.some((r) => JSON.stringify(r) === JSON.stringify(broken)));
  delete memory["ffv-myrecipes"];
  own.loadMyRecipes();

  memory["ffv-log"] = JSON.stringify([{ date: "2026-08-01", weight: 90 }, { date: "inte ett datum", weight: 1 }]); // äldre format: ren lista
  logMod.loadLog();
  unit("En logg i äldre format (ren lista) läses in", logMod.entries.length === 1 && logMod.entries[0].weight === 90);
  logMod.upsertEntry(logMod.cleanEntry({ date: "2026-08-02", weight: 89.5 }));
  const savedLog = JSON.parse(memory["ffv-log"]).entries;
  unit("Loggposter som inte går att läsa ligger kvar när loggen sparas", savedLog.length === 3 && savedLog.some((e) => e.date === "inte ett datum"));
  delete memory["ffv-log"];
  logMod.loadLog();

  // En dag med bara en ersatt måltid får inte raderas när dagens måltidstider nollställs
  logMod.setSwap("2026-08-20", 1, { n: "Huel Powder", k: 400, p: 30 });
  logMod.setMealTimes("2026-08-20", { firstMeal: "", lastMeal: "" });
  unit("Att nollställa måltidstiderna tar inte bort en dag med en ersatt måltid", logMod.entryFor("2026-08-20")?.swaps.length === 1);
  logMod.setEaten("2026-08-21", 0, true);
  unit("En avbockad måltid sparas i dagens post", logMod.entryFor("2026-08-21")?.eaten.join() === "0");
  logMod.setEaten("2026-08-21", 0, false);
  unit("En dag där bara avbockningen tas bort blir tom och tas bort", !logMod.entryFor("2026-08-21"));
  delete memory["ffv-log"];
  logMod.loadLog();
}

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
// En app som har legat öppen i bakgrunden frågar servern om en nyare version när den visas igen
{
  const { checkForUpdate } = await import("../public/js/pwa.js");
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ text: async () => '<meta name="app-version" content="99.0.0">' });
  const asking = checkForUpdate(); // väntar på svaret i dialogen
  await new Promise((r) => setTimeout(r, 20));
  const offeredUpdate = $("confirm").hasAttribute("open") && text("confirm-text").includes("99.0.0") && $("confirm").querySelector('[data-answer="yes"]').textContent === "Uppdatera nu";
  if ($("confirm").hasAttribute("open")) fire($("confirm").querySelector('[data-answer="no"]'), "click");
  await asking;
  await checkForUpdate();
  const askedAgain = $("confirm").hasAttribute("open");
  globalThis.fetch = realFetch;
  console.log("\n# Uppdateringar");
  check("En nyare publicerad version erbjuds med Uppdatera nu, och frågan tjatar inte", offeredUpdate && !askedAgain);
}
console.log("\n# Appen i en simulerad webbläsare (jsdom)");
{
  // Varje modul måste finnas i service workerns lista, annars fungerar appen inte offline
  const sw = fs.readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
  const jsFiles = fs.readdirSync(new URL("../public/js", import.meta.url), { recursive: true }).filter((f) => String(f).endsWith(".js"));
  const missing = jsFiles.filter((f) => !sw.includes(`"./js/${String(f).replaceAll("\\", "/")}"`));
  const headers = fs.readFileSync(new URL("../public/_headers", import.meta.url), "utf8");
  check("Cloudflare skickar Cache-Control: no-cache för alla filer, så att ny HTML aldrig blandas med gamla moduler", /^\/\*\n\s+Cache-Control: no-cache/m.test(headers));
  check("Service workern hämtar filerna från servern, inte webbläsarens cache, när en ny version installeras", sw.includes('cache: "reload"'));
  // Versionen: samma i package.json, js/version.js och sw.js, enligt semver (MAJOR.MINOR.PATCH)
  const pkgVersion = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
  const appVersion = fs.readFileSync(new URL("../public/js/version.js", import.meta.url), "utf8").match(/APP_VERSION = "([^"]+)"/)?.[1];
  const swVersion = sw.match(/const VERSION = "ffv-([^"]+)"/)?.[1];
  check(`Versionen följer semver och är samma i package.json, version.js och sw.js (${pkgVersion}, ${appVersion}, ${swVersion})`, /^\d+\.\d+\.\d+$/.test(pkgVersion) && pkgVersion === appVersion && pkgVersion === swVersion);
  const indexHtml = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  check("index.html har samma version i meta-taggen och i main.js?v=, och laddar inga moduler i förväg", indexHtml.includes(`<meta name="app-version" content="${pkgVersion}">`) && indexHtml.includes(`src="js/main.js?v=${pkgVersion}"`) && !indexHtml.includes("modulepreload"));
  const changelog = fs.readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");
  check("Ändringsloggen har en rubrik för den aktuella versionen", changelog.includes(`## [${pkgVersion}]`));
  const guide = fs.readFileSync(new URL("../public/guide.html", import.meta.url), "utf8");
  const page = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  check("Förklaringarna har ett avsnitt om medicin, och appen länkar dit från fastans regler", guide.includes('<section id="medicin">') && guide.includes('href="#medicin"') && guide.includes("paracetamol") && page.includes('href="guide.html#medicin"'));
  check(`Alla ${jsFiles.length} JS-filer finns i sw.js (CORE)${missing.length ? ": saknas " + missing.join(", ") : ""}`, !missing.length);
}

check("Laddningsskärmen finns och döljs när appen har startat", !!win.document.querySelector(".loading-screen") && !win.document.documentElement.classList.contains("booting") && !win.document.documentElement.classList.contains("boot-failed"));

// Guiden första gången: villkor, dig, mål, träning, mat
const next = () => fire($("wz-next"), "click");
const typeIn = (id, value) => { $(id).value = value; fire($(id), "input"); };
check("Första gången startar guiden med välkommen och möjligheten att installera appen, och inget sparas", !$("wizard").hidden && win.localStorage.length === 0 && text("wz-progress") === "Steg 1 av 8" && text("wz-title") === "Välkommen" && text("wizard").includes("Installera appen på mobilen eller datorn") && $("wz-install-how").textContent.trim() !== "" && !$("wz-next").disabled && $("wz-back").hidden && $("wz-accept").closest("[data-step]").hidden && $("age").closest("[data-step]").hidden);
next();
check("Steg 2: villkoren, efter välkomststeget", text("wz-progress") === "Steg 2 av 8" && text("wz-title") === "Innan du börjar");
check("Villkoren visas: rekommendationer, ExRx, localStorage, export, i befintligt skick", ["inte medicinsk rådgivning", "ExRx", "localStorage", "exportera", "befintligt skick"].every((t) => text("wz-terms").includes(t)));
check("Formuläret och importen visas inte förrän villkoren är godkända", $("wz-import").closest("[data-step]").hidden && $("age").closest("[data-step]").hidden);
const accept = (on = true) => { $("wz-accept").checked = on; fire($("wz-accept"), "change"); };
check("Kryssrutan ligger sist i villkorsrutan, efter texten", $("wz-accept").closest(".terms-scroll")?.lastElementChild === $("wz-accept").closest("label") && $("wz-terms").closest(".terms-scroll") === $("wz-accept").closest(".terms-scroll"));
check("Nästa är inaktiverad tills villkoren är godkända", $("wz-next").disabled);
next();
check("Utan kryss går det inte vidare", text("wz-progress") === "Steg 2 av 8");
fire($("wz-back"), "click"); check("Tillbaka från villkoren går till välkomststeget", text("wz-progress") === "Steg 1 av 8");
next(); check("Och fram igen till villkoren", text("wz-progress") === "Steg 2 av 8");
accept(); check("Kryss aktiverar Nästa", !$("wz-next").disabled);
accept(false); check("Utan kryss igen är Nästa inaktiverad", $("wz-next").disabled);
accept(); next();
check("Nästa är aktiv på stegen efter villkoren", !$("wz-next").disabled);
check("Steg 2: import eller plankod på en egen sida, som går att hoppa över", text("wz-progress") === "Steg 3 av 8" && !$("wz-import").closest("[data-step]").hidden && !$("wz-code").closest("[data-step]").hidden && $("age").closest("[data-step]").hidden && text("wz-next") === "Hoppa över" && $("wz-body").hidden);
$("wz-code").value = "fel"; fire($("wz-code-go"), "click");
check("En felaktig plankod avvisas med förklaring", text("wz-code-msg").startsWith("Koden gick inte att läsa") && text("wz-next") === "Hoppa över");
next();
check("Steg 3: dig, utan import och plankod", text("wz-progress") === "Steg 4 av 8" && $("wz-import").closest("[data-step]").hidden && !$("age").closest("[data-step]").hidden);
check("Guiden kräver egna värden: exemplen är tömda och kön är inte valt", $("age").value === "" && $("weight").value === "" && !win.document.querySelector('input[name="sex"]:checked'));
next();
check("Nästa utan ifyllda fält stannar på steget och förklarar", text("wz-progress") === "Steg 4 av 8" && text("wz-msg").startsWith("Fyll i"));
win.document.querySelector('input[name="sex"][value="m"]').checked = true;
$("age").value = "40"; $("weight").value = "95"; $("height").value = "180";
next();
check("Steg 3: målet", text("wz-progress") === "Steg 5 av 8" && !$("goal").closest("[data-step]").hidden && $("age").closest("[data-step]").hidden);
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
typeIn("goal", ""); next(); check("Målvikt krävs", text("wz-progress") === "Steg 5 av 8");
typeIn("goal", "85"); next();
check("Steg 4: träning, med gymdagar", text("wz-progress") === "Steg 6 av 8" && !$("tdays").closest("[data-step]").hidden);
next(); check("Steg 5: mat och allergier, inga förvalda", text("wz-progress") === "Steg 7 av 8" && text("wz-next") === "Nästa" && $("wz-allergens").querySelectorAll("input").length > 10 && !$("wz-allergens").querySelector(":checked"));
next();
check("Steg 6: Make it yours uppmanar till egna recept, loggning och rapport", text("wz-progress") === "Steg 8 av 8" && text("wz-title") === "Make it yours" && text("wz-next") === "Kom igång" && ["Egna recept", "Logga så mycket du kan", "Logg → Rapport", "personlig tränare, dietist eller läkare"].every((t) => text("wizard").includes(t)));
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
{
  const v = fs.readFileSync(new URL("../public/js/version.js", import.meta.url), "utf8").match(/APP_VERSION = "([^"]+)"/)[1];
  check("Versionsnumret visas i sidfoten och under Om appen", win.document.querySelector(".app-note .app-version").textContent === `Version ${v}` && $("om").textContent.includes(`Version ${v}`));
}
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
check("Viktkurvan visar senaste månaden från början, med knappar för period", $("l-range").querySelector('[aria-pressed="true"]').dataset.range === "30" && $("l-range").querySelectorAll("[data-range]").length === 4);
fire($("l-range").querySelector('[data-range="0"]'), "click");
{
  const css = fs.readFileSync(new URL("../public/css/app.css", import.meta.url), "utf8");
  const menu = new win.MouseEvent("contextmenu", { bubbles: true, cancelable: true });
  $("l-chart").dispatchEvent(menu);
  check("Att hålla fingret på viktkurvan markerar ingen text och öppnar ingen meny", menu.defaultPrevented && /#l-chart, #l-tip \{[^}]*user-select: none[^}]*-webkit-touch-callout: none/.test(css) && /#l-chart \.hit \{ touch-action: pan-y/.test(css));
}
check("Grafen visar planen hela vägen ner till målvikten", !!$("l-chart").querySelector(".plan-end") && /målvikten ca \d{4}-\d{2}-\d{2}/.test(text("l-key")));
const planLine = $("l-chart").querySelector(".plan"), planEnd = $("l-chart").querySelector(".plan-end");
check("Planlinjen slutar vid målvikten", Math.abs(Number(planLine.getAttribute("x2")) - Number(planEnd.getAttribute("cx"))) < 0.01 && Math.abs(Number(planLine.getAttribute("y2")) - Number(planEnd.getAttribute("cy"))) < 0.01);
{
  // Inzoomat: skalan följer bara de synliga vägningarna, så att trenden syns tydligare
  const height = () => { const ys = [...$("l-chart").querySelectorAll(".axis")].filter((t) => t.getAttribute("text-anchor") === "end").map((t) => parseFloat(t.textContent.replace(",", "."))); return Math.max(...ys) - Math.min(...ys); };
  const whole = height();
  fire($("l-range").querySelector('[data-range="14"]'), "click");
  check("2 veckor zoomar in: mindre viktspann på skalan och inget målvikt-streck", height() <= whole && !$("l-chart").querySelector(".plan-end") && $("l-range").querySelector('[data-range="14"]').getAttribute("aria-pressed") === "true");
  fire($("l-range").querySelector('[data-range="30"]'), "click");
}
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
// Siffra för siffra som på iPhones sifferknappsats (utan kolon): 003516 → 00:35:16
const typeKey = (el, ch) => { el.value += ch; el.dispatchEvent(new win.InputEvent("input", { bubbles: true, data: ch, inputType: "insertText" })); };
timeInput.value = ""; fire(timeInput, "input");
for (const ch of "003516") typeKey(timeInput, ch);
fire(timeInput, "change");
check("Tid knappad siffra för siffra (003516) blir 00:35:16", timeInput.value === "00:35:16" && timeInput.validity.valid);
timeInput.value = "00:35:1"; timeInput.dispatchEvent(new win.InputEvent("input", { bubbles: true, inputType: "deleteContentBackward" }));
check("Radera en siffra sätter kolonerna om", timeInput.value === "0:03:51");
timeInput.value = ""; fire(timeInput, "input");
for (const ch of "8:5") typeKey(timeInput, ch);
check("Eget kolon lämnas orört medan man skriver", timeInput.value === "8:5");
// Löpmål: veckomål och tidsmål
{
  $("g-week-km").value = "10"; $("g-week-runs").value = "3"; $("g-dist").value = "5";
  $("g-time").value = ""; fire($("g-time"), "input");
  for (const ch of "003000") typeKey($("g-time"), ch);
  check("Tidsmålet skrivs med siffror som i loggen: 003000 blir 00:30:00", $("g-time").value === "00:30:00");
  fire($("l-goal-form"), "submit");
  const saved = JSON.parse(win.localStorage.getItem("ffv-goals") || "{}").lopning;
  check("Löpmålen sparas", saved?.weekKm === 10 && saved.weekRuns === 3 && saved.distKm === 5 && saved.timeS === 1800);
  check("Löpmålen visar veckans framsteg och tidsmålet", /av 10 km den här veckan/.test(text("l-goal-status")) && /av 3 pass/.test(text("l-goal-status")) && text("l-goal-status").includes("Mål: 5 km på 00:30:00 (6:00/km)"));
  $("g-time").value = ""; fire($("l-goal-form"), "submit");
  check("Tidsmål utan tid stoppas med förklaring", text("g-msg").includes("både distans och tid"));
  $("g-time").value = "00:30:00";
}
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
{
  // Styr fastan själv med knappen under läget just nu
  const action = $("fs-action").dataset.action;
  const clock = new Date().toTimeString().slice(0, 5);
  fire($("fs-action"), "click");
  const entry = JSON.parse(win.localStorage.getItem("ffv-log")).entries.find((e) => e.date === todayStr());
  check("Knappen för fastan sätter tiden till nu (starta eller bryta fastan)", ["start", "break"].includes(action) &&
    (action === "start" ? entry.lastMeal === clock : entry.firstMeal === clock) && /Starta|Bryt|starta om/.test($("fs-action").textContent));
  fire($("fs-reset"), "click");
}

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
{
  const { FOOD: foods } = await import("../public/js/data/foods.js");
  check("Ananas står som färsk och ej konserverad (konserverad har inga enzymer kvar)", /färsk/.test(foods.ananas.n) && /ej konserverad/.test(foods.ananas.n) && !/fryst/.test(foods.ananas.n));
}
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
fire($("shop-next"), "click");
const shared = [...shopFoods()].find((f) => thisWeek.has(f));
fire($("shop-prev"), "click");
const shopBox = () => win.document.querySelector(`[data-shop="${shared}"]`);
shopBox().checked = true; fire(shopBox(), "change");
check("Avbockning sparas i den gemensamma listan", JSON.parse(win.localStorage.getItem("ffv-shop")).includes(shared) && !Object.keys(win.localStorage).some((k) => /^ffv-shop-\d+$/.test(k)));
fire($("shop-next"), "click");
check("Avbockad vara är avbockad även nästa vecka", shopBox().checked && shopBox().closest(".shop-item").classList.contains("done"));
{
  // Inköpslistan har en egen vecka och kan alltid visa nästa vecka
  const weekNo = (id) => Number(text(id).match(/\d+/)[0]);
  fire($("shop-wk-default"), "click");
  const current = weekNo("shop-wk-title");
  check("Inköpslistan öppnas på denna vecka utan inställningen", weekNo("wk-title") === current && text("shop-wk-range").includes("denna vecka") && $("shop-wk-default").hidden);
  fire($("shop-next"), "click");
  check("Inköpslistan byter vecka med egna pilar utan att Veckan byter", weekNo("shop-wk-title") === current + 1 && weekNo("wk-title") === current && text("shop-title").includes(`vecka ${current + 1}`) && !$("shop-wk-default").hidden);
  go("inkopslista");
  check("Inställningen för inköpslistan finns på en egen undersida", visible() === "installningar" && !$("inkopslista-val").closest("[data-page]").hidden && !$("shop-next-week").checked);
  $("shop-next-week").checked = true; fire($("shop-next-week"), "change");
  fire($("shop-wk-default"), "click");
  check("Med inställningen visar inköpslistan nästa vecka", JSON.parse(win.localStorage.getItem("ffv-shop-next")) === true && weekNo("shop-wk-title") === current + 1 && text("shop-wk-range").includes("nästa vecka") && $("shop-wk-default").hidden);
  fire($("shop-prev"), "click");
  check("Knappen tillbaka går till nästa vecka när inställningen är på", !$("shop-wk-default").hidden && text("shop-wk-default") === "Till nästa vecka");
  $("shop-next-week").checked = false; fire($("shop-next-week"), "change");
  check("Utan inställningen tillbaka på denna vecka", weekNo("shop-wk-title") === current);
  go("inkop");
}
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
  check("Fält bredvid varandra ligger i linje även när hjälptexten under det ena är längre (Första och Sista måltiden)", /\.field \{[^}]*align-content: start/.test(css) && $("fs-first").closest(".row2") === $("fs-last").closest(".row2"));
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
{
  const tileEl = [...$("rp-tiles").querySelectorAll(".tile.wide")].find((t) => t.textContent.startsWith("Prognos"));
  const text2 = tileEl?.textContent || "";
  check("Rapporten har en prognos med datum för målvikten om man följer appen", tileEl && text2.startsWith("Prognos för målvikten") && (/\d{4}-\d{2}-\d{2}/.test(text2) && /om du följer appens kalorimål och träning \([\d,]+ kg\/vecka\)/.test(text2) || text2.includes("Nådd") || text2.includes("Fyll i en målvikt")));
}
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
next(); accept(); next(); // välkommen, villkor
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
check("Idag påminner om att säkerhetskopiera när inget har exporterats", !$("bk-remind").hidden && text("bk-remind-text").startsWith("Du har inte exporterat"));
// Export av allt: kopiera (urklipp saknas i jsdom, så texten visas för att kopieras för hand)
go("backup"); fire($("l-copy"), "click"); await tick();
check("Export och import ligger under Inställningar", visible() === "installningar" && $("l-export").closest("section").id === "backup" && $("backup").closest("[data-page]").dataset.page === "sakerhetskopia" && !$("backup").closest("[data-page]").hidden);
check("Logg länkar till exporten under Inställningar", !!$("logg").closest("[data-view]").querySelector('a[href="#backup"]'));
const exportedText = $("l-copytext").value;
check("En export som inte gick igenom tar inte bort påminnelsen", !$("bk-remind").hidden && !win.localStorage.getItem("ffv-lastexport"));
const exportedData = JSON.parse(exportedText).data;
check("Exporten anger vilken version av appen den gjordes med", /^\d+\.\d+\.\d+$/.test(JSON.parse(exportedText).appVersion));
check("Kopiera allt visar texten när urklipp nekas", !$("l-copytext").hidden && text("backup-msg").startsWith("Kopieringen nekades"));
check("Exporten innehåller profil, logg, plan, allergier och tillskott", ["ffv", "ffv-log", "ffv-seed", "ffv-excl"].every((k) => k in exportedData) && exportedData["ffv-log"].entries.length > 0 && exportedData.ffv.weight === "92");
check("Exporten innehåller allt sparat utom det som bara gäller enheten", Object.keys(win.localStorage).filter((k) => k.startsWith("ffv") && k !== "ffv-swipe-hint" && k !== "ffv-install-declined" && k !== "ffv-terms").every((k) => k in exportedData) && !("ffv-swipe-hint" in exportedData));
// En lyckad export tar bort påminnelsen om säkerhetskopia
Object.defineProperty(win.navigator, "clipboard", { value: { writeText: async () => {} }, configurable: true });
fire($("l-copy"), "click"); await tick();
check("Påminnelsen försvinner efter en export, och exportdatumet följer inte med i exporten", $("bk-remind").hidden && !!win.localStorage.getItem("ffv-lastexport") && !("ffv-lastexport" in JSON.parse((await import("../public/js/backup.js")).exportText()).data));
delete win.navigator.clipboard;

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

// Ersätt en måltid: t.ex. en Huel-shake i stället för eftermiddagsmåltiden
{
  go("idag");
  const kcalToday = () => Number(win.document.querySelector("#td-targets .tile.main .v")?.textContent.replace(/\D/g, ""));
  const before = kcalToday();
  const dinner = $("td-food").querySelectorAll("summary b")[1].textContent;
  check("Formuläret för att ersätta en måltid föreslår eftermiddagsmåltiden", $("sw-meal").value === "1" && $("sw-recent").hidden);
  fire($("td-food").querySelector('[data-swap-meal="0"]'), "click");
  check("Knappen Ersätt under en måltid öppnar formuläret med den måltiden vald", $("sw-box").open && $("sw-meal").value === "0");
  $("sw-meal").value = "1"; fire($("sw-meal"), "change");
  $("sw-name").value = "Huel shake"; $("sw-k").value = "400"; $("sw-p").value = "30";
  fire($("sw-form"), "submit");
  const swapped = $("td-food").querySelector(".row.swapped");
  check("Ersatt måltid visas i stället för receptet", swapped?.textContent.includes("Huel shake") && swapped.textContent.includes(`I stället för ${dinner}`) && swapped.textContent.includes("400 kcal"));
  check("Ätit i dag räknar ersättningen som äten (400 kcal), inte hela dagens plan", kcalToday() === before + 400 && text("td-targets").includes("planerat") && text("td-eaten").includes("Ätit 1 av"));
  check("En ersatt måltid är avbockad och kan inte bockas ur", $("td-food").querySelector('[data-eaten="1"]').checked && $("td-food").querySelector('[data-eaten="1"]').disabled);
  const logged = JSON.parse(win.localStorage.getItem("ffv-log")).entries.find((e) => e.date === todayStr());
  check("Inköpslistan räknar bort den ersatta måltiden", text("shop-skipped").includes("1 måltid som du har ersatt"));
  check("Ersättningen sparas i dagens logg", logged?.swaps?.[0]?.n === "Huel shake" && logged.swaps[0].meal === 1 && logged.swaps[0].k === 400);
  check("Ersättningen syns i loggens tabell", text("l-table").includes("Eftermiddagsmåltid: Huel shake (400 kcal)"));
  check("Senaste ersättningen blir ett snabbval", !$("sw-recent").hidden && text("sw-recent").includes("Huel shake"));
  fire($("sw-recent").querySelector("[data-swap-pick]"), "click");
  check("Snabbvalet fyller i namn, kalorier och protein", $("sw-name").value === "Huel shake" && $("sw-k").value === "400" && $("sw-p").value === "30");
  $("sw-form").reset();
  const blackRtd = [...$("sw-products").querySelectorAll("[data-swap-product]")].find((b) => b.textContent.startsWith("Huel Black Edition Ready-to-drink"));
  check("Huels produkter finns som snabbval", $("sw-products").querySelectorAll("[data-swap-product]").length >= 7 && !!blackRtd);
  fire(blackRtd, "click");
  check("En Huel-produkt fyller i namn, kalorier och protein", $("sw-name").value === "Huel Black Edition Ready-to-drink 500 ml" && $("sw-k").value === "400" && $("sw-p").value === "35");
  $("sw-form").reset();
  // Loggen sparad för hand behåller ersättningen
  go("logg");
  fire($("logf").querySelector('[data-date-offset="0"]') || $("l-date"), "click");
  $("l-date").value = todayStr(); fire($("l-date"), "input");
  $("l-waist").value = "95"; fire($("logf"), "submit");
  const afterManual = JSON.parse(win.localStorage.getItem("ffv-log")).entries.find((e) => e.date === todayStr());
  check("Att spara loggen för hand tar inte bort ersättningen", afterManual.waist === 95 && afterManual.swaps?.[0]?.n === "Huel shake");
  go("idag");
  fire($("td-food").querySelector("[data-unswap]"), "click");
  check("Ångra visar receptet igen och dagens summa blir som förut", !$("td-food").querySelector(".row.swapped") && kcalToday() === before);

  // Mellanmål och snacks utöver planen
  const planned = () => Number(text("td-targets").match(/av ([\d\s]+) (?:planerat|med mellanmål)/)[1].replace(/\D/g, ""));
  const plannedBefore = planned();
  check("Utan mellanmål visas en förklaring och ingen lista", !$("sn-empty").hidden && $("sn-list").hidden);
  $("sn-name").value = "Lättfil med kasein"; $("sn-k").value = "235"; $("sn-p").value = "40"; fire($("sn-form"), "submit");
  $("sn-name").value = "Banan"; $("sn-k").value = "105"; $("sn-p").value = ""; fire($("sn-form"), "submit");
  const snacksSaved = () => JSON.parse(win.localStorage.getItem("ffv-log")).entries.find((e) => e.date === todayStr())?.snacks || [];
  check("Mellanmål sparas i dagens logg", snacksSaved().length === 2 && snacksSaved()[0].n === "Lättfil med kasein" && snacksSaved()[0].k === 235 && snacksSaved()[0].p === 40 && snacksSaved()[1].p === 0);
  check("Mellanmålen räknas som ätna och läggs till dagens summa", kcalToday() === before + 340 && planned() === plannedBefore + 340 && text("td-targets").includes("med mellanmål") && text("td-eaten").includes("2 mellanmål"));
  check("Mellanmålen listas på Idag och blir snabbval", $("sn-list").querySelectorAll("li").length === 2 && text("sn-recent").includes("Lättfil med kasein") && text("sw-recent").includes("Banan"));
  fire($("sn-form"), "submit");
  check("Ett tomt mellanmål sparas inte", snacksSaved().length === 2 && text("sn-msg").startsWith("Fyll i"));
  check("Mellanmålen syns i loggens tabell", text("l-table").includes("Mellanmål: Lättfil med kasein (235 kcal)"));
  go("logg");
  $("l-date").value = todayStr(); fire($("l-date"), "input");
  $("l-waist").value = "94"; fire($("logf"), "submit");
  check("Att spara loggen för hand behåller mellanmålen", snacksSaved().length === 2);
  go("idag");
  fire($("sn-list").querySelector('[data-snack-remove="0"]'), "click");
  check("Ett mellanmål går att ta bort", snacksSaved().length === 1 && snacksSaved()[0].n === "Banan" && kcalToday() === before + 105);
  fire($("sn-list").querySelector('[data-snack-remove="0"]'), "click");
  check("Utan mellanmål är dagens summa som förut", kcalToday() === before && planned() === plannedBefore && !$("sn-empty").hidden);

  // Energi: inskrivet intag och brända kalorier enligt klockan ger dagens energibalans
  const balanceTile = () => [...$("td-targets").querySelectorAll(".tile.wide")].find((t) => /balans|skott i dag/.test(t.textContent));
  check("Utan inskrivet intag och bränt ber Idag om dem", balanceTile()?.textContent.includes("Fyll i bränt från klockan"));
  go("logg");
  $("l-date").value = todayStr(); fire($("l-date"), "input");
  $("l-in-k").value = "2345"; $("l-in-p").value = "162"; $("l-burned").value = "967"; fire($("logf"), "submit");
  const saved = JSON.parse(win.localStorage.getItem("ffv-log")).entries.find((e) => e.date === todayStr());
  check("Ätit, protein och bränt sparas i dagens logg", saved.intakeK === 2345 && saved.intakeP === 162 && saved.burned === 967 && saved.waist === 94);
  check("Energin syns i loggens tabell", text("l-table").includes("Ätit 2 345 kcal · 162 g protein · bränt 967 kcal"));
  go("idag");
  const tdee = Number(balanceTile().textContent.match(/underhåll ([\d\s]+)/)[1].replace(/\D/g, ""));
  const balance = 2345 - tdee - 967;
  check("Idag visar det inskrivna intaget och dagens energibalans", kcalToday() === 2345 && text("td-targets").includes("inskrivet i loggen") &&
    balanceTile().textContent.includes(`bränt 967 enligt klockan`) && Number(balanceTile().querySelector(".v").textContent.replace(/[^\d]/g, "")) === Math.abs(balance));
  check("Rapporten visar energibalansen", text("rp-tiles").includes("Energibalans, snitt per dag") && text("rp-tiles").includes("ätit 2 345 kcal och 162 g protein, bränt 967 kcal"));
  go("logg");
  $("l-date").value = todayStr(); fire($("l-date"), "input");
  check("Loggen fyller i energin när dagen öppnas", $("l-in-k").value === "2345" && $("l-burned").value === "967");
  $("l-in-k").value = ""; $("l-in-p").value = ""; $("l-burned").value = ""; fire($("logf"), "submit");
  go("idag");
  check("Utan inskrivet intag räknas avbockningarna igen", kcalToday() === before);
}
{
  const { cleanEntry } = await import("../public/js/log.js");
  const e = cleanEntry({ date: "2026-10-25", weight: 82, snacks: [{ n: "Banan", k: 105, p: 1 }, { n: "", k: 5 }], framtida: { x: 1 } });
  check("Loggens poster behåller okända fält och städar mellanmålen", e.framtida?.x === 1 && e.snacks.length === 1 && e.snacks[0].n === "Banan");
  check("Äldre poster utan mellanmål får en tom lista", cleanEntry({ date: "2026-10-25", weight: 82 }).snacks.length === 0);
  const energy = cleanEntry({ date: "2026-10-25", intakeK: 2345, intakeP: 162, burned: 967 });
  check("Energin för dagen läses och felaktiga värden blir tomma", energy.intakeK === 2345 && energy.burned === 967 &&
    cleanEntry({ date: "2026-10-25", intakeK: -5, burned: "x" }).intakeK === null && cleanEntry({ date: "2026-10-25", weight: 82 }).burned === null);
}

// Inställningar → Måltider
{
  go("maltider");
  check("Måltider är en undersida under Inställningar", visible() === "installningar" && !$("maltider").closest("[data-page]").hidden && $("ml-dessert-on").checked);
  $("ml-dessert-on").checked = false; fire($("ml-dessert-on"), "change");
  check("Efterrätter avstängda: inga efterrätter i veckan och valet sparas", JSON.parse(win.localStorage.getItem("ffv-meals")).dessertDays.length === 0 && ![...$("week").querySelectorAll("small")].some((el) => el.textContent.startsWith("Efterrätt")));
  $("ml-dessert-on").checked = true; fire($("ml-dessert-on"), "change");
  check("Efterrätter på igen, alla dagar", JSON.parse(win.localStorage.getItem("ffv-meals")).dessertDays.length === 7);
  $("ml-cheat-day").value = "4"; fire($("ml-cheat-day"), "change");
  check("Fuskdagen går att välja: fredag", JSON.parse(win.localStorage.getItem("ffv-meals")).cheatDay === 4 && text("fusk").includes("Fuska på fredagen") && text("fusk").includes("Fredagsgodiset utgår"));
  check("Veckoschemat visar fredagsgodis på fredagen och inget godis på lördagen", $("week").querySelectorAll(".day")[4].textContent.includes("Fredagsgodis") && !$("week").querySelectorAll(".day")[5].textContent.includes("godis"));
  check("Tabellen för fri måltid gäller fredagen", $("cheat-table").querySelector("th").textContent === "Fredag");
  $("ml-cheat-day").value = "5"; fire($("ml-cheat-day"), "change");
  check("Tillbaka till lördag", text("fusk").includes("Fuska på lördagen"));
  go("inkopslista");
  check("Billiga råvaror ligger under Inställningar → Inköpslista", !$("ml-cheap").closest("[data-page]").hidden && $("ml-cheap").closest("[data-page]").dataset.page === "inkopslista");
  $("ml-cheap").checked = true; fire($("ml-cheap"), "change");
  check("Billiga råvaror sparas därifrån", JSON.parse(win.localStorage.getItem("ffv-meals")).cheap === true && text("ml-cheap-msg").startsWith("Sparat"));
  $("ml-cheap").checked = false; fire($("ml-cheap"), "change");
}

// Veckoschema: egna tider per dag, råd som inte blockerar
{
  // Arbetstid: förslagen hamnar utanför arbetet, och det som krockar ger en varning
  go("veckoschema");
  $("work-from").value = "08:00"; $("work-to").value = "17:00"; fire($("work-to"), "change");
  const sched = await import("../public/js/schedule.js");
  check("Arbetstiden sparas, måndag–fredag förvalt", JSON.stringify(sched.getWork()) === JSON.stringify({ from: "08:00", to: "17:00", days: [0, 1, 2, 3, 4] }));
  const int = sched.suggestion(1, "int", 7).int;
  check("Förslaget för intervaller en arbetsdag flyttas till efter jobbet", int.from === 17.5 && int.to === 19);
  check("Helgen påverkas inte av arbetstiden", sched.suggestion(5, "int", 7).int.from === 8.5);
  const clash = sched.scheduleAdvice([{ kind: "str", label: "Gympass", from: 10, to: 11.5 }], { eat: { from: 7, to: 15 }, work: sched.workOn(1) });
  check("Ett pass under arbetstiden ger en varning, men blockeras inte", clash.some((a) => a.level === "warn" && a.text.includes("krockar med arbetstiden")));
  fire($("work-clear"), "click");
  check("Arbetstiden går att ta bort", sched.getWork() === null);

  go("veckoschema");
  const days = JSON.parse(win.localStorage.getItem("ffv"))["tdays-val"].split(",").map(Number);
  const card = () => $("sched-list").querySelector(`[data-sched-day="${days[0]}"]`);
  check("Veckoschemat har ett kort per dag", $("sched-list").querySelectorAll("[data-sched-day]").length === 7 && visible() === "installningar");
  const set = (k, v) => { const el = card().querySelector(`.sched-row[data-kind="str"] [data-sched-time="${k}"]`); el.value = v; fire(el, "change"); };
  set("from", "16:00"); set("to", "17:30");
  check("En egen tid för gympasset sparas och syns i veckoschemat under Mat", JSON.parse(win.localStorage.getItem("ffv-schedule")).days[days[0]].str.from === "16:00" && $("week").querySelectorAll(".day")[days[0]].textContent.includes("16:00–17:30"));
  check("Sent pass efter ätfönstret ger en varning men blockeras inte", [...card().querySelectorAll(".advice li.warn")].some((li) => li.textContent.includes("efter att ätfönstret stängt")));
  fire(card().querySelector("[data-sched-reset]"), "click");
  check("Dagen går att återställa till förslaget", !JSON.parse(win.localStorage.getItem("ffv-schedule")).days?.[days[0]]);

  // Egna pass på flera dagar: CrossFit onsdag, fredag och lördag
  const ownExtra = (d) => (JSON.parse(win.localStorage.getItem("ffv-schedule") || "{}").days?.[d]?.extra || []).find((x) => x.label === "CrossFit");
  fire($("os-picks").querySelector('[data-os-pick="CrossFit"]'), "click");
  check("Snabbvalet CrossFit fyller i namnet och markerar hårt pass", $("os-name").value === "CrossFit" && $("os-hard").checked);
  $("os-from").value = "17:30"; $("os-to").value = "18:30";
  fire($("os-form"), "submit");
  check("Utan valda dagar sparas inget och det förklaras", text("os-msg").includes("Välj minst en dag") && !ownExtra(2));
  for (const d of [2, 4, 5]) $("os-days").querySelector(`[data-os-day="${d}"]`).checked = true;
  fire($("os-form"), "submit");
  check("CrossFit sparas som hårt pass onsdag, fredag och lördag", [2, 4, 5].every((d) => ownExtra(d)?.from === "17:30" && ownExtra(d).to === "18:30" && ownExtra(d).hard === true) && !ownExtra(0));
  check("Egna pass listas med dagar och tid", text("os-list").includes("CrossFit") && text("os-list").includes("ons, fre, lör 17:30–18:30"));
  check("Passen syns i veckans träning under Veckoschema", [2, 4, 5].every((d) => $("train-week").querySelectorAll("[data-week-day]")[d].textContent.includes("CrossFit")));
  $("os-name").value = "CrossFit"; $("os-from").value = "18:00"; $("os-to").value = "19:00";
  $("os-days").querySelector('[data-os-day="5"]').checked = true; fire($("os-form"), "submit");
  check("Samma pass igen samma dag ersätter det i stället för att lägga till ett till", ownExtra(5).from === "18:00" && JSON.parse(win.localStorage.getItem("ffv-schedule")).days[5].extra.filter((x) => x.label === "CrossFit").length === 1);
  // Ändrad tid i dagens kort behåller markeringen hårt pass
  {
    const row = $("sched-list").querySelector('[data-sched-day="2"] .sched-row[data-kind="other"]');
    const end = row.querySelector('[data-sched-time="to"]');
    end.value = "18:45"; fire(end, "change");
    check("Ändrad tid under dagen behåller markeringen hårt pass", ownExtra(2)?.to === "18:45" && ownExtra(2).hard === true);
  }
  const hard = sched.scheduleAdvice([{ kind: "str", label: "Gympass", from: 16, to: 17 }, { kind: "other", label: "CrossFit", from: 18, to: 19, hard: true }], { eat: { from: 11, to: 19 } });
  check("Hårt pass och gympass samma dag ger ett råd, men blockeras inte", hard.some((a) => a.level === "warn" && a.text.includes("två hårda pass")));
  check("En lättare aktivitet ger inget sådant råd", !sched.scheduleAdvice([{ kind: "str", label: "Gympass", from: 16, to: 17 }, { kind: "other", label: "Padel", from: 18, to: 19 }], { eat: { from: 11, to: 19 } }).some((a) => a.text.includes("hårda")));
  fire($("os-list").querySelector('[data-os-remove="CrossFit"]'), "click");
  check("Ta bort tar bort passet från alla dagar", [2, 4, 5].every((d) => !ownExtra(d)) && !text("os-list").includes("CrossFit"));
}

// Byt plats på måltider mellan dagar (Mat → Veckan)
{
  go("vecka");
  const dinnerOn = (d) => $("week").querySelectorAll(".day")[d].querySelectorAll("li a")[1].lastChild.textContent;
  const [monday, friday] = [dinnerOn(0), dinnerOn(4)];
  $("mv-meal").value = "1"; $("mv-a").value = "0"; $("mv-b").value = "4";
  fire($("mv-form"), "submit");
  check("Eftermiddagsmåltiderna på måndag och fredag byter plats", dinnerOn(0) === friday && dinnerOn(4) === monday && !$("mv-reset").hidden && text("mv-msg").includes("bytt plats"));
  fire($("mv-reset"), "click");
  // Dra och släpp: måndagens eftermiddagsmåltid släpps på tisdagen
  {
    const [mon, tue] = [dinnerOn(0), dinnerOn(1)];
    const pointer = (el, type) => el.dispatchEvent(Object.assign(new win.MouseEvent(type, { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }), { pointerId: 1 }));
    const handle = $("week").querySelectorAll(".day")[0].querySelector('li[data-meal="1"] .drag-handle');
    const realAt = win.document.elementFromPoint;
    win.document.elementFromPoint = () => $("week").querySelectorAll(".day")[1];
    pointer(handle, "pointerdown");
    pointer(handle, "pointermove");
    check("Dagen under pekaren markeras som mål", $("week").querySelectorAll(".day")[1].classList.contains("drop-target"));
    pointer(handle, "pointerup");
    win.document.elementFromPoint = realAt;
    check("Dra och släpp byter plats på måndagens och tisdagens eftermiddagsmåltid", dinnerOn(0) === tue && dinnerOn(1) === mon && !win.document.querySelector(".drag-ghost") && !$("mv-reset").hidden);
    check("Lördagsgodiset har inget handtag", !$("week").querySelector('li[data-meal="3"] .drag-handle'));
  }
  fire($("mv-reset"), "click");
  check("Återställ ger planens ordning igen", dinnerOn(0) === monday && dinnerOn(4) === friday && $("mv-reset").hidden);

  // Gympassen flyttas under Inställningar → Veckoschema, inte under Mat
  {
    check("Gympasset under Mat har inget handtag", !!$("week").querySelector(".chip.str") && !$("week").querySelector(".chip.str .drag-handle"));
    const slots = [...$("train-week").querySelectorAll("[data-week-day]")];
    const from = slots.find((d) => d.querySelector(".drag-handle")), to = slots.find((d) => d.querySelector(".chip.rest"));
    const name = from.querySelector(".chip").textContent.replace("⠿", "");
    check("Veckoschema visar passen dag för dag med handtag på gymdagarna", slots.length === 7 && !!from && !!to && $("tw-title").textContent.includes("Vecka"));
    const pointer = (el, type) => el.dispatchEvent(Object.assign(new win.MouseEvent(type, { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }), { pointerId: 1 }));
    const handle = from.querySelector(".drag-handle");
    const realAt = win.document.elementFromPoint;
    win.document.elementFromPoint = () => to;
    pointer(handle, "pointerdown");
    pointer(handle, "pointermove");
    pointer(handle, "pointerup");
    win.document.elementFromPoint = realAt;
    await tick();
    check("Dra ett pass frågar om veckan eller alla veckor", $("confirm").hasAttribute("open") && !$("confirm").querySelector('[data-answer="other"]').hidden);
    fire($("confirm").querySelector('[data-answer="yes"]'), "click"); await tick();
    const toDay = Number(to.dataset.weekDay);
    check("Passet ligger på den nya dagen den här veckan", $("train-week").querySelectorAll("[data-week-day]")[toDay].textContent.includes(name) && !$("wk-trainmoved").hidden && !$("wk-trainmoved-food").hidden);
    fire($("wk-trainreset"), "click");
    check("Passen kan läggas tillbaka enligt planen", !$("train-week").querySelectorAll("[data-week-day]")[toDay].textContent.includes(name) && $("wk-trainmoved").hidden && $("wk-trainmoved-food").hidden);
    // Upplägg: helkropp varje pass
    $("tw-split").value = "full"; fire($("tw-split"), "change");
    const gymSlots = () => [...$("train-week").querySelectorAll(".chip.str")].map((c) => c.textContent.replace("⠿", ""));
    check("Upplägget Helkropp varje pass ger helkropp alla gymdagar och sparas", gymSlots().length >= 3 && gymSlots().every((t) => t === "Helkropp") && JSON.parse(win.localStorage.getItem("ffv-schedule") || "{}").split === "full");
    $("tw-split").value = "auto"; fire($("tw-split"), "change");
    check("Appens förslag igen ger olika pass och tar bort fältet", new Set(gymSlots()).size > 1 && !("split" in JSON.parse(win.localStorage.getItem("ffv-schedule") || "{}")));
  }

  // Ersätt dagens eftermiddagsmåltid med Huel och flytta rätten till en annan dag
  go("idag");
  const today = (new Date().getDay() + 6) % 7;
  const planned = $("td-food").querySelectorAll("summary b")[1].textContent;
  $("sw-meal").value = "1"; fire($("sw-meal"), "change");
  const target = [...$("sw-move").options].find((o) => o.value !== "");
  check("Den planerade rätten kan flyttas till en annan dag", !$("sw-move-field").hidden && !!target);
  $("sw-move").value = target.value;
  $("sw-name").value = "Huel Powder"; $("sw-k").value = "400"; $("sw-p").value = "30";
  fire($("sw-form"), "submit");
  go("vecka");
  check("Rätten är flyttad till den valda dagen i veckan", dinnerOn(Number(target.value)) === planned);
  go("idag");
  check("Idag visar vad som ersattes och vart det flyttades", text("td-food").includes(`I stället för ${planned}, som är flyttad till`));
  fire($("td-food").querySelector("[data-unswap]"), "click");
  go("vecka");
  check("Ångra flyttar tillbaka rätten", dinnerOn(today) === planned);
  go("idag");
}

// Bocka av ätna måltider
{
  go("idag");
  const box = (i) => $("td-food").querySelector(`[data-eaten="${i}"]`);
  check("Varje måltid på Idag har en kryssruta för ätit", !!box(0) && !!box(1) && text("td-eaten").startsWith("Bocka av"));
  box(1).checked = true; fire(box(1), "change");
  const saved = JSON.parse(win.localStorage.getItem("ffv-log")).entries.find((e) => e.date === todayStr());
  check("Avbockningen sparas i dagens logg och Idag visar hur mycket som är ätet", saved?.eaten.join() === "1" && /^Ätit 1 av \d måltider: [\d\s]+ av [\d\s]+ kcal/.test(text("td-eaten")) && box(1).closest(".meal-row").classList.contains("eaten"));
  check("Loggen visar vad som är ätet", text("l-table").includes("Ätit: eftermiddagsmåltid"));
  go("vecka");
  const todayIdx = (new Date().getDay() + 6) % 7;
  const weekBox = $("week").querySelectorAll(".day")[todayIdx].querySelector('[data-eaten="1"]');
  check("Veckoschemat visar samma avbockning för i dag", weekBox?.checked && weekBox.closest("li").classList.contains("eaten"));
  weekBox.checked = false; fire(weekBox, "change");
  check("En avbockning går att ta bort från veckoschemat", !(JSON.parse(win.localStorage.getItem("ffv-log")).entries.find((e) => e.date === todayStr())?.eaten || []).includes(1));
  go("idag");
}

// Gympass: starta från programmet, avsluta och logga direkt (med en klocka som testet styr)
{
  const realNow = Date.now;
  let offset = 0;
  Date.now = () => realNow() + offset;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  check("Hemmapasset med intervalltimer är borttaget", !$("hemmapass") && !$("tm-form"));
  // Gympass: starta från programmet, avsluta och logga direkt
  go("traning");
  const startButtons = () => [...$("sessions").querySelectorAll("[data-start-session]")];
  check("Varje gympass har en knapp för att starta det", startButtons().length >= 3);
  const sessionName = startButtons()[0].dataset.startSession;
  fire(startButtons()[0], "click");
  check("Passet startar med en klocka och sparas så att det överlever en omladdning", !$("ws-run").hidden && text("ws-name") === sessionName && JSON.parse(win.localStorage.getItem("ffv-workout")).name === sessionName && $("traning").classList.contains("workout-running"));
  offset += 52 * 60 * 1000;
  fire($("ws-finish"), "click");
  const gymEntry = JSON.parse(win.localStorage.getItem("ffv-log")).entries.find((e) => e.date === todayStr());
  check("Avsluta loggar passet direkt: tränat, namn och längd", gymEntry.trained === true && gymEntry.perf === 0 && gymEntry.note.includes(`Gympass: ${sessionName}, 52 min`) && win.localStorage.getItem("ffv-workout") === null && $("ws-run").hidden && !$("ws-result").hidden);
  fire($("ws-result").querySelector("[data-edit-log]"), "click");
  await wait(100);
  check("Ändra i loggen öppnar dagens post i loggen", visible() === "logg" && $("l-date").value === todayStr() && $("l-note").value.includes(`Gympass: ${sessionName}`));
  Date.now = realNow;
}

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
// Sparad data från varje släppt version (tests/fixtures/data-<version>.json) ska läsas in utan att något går förlorat
for (const file of fs.readdirSync(new URL("./fixtures", import.meta.url)).filter((f) => /^data-[\d.]+\.json$/.test(f)).sort()) {
  const data = JSON.parse(fs.readFileSync(new URL(`./fixtures/${file}`, import.meta.url), "utf8"));
  reload(`data från ${file.slice(5, -5)}`, Object.fromEntries(Object.entries(data).map(([k, v]) => [k, JSON.stringify(v)])));
}
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
