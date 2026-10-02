// Respuesta lista para cuando preguntan "¿qué precio tiene?" en Facebook.
//
// Lleva el link del producto: al pegarlo en un comentario, Facebook arma
// solo la tarjeta con la foto y el precio, y al tocarla el cliente va
// directo al producto. Sin capturas de pantalla.

const WEB = "https://www.bolsonclick.com.ar";

function precioTexto(valor) {
  return "$" + Math.round(Number(valor || 0)).toLocaleString("es-AR");
}

export function precioFinalDe(p) {
  return p?.precio_oferta && Number(p.precio_oferta) < Number(p.precio) ? p.precio_oferta : p?.precio;
}

// "?de=fb": la venta queda registrada como venida de Facebook (balance).
// "&v=": el precio va en el link, así Facebook no muestra una tarjeta vieja
// si el precio cambió.
export function linkProducto(p, origen = "fb") {
  const seccion = p?.bajo_pedido ? "a-pedido" : "producto";
  return `${WEB}/${seccion}/${p.id}?de=${origen}&v=${Math.round(Number(precioFinalDe(p) || 0))}`;
}

export function textoRespuesta(p, origen = "fb") {
  const link = linkProducto(p, origen);
  const final = precioTexto(precioFinalDe(p));
  const enOferta = p?.precio_oferta && Number(p.precio_oferta) < Number(p.precio);
  const stock = Number(p?.stock || 0);

  let detalle;
  if (p?.bajo_pedido) {
    detalle = `Está a ${final}. Es a pedido: lo encargamos y te avisamos apenas llega.`;
  } else if (stock <= 0) {
    detalle = `Está a ${final}. Ahora no nos queda, pero escribinos y te lo reservamos del próximo pedido.`;
  } else if (enOferta) {
    detalle = `¡Está en oferta a ${final}! (antes ${precioTexto(p.precio)})`;
  } else {
    detalle = `Está a ${final}.`;
  }

  const urgencia = !p?.bajo_pedido && stock > 0 && stock <= 2 ? ` ¡Nos ${stock === 1 ? "queda 1" : "quedan 2"}!` : "";

  return `¡Hola! 😊 ${detalle}${urgencia}\nLo ves y lo pedís acá 👉 ${link}\nHacemos envíos a toda la Comarca 🚚`;
}

// La tarjeta con foto y precio, como imagen
export function urlTarjeta(p) {
  return `/api/tarjeta/${p.id}?v=${Math.round(Number(precioFinalDe(p) || 0))}`;
}
