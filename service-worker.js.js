/* =========================================================
   Agrícola Huarmey · Cosecha — Service Worker
   Estrategia: app shell cache-first (offline-first) +
   red primero para datos dinámicos (con caída a caché).
   ========================================================= */
const CACHE_VERSION = "huarmey-cosecha-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Manrope:wght@400;500;600;700;800&display=swap",
  "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.4/chart.umd.min.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return Promise.all(
        APP_SHELL.map((url) =>
          cache.add(url).catch((err) => console.warn("No se pudo cachear:", url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Datos de Google Apps Script / Sheets: red primero, caché como respaldo offline.
  if (url.hostname.includes("script.google.com") || url.hostname.includes("script.googleusercontent.com")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Resto (app shell, fuentes, librerías): caché primero, red como respaldo.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (req.method === "GET" && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => {
          if (req.mode === "navigate") return caches.match("./index.html");
        });
    })
  );
});
