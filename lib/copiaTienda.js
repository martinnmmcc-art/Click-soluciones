// Copia de los productos de la tienda en el celular de CUALQUIER cliente.
//
// Cada vez que la tienda carga bien con señal, se guarda una copia liviana.
// Si después no hay señal (o la base no contesta), se muestra la copia: así
// cualquiera que abrió la app una vez con señal puede ver productos y
// precios sin conexión.

const CLAVE = "bolsonclick_copia_tienda";

function liviano(p) {
  return {
    id: p.id,
    nombre: p.nombre,
    precio: p.precio,
    precio_oferta: p.precio_oferta,
    stock: p.stock,
    imagen_url: p.imagen_url,
    categoria: p.categoria,
    destacado: p.destacado,
    bajo_pedido: p.bajo_pedido,
    activo: p.activo,
    stock_bajo: p.stock_bajo,
    vendidos: p.vendidos,
    fecha_ingreso: p.fecha_ingreso,
    created_at: p.created_at,
    actualizado_en: p.actualizado_en,
    descripcion: p.descripcion ? String(p.descripcion).slice(0, 240) : null
  };
}

export function guardarCopiaTienda(productos) {
  if (!Array.isArray(productos) || productos.length === 0) return;
  try {
    localStorage.setItem(
      CLAVE,
      JSON.stringify({ fecha: new Date().toISOString(), productos: productos.map(liviano) })
    );
  } catch (e) {
    // Si no entra en el celular, no rompemos nada
  }
}

export function leerCopiaTienda() {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE) || "null");
    if (g?.productos?.length) return g.productos;
  } catch (e) {}
  // Si es el celular del administrador, también sirve su copia completa
  try {
    const propios = JSON.parse(localStorage.getItem("bolsonclick_productos_propios_offline") || "[]");
    return propios.filter((p) => p.activo !== false);
  } catch (e) {
    return [];
  }
}

// Una consulta a la base con límite de tiempo: si no contesta, se considera
// fallida (y se usa la copia) en vez de dejar la pantalla esperando.
export function conLimite(promesa, ms = 6000) {
  return Promise.race([
    promesa,
    new Promise((r) => setTimeout(() => r({ data: null, error: new Error("sin respuesta") }), ms))
  ]).catch((e) => ({ data: null, error: e }));
}
