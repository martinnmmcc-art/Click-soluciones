export function getWhatsAppNumber() {
  return "5492944396888";
}

export function buildWhatsAppLink(message) {
  const number = getWhatsAppNumber();
  const text = encodeURIComponent(message);
  return `https://wa.me/${number}?text=${text}`;
}

// Dirección pública de la tienda. Los links a productos que van en los
// mensajes de WhatsApp usan siempre este dominio.
export const SITIO_URL = "https://www.bolsonclick.com.ar";

// Link directo a la ficha de un producto. Al mandarlo por WhatsApp se ve
// con la foto, el nombre y el precio (vista previa del link).
export function linkProducto(producto) {
  const seccion = producto?.bajo_pedido ? "a-pedido" : "producto";
  return `${SITIO_URL}/${seccion}/${producto.id}`;
}

export function whatsappProductMessage(producto) {
  return `Hola! Quiero consultar por este producto de Bolson Click:\n\n*${producto.nombre}*\nPrecio: $${formatPrice(
    producto.precio_oferta || producto.precio
  )}\n\n¿Está disponible?\n\n${linkProducto(producto)}`;
}

// Consulta por un producto de la sección "A pedido"
export function whatsappAPedidoMessage(producto) {
  return `Hola! 👋 Vi *${producto.nombre}* en la sección de productos a pedido de Bolson Click. ¿Me contás precio final y tiempo de entrega?\n\n${SITIO_URL}/a-pedido/${producto.id}`;
}

export function whatsappOrderMessage(pedido) {
  return `Hola! Acabo de hacer el pedido *${pedido.numero_pedido}* en Bolson Click por un total de $${formatPrice(
    pedido.total
  )}. Quisiera coordinar el pago/entrega.`;
}

export function formatPrice(value) {
  const num = Number(value || 0);
  return num.toLocaleString("es-AR", { minimumFractionDigits: 0 });
}
