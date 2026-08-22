// Copia del catálogo guardada en el celular del cliente, para que pueda
// seguir mirando productos y armando el carrito donde no hay señal.
//
// Se guarda sola cada vez que el cliente navega con conexión, así que no
// tiene que hacer nada: si un día se queda sin señal, ya la tiene.

const CLAVE = "bolsonclick_catalogo_cliente";
const CLAVE_FECHA = "bolsonclick_catalogo_cliente_fecha";
const MAX_PRODUCTOS = 400; // lo que entra cómodo en el celular

export function guardarCatalogoCliente(productos) {
  if (!Array.isArray(productos) || productos.length === 0) return;

  try {
    const previos = leerCatalogoCliente();
    const mapa = new Map(previos.map((p) => [p.id, p]));

    // Guardamos solo lo necesario para mostrar la lista y armar el carrito.
    // Las descripciones largas las dejamos afuera: ocupan mucho y no hacen
    // falta hasta que el cliente entra al producto.
    productos.forEach((p) => {
      mapa.set(p.id, {
        id: p.id,
        nombre: p.nombre,
        precio: p.precio,
        precio_oferta: p.precio_oferta,
        imagen_url: p.imagen_url,
        stock: p.stock,
        bajo_pedido: p.bajo_pedido,
        categoria: p.categoria
      });
    });

    const lista = Array.from(mapa.values()).slice(-MAX_PRODUCTOS);
    localStorage.setItem(CLAVE, JSON.stringify(lista));
    localStorage.setItem(CLAVE_FECHA, new Date().toISOString());
  } catch (e) {
    // Si no hay espacio en el celular, seguimos sin caché: no es crítico
  }
}

export function leerCatalogoCliente() {
  try {
    const g = localStorage.getItem(CLAVE);
    return g ? JSON.parse(g) : [];
  } catch (e) {
    return [];
  }
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
      if (!(p.nombre || "").toLowerCase().includes(busqueda.trim().toLowerCase())) return false;
    }
    return true;
  });
}

export function estaSinConexion() {
  return typeof navigator !== "undefined" && !navigator.onLine;
}
