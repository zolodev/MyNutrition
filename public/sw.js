// Service worker för Fettförbränningsveckan: gör appen installerbar och användbar offline.
// Höj VERSION när filerna ändras, så hämtas de nya och den gamla cachen rensas.
// Lägger du till en fil i js/ eller css/ ska den också in i CORE, annars fungerar den inte offline.
const VERSION = "ffv-v29";
const CORE = [
  "./",
  "./index.html",
  "./guide.html",
  "./manifest.webmanifest",
  "./css/app.css",
  "./js/app.js",
  "./js/backup.js",
  "./js/data/exercises.js",
  "./js/data/foods.js",
  "./js/data/recipes.js",
  "./js/day.js",
  "./js/fasting.js",
  "./js/log.js",
  "./js/menu.js",
  "./js/myrecipes.js",
  "./js/nutrition.js",
  "./js/plancode.js",
  "./js/preferences.js",
  "./js/pwa.js",
  "./js/supplements.js",
  "./js/training.js",
  "./js/util.js",
  "./js/wizard.js",
  "./js/views/components.js",
  "./js/views/fasting-view.js",
  "./js/views/food.js",
  "./js/views/log-view.js",
  "./js/views/profile.js",
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

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Sidor: nätet först (så du får senaste versionen), cachen om du är offline
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
    );
    return;
  }

  // Typsnitt från Google och egna filer: cachen först, uppdatera i bakgrunden
  if (url.origin === location.origin || url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(
      caches.match(req).then((hit) => {
        const net = fetch(req)
          .then((res) => { if (res && (res.ok || res.type === "opaque")) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; })
          .catch(() => hit);
        return hit || net;
      })
    );
  }
});
