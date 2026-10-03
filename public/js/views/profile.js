// Profil: dagliga mål, prognos och uträkningen.

import { $, fmt, isoDate } from "../util.js";
import { kgPerWeek, goalForecast, bmiOf, weightAtBmi, recommendedGoal, BMI, TARGET_BMI } from "../nutrition.js";
import { tile } from "./components.js";



export function renderTargets(targets, goal) {
  const perWeek = kgPerWeek(targets.deficit);
  $("targets").innerHTML =
    tile({ label: "Kalorimål", value: fmt(targets.target), unit: "kcal/dag", sub: `Underhåll ≈ ${fmt(targets.tdee)} kcal`, main: true }) +
    tile({ label: "Protein", value: targets.protein, unit: "g", sub: `${fmt(targets.protein * 4)} kcal` }) +
    tile({ label: "Kolhydrater", value: targets.carbs, unit: "g", sub: `${fmt(targets.carbs * 4)} kcal` }) +
    tile({ label: "Fett", value: targets.fat, unit: "g", sub: `${fmt(targets.fat * 9)} kcal` });

  const after = (weeks) => fmt(targets.weight - perWeek * weeks, 1);
  let projection = `<span>Förväntad takt: <b class="num">${fmt(perWeek, 2)} kg/vecka</b></span>` +
    `<span>Efter 4 v: <b class="num">${after(4)} kg</b></span><span>8 v: <b class="num">${after(8)} kg</b></span><span>12 v: <b class="num">${after(12)} kg</b></span>`;
  const forecast = goalForecast(targets, goal);
  if (forecast) projection += `<span>Målvikt ${fmt(goal, 1)} kg: <b class="num">ca ${fmt(Math.ceil(forecast.weeks))} veckor</b> (${isoDate(forecast.date)})</span>`;
  $("projection").innerHTML = projection;
  $("flags").innerHTML = targets.flags.map((t) => `<div class="flag"><b>Obs</b><span>${t}</span></div>`).join("");
  $("steps").innerHTML = targets.steps.map((s) => `<li>${s}</li>`).join("");
}

const bmiClass = (bmi) => (bmi < BMI.under ? "undervikt" : bmi < BMI.over ? "normalvikt" : bmi < 30 ? "övervikt" : "fetma");

/**
 * Rutan under Målvikt: BMI, föreslagen målvikt vid BMI över 25 och prognos med appens kalorimål.
 * Visas i guiden och under Profil. `weight`, `height` och `goal` är det som står i fälten (null om tomt).
 */
export function renderGoalAdvice({ weight, height, goal, targets }) {
  const box = $("goal-info");
  box.hidden = !(weight > 0 && height > 0);
  if (box.hidden) return;
  const bmi = bmiOf(weight, height);
  const recommended = recommendedGoal(weight, height);
  const parts = [`Ditt BMI är <b class="num">${fmt(bmi, 1)}</b> (${fmt(weight, 1)} kg, ${fmt(height)} cm), vilket räknas som ${bmiClass(bmi)}. Normalvikt är BMI 18,5–24,9.`];
  if (recommended != null) {
    parts.push(`<b>Rekommenderad målvikt: ${fmt(recommended, 1)} kg</b>, vikten vid BMI ${fmt(TARGET_BMI, 1)}, mitt i normalviktsintervallet (mittemellan 18,5 och 24,9): ` +
      `<code>${fmt(TARGET_BMI, 1)} × ${fmt(height / 100, 2)}² = ${fmt(weightAtBmi(TARGET_BMI, height), 1)} kg</code>, avrundat till närmaste halva kilo.` +
      (goal === recommended ? " Den är ifylld som förslag; du kan ändra den." : ""));
  } else {
    parts.push("Appen föreslår ingen målvikt när BMI är 25 eller lägre; välj själv.");
  }
  if (goal > 0 && bmiOf(goal, height) < BMI.under) {
    parts.push(`<b>Obs:</b> målvikten motsvarar BMI ${fmt(bmiOf(goal, height), 1)}, under 18,5 (undervikt). Rådgör med vården innan du sätter ett så lågt mål.`);
  }
  const forecast = goal > 0 ? goalForecast(targets, goal) : null;
  if (forecast) {
    parts.push(`<b>Prognos:</b> med appens kalorimål, ${fmt(targets.target)} kcal per dag och ca ${fmt(forecast.perWeek, 2)} kg nedgång per vecka, ` +
      `når du ${fmt(goal, 1)} kg om ungefär <b class="num">${fmt(Math.ceil(forecast.weeks))} veckor</b> (${isoDate(forecast.date)}). ` +
      "Nedgången brukar avta när vikten minskar, så se det som en grov uppskattning.");
  } else if (goal > 0 && goal >= weight) {
    parts.push("Målvikten är inte lägre än din vikt, så det finns ingen prognos.");
  }
  box.innerHTML = parts.map((p) => `<p>${p}</p>`).join("") +
    `<p class="goal-source">En rekommendation baserad på <a href="https://exrx.net/Calculators/BMI" target="_blank" rel="noopener">ExRx BMI-kalkylator</a> (WHO:s gränser) och appens beräkningar, inte medicinsk rådgivning. ` +
    "ExRx påpekar att BMI kan bli missvisande för den som har mycket muskler, för vissa folkgrupper och för barn och äldre.</p>";
}
