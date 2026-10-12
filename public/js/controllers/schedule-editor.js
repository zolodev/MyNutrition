// Inställningar → Veckoschema: ett kort per veckodag där användaren bestämmer tiderna för gympass, intervaller,
// promenad (t.ex. till och från jobbet) och egna aktiviteter. Tomma fält visar planens förslag. Under varje dag
// visas råd med motivering (scheduleAdvice i schedule.js); inget blockeras.
//
// Gympass slås på och av via Gymdagar i profilen (setGymDay), så att gymdagarna bara bestäms på ett ställe.

import { $, esc, DAYS } from "../util.js";
import { formatClock, parseClock } from "../fasting.js";
import { STRENGTH, INTERVALS, WINDOW } from "../day.js";
import { KINDS, dayOverrides, hasOverrides, setActivity, setExtras, resetDay, suggestion, daySchedule, scheduleAdvice, getWork, setWork, workOn } from "../schedule.js";

let deps = { update: () => {}, setGymDay: () => {} };
let last = null; // { program, breakfast } från senaste ritningen

/** Förslag för en aktivitet oavsett dagens typ, t.ex. när intervaller läggs till en dag utan intervaller. */
const fallback = (kind, breakfast) => ({
  str: { from: breakfast + STRENGTH[0], to: breakfast + STRENGTH[1] },
  int: { from: breakfast + INTERVALS[0], to: breakfast + INTERVALS[1] },
  walk: { from: breakfast + WINDOW, to: breakfast + WINDOW + 0.5 },
})[kind];

function timeInputs(day, kind, own, plan, index = "") {
  const key = (k) => `${day}-${kind}-${index}-${k}`;
  const input = (k, label) => `<input type="text" inputmode="numeric" data-clock data-key="${key(k)}" data-sched-time="${k}" ` +
    `value="${own?.[k] && parseClock(own[k]) != null ? own[k] : ""}" placeholder="${plan ? formatClock(plan[k]) : ""}" aria-label="${DAYS[day]}, ${KINDS[kind]}, ${label}">`;
  return `<div class="sched-times">${input("from", "från")}<span aria-hidden="true">–</span>${input("to", "till")}</div>`;
}

function dayCard(day) {
  const { program, breakfast } = last;
  const type = program.schedule[day];
  const o = dayOverrides(day);
  const plan = suggestion(day, type.kind, breakfast);
  // En rad per aktivitet: kryssruta och namn överst, tiderna under (bredvid varandra på större skärmar)
  const row = (kind, on, title, extra = "") =>
    `<div class="sched-row${on ? "" : " off"}" data-kind="${kind}"><label class="sched-on"><input type="checkbox" ${kind === "str" ? "data-sched-gym" : "data-sched-on"}${on ? " checked" : ""}>` +
    `<span>${title}</span></label>${extra}${timeInputs(day, kind, typeof o[kind] === "object" ? o[kind] : null, plan[kind] || fallback(kind, breakfast))}</div>`;
  const gym = type.kind === "str";
  const intOn = typeof o.int === "object" || (o.int === undefined && type.kind === "int");
  const walkOn = typeof o.walk === "object" || (o.walk === undefined && type.kind === "rest");
  const extras = (Array.isArray(o.extra) ? o.extra : []).map((x, i) =>
    `<div class="sched-row" data-kind="other" data-index="${i}"><div class="sched-other"><input type="text" class="sched-label" data-sched-label data-key="${day}-other-${i}-label" maxlength="40" value="${esc(x.label || "")}" placeholder="t.ex. Padel" aria-label="${DAYS[day]}, egen aktivitet">` +
    `<button type="button" class="linkbtn" data-sched-remove="${i}">Ta bort</button></div>${timeInputs(day, "other", x, null, i)}</div>`).join("");
  const items = daySchedule(day, type.kind, breakfast);
  const next = program.schedule[(day + 1) % 7];
  const advice = scheduleAdvice(items, { work: workOn(day), eat: { from: breakfast, to: breakfast + WINDOW }, nextIsLegs: next.kind === "str" && program.legSessions.includes(next.session) });
  const work = workOn(day);
  return `<div class="card sched-day" data-sched-day="${day}"><div class="sched-head"><h3>${DAYS[day]}</h3><small>${esc(gym ? type.label : type.kind === "int" ? "Intervalldag" : "Vilodag")}` +
    `${work ? ` · arbete ${formatClock(work.from)}–${formatClock(work.to)}` : ""}</small></div>` +
    row("str", gym, "Gympass") + row("int", intOn, "Intervaller") +
    row("walk", walkOn, "Promenad", `<input type="text" class="sched-label" data-sched-label data-key="${day}-walk-label" maxlength="40" value="${esc(typeof o.walk === "object" ? o.walk.label || "" : "")}" placeholder="t.ex. Till jobbet" aria-label="${DAYS[day]}, promenadens namn">`) +
    extras +
    `<div class="actions"><button type="button" class="linkbtn" data-sched-add>+ Lägg till aktivitet</button>` +
    (hasOverrides(day) ? `<button type="button" class="linkbtn" data-sched-reset>Återställ dagen till förslaget</button>` : "") + "</div>" +
    `<ul class="advice">${advice.map((a) => `<li class="${a.level}">${esc(a.text)}</li>`).join("")}</ul></div>`;
}

