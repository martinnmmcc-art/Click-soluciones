// Descarga todo lo necesario para que la app funcione sin internet:
// los productos, sus fotos y los datos del cliente.
//
// El punto clave son las FOTOS: sin ellas el catálogo offline se ve como una
// lista de cuadros grises y el cliente no reconoce nada. Las guardamos en el
// mismo depósito que usa la app para funcionar sin señal.

import { supabase } from "@/lib/supabaseClient";

const CACHE_IMAGENES = "bolsonclick-img-v5";
const CLAVE_DATOS = "bolsonclick_offline_datos";
const CLAVE_FECHA = "bolsonclick_offline_fecha";
const CLAVE_PEDIDOS = "bolsonclick_mis_pedidos";

// Trae productos en tandas: Supabase corta en 1000 filas por consulta.
async function traerProductos({ soloPropios }) {
  const TANDA = 1000;
  let todos = [];
  let desde = 0;

  while (true) {
    let q = supabase
      .from("Productos")
      .select(
        "id, nombre, precio, precio_oferta, imagen_url, imagen_url_2, stock, bajo_pedido, categoria, descripcion, video_url, actualizado_en"
      )
      .eq("activo", true);

    if (soloPropios) {
      q = q.or("bajo_pedido.is.null,bajo_pedido.eq.false");
    }

    const { data, error } = await q
      .order("stock", { ascending: false, nullsFirst: false })
      .range(desde, desde + TANDA - 1);

    if (error) throw new Error(error.message);
    const tanda = data || [];
    todos = todos.concat(tanda);

    if (tanda.length < TANDA) break;
    desde += TANDA;
    if (desde > 20000) break;
  }

  return todos;
}

// Guarda las fotos para poder mostrarlas sin señal.
async function guardarImagenes(urls, alAvanzar) {
  if (typeof caches === "undefined") return { guardadas: 0, fallidas: 0 };

  const cache = await caches.open(CACHE_IMAGENES);
  let guardadas = 0;
  let fallidas = 0;

  // De a 6 por vez: pedirlas todas juntas satura la red y el celular
  const LOTE = 6;

  for (let i = 0; i < urls.length; i += LOTE) {
    const lote = urls.slice(i, i + LOTE);

    await Promise.all(
      lote.map(async (url) => {
        try {
          const yaEsta = await cache.match(url);
          if (yaEsta) {
            guardadas++;
            return;
          }
          const res = await fetch(url, { mode: "no-cors" });
          await cache.put(url, res);
          guardadas++;
        } catch (e) {
          fallidas++;
        }
      })
    );

    if (alAvanzar) alAvanzar(Math.min(i + LOTE, urls.length), urls.length);
  }

  return { guardadas, fallidas };
}

// Descarga completa. `alAvanzar` recibe el estado para mostrar una barra.
export async function descargarTodoOffline({
  soloPropios = true,
  incluirFotos = true,
  telefono = null,
  alAvanzar = null
} = {}) {
  function avisar(etapa, hechos, total) {
    if (alAvanzar) alAvanzar({ etapa, hechos, total });
  }

  avisar("productos", 0, 1);
  const productos = await traerProductos({ soloPropios });
  avisar("productos", 1, 1);

  try {
    localStorage.setItem(CLAVE_DATOS, JSON.stringify(productos));
  } catch (e) {
    // Si no entra todo en el celular, guardamos lo más importante:
    // los productos propios, que son los que se venden con entrega inmediata.
    const reducido = productos.filter((p) => !p.bajo_pedido);
    localStorage.setItem(CLAVE_DATOS, JSON.stringify(reducido));
  }

  // Pedidos del cliente, para que pueda consultarlos sin señal
  if (telefono) {
    try {
      const res = await fetch(`/api/mis-pedidos?telefono=${encodeURIComponent(telefono)}`);
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem(CLAVE_PEDIDOS, JSON.stringify(data.pedidos || []));
      }
    } catch (e) {}
  }

  let resultadoFotos = { guardadas: 0, fallidas: 0 };

  if (incluirFotos) {
    const urls = [];
    productos.forEach((p) => {
      if (p.imagen_url) urls.push(p.imagen_url);
      if (p.imagen_url_2) urls.push(p.imagen_url_2);
    });

    const unicas = [...new Set(urls)];
    avisar("fotos", 0, unicas.length);
    resultadoFotos = await guardarImagenes(unicas, (hechos, total) =>
      avisar("fotos", hechos, total)
    );
  }

  localStorage.setItem(CLAVE_FECHA, new Date().toISOString());

  return {
    productos: productos.length,
    fotos: resultadoFotos.guardadas,
    fotosFallidas: resultadoFotos.fallidas
  };
}

