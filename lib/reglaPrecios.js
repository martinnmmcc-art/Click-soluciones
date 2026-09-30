// REGLA DE PRECIOS DEL NEGOCIO — un solo lugar para toda la app.
//
//   precio = costo × (1 + transferencia) × (1 + dólar) × (1 + transporte) × (1 + ganancia)
//
// Por defecto: 3% transferencia, 0% dólar, 10% transporte, 80% ganancia.
// Cada producto puede tener los suyos (se cambian al editarlo).
//
// El transporte es SIEMPRE un porcentaje: el flete real de cada pedido no
// entra en el precio ni en el costo de un producto. El flete real queda
// registrado en el pedido y en "Compras al proveedor", para saber cuánto
// salió cada pedido.
//
// La base de datos usa exactamente la misma regla (función calcular_precio).

export const PORCENTAJES_POR_DEFECTO = {
  pct_transferencia: 3,
  pct_dolar: 0,
  pct_transporte: 10,
  pct_ganancia: 80
};

function pct(producto, clave) {
  const valor = producto?.[clave];
  return valor === null || valor === undefined || valor === ""
    ? PORCENTAJES_POR_DEFECTO[clave]
    : Number(valor);
}

// Lo que te cuesta a vos una unidad: costo + transferencia + dólar + transporte
export function costoReal(producto) {
  const costo = Number(producto?.costo) || 0;
  return (
    costo *
    (1 + pct(producto, "pct_transferencia") / 100) *
    (1 + pct(producto, "pct_dolar") / 100) *
    (1 + pct(producto, "pct_transporte") / 100)
  );
}

// El precio de venta que corresponde según la regla, redondeado a $50
export function precioSegunRegla(producto, redondeo = 50) {
  const bruto = costoReal(producto) * (1 + pct(producto, "pct_ganancia") / 100);
  return redondeo > 0 ? Math.ceil(bruto / redondeo) * redondeo : bruto;
}
