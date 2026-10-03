// Lagringstest: IndexedDB (fake-indexeddb) med localStorage som reserv. Körs av run.mjs som egen process.
// Varje "sidladdning" är en ny instans av storage.js (frågesträngen ger en ny modul).

import "fake-indexeddb/auto";
import { JSDOM } from "jsdom";
import fs from "fs";

const check = (label, cond) => { console.log((cond ? "OK   " : "FEL  ") + "lagring: " + label); if (!cond) process.exitCode = 1; };

// localStorage i minnet, med length och key() som i webbläsaren
const memory = new Map();
globalThis.localStorage = {
  get length() { return memory.size; },
  key: (i) => [...memory.keys()][i] ?? null,
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
};
let n = 0;
const pageLoad = async () => {
  const s = await import(`../public/js/storage.js?sida${++n}`);
  await s.initStorage();
  return s;
};
const idb = () => new Promise((resolve) => {
  const req = indexedDB.open("fettforbranning", 1);
  req.onupgradeneeded = () => req.result.createObjectStore("data");
  req.onsuccess = () => {
    const store = req.result.transaction("data").objectStore("data");
    const out = {};
    const cursor = store.openCursor();
    cursor.onsuccess = () => {
      const c = cursor.result;
      if (c) { out[c.key] = c.value; c.continue(); } else { req.result.close(); resolve(out); }
    };
  };
});

// 1. Uppdatering från en version som använde localStorage
memory.set("ffv", JSON.stringify({ age: "40", weight: "95" }));
memory.set("ffv-log", JSON.stringify({ entries: [{ date: "2026-09-01", weight: 95 }] }));
memory.set("annan-app", "rörs inte");
let s = await pageLoad();
await s.flush();
let db = await idb();
check("IndexedDB används när det finns", s.backend === "IndexedDB");
check("Data i localStorage flyttas till IndexedDB", s.load("ffv").weight === "95" && db.ffv?.weight === "95" && db["ffv-log"]?.entries.length === 1);
check("Flyttad data tas bort ur localStorage, annat rörs inte", !memory.has("ffv") && !memory.has("ffv-log") && memory.get("annan-app") === "rörs inte");

// 2. Skrivningar finns kvar efter omladdning och hamnar inte i localStorage
s.save("ffv-seed", 123456);
s.remove("ffv-log");
await s.flush();
s = await pageLoad();
check("Sparat finns kvar efter omladdning", s.load("ffv-seed") === 123456 && s.load("ffv-log") === undefined && s.load("ffv").age === "40");
check("Inget skrivs till localStorage när IndexedDB fungerar", ![...memory.keys()].some((k) => k.startsWith("ffv")));
check("load ger standardvärdet när nyckeln saknas", s.load("ffv-saknas", "standard") === "standard");

// 3. Den som läser kan inte råka ändra det sparade
const profile = s.load("ffv");
profile.age = "99";
check("Ändringar i ett inläst objekt påverkar inte det sparade", s.load("ffv").age === "40");

// 4. Finns samma nyckel i båda gäller IndexedDB, och dubbletten i localStorage tas bort
memory.set("ffv-seed", "5");
s = await pageLoad();
check("IndexedDB gäller före en äldre kopia i localStorage", s.load("ffv-seed") === 123456 && !memory.has("ffv-seed"));

// 5. Radera allt
memory.set("ffv-terms", JSON.stringify({ version: 1 }));
await s.clearAll();
db = await idb();
s = await pageLoad();
check("Radera allt tömmer IndexedDB och localStorage", Object.keys(db).length === 0 && s.keys().length === 0 && ![...memory.keys()].some((k) => k.startsWith("ffv")) && memory.get("annan-app") === "rörs inte");

// 6. Reserv: utan IndexedDB, och när IndexedDB inte går att öppna
const realIndexedDB = globalThis.indexedDB;
delete globalThis.indexedDB;
s = await pageLoad();
check("Utan IndexedDB används localStorage", s.backend === "localStorage" && s.save("ffv-seed", 7) && memory.get("ffv-seed") === "7");
s = await pageLoad();
check("localStorage som reserv finns kvar efter omladdning", s.load("ffv-seed") === 7);
globalThis.indexedDB = { open() { throw new Error("spärrad"); } };
s = await pageLoad();
check("Går IndexedDB inte att öppna används localStorage", s.backend === "localStorage" && s.load("ffv-seed") === 7);
globalThis.indexedDB = realIndexedDB;
s = await pageLoad();
check("När IndexedDB fungerar igen flyttas reservdatan dit", s.backend === "IndexedDB" && s.load("ffv-seed") === 7 && !memory.has("ffv-seed"));
await s.clearAll();

// 7. Hela appen: en profil och logg i localStorage från en äldre version flyttas till IndexedDB och läses in
const TERMS_VERSION = Number(fs.readFileSync(new URL("../public/js/app.js", import.meta.url), "utf8").match(/const TERMS_VERSION = (\d+)/)[1]);
memory.set("ffv", JSON.stringify({ age: "52", weight: "101", height: "183", goal: "88", sex: "m" }));
memory.set("ffv-log", JSON.stringify({ entries: [{ date: "2026-09-01", weight: 101.4 }] }));
memory.set("ffv-terms", JSON.stringify({ version: TERMS_VERSION, accepted: "2026-01-01T00:00:00.000Z" }));
const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8").replace(/<script type="module"[^>]*><\/script>/, "").replace(/<link rel="stylesheet"[^>]*>/g, "");
const win = new JSDOM(html, { url: "https://example.org/app/index.html", pretendToBeVisual: true }).window;
const errors = [];
for (const k of ["document", "location", "navigator", "HTMLElement", "Event", "Blob"]) globalThis[k] = win[k];
globalThis.window = win; win.scrollTo = () => {}; win.HTMLElement.prototype.scrollIntoView = function () {};
win.addEventListener("error", (e) => errors.push(e.message));
await import("../public/js/main.js");
const storage = await import("../public/js/storage.js");
await storage.flush();
db = await idb();
check("Appen startar med IndexedDB", storage.backend === "IndexedDB" && win.document.getElementById("wizard").hidden);
check("Appen läser in profilen som flyttats från localStorage", win.document.getElementById("weight").value === "101" && db.ffv?.weight === "101" && !memory.has("ffv"));
check("Loggen flyttas med", db["ffv-log"]?.entries[0]?.weight === 101.4);
win.document.getElementById("weight").value = "100,5";
win.document.getElementById("f").dispatchEvent(new win.Event("input", { bubbles: true }));
await storage.flush();
check("Ändringar i appen sparas i IndexedDB", (await idb()).ffv?.weight === "100,5" && !memory.has("ffv"));
check("Inga JS-fel", errors.length === 0);
if (errors.length) console.log(errors);
process.exit(process.exitCode ?? 0);
