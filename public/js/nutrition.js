// Energibehov, makromål och skalning av portioner. Inga beroenden till sidan, så allt här går att testa fristående.

import { FOOD, scaleGroupOf } from "./data/foods.js";
import { fmt, clamp, DAY_MS } from "./util.js";

const KCAL_PER_KG_FAT = 7700;
const MAX_DEFICIT = 1000; // kcal/dag
const FLOOR = { m: 1500, k: 1200 }; // lägsta kalorimål utan medicinsk uppföljning

/**
 * Räkna ut dagliga mål från profilen.
 * Returnerar siffrorna plus `steps` (uträkningen som text) och `flags` (varningar), båda som HTML.
 */
export function computeTargets(p) {
  const { sex, age, weight: w, height: h, bodyFat: bf, activity, rate } = p;
  const steps = [];
  const flags = [];

  // 1. Basbehov: Katch-McArdle om fettprocent finns, annars Harris-Benedict (1919), som i ExRx kalkylator.
  let bmr;
  let leanMass = null;
  if (bf > 0 && bf < 70) {
    leanMass = w * (1 - bf / 100);
    bmr = 370 + 21.6 * leanMass;
    steps.push(`Fettfri massa: <code>${fmt(w, 1)} × (1 − ${fmt(bf, 1)}/100) = ${fmt(leanMass, 1)} kg</code>`);
    steps.push(`BMR med Katch-McArdle: <code>370 + 21,6 × ${fmt(leanMass, 1)} = ${fmt(bmr)} kcal</code>`);
  } else if (sex === "m") {
    bmr = 66.5 + 13.75 * w + 5.003 * h - 6.755 * age;
    steps.push(`BMR med Harris-Benedict (män): <code>66,5 + 13,75×${fmt(w, 1)} + 5,003×${h} − 6,755×${age} = ${fmt(bmr)} kcal</code>`);
  } else {
    bmr = 655.1 + 9.563 * w + 1.85 * h - 4.676 * age;
    steps.push(`BMR med Harris-Benedict (kvinnor): <code>655,1 + 9,563×${fmt(w, 1)} + 1,850×${h} − 4,676×${age} = ${fmt(bmr)} kcal</code>`);
  }

  // 2. Underhållsbehov
  const tdee = bmr * activity;
  steps.push(`Underhållsbehov: <code>${fmt(bmr)} × ${String(activity).replace(".", ",")} = ${fmt(tdee)} kcal</code>. Styrkepassen och stegen räknas inte in, de ger en extra marginal.`);

  // 3. Kalorimål: underskott för vald takt, högst 1 000 kcal och aldrig under golvet
  const wantedDeficit = ((rate / 100) * w * KCAL_PER_KG_FAT) / 7;
  let deficit = Math.min(wantedDeficit, MAX_DEFICIT);
  let target = tdee - deficit;
  if (wantedDeficit > MAX_DEFICIT) {
    flags.push(`Önskad takt kräver ${fmt(wantedDeficit)} kcal underskott per dag. Underskottet är begränsat till 1 000 kcal för att skydda muskler och ork.`);
  }
  const floor = FLOOR[sex] ?? FLOOR.k;
  if (target < floor) {
    flags.push(`Kalorimålet skulle hamna under ${fmt(floor)} kcal. Det är höjt till golvet; öka hellre stegen än att äta mindre.`);
    target = floor;
    deficit = Math.max(0, tdee - target);
  }
  target = Math.round(target / 10) * 10;
  steps.push(`Underskott för ${String(rate).replace(".", ",")} %/vecka: <code>${fmt((rate / 100) * w, 2)} kg × 7 700 kcal/kg ÷ 7 = ${fmt(wantedDeficit)} kcal/dag</code>${wantedDeficit > MAX_DEFICIT ? " → begränsat till 1 000" : ""}. Kalorimål: <b>${fmt(target)} kcal</b>.`);

  // 4. Makron: mycket protein, lite fett, resten kolhydrater.
  //    Vid övervikt räknas protein och fett på vikten vid BMI 27, eftersom fettvävnad inte behöver protein.
  const refWeight = Math.min(w, 27 * (h / 100) ** 2);
  let protein;
  let proteinText;
  if (leanMass) {
    protein = 2.8 * leanMass;
    proteinText = `<code>2,8 g × ${fmt(leanMass, 1)} kg fettfri massa</code>`;
  } else {
    protein = 2.2 * refWeight;
    proteinText = `<code>2,2 g × ${fmt(refWeight, 1)} kg</code>${refWeight < w ? " (vikten vid BMI 27, eftersom överskottsfett inte behöver protein)" : ""}`;
  }
  protein = Math.round(protein / 5) * 5;
  const fat = Math.round((0.6 * refWeight) / 5) * 5;
  const carbs = Math.max(75, Math.round((target - protein * 4 - fat * 9) / 4 / 5) * 5);
  steps.push(`Protein ${proteinText} = <b>${protein} g</b>. Högt protein skyddar musklerna i underskott och mättar bäst (ExRx/ISSN: 1,4–2,0 g/kg för tränande, upp till 2,2 g/kg vid underskott). Fett hålls lågt, 0,6 g/kg = <b>${fat} g</b> (ca ${fmt(((fat * 9) / target) * 100)} % av kalorierna; under 0,5 g/kg rekommenderas inte eftersom kroppen behöver fett för hormoner och upptag av vitaminer). Resten blir kolhydrater = <b>${carbs} g</b>, lågt men tillräckligt för styrketräning: ExRx påpekar att styrkepass bara tömmer 25–40 % av musklernas glykogen.`);

  return { target, tdee, bmr, deficit, protein, fat, carbs, weight: w, flags, steps };
}

