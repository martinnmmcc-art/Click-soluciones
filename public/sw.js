// Service Worker de Bolson Click
// Objetivo: que la app abra y se pueda usar sin internet, pero SIN quedar
// pegada mostrando versiones viejas cuando sí hay conexión.
//
// Estrategia por tipo de contenido:
//   - Páginas (HTML): primero la red, y si no hay internet, lo guardado.
//   - Archivos de la app (JS/CSS con hash): lo guardado primero, y se
//     actualiza en segundo plano. Son inmutables, no hay riesgo de versión vieja.
//   - Datos de productos: primero la red; sin internet, la última copia guardada.

// v10: al activarse borra TODO lo de versiones anteriores, incluido un
// almacenamiento de fotos ("img-v5") que nunca se limpiaba y llegó a ocupar
// más de 3 GB en el celular.
const VERSION = "v10";
const CACHE_APP = `bolsonclick-app-${VERSION}`;
const CACHE_DATOS = `bolsonclick-datos-${VERSION}`;
const CACHE_IMAGENES = `bolsonclick-img-${VERSION}`;
// Las páginas van aparte del código del programa: antes compartían lugar y,
// al navegar muchos productos, se podía descartar código de una pantalla
// (la pantalla se veía pero no respondía a nada).
const CACHE_PAGINAS = `bolsonclick-paginas-${VERSION}`;
const CACHE_META = `bolsonclick-meta-${VERSION}`;

// Límites: se guarda lo más reciente y lo viejo se descarta solo. Antes se
// guardaba cada foto vista para siempre: recorriendo el catálogo a pedido
// (más de 5.000 productos) el espacio crecía sin parar.
const LIMITES = {
  [CACHE_IMAGENES]: 500,
  [CACHE_PAGINAS]: 500,
  // Muchas pantallas leen varias tablas: más lugar, son textos livianos
  [CACHE_DATOS]: 800
};
const recortando = {};

// Borra lo más viejo (el orden de guardado es el de llegada; lo que se
// vuelve a usar se guarda de nuevo y pasa al final, así lo que más usás
// nunca se descarta).
async function recortar(nombre) {
  const max = LIMITES[nombre];
  if (!max || recortando[nombre]) return;
  recortando[nombre] = true;
  try {
    const cache = await caches.open(nombre);
    const claves = await cache.keys();
    for (let i = 0; i < claves.length - max; i++) await cache.delete(claves[i]);
  } catch (e) {
  } finally {
    recortando[nombre] = false;
  }
}

// El código del programa se recorta por "lo menos usado", nunca por
// antigüedad: un archivo guardado hace meses que se sigue usando en cada
// pantalla no se descarta. Se anota cuándo se usó cada uno.
const LIMITE_PROGRAMA = 1500;
const usoPrograma = new Map();
let volcadoPendiente = null;

function anotarUso(url) {
  usoPrograma.set(url, Date.now());
  if (!volcadoPendiente) volcadoPendiente = setTimeout(() => volcarUso().catch(() => {}), 15000);
}

async function leerUso() {
  try {
    const c = await caches.open(CACHE_META);
    const r = await c.match("/__uso-programa");
    return r ? await r.json() : {};
  } catch (e) {
    return {};
  }
}

async function volcarUso(extra) {
  volcadoPendiente = null;
  const uso = extra || (await leerUso());
  for (const [u, f] of usoPrograma) uso[u] = f;
  usoPrograma.clear();
  const c = await caches.open(CACHE_META);
  await c.put("/__uso-programa", new Response(JSON.stringify(uso)));
  return uso;
}

let recortandoPrograma = false;
async function recortarPrograma() {
  if (recortandoPrograma) return;
  recortandoPrograma = true;
  try {
    const c = await caches.open(CACHE_APP);
    const claves = await c.keys();
    if (claves.length <= LIMITE_PROGRAMA) return;
    const uso = await volcarUso();
    const orden = claves.sort((a, b) => (uso[a.url] || 0) - (uso[b.url] || 0));
    for (const k of orden.slice(0, claves.length - 1200)) {
      await c.delete(k);
      delete uso[k.url];
    }
    await volcarUso(uso);
  } catch (e) {
  } finally {
    recortandoPrograma = false;
  }
}

