// Livsmedel, butiksavdelningar, allergener och ersättare.
//
// FOOD: näringsvärde per 100 g (k = kcal, p = protein, c = kolhydrater, f = fett).
//   n = namn i inköpslistan, s = kort namn i recepttitlar, per/unit = gram per styck för styckvaror.

export const FOOD = {
  havre:    { n: "Havregryn", k: 370, p: 13, c: 59, f: 7 },
  mjolk:    { n: "Mellanmjölk 0,5 % (lättmjölk)", k: 39, p: 3.5, c: 5, f: 0.5 },
  kvarg:    { n: "Kvarg naturell", k: 60, p: 11, c: 3.5, f: 0.2 },
  blabar:   { n: "Blåbär, frysta (gärna egenplockade)", k: 50, p: 0.7, c: 10, f: 0.5, s: "blåbär" },
  agg:      { n: "Ägg", k: 140, p: 12.5, c: 0.5, f: 10, per: 60, unit: "st" },
  aggvita:  { n: "Äggvita, flytande", k: 48, p: 11, c: 0.7, f: 0 },
  knacke:   { n: "Knäckebröd, fullkorn", k: 335, p: 9, c: 66, f: 2, per: 12.5, unit: "skivor" },
  tomat:    { n: "Tomater, svenska, färska", k: 20, p: 0.9, c: 3, f: 0.2, s: "tomat" },
  spenat:   { n: "Babyspenat", k: 20, p: 2, c: 1.5, f: 0.3, s: "spenat" },
  keso:     { n: "Keso 1,5 %", k: 80, p: 12, c: 3, f: 2 },
  apple:    { n: "Äpple, svenskt", k: 52, p: 0.3, c: 12, f: 0.2, s: "äpple" },
  kalkon:   { n: "Kalkonpålägg", k: 100, p: 20, c: 1.5, f: 1.5 },
  gurka:    { n: "Gurka, svensk", k: 12, p: 0.6, c: 2, f: 0.1, s: "gurka" },
  olja:     { n: "Olivolja", k: 900, p: 0, c: 0, f: 100 },
  kyckling: { n: "Kycklingfilé", k: 105, p: 23, c: 0, f: 1.5 },
  ris:      { n: "Fullkornsris, torrt", k: 350, p: 8, c: 72, f: 2.5 },
  broccoli: { n: "Broccoli", k: 35, p: 3, c: 4, f: 0.4, s: "broccoli" },
  lok:      { n: "Gul lök", k: 40, p: 1.2, c: 8, f: 0.1 },
  sej:      { n: "Sejfilé", k: 80, p: 18, c: 0, f: 0.8 },
  lax:      { n: "Laxfilé", k: 200, p: 20, c: 0, f: 13 },
  potatis:  { n: "Potatis", k: 75, p: 2, c: 16, f: 0.1, s: "potatis" },
  paprika:  { n: "Paprika, svensk", k: 30, p: 1, c: 5, f: 0.3, s: "paprika" },
  torsk:    { n: "Torskfilé", k: 75, p: 17.5, c: 0, f: 0.7 },
  tortilla: { n: "Fullkornstortilla", k: 300, p: 9, c: 48, f: 7 },
  ost:      { n: "Riven ost 17 %", k: 270, p: 29, c: 0, f: 17 },
  linser:   { n: "Röda linser, torra", k: 340, p: 24, c: 50, f: 1.5 },
  pasta:    { n: "Fullkornspasta, torr", k: 350, p: 13, c: 62, f: 2.5 },
  kycklingfars: { n: "Kycklingfärs", k: 130, p: 19, c: 0, f: 6 },
  bulgur:   { n: "Bulgur, torr", k: 350, p: 12, c: 70, f: 1.5 },
  rakor:    { n: "Räkor, skalade", k: 75, p: 17, c: 0, f: 1 },
  flaskfile: { n: "Fläskfilé", k: 110, p: 21, c: 0, f: 2.5 },
  morot:    { n: "Morötter", k: 41, p: 0.9, c: 10, f: 0.2, s: "morötter" },
  farskpotatis: { n: "Färskpotatis", k: 70, p: 1.8, c: 15, f: 0.1, s: "färskpotatis" },
  rotfrukter: { n: "Rotfrukter (kålrot, morot, palsternacka)", k: 40, p: 1, c: 8, f: 0.2, s: "rotfrukter" },
  vitkal:   { n: "Vitkål", k: 30, p: 1.3, c: 5, f: 0.2, s: "vitkål" },
  blomkal:  { n: "Blomkål", k: 25, p: 2, c: 3, f: 0.3, s: "blomkål" },
  sallad:   { n: "Sallad, svensk", k: 15, p: 1.3, c: 2, f: 0.2, s: "sallad" },
  gronkal:  { n: "Grönkål", k: 50, p: 3, c: 6, f: 0.8, s: "grönkål" },
  ananas:   { n: "Ananas, färsk eller fryst", k: 50, p: 0.5, c: 12, f: 0.1, s: "ananas" },
  mango:    { n: "Mango, färsk eller fryst", k: 60, p: 0.8, c: 14, f: 0.4, s: "mango" },
  papaya:   { n: "Papaya, färsk", k: 43, p: 0.5, c: 11, f: 0.3, s: "papaya" },
  kiwi:     { n: "Kiwi", k: 61, p: 1.1, c: 15, f: 0.5, s: "kiwi" },
  kalrot:   { n: "Kålrot, riven eller i stavar", k: 35, p: 1, c: 7, f: 0.2, s: "kålrot" },
  jordgubbar: { n: "Jordgubbar, svenska", k: 32, p: 0.7, c: 6, f: 0.3, s: "jordgubbar" },
  blabarF:  { n: "Blåbär, färska", k: 50, p: 0.7, c: 10, f: 0.5, s: "blåbär" },
  lingon:   { n: "Lingon (rårörda utan socker eller frysta)", k: 45, p: 0.7, c: 9, f: 0.6, s: "lingon" },
  radisor:  { n: "Rädisor", k: 16, p: 0.7, c: 3, f: 0.1 },
  renskav:  { n: "Renskav", k: 115, p: 22, c: 0, f: 3 },
  algfars:  { n: "Älgfärs", k: 115, p: 22, c: 0, f: 3 },
  algskav:  { n: "Älgskav", k: 110, p: 22, c: 0, f: 2.5 },
  tunnbrod: { n: "Mjukt tunnbröd", k: 290, p: 8, c: 55, f: 4, per: 40, unit: "st" },
  brunabonor: { n: "Bruna bönor, svenska, kokta", k: 120, p: 8, c: 17, f: 0.5 },
  gulaartor: { n: "Gula ärtor, svenska, kokta", k: 115, p: 8, c: 16, f: 0.5 },
  kalmix:   { n: "Vitkål och morot, strimlade", k: 33, p: 1.2, c: 6, f: 0.2, s: "kål och morot" },
  sommargron: { n: "Sommargrönsaker (broccoli, sockerärtor, salladslök)", k: 35, p: 2.5, c: 5, f: 0.3, s: "sommargrönsaker" },
  hostgron: { n: "Höstgrönsaker (blomkål, broccoli, grönkål)", k: 30, p: 2.5, c: 4, f: 0.4, s: "höstgrönsaker" },
  algkott:  { n: "Älgkött, grytbitar", k: 105, p: 23, c: 0, f: 1.5 },
  svamp:    { n: "Svamp (kantareller, Karl Johan)", k: 30, p: 2.5, c: 3, f: 0.5 },
  filmjolk: { n: "Filmjölk 0,5 %", k: 37, p: 3.4, c: 4.5, f: 0.5 },
  choklad:  { n: "Mörk choklad 70 %", k: 580, p: 8, c: 35, f: 43 },
  popcorn:  { n: "Popcorn, opoppade", k: 380, p: 12, c: 63, f: 4.5 },

  // Ersättare som bara används när originalet är bortvalt (se SUBSTITUTES)
  sojayoghurt: { n: "Sojayoghurt naturell (mjölkfri)", k: 50, p: 4, c: 2, f: 2.3 },
  havredryck: { n: "Havredryck, osötad", k: 45, p: 1, c: 6.5, f: 1.5 },
  havreGF:  { n: "Havregryn, glutenfria", k: 370, p: 13, c: 59, f: 7 },
  knackeGF: { n: "Knäckebröd, glutenfritt", k: 380, p: 6, c: 75, f: 5, per: 10, unit: "skivor" },
  tortillaMajs: { n: "Majstortilla (glutenfri)", k: 220, p: 5.5, c: 45, f: 2.5 }
};

