// Egna träningstider per veckodag, t.ex. tisdag och torsdag 16:00–18:00 men lördag 11:00–13:00.
//
// Utan egen tid ligger styrkepasset som tidigare, räknat från frukosten (STRENGTH i day.js). En egen tid gäller
// gymdagen den veckodagen och används av Idag (tidslinjen och tillskottstipsen), veckoschemat och Profil.

import { load, save } from "./util.js";
import { parseClock } from "./fasting.js";
import { STRENGTH } from "./day.js";

const KEY = "ffv-traintimes"; // { "1": { from: "16:00", to: "18:00" }, … } (0 = måndag)

let times = clean(load(KEY, {}));

function clean(saved) {
  const result = {};
  for (const [day, t] of Object.entries(saved || {})) {
    const from = parseClock(t?.from), to = parseClock(t?.to);
    if (/^[0-6]$/.test(day) && from != null && to != null && to > from) result[day] = { from: t.from, to: t.to };
  }
  return result;
}

/** Den egna tiden en veckodag ({ from, to } som "HH:MM"), eller null. */
export const customTime = (day) => times[day] || null;

/** Spara en egen tid för en veckodag, eller ta bort den med `null`. Ger false om tiden inte går att använda. */
export function setTrainingTime(day, time) {
  if (!time) delete times[day];
  else {
    const checked = clean({ [day]: time })[day];
    if (!checked) return false;
    times[day] = checked;
  }
  save(KEY, times);
  return true;
}

/**
 * Styrkepassets tid en viss veckodag i timmar efter midnatt: { from, to, custom }. Den egna tiden om den finns,
 * annars planens tid räknat från frukosten (`breakfast` i timmar).
 */
export function strengthTime(day, breakfast) {
  const own = customTime(day);
  if (own) return { from: parseClock(own.from), to: parseClock(own.to), custom: true };
  return { from: breakfast + STRENGTH[0], to: breakfast + STRENGTH[1], custom: false };
}