/** Arbetstiden överst: tider och dagar. Ritas inte om medan man skriver i den. */
function renderWork() {
  if ($("work-box").contains(document.activeElement) && document.activeElement.type === "text") return;
  const w = getWork();
  $("work-from").value = w?.from || "";
  $("work-to").value = w?.to || "";
  for (const el of $("work-days").querySelectorAll("[data-work-day]")) el.checked = w ? w.days.includes(Number(el.dataset.workDay)) : Number(el.dataset.workDay) < 5;
  $("work-clear").hidden = !w;
}

$("work-box").addEventListener("change", () => {
  const from = $("work-from").value, to = $("work-to").value;
  const days = [...$("work-days").querySelectorAll("[data-work-day]:checked")].map((el) => Number(el.dataset.workDay));
  if (!from || !to) return; // sparas när båda tiderna finns
  const ok = parseClock(from) != null && parseClock(to) != null && parseClock(to) > parseClock(from);
  $("work-to").setCustomValidity(ok ? "" : "Arbetsdagen måste sluta efter att den börjar, t.ex. 08:00–17:00");
  if (!ok) return $("work-to").reportValidity();
  setWork({ from, to, days });
  deps.update();
});
$("work-clear").addEventListener("click", () => {
  setWork(null);
  $("work-from").value = $("work-to").value = "";
  deps.update();
});

/** Rita schemat. Fältet som har fokus får fokus igen efteråt, så att man kan fortsätta skriva. */
export function renderSchedule(program, breakfast) {
  last = { program, breakfast };
  renderWork();
  const focused = document.activeElement?.dataset?.key;
  $("sched-list").innerHTML = [0, 1, 2, 3, 4, 5, 6].map(dayCard).join("");
  if (focused) $("sched-list").querySelector(`[data-key="${focused}"]`)?.focus();
}

/** Läs en rads tider ({ from, to } som "HH:MM"); tomma fält tar förslaget. Ger null om tiderna inte går ihop. */
function readTimes(row) {
  const get = (k) => {
    const el = row.querySelector(`[data-sched-time="${k}"]`);
    return el.value || el.placeholder;
  };
  const from = get("from"), to = get("to");
  return parseClock(from) != null && parseClock(to) != null && parseClock(to) > parseClock(from) ? { from, to } : null;
}

function readExtras(card) {
  return [...card.querySelectorAll('.sched-row[data-kind="other"]')].map((row) => ({
    label: row.querySelector("[data-sched-label]").value.trim() || KINDS.other, ...(readTimes(row) || { from: "12:00", to: "12:30" }),
  }));
}

$("sched-list").addEventListener("change", (ev) => {
  const card = ev.target.closest("[data-sched-day]");
  const row = ev.target.closest(".sched-row");
  if (!card || !row) return;
  const day = Number(card.dataset.schedDay), kind = row.dataset.kind;
  const type = last.program.schedule[day].kind;
  if (ev.target.matches("[data-sched-gym]")) return deps.setGymDay(day, ev.target.checked);
  if (kind === "other") setExtras(day, readExtras(card));
  else if (ev.target.matches("[data-sched-on]")) {
    const byDefault = (kind === "int" && type === "int") || (kind === "walk" && type === "rest");
    const times = readTimes(row);
    setActivity(day, kind, !ev.target.checked ? false : byDefault && !times ? undefined : { ...times, ...label(row) });
  } else {
    // Ändrad tid eller namn: sparas som egen tid för aktiviteten (gympasset bara på gymdagar)
    if (kind === "str" && type !== "str") return deps.update();
    const times = readTimes(row);
    const end = row.querySelector('[data-sched-time="to"]');
    end.setCustomValidity(times ? "" : "Sluttiden måste vara efter starttiden, t.ex. 16:00–17:30");
    if (!times) return end.reportValidity();
    setActivity(day, kind, { ...times, ...label(row) });
  }
  deps.update();
});
const label = (row) => {
  const text = row.querySelector("[data-sched-label]")?.value.trim();
  return text ? { label: text } : {};
};

$("sched-list").addEventListener("click", (ev) => {
  const card = ev.target.closest("[data-sched-day]");
  if (!card) return;
  const day = Number(card.dataset.schedDay);
  if (ev.target.matches("[data-sched-add]")) setExtras(day, [...readExtras(card), { label: KINDS.other, from: "12:00", to: "12:30" }]);
  else if (ev.target.matches("[data-sched-remove]")) setExtras(day, readExtras(card).filter((_, i) => i !== Number(ev.target.dataset.schedRemove)));
  else if (ev.target.matches("[data-sched-reset]")) resetDay(day);
  else return;
  deps.update();
});

/** Koppla schemat till appen: `update` ritar om, `setGymDay(dag, på)` ändrar Gymdagar i profilen. */
export function initScheduleEditor(d) {
  deps = d;
}
