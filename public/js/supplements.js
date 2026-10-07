// Kosttillskott: när PWO (koffein), vassle, kasein, kreatin och egna tillskott passar in i dagen, utifrån fastan och dagens pass.
// Bygger på ExRx: kreatin 3–5 g/dag (eller 0,1 g/kg), helst efter passet med kolhydrater; koffein 200–400 mg
// cirka 30 min före passet; proteintajming spelar liten roll när dagsbehovet av protein redan täcks.

import { MEAL_AT, STRENGTH, INTERVALS, WINDOW } from "./day.js";
import { load, save } from "./util.js";
import { formatClock, parseClock } from "./fasting.js";
import { exclusions } from "./preferences.js";

const KEY = "ffv-supps";
export const SUPPLEMENTS = [["pwo", "PWO (koffein)"], ["whey", "Vassleprotein"], ["casein", "Kasein"], ["creatine", "Kreatin"]];
const CAFFEINE_LATEST = 15; // inget koffein efter kl 15, så att sömnen inte störs

export let using = new Set(load(KEY, ["pwo", "whey", "creatine"]));
export function setUsing(ids) {
  using = new Set(ids);
  save(KEY, [...using]);
}

// ---------- Egna tillskott ----------
// Användarens egna tillskott, t.ex. BCAA: namn, dos och när de tas. `kcal` = innehåller kalorier eller aminosyror
// och bryter fastan, så att tipset påminner om ätfönstret.

const MY_KEY = "ffv-mysupps";
export const SUPP_WHEN = { breakfast: "Med frukosten", before: "Före passet", after: "Efter passet", meal: "Med eftermiddagsmåltiden", clock: "Eget klockslag" };

/** Ett eget tillskott { id, n, dose, when, at, kcal }, eller null om namn eller tidpunkt saknas. */
export function cleanMySupp(m) {
  const n = typeof m?.n === "string" ? m.n.trim().slice(0, 40) : "";
  if (!n || !SUPP_WHEN[m.when]) return null;
  const at = m.when === "clock" ? (parseClock(m.at) != null ? m.at : null) : null;
  if (m.when === "clock" && !at) return null;
  return {
    id: /^ms_[\w-]+$/.test(m.id) ? m.id : "ms_" + Math.random().toString(36).slice(2, 9),
    n, dose: typeof m.dose === "string" ? m.dose.trim().slice(0, 40) : "", when: m.when, at, kcal: !!m.kcal,
  };
}
export let mySupps = (load(MY_KEY, []) || []).map(cleanMySupp).filter(Boolean);
export function addMySupp(m) {
  mySupps.push(m);
  save(MY_KEY, mySupps);
}
export function removeMySupp(id) {
  mySupps = mySupps.filter((m) => m.id !== id);
  save(MY_KEY, mySupps);
}
/** Används något tillskott alls (de inbyggda eller egna)? */
export const usesSupplements = () => using.size > 0 || mySupps.length > 0;

/**
 * Dagens tips, sorterade efter tid. `start` = första måltiden (timmar), `kind` = "str" | "int" | "rest",
 * `weight` (kg) för kreatindosen.
 */
