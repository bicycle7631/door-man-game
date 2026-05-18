const CACHE_NAME = "door-man-v4";
const GAME_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./game.js",
  "./manifest.webmanifest",
  "./assets/sprites/door-man.png",
  "./assets/sprites/door-kick.png",
  "./assets/sprites/bad-normal.png",
  "./assets/sprites/bad-punch.png",
  "./assets/sprites/bad-walk.png",
  "./assets/sprites/bad-repeat.png",
  "./assets/sprites/bad-shooter.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(GAME_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