/** Butiksavdelningar i inköpslistan, i den ordning man går i butiken. */
export const CATEGORIES = [
  ["kott", "Kött och chark"],
  ["fisk", "Fisk och skaldjur"],
  ["mejeri", "Mejeri och ägg"],
  ["gron", "Grönsaker och potatis"],
  ["frukt", "Frukt och bär"],
  ["skafferi", "Skafferi"],
  ["extra", "Andra vanliga allergener"], // bara i listan över ingredienser att välja bort
];

const CATEGORY_OF = {};
const byCategory = {
  kott: "kyckling kycklingfars algfars algskav renskav algkott flaskfile kalkon",
  fisk: "sej torsk lax rakor",
  mejeri: "kvarg keso mjolk filmjolk ost agg aggvita sojayoghurt havredryck",
  gron: "potatis farskpotatis rotfrukter vitkal kalmix blomkal broccoli sallad spenat gronkal kalrot morot tomat gurka paprika lok svamp radisor sommargron hostgron",
  frukt: "blabar blabarF jordgubbar lingon apple ananas mango papaya kiwi",
  skafferi: "havre havreGF ris pasta bulgur knacke knackeGF tortilla tortillaMajs tunnbrod brunabonor gulaartor linser olja popcorn choklad",
};
for (const [cat, ids] of Object.entries(byCategory)) for (const id of ids.split(" ")) CATEGORY_OF[id] = cat;