// Lo mínimo para que la app arranque sin conexión
const RUTAS_BASE = [
  "/",
  "/catalogo",
  "/carrito",
  "/a-pedido",
  "/login",
  "/offline",
  "/manifest.json",
  // Pantallas del negocio: hacen falta para trabajar en zonas sin señal.
  // La caja es la más importante: si el cliente está con la plata en la
  // mano, hay que poder cobrar aunque no haya datos.
  "/admin",
  "/admin/caja",
  "/admin/pedidos",
  "/admin/productos",
  "/admin/clientes",
  "/admin/ventas-cerradas",
  "/admin/resumen-clientes",
  "/admin/balance",
  "/admin/ofertas",
  "/admin/cupones",
  "/admin/resenas",
  "/admin/oportunidades",
  "/admin/fotos",
  "/admin/categorias",
  "/admin/promocionar",
  "/admin/compras-proveedor",
  "/admin/gastos-generales",
  // Pantallas del cliente: en la Comarca la señal se corta seguido y tiene
  // que poder mirar, armar el carrito y confirmar igual.
  "/checkout",
  "/confirmacion",
  "/favoritos"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_PAGINAS).then((cache) =>
      // Guardamos cada pantalla de dos formas: la página completa y la
      // versión que pide Next al navegar dentro de la app. Sin la segunda,
      // moverse entre pantallas sin señal no funciona.
      Promise.allSettled([
        ...RUTAS_BASE.map((ruta) => cache.add(ruta)),
        ...RUTAS_BASE.map((ruta) =>
          fetch(ruta, { headers: { RSC: "1" } })
            .then((res) => (res.ok ? cache.put(ruta + "?_rsc=1", res) : null))
            .catch(() => null)
        )
      ])
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

// Next.js no recarga la página al navegar: pide los datos con un formato
// interno (RSC). Esas peticiones hay que guardarlas igual, si no, moverse
// dentro de la app sin señal no funciona aunque las páginas estén guardadas.
function esNavegacionInterna(request, url) {
  return (
    url.origin === self.location.origin &&
    (url.search.includes("_rsc=") ||
      request.headers.get("RSC") === "1" ||
      request.headers.get("Next-Router-Prefetch") === "1")
  );
}

function esDatosProductos(url) {
  return (
    url.hostname.endsWith("supabase.co") &&
    url.pathname.includes("/rest/v1/") &&
    /Productos|Categorias/i.test(url.search + url.pathname)
  );
}

// TODO lo que la app lee (no solo productos): clientes, pedidos, cupones,
// gastos, compras, opiniones... y las rutas /api de solo lectura. Antes se
// guardaban solo productos y categorías, y sin señal muchas pantallas del
// panel se abrían vacías aunque se hubieran preparado.
// Solo lecturas (GET): nunca se guardan logins, pagos ni escrituras.
// Sin señal y sin copia guardada: respondemos "504 Sin señal" en vez de una
// falla de red. La librería de Supabase reintenta 3 veces (esperando 1, 2 y
// 4 segundos) ante una falla de red, y la pantalla quedaba trabada en
// "Cargando..."; un 504 no lo reintenta, así que la pantalla se entera al
// instante y puede usar su copia del celular o avisar.
function respuestaSinSenal() {
  return new Response(
    JSON.stringify({
      message: "Sin señal: estos datos todavía no estaban guardados en el celular",
      code: "SIN_SENAL"
    }),
    { status: 504, statusText: "Sin senal", headers: { "Content-Type": "application/json" } }
  );
}

// El almacenamiento del navegador no acepta guardar una respuesta 206
// (parcial): la guardamos como 200 con las mismas cabeceras. Se conserva
// "Content-Range", que es de donde la app saca el total ("149 productos").
async function copiaGuardable(res) {
  if (res.status === 200) return res.clone();
  const cuerpo = await res.clone().blob();
  return new Response(cuerpo, { status: 200, statusText: "OK", headers: res.headers });
}

function esLecturaDatos(url) {
  if (url.hostname.endsWith("supabase.co")) return url.pathname.includes("/rest/v1/");
  return (
    url.origin === self.location.origin &&
    url.pathname.startsWith("/api/") &&
    !url.pathname.startsWith("/api/img")
  );
}

// ¿El celular dice que no tiene ninguna conexión? Entonces ni se intenta la
// red: se usa lo guardado al instante.
function sinConexion() {
  return self.navigator && self.navigator.onLine === false;
}

// RED CON LÍMITE DE TIEMPO.
// Antes era "red primero" sin límite: con poca señal el pedido salía pero la
// respuesta no llegaba, y se esperaba uno o dos minutos antes de usar lo
// guardado ("Cargando catálogo..." eterno). Ahora:
//  - sin conexión y con copia → la copia, al instante;
//  - con conexión → la red; si no contesta en `espera` ms y hay copia, se
//    usa la copia (y si la red contesta después, se guarda para la próxima);
//  - sin copia → se espera a la red (hasta `esperaSinCopia`, si se indica).
function redConLimite(event, request, op) {
  const { cache, espera, buscarCopia, siFalla, esperaSinCopia, guardable, aviso } = op;

  return (async () => {
    const copia = await buscarCopia();
    if (copia && sinConexion()) {
      if (aviso) avisarDatosDesdeCopia();
      return copia;
    }
    if (!copia && sinConexion()) return siFalla();

    const red = fetch(request);
    // Guardar lo que llegue de la red, aunque llegue tarde
    event.waitUntil(
      red
        .then(async (res) => {
          if (res && guardable(res)) {
            const paraGuardar = await copiaGuardable(res);
            const c = await caches.open(cache);
            await c.put(request, paraGuardar);
            recortar(cache);
          }
        })
        .catch(() => {})
    );

    return new Promise((resolve) => {
      let listo = false;
      const terminar = (r) => {
        if (!listo) {
          listo = true;
          resolve(r);
        }
      };
      red.then(terminar).catch(async () => {
        if (copia && aviso) avisarDatosDesdeCopia();
        terminar(copia || (await siFalla()));
      });
      if (copia) {
        setTimeout(() => {
          if (!listo && aviso) avisarDatosDesdeCopia();
          terminar(copia);
        }, espera);
      } else if (esperaSinCopia) {
        setTimeout(async () => terminar(await siFalla()), esperaSinCopia);
      }
    });
  })();
}

const respuestaOk = (res) => res && res.status === 200;

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Consultas que solo cuentan ("112 con stock bajo"): no se pueden guardar.
  // Sin conexión, respuesta al instante en vez de dejar que se reintenten.
  if (request.method === "HEAD") {
    try {
      if (esLecturaDatos(new URL(request.url))) {
        event.respondWith(
          sinConexion()
            ? Promise.resolve(respuestaSinSenal())
            : Promise.race([
                fetch(request).catch(() => respuestaSinSenal()),
                new Promise((r) => setTimeout(() => r(respuestaSinSenal()), 6000))
              ])
        );
      }
    } catch (e) {}
    return;
  }

  // Solo manejamos GET: nunca interceptamos pedidos, logins ni subidas.
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return;
  }

  // No tocamos la autenticación ni los archivos de Supabase: solo sus lecturas
  if (url.hostname.endsWith("supabase.co") && !esLecturaDatos(url)) return;

  // --- Código del programa: guardado primero (no cambia nunca: cada versión
  //     tiene nombres nuevos). Se anota el uso para no descartarlo. ---
  if (esArchivoDeApp(url)) {
    event.respondWith(
      caches.match(request).then((guardado) => {
        if (guardado) {
          anotarUso(request.url);
          return guardado;
        }
        return fetch(request).then((res) => {
          if (respuestaOk(res)) {
            const copia = res.clone();
            event.waitUntil(
              caches
                .open(CACHE_APP)
                .then((c) => c.put(request, copia))
                .then(() => {
                  anotarUso(request.url);
                  return recortarPrograma();
                })
            );
          }
          return res;
        });
      })
    );
    return;
  }

  // --- Imágenes: guardado primero (ahorra datos) ---
  if (esImagen(url)) {
    event.respondWith(
      caches.match(request).then((guardado) => {
        if (guardado) return guardado;
        return fetch(request)
          .then((res) => {
            if (respuestaOk(res)) {
              const copia = res.clone();
              event.waitUntil(
                caches.open(CACHE_IMAGENES).then((c) => c.put(request, copia)).then(() => recortar(CACHE_IMAGENES))
              );
            }
            return res;
          })
          .catch(() => Response.error());
      })
    );
    return;
  }

  // --- Navegación interna de Next (moverse dentro de la app) ---
  if (esNavegacionInterna(request, url)) {
    event.respondWith(
      redConLimite(event, request, {
        cache: CACHE_PAGINAS,
        espera: 3500,
        guardable: respuestaOk,
        // La misma pantalla guardada con otro código interno (_rsc)
        buscarCopia: async () => {
          const exacta = await caches.match(request);
          if (exacta) return exacta;
          try {
            const c = await caches.open(CACHE_PAGINAS);
            const claves = await c.keys();
            const misma = claves.find((k) => {
              const u = new URL(k.url);
              return u.pathname === url.pathname && u.search.includes("_rsc");
            });
            return misma ? c.match(misma) : null;
          } catch (e) {
            return null;
          }
        },
        // Sin la versión interna, la página completa: Next la abre igual
        siFalla: async () => (await caches.match(url.pathname)) || Response.error()
      })
    );
    return;
  }

  // --- Datos (productos, clientes, pedidos...): siempre lo último, pero sin
  //     quedarse esperando a una red que no contesta ---
  if (esLecturaDatos(url)) {
    event.respondWith(
      redConLimite(event, request, {
        cache: CACHE_DATOS,
        espera: 4000,
        esperaSinCopia: 12000,
        aviso: true,
        // 200 y 206: las listas que se piden de a tandas vuelven con 206
        guardable: (res) => res && (res.status === 200 || res.status === 206),
        buscarCopia: () => caches.match(request),
        siFalla: async () => respuestaSinSenal()
      })
    );
    return;
  }

  // --- Páginas ---
  if (request.mode === "navigate") {
    event.respondWith(
      redConLimite(event, request, {
        cache: CACHE_PAGINAS,
        espera: 3500,
        guardable: respuestaOk,
        // La página exacta, o la misma sin lo que va después del "?" (por
        // ejemplo "?de=fb"). Nunca "ignorando" el "?" a ciegas: podría
        // devolver la versión interna (_rsc) en vez de la página.
        buscarCopia: async () =>
          (await caches.match(request)) || (url.search ? await caches.match(url.origin + url.pathname) : null),
        // Sin copia de esa pantalla: el inicio, o la pantalla "sin conexión"
        siFalla: async () =>
          (await caches.match("/")) || (await caches.match("/offline")) || Response.error()
      })
    );
    return;
  }

  // --- Cualquier otra cosa del sitio (manifest, íconos, etc.) ---
  if (url.origin === self.location.origin) {
    event.respondWith(
      redConLimite(event, request, {
        cache: CACHE_PAGINAS,
        espera: 5000,
        guardable: respuestaOk,
        buscarCopia: () => caches.match(request),
        siFalla: async () => Response.error()
      })
    );
  }
});

async function avisarDatosDesdeCopia() {
  try {
    const ventanas = await self.clients.matchAll({ type: "window" });
    ventanas.forEach((v) => v.postMessage({ tipo: "datos-desde-copia" }));
  } catch (e) {}
}

// Permite forzar la actualización desde la app
self.addEventListener("message", (event) => {
  // Al cerrar sesión: se borran los datos guardados del panel en este celular
  if (event.data?.tipo === "limpiar-datos") {
    event.waitUntil(caches.delete(CACHE_DATOS));
    return;
  }
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
