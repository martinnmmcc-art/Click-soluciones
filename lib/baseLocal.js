// La base de datos DENTRO del celular (IndexedDB, viene en el navegador).
//
// A diferencia del almacenamiento rápido (localStorage, unos 5 MB y fácil
// de llenar), esta base usa la memoria del celular: entran miles de pedidos
// sin problema. Cada dato se guarda UNA sola vez y todas las pantallas leen
// de acá, con o sin señal.
//
// Tablas:
//   pedidos   → cada pedido con sus productos (clave: id)
//   clientes  → (clave: id)
//   productos → catálogo (clave: id). Versión 2.
//   meta      → fechas de sincronización y datos sueltos (clave: clave)

const NOMBRE = "bolsonclick";
const VERSION = 2;
const TABLAS = { pedidos: "id", clientes: "id", productos: "id", meta: "clave" };

let abierta = null;

export function hayBaseLocal() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function abrir() {
  if (abierta) return abierta;
  abierta = new Promise((resolve, reject) => {
    if (!hayBaseLocal()) return reject(new Error("Este navegador no tiene base local"));
    const pedido = indexedDB.open(NOMBRE, VERSION);
    pedido.onupgradeneeded = () => {
      const db = pedido.result;
      for (const [tabla, clave] of Object.entries(TABLAS)) {
        if (!db.objectStoreNames.contains(tabla)) db.createObjectStore(tabla, { keyPath: clave });
      }
    };
    pedido.onsuccess = () => {
      const db = pedido.result;
      // Si otra pestaña abre una versión nueva, se cierra esta para no trabarla
      db.onversionchange = () => {
        db.close();
        abierta = null;
      };
      resolve(db);
    };
    pedido.onerror = () => {
      abierta = null;
      reject(pedido.error);
    };
    pedido.onblocked = () => {
      abierta = null;
      reject(new Error("La base local está ocupada por otra pestaña"));
    };
  });
  return abierta;
}

function terminar(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Se canceló el guardado"));
  });
}

// Todos los registros de una tabla
export async function todos(tabla) {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const req = db.transaction(tabla, "readonly").objectStore(tabla).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function contar(tabla) {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const req = db.transaction(tabla, "readonly").objectStore(tabla).count();
    req.onsuccess = () => resolve(req.result || 0);
    req.onerror = () => reject(req.error);
  });
}

// Guarda o reemplaza varios, y borra los ids indicados, todo junto: o se
// guarda todo o nada (nunca queda una copia a medias)
export async function aplicarCambios(tabla, { poner = [], borrar = [], reemplazarTodo = false } = {}) {
  const db = await abrir();
  const tx = db.transaction(tabla, "readwrite");
  const st = tx.objectStore(tabla);
  if (reemplazarTodo) st.clear();
  for (const id of borrar) st.delete(id);
  for (const fila of poner) st.put(fila);
  await terminar(tx);
}

export async function leerMeta(clave) {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const req = db.transaction("meta", "readonly").objectStore("meta").get(clave);
    req.onsuccess = () => resolve(req.result ? req.result.valor : null);
    req.onerror = () => reject(req.error);
  });
}

export async function guardarMeta(clave, valor) {
  const db = await abrir();
  const tx = db.transaction("meta", "readwrite");
  tx.objectStore("meta").put({ clave, valor });
  await terminar(tx);
}

// Al cerrar sesión: se borra todo lo del panel guardado en este celular
export async function vaciarBaseLocal() {
  try {
    const db = await abrir();
    const tx = db.transaction(Object.keys(TABLAS), "readwrite");
    for (const t of Object.keys(TABLAS)) tx.objectStore(t).clear();
    await terminar(tx);
  } catch (e) {}
}