export const categoryOf = (id) => CATEGORY_OF[id] || "skafferi";
export const setCategory = (id, cat) => (CATEGORY_OF[id] = cat);

/**
 * Grupper för skalning av portioner: proteinkällor, kolhydratkällor och fettkällor får var sin faktor.
 * Allt annat (grönsaker, bär, frukt) behåller sin mängd.
 */
const PROTEIN = new Set(["kvarg", "keso", "agg", "aggvita", "kalkon", "kyckling", "kycklingfars", "sej", "torsk", "rakor", "flaskfile", "renskav", "algfars", "algkott"]);
const CARB = new Set(["havre", "ris", "pasta", "bulgur", "potatis", "farskpotatis", "knacke", "tortilla", "tunnbrod", "brunabonor", "gulaartor", "linser"]);
const FAT = new Set(["olja", "ost"]);
export const scaleGroupOf = (id) => (PROTEIN.has(id) ? "p" : CARB.has(id) ? "c" : FAT.has(id) ? "f" : "o");

/** Livsmedel som ger gaser eller svavel (ägg, kål, baljväxter); måltider med dem får en frukt ur DIGESTIVE_FRUITS (se menu.js). */
export const GASSY = new Set(["agg", "aggvita", "vitkal", "kalmix", "gronkal", "blomkal", "hostgron", "broccoli", "sommargron", "brunabonor", "gulaartor", "linser"]);

/**
 * Frukter med enzymer som hjälper till att bryta ner maten: bromelain (ananas) och papain (papaya) bryter ner
 * protein, aktinidin (kiwi) likaså, och mango innehåller amylas. Färska eller frysta, inte konserverade (värmen
 * förstör enzymerna). De varieras mellan rätterna och veckorna.
 */
export const DIGESTIVE_FRUITS = ["ananas", "papaya", "kiwi", "mango"];

/**
 * Allergener, en per rad så att man kan välja flera var för sig.
 * foods = livsmedel i recepten som innehåller allergenen.
 * words = ord som känns igen i namnen på egna livsmedel.
 */
export const ALLERGENS = [
  { id: "vete", n: "Vete", foods: ["pasta", "bulgur", "tortilla", "tunnbrod"], words: ["vete", "dinkel", "bulgur", "couscous", "pasta", "tortilla", "tunnbröd", "mjöl"] },
  { id: "rag", n: "Råg", foods: ["knacke"], words: ["råg", "knäcke"] },
  { id: "korn", n: "Korn", foods: [], words: ["korngryn", "kornmjöl", "malt"] },
  { id: "havre", n: "Havre", foods: ["havre", "havreGF", "havredryck"], words: ["havre"] },
  { id: "mjolk", n: "Mjölkprotein", foods: ["kvarg", "keso", "mjolk", "filmjolk", "ost"], words: ["mjölk", "grädde", "smör", "kvarg", "keso", "ost ", "ost,", "fil", "skyr", "vassle"] },
  { id: "laktos", n: "Laktos", foods: ["kvarg", "keso", "mjolk", "filmjolk"], words: ["mjölk", "grädde", "kvarg", "keso", "fil", "skyr"] },
  { id: "agg", n: "Ägg", foods: ["agg", "aggvita"], words: ["ägg"] },
  { id: "fisk", n: "Fisk", foods: ["sej", "torsk", "lax"], words: ["fisk", "lax", "torsk", "sej", "sill", "makrill", "röding", "sik", "abborre", "gädda"] },
  { id: "skaldjur", n: "Skaldjur", foods: ["rakor"], words: ["räk", "krabb", "hummer", "kräft", "skaldjur", "langust"] },
  { id: "blotdjur", n: "Blötdjur", foods: [], words: ["mussl", "ostron", "bläckfisk", "snäck"] },
  { id: "notter", n: "Nötter", foods: [], words: ["nöt", "cashew", "pistage", "pekan", "macadamia"] },
  { id: "mandel", n: "Mandel", foods: [], words: ["mandel"] },
  { id: "jordnot", n: "Jordnötter", foods: [], words: ["jordnöt"] },
  { id: "soja", n: "Soja", foods: ["sojayoghurt"], words: ["soja", "tofu", "edamame"] },
  { id: "bonor", n: "Bönor", foods: ["brunabonor"], words: ["böna", "bönor"] },
  { id: "artor", n: "Ärtor", foods: ["gulaartor", "sommargron"], words: ["ärtor", "ärt "] },
  { id: "linser", n: "Linser", foods: ["linser"], words: ["lins"] },
  { id: "apelsin", n: "Apelsin", foods: [], words: ["apelsin"] },
  { id: "mandarin", n: "Mandarin", foods: [], words: ["mandarin", "satsuma"] },
  { id: "clementin", n: "Clementin", foods: [], words: ["clementin", "klementin"] },
  { id: "citron", n: "Citron", foods: [], words: ["citron"] },
  { id: "lime", n: "Lime", foods: [], words: ["lime"] },
  { id: "selleri", n: "Selleri", foods: [], words: ["selleri"] },
  { id: "senap", n: "Senap", foods: [], words: ["senap"] },
  { id: "sesam", n: "Sesam", foods: [], words: ["sesam", "tahini"] },
  { id: "lupin", n: "Lupin", foods: [], words: ["lupin"] },
  { id: "sulfit", n: "Sulfiter", foods: [], words: ["sulfit"] },
];

