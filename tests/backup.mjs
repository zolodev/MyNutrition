// Import av en export i en ren webbläsare. Körs av run.mjs som egen process per scenario (en import laddar om sidan,
// så varje fall behöver nya moduler):  bun tests/backup.mjs <scenario> <export.json>
//   guide        tom enhet: importera genom att klistra in i guidens första steg, utan varning
//   skriv-över   enhet med annan data: importera under Logg, varning, Ja ersätter allt
//   äldre        tom enhet: en export i det gamla formatet (version 1) läses in

import { JSDOM, VirtualConsole } from "jsdom";
import fs from "fs";

const [scenario, exportFile] = process.argv.slice(2);
const exported = fs.readFileSync(exportFile, "utf8");
const expected = JSON.parse(exported).data;

const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8").replace(/<script type="module"[^>]*><\/script>/, "").replace(/<link rel="stylesheet"[^>]*>/g, "");
let reloaded = false;
const virtualConsole = new VirtualConsole();
virtualConsole.on("jsdomError", (e) => (/navigation/i.test(e.message) ? (reloaded = true) : console.error(e)));
const win = new JSDOM(html, { url: "https://example.org/app/index.html", pretendToBeVisual: true, virtualConsole }).window;
const errors = [];
for (const k of ["document", "localStorage", "location", "navigator", "HTMLElement", "Event", "Blob"]) globalThis[k] = win[k];
globalThis.window = win; win.scrollTo = () => {}; win.HTMLElement.prototype.scrollIntoView = function () {};
win.addEventListener("error", (e) => errors.push(e.message));
const $ = (id) => win.document.getElementById(id);
const text = (id) => $(id).textContent.replace(/\s+/g, " ").trim();
const fire = (el, type) => el.dispatchEvent(new win.Event(type, { bubbles: true }));
const tick = () => new Promise((r) => setTimeout(r, 0));
const check = (label, cond) => { console.log((cond ? "OK   " : "FEL  ") + `import ${scenario}: ${label}`); if (!cond) process.exitCode = 1; };
const stored = () => Object.fromEntries(Object.keys(win.localStorage).map((k) => [k, JSON.parse(win.localStorage.getItem(k))]));
const same = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

if (scenario === "skriv-över") {
  win.localStorage.setItem("ffv", JSON.stringify({ age: "50", weight: "110", height: "190", goal: "100", sex: "m" }));
  win.localStorage.setItem("ffv-log", JSON.stringify({ entries: [{ date: "2025-01-01", weight: 112 }] }));
  win.localStorage.setItem("ffv-shop-999", JSON.stringify(["agg"]));
  win.localStorage.setItem("ffv-swipe-hint", "true");
}

await import("../public/js/app.js");

if (scenario === "guide") {
  check("Guiden visar import i första steget", !$("wizard").hidden && !$("wz-import").closest("[data-step]").hidden);
  fire($("wz-paste-toggle"), "click");
  $("wz-paste-text").value = "inte json";
  fire($("wz-paste-go"), "click"); await tick();
  check("Ogiltig text ger ett meddelande och sparar inget", text("wz-msg").startsWith("Texten är inte en giltig export") && win.localStorage.length === 0 && !reloaded);
  $("wz-paste-text").value = exported;
  fire($("wz-paste-go"), "click"); await tick();
  check("Ingen varning när enheten är tom", !$("confirm").hasAttribute("open"));
  check("Allt i exporten sparas i localStorage", same(stored(), expected));
  check("Sidan laddas om efter importen", reloaded);
}

if (scenario === "skriv-över") {
  check("Befintlig profil: ingen guide", $("wizard").hidden);
  $("l-paste").value = exported;
  fire($("l-paste-go"), "click"); await tick();
  check("Varnar för att befintliga uppgifter skrivs över", $("confirm").hasAttribute("open") && text("confirm-text").includes("skriva över") && text("confirm-detail").includes("profil"));
  fire($("confirm").querySelector('[data-answer="no"]'), "click"); await tick();
  check("Nej ändrar inget", JSON.parse(win.localStorage.getItem("ffv")).weight === "110" && text("l-msg").startsWith("Importen avbröts") && !reloaded);
  fire($("l-paste-go"), "click"); await tick();
  fire($("confirm").querySelector('[data-answer="yes"]'), "click"); await tick();
  const { "ffv-swipe-hint": hint, ...rest } = stored();
  check("Ja ersätter allt med exporten (gammal data och inköpslistor borta)", same(rest, expected) && !("ffv-shop-999" in rest));
  check("Inställningar som bara gäller enheten ligger kvar", hint === true);
  check("Sidan laddas om efter importen", reloaded);
}

if (scenario === "äldre") {
  const old = { app: "fettforbranningsveckan", version: 1, goal: 80, settings: { age: "33", weight: "90", height: "185", sex: "m" },
    plan: { seed: 4242, salts: {}, trainingSeed: 77 }, exclusions: { v: 2, allergens: ["sesam"], foods: [] }, myFoods: [], myRecipes: [],
    entries: [{ date: "2026-09-01", weight: 91.2 }] };
  $("wz-paste-text").value = JSON.stringify(old);
  fire($("wz-paste-go"), "click"); await tick();
  const s = stored();
  check("Äldre export: profil med målvikt, logg, frön och allergier", s.ffv.age === "33" && s.ffv.goal === "80" && s["ffv-log"].entries.length === 1 &&
    s["ffv-seed"] === 4242 && s["ffv-tseed"] === 77 && s["ffv-excl"].allergens.join() === "sesam" && reloaded);
}

check("Inga JS-fel", errors.length === 0);
if (errors.length) console.log(errors);
process.exit(process.exitCode ?? 0);
