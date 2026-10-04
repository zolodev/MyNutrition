// Navigering: varje flik är en vy (<div data-view="…"> i index.html) och adressens # avgör vilken som visas.
//
// - #idag, #mat, … visar en flik. En länk till något som ligger i en flik (#backup, #rc-…) öppnar den fliken och
//   scrollar dit; ett recept (<details>) fälls ut.
// - Mat har underflikar (data-subview: vecka, recept, inkop).
// - Inställningar är en meny (#installningar-meny) med undersidor (data-page). #sakerhetskopia öppnar en
//   undersida via namnet, #backup via en sektion i den. Ny undersida: lägg en <div class="settings-page"
//   data-page="namn" hidden> i vyn och en rad i menyn; ingen kod behövs här.

import { $, $$, load, save, toast } from "../util.js";

const VIEWS = ["idag", "mat", "traning", "logg", "profil", "installningar", "om", "rapport"];
let subview = "vecka"; // senast valda underflik under Mat
let onToday = () => {}; // sätts av initNavigation()
const markCurrent = (el, on) => (on ? el.setAttribute("aria-current", "page") : el.removeAttribute("aria-current"));

function route() {
  const hash = decodeURIComponent(location.hash.slice(1)) || "idag";
  // En undersida under Inställningar nås via sitt namn (#sakerhetskopia) eller via en sektion i den (#backup)
  const target = document.getElementById(hash) || $$("[data-page]").find((el) => el.dataset.page === hash);
  const view = target?.closest("[data-view]")?.dataset.view || (VIEWS.includes(hash) ? hash : "idag");

  if (view === "idag") onToday();
  for (const el of $$("[data-view]")) el.hidden = el.dataset.view !== view;
  for (const el of $$("[data-tab]")) markCurrent(el, el.dataset.tab === (view === "rapport" ? "logg" : view));

  if (view === "mat") {
    subview = target?.closest("[data-subview]")?.dataset.subview || subview;
    for (const el of $$("[data-subview]")) el.hidden = el.dataset.subview !== subview;
    for (const el of $$("[data-sub]")) markCurrent(el, el.dataset.sub === subview);
  }

  if (view === "installningar") {
    const page = target?.closest("[data-page]")?.dataset.page;
    for (const el of $$("[data-page]")) el.hidden = el.dataset.page !== page;
    $("installningar-meny").hidden = !!page;
  }

  // Ett recept öppnas och visas; en sektion som är först i sin vy behöver ingen scroll
  if (target?.matches("details")) target.open = true;
  const isViewStart = !target || target.matches("[data-page]") || target === target.parentElement.querySelector("section");
  if (isViewStart) document.querySelector(".views").scrollTop = 0;
  else target.scrollIntoView({ block: "start" });
}

// Svep mellan flikar:
// Svep åt vänster går till nästa flik, åt höger till föregående. Mat räknas som tre steg (veckan, recept, handla).
// Svep som börjar i något som själv scrollar i sidled, i formulärfält eller nära skärmkanten (telefonens bakåtgest)
// ignoreras, liksom svep som mest går uppåt eller nedåt.

const SWIPE_ORDER = ["idag", "vecka", "recept", "inkop", "traning", "logg", "profil"];
const SWIPE_MIN_PX = 60;
const EDGE_PX = 24;
const SWIPE_HINT_KEY = "ffv-swipe-hint";

function currentStep() {
  const view = $$("[data-view]").find((el) => !el.hidden)?.dataset.view;
  if (view === "mat") return SWIPE_ORDER.indexOf(subview);
  if (view === "installningar" || view === "om") return SWIPE_ORDER.indexOf("profil");
  if (view === "rapport") return SWIPE_ORDER.indexOf("logg");
  return SWIPE_ORDER.indexOf(view);
}

function swipeTo(direction) {
  const next = currentStep() + direction;
  if (next < 0 || next >= SWIPE_ORDER.length) return;
  location.hash = SWIPE_ORDER[next];
  const shown = $$("[data-view]").find((el) => !el.hidden);
  shown?.classList.remove("slide-from-left", "slide-from-right");
  void shown?.offsetWidth; // starta om animationen
  shown?.classList.add(direction > 0 ? "slide-from-right" : "slide-from-left");
}

function enableSwipeNavigation() {
  const area = document.querySelector(".views");
  let start = null;
  area.addEventListener("touchstart", (ev) => {
    const t = ev.changedTouches[0];
    const ignore = ev.touches.length > 1 || t.clientX < EDGE_PX || t.clientX > window.innerWidth - EDGE_PX ||
      ev.target.closest(".scroll-x, .timeline, .chart, input, select, textarea, .seg, .daypick, .chips");
    start = ignore ? null : { x: t.clientX, y: t.clientY, time: Date.now() };
  }, { passive: true });
  area.addEventListener("touchend", (ev) => {
    if (!start) return;
    const t = ev.changedTouches[0];
    const dx = t.clientX - start.x, dy = t.clientY - start.y;
    const quick = Date.now() - start.time < 700;
    start = null;
    if (quick && Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * 1.5) swipeTo(dx < 0 ? 1 : -1);
  }, { passive: true });

  // Visa en kort hjälptext första gången på en pekskärm
  if ("ontouchstart" in window && !load(SWIPE_HINT_KEY, false)) {
    toast("Svep åt vänster eller höger för att byta flik");
    save(SWIPE_HINT_KEY, true);
  }
}

/** Starta navigeringen. `onToday` anropas när Idag visas (då ska Mat visa den här veckan igen). */
export function initNavigation(deps) {
  onToday = deps.onToday;
  window.addEventListener("hashchange", route);
  route();
  enableSwipeNavigation();
}
