// Import av en export i en ren webbläsare. Körs av run.mjs som egen process per scenario (en import laddar om sidan,
// så varje fall behöver nya moduler):  bun tests/backup.mjs <scenario> <export.json>
//   guide        tom enhet: importera genom att klistra in i guidens första steg, utan varning
//   skriv-över   enhet med annan data: importera under Logg, varning, Ja ersätter allt
//   äldre        tom enhet: en export i det gamla formatet (version 1) läses in
//   radera       Inställningar → Radera all data: bekräftelse, allt raderas (även godkända villkor), sidan börjar om

import { JSDOM, VirtualConsole } from "jsdom";
import fs from "fs";
const TERMS_VERSION = Number(fs.readFileSync(new URL("../public/js/app.js", import.meta.url), "utf8").match(/const TERMS_VERSION = (\d+)/)[1]);

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

if (scenario === "skriv-över" || scenario === "radera") {
  win.localStorage.setItem("ffv-terms", JSON.stringify({ version: TERMS_VERSION, accepted: "2026-01-01T00:00:00.000Z" }));
  win.localStorage.setItem("ffv", JSON.stringify({ age: "50", weight: "110", height: "190", goal: "100", sex: "m" }));
  win.localStorage.setItem("ffv-log", JSON.stringify({ entries: [{ date: "2025-01-01", weight: 112 }] }));
  win.localStorage.setItem("ffv-shop-999", JSON.stringify(["agg"]));
  win.localStorage.setItem("ffv-swipe-hint", "true");
}

await import("../public/js/main.js");

// Guidens villkor kommer först; importen finns i steg 2. Godkännandet gäller enheten och ingår inte i exporten.
const acceptTerms = () => { if ($("wz-accept").closest("[data-step]").hidden) fire($("wz-next"), "click"); /* förbi välkomststeget */ $("wz-accept").checked = true; fire($("wz-accept"), "change"); fire($("wz-next"), "click"); };
const withoutDevice = ({ "ffv-terms": _t, "ffv-swipe-hint": _h, ...rest }) => rest;

if (scenario === "guide") {
  check("Importen syns först när villkoren är godkända", !$("wizard").hidden && $("wz-import").closest("[data-step]").hidden);
  acceptTerms();
  check("Guiden visar import överst i steg 2", !$("wz-import").closest("[data-step]").hidden);
  fire($("wz-paste-toggle"), "click");
  $("wz-paste-text").value = "inte json";
  fire($("wz-paste-go"), "click"); await tick();
  check("Ogiltig text ger ett meddelande och sparar inget", text("wz-msg").startsWith("Texten är inte en giltig export") && win.localStorage.length === 0 && !reloaded);
  $("wz-paste-text").value = exported;
  fire($("wz-paste-go"), "click"); await tick();
  check("Ingen varning när enheten är tom", !$("confirm").hasAttribute("open"));
  check("Allt i exporten sparas i localStorage", same(withoutDevice(stored()), expected));
  check("Godkända villkor sparas vid import i guiden", stored()["ffv-terms"]?.version === TERMS_VERSION);
  check("Sidan laddas om efter importen", reloaded);
}

if (scenario === "skriv-över") {
  check("Befintlig profil: ingen guide", $("wizard").hidden);
  $("l-paste").value = exported;
  fire($("l-paste-go"), "click"); await tick();
  check("Varnar för att befintliga uppgifter skrivs över", $("confirm").hasAttribute("open") && text("confirm-text").includes("skriva över") && text("confirm-detail").includes("profil"));
  fire($("confirm").querySelector('[data-answer="no"]'), "click"); await tick();
  check("Nej ändrar inget", JSON.parse(win.localStorage.getItem("ffv")).weight === "110" && text("backup-msg").startsWith("Importen avbröts") && !reloaded);
  fire($("l-paste-go"), "click"); await tick();
  fire($("confirm").querySelector('[data-answer="yes"]'), "click"); await tick();
  const rest = withoutDevice(stored());
  check("Ja ersätter allt med exporten (gammal data och inköpslistor borta)", same(rest, expected) && !("ffv-shop-999" in rest));
  check("Inställningar som bara gäller enheten ligger kvar (svep-tips, godkända villkor)", stored()["ffv-swipe-hint"] === true && stored()["ffv-terms"]?.version === TERMS_VERSION);
  check("Sidan laddas om efter importen", reloaded);
}

if (scenario === "radera") {
  win.localStorage.setItem("other-app", "behålls");
  fire($("erase-all"), "click"); await tick();
  check("Radera frågar i en modal och nämner godkännandet", $("confirm").hasAttribute("open") && text("confirm-text").includes("radera all data och dra tillbaka ditt godkännande"));
  fire($("confirm").querySelector('[data-answer="no"]'), "click"); await tick();
  check("Nej raderar inget", win.localStorage.getItem("ffv") != null && win.localStorage.getItem("ffv-terms") != null && !reloaded);
  fire($("erase-all"), "click"); await tick();
  fire($("confirm").querySelector('[data-answer="yes"]'), "click");
  for (let i = 0; i < 100 && !reloaded; i++) await new Promise((r) => setTimeout(r, 20)); // raderingen är asynkron
  check("Ja raderar allt appen sparat, även godkända villkor och enhetens inställningar", !Object.keys(win.localStorage).some((k) => k === "ffv" || k.startsWith("ffv-")));
  check("Annat i webbläsaren rörs inte", win.localStorage.getItem("other-app") === "behålls");
  check("Sidan börjar om", reloaded);
}

if (scenario === "äldre") {
  acceptTerms();
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
