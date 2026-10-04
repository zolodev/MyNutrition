// Startpunkt: läs in det sparade (IndexedDB, eller localStorage som reserv) och vänta på stilen innan appens
// moduler laddas, eftersom de läser sina inställningar när de laddas och mäter layouten (t.ex. tidslinjerna).

import { initStorage } from "./storage.js";

const APP_CSS = 'link[rel="stylesheet"][href^="css/app.css"]';
// app.css sätter --accent på :root, så variabeln visar om stilen faktiskt har slagit igenom
const appCssApplied = () => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() !== "";

/** Vänta på en stilmall: true när den har laddats, false vid fel, null om inget hänt inom `ms`. */
const settled = (link, ms) => new Promise((resolve) => {
  link.addEventListener("load", () => resolve(true), { once: true });
  link.addEventListener("error", () => resolve(false), { once: true });
  setTimeout(() => resolve(null), ms);
});

/** Appens stilmall krävs: går den inte att ladda görs ett nytt försök, och sedan visas ett fel i stället för en oformaterad sida. */
async function appStyles() {
  const link = document.querySelector(APP_CSS);
  if (!link || appCssApplied()) return; // utan stilmall i sidan (t.ex. i testerna) finns inget att vänta på
  await settled(link, 8000);
  if (appCssApplied()) return;
  // Ett nytt försök: enstaka förfrågningar kan misslyckas på vägen
  const retry = Object.assign(document.createElement("link"), { rel: "stylesheet", href: `css/app.css?forsok=${Date.now()}` });
  link.after(retry);
  await settled(retry, 8000);
  if (!appCssApplied()) throw new Error("Stilmallen css/app.css gick inte att ladda");
}

/** Typsnitten är inte nödvändiga (reservtypsnitt fungerar), så vänta på dem högst två sekunder. */
const fontsReady = () => Promise.race([document.fonts?.ready, new Promise((resolve) => setTimeout(resolve, 2000))]);

// Laddningsskärmen (index.html) visas tills appen har startat.
try {
  await Promise.all([initStorage(), appStyles(), fontsReady()]);
  await import("./app.js");
  document.documentElement.classList.remove("booting", "boot-failed");
  try {
    sessionStorage.removeItem("ffv-boot-retries"); // starten lyckades: nollställ försöken
  } catch {
    /* ingen sessionStorage */
  }
} catch (error) {
  // Ladda om automatiskt några gånger (se index.html); visa felet först om det inte hjälper
  if (typeof window.ffvBootFailed === "function") window.ffvBootFailed();
  else document.documentElement.classList.add("boot-failed");
  throw error;
}
