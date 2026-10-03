// Kosttillskott: när PWO (koffein), vassle och kreatin passar in i dagen, utifrån fastan och dagens pass.
// Bygger på ExRx: kreatin 3–5 g/dag (eller 0,1 g/kg), helst efter passet med kolhydrater; koffein 200–400 mg
// cirka 30 min före passet; proteintajming spelar liten roll när dagsbehovet av protein redan täcks.

import { MEAL_AT, STRENGTH, INTERVALS } from "./day.js";
import { load, save } from "./util.js";
import { formatClock } from "./fasting.js";

const KEY = "ffv-supps";
export const SUPPLEMENTS = [["pwo", "PWO (koffein)"], ["whey", "Vassleprotein"], ["creatine", "Kreatin"]];
const CAFFEINE_LATEST = 15; // inget koffein efter kl 15, så att sömnen inte störs

export let using = new Set(load(KEY, ["pwo", "whey", "creatine"]));
export function setUsing(ids) {
  using = new Set(ids);
  save(KEY, [...using]);
}

/**
 * Dagens tips, sorterade efter tid. `start` = första måltiden (timmar), `kind` = "str" | "int" | "rest",
 * `weight` (kg) för kreatindosen.
 */
export function supplementTips({ start, kind, weight }) {
  const tips = [];
  const at = (offset) => start + offset;
  const workout = kind === "str" ? at(STRENGTH[0]) : kind === "int" ? at(INTERVALS[0]) : null;
  const workoutEnd = kind === "str" ? at(STRENGTH[1]) : kind === "int" ? at(INTERVALS[1]) : null;

  if (using.has("pwo") && workout != null) {
    const time = workout - 0.5;
    tips.push({
      at: time, name: "PWO",
      text: `30 minuter före passet. Räkna på koffeinet: 200–400 mg räcker, mindre om du är känslig.` +
        (time > CAFFEINE_LATEST ? " Passet ligger sent: välj koffeinfri PWO eller hoppa över den, så att du sover bra." : "") +
        " PWO utan kalorier bryter inte fastan i praktiken, men en med socker, kolhydrater eller BCAA gör det.",
    });
  }
  if (using.has("whey")) {
    const meal = at(MEAL_AT);
    if (workoutEnd != null && kind === "str") {
      tips.push({
        at: workoutEnd, name: "Vassle",
        text: meal - workoutEnd <= 1.5
          ? `Behövs inte i dag: eftermiddagsmåltiden kl. ${formatClock(meal)} kommer strax efter passet och ger proteinet. Ta 25–30 g direkt efter passet bara om måltiden blir senare.`
          : `25–30 g direkt efter passet, eftersom det dröjer till eftermiddagsmåltiden. Räkna in den: 30 g ger ca 115 kcal och 23 g protein, så ta en mindre efterrätt.`,
      });
    } else {
      tips.push({ at: meal, name: "Vassle", text: "Behövs inte i dag; recepten täcker proteinmålet. Ta den bara inne i ätfönstret, den bryter fastan." });
    }
  }
  if (using.has("creatine")) {
    tips.push({
      at: kind === "str" ? at(MEAL_AT) : start, name: "Kreatin",
      text: `3–5 g${weight ? ` (0,1 g/kg ≈ ${Math.round(weight * 0.1)} g, men mer än 5 g behövs inte)` : ""} varje dag, även vilodagar. ` +
        (kind === "str" ? "Ta det med eftermiddagsmåltiden efter passet; kolhydraterna i måltiden kan förbättra upptaget." : "Ta det med frukosten.") +
        (using.has("pwo") ? " Ta det inte samtidigt som PWO:n; en äldre studie visade att koffein kan motverka kreatinets effekt." : ""),
    });
  }
  return tips.sort((a, b) => a.at - b.at);
}

export const GENERAL_NOTES = [
  "Allt som innehåller kalorier, som vassle, ska tas inne i ätfönstret.",
  "Kreatin binder vatten i musklerna: vågen kan visa 0,5–2 kg mer de första veckorna. Det är inte fett; följ midjan och 7-dagarssnittet.",
  "Du är allergisk mot apelsin, mandarin och clementin: PWO och smaksatt vassle har ofta apelsin- eller tropisk smak med apelsin. Läs ingrediensförteckningen.",
];

