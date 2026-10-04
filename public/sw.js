// Service worker för Fettförbränningsveckan: gör appen installerbar och användbar offline.
// VERSION följer appens version (js/version.js): en ny version ger en ny cache, och den gamla rensas.
// Höj den med `npm run bump -- patch|minor|major`, aldrig för hand.
// Lägger du till en fil i js/ eller css/ ska den också in i CORE, annars fungerar den inte offline.
const VERSION = "ffv-0.2.0";
const CORE = [
  "./",
  "./index.html",
  "./guide.html",
  "./manifest.webmanifest",
  "./css/app.css",
  "./js/app.js",
  "./js/backup.js",
  "./js/controllers/backup-form.js",
  "./js/controllers/inputs.js",
  "./js/controllers/log-form.js",
  "./js/controllers/navigation.js",
  "./js/controllers/settings-forms.js",
  "./js/data/exercises.js",
  "./js/data/foods.js",
  "./js/data/recipes.js",
  "./js/day.js",
  "./js/fasting.js",
  "./js/log.js",
  "./js/main.js",
  "./js/menu.js",
  "./js/myrecipes.js",
  "./js/nutrition.js",
  "./js/plancode.js",
  "./js/preferences.js",
  "./js/pwa.js",
  "./js/supplements.js",
  "./js/training.js",
  "./js/storage.js",
  "./js/util.js",
  "./js/version.js",
  "./js/wizard.js",
  "./js/views/components.js",
  "./js/views/fasting-view.js",
  "./js/views/food.js",
  "./js/views/log-view.js",
  "./js/views/profile.js",
  "./js/views/report.js",
  "./js/views/settings.js",
  "./js/views/timeline.js",
  "./js/views/today.js",
  "./js/views/training-view.js",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-64.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png"
];

// Varje fil cachas för sig, så att en fil som saknas inte stoppar hela uppdateringen
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION)
      // "reload": hämta från servern, inte från webbläsarens cache, så att den nya versionen inte får gamla filer
      .then((c) => Promise.allSettled(CORE.map((url) => c.add(new Request(url, { cache: "reload" })))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/** Spara ett lyckat svar i cachen (för offline). */
const remember = (req, res) => {
  if (res.ok || res.type === "opaque") {
    const copy = res.clone();
    caches.open(VERSION).then((c) => c.put(req, copy));
  }
  return res;
};

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Sidor och egna filer: nätet först, så att alla filer kommer från samma version efter en uppdatering.
  // "no-cache" gör att webbläsarens egen cache alltid frågar servern om filen har ändrats (304 om inte), så att en
  // gammal kopia av en modul aldrig blandas med nya filer. Cachen här används bara när nätet inte svarar (offline).
  // Fel från servern, t.ex. 404, skickas vidare som de är.
  if (url.origin === location.origin) {
    event.respondWith(
      fetch(req.mode === "navigate" ? req : new Request(req, { cache: "no-cache" }))
        .then((res) => remember(req, res))
        .catch(() => caches.match(req).then((hit) => hit || (req.mode === "navigate" ? caches.match("./index.html") : null)).then((hit) => hit || Response.error()))
    );
    return;
  }

  // Typsnitt från Google ändras inte: cachen först
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => remember(req, res)))
    );
  }
});
