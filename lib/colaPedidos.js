// Pedidos armados sin internet desde el panel. Ahora van a la cola única
// (lib/colaOffline.js), junto con las ventas de la caja y los cambios: se
// mandan en orden, sin duplicarse, y si el servidor rechaza alguno NO se
// descarta (antes se borraba en silencio): queda para revisarlo en el Panel.
// Estas funciones quedan con el mismo nombre para no tocar las pantallas.

import { encolar, pendientes, descartar, enviarCola } from "@/lib/colaOffline";

export function leerCola() {
  return pendientes("pedido_nuevo").map((r) => ({ ...r.datos, _id_local: r.clave, _creado_en: r.creada_en }));
}

export function encolarPedido(pedido) {
  const r = encolar("pedido_nuevo", pedido);
  return { ...pedido, _id_local: r.clave, _creado_en: r.creada_en };
}

export function quitarDeCola(idLocal) {
  descartar(idLocal);
}

export function cantidadPendientes() {
  return pendientes("pedido_nuevo").length;
}

// Manda todo lo pendiente (también ventas y cambios, en orden)
export async function sincronizarCola() {
  const r = await enviarCola();
  return { enviados: r.pedidos, fallidos: r.problemas };
}
