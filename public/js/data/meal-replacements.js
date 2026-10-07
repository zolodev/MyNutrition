// Färdiga måltidsersättningar som snabbval när man ersätter en måltid på Idag (controllers/meal-swap.js).
// Värden per måltid enligt huel.com (hämtat 2026-10). Smaker och versioner skiljer sig något, så användaren kan
// ändra siffrorna innan måltiden sparas. Daily Greens ingår inte: det är ett tillskott (ca 25 kcal), inte en måltid.

export const MEAL_REPLACEMENTS = [
  { brand: "Huel", n: "Huel Powder", k: 400, p: 30 },
  { brand: "Huel", n: "Huel Black Edition", k: 400, p: 40 },
  { brand: "Huel", n: "Huel Ready-to-drink 500 ml", k: 400, p: 20 },
  { brand: "Huel", n: "Huel Black Edition Ready-to-drink 500 ml", k: 400, p: 35 },
  { brand: "Huel", n: "Huel Hot & Savoury", k: 400, p: 24 },
  { brand: "Huel", n: "Huel Complete Nutrition Bar", k: 210, p: 14 },
  { brand: "Huel", n: "Huel Complete Protein", k: 110, p: 20 },
];
