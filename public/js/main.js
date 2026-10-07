// Startpunkt: läs in det sparade (IndexedDB, eller localStorage som reserv) och vänta på stilen innan appens
// moduler laddas, eftersom de läser sina inställningar när de laddas och mäter layouten (t.ex. tidslinjerna).

// Alla moduler laddas dynamiskt efter freshFiles(), så att ingen av dem hinner hämtas ur en gammal cache först.

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

/**
 * Se till att alla app-filer kommer från samma version som sidan. När sidan inte styrs av service workern (första
 * besöket, eller direkt efter Radera all data) kan webbläsaren annars återanvända gamla JavaScript-filer ur sin
 * cache tillsammans med en ny index.html, och då stämmer de inte ihop (t.ex. fastnade guiden på första steget).
 * Filerna kontrolleras mot servern (304 om de inte har ändrats) en gång per session och version, innan appens
 * moduler laddas. Med service worker behövs det inte: den frågar alltid servern (se sw.js).
 */
async function freshFiles() {
  const version = document.querySelector('meta[name="app-version"]')?.content || "";
  const KEY = "ffv-fresh";
  try {
    if (navigator.serviceWorker?.controller || sessionStorage.getItem(KEY) === version) return;
    const list = await (await fetch("sw.js", { cache: "no-store" })).text();
    const files = [...list.matchAll(/"\.\/((?:js|css)\/[^"]+)"/g)].map((m) => m[1]);
    await Promise.allSettled(files.map((file) => fetch(file, { cache: "no-cache" })));
    sessionStorage.setItem(KEY, version);
  } catch {
    /* utan nät eller sessionStorage: starta ändå */
  }
}

// Laddningsskärmen (index.html) visas tills appen har startat.
try {
  await freshFiles();
  const { initStorage } = await import("./storage.js");
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