/** Äldre sparade grupper och vilka enskilda allergener de motsvarar nu. */
export const LEGACY_ALLERGENS = {
  citrus: ["apelsin", "mandarin", "clementin"],
  apelsin: ["apelsin", "mandarin", "clementin"], // "Apelsin, mandarin och clementin"
  citron: ["citron", "lime"], // "Citron och lime"
  gluten: ["vete", "rag", "korn", "havre"],
  mjolk: ["mjolk", "laktos"], // "Mjölkprotein och laktos"
  notter: ["notter", "mandel"], // "Nötter och mandel"
  baljvaxter: ["bonor", "artor", "linser"],
};

export const allergenById = (id) => ALLERGENS.find((a) => a.id === id);

/**
 * Produkter som inte finns i recepten och inte är allergener, men som kan väljas bort så att de aldrig kommer med
 * via egna livsmedel.
 * word = det som letas efter i namnet på ett eget livsmedel.
 */
export const EXTRA_PRODUCTS = [
  { id: "x_grapefrukt", n: "Grapefrukt", word: "grapefrukt" },
  { id: "x_tonfisk", n: "Tonfisk", word: "tonfisk" },
  { id: "x_rodbetor", n: "Rödbetor", word: "rödbet" },
  { id: "x_kiwi", n: "Kiwi", word: "kiwi" },
];
/** Bortvalda extra produkter från äldre versioner som nu är egna allergener. */
export const LEGACY_PRODUCTS = {
  x_apelsin: "apelsin", x_clementin: "clementin", x_mandarin: "mandarin", x_citron: "citron", x_lime: "lime",
  x_jordnotter: "jordnot", x_sesam: "sesam", x_selleri: "selleri", x_senap: "senap", x_musslor: "blotdjur",
  x_hasselnotter: "notter", x_tofu: "soja",
};

/** Ersättare när ett livsmedel är bortvalt. Den första som inte själv är bortvald används. */
export const SUBSTITUTES = {
  sej: ["torsk"], torsk: ["sej"], lax: ["sej", "torsk"],
  kalkon: ["kyckling"], flaskfile: ["kyckling"], kycklingfars: ["algfars"], algfars: ["kycklingfars"],
  renskav: ["algskav"], algskav: ["renskav"], algkott: ["algskav", "renskav"],
  kvarg: ["keso", "sojayoghurt"], keso: ["kvarg", "sojayoghurt"], mjolk: ["havredryck"], filmjolk: ["sojayoghurt", "havredryck"],
  havre: ["havreGF"], knacke: ["knackeGF"], pasta: ["ris"], bulgur: ["ris"], tortilla: ["tortillaMajs"], tunnbrod: ["tortillaMajs"],
  brunabonor: ["gulaartor"], gulaartor: ["brunabonor"], potatis: ["farskpotatis", "rotfrukter"], farskpotatis: ["potatis"], ris: ["potatis"],
  vitkal: ["kalmix", "morot"], kalmix: ["vitkal", "morot"], gronkal: ["vitkal", "sallad"], blomkal: ["broccoli", "rotfrukter"], broccoli: ["blomkal"],
  sallad: ["spenat", "vitkal"], spenat: ["sallad"], kalrot: ["morot", "rotfrukter"], morot: ["kalrot", "rotfrukter"], rotfrukter: ["morot", "potatis"],
  tomat: ["gurka", "morot"], gurka: ["morot"], paprika: ["morot"], hostgron: ["blomkal", "broccoli"], sommargron: ["broccoli"],
  blabar: ["lingon", "jordgubbar"], blabarF: ["blabar"], jordgubbar: ["blabarF", "blabar"], lingon: ["blabar"], apple: ["blabar"],
  ananas: ["mango"], mango: ["ananas"], papaya: ["ananas"], kiwi: ["mango"],
};