export function leerProductosOffline() {
  try {
    const g = localStorage.getItem(CLAVE_DATOS);
    return g ? JSON.parse(g) : [];
  } catch (e) {
    return [];
  }
}

export function leerMisPedidosOffline() {
  try {
    const g = localStorage.getItem(CLAVE_PEDIDOS);
    return g ? JSON.parse(g) : [];
  } catch (e) {
    return [];
  }
}

export function fechaDescargaOffline() {
  try {
    const f = localStorage.getItem(CLAVE_FECHA);
    return f ? new Date(f) : null;
  } catch (e) {
    return null;
  }
}

// Cuánto espacio está usando la app en el celular
export async function espacioUsado() {
  try {
    if (!navigator.storage?.estimate) return null;
    const { usage, quota } = await navigator.storage.estimate();
    return {
      usadoMB: (usage / 1024 / 1024).toFixed(1),
      disponibleMB: (quota / 1024 / 1024).toFixed(0)
    };
  } catch (e) {
    return null;
  }
}

// ---------- SINCRONIZACIÓN AL VOLVER LA SEÑAL ----------

const CLAVE_ULTIMA_SINC = "bolsonclick_ultima_sincronizacion";

function ultimaSincronizacion() {
  try {
    return localStorage.getItem(CLAVE_ULTIMA_SINC);
  } catch (e) {
    return null;
  }
}

// Baja SOLO lo que cambió desde la última vez: precios nuevos, stock
// actualizado, productos agregados o dados de baja. Con 2800 productos,
// bajar todo cada vez que vuelve la señal gastaría datos al pedo.
export async function sincronizarCambios({ alTerminar = null } = {}) {
  const desde = ultimaSincronizacion();
  const guardados = leerProductosOffline();

  // Si nunca se descargó nada, corresponde una descarga completa
  if (guardados.length === 0) return { cambios: 0, primeraVez: true };

  try {
    let q = supabase
      .from("Productos")
      .select(
        "id, nombre, precio, precio_oferta, imagen_url, imagen_url_2, stock, bajo_pedido, categoria, descripcion, video_url, actualizado_en, activo"
      );

    if (desde) q = q.gt("actualizado_en", desde);

    const { data, error } = await q.limit(1000);
    if (error) throw new Error(error.message);

    const cambiados = data || [];

    if (cambiados.length === 0) {
      localStorage.setItem(CLAVE_ULTIMA_SINC, new Date().toISOString());
      if (alTerminar) alTerminar({ cambios: 0 });
      return { cambios: 0 };
    }

    const mapa = new Map(guardados.map((p) => [p.id, p]));
    let precios = 0;
    let nuevos = 0;
    let sinStock = 0;

    cambiados.forEach((p) => {
      const previo = mapa.get(p.id);

      // Los productos desactivados salen de la copia local
      if (p.activo === false) {
        mapa.delete(p.id);
        return;
      }

      if (!previo) {
        nuevos++;
      } else {
        if (Number(previo.precio) !== Number(p.precio)) precios++;
        if (Number(previo.stock || 0) > 0 && Number(p.stock || 0) <= 0) sinStock++;
      }

      mapa.set(p.id, p);
    });

    const lista = Array.from(mapa.values());

    try {
      localStorage.setItem(CLAVE_DATOS, JSON.stringify(lista));
    } catch (e) {
      localStorage.setItem(CLAVE_DATOS, JSON.stringify(lista.filter((p) => !p.bajo_pedido)));
    }

    localStorage.setItem(CLAVE_ULTIMA_SINC, new Date().toISOString());

    // Fotos de lo nuevo: sin esto los productos recién llegados salen en gris
    const fotosNuevas = cambiados
      .filter((p) => p.imagen_url)
      .map((p) => p.imagen_url)
      .slice(0, 60);

    if (fotosNuevas.length > 0) {
      guardarImagenes(fotosNuevas).catch(() => {});
    }

    const resumen = { cambios: cambiados.length, precios, nuevos, sinStock };
    if (alTerminar) alTerminar(resumen);
    return resumen;
  } catch (e) {
    return { cambios: 0, error: e.message };
  }
}
