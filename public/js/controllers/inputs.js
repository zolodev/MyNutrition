// Beteenden som gäller alla formulär i appen, kopplade en gång på dokumentet:
// sifferfält (data-decimal), klockslag (data-clock) och informationsikoner (data-info).
// Ett nytt fält får beteendet bara genom att ha attributet; ingen kod behöver kopplas per fält.

import { $, checkDecimal, formatClockInput, isClockText } from "../util.js";

// Sifferfält tar både 85,5 och 85.5; kontrollera talet medan man skriver (före formulärens egna lyssnare)
document.addEventListener("input", (ev) => {
  if (ev.target.matches?.("input[data-decimal]")) checkDecimal(ev.target);
}, true);

// Klockslag (data-clock) skrivs alltid som HH:MM, 24 timmar, oavsett webbläsarens språk
document.addEventListener("input", (ev) => {
  if (!ev.target.matches?.("input[data-clock]")) return;
  const formatted = formatClockInput(ev.target.value);
  if (formatted !== ev.target.value) ev.target.value = formatted;
  ev.target.setCustomValidity("");
}, true);
document.addEventListener("change", (ev) => {
  if (!ev.target.matches?.("input[data-clock]")) return;
  const el = ev.target;
  if (el.value) el.value = formatClockInput(el.value, { final: true });
  el.setCustomValidity(!el.value || isClockText(el.value) ? "" : "Skriv klockslaget som HH:MM, t.ex. 07:30 eller 19:45");
}, true);

// Informationsikoner (data-info): visa eller dölj förklaringen som knappen pekar på med aria-controls
document.addEventListener("click", (ev) => {
  const button = ev.target.closest?.("[data-info]");
  if (!button) return;
  const text = $(button.getAttribute("aria-controls"));
  text.hidden = !text.hidden;
  button.setAttribute("aria-expanded", String(!text.hidden));
});
