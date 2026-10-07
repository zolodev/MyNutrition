// Gympass i appen: "Starta passet" på ett pass under Träning startar en klocka, och "Avsluta och logga" loggar
// passet direkt i dagens logg (tränat, passets namn och längd). Resten, t.ex. om du blev starkare, ändrar du i
// loggen efteråt.
//
// Det pågående passet sparas med sin starttid, så att det överlever en omladdning (t.ex. när iPhone stänger
// appen i bakgrunden) och klockan fortsätter där den var.

import { $, load, save, remove, todayStr, confirmDialog } from "../util.js";
import { addWorkout } from "../log.js";

const KEY = "ffv-workout"; // pågående pass: { name, date, start }
let update = () => {}; // ritar om appen; sätts av initWorkout()
let ticker = null;

const running = () => load(KEY, null);
/** Sekunder som mm:ss, eller h:mm:ss från en timme. */
function clock(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`;
}

function render() {
  const w = running();
  $("ws-run").hidden = !w;
  $("traning").classList.toggle("workout-running", !!w); // döljer Starta-knapparna (se app.css)
  clearInterval(ticker);
  if (!w) return;
  $("ws-name").textContent = w.name;
  $("ws-started").textContent = `Startade ${new Date(w.start).toTimeString().slice(0, 5)}. Avsluta när du är klar, så loggas passet.`;
  const tick = () => ($("ws-clock").textContent = clock((Date.now() - w.start) / 1000));
  tick();
  ticker = setInterval(tick, 1000);
}

function start(name) {
  save(KEY, { name, date: todayStr(), start: Date.now() });
  $("ws-result").hidden = true;
  render();
  $("ws-run").scrollIntoView?.({ behavior: "smooth", block: "start" });
}

function finish() {
  const w = running();
  if (!w) return;
  const minutes = Math.max(1, Math.round((Date.now() - w.start) / 60000));
  const text = `Gympass: ${w.name}, ${minutes} min`;
  addWorkout(w.date, { text, strength: true });
  remove(KEY);
  render();
  $("ws-msg").textContent = `${text} är loggat och dagen är markerad som tränad. Blev du starkare eller vill du lägga till något? Ändra i loggen.`;
  $("ws-result").hidden = false;
  update();
}

$("sessions").addEventListener("click", (ev) => {
  const name = ev.target.closest("[data-start-session]")?.dataset.startSession;
  if (name && !running()) start(name);
});
$("ws-finish").addEventListener("click", finish);
$("ws-cancel").addEventListener("click", async () => {
  if (!(await confirmDialog("Är du säker på att du vill avbryta passet?", "Passet loggas inte."))) return;
  remove(KEY);
  render();
});

/** Koppla gympassen till appen och visa ett pass som pågick när sidan laddades om. */
export function initWorkout(deps) {
  update = deps.update;
  render();
}
