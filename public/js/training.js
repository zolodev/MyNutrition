// Träningsprogrammet: vilka pass som körs och vilka dagar.

import { EXERCISES, CORE } from "./data/exercises.js";
import { DAYS, seededRandom } from "./util.js";

/** Hur ofta övningarna byts, i veckor, och hur det skrivs. */
export const SWAP_TEXT = { 1: "varje vecka", 2: "varannan vecka", 4: "var fjärde vecka" };

/**
 * Välj övning för en rörelse. Alternativen gås igenom i tur och ordning: varje period flyttar ett steg,
 * så samma övning kommer inte två perioder i rad och alla alternativ återkommer. Startpunkten per rörelse
 * kommer från planens frö, så plankoden ger samma övningar. `occurrence` gör att samma rörelse får olika
 * övningar när den förekommer flera gånger i veckan (t.ex. knäböj både på helkropp och ben).
 */
function variantPicker({ seed = 0, week = 0, period = 1 }) {
  const block = Math.floor(week / period);
  const used = {};
  return (alternatives, slot) => {
    const occurrence = (used[slot] = (used[slot] ?? -1) + 1);
    const start = Math.floor(seededRandom(seed * 31 + [...slot].reduce((h, c) => h * 33 + c.charCodeAt(0), 7))() * alternatives.length);
    return alternatives[(start + block + occurrence) % alternatives.length];
  };
}

/**
 * Läs gymdagarna från en sträng som "1,3,5" (0 = måndag). Programmet finns för 3 eller 4 dagar;
 * vid annat antal används `fallback` (senaste giltiga valet).
 */
