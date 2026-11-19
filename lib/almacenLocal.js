// Guardado en el celular (localStorage) que no falla en silencio.
//
// El navegador da unos 5 MB por sitio. Las copias para trabajar sin señal
// (catálogo completo, productos con descripción, etc.) lo llenaban, y desde
// ahí cada guardado nuevo fallaba SIN avisar: los pedidos y clientes
// guardados quedaban congelados en la última copia que entró.
//
// guardarLocal(): si no entra, borra primero las copias grandes que se
// pueden volver a bajar (el catálogo completo y la tienda del cliente),
// en ese orden, y reintenta. Lo de trabajar (pedidos, clientes, caja, ventas
// sin enviar) nunca se borra.

// De lo menos importante a lo más importante: se sacrifica en este orden
const PRESCINDIBLES = [
  "bolsonclick_offline_datos", // catálogo de la tienda del cliente (se rearma)
  "bolsonclick_catalogo_offline", // catálogo completo con "a pedido"
  "bolsonclick_copia_tienda",
  "bolsonclick_catalogo_cliente",
  "bolsonclick_productos_propios_offline"
];

const CLAVE_FECHAS = "bolsonclick_fechas_guardado";

function anotarFecha(clave) {
  try {
    const f = JSON.parse(localStorage.getItem(CLAVE_FECHAS) || "{}");
    f[clave] = new Date().toISOString();
    localStorage.setItem(CLAVE_FECHAS, JSON.stringify(f));
  } catch (e) {}
}

// Cuándo se guardó por última vez una clave (Date o null)
export function fechaGuardado(clave) {
  try {
    const f = JSON.parse(localStorage.getItem(CLAVE_FECHAS) || "{}");
    return f[clave] ? new Date(f[clave]) : null;
  } catch (e) {
    return null;
  }
}

function esFaltaDeEspacio(e) {
  return (
    e &&
    (e.name === "QuotaExceededError" ||
      e.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      e.code === 22 ||
      e.code === 1014)
  );
}

// Devuelve true si quedó guardado
export function guardarLocal(clave, valor) {
  const texto = typeof valor === "string" ? valor : JSON.stringify(valor);
  try {
    localStorage.setItem(clave, texto);
    anotarFecha(clave);
    return true;
  } catch (e) {
    if (!esFaltaDeEspacio(e)) return false;
  }
  // No entró: se libera lugar de a una copia prescindible y se reintenta
  for (const p of PRESCINDIBLES) {
    if (p === clave) continue;
    try {
      if (localStorage.getItem(p) === null) continue;
      localStorage.removeItem(p);
      localStorage.setItem(clave, texto);
      anotarFecha(clave);
      return true;
    } catch (e) {
      if (!esFaltaDeEspacio(e)) return false;
    }
  }
  // Ni así: se borra la copia vieja de ESTO, para no mostrar datos viejos
  // como si fueran actuales
  try {
    localStorage.removeItem(clave);
  } catch (e) {}
  return false;
}

// Cuánto ocupa lo guardado (en caracteres), para mostrarlo en el panel
export function espacioLocalUsado() {
  let total = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      total += k.length + (localStorage.getItem(k) || "").length;
    }
  } catch (e) {}
  return total;
}
