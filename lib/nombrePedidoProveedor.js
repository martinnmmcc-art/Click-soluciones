// Cómo se muestra un pedido al proveedor en pantalla.
//
// Cada pedido tiene un número propio y correlativo (1, 2, 3...) que pone la
// base al crearlo: no salta aunque se borre un pedido o falle una carga.
// El número del proveedor (ej: 112952 de Next Cell) va aparte, como dato.

const NOMBRES_PROVEEDOR = {
  nextcell: "Next Cell",
  mzstore: "MZ Store"
};

export function nombreProveedor(proveedor) {
  if (!proveedor) return "";
  return NOMBRES_PROVEEDOR[proveedor] || proveedor;
}

// "#7 · Next Cell 112952" / "#1 · MZ Store" / "#9"
export function nombrePedido(p) {
  if (!p) return "";
  const base = `#${p.numero ?? p.id}`;
  const otroProveedor = p.proveedor && p.proveedor !== "nextcell" ? nombreProveedor(p.proveedor) : "";
  const numeroProveedor = p.numero_pedido ? `${nombreProveedor(p.proveedor || "nextcell")} ${p.numero_pedido}` : "";
  return [base, numeroProveedor || otroProveedor].filter(Boolean).join(" · ");
}
