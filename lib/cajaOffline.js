import { buscarClientes, normalizarTexto } from "@/lib/buscar";
import { guardarLocal } from "@/lib/almacenLocal";
import {
  encolar,
  pendientes,
  descartar,
  editarEnCola,
  enviarCola,
  cantidadPendiente
} from "@/lib/colaOffline";
import { anotarCambioLocal } from "@/lib/pedidosSync";
// Caja sin señal.
//
// En la Comarca hay lugares sin datos, y la venta no puede depender de eso:
// si el cliente está con la plata en la mano, hay que poder cobrar igual.
//
// Cómo funciona:
//  - El catálogo propio se guarda en el celular (son pocos productos).
//  - Las ventas sin señal quedan en una cola local.
//  - Al volver la señal se envían solas y ahí se descuenta el stock.
//
// El stock local se descuenta en el momento para que la caja muestre
// números creíbles, pero el descuento real lo hace el servidor al
// sincronizar: si dos personas venden a la vez, gana el servidor.

const CATALOGO = "bolsonclick_caja_catalogo";
const CATALOGO_FECHA = "bolsonclick_caja_catalogo_fecha";
const COLA = "bolsonclick_caja_cola";
const CLIENTES = "bolsonclick_caja_clientes";
const PEDIDOS = "bolsonclick_caja_pedidos";
const COLA_CAMBIOS = "bolsonclick_caja_cambios";

function leer(clave, porDefecto) {
  try {
    const v = localStorage.getItem(clave);
    return v ? JSON.parse(v) : porDefecto;
  } catch (e) {
    return porDefecto;
  }
}

// Si no entra, libera las copias grandes prescindibles y reintenta; las
// ventas y cambios sin enviar nunca se pierden por falta de lugar.
function guardar(clave, valor) {
  return guardarLocal(clave, valor);
}

// ---------- CATÁLOGO ----------

// Si la lista propia de la caja está vacía (el celular nunca abrió la caja
// con señal, o se borró), se usa la copia completa de tus productos que la
// app guarda sola cada 15 minutos. Antes, en ese caso, el buscador de la
// caja sin señal no encontraba nada.
export function catalogoLocal() {
  const propia = leer(CATALOGO, []);
  if (propia.length) return propia;
  return leer("bolsonclick_productos_propios_offline", [])
    .filter((p) => p.activo !== false)
    .map((p) => ({
      id: p.id,
      nombre: p.nombre,
      precio: Number(p.precio || 0),
      precio_oferta: p.precio_oferta ? Number(p.precio_oferta) : null,
      stock: Number(p.stock || 0),
      codigo_barras: p.codigo_barras || null,
      bajo_pedido: !!p.bajo_pedido
    }));
}

export function fechaCatalogo() {
  try {
    const f = localStorage.getItem(CATALOGO_FECHA);
    return f ? new Date(f) : null;
  } catch (e) {
    return null;
  }
}

// Guarda los productos propios para poder cobrar sin señal
export function guardarCatalogo(productos) {
  const limpio = (productos || []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    precio: Number(p.precio || 0),
    precio_oferta: p.precio_oferta ? Number(p.precio_oferta) : null,
    stock: Number(p.stock || 0),
    codigo_barras: p.codigo_barras || null,
    bajo_pedido: !!p.bajo_pedido
  }));

  if (guardar(CATALOGO, limpio)) {
    try {
      localStorage.setItem(CATALOGO_FECHA, new Date().toISOString());
    } catch (e) {}
  }
  return limpio.length;
}

export function buscarPorCodigoLocal(codigo) {
  const c = String(codigo || "").trim();
  return catalogoLocal().find((p) => p.codigo_barras === c) || null;
}

export function buscarPorNombreLocal(texto) {
  // Sin tildes ni mayúsculas, y por palabras: "set cuchi" encuentra
  // "Set De 6 Cuchillos"
  const palabras = normalizarTexto(texto).split(" ").filter(Boolean);
  if (palabras.join("").length < 2) return [];
  return catalogoLocal()
    .filter((p) => {
      const n = normalizarTexto(p.nombre);
      return palabras.every((w) => n.includes(w));
    })
    .sort((a, b) => b.stock - a.stock)
    .slice(0, 8);
}

// Descuenta el stock local para que la caja muestre números creíbles
// mientras no hay señal. El descuento real lo hace el servidor después.
export function descontarLocal(items) {
  const catalogo = catalogoLocal();
  const porId = {};
  items.forEach((i) => {
    porId[i.id] = (porId[i.id] || 0) + Number(i.cantidad || 0);
  });

  const actualizado = catalogo.map((p) =>
    porId[p.id] ? { ...p, stock: Math.max(p.stock - porId[p.id], 0) } : p
  );

  guardar(CATALOGO, actualizado);
}

// ---------- COLA DE VENTAS ----------
// Ahora todo va a la cola única (lib/colaOffline.js). Estas funciones
// quedan con el mismo nombre para que las pantallas no cambien.

