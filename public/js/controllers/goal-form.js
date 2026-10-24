// Logg → Löpmål: formuläret där veckomål och tidsmål sätts (goals.js). Tiden skrivs som i loggen: siffror får
// kolon medan man skriver, 003000 → 00:30:00.

import { $, num, checkDecimal, toast } from "../util.js";
import { parseWorkoutTime } from "../log.js";
import { setGoal } from "../goals.js";
import { onTimeInput, onTimeChange } from "./log-form.js";

let update = () => {}; // ritar om appen; sätts av initGoalForm()

$("g-time").addEventListener("input", onTimeInput);
$("g-time").addEventListener("change", onTimeChange);

$("l-goal-form").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const invalid = ["g-week-km", "g-week-runs", "g-dist"].map($).find((el) => !checkDecimal(el));
  if (invalid) return invalid.reportValidity();
  const timeText = $("g-time").value.trim();
  const timeS = timeText ? parseWorkoutTime(timeText) : null;
  if (timeText && !timeS) {
    $("g-time").setCustomValidity("Skriv tiden som hh:mm:ss, t.ex. 00:30:00");
    return $("g-time").reportValidity();
  }
  const distKm = num($("g-dist").value);
  if ((distKm == null) !== (timeS == null)) {
    $("g-msg").textContent = "Fyll i både distans och tid för tidsmålet, eller lämna båda tomma.";
    return;
  }
  const runs = num($("g-week-runs").value);
  setGoal("lopning", { weekKm: num($("g-week-km").value), weekRuns: runs == null ? null : Math.round(runs), distKm, timeS });
  $("g-msg").textContent = "";
  $("l-goal-edit").open = false;
  update();
  toast("Löpmålen är sparade.");
});

/** Koppla formuläret till appen. */
export function initGoalForm(deps) {
  update = deps.update;
}
