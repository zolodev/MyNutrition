// Profil: dagliga mål, prognos och uträkningen.

import { $, fmt, DAY_MS } from "../util.js";
import { kgPerWeek } from "../nutrition.js";
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
  if (goal && goal < targets.weight && perWeek > 0) {
    const weeks = (targets.weight - goal) / perWeek;
    const date = new Date(Date.now() + weeks * 7 * DAY_MS).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });
    projection += `<span>Målvikt ${fmt(goal, 1)} kg: <b class="num">ca ${fmt(Math.ceil(weeks))} veckor</b> (${date})</span>`;
  }
  $("projection").innerHTML = projection;
  $("flags").innerHTML = targets.flags.map((t) => `<div class="flag"><b>Obs</b><span>${t}</span></div>`).join("");
  $("steps").innerHTML = targets.steps.map((s) => `<li>${s}</li>`).join("");
}