export function supplementTips({ start, kind, weight, workout: own = null }) {
  const tips = [];
  const at = (offset) => start + offset;
  // `own` = passets egen tid i timmar ({ from, to }, se trainingtimes.js); annars räknat från frukosten
  const workout = own ? own.from : kind === "str" ? at(STRENGTH[0]) : kind === "int" ? at(INTERVALS[0]) : null;
  const workoutEnd = own ? own.to : kind === "str" ? at(STRENGTH[1]) : kind === "int" ? at(INTERVALS[1]) : null;

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
        text: workoutEnd > meal
          ? (workoutEnd <= at(WINDOW)
            ? `25–30 g direkt efter passet, eftersom passet slutar efter eftermiddagsmåltiden men före att ätfönstret stänger kl. ${formatClock(at(WINDOW))}. Räkna in den: 30 g ger ca 115 kcal och 23 g protein, så ta en mindre efterrätt.`
            : `Passet slutar efter att ätfönstret har stängt kl. ${formatClock(at(WINDOW))}, och vassle bryter fastan. Ät eftermiddagsmåltiden före passet, eller flytta frukosten senare så att ätfönstret täcker passet.`)
          : meal - workoutEnd <= 1.5
          ? `Behövs inte i dag: eftermiddagsmåltiden kl. ${formatClock(meal)} kommer strax efter passet och ger proteinet. Ta 25–30 g direkt efter passet bara om måltiden blir senare.`
          : `25–30 g direkt efter passet, eftersom det dröjer till eftermiddagsmåltiden. Räkna in den: 30 g ger ca 115 kcal och 23 g protein, så ta en mindre efterrätt.`,
      });
    } else {
      tips.push({ at: meal, name: "Vassle", text: "Behövs inte i dag; recepten täcker proteinmålet. Ta den bara inne i ätfönstret, den bryter fastan." });
    }
  }
  if (using.has("casein")) {
    tips.push({
      at: at(MEAL_AT), name: "Kasein",
      text: "Långsamt protein som håller dig mätt under fastan: 25–30 g med eftermiddagsmåltiden, som sista mål innan ätfönstret stänger. " +
        "Ta det inte före sängen, då bryter det fastan. Räkna in det: 30 g ger ca 110 kcal och 24 g protein. Kvarg är till största delen kasein, så äter du kvarg till efterrätt behövs det sällan.",
    });
  }
  for (const m of mySupps) {
    const time = { breakfast: start, meal: at(MEAL_AT), before: workout != null ? workout - 0.5 : null, after: workoutEnd, clock: parseClock(m.at) }[m.when];
    if (time == null) continue; // före eller efter passet en dag utan pass
    const inWindow = time >= start && time <= start + WINDOW;
    tips.push({
      at: time, name: m.n,
      text: [m.dose && `${m.dose}.`, `${SUPP_WHEN[m.when]}.`,
        m.kcal && (inWindow ? "Innehåller kalorier eller aminosyror: räkna in det, inom ätfönstret." : "Innehåller kalorier eller aminosyror och ligger utanför ätfönstret, så det bryter fastan. Flytta det till ätfönstret.")]
        .filter(Boolean).join(" "),
    });
  }
  if (using.has("creatine")) {
    tips.push({
      at: kind === "str" ? at(MEAL_AT) : start, name: "Kreatin",
      text: `3–5 g${weight ? ` (0,1 g/kg ≈ ${Math.round(weight * 0.1)} g, men mer än 5 g behövs inte)` : ""} varje dag, även vilodagar. ` +
        (kind === "str" ? "Ta det med eftermiddagsmåltiden efter passet; kolhydraterna i måltiden kan förbättra upptaget." : "Ta det med frukosten.") +
        (using.has("pwo") ? " Går bra att ta samtidigt som PWO:n; att koffein skulle motverka kreatinet har inte bekräftats av senare forskning. Ta det efter passet om kombinationen ger dig ont i magen." : ""),
    });
  }
  return tips.sort((a, b) => a.at - b.at);
}

/** Allmänna råd: bara de som gäller tillskotten användaren tar och allergierna hen har valt bort. */
export function generalNotes() {
  const citrus = ["apelsin", "mandarin", "clementin"].filter((a) => exclusions.allergens.has(a));
  return [
    "Allt som innehåller kalorier, som vassle, ska tas inne i ätfönstret.",
    using.has("creatine") && "Kreatin binder vatten i musklerna: vågen kan visa 0,5–2 kg mer de första veckorna. Det är inte fett; följ midjan och 7-dagarssnittet.",
    citrus.length && `Du har valt bort ${citrus.join(", ")}: PWO och smaksatt vassle har ofta apelsinsmak eller tropisk smak med apelsin. Läs ingrediensförteckningen.`,
  ].filter(Boolean);
}

