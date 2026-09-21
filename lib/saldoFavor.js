// Saldo a favor de los clientes: lo que pagaron de más en pedidos anteriores.
//
// Mismo cliente = mismos últimos 10 dígitos del celular (así da igual si se
// cargó con 54, 9, 0 o sin nada adelante). Es la misma regla que usa la
// base de datos (función saldo_a_favor / aplicar_saldo_a_favor).

export function claveTelefono(tel) {
  return String(tel || "").replace(/\D/g, "").slice(-10);
}

// Suma lo que el cliente pagó de más en todos sus pedidos (sin contar
// cancelados ni el pedido que se está mirando).
export function saldoAFavorDe(pedidos, telefono, excluirId = null) {
  const clave = claveTelefono(telefono);
  if (!clave) return 0;
  return (pedidos || []).reduce((acc, p) => {
    if (p.id === excluirId) return acc;
    if (p.estado === "cancelado") return acc;
    if (claveTelefono(p.telefono_cliente) !== clave) return acc;
    const deMas = Number(p.monto_pagado || 0) - Number(p.total || 0);
    return deMas > 0 ? acc + deMas : acc;
  }, 0);
}
