import { aceptaMedicion } from "@/lib/consentimiento";

// Cada dispositivo recibe un identificador anónimo. No dice quién es la
// persona, pero permite reconocer que las acciones vienen del mismo celular.
// Cuando después se registra, podemos vincular lo que había hecho antes.
// Es MEDICIÓN: solo existe si el cliente lo aceptó en el banner de cookies.
export function idVisitante() {
  try {
    if (!aceptaMedicion()) return null;
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
// Los avisos de "agregó / sacó del carrito": con cuenta se mandan siempre;
// sin cuenta, solo si aceptó la medición. Los de pedidos, registro
// y opiniones son parte de la compra y se mandan siempre.
const TIPOS_MEDICION = ["carrito", "carrito_quitar"];

export function avisarAdmin({ tipo, telefono, nombre, detalle, monto }) {
  try {
    // Con cuenta, avisar qué agrega es parte de atenderlo (está en la política
    // de privacidad). Sin cuenta, solo si aceptó la medición.
    if (TIPOS_MEDICION.includes(tipo) && !telefono && !aceptaMedicion()) return;
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