export function ventasPendientes() {
  return pendientes("venta_caja").map((r) => ({ ...r.datos, id_local: r.clave, creada_en: r.creada_en }));
}

export function encolarVenta(venta) {
  const r = encolar("venta_caja", venta);
  descontarLocal(venta.items || []);
  return { ...venta, id_local: r.clave, creada_en: r.creada_en };
}

export function quitarDeCola(idLocal) {
  descartar(idLocal);
}

export function editarVentaEnCola(idLocal, cambios) {
  editarEnCola(idLocal, cambios);
}

// Manda TODO lo pendiente (ventas, pedidos y cambios), en orden
export async function sincronizarVentas() {
  const r = await enviarCola();
  return { enviadas: r.ventas + r.pedidos, aplicados: r.cambios, fallaron: r.problemas };
}

export function hayConexion() {
  try {
    return navigator.onLine !== false;
  } catch (e) {
    return true;
  }
}


// ---------- CLIENTES ----------
// Sin esto, al armar un pedido en zona sin señal no aparece ningún cliente
// y hay que escribir todo a mano.

// Los clientes ahora se guardan en la base del celular bajando solo lo que
// cambió (lib/clientesSync.js), que deja esta copia al día para la caja.
export function clientesLocales() {
  const sincronizados = leer("bolsonclick_clientes_offline", []);
  return sincronizados.length ? sincronizados : leer(CLIENTES, []);
}

export function guardarClientes(clientes) {
  const limpio = (clientes || []).map((c) => ({
    id: c.id,
    nombre: c.nombre,
    telefono: c.telefono,
    localidad: c.localidad || "",
    direccion: c.direccion || ""
  }));
  guardar(CLIENTES, limpio);
  return limpio.length;
}

export function buscarClienteLocal(texto) {
  if (String(texto || "").trim().length < 2) return [];
  // Misma búsqueda que el resto de la app: sin acentos, por palabras, y
  // por teléfono solo si hay al menos 3 números.
  return buscarClientes(clientesLocales(), texto, 10);
}

// ---------- PEDIDOS ----------
// Guardamos los pedidos abiertos para poder verlos y modificarlos sin señal.

export function pedidosLocales() {
  return leer(PEDIDOS, []);
}

export function guardarPedidos(pedidos) {
  const limpio = (pedidos || []).map((p) => ({
    id: p.id,
    numero_pedido: p.numero_pedido,
    nombre_cliente: p.nombre_cliente,
    telefono_cliente: p.telefono_cliente,
    total: Number(p.total || 0),
    monto_pagado: Number(p.monto_pagado || 0),
    estado: p.estado,
    estado_pago: p.estado_pago,
    created_at: p.created_at,
    items: (p.items_pedido || []).map((i) => ({
      producto_id: i.producto_id,
      nombre_producto: i.nombre_producto,
      cantidad: Number(i.cantidad || 0),
      precio_unitario: Number(i.precio_unitario || 0)
    }))
  }));
  guardar(PEDIDOS, limpio);
  return limpio.length;
}

export function pedidoLocal(id) {
  return pedidosLocales().find((p) => Number(p.id) === Number(id)) || null;
}

// ---------- CAMBIOS PENDIENTES ----------
// Cuando modificás un pedido sin señal, el cambio va a la cola única y se
// aplica al volver la conexión.

export function cambiosPendientes() {
  return [...pendientes("cambio_estado"), ...pendientes("agregar_items")].map((r) => ({
    ...r.datos,
    tipo: r.tipo === "agregar_items" ? "agregar_items" : "estado",
    id_local: r.clave,
    creado_en: r.creada_en
  }));
}

export function encolarCambio(cambio) {
  const { tipo, ...datos } = cambio;
  const r = encolar(tipo === "agregar_items" ? "agregar_items" : "cambio_estado", datos);
  // Se ve aplicado enseguida en los pedidos guardados del celular
  if (cambio.pedido_id && cambio.campos) {
    anotarCambioLocal(cambio.pedido_id, cambio.campos).catch(() => {});
  }
  if (cambio.pedido_id) {
    const pedidos = pedidosLocales().map((p) =>
      Number(p.id) === Number(cambio.pedido_id)
        ? { ...p, ...(cambio.campos || {}), items: cambio.items || p.items }
        : p
    );
    guardar(PEDIDOS, pedidos);
  }
  return { ...cambio, id_local: r.clave, creado_en: r.creada_en };
}

export function quitarCambio(idLocal) {
  descartar(idLocal);
}

// Manda TODO lo pendiente, en orden (la misma cola que las ventas)
export async function sincronizarCambios() {
  const r = await enviarCola();
  return { aplicados: r.cambios + r.ventas + r.pedidos, fallaron: r.problemas };
}

// Todo lo que está esperando enviarse
export function totalPendiente() {
  return cantidadPendiente();
}
