// Idag: dagens måltider och träning, samt tidslinjerna för fasta och träning.

import { $, fmt, hhmm, todayIndex } from "../util.js";
import { NONE } from "../data/recipes.js";
import { totals } from "../menu.js";
import { MEAL_AT, WINDOW, STRENGTH, INTERVALS } from "../day.js";
import { tile } from "./components.js";
import { supplementTips, generalNotes, using } from "../supplements.js";
import { formatClock } from "../fasting.js";
import { recipeRow } from "./food.js";
import { sessionBlock } from "./training-view.js";
import { renderTimeline } from "./timeline.js";


/**
 * Idag: dagens tider, recept och träning.
 * `week` = buildWeek() för innevarande vecka, `program` = buildProgram(), `breakfast` = frukosttid i timmar.
 */
export function renderToday({ week, targets, program, breakfast, weight }) {
  const index = todayIndex();
  const day = week.plan[index];
  const training = program.schedule[index];
  const t = (offset) => hhmm(breakfast + offset);
  const at = (offset) => breakfast + offset;

  $("td-date").textContent = new Date().toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" });
  $("td-title").textContent =
    training.kind === "str" ? `Gymdag: ${training.label[0].toLowerCase() + training.label.slice(1)}` : training.kind === "int" ? "Intervalldag" : "Vilodag";
  $("td-sub").textContent = `Frukost ${t(0)}, eftermiddagsmåltid ${t(MEAL_AT)}, sedan fasta till i morgon ${t(0)}.`;

  const sum = totals(day, week.recipes);
  $("td-targets").innerHTML =
    tile({ label: "Kalorier i dag", value: fmt(sum.k), sub: `Mål ${fmt(targets.target)} kcal`, main: true }) +
    tile({ label: "Protein", value: fmt(sum.p), unit: "g", sub: `Mål ${fmt(targets.protein)} g` }) +
    tile({ label: "Fasta", value: 16, unit: "h", sub: `${t(WINDOW)}–${t(0)}` });

  // Dagens tidslinje: ätfönstret och, på träningsdagar, när passet ska ligga
  const workout = training.kind === "str" ? { from: at(STRENGTH[0]), to: at(STRENGTH[1]), cls: "str", label: `Styrkepass ${t(STRENGTH[0])}–${t(STRENGTH[1])}` }
    : training.kind === "int" ? { from: at(INTERVALS[0]), to: at(INTERVALS[1]), cls: "int", label: `Intervaller ${t(INTERVALS[0])}–${t(INTERVALS[1])}` }
    : { from: at(WINDOW), to: at(WINDOW + 0.5), cls: "walk", label: `Promenad ${t(WINDOW)}` };
  renderTimeline($("td-timeline"), [{ from: at(0), to: at(WINDOW), cls: "eat", label: `Ätfönster ${t(0)}–${t(WINDOW)}` }, workout],
    [{ at: at(0), label: `Frukost ${t(0)}` }, { at: at(MEAL_AT), label: `Måltid ${t(MEAL_AT)}` }]);

  // Dagens recept, fullständiga
  const meals = [[t(0), "Frukost"], [t(MEAL_AT), "Måltid"], [t(MEAL_AT), "Efterrätt"], [t(MEAL_AT), "Lördagsgodis"]];
  $("td-food").innerHTML = day.map((id, i) => (id === NONE ? "" : recipeRow(week.recipes[id], `${meals[i][0]} ${meals[i][1]}`, false))).join("");

  // Dagens träning
  if (training.kind === "str") {
    const session = program.sessions.find((s) => s.id === training.session);
    $("td-train-title").textContent = session.name;
    $("td-train-sub").textContent = `Helst ${t(STRENGTH[0])}–${t(STRENGTH[1])}, så blir eftermiddagsmåltiden ${t(MEAL_AT)} din återhämtningsmåltid. Tryck på en övning för att se utförandet i ExRx.`;
    $("td-training").innerHTML = sessionBlock(session);
  } else if (training.kind === "int") {
    $("td-train-title").textContent = "Intervaller";
    $("td-train-sub").textContent = `Helst ${t(INTERVALS[0])}–${t(INTERVALS[1])}, när frukosten har lagt sig.`;
    $("td-training").innerHTML = `<div class="card plan-steps"><ol><li>5 minuter lugn uppvärmning på cykel, i backe eller rask promenad.</li><li>8 omgångar: 30 sekunder hårt, 90 sekunder lugnt.</li><li>5 minuter lugnt avslut.</li></ol><p class="note">Gå dessutom dina 8 000–10 000 steg, gärna en promenad efter eftermiddagsmåltiden.</p></div>`;
  } else {
    $("td-train-title").textContent = "Vila";
    $("td-train-sub").textContent = "Ingen styrketräning i dag. Musklerna växer och återhämtar sig mellan passen.";
    $("td-training").innerHTML = `<div class="card plan-steps"><ol><li>Gå 8 000–10 000 steg.</li><li>Ta en promenad på 20–30 minuter efter eftermiddagsmåltiden ${t(MEAL_AT)}, det sänker blodsockret.</li></ol></div>`;
  }

  // Dagens tillskott, med klockslag
  const tips = supplementTips({ start: breakfast, kind: training.kind, weight });
  $("td-supps-box").hidden = !using.size;
  $("td-supps").innerHTML = tips.map((tip) => `<li><b>${formatClock(tip.at)} ${tip.name}</b> ${tip.text}</li>`).join("") +
    generalNotes().map((n) => `<li>${n}</li>`).join("");
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
