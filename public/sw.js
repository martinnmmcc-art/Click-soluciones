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

// ---------- NOTIFICACIONES PUSH ----------
self.addEventListener("push", (event) => {
  let datos = {};
  try {
    datos = event.data ? event.data.json() : {};
  } catch (e) {
    datos = { title: "Bolson Click", body: event.data ? event.data.text() : "" };
  }

  const titulo = datos.title || "Bolson Click";
  const opciones = {
    body: datos.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: datos.url || "/" }
  };

  event.waitUntil(self.registration.showNotification(titulo, opciones));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
