// Uppdateringstest: startar appen på nytt med sparad localStorage, som när en ny version laddas,
// och kontrollerar att profilen, loggen och de andra inställningarna finns kvar och inte skrivs om.
// Körs av run.mjs som en egen process (modulerna läser lagringen när de laddas):  bun tests/reload.mjs <lagring.json> <namn>

import { JSDOM } from "jsdom";
import fs from "fs";

const [file, name = "omstart"] = process.argv.slice(2);
const stored = JSON.parse(fs.readFileSync(file, "utf8"));

const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8").replace(/<script type="module"[^>]*><\/script>/, "").replace(/<link rel="stylesheet"[^>]*>/g, "");
const win = new JSDOM(html, { url: "https://example.org/app/index.html", pretendToBeVisual: true }).window;
for (const [k, v] of Object.entries(stored)) win.localStorage.setItem(k, v);
const errors = [];
for (const k of ["document", "localStorage", "location", "navigator", "HTMLElement", "Event", "Blob"]) globalThis[k] = win[k];
globalThis.window = win; win.scrollTo = () => {}; win.HTMLElement.prototype.scrollIntoView = function () {};
win.addEventListener("error", (e) => errors.push(e.message));
const $ = (id) => win.document.getElementById(id);
const check = (label, cond) => { console.log((cond ? "OK   " : "FEL  ") + `${name}: ${label}`); if (!cond) process.exitCode = 1; };

await import("../public/js/app.js");

if (!Object.keys(stored).length) {
  // Första start: guiden visas och inget sparas förrän den är klar; sedan finns profil och ett eget frö
  check("Guiden visas och localStorage är tom", !$("wizard").hidden && win.localStorage.length === 0);
  const next = () => $("wz-next").dispatchEvent(new win.Event("click"));
  $("wz-accept").checked = true; next();
  win.document.querySelector('input[name="sex"][value="k"]').checked = true;
  Object.assign($("age"), { value: "35" }); $("weight").value = "70"; $("height").value = "168";
  next(); $("goal").value = "64"; next(); next(); // BMI 24,8: ingen föreslagen målvikt, så den fylls i här
  win.document.querySelector('[data-wz-allergen="sesam"]').checked = true;
  check("Inget sparat före Klar", win.localStorage.length === 0);
  next();
  const seed = JSON.parse(win.localStorage.getItem("ffv-seed"));
  check("Klar sparar profilen", JSON.parse(win.localStorage.getItem("ffv") || "{}").sex === "k" && $("wizard").hidden);
  check("Klar skapar ett eget frö", Number.isInteger(seed) && seed !== 0);
  check("Allergin från guiden sparas", JSON.parse(win.localStorage.getItem("ffv-excl")).allergens.join() === "sesam");
  check("Inga JS-fel", errors.length === 0);
  process.exit(process.exitCode ?? 0);
}

// Befintlig profil utan godkända villkor: bara villkoren visas, profilen ligger kvar på sin plats
if (!("ffv-terms" in stored)) {
  check("Utan godkända villkor visas villkoren först", !$("wizard").hidden && $("wz-progress").textContent === "Villkor" && $("f").closest("[data-view]").dataset.view === "profil");
  $("wz-accept").checked = true;
  $("wz-next").dispatchEvent(new win.Event("click"));
  check("Godkännandet sparas och appen startar", $("wizard").hidden && JSON.parse(win.localStorage.getItem("ffv-terms")).version === 1);
}

const after = (k) => win.localStorage.getItem(k);
const profile = JSON.parse(stored.ffv || "{}");
const field = (k) => $(k)?.value ?? win.document.querySelector(`input[name="${k}"]:checked`)?.value;
const expected = (k) => (k === "tdays-val" && profile[k] == null && profile.days ? (profile.days == 4 ? "0,1,3,4" : "0,2,4") : profile[k]);

check("Profilen läses in i formuläret", Object.keys(profile).filter((k) => k !== "days").every((k) => field(k) === String(expected(k))) && (profile.days == null || field("tdays-val") === expected("tdays-val")));
check("Profilen ligger kvar i localStorage", after("ffv") === stored.ffv);
const log = JSON.parse(stored["ffv-log"] || '{"entries":[]}').entries;
check(`Alla ${log.length} loggposter finns kvar`, JSON.parse(after("ffv-log") || '{"entries":[]}').entries.length === log.length && log.every((e) => after("ffv-log").includes(`"date":"${e.date}"`)));
const lost = Object.keys(stored).filter((k) => after(k) == null);
check("Inga sparade nycklar försvinner", lost.length === 0);
const changed = ["ffv-seed", "ffv-tseed", "ffv-salt", "ffv-excl", "ffv-myfoods", "ffv-myrecipes", "ffv-supps", "ffv-log"].filter((k) => k in stored && after(k) !== stored[k]);
check("Plan, allergier, egna recept och logg skrivs inte om vid start", changed.length === 0);
check("Ingen guide när profilen finns och villkoren är godkända", $("wizard").hidden);
check("Inga JS-fel", errors.length === 0);
if (lost.length || changed.length || errors.length) console.log({ lost, changed, errors });
process.exit(process.exitCode ?? 0);
