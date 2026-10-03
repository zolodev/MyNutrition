// Startpunkt: läs in det sparade (IndexedDB, eller localStorage som reserv) innan appens moduler laddas,
// eftersom de läser sina inställningar när de laddas.

import { initStorage } from "./storage.js";

try {
  await initStorage();
  await import("./app.js");
} finally {
  document.documentElement.classList.remove("booting"); // visa appen först när den har startat
}
