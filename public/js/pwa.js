// PWA: service worker för offline och möjligheten att installera appen lokalt.
//
// Chrome, Edge och andra Chromium-webbläsare kan fråga själva (beforeinstallprompt). Övriga webbläsare kan inte
// installera från en knapp på sidan; där visas i stället hur man gör i just den webbläsaren, t.ex. "Add tab to
// taskbar" i Firefox på Windows. Bannern visas tills användaren har svarat Ja eller Nej; knappen under
// Inställningar → Installera appen finns alltid kvar.

import { $, load, save, confirmDialog } from "./util.js";

// Service workern registreras bara när sidan körs som egen webbplats (inte inbäddad i en annan sida och inte från disk).
if ("serviceWorker" in navigator && window.self === window.top && location.protocol !== "file:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

const BANNER_ANSWERED_KEY = "ffv-install-declined"; // bannern visas inte igen (Ja eller Nej); namnet finns kvar från äldre versioner
const ua = navigator.userAgent;
const isIos = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isFirefox = /firefox|fxios/i.test(ua);
const isAndroid = /android/i.test(ua);
const isWindows = /windows/i.test(ua);
const isMacSafari = /macintosh/i.test(ua) && /safari/i.test(ua) && !/chrome|chromium|edg|firefox/i.test(ua) && !isIos;
const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
let installPrompt = null; // webbläsarens egen installationsfråga, när den finns

/** Hur man installerar i den här webbläsaren när den inte kan fråga själv. null om webbläsaren inte kan installera webbappar. */
function instructions() {
  if (isIos) return "Tryck på dela-knappen (fyrkanten med en pil) och välj Lägg till på hemskärmen. Appen på hemskärmen har egen lagring: fyll i profilen där, eller flytta dina uppgifter med Kopiera allt under Inställningar → Säkerhetskopia och flytt och klistra in texten i appens första steg.";
  if (isFirefox && isAndroid) return "Öppna menyn ⋮ i Firefox och välj Installera eller Lägg till på startskärmen.";
  if (isFirefox && isWindows) return "Klicka på knappen Add tab to taskbar (Lägg till flik i aktivitetsfältet) i adressfältet, eller högerklicka på fliken och välj den där. Då öppnas appen som en egen app från aktivitetsfältet.";
  if (isFirefox) return null; // Firefox på Mac och Linux kan inte installera webbappar
  if (isMacSafari) return "Välj Arkiv → Lägg till i Dock i Safari.";
  return "Klicka på installationsikonen i adressfältet, eller öppna webbläsarens meny och välj Installera appen.";
}

const bannerWanted = () => window.self === window.top && !isStandalone() && !load(BANNER_ANSWERED_KEY, false) && (installPrompt || instructions());

function render() {
  const standalone = isStandalone();
  $("install").hidden = !installPrompt || standalone;
  $("install-banner").hidden = !bannerWanted();
  $("install-settings").hidden = standalone;
  $("install-status").textContent = standalone
    ? "Du använder redan appen som installerad app."
    : "Installera appen lokalt, så öppnas den som en egen app från skrivbordet, aktivitetsfältet eller hemskärmen och fungerar offline.";
}

/** Installera: webbläsarens egen fråga om den finns, annars en förklaring för den här webbläsaren. */
async function installApp() {
  if (installPrompt) {
    const prompt = installPrompt;
    installPrompt = null;
    render();
    prompt.prompt();
    await prompt.userChoice.catch(() => null);
    return;
  }
  const how = instructions();
  await confirmDialog(
    "Installera appen lokalt",
    how || "Den här webbläsaren kan inte installera webbappar. Öppna sidan i Chrome eller Edge för att installera den, eller lägg till ett bokmärke.",
    { yes: "OK", no: null },
  );
}

/** Svar i bannern: den visas inte igen. Ja startar installationen. */
function answerBanner(install) {
  save(BANNER_ANSWERED_KEY, true);
  render();
  if (install) installApp();
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e;
  render();
});
window.addEventListener("appinstalled", () => {
  installPrompt = null;
  save(BANNER_ANSWERED_KEY, true);
  render();
});
$("install").addEventListener("click", installApp);
$("install-settings").addEventListener("click", installApp);
$("install-accept").addEventListener("click", () => answerBanner(true));
$("install-decline").addEventListener("click", () => answerBanner(false));
render();