/** Förväntad viktnedgång i kg per vecka för ett dagligt underskott. */
export const kgPerWeek = (deficit) => (deficit * 7) / KCAL_PER_KG_FAT;

// ---------- BMI och målvikt ----------
// Gränser enligt ExRx BMI-kalkylator (WHO 1997): under 18,5 undervikt, 18,5–24,9 normalvikt, 25–29,9 övervikt.

export const BMI = { under: 18.5, normalMax: 24.9, over: 25 };
/** Målet: mitt i normalviktsintervallet, (18,5 + 24,9) / 2 = 21,7. Ger marginal åt båda hållen. */
export const TARGET_BMI = (BMI.under + BMI.normalMax) / 2;
export const bmiOf = (weight, heightCm) => weight / (heightCm / 100) ** 2;
export const weightAtBmi = (bmi, heightCm) => bmi * (heightCm / 100) ** 2;

/** Föreslagen målvikt när BMI är över 25: vikten vid BMI 21,7 (mitt i normalvikt), avrundad till halvt kilo. Annars null. */
export function recommendedGoal(weight, heightCm) {
  if (!(weight > 0 && heightCm > 0) || bmiOf(weight, heightCm) <= BMI.over) return null;
  return Math.round(weightAtBmi(TARGET_BMI, heightCm) * 2) / 2;
}

/** Hur lång tid till målvikten med appens kalorimål: { weeks, date } eller null om målet inte är lägre än vikten. */
export function goalForecast(targets, goal) {
  const perWeek = kgPerWeek(targets.deficit);
  if (!(goal > 0 && goal < targets.weight && perWeek > 0)) return null;
  const weeks = (targets.weight - goal) / perWeek;
  return { weeks, perWeek, date: new Date(Date.now() + weeks * 7 * DAY_MS) };
}

/** Summera kalorier och makron för en lista [livsmedel, gram]. */
export function macros(items) {
  const m = { k: 0, p: 0, c: 0, f: 0 };
  for (const [id, grams] of items) for (const key in m) m[key] += (FOOD[id][key] * grams) / 100;
  return m;
}

/**
 * Skala mängderna med en faktor per livsmedelsgrupp ({p, c, f, o}).
 * Styckvaror avrundas till hela stycken, övrigt till närmaste 5 g (minst 5 g).
 */
export function scaleItems(items, factors) {
  return items.map(([id, grams]) => {
    const food = FOOD[id];
    const factor = factors[scaleGroupOf(id)];
    if (food.per) return [id, Math.max(1, Math.round((grams * factor) / food.per)) * food.per];
    return [id, Math.max(5, Math.round((grams * factor) / 5) * 5)];
  });
}

/**
 * Hitta skalfaktorer för protein-, kolhydrat- och fettkällor så att veckans meny träffar målen.
 *
 * `fixedItems` skalas inte (lördagsgodiset). Grönsaker, bär och frukt ("o") behåller sina mängder.
 * Först löses ekvationssystemet för protein, kolhydrater och fett (Cramers regel). Faktorerna begränsas
 * till rimliga portioner, och till sist justeras kolhydratkällorna så att kalorierna stämmer.
 */
export function solveScaling(scalableItems, fixedItems, targets, days = 7) {
  const sum = { p: [0, 0, 0, 0], c: [0, 0, 0, 0], f: [0, 0, 0, 0], o: [0, 0, 0, 0] }; // [kcal, protein, kolhydrater, fett]
  const fixed = [0, 0, 0, 0];
  const add = (into, id, grams) => [FOOD[id].k, FOOD[id].p, FOOD[id].c, FOOD[id].f].forEach((v, i) => (into[i] += (v * grams) / 100));
  for (const [id, grams] of scalableItems) add(sum[scaleGroupOf(id)], id, grams);
  for (const [id, grams] of fixedItems) add(fixed, id, grams);

  const goal = [targets.target, targets.protein, targets.carbs, targets.fat].map((v, i) => v * days - fixed[i] - sum.o[i]);
  const matrix = [1, 2, 3].map((i) => [sum.p[i], sum.c[i], sum.f[i]]);
  const rhs = [goal[1], goal[2], goal[3]];
  const det3 = (m) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const d = det3(matrix);
  const solve = (col) => det3(matrix.map((row, i) => row.map((v, k) => (k === col ? rhs[i] : v)))) / d;

  const p = clamp(solve(0), 0.8, 2.5);
  const f = clamp(solve(2), 0.5, 3);
  const c = clamp((goal[0] - p * sum.p[0] - f * sum.f[0]) / sum.c[0], 0.3, 2);
  return { p, c, f, o: 1 };
}

/** Mängd som text, t.ex. "2 st (120 g)" eller "350 g". */
export function formatAmount(id, grams) {
  const food = FOOD[id];
  if (!food.per) return `${fmt(grams)} g`;
  const count = Math.round(grams / food.per);
  const unit = food.unit === "st" ? "st" : count === 1 ? "skiva" : "skivor";
  return `${count} ${unit} (${fmt(grams)} g)`;
}