export function parseTrainingDays(value, fallback) {
  const days = [...new Set(String(value).split(",").map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort((a, b) => a - b);
  const valid = days.length === 3 || days.length === 4;
  return { days: valid ? days : fallback, picked: days, valid };
}

/** Bygg passen för vald utrustning och antal dagar; övningarna väljs för veckan med `variation`. */
function buildSessions(equipment, dayCount, variation) {
  const pick = variantPicker(variation);
  const E = new Proxy(EXERCISES[equipment], { get: (alternatives, slot) => pick(alternatives[slot], slot) });
  const bodyweight = equipment === "bw";
  const main = bodyweight ? "3 × 8–20" : "3 × 6–10";
  const accessory = bodyweight ? "3 × 10–20" : "2–3 × 10–15";
  const small = bodyweight ? "2 × 10–20" : "2 × 10–15";
  const ex = (exercise, sets, rest, muscles) => ({ name: exercise[0], path: exercise[1], sets, rest, muscles });
  const core = {
    plank: ex(CORE.plank, "3 × 20–45 s", "60 s", "Bål, framsida"),
    side: ex(CORE.side, "2–3 × 20–40 s/sida", "45 s", "Bål, sidor"),
    birddog: ex(CORE.birddog, "3 × 8–10/sida", "45 s", "Bål och ländrygg"),
    rear: ex(CORE.rear, "3 × 20–40 s", "45 s", "Ländrygg och säte"),
    circuit: { circuit: true, items: CORE.circuit[equipment].map(([name, path, reps]) => ({ name, path, sets: reps })) },
  };
  // Byggs per pass, så att varje förekomst av en rörelse får sin egen övning
  const legs = () => [
    ex(E.squat, main, "2 min", "Framsida lår och säte"),
    ex(E.hinge, main, "2 min", "Baksida lår och säte"),
    ex(E.single, accessory, "90 s", "Lår, ett ben i taget"),
    ex(E.glute, accessory, "90 s", "Säte och baksida lår"),
  ];
  const upper = () => [
    ex(E.push, main, "2 min", "Bröst"),
    ex(E.row, main, "2 min", "Rygg"),
    ex(E.vpush, accessory, "90 s", "Axlar"),
    ex(E.vpull, accessory, "90 s", "Rygg, bredd"),
    ex(E.push2, "2 × max −2", "60 s", "Bröst och triceps"),
  ];

  if (dayCount === 3) {
    return {
      title: "Helkropp, överkropp och ben",
      legSessions: ["H", "B"],
      upperSessions: ["H", "Ö"],
      sessions: [
        { id: "H", name: "Helkropp", items: [ex(E.squat, main, "2 min", "Lår och säte"), ex(E.push, main, "2 min", "Bröst"), ex(E.row, main, "90 s", "Rygg"), ex(E.vpush, accessory, "90 s", "Axlar"), core.plank] },
        { id: "Ö", name: "Överkropp", items: [ex(E.push, main, "2 min", "Bröst"), ex(E.vpull, main, "2 min", "Rygg, bredd"), ex(E.row, accessory, "90 s", "Rygg, tjocklek"), ex(E.vpush, accessory, "90 s", "Axlar"), ex(E.curl, small, "60 s", "Biceps"), ex(E.tri, small, "60 s", "Triceps"), core.circuit] },
        { id: "B", name: "Ben", items: [...legs(), ex(E.calf, "3 × 10–15", "60 s", "Vader"), core.side, core.birddog] },
      ],
    };
  }
  return {
    title: "Över/under-split 4 dagar i veckan",
    legSessions: ["UA", "UB"],
    upperSessions: ["OA", "OB"],
    sessions: [
      { id: "UA", name: "Underkropp A", items: [...legs(), core.side] },
      { id: "OA", name: "Överkropp A", items: [...upper(), core.plank] },
      { id: "UB", name: "Underkropp B", items: [...legs(), core.birddog, core.rear] },
      { id: "OB", name: "Överkropp B", items: [...upper(), core.circuit] },
    ],
  };
}

/**
 * Fördela passen på dagarna så att samma muskler inte tränas två dagar i rad när det går att undvika.
 * Alla ordningar provas; ben två dagar i rad kostar mest, överkropp två dagar i rad lite mindre.
 * Vid lika behålls standardordningen. Söndag följs av måndag.
 */
function placeSessions(days, ids, penalties) {
  const permutations = (list) => (list.length <= 1 ? [list] : list.flatMap((x, i) => permutations([...list.slice(0, i), ...list.slice(i + 1)]).map((rest) => [x, ...rest])));
  let best = null;
  let bestScore = Infinity;
  permutations(ids).forEach((order, rank) => {
    const sessionOn = {};
    days.forEach((d, i) => (sessionOn[d] = order[i]));
    let score = rank * 0.01;
    for (const d of days) {
      const next = sessionOn[(d + 1) % 7];
      if (next) for (const { group, cost } of penalties) if (group.includes(sessionOn[d]) && group.includes(next)) score += cost;
    }
    if (score < bestScore) {
      bestScore = score;
      best = sessionOn;
    }
  });
  return { sessionOn: best, clash: bestScore >= 1 };
}

/** Intervaller på upp till två vilodagar: helst inte dagen före ett benpass, och aldrig två dagar i rad. */
function placeIntervals(sessionOn, legSessions) {
  const rest = [0, 1, 2, 3, 4, 5, 6].filter((d) => !sessionOn[d]);
  const preferred = rest.filter((d) => !legSessions.includes(sessionOn[(d + 1) % 7]));
  const chosen = [];
  for (const d of [...preferred, ...rest]) {
    const adjacent = chosen.some((x) => Math.abs(x - d) === 1 || Math.abs(x - d) === 6);
    if (chosen.length < 2 && !chosen.includes(d) && !adjacent) chosen.push(d);
  }
  return chosen;
}

/**
 * Hela programmet. `schedule[dag]` är { kind: "str" | "int" | "rest", label, session }.
 * `variation` = { seed, week, period } styr vilka övningar veckan får; passindelningen ändras aldrig.
 */
export function buildProgram(equipment, days, variation = {}) {
  const program = buildSessions(equipment, days.length, variation);
  const { sessionOn, clash } = placeSessions(days, program.sessions.map((s) => s.id), [
    { group: program.legSessions, cost: 10 },
    { group: program.upperSessions, cost: 5 },
  ]);
  const intervals = placeIntervals(sessionOn, program.legSessions);
  const sessionById = Object.fromEntries(program.sessions.map((s) => [s.id, s]));
  const schedule = DAYS.map((_, d) => {
    if (sessionOn[d]) return { kind: "str", label: sessionById[sessionOn[d]].name, session: sessionOn[d] };
    return intervals.includes(d) ? { kind: "int", label: "Intervaller" } : { kind: "rest", label: "Vila + steg" };
  });
  for (const s of program.sessions) s.days = DAYS.filter((_, d) => sessionOn[d] === s.id).map((d) => d.slice(0, 3));

  const parts = days.map((d) => `${sessionById[sessionOn[d]].name.toLowerCase().replace(/ (a|b)$/, (m) => m.toUpperCase())} på ${DAYS[d].toLowerCase()}`);
  const summary = `${parts.slice(0, -1).join(", ")} och ${parts[parts.length - 1]}.`;
  return { ...program, schedule, clash, summary: summary[0].toUpperCase() + summary.slice(1) };
}
