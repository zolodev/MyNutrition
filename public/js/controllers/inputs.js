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

// iPhone: när tangentbordet öppnas skjuter Safari upp hela sidan för att visa fältet, men flyttar inte tillbaka den
// när tangentbordet stängs, så appen blir kvar uppskjuten. Sidan själv ska aldrig scrolla (bara innehållet i .views
// och guiden gör det, se app.css), så den flyttas tillbaka till toppen när tangentbordet har stängts.
const resetPageScroll = () => {
  if (window.scrollY || document.documentElement.scrollTop || document.body.scrollTop) window.scrollTo(0, 0);
};
const typing = () => document.activeElement?.matches?.("input:not([type=checkbox]):not([type=radio]), textarea, select");
// Tangentbordet stängs: den synliga ytan blir hög igen
window.visualViewport?.addEventListener("resize", () => {
  if (!typing() || window.visualViewport.height >= window.innerHeight * 0.85) resetPageScroll();
});
// Fältet lämnas (t.ex. Klar på tangentbordet) utan att ett annat fält får fokus
document.addEventListener("focusout", () => setTimeout(() => {
  if (!typing()) resetPageScroll();
}, 150));
// Skydd: har sidan ändå scrollats (av webbläsaren eller av kod), flytta tillbaka den – men aldrig medan man skriver,
// eftersom iPhone då scrollar sidan för att fältet inte ska hamna bakom tangentbordet
window.addEventListener("scroll", () => {
  if (!typing()) resetPageScroll();
}, { passive: true });
