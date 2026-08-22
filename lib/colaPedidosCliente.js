// Pedidos que el cliente confirmó sin señal. Quedan guardados en su celular
// y se envían solos apenas vuelve internet, para no perder la compra.

const CLAVE = "bolsonclick_pedidos_cliente_pendientes";

export function leerColaCliente() {
  try {
    const g = localStorage.getItem(CLAVE);
    return g ? JSON.parse(g) : [];
  } catch (e) {
    return [];
  }
}

function escribir(cola) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(cola));
  } catch (e) {}
}

export function encolarPedidoCliente(cuerpo) {
  const cola = leerColaCliente();
  const item = {
    ...cuerpo,
    _id_local: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    _creado_en: new Date().toISOString()
  };
  cola.push(item);
  escribir(cola);
  return item;
}

export function cantidadPendientesCliente() {
  return leerColaCliente().length;
}

// Intenta enviar lo pendiente. Devuelve cuántos pedidos salieron.
export async function sincronizarColaCliente() {
  const cola = leerColaCliente();
  if (cola.length === 0) return { enviados: 0 };

  let enviados = 0;
  const quedan = [];

  for (const pedido of cola) {
    const { _id_local, _creado_en, ...datos } = pedido;
    try {
      const res = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos)
      });

      if (res.ok) {
        enviados++;
      } else if (res.status >= 500) {
        // Problema del servidor: lo reintentamos después
        quedan.push(pedido);
      }
      // Si el servidor lo rechaza por datos inválidos, no lo reintentamos
      // para siempre: se descarta y el cliente puede volver a pedirlo.
    } catch (e) {
      // Sigue sin internet: lo dejamos para el próximo intento
      quedan.push(pedido);
    }
  }

  escribir(quedan);
  return { enviados };
}
