export function getWhatsAppNumber() {
  return "5492944396888";
}

export function buildWhatsAppLink(message) {
  const number = getWhatsAppNumber();
  const text = encodeURIComponent(message);
  return `https://wa.me/${number}?text=${text}`;
}

export function whatsappProductMessage(producto) {
  return `Hola! Quiero consultar por este producto de Bolson Click:\n\n*${producto.nombre}*\nPrecio: $${formatPrice(
    producto.precio_oferta || producto.precio
  )}\n\n¿Está disponible?`;
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
