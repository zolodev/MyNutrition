// PWA: service worker för offline och möjligheten att installera appen lokalt.
//
// Chrome, Edge och andra Chromium-webbläsare kan fråga själva (beforeinstallprompt). Övriga webbläsare kan inte
// installera från en knapp på sidan; där visas i stället hur man gör i just den webbläsaren, t.ex. "Add tab to
// taskbar" i Firefox på Windows. Bannern visas tills användaren har svarat Ja eller Nej; knappen under
// Inställningar → Installera appen finns alltid kvar.

import { $, load, save, confirmDialog } from "./util.js";
import { APP_VERSION } from "./version.js";

// Service workern registreras bara när sidan körs som egen webbplats (inte inbäddad i en annan sida och inte från disk).
if ("serviceWorker" in navigator && window.self === window.top && location.protocol !== "file:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  // En app som ligger öppen i bakgrunden (t.ex. på iPhones hemskärm) laddas inte om av sig själv. När den visas
  // igen frågar vi servern vilken version som är publicerad; är den nyare erbjuds en omladdning. Omladdningen rör
  // bara app-filerna, aldrig sparad data.
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && checkForUpdate());
  window.addEventListener("load", () => setTimeout(checkForUpdate, 5000));
}

let offered = ""; // versionen som redan har erbjudits den här gången, så att frågan inte tjatar
let lastCheck = 0;
/** Fråga servern om en nyare version är publicerad och erbjud i så fall en omladdning. */
export async function checkForUpdate() {
  if (Date.now() - lastCheck < 60_000 || $("confirm").open) return; // högst en gång i minuten, och inte mitt i en annan fråga
  lastCheck = Date.now();
  try {
    const html = await (await fetch(`index.html?check=${Date.now()}`, { cache: "no-store" })).text();
    const latest = html.match(/<meta name="app-version" content="([^"]+)">/)?.[1];
    if (!latest || latest === APP_VERSION || latest === offered) return;
    offered = latest;
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update().catch(() => {});
    const yes = await confirmDialog(`En ny version av appen finns (${latest})`,
      `Du har version ${APP_VERSION}. Ladda om för att få den nya. Dina uppgifter ligger kvar.`, { yes: "Uppdatera nu", no: "Senare" });
    if (yes) location.reload();
  } catch {
    // offline eller servern svarar inte: försök igen nästa gång appen visas
  }
}

const BANNER_ANSWERED_KEY = "ffv-install-declined"; // bannern visas inte igen (Ja eller Nej); namnet finns kvar från äldre versioner
const ua = navigator.userAgent;
const isIos = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isFirefox = /firefox|fxios/i.test(ua);
const isAndroid = /android/i.test(ua);
const isWindows = /windows/i.test(ua);
const isMacSafari = /macintosh/i.test(ua) && /safari/i.test(ua) && !/chrome|chromium|edg|firefox/i.test(ua) && !isIos;
export const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
let installPrompt = null; // webbläsarens egen installationsfråga, när den finns
/** Kan webbläsaren själv fråga om installation (Chrome, Edge m.fl.)? */
export const canPromptInstall = () => !!installPrompt;

/** Hur man installerar i den här webbläsaren när den inte kan fråga själv. null om webbläsaren inte kan installera webbappar. */
export function instructions() {
  if (isIos) return "Tryck på dela-knappen (fyrkanten med en pil) och välj Lägg till på hemskärmen. Appen på hemskärmen har egen lagring: fyll i profilen där, eller flytta dina uppgifter med Kopiera allt under Inställningar → Säkerhetskopia och delning och klistra in texten i appens första steg.";
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
export async function installApp() {
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
