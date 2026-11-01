// Dagens tider, räknat i timmar efter frukost. Används av Idag, veckoschemat och recepten.

export const MEAL_AT = 7; // eftermiddagsmåltiden
// Ätfönstret i timmar, enligt valet under Profil → Fasta ("fast": 16, 14, 12 eller 0 = ingen fasta). Utan fasta räknas
// dagen som öppen till midnatt, så att inga råd om att bryta fastan visas. Ändras med setFasting() när profilen läses.
export const FASTING_WINDOWS = { 16: 8, 14: 10, 12: 12, 0: 17 };
export let WINDOW = 8; // ätfönstret stänger, sedan fasta resten av dygnet
export let FASTING = true; // false = ingen periodisk fasta
export function setFasting(choice) {
  const key = String(choice) in FASTING_WINDOWS ? String(choice) : "16";
  WINDOW = FASTING_WINDOWS[key];
  FASTING = key !== "0";
}
export const WALK_AT = 8; // promenaden efter eftermiddagsmåltiden (en timme efter den)
export const STRENGTH = [4, 6]; // styrkepass, 1–3 h före eftermiddagsmåltiden
export const INTERVALS = [1.5, 3]; // intervaller, när frukosten har lagt sig
