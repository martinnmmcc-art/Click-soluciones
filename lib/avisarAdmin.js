// Avisa al negocio (push + historial) de algo que hizo un cliente.
// Nunca rompe la acción del cliente: si falla el aviso, se ignora en silencio.
export function avisarAdmin({ tipo, telefono, nombre, detalle, monto }) {
  try {
    fetch("/api/notificar-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, telefono, nombre, detalle, monto })
    }).catch(() => {});
  } catch (e) {
    // silencio: el aviso es secundario frente a lo que está haciendo el cliente
  }
}

// Lee los datos del cliente logueado, para saber quién hizo la acción.
export function clienteActual() {
  try {
    const sesionStr = localStorage.getItem("cliente_sesion");
    if (!sesionStr) return null;
    return JSON.parse(sesionStr);
  } catch (e) {
    return null;
  }
}
