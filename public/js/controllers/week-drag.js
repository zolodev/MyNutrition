// Dra och släpp måltider i veckoschemat (Mat → Veckan): dra en måltid i handtaget (⠿) och släpp den på en annan
// dag, så byter de två dagarnas måltider plats (samma måltid: frukost, eftermiddagsmåltid eller efterrätt).
// Bytet sparas med swapMeals i menu.js, precis som formuläret "Byt plats på måltider", så recepten, Idag och
// inköpslistan följer med.
//
// Gympassen dras på samma sätt under Inställningar → Veckoschema (#train-week): till en gymdag byter passen plats,
// till en vilodag flyttas passet dit (moveSession i app.js).
//
// Byggt med pekhändelser (pointer events) i stället för HTML5 dra och släpp, som inte fungerar på iPhone. Bara
// handtaget startar en dragning, så att man fortfarande kan scrolla och svepa mellan flikarna.

import { $ } from "../util.js";

let onSwap = () => {}; // (måltid, frånDag, tillDag); sätts av initWeekDrag()
let onMoveSession = () => {}; // (frånDag, tillDag)
let drag = null; // { root, meal (null för gympass), from, ghost, target }

/** Dagen under en punkt på skärmen (spöket släpper igenom pekaren), eller null. */
function dayAt(x, y) {
  const day = document.elementFromPoint?.(x, y)?.closest?.("[data-week-day]");
  return day && drag.root.contains(day) ? day : null;
}

function mark(day) {
  if (drag.target === day) return;
  drag.target?.classList.remove("drop-target");
  drag.target = day && Number(day.dataset.weekDay) !== drag.from ? day : null;
  drag.target?.classList.add("drop-target");
}

// Scrolla innehållet när man drar nära över- eller underkanten
function autoScroll(y) {
  const box = drag.root.closest(".views");
  if (!box) return;
  const r = box.getBoundingClientRect();
  if (y < r.top + 60) box.scrollTop -= 12;
  else if (y > r.bottom - 60) box.scrollTop += 12;
}

function finish(ev, drop) {
  if (!drag) return;
  const { root, meal, from, target, ghost } = drag;
  ghost?.remove();
  target?.classList.remove("drop-target");
  root.classList.remove("dragging");
  drag = null;
  if (!drop || !target) return;
  if (meal == null) onMoveSession(from, Number(target.dataset.weekDay));
  else onSwap(meal, from, Number(target.dataset.weekDay));
}

/** Dra och släpp inom en yta: måltider och pass i veckan under Mat, passen under Inställningar. */
function attach(root) {
  root.addEventListener("pointerdown", (ev) => {
    const handle = ev.target.closest?.(".drag-handle");
    if (!handle || drag) return;
    ev.preventDefault();
    const item = handle.closest("li, [data-session-chip]");
    const rect = item.getBoundingClientRect();
    const ghost = item.cloneNode(true);
    ghost.classList.add("drag-ghost");
    Object.assign(ghost.style, { width: `${rect.width}px`, left: `${rect.left}px`, top: `${rect.top}px` });
    document.body.append(ghost);
    drag = { root, meal: item.dataset.meal != null ? Number(item.dataset.meal) : null, from: Number(item.closest("[data-week-day]").dataset.weekDay), ghost, target: null, dx: ev.clientX - rect.left, dy: ev.clientY - rect.top };
    handle.setPointerCapture?.(ev.pointerId);
    root.classList.add("dragging");
  });
  root.addEventListener("pointermove", (ev) => {
    if (!drag) return;
    Object.assign(drag.ghost.style, { left: `${ev.clientX - drag.dx}px`, top: `${ev.clientY - drag.dy}px` });
    mark(dayAt(ev.clientX, ev.clientY));
    autoScroll(ev.clientY);
  });
  root.addEventListener("pointerup", (ev) => finish(ev, true));
  root.addEventListener("pointercancel", (ev) => finish(ev, false));
}
attach($("week"));
attach($("train-week"));

/**
 * Koppla dra och släpp till appen: `swap(måltid, frånDag, tillDag)` byter plats på måltider och
 * `moveSession(frånDag, tillDag)` flyttar gympasset. Båda ritar om.
 */
export function initWeekDrag(deps) {
  onSwap = deps.swap;
  onMoveSession = deps.moveSession;
}
