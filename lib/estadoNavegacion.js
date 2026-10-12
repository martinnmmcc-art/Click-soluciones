// Guarda dónde estaba el cliente al salir de una lista de productos
// (qué filtro tenía, cuánto había scrolleado) para devolverlo al mismo
// lugar cuando toca "atrás". Sin esto, volver de un producto lo mandaba
// al principio de la lista y había que buscar todo de nuevo.

const PREFIJO = "bolsonclick_nav_";

// ¿Esta pantalla está abierta en la ventana invisible de fondo? (la recorrida
// que deja la app lista para usar sin señal). Esa ventana comparte la memoria
// de la pestaña: si guardaba o borraba posiciones, pisaba la del usuario y al
// volver de un producto la lista arrancaba de nuevo desde arriba.
export function esVentanaDeFondo() {
  try {
    return typeof window !== "undefined" && window.self !== window.top;
  } catch (e) {
    return true;
  }
}

export function guardarEstado(pantalla, estado) {
  if (esVentanaDeFondo()) return;
  // Si el usuario ya tocó un producto desde esta lista, la posición queda
  // congelada hasta que vuelva. Al cambiar de pantalla la página sube sola
  // arriba de todo, y el guardado automático pisaba la posición buena con 0.
  if (hayRegresoPendiente(pantalla)) return;
  try {
    sessionStorage.setItem(PREFIJO + pantalla, JSON.stringify(estado));
  } catch (e) {
    // sessionStorage puede fallar en modo privado: no es crítico
  }
}

export function leerEstado(pantalla) {
  try {
    const guardado = sessionStorage.getItem(PREFIJO + pantalla);
    return guardado ? JSON.parse(guardado) : null;
  } catch (e) {
    return null;
  }
}

export function limpiarEstado(pantalla) {
  if (esVentanaDeFondo()) return;
  try {
    sessionStorage.removeItem(PREFIJO + pantalla);
  } catch (e) {}
}

// Marcamos cuando el cliente sale de la lista para mirar un producto.
// No alcanza con mirar el referrer ni el tipo de navegación: la app se mueve
// sin recargar la página, así que esos datos nunca cambian y siempre daban
// "no viene de un producto".
const CLAVE_SALIDA = PREFIJO + "salio_a_producto";

export function marcarSalidaAProducto(pantalla) {
  if (esVentanaDeFondo()) return;
  try {
    sessionStorage.setItem(CLAVE_SALIDA, pantalla);
  } catch (e) {}
}

// Devuelve true una sola vez, la primera que se consulta después de haber
// entrado a un producto. Así al volver se restaura, pero si después el
// cliente entra de nuevo desde el menú, arranca limpio.
export function vieneDeUnProducto(pantalla) {
  // La ventana de fondo nunca "consume" la marca del usuario
  if (esVentanaDeFondo()) return false;
  try {
    const marcado = sessionStorage.getItem(CLAVE_SALIDA);
    if (marcado === pantalla) {
      sessionStorage.removeItem(CLAVE_SALIDA);
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

// Mira (sin consumirla) si el usuario está volviendo de un producto a esta
// pantalla. Sirve para arrancar la lista ya con sus filtros, antes de dibujar.
export function hayRegresoPendiente(pantalla) {
  if (esVentanaDeFondo()) return false;
  try {
    return sessionStorage.getItem(CLAVE_SALIDA) === pantalla;
  } catch (e) {
    return false;
  }
}

// Devuelve la página a la altura donde estaba el cliente.
// Hay que insistir: al volver atrás la lista todavía se está dibujando y las
// fotos no cargaron, así que la página es más corta de lo que va a ser y un
// solo intento se queda a mitad de camino.
export function restaurarScroll(y) {
  if (!y || y < 50 || esVentanaDeFondo()) return;

  // Avisamos al resto de la app que estamos restaurando, para que el
  // guardado automático no pise la posición buena con valores intermedios.
  window.__bolsonRestaurando = true;

  let intentos = 0;
  const maxIntentos = 120; // hasta unos 6 segundos (con poca señal las fotos tardan)

  function intentar() {
    intentos++;
    const alturaDisponible = document.body.scrollHeight - window.innerHeight;

    if (alturaDisponible >= y) {
      window.scrollTo(0, y);
      if (Math.abs(window.scrollY - y) < 80 || intentos >= maxIntentos) {
        setTimeout(() => {
          window.__bolsonRestaurando = false;
        }, 300);
        return;
      }
    }

    if (intentos < maxIntentos) {
      requestAnimationFrame(() => setTimeout(intentar, 50));
    } else {
      window.__bolsonRestaurando = false;
    }
  }

  requestAnimationFrame(intentar);
}

// Al entrar a una pantalla nos aseguramos de que la bandera esté limpia.
// Si quedó trabada de una navegación anterior, bloquearía el guardado de
// la posición en toda la app y el scroll fallaría de forma intermitente.
export function limpiarBanderaRestauracion() {
  try {
    clearTimeout(window.__bolsonRestaurandoTimeout);
    window.__bolsonRestaurando = false;
  } catch (e) {}
}
