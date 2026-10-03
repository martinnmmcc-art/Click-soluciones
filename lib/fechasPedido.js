// Fechas de un pedido, iguales en todas las pantallas y en horario de Argentina.
//
// La fecha de la venta (created_at) no cambia nunca: es la que usa el
// balance. Si después se agrega o quita un producto, se anota aparte
// cuándo (modificado_en), y cada producto guarda cuándo se agregó.

const ZONA = "America/Argentina/Buenos_Aires";

export function fechaCorta(f) {
  if (!f) return "";
  return new Date(f).toLocaleDateString("es-AR", { timeZone: ZONA });
}

export function fechaYHora(f) {
  if (!f) return "";
  const d = new Date(f);
  return (
    d.toLocaleDateString("es-AR", { timeZone: ZONA, day: "numeric", month: "numeric" }) +
    " " +
    d.toLocaleTimeString("es-AR", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hour12: false })
  );
}

// La última vez que pasó algo con el pedido (para ordenar y "última compra")
export function ultimaActividad(p) {
  const a = new Date(p?.created_at || 0).getTime();
  const b = p?.modificado_en ? new Date(p.modificado_en).getTime() : 0;
  return new Date(Math.max(a, b));
}

// ¿Este producto se agregó después de armado el pedido? (más de 10 minutos)
export function agregadoDespues(item, pedido) {
  if (!item?.agregado_en || !pedido?.created_at) return false;
  return new Date(item.agregado_en) - new Date(pedido.created_at) > 10 * 60 * 1000;
}
