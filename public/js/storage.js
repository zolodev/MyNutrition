// Lagring: IndexedDB i första hand, localStorage som reserv när IndexedDB saknas eller inte går att öppna.
//
// Appen läser och skriver synkront (load/save), men IndexedDB är asynkront. Därför läser initStorage() in allt
// i minnet en gång vid start (main.js väntar på det innan appen laddas). Sedan läses allt från minnet, och varje
// save/remove skrivs till IndexedDB i bakgrunden, i samma ordning som de görs. flush() väntar tills allt är skrivet.
//
// Data som finns i localStorage (från äldre versioner) flyttas till IndexedDB vid start och tas bort ur
// localStorage först när den är skriven. Bara appens nycklar ("ffv" och "ffv-…") rörs.
// Utan initStorage() (t.ex. i enhetstester) går load/save direkt mot localStorage.

const DB_NAME = "fettforbranning";
const STORE = "data";
const isAppKey = (k) => k === "ffv" || k.startsWith("ffv-");
// Kopia via JSON: sparat är alltid JSON-värden, och den som läser kan inte råka ändra det sparade
const copy = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

let cache = null; // Map nyckel → värde när initStorage() är klar
let db = null; // öppen IndexedDB, eller null när localStorage används
let pending = Promise.resolve();
/** "IndexedDB" eller "localStorage", för att kunna visa var uppgifterna ligger. */
export let backend = "localStorage";

// ---------- localStorage ----------

function lsGet(key) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? undefined : JSON.parse(v);
  } catch {
    return undefined;
  }
}
function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
function lsRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ingen lagring tillgänglig */
  }
}
function lsKeys() {
  try {
    return Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter(isAppKey);
  } catch {
    return [];
  }
}

// ---------- IndexedDB ----------

const done = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
const committed = (tx) => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onerror = tx.onabort = () => reject(tx.error);
});

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => {
      const opened = req.result;
      opened.onversionchange = () => opened.close(); // släpp databasen om den ska raderas eller uppgraderas
      resolve(opened);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("IndexedDB är blockerad"));
  });
}

/** Skriv till IndexedDB i bakgrunden. Misslyckas det sparas värdet i localStorage i stället. */
function write(change) {
  const tx = db.transaction(STORE, "readwrite");
  change(tx.objectStore(STORE));
  const result = committed(tx);
  pending = pending.then(() => result).catch(() => {});
  return result;
}

// ---------- Start ----------

/** Läs in allt sparat. Använder IndexedDB om det går, annars localStorage. */
export async function initStorage() {
  cache = new Map();
  try {
    if (typeof indexedDB === "undefined" || !indexedDB) throw new Error("IndexedDB saknas");
    db = await openDb();
    const store = db.transaction(STORE, "readonly").objectStore(STORE);
    const [keys, values] = await Promise.all([done(store.getAllKeys()), done(store.getAll())]);
    keys.forEach((k, i) => cache.set(k, values[i]));
    backend = "IndexedDB";

    // Flytta det som ligger i localStorage; det som redan finns i IndexedDB gäller
    const legacy = lsKeys();
    const moved = legacy.filter((k) => !cache.has(k)).map((k) => [k, lsGet(k)]).filter(([, v]) => v !== undefined);
    for (const [k, v] of moved) cache.set(k, v);
    if (moved.length) await write((s) => moved.forEach(([k, v]) => s.put(v, k)));
    for (const k of legacy) lsRemove(k);
  } catch {
    db = null;
    backend = "localStorage";
    cache = new Map(lsKeys().map((k) => [k, lsGet(k)]).filter(([, v]) => v !== undefined));
  }
}

/** Vänta tills alla skrivningar till IndexedDB är klara, t.ex. innan sidan laddas om. */
export const flush = () => pending;

// ---------- Läsa och skriva ----------

export function load(key, fallback) {
  const v = cache ? cache.get(key) : lsGet(key);
  return v == null ? fallback : copy(v);
}

/** Spara ett värde. Ger false om det inte gick (t.ex. localStorage i privat läge). */
export function save(key, value) {
  const v = copy(value);
  if (!cache) return lsSet(key, v);
  cache.set(key, v);
  if (!db) return lsSet(key, v);
  write((s) => s.put(v, key)).catch(() => lsSet(key, v));
  return true;
}

export function remove(key) {
  if (cache) cache.delete(key);
  if (db) write((s) => s.delete(key)).catch(() => {});
  lsRemove(key);
}

/** Alla appens sparade nycklar. */
export const keys = () => (cache ? [...cache.keys()] : lsKeys());

/** Radera allt appen har sparat, i både IndexedDB och localStorage. */
export function clearAll() {
  for (const k of keys()) remove(k);
  for (const k of lsKeys()) lsRemove(k);
  return flush();
}
