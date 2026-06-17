/* Service worker — offline app shell + runtime map-tile caching.
   Bump CACHE when you change app files to force an update. */
const CACHE = "vietnam-v12";
const TILES = "vietnam-tiles-v1";

const SHELL = [
  "./",
  "./index.html",
  "./data.js",
  "./app.js",
  "./icons.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./favicon-32.png",
  "./og-image.png",
  "./img/hero.jpg",
  "./img/hanoi.jpg",
  "./img/halong.jpg",
  "./img/hoian.jpg",
  "./img/danang.jpg",
  "./img/hcmc.jpg",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
];

self.addEventListener("message", e => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && k !== TILES).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Map tiles: cache-first, fill cache as you browse (offline for revisited areas)
  if (url.hostname.endsWith("basemaps.cartocdn.com")) {
    e.respondWith(
      caches.open(TILES).then(async cache => {
        const hit = await cache.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
          return res;
        } catch (_) {
          return hit || Response.error();
        }
      })
    );
    return;
  }

  const cacheable = url.origin === location.origin || url.hostname.includes("unpkg.com") || url.hostname.includes("gstatic.com") || url.hostname.includes("googleapis.com");

  // Same-origin app code (HTML/JS) + navigations: network-first so content edits
  // show up immediately when online; fall back to cache when offline.
  const isAppCode = url.origin === location.origin &&
    (req.mode === "navigate" || /\.(html|js)$/.test(url.pathname) || url.pathname === "/" || url.pathname.endsWith("/"));
  if (isAppCode) {
    // cache:"reload" bypasses the browser HTTP cache so genuine edits always win.
    const fresh = fetch(new Request(req.url, { cache: "reload", credentials: "same-origin" }));
    e.respondWith(
      fresh.then(res => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match("./index.html")))
    );
    return;
  }

  // Everything else (images, fonts, CSS): cache-first, fall back to network and cache it
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.ok && cacheable) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match("./index.html")))
  );
});
