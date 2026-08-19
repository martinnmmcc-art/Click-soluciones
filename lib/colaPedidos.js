// Cola de pedidos armados sin internet.
// Se guardan en el celular y se envían solos cuando vuelve la señal,
// para no perder ninguna venta por estar en una zona sin cobertura.

const CLAVE_COLA = "bolsonclick_pedidos_pendientes";

export function leerCola() {
  try {
    const guardado = localStorage.getItem(CLAVE_COLA);
    return guardado ? JSON.parse(guardado) : [];
  } catch (e) {
    return [];
  }
}

function escribirCola(cola) {
  try {
    localStorage.setItem(CLAVE_COLA, JSON.stringify(cola));
  } catch (e) {
    console.error("No se pudo guardar el pedido pendiente", e);
  }
}

// Agrega un pedido a la cola para enviarlo cuando haya internet.
export function encolarPedido(pedido) {
  const cola = leerCola();
  const item = {
    ...pedido,
    _id_local: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    _creado_en: new Date().toISOString()
  };
  cola.push(item);
  escribirCola(cola);
  return item;
}

export function quitarDeCola(idLocal) {
  escribirCola(leerCola().filter((p) => p._id_local !== idLocal));
}

export function cantidadPendientes() {
  return leerCola().length;
}

// Intenta enviar todos los pedidos pendientes. Devuelve cuántos salieron bien.
export async function sincronizarCola() {
  const cola = leerCola();
  if (cola.length === 0) return { enviados: 0, fallidos: 0 };

  let enviados = 0;
  let fallidos = 0;

  for (const pedido of cola) {
    try {
      const { _id_local, _creado_en, ...datos } = pedido;

      const res = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos)
      });

      if (res.ok) {
        quitarDeCola(_id_local);
        enviados++;
      } else {
        // Si el servidor rechaza el pedido (por ejemplo, datos inválidos),
        // lo sacamos igual para que no quede trabado para siempre.
        const error = await res.json().catch(() => ({}));
        if (res.status >= 400 && res.status < 500) {
          console.warn("Pedido rechazado, se descarta:", error);
          quitarDeCola(_id_local);
        }
        fallidos++;
      }
    } catch (e) {
      // Sin internet todavía: lo dejamos para el próximo intento
      fallidos++;
      break;
    }
  }

  return { enviados, fallidos };
}
