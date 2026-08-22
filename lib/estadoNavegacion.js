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

// Solo restauramos si el cliente viene de mirar un producto. Si entró desde
// el menú de abajo o desde la home, es que empieza de nuevo y esperaría ver
// la lista limpia, no los filtros que había puesto ayer.
export function vieneDeUnProducto() {
  try {
    const anterior = document.referrer || "";
    if (anterior.includes("/producto/") || anterior.includes("/a-pedido/")) return true;

    // El botón "atrás" del celular no siempre deja referrer: nos apoyamos
    // en cómo el navegador reporta el tipo de navegación.
    const nav = performance.getEntriesByType("navigation")[0];
    return nav?.type === "back_forward";
  } catch (e) {
    return false;
  }
}
