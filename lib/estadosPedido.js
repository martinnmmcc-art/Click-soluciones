// Estados de los pedidos, en un solo lugar para que el cliente y el panel
// digan siempre lo mismo.
//
// Los textos están escritos pensando en lo que el cliente necesita saber:
// "Falta pagar" cuando ya transfirió da mala impresión y genera consultas.
// "Estamos comprobando tu pago" le dice que su plata llegó y que alguien
// lo está mirando.

export const ESTADOS_ENTREGA = {
  pendiente: {
    label: "Recibido",
    labelCliente: "Pedido recibido",
    icono: "📥",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    ayuda: "Ya lo tenemos, en breve lo preparamos"
  },
  preparando: {
    label: "Preparando",
    labelCliente: "Preparando tu pedido",
    icono: "📦",
    color: "bg-indigo-50 text-indigo-700 border-indigo-200",
    ayuda: "Estamos juntando los productos"
  },
  listo: {
    label: "Listo para retirar",
    labelCliente: "Listo para retirar",
    icono: "✅",
    color: "bg-teal-50 text-teal-700 border-teal-200",
    ayuda: "Podés pasar a buscarlo cuando quieras"
  },
  repartiendo: {
    label: "En camino",
    labelCliente: "En camino a tu domicilio",
    icono: "🛵",
    color: "bg-cyan-50 text-cyan-700 border-cyan-200",
    ayuda: "Salió para tu dirección"
  },
  entregado: {
    label: "Entregado",
    labelCliente: "Entregado",
    icono: "🎉",
    color: "bg-green-50 text-green-700 border-green-200",
    ayuda: "¡Gracias por tu compra!"
  },
  esperando_stock: {
    label: "Esperando stock",
    labelCliente: "Esperando que llegue",
    icono: "⏳",
    color: "bg-purple-50 text-purple-700 border-purple-200",
    ayuda: "Lo encargamos al proveedor, te avisamos cuando llegue"
  },
  demorado: {
    label: "Demorado",
    labelCliente: "Demorado",
    icono: "⚠️",
    color: "bg-orange-50 text-orange-700 border-orange-200",
    ayuda: "Se está demorando más de lo previsto, disculpas"
  },
  rechazado: {
    label: "Rechazado",
    labelCliente: "No pudimos concretarlo",
    icono: "❌",
    color: "bg-red-50 text-red-700 border-red-200",
    ayuda: "Escribinos por WhatsApp para ver qué pasó"
  },
  cancelado: {
    label: "Cancelado",
    labelCliente: "Cancelado",
    icono: "🚫",
    color: "bg-gray-100 text-gray-500 border-gray-200",
    ayuda: ""
  }
};

export const ESTADOS_PAGO = {
  falta_pagar: {
    label: "Falta pagar",
    labelCliente: "Falta pagar",
    icono: "💳",
    color: "bg-red-50 text-red-700 border-red-200",
    ayuda: "Podés transferir o pagar al recibirlo"
  },
  comprobando: {
    label: "Comprobando pago",
    labelCliente: "Comprobando tu pago",
    icono: "🕐",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    ayuda: "Recibimos tu comprobante, lo estamos verificando"
  },
  senado: {
    label: "Señado",
    labelCliente: "Seña recibida",
    icono: "🤝",
    color: "bg-purple-50 text-purple-700 border-purple-200",
    ayuda: "Recibimos la seña, falta el resto"
  },
  deuda_parcial: {
    label: "Pago parcial",
    labelCliente: "Pagaste una parte",
    icono: "➗",
    color: "bg-orange-50 text-orange-700 border-orange-200",
    ayuda: "Queda un saldo pendiente"
  },
  pagado: {
    label: "Pagado",
    labelCliente: "Pago confirmado",
    icono: "✅",
    color: "bg-green-50 text-green-700 border-green-200",
    ayuda: "¡Listo, recibimos tu pago!"
  },
  a_favor: {
    label: "A favor",
    labelCliente: "Tenés saldo a favor",
    icono: "💚",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    ayuda: "Pagaste de más, lo descontamos de la próxima"
  }
};

// Orden en que se muestran en el panel al cambiar el estado
export const OPCIONES_ENTREGA = [
  "pendiente",
  "preparando",
  "listo",
  "repartiendo",
  "entregado",
  "esperando_stock",
  "demorado",
  "rechazado",
  "cancelado"
];

export const OPCIONES_PAGO = [
  "falta_pagar",
  "comprobando",
  "senado",
  "deuda_parcial",
  "pagado",
  "a_favor"
];

export function estadoEntrega(clave) {
  return ESTADOS_ENTREGA[clave] || ESTADOS_ENTREGA.pendiente;
}

export function estadoPago(clave) {
  return ESTADOS_PAGO[clave] || ESTADOS_PAGO.falta_pagar;
}

// Los pasos que ve el cliente como una barra de progreso
export const PASOS_SEGUIMIENTO = ["pendiente", "preparando", "repartiendo", "entregado"];

export function pasoActual(estado) {
  const i = PASOS_SEGUIMIENTO.indexOf(estado);
  if (i >= 0) return i;
  if (estado === "listo") return 2; // equivale a "en camino" para el retiro
  return 0;
}
