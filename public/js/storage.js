// Lagring: IndexedDB i första hand, localStorage som reserv när IndexedDB saknas eller inte går att öppna.
//
// Appen läser och skriver synkront (load/save), men IndexedDB är asynkront. Därför läser initStorage() in allt
// i minnet en gång vid start (main.js väntar på det innan appen laddas). Sedan läses allt från minnet, och varje
// save/remove skrivs till IndexedDB i bakgrunden, i samma ordning som de görs. flush() väntar tills allt är skrivet.
//
// Inget skrivs innan användaren har godkänt villkoren: lagringen är låst tills app.js anropar unlockStorage().
// Fram till dess öppnas IndexedDB bara om databasen redan finns, och då bara för att läsa; databasen skapas vid
// första skrivningen. Ändringar medan lagringen är låst finns bara i minnet och skrivs när den låses upp.
//
// Data i localStorage (från äldre versioner) flyttas till IndexedDB när lagringen låses upp och tas bort ur
// localStorage först när den är skriven. Bara appens nycklar ("ffv" och "ffv-…") rörs.
// Utan initStorage() (t.ex. i enhetstester) går load/save direkt mot localStorage.

const DB_NAME = "fettforbranning";
const STORE = "data";
const isAppKey = (k) => k === "ffv" || k.startsWith("ffv-");
// Kopia via JSON: sparat är alltid JSON-värden, och den som läser kan inte råka ändra det sparade
const copy = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

let cache = null; // Map nyckel → värde när initStorage() är klar
let useIdb = false; // IndexedDB går att använda (annars localStorage)
let db = null; // öppen databas; null tills den finns
let locked = true; // inga skrivningar innan villkoren är godkända
const unsaved = new Set(); // nycklar som ändrats medan lagringen var låst
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

/**
 * Öppna databasen. Med `create: false` skapas den inte om den saknas (uppgraderingen avbryts, så webbläsaren
 * tar bort den tomma databasen igen) och svaret blir null.
 */
function openDb({ create }) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    let missing = false;
    req.onupgradeneeded = (ev) => {
      if (!create && ev.oldVersion === 0) {
        missing = true;
        req.transaction.abort();
        return;
      }
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => {
      const opened = req.result;
      opened.onversionchange = () => opened.close(); // släpp databasen om den ska raderas eller uppgraderas
      resolve(opened);
    };
    req.onerror = (ev) => {
      ev.preventDefault?.();
      missing ? resolve(null) : reject(req.error);
    };
    req.onblocked = () => reject(new Error("IndexedDB är blockerad"));
  });
}

/** Skriv till IndexedDB i bakgrunden; databasen skapas vid första skrivningen. */
function write(change) {
  const result = pending.then(async () => {
    db ??= await openDb({ create: true });
    const tx = db.transaction(STORE, "readwrite");
    change(tx.objectStore(STORE));
    return committed(tx);
  });
  pending = result.catch(() => {});
  return result;
}

/** Skriv en nyckel till lagringen (IndexedDB eller localStorage). Ger false om det inte gick direkt. */
function persist(key) {
  const v = cache.get(key);
  if (!useIdb) {
    if (v === undefined) return lsRemove(key), true;
    return lsSet(key, v);
  }
  write((s) => (v === undefined ? s.delete(key) : s.put(v, key))).catch(() => v !== undefined && lsSet(key, v));
  return true;
}

// ---------- Start ----------

/** Läs in allt sparat, utan att skriva något. Använder IndexedDB om det går, annars localStorage. */
export async function initStorage() {
  cache = new Map();
  try {
    if (typeof indexedDB === "undefined" || !indexedDB) throw new Error("IndexedDB saknas");
    db = await openDb({ create: false });
    useIdb = true;
    backend = "IndexedDB";
    if (db) {
      const store = db.transaction(STORE, "readonly").objectStore(STORE);
      const [keys, values] = await Promise.all([done(store.getAllKeys()), done(store.getAll())]);
      keys.forEach((k, i) => cache.set(k, values[i]));
    }
  } catch {
    db = null;
    useIdb = false;
    backend = "localStorage";
  }
  // Det som ligger i localStorage läses in men flyttas först när lagringen låses upp; IndexedDB gäller vid dubbletter
  for (const k of lsKeys()) if (!cache.has(k)) {
    const v = lsGet(k);
    if (v !== undefined) cache.set(k, v);
  }
}

/**
 * Tillåt skrivningar (när villkoren är godkända). Skriver det som ändrats medan lagringen var låst och flyttar
 * data från localStorage till IndexedDB. Ger ett löfte som är klart när allt är skrivet.
 */
export function unlockStorage() {
  if (!cache || !locked) return flush();
  locked = false;
  if (!useIdb) {
    for (const k of unsaved) persist(k);
    unsaved.clear();
    return flush();
  }
  const legacy = lsKeys();
  const keys = [...new Set([...unsaved, ...legacy])];
  unsaved.clear();
  if (!keys.length) return flush();
  const entries = keys.map((k) => [k, cache.get(k)]);
  write((s) => entries.forEach(([k, v]) => (v === undefined ? s.delete(k) : s.put(v, k))))
    .then(() => legacy.forEach(lsRemove), () => {});
  return flush();
}

/** Vänta tills alla skrivningar är klara, t.ex. innan sidan laddas om. */
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
  if (locked) return unsaved.add(key), true;
  return persist(key);
}

export function remove(key) {
  if (!cache) return lsRemove(key);
  cache.delete(key);
  if (locked) return unsaved.add(key);
  persist(key);
  lsRemove(key);
}

/** Alla appens sparade nycklar. */
export const keys = () => (cache ? [...cache.keys()] : lsKeys());

/** Radera allt appen har sparat: hela databasen och appens nycklar i localStorage. */
export async function clearAll() {
  await pending;
  cache?.clear();
  unsaved.clear();
  for (const k of lsKeys()) lsRemove(k);
  if (!useIdb) return;
  db?.close();
  db = null;
  await new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}
