// PWA: service worker för offline, beständig lagring och förslaget att installera appen.

import { $, load, save } from "./util.js";

// Service workern registreras bara när sidan körs som egen webbplats (inte inbäddad i en annan sida och inte från disk).

if ("serviceWorker" in navigator && window.self === window.top && location.protocol !== "file:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
// Be om beständig lagring, så att webbläsaren inte rensar profilen och loggen när utrymmet blir trångt.
// Installerade appar (även på iPhone) får det oftast direkt; i en vanlig flik avgör webbläsaren.
navigator.storage?.persist?.().catch(() => {});
// Förslaget att installera visas en gång per besök tills användaren installerar eller väljer "Inte nu" (sparas i ffv-install-declined).
// Chrome och Edge ger ett beforeinstallprompt-event; Safari på iPhone/iPad saknar det, där visas istället hur man lägger till appen.
const INSTALL_DECLINED_KEY = "ffv-install-declined";
const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const canSuggestInstall = () => window.self === window.top && !isStandalone() && !load(INSTALL_DECLINED_KEY, false);
let installPrompt = null;

function hideInstall() {
  $("install").hidden = true;
  $("install-banner").hidden = true;
}

async function install() {
  if (!installPrompt) return;
  const prompt = installPrompt;
  installPrompt = null;
  hideInstall();
  prompt.prompt();
  const choice = await prompt.userChoice.catch(() => null);
  if (choice?.outcome === "dismissed") save(INSTALL_DECLINED_KEY, true);
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e;
  $("install").hidden = false;
  if (canSuggestInstall()) $("install-banner").hidden = false;
});
if (isIos && canSuggestInstall()) {
  $("install-text").textContent = "Tryck på dela-knappen och välj Lägg till på hemskärmen, så öppnas Fettförbränning som en egen app och fungerar offline. Appen på hemskärmen har egen lagring: fyll i profilen där, eller flytta dina uppgifter med Exportera JSON under Logg och Importera i appen.";
  $("install-accept").hidden = true;
  $("install-banner").hidden = false;
}
$("install").addEventListener("click", install);
$("install-accept").addEventListener("click", install);
$("install-decline").addEventListener("click", () => {
  save(INSTALL_DECLINED_KEY, true);
  $("install-banner").hidden = true;
});
window.addEventListener("appinstalled", () => {
  installPrompt = null;
  hideInstall();
});
