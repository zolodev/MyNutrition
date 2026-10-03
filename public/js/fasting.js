// Periodisk fasta 16:8: räkna ut dagens ätfönster och nästa måltid från när man faktiskt åt.
// Alla tider är timmar sedan midnatt (12.5 = 12:30). Värden över 24 betyder nästa dag.

import { MEAL_AT, WINDOW } from "./day.js";

export const FAST_HOURS = 24 - WINDOW; // 16

/** "12:30" → 12.5, eller null. */
export function parseClock(text) {
  const m = String(text || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m || +m[1] > 23 || +m[2] > 59) return null;
  return +m[1] + +m[2] / 60;
}

/** 12.5 → "12:30". Tider från 24 och uppåt skrivs som klockslag nästa dag. */
export function formatClock(hours) {
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60) % 24;
  return `${String(h).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** "9 h 20 min" */
export function formatDuration(hours) {
  const total = Math.max(0, Math.round(hours * 60));
  const h = Math.floor(total / 60), m = total % 60;
  return h && m ? `${h} h ${m} min` : h ? `${h} h` : `${m} min`;
}

/**
 * Dagens fasteschema.
 *   planned       planerad frukosttid (timmar)
 *   first         när första måltiden faktiskt åts, eller null
 *   last          när sista måltiden var klar, eller null
 *   yesterdayLast när gårdagens sista måltid var klar, eller null
 * Om sista måltiden inte är loggad antas ätfönstret vara 8 timmar från första måltiden.
 */
export function fastingDay({ planned, first, last, yesterdayLast }) {
  const start = first ?? planned;
  const windowEnd = last ?? start + WINDOW;
  const fastEnd = windowEnd + FAST_HOURS; // timmar från i dag 00:00, alltså i morgon
  return {
    start,
    nextMeal: Math.min(start + MEAL_AT, windowEnd), // eftermiddagsmåltiden, aldrig efter att fönstret stängt
    windowEnd,
    fastEnd,
    /** Tidigaste första måltid i dag för att gårdagens fasta ska bli 16 h. */
    earliestToday: yesterdayLast != null ? yesterdayLast + FAST_HOURS - 24 : null,
    /** Fasta i natt om man äter frukost som planerat i morgon. */
    tonightIfPlanned: planned + 24 - windowEnd,
  };
}

/** Fastetimmar mellan sista måltiden en dag och första måltiden nästa dag. */
export const fastingHours = (lastMeal, nextFirstMeal) => nextFirstMeal + 24 - lastMeal;

/**
 * Läge just nu: "eating" inne i ätfönstret, annars "fasting" med hur länge och hur mycket som är kvar.
 * Före dagens första måltid räknas fastan från gårdagens sista måltid (klockslag i går). Är den inte loggad
 * antas ätfönstret i går ha stängt vid samma tid som i dag (första måltiden + 8 h).
 */
export function fastingNow(day, now, yesterdayLast) {
  if (now >= day.start && now < day.windowEnd) return { state: "eating", left: day.windowEnd - now };
  const elapsed = now >= day.windowEnd ? now - day.windowEnd : now + 24 - (yesterdayLast ?? day.start + WINDOW);
  return { state: "fasting", elapsed, left: Math.max(0, FAST_HOURS - elapsed) };
}
