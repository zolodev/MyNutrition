// Idag: dagens måltider och träning, samt tidslinjerna för fasta och träning.

import { $, esc, fmt, hhmm, todayIndex, todayStr, DAYS } from "../util.js";
import { daySchedule, scheduleAdvice, workoutOf, workOn } from "../schedule.js";
import { MEAL_NAMES, entryFor } from "../log.js";
import { treatName } from "../preferences.js";
import { NONE } from "../data/recipes.js";
import { totals } from "../menu.js";
import { MEAL_AT, WINDOW, STRENGTH, INTERVALS } from "../day.js";
import { tile } from "./components.js";
import { supplementTips, generalNotes, usesSupplements } from "../supplements.js";
import { formatClock } from "../fasting.js";
import { recipeRow } from "./food.js";
import { sessionBlock } from "./training-view.js";
import { renderTimeline } from "./timeline.js";


/**
 * Idag: dagens tider, recept och träning.
 * `week` = buildWeek() för innevarande vecka, `program` = buildProgram(), `breakfast` = frukosttid i timmar,
 * `swaps` = dagens ersatta måltider från loggen ({ meal, n, k, p }).
 */
export function renderToday({ week, targets, program, breakfast, weight, swaps = [], snacks = [] }) {
  const index = todayIndex();
  const day = week.plan[index];
  const training = program.schedule[index];
  const t = (offset) => hhmm(breakfast + offset);
  const at = (offset) => breakfast + offset;

  $("td-date").textContent = new Date().toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" });
  $("td-title").textContent =
    training.kind === "str" ? `Gymdag: ${training.label[0].toLowerCase() + training.label.slice(1)}` : training.kind === "int" ? "Intervalldag" : "Vilodag";
  $("td-sub").textContent = `Frukost ${t(0)}, eftermiddagsmåltid ${t(MEAL_AT)}, sedan fasta till i morgon ${t(0)}.`;

  // Dagens summa: planens recept, utom de måltider som ersattes med något annat
  const swapOf = (i) => swaps.find((x) => x.meal === i);
  const planned = totals(day.filter((id, i) => id !== NONE && !swapOf(i)), week.recipes);
  const withSwaps = swaps.reduce((acc, x) => (day[x.meal] && day[x.meal] !== NONE ? { ...acc, k: acc.k + x.k, p: acc.p + x.p } : acc), planned);
  // Mellanmål och snacks utöver planen läggs till både dagens summa och det som är ätet
  const extra = snacks.reduce((acc, x) => ({ k: acc.k + x.k, p: acc.p + x.p }), { k: 0, p: 0 });
  const sum = { ...withSwaps, k: withSwaps.k + extra.k, p: withSwaps.p + extra.p };
  // Ätet hittills: avbockade måltider och ersatta (en ersättning är något man har ätit i stället)
  const eaten = new Set([...(entryFor(todayStr())?.eaten || []), ...swaps.map((x) => x.meal)].filter((i) => day[i] && day[i] !== NONE));
  const mealKcal = (i) => swapOf(i) ? { k: swapOf(i).k, p: swapOf(i).p } : week.recipes[day[i]].m;
  const ate = [...eaten].reduce((acc, i) => ({ k: acc.k + mealKcal(i).k, p: acc.p + mealKcal(i).p }), extra);
  const planWord = snacks.length ? "med mellanmål" : "planerat";
  $("td-targets").innerHTML =
    tile({ label: "Ätit i dag", value: fmt(ate.k), unit: "kcal", sub: `av ${fmt(sum.k)} ${planWord} · mål ${fmt(targets.target)}`, main: true }) +
    tile({ label: "Protein", value: fmt(ate.p), unit: "g", sub: `av ${fmt(sum.p)} g ${planWord} · mål ${fmt(targets.protein)}` }) +
    tile({ label: "Fasta", value: 16, unit: "h", sub: `${t(WINDOW)}–${t(0)}` });

  // Dagens tidslinje: ätfönstret och dagens aktiviteter enligt veckoschemat (egna tider, annars planens förslag)
  const items = daySchedule(index, training.kind, breakfast);
  const span = (x) => `${formatClock(x.from)}–${formatClock(x.to)}`;
  renderTimeline($("td-timeline"), [{ from: at(0), to: at(WINDOW), cls: "eat", label: `Ätfönster ${t(0)}–${t(WINDOW)}` },
    ...items.map((x) => ({ from: x.from, to: x.to, cls: x.kind === "other" ? (x.hard ? "int" : "walk") : x.kind, label: `${x.label} ${span(x)}` }))],
  [{ at: at(0), label: `Frukost ${t(0)}` }, { at: at(MEAL_AT), label: `Måltid ${t(MEAL_AT)}` }]);
  const next = program.schedule[(index + 1) % 7];
  const advice = scheduleAdvice(items, { work: workOn(index), eat: { from: at(0), to: at(WINDOW) }, nextIsLegs: next.kind === "str" && program.legSessions.includes(next.session) });
  $("td-advice").innerHTML = advice.map((a) => `<li class="${a.level}">${esc(a.text)}</li>`).join("");

  // Dagens recept, fullständiga
  const meals = [[t(0), "Frukost"], [t(MEAL_AT), "Måltid"], [t(MEAL_AT), "Efterrätt"], [t(MEAL_AT), treatName()], [t(MEAL_AT), "Tillbehör"]];
  // Varje måltid har en kryssruta för att bocka av den som ätit (sparas i dagens logg, se setEaten i log.js)
  // En ersatt måltid räknas som ätit och kan inte bockas ur (Ångra tar bort ersättningen)
  const check = (i) => `<label class="eat-check" title="Ätit"><input type="checkbox" data-eaten="${i}"${eaten.has(i) ? " checked" : ""}${swapOf(i) ? " disabled" : ""} aria-label="Ätit ${MEAL_NAMES[i].toLowerCase()}"></label>`;
  $("td-food").innerHTML = day.map((id, i) => {
    if (id === NONE) return "";
    const swap = swapOf(i);
    const done = eaten.has(i) ? " eaten" : "";
    // Knappen Ersätt öppnar formuläret nedanför med måltiden förvald (controllers/meal-swap.js)
    if (!swap) return `<div class="meal-row${done}">${check(i)}${recipeRow(week.recipes[id], `${meals[i][0]} ${meals[i][1]}`, false)}` +
      `<button type="button" class="linkbtn swap-this" data-swap-meal="${i}">Åt något annat? Ersätt</button></div>`;
    return `<div class="meal-row${done}">${check(i)}<div class="row swapped"><span class="kind">${meals[i][0]} ${meals[i][1]}</span><span class="main"><b>${esc(swap.n)}</b>` +
      `<small>I stället för ${esc(swap.was || week.recipes[id].t)}${swap.moved != null ? `, som är flyttad till ${DAYS[swap.moved].toLowerCase()}` : ""}</small></span><span class="end">${fmt(swap.k)} kcal · ${fmt(swap.p)} g P ` +
      `<button type="button" class="linkbtn" data-unswap="${i}">Ångra</button></span></div></div>`;
  }).join("");
  // Hur mycket av dagen som är ätet
  const mealCount = day.filter((id) => id !== NONE).length;
  const snackText = snacks.length ? ` och ${snacks.length} mellanmål` : "";
  $("td-eaten").textContent = eaten.size || snacks.length
    ? `Ätit ${eaten.size} av ${mealCount} måltider${snackText}: ${fmt(ate.k)} av ${fmt(sum.k)} kcal och ${fmt(ate.p)} av ${fmt(sum.p)} g protein.`
    : "Bocka av måltiderna när du har ätit dem.";
  // Mellanmål och snacks (controllers/meal-swap.js)
  $("sn-list").innerHTML = snacks.map((x, i) => `<li><span class="main"><b>${esc(x.n)}</b></span><span class="end">${fmt(x.k)} kcal · ${fmt(x.p)} g P ` +
    `<button type="button" class="linkbtn" data-snack-remove="${i}" aria-label="Ta bort ${esc(x.n)}">Ta bort</button></span></li>`).join("");
  $("sn-list").hidden = !snacks.length;
  $("sn-empty").hidden = snacks.length > 0;
  // Formuläret för att ersätta en måltid: dagens måltider att välja bland, och senast använda ersättningar
  $("sw-meal").innerHTML = day.map((id, i) => (id === NONE ? "" : `<option value="${i}">${MEAL_NAMES[i]}${swapOf(i) ? " (ersatt)" : ""}</option>`)).join("");
  if (day[1] !== NONE && !swapOf(1)) $("sw-meal").value = "1"; // oftast eftermiddagsmåltiden
  shown = { week, index };
  fillMoveOptions(Number($("sw-meal").value));

  // Dagens träning
  const gym = items.find((x) => x.kind === "str"), int = items.find((x) => x.kind === "int"), walk = items.find((x) => x.kind === "walk");
  const walkText = walk ? ` ${walk.label} ${span(walk)}.` : "";
  if (training.kind === "str" && gym) {
    const session = program.sessions.find((s) => s.id === training.session);
    $("td-train-title").textContent = session.name;
    $("td-train-sub").textContent = `${gym.custom ? "Din tid i dag" : "Förslag"}: ${span(gym)}.` +
      (gym.to <= at(MEAL_AT) ? ` Eftermiddagsmåltiden ${t(MEAL_AT)} blir din återhämtningsmåltid.` : "") + walkText +
      " Tider ändrar du under Inställningar → Veckoschema. Tryck på en övning för att se utförandet i ExRx.";
    $("td-training").innerHTML = sessionBlock(session);
  } else if (int) {
    $("td-train-title").textContent = "Intervaller";
    $("td-train-sub").textContent = `${int.custom ? "Din tid i dag" : "Förslag"}: ${span(int)}.${walkText} Tider ändrar du under Inställningar → Veckoschema.`;
    $("td-training").innerHTML = `<div class="card plan-steps"><ol><li>5 minuter lugn uppvärmning på cykel, i backe eller rask promenad.</li><li>8 omgångar: 30 sekunder hårt, 90 sekunder lugnt.</li><li>5 minuter lugnt avslut.</li></ol><p class="note">Gå dessutom dina 8 000–10 000 steg, gärna en promenad efter eftermiddagsmåltiden.</p></div>`;
  } else {
    $("td-train-title").textContent = "Vila";
    $("td-train-sub").textContent = "Ingen styrketräning i dag. Musklerna växer och återhämtar sig mellan passen." + walkText;
    $("td-training").innerHTML = `<div class="card plan-steps"><ol><li>Gå 8 000–10 000 steg.</li>${walk ? `<li>${esc(walk.label)} ${span(walk)}.</li>` : `<li>Ta en promenad på 20–30 minuter efter eftermiddagsmåltiden ${t(MEAL_AT)}, det sänker blodsockret.</li>`}</ol></div>`;
  }

  // Dagens tillskott, med klockslag
  const pass = workoutOf(items);
  const tips = supplementTips({ start: breakfast, kind: pass ? pass.kind : "rest", weight, workout: pass });
  $("td-supps-box").hidden = !usesSupplements();
  $("td-supps").innerHTML = tips.map((tip) => `<li><b>${formatClock(tip.at)} ${tip.name}</b> ${tip.text}</li>`).join("") +
    generalNotes().map((n) => `<li>${n}</li>`).join("");
}

