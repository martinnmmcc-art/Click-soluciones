// Cada dispositivo recibe un identificador anónimo. No dice quién es la
// persona, pero permite reconocer que las acciones vienen del mismo celular.
// Cuando después se registra, podemos vincular lo que había hecho antes.
export function idVisitante() {
  try {
    let id = localStorage.getItem("bolsonclick_visitante");
    if (!id) {
      id = `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem("bolsonclick_visitante", id);
    }
    return id;
  } catch (e) {
    return null;
  }
}

// Avisa al negocio (push + historial) de algo que hizo un cliente.
// Nunca rompe la acción del cliente: si falla el aviso, se ignora en silencio.
export function avisarAdmin({ tipo, telefono, nombre, detalle, monto }) {
  try {
    fetch("/api/notificar-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo,
        telefono,
        nombre,
        detalle,
        monto,
        visitante: idVisitante()
      })
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
