import { coincideBusqueda } from "@/lib/buscar";
import { leerCopiaTienda } from "@/lib/copiaTienda";
import { sincronizarProductos, propiosEnMemoria } from "@/lib/productosSync";
// Copia del catálogo guardada en el celular del cliente, para que pueda
// seguir mirando productos y armando el carrito donde no hay señal.
//
// Se guarda sola cada vez que el cliente navega con conexión, así que no
// tiene que hacer nada: si un día se queda sin señal, ya la tiene.

const CLAVE = "bolsonclick_catalogo_cliente";
const CLAVE_FECHA = "bolsonclick_catalogo_cliente_fecha";
const MAX_PRODUCTOS = 400; // lo que entra cómodo en el celular

// El catálogo del cliente ahora vive en la base del celular y baja solo lo
// que cambió (lib/productosSync.js). Esta función queda por compatibilidad.
export function guardarCatalogoCliente(productos) {
  if (!Array.isArray(productos) || productos.length === 0) return;
  sincronizarProductos().catch(() => {});
}

export function leerCatalogoCliente() {
  const enBase = propiosEnMemoria();
  if (enBase && enBase.length) return enBase;
  let lista = [];
  try {
    const g = localStorage.getItem(CLAVE);
    lista = g ? JSON.parse(g) : [];
  } catch (e) {}
  // Si el catálogo nunca se guardó en este celular, sirve la copia que guarda
  // el inicio cada vez que carga con señal
  if (!lista.length) lista = leerCopiaTienda();
  return lista;
}

export function fechaCatalogoCliente() {
  try {
    const f = localStorage.getItem(CLAVE_FECHA);
    return f ? new Date(f) : null;
  } catch (e) {
    return null;
  }
}

// Filtra la copia guardada igual que lo haría la base de datos, para que
// sin señal el cliente vea lo mismo que vería con señal.
export function filtrarCatalogoOffline(productos, { disponibilidad, categoria, busqueda }) {
  return productos.filter((p) => {
    if (disponibilidad === "stock" && (p.bajo_pedido || Number(p.stock || 0) <= 0)) return false;
    if (disponibilidad === "pedido" && !p.bajo_pedido) return false;
    if (categoria && categoria !== "todas" && p.categoria !== categoria) return false;
    if (busqueda && busqueda.trim().length >= 2) {
      if (!coincideBusqueda(p.nombre, busqueda)) return false;
    }
    return true;
  });
}

export function estaSinConexion() {
  return typeof navigator !== "undefined" && !navigator.onLine;
}
