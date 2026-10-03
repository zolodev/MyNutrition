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
check("Ingen Kom igång-ruta när profilen finns", !profile.age || $("td-profile").hidden);
check("Inga JS-fel", errors.length === 0);
if (lost.length || changed.length || errors.length) console.log({ lost, changed, errors });
process.exit(process.exitCode ?? 0);
