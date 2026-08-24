// Service Worker de Bolson Click
// Objetivo: que la app abra y se pueda usar sin internet, pero SIN quedar
// pegada mostrando versiones viejas cuando sí hay conexión.
//
// Estrategia por tipo de contenido:
//   - Páginas (HTML): primero la red, y si no hay internet, lo guardado.
//   - Archivos de la app (JS/CSS con hash): lo guardado primero, y se
//     actualiza en segundo plano. Son inmutables, no hay riesgo de versión vieja.
//   - Datos de productos: primero la red; sin internet, la última copia guardada.

const VERSION = "v6";
const CACHE_APP = `bolsonclick-app-${VERSION}`;
const CACHE_DATOS = `bolsonclick-datos-${VERSION}`;
const CACHE_IMAGENES = `bolsonclick-img-${VERSION}`;

// Lo mínimo para que la app arranque sin conexión
const RUTAS_BASE = [
  "/",
  "/catalogo",
  "/carrito",
  "/a-pedido",
  "/login",
  "/offline",
  "/manifest.json",
  // Pantallas del negocio: hacen falta para armar pedidos en zonas sin señal
  "/admin",
  "/admin/pedidos",
  "/admin/productos",
  "/admin/clientes",
  // Pantallas del cliente: en la Comarca la señal se corta seguido y tiene
  // que poder mirar, armar el carrito y confirmar igual.
  "/checkout",
  "/confirmacion",
  "/favoritos"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_APP).then((cache) =>
      // Si alguna ruta falla no queremos que se caiga toda la instalación
      Promise.allSettled(RUTAS_BASE.map((ruta) => cache.add(ruta)))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.endsWith(VERSION))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

function esImagen(url) {
  return /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(url.pathname);
}

function esArchivoDeApp(url) {
  return url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icons/");
}

function esDatosProductos(url) {
  return (
    url.hostname.endsWith("supabase.co") &&
    url.pathname.includes("/rest/v1/") &&
    /Productos|Categorias/i.test(url.search + url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Solo manejamos GET: nunca interceptamos pedidos, logins ni subidas.
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return;
  }

  // No tocamos las llamadas de escritura ni de autenticación de Supabase
  if (url.hostname.endsWith("supabase.co") && !esDatosProductos(url)) return;

  // --- Archivos de la app: cache primero, se actualizan solos ---
  if (esArchivoDeApp(url)) {
    event.respondWith(
      caches.match(request).then((guardado) => {
        const desdeRed = fetch(request)
          .then((res) => {
            if (res && res.status === 200) {
              const copia = res.clone();
              caches.open(CACHE_APP).then((c) => c.put(request, copia));
            }
            return res;
          })
          .catch(() => guardado);
        return guardado || desdeRed;
      })
    );
    return;
  }

  // --- Imágenes: cache primero (ahorra datos del cliente) ---
  if (esImagen(url)) {
    event.respondWith(
      caches.match(request).then((guardado) => {
        if (guardado) return guardado;
        return fetch(request)
          .then((res) => {
            if (res && res.status === 200) {
              const copia = res.clone();
              caches.open(CACHE_IMAGENES).then((c) => c.put(request, copia));
            }
            return res;
          })
          .catch(() => guardado);
      })
    );
    return;
  }

  // --- Datos de productos: red primero, cache como respaldo ---
  if (esDatosProductos(url)) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res && res.status === 200) {
            const copia = res.clone();
            caches.open(CACHE_DATOS).then((c) => c.put(request, copia));
          }
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // --- Páginas: red primero (para ver siempre lo último), cache si no hay internet ---
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res && res.status === 200) {
            const copia = res.clone();
            caches.open(CACHE_APP).then((c) => c.put(request, copia));
          }
          return res;
        })
        .catch(async () => {
          const guardado = await caches.match(request);
          if (guardado) return guardado;
          const inicio = await caches.match("/");
          if (inicio) return inicio;
          return caches.match("/offline");
        })
    );
    return;
  }
});

// Permite forzar la actualización desde la app
self.addEventListener("message", (event) => {
  if (event.data === "actualizar") self.skipWaiting();
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


// ---------- ACTUALIZACIÓN EN SEGUNDO PLANO ----------
// Permite que la app se actualice sola aunque esté cerrada, para que el
// cliente encuentre precios y stock al día cuando la abre (o cuando se
// queda sin señal). Solo funciona en Android con la app instalada:
// iPhone no permite que las apps web trabajen en segundo plano.

const SUPABASE_URL = "https://kmkprbnwcbavonfnyput.supabase.co";
const CACHE_DATOS_BG = `bolsonclick-datos-${VERSION}`;

// Trae los productos propios y guarda sus fotos, sin que nadie abra la app.
async function actualizarEnSegundoPlano() {
  try {
    // La clave pública viaja en la propia página; la leemos del último
    // pedido guardado para no tener que repetirla acá.
    const cache = await caches.open(CACHE_DATOS_BG);
    const guardadas = await cache.keys();
    const previa = guardadas.find((r) => r.url.includes("/rest/v1/Productos"));
    if (!previa) return; // todavía no se usó la app con señal: nada que refrescar

    const res = await fetch(previa, { cache: "no-store" });
    if (!res || !res.ok) return;

    const copia = res.clone();
    await cache.put(previa, copia);

    // Guardamos las fotos de los productos que vinieron
    const productos = await res.json();
    const cacheImg = await caches.open(`bolsonclick-img-${VERSION}`);

    const urls = (Array.isArray(productos) ? productos : [])
      .map((p) => p.imagen_url)
      .filter(Boolean)
      .slice(0, 60);

    for (const url of urls) {
      try {
        const yaEsta = await cacheImg.match(url);
        if (yaEsta) continue;
        const img = await fetch(url, { mode: "no-cors" });
        await cacheImg.put(url, img);
      } catch (e) {
        // Una foto que falla no debe cortar la actualización
      }
    }
  } catch (e) {
    // En segundo plano fallamos en silencio: se reintenta la próxima vez
  }
}

// El navegador decide cuándo conviene (suele ser con wifi y cargando)
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "actualizar-catalogo") {
    event.waitUntil(actualizarEnSegundoPlano());
  }
});

// Se dispara cuando vuelve la señal, aunque la app esté cerrada
self.addEventListener("sync", (event) => {
  if (event.tag === "sincronizar-al-volver") {
    event.waitUntil(actualizarEnSegundoPlano());
  }
});
