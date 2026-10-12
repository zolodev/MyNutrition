// Dra och släpp måltider i veckoschemat (Mat → Veckan): dra en måltid i handtaget (⠿) och släpp den på en annan
// dag, så byter de två dagarnas måltider plats (samma måltid: frukost, eftermiddagsmåltid eller efterrätt).
// Bytet sparas med swapMeals i menu.js, precis som formuläret "Byt plats på måltider", så recepten, Idag och
// inköpslistan följer med.
//
// Byggt med pekhändelser (pointer events) i stället för HTML5 dra och släpp, som inte fungerar på iPhone. Bara
// handtaget startar en dragning, så att man fortfarande kan scrolla och svepa mellan flikarna.

import { $ } from "../util.js";

let onSwap = () => {}; // (måltid, frånDag, tillDag); sätts av initWeekDrag()
let drag = null; // { meal, from, ghost, target, pointerId }

/** Dagen under en punkt på skärmen (spöket släpper igenom pekaren), eller null. */
function dayAt(x, y) {
  const day = document.elementFromPoint?.(x, y)?.closest?.("[data-week-day]");
  return day && $("week").contains(day) ? day : null;
}

function mark(day) {
  if (drag.target === day) return;
  drag.target?.classList.remove("drop-target");
  drag.target = day && Number(day.dataset.weekDay) !== drag.from ? day : null;
  drag.target?.classList.add("drop-target");
}

// Scrolla innehållet när man drar nära över- eller underkanten
function autoScroll(y) {
  const box = $("week").closest(".views");
  if (!box) return;
  const r = box.getBoundingClientRect();
  if (y < r.top + 60) box.scrollTop -= 12;
  else if (y > r.bottom - 60) box.scrollTop += 12;
}

function finish(ev, drop) {
  if (!drag) return;
  const { meal, from, target, ghost } = drag;
  ghost?.remove();
  target?.classList.remove("drop-target");
  $("week").classList.remove("dragging");
  drag = null;
  if (drop && target) onSwap(meal, from, Number(target.dataset.weekDay));
}

$("week").addEventListener("pointerdown", (ev) => {
  const handle = ev.target.closest?.(".drag-handle");
  if (!handle || drag) return;
  ev.preventDefault();
  const item = handle.closest("li");
  const rect = item.getBoundingClientRect();
  const ghost = item.cloneNode(true);
  ghost.classList.add("drag-ghost");
  Object.assign(ghost.style, { width: `${rect.width}px`, left: `${rect.left}px`, top: `${rect.top}px` });
  document.body.append(ghost);
  drag = { meal: Number(item.dataset.meal), from: Number(item.closest("[data-week-day]").dataset.weekDay), ghost, target: null, dx: ev.clientX - rect.left, dy: ev.clientY - rect.top };
  handle.setPointerCapture?.(ev.pointerId);
  $("week").classList.add("dragging");
});
$("week").addEventListener("pointermove", (ev) => {
  if (!drag) return;
  Object.assign(drag.ghost.style, { left: `${ev.clientX - drag.dx}px`, top: `${ev.clientY - drag.dy}px` });
  mark(dayAt(ev.clientX, ev.clientY));
  autoScroll(ev.clientY);
});
$("week").addEventListener("pointerup", (ev) => finish(ev, true));
$("week").addEventListener("pointercancel", (ev) => finish(ev, false));

/** Koppla dra och släpp till appen: `swap(måltid, frånDag, tillDag)` byter plats och ritar om. */
export function initWeekDrag(deps) {
  onSwap = deps.swap;
}
