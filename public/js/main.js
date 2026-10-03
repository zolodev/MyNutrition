// Startpunkt: läs in det sparade (IndexedDB, eller localStorage som reserv) innan appens moduler laddas,
// eftersom de läser sina inställningar när de laddas.

import { initStorage } from "./storage.js";

/**
 * Vänta tills stilmallarna och typsnitten är laddade (högst två sekunder), så att appen inte mäter layouten
 * innan sidan har sin stil. Tidslinjerna mäter till exempel etiketternas bredd med det riktiga typsnittet.
 */
function stylesReady() {
  const sheets = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .filter((link) => !link.sheet)
    .map((link) => new Promise((resolve) => {
      link.addEventListener("load", resolve, { once: true });
      link.addEventListener("error", resolve, { once: true });
    }));
  const ready = Promise.all(sheets).then(() => document.fonts?.ready);
  return Promise.race([ready, new Promise((resolve) => setTimeout(resolve, 2000))]);
}

// Laddningsskärmen (index.html) visas tills appen har startat. Går något inte att ladda visas ett fel i stället.
try {
  await Promise.all([initStorage(), stylesReady()]);
  await import("./app.js");
  document.documentElement.classList.remove("booting", "boot-failed");
} catch (error) {
  document.documentElement.classList.add("boot-failed");
  throw error;
}
