// Consentimiento de almacenamiento y medición (banner de cookies).
//
// La app no usa cookies de terceros ni herramientas de publicidad. Lo que sí
// guarda en el celular se divide en dos:
//  - NECESARIO: sesión, carrito, favoritos, tema, catálogo sin señal. Sin eso
//    la tienda no funciona, así que no se pide permiso (se informa).
//  - MEDICIÓN: un identificador anónimo del dispositivo, de qué red llegó el
//    cliente (WhatsApp, Facebook...) y los avisos de "agregó al carrito".
//    Solo se usa si el cliente lo acepta en el banner.

const CLAVE = "bolsonclick_consentimiento";
export const EVENTO_CONSENTIMIENTO = "bolsonclick:consentimiento";
export const EVENTO_ABRIR_PREFERENCIAS = "bolsonclick:preferencias-cookies";

// "todas" | "necesarias" | null (todavía no eligió)
export function leerConsentimiento() {
  try {
    const g = localStorage.getItem(CLAVE);
    if (!g) return null;
    const { eleccion } = JSON.parse(g);
    return eleccion === "todas" || eleccion === "necesarias" ? eleccion : null;
  } catch (e) {
    return null;
  }
}

export function aceptaMedicion() {
  return leerConsentimiento() === "todas";
}

export function guardarConsentimiento(eleccion) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ eleccion, fecha: new Date().toISOString() }));
    if (eleccion === "todas") {
      // El origen de la visita se guardó solo para esta pestaña hasta saber
      // si el cliente aceptaba: ahora sí se puede recordar
      const pendiente = sessionStorage.getItem("bolsonclick_origen");
      if (pendiente) localStorage.setItem("bolsonclick_origen", pendiente);
    } else {
      // Si no acepta (o cambia de opinión), se borra lo de medición
      localStorage.removeItem("bolsonclick_visitante");
      localStorage.removeItem("bolsonclick_origen");
    }
  } catch (e) {}
  try {
    window.dispatchEvent(new CustomEvent(EVENTO_CONSENTIMIENTO, { detail: eleccion }));
  } catch (e) {}
}

export function abrirPreferenciasCookies() {
  try {
    window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_PREFERENCIAS));
  } catch (e) {}
}
