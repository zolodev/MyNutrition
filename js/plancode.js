// Plankod: en kort kod som beskriver allt som slumpas eller väljs i planen, så att den kan delas.
//
// Koden innehåller slumpfröet (som styr både recepten och vilka övningar varje vecka får), omslumpade veckor,
// utrustning, gymdagar, frukostval och hur ofta övningarna byts.
// Den innehåller INTE kön, vikt, mål eller allergier; de är personliga, så portionerna anpassas efter den som
// använder koden, medan rätterna och övningarna blir desamma.
//
// Format: FRÖ-UDDFP[.VECKA_SALT.VECKA_SALT...]
//   FRÖ   6 tecken (30 bitar)          U  utrustning: G gym, H hantlar, K kroppsvikt
//   DD    gymdagar som bitmask (mån = 1) F  frukostval (index i BREAKFASTS)
//   P     hur ofta övningarna byts: 1, 2 eller 4 veckor (saknas i äldre koder = 1)
// Tecknen kommer från Crockfords base32 (inga I, L, O, U), så koden är lätt att läsa av och skriva in.

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const EQUIPMENT = { gym: "G", db: "H", bw: "K" };
const BREAKFASTS = ["F0", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "rot"];
export const SEED_LIMIT = 2 ** 30;

function toBase32(n, length = 0) {
  let s = "";
  do {
    s = ALPHABET[n % 32] + s;
    n = Math.floor(n / 32);
  } while (n > 0);
  return s.padStart(length, "0");
}

function fromBase32(s) {
  let n = 0;
  for (const c of s) {
    const v = ALPHABET.indexOf(c);
    if (v < 0) return null;
    n = n * 32 + v;
  }
  return n;
}

export const randomSeed = () => Math.floor(Math.random() * SEED_LIMIT);

/** { seed, salts: {vecka: salt}, equipment, days: [0..6], breakfast } → kod */
export function encodePlan({ seed, salts, equipment, days, breakfast, swapPeriod = 1 }) {
  const mask = days.reduce((m, d) => m | (1 << d), 0);
  const rerolls = Object.entries(salts)
    .filter(([week, salt]) => Number(week) >= 0 && salt > 0)
    .sort(([a], [b]) => a - b)
    .map(([week, salt]) => `${toBase32(Number(week))}_${toBase32(salt)}`);
  const breakfastIndex = Math.max(0, BREAKFASTS.indexOf(breakfast));
  const period = [1, 2, 4].includes(swapPeriod) ? swapPeriod : 1;
  return `${toBase32(seed, 6)}-${EQUIPMENT[equipment] || "G"}${toBase32(mask, 2)}${toBase32(breakfastIndex)}${period}` + rerolls.map((r) => "." + r).join("");
}

/** Kod → { seed, salts, equipment, days, breakfast }, eller null om koden inte går att läsa. */
export function decodePlan(text) {
  const code = String(text).trim().toUpperCase().replace(/\s+/g, "").replace(/[IL]/g, "1").replace(/O/g, "0");
  const m = code.match(/^([0-9A-Z]{6})-([GHK])([0-9A-Z]{2})([0-9A-Z])([124])?((?:\.[0-9A-Z]+_[0-9A-Z]+)*)$/);
  if (!m) return null;
  const seed = fromBase32(m[1]);
  const mask = fromBase32(m[3]);
  const breakfast = BREAKFASTS[fromBase32(m[4])];
  if (seed == null || mask == null || mask > 127 || !breakfast) return null;
  const days = [0, 1, 2, 3, 4, 5, 6].filter((d) => mask & (1 << d));
  const salts = {};
  for (const pair of m[6].split(".").filter(Boolean)) {
    const [week, salt] = pair.split("_").map(fromBase32);
    if (week == null || salt == null) return null;
    salts[week] = salt;
  }
  const equipment = Object.keys(EQUIPMENT).find((k) => EQUIPMENT[k] === m[2]);
  return { seed, salts, equipment, days, breakfast, swapPeriod: m[5] ? Number(m[5]) : 1 };
}

/** Kod med mellanrum för läsbarhet, t.ex. "7K2Q XM-G1501". Mellanrum ignoreras när koden läses in. */
export const prettyCode = (code) => code.slice(0, 4) + " " + code.slice(4);
