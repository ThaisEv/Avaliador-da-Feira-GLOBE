const CACHE_NAME = "feira-globe-app-v4";
const APP_SHELL = [
  "./",
  "./index.html",
  "./selecionar.html",
  "./manifest.json",
  "./css/style.css",
  "./js/data.js",
  "./js/sync.js",
  "./js/database.js",
  "./js/form.js",
  "./js/app.js",
  "./js/selecionar.js",
  "./js/pwa-update.js",
  "./assets/icons/icon.svg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/logo.svg",
  "./data/trabalhos.json",
  "./data/criterios.json",
  "./data/avaliadores.json",
  "./config.js"
];

const isSameOrigin = request => new URL(request.url).origin === self.location.origin;
const isNavigation = request => request.mode === "navigate" || request.destination === "document";

async function cacheResponse(request, response) {
  if (response.ok && isSameOrigin(request)) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  try {
    return await cacheResponse(request, await fetch(request));
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (isNavigation(request)) {
      const offlinePage = await caches.match("./index.html");
      if (offlinePage) return offlinePage;
    }
    throw error;
  }
}

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith("feira-globe-") && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || !isSameOrigin(event.request)) return;
  event.respondWith(networkFirst(event.request));
});
