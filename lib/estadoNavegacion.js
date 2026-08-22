// Guarda dónde estaba el cliente al salir de una lista de productos
// (qué filtro tenía, cuánto había scrolleado) para devolverlo al mismo
// lugar cuando toca "atrás". Sin esto, volver de un producto lo mandaba
// al principio de la lista y había que buscar todo de nuevo.

const PREFIJO = "bolsonclick_nav_";

export function guardarEstado(pantalla, estado) {
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
  try {
    sessionStorage.setItem(CLAVE_SALIDA, pantalla);
  } catch (e) {}
}

// Devuelve true una sola vez, la primera que se consulta después de haber
// entrado a un producto. Así al volver se restaura, pero si después el
// cliente entra de nuevo desde el menú, arranca limpio.
export function vieneDeUnProducto(pantalla) {
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

// Devuelve la página a la altura donde estaba el cliente.
// Hay que insistir: al volver atrás la lista todavía se está dibujando y las
// fotos no cargaron, así que la página es más corta de lo que va a ser y un
// solo intento se queda a mitad de camino.
export function restaurarScroll(y) {
  if (!y || y < 50) return;

  // Avisamos al resto de la app que estamos restaurando, para que el
  // guardado automático no pise la posición buena con valores intermedios.
  window.__bolsonRestaurando = true;

  let intentos = 0;
  const maxIntentos = 40; // aproximadamente 2 segundos

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
