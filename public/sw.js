const CACHE_NAME = "clic-soluciones-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// Ya no guardamos nada en caché: solo dejamos pasar las peticiones a la red.
// Esto evita que la app quede pegada mostrando versiones viejas.
self.addEventListener("fetch", () => {
  // sin cache.match ni cache.put: siempre va a la red
});