let shown = null; // veckan och dagen som Idag visar, för valen i fillMoveOptions

/**
 * Vart den planerade rätten kan flyttas när måltiden ersätts: en annan dag samma vecka, där den byter plats med den
 * dagens rätt. Frukost och efterrätt bara när de skiljer sig mellan dagarna.
 */
/** Namnet på dagens planerade rätt för en måltid, t.ex. för att spara vad en ersättning ersatte. */
export const plannedTitle = (meal) => shown && shown.week.recipes[shown.week.plan[shown.index][meal]]?.t;

export function fillMoveOptions(meal) {
  if (!shown || meal > 2) return ($("sw-move-field").hidden = true);
  const { week, index } = shown;
  const options = week.plan.map((day, d) => (d === index || day[meal] === NONE || day[meal] === week.plan[index][meal] ? ""
    : `<option value="${d}">Flytta den till ${DAYS[d].toLowerCase()} (byter plats med ${esc(week.recipes[day[meal]].t)})</option>`)).join("");
  $("sw-move").innerHTML = `<option value="">Hoppa över den</option>${options}`;
  $("sw-move-field").hidden = !options;
}

export function renderFasting(targets, breakfast) {
  const t = (offset) => hhmm(breakfast + offset);
  const at = (offset) => breakfast + offset;
  const meals = [{ at: at(0), label: `Frukost ${t(0)}` }, { at: at(MEAL_AT), label: `Måltid ${t(MEAL_AT)}` }];

  $("fast-sum").innerHTML = `Ätfönster <b class="num">${t(0)}–${t(WINDOW)}</b> (8 h) · fasta <b class="num">${t(WINDOW)}–${t(0)}</b> (16 h)`;
  $("fast-protein").textContent = `${fmt(targets.protein / 2)} g`;
  renderTimeline($("tl-eat"), [{ from: at(0), to: at(WINDOW), cls: "eat", label: `Ätfönster ${t(0)}–${t(WINDOW)}` }], meals);
  renderTimeline($("tl-train"), [
    { from: at(INTERVALS[0]), to: at(INTERVALS[1]), cls: "int", label: `Intervaller ${t(INTERVALS[0])}–${t(INTERVALS[1])}` },
    { from: at(STRENGTH[0]), to: at(STRENGTH[1]), cls: "str", label: `Styrkepass ${t(STRENGTH[0])}–${t(STRENGTH[1])}` },
    { from: at(WINDOW), to: at(WINDOW + 0.5), cls: "walk", label: `Promenad ${t(WINDOW)}` },
  ], meals);
  $("tl-train-note").innerHTML =
    `<b>Styrkepass ${t(STRENGTH[0])}–${t(STRENGTH[1])} på gymdagar:</b> frukosten har lagt sig och ger energi, och eftermiddagsmåltiden ${t(MEAL_AT)} blir återhämtningsmåltiden med ca ${fmt(targets.protein / 2)} g protein. ` +
    `Kroppen är också ofta lite starkare på eftermiddagen än tidigt på morgonen. <b>Intervaller ${t(INTERVALS[0])}–${t(INTERVALS[1])}</b> på intervalldagar, när frukosten har lagt sig. ` +
    `<b>Promenad efter maten:</b> 20–30 minuter sänker blodsockret efter måltiden och ger steg. Promenader och träning bryter inte fastan. ` +
    `Kan du bara träna efter jobbet: välj en senare frukost (09:00 ger styrkepass 13:00–15:00 och måltid 16:00), eller träna när det passar. Att passet blir av betyder mer än exakt klockslag.`;
}
