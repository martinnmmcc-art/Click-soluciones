// Configuración del comercio.
//
// Todo lo que identifica al negocio vive acá y sale de variables de entorno.
// Para instalar la app en otro comercio no hace falta tocar el código: se
// cambian estas variables y listo.
//
// Los valores por defecto son los de Bolson Click, así la app funciona sin
// configurar nada. En otro comercio se definen las variables de entorno y
// esos valores quedan reemplazados, sin tocar una línea de código.

export const NEGOCIO = {
  nombre: process.env.NEXT_PUBLIC_NEGOCIO_NOMBRE || "Bolson Click",
  nombreCorto: process.env.NEXT_PUBLIC_NEGOCIO_NOMBRE_CORTO || "Bolson Click",
  descripcion:
    process.env.NEXT_PUBLIC_NEGOCIO_DESCRIPCION ||
    "Productos para el hogar en El Bolsón y la Comarca",

  telefono: process.env.NEXT_PUBLIC_NEGOCIO_TELEFONO || "2944396888",
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5492944396888",

  web: process.env.NEXT_PUBLIC_NEGOCIO_WEB || "bolsonclick.com.ar",
  sitio: process.env.NEXT_PUBLIC_SITE_URL || "https://www.bolsonclick.com.ar",

  zona: process.env.NEXT_PUBLIC_NEGOCIO_ZONA || "El Bolsón y la Comarca Andina",
  localidad: process.env.NEXT_PUBLIC_NEGOCIO_LOCALIDAD || "El Bolsón",

  // Etiquetas locales para las publicaciones en redes
  etiquetas: (process.env.NEXT_PUBLIC_NEGOCIO_HASHTAGS ||
   "#ElBolson,#ComarcaAndina,#LagoPuelo,#ElHoyo,#Epuyen,#BolsonClick")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean),

  // Datos para cobrar por transferencia
  alias: process.env.NEXT_PUBLIC_ALIAS_TRANSFERENCIA || "bolsonclick",
  banco: process.env.NEXT_PUBLIC_BANCO || "Tarjeta Naranja"
};

// Colores de la marca. Se usan en las placas promocionales y los carteles.
export const COLORES = {
  principal: process.env.NEXT_PUBLIC_COLOR_PRINCIPAL || "#1560D4",
  principalOscuro: process.env.NEXT_PUBLIC_COLOR_PRINCIPAL_OSCURO || "#0E3F91",
  acento: process.env.NEXT_PUBLIC_COLOR_ACENTO || "#FF7A1A",
  acentoOscuro: process.env.NEXT_PUBLIC_COLOR_ACENTO_OSCURO || "#E4600A"
};

// Correos que pueden entrar al panel de administración
export const ADMINS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ||
   "maricelcanumir@gmail.com,martinnm.mcc@gmail.com,patagoniavolt@gmail.com")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// Celulares del negocio, para que reciban los avisos de ventas.
// Formato: "Nombre:telefono,Nombre:telefono"
export const ADMINS_TELEFONOS = (process.env.NEXT_PUBLIC_ADMIN_TELEFONOS ||
   "Maricel:2944396888,Martin:2944636224,Patagonia Volt:2944906160")
  .split(",")
  .map((par) => {
    const [nombre, telefono] = par.split(":").map((x) => (x || "").trim());
    return nombre && telefono ? { nombre, telefono } : null;
  })
  .filter(Boolean);

// Recargos que aplica el negocio sobre el precio del proveedor.
// Cada comercio tiene sus propios números.
export const PRECIOS = {
  recargoTransferencia: Number(process.env.NEXT_PUBLIC_RECARGO_TRANSFERENCIA || 1.03),
  recargoInflacion: Number(process.env.NEXT_PUBLIC_RECARGO_INFLACION || 1.05),
  margen: Number(process.env.NEXT_PUBLIC_MARGEN || 1.8),
  redondeo: Number(process.env.NEXT_PUBLIC_REDONDEO || 50)
};

// Arma el enlace de WhatsApp con un mensaje ya escrito
export function linkWhatsApp(mensaje = "") {
  const num = NEGOCIO.whatsapp.replace(/\D/g, "");
  return `https://wa.me/${num}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ""}`;
}

// Dice si un correo puede entrar al panel
export function esAdmin(email) {
  if (!email) return false;
  return ADMINS.includes(String(email).trim().toLowerCase());
}

// Dice si un teléfono es de los celulares del negocio
export function esTelefonoAdmin(telefono) {
  if (!telefono) return false;
  return ADMINS_TELEFONOS.some((a) => a.telefono === String(telefono).trim());
}
