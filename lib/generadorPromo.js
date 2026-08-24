// Arma la placa para subir a estados de WhatsApp: foto del producto, precio,
// datos de contacto y la marca. Formato vertical 1080x1920, que es el que usa
// WhatsApp y también sirve para historias de Instagram y Facebook.

const ANCHO = 1080;
const ALTO = 1920;

const AZUL = "#1560D4";
const AZUL_OSCURO = "#0E3F91";
const NARANJA = "#FF7A1A";

const NEGOCIO = {
  nombre: "BOLSON CLICK",
  web: "bolsonclick.com.ar",
  telefono: "2944 39-6888",
  zona: "El Bolsón y la Comarca Andina"
};

function formatearPrecio(n) {
  return "$" + Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

// Corta el texto en varias líneas para que entre en el ancho disponible
function repartirEnLineas(ctx, texto, anchoMax, maxLineas) {
  const palabras = (texto || "").split(" ");
  const lineas = [];
  let actual = "";

  for (const palabra of palabras) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (ctx.measureText(prueba).width > anchoMax && actual) {
      lineas.push(actual);
      actual = palabra;
      if (lineas.length === maxLineas - 1) break;
    } else {
      actual = prueba;
    }
  }
  if (actual && lineas.length < maxLineas) lineas.push(actual);

  // Si quedó texto afuera, lo indicamos con puntos suspensivos
  if (lineas.length === maxLineas) {
    const ultima = lineas[maxLineas - 1];
    if (ctx.measureText(ultima).width > anchoMax - 40) {
      lineas[maxLineas - 1] = ultima.slice(0, -3) + "...";
    }
  }

  return lineas;
}

// Los celulares con navegador viejo no tienen roundRect (rectángulo con
// esquinas redondeadas). Lo agregamos nosotros para que la placa se arme
// igual en cualquier teléfono.
function asegurarRoundRect(ctx) {
  if (typeof ctx.roundRect === "function") return;

  ctx.roundRect = function (x, y, ancho, alto, radio) {
    const r = Math.min(radio, ancho / 2, alto / 2);
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + ancho, y, x + ancho, y + alto, r);
    this.arcTo(x + ancho, y + alto, x, y + alto, r);
    this.arcTo(x, y + alto, x, y, r);
    this.arcTo(x, y, x + ancho, y, r);
    this.closePath();
    return this;
  };
}

function cargarImagen(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    // Pasamos por nuestro servidor para poder dibujarla
    img.src = `/api/proxy-imagen?url=${encodeURIComponent(src)}`;
  });
}

export async function generarPlaca(producto, { etiqueta = "NOVEDAD" } = {}) {
  const lienzo = document.createElement("canvas");
  lienzo.width = ANCHO;
  lienzo.height = ALTO;
  const ctx = lienzo.getContext("2d");
  asegurarRoundRect(ctx);

  // Fondo con degradé
  const fondo = ctx.createLinearGradient(0, 0, 0, ALTO);
  fondo.addColorStop(0, AZUL);
  fondo.addColorStop(1, AZUL_OSCURO);
  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, ANCHO, ALTO);

  // Encabezado con la marca
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 52px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(NEGOCIO.nombre, ANCHO / 2, 120);

  ctx.font = "30px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(NEGOCIO.zona, ANCHO / 2, 172);

  // Etiqueta (NOVEDAD, OFERTA, etc.)
  const enOferta =
    producto.precio_oferta && Number(producto.precio_oferta) < Number(producto.precio);
  const textoEtiqueta = enOferta ? "OFERTA" : etiqueta;

  ctx.font = "bold 36px system-ui, sans-serif";
  const anchoEtiqueta = ctx.measureText(textoEtiqueta).width + 70;
  ctx.fillStyle = enOferta ? "#DC2626" : NARANJA;
  ctx.beginPath();
  ctx.roundRect((ANCHO - anchoEtiqueta) / 2, 210, anchoEtiqueta, 66, 33);
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(textoEtiqueta, ANCHO / 2, 256);

  // Foto del producto sobre fondo blanco
  const cajaY = 310;
  const cajaAlto = 720;
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.roundRect(60, cajaY, ANCHO - 120, cajaAlto, 40);
  ctx.fill();

  try {
    const img = await cargarImagen(producto.imagen_url);

    // Entra completa, sin recortar ni deformar
    const maxAncho = ANCHO - 200;
    const maxAlto = cajaAlto - 80;
    const escala = Math.min(maxAncho / img.width, maxAlto / img.height);
    const ancho = img.width * escala;
    const alto = img.height * escala;

    ctx.drawImage(img, (ANCHO - ancho) / 2, cajaY + (cajaAlto - alto) / 2, ancho, alto);
  } catch (e) {
    ctx.fillStyle = "#D1D5DB";
    ctx.font = "120px system-ui, sans-serif";
    ctx.fillText("📦", ANCHO / 2, cajaY + cajaAlto / 2 + 40);
  }

  // Nombre del producto
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 54px system-ui, sans-serif";
  const lineas = repartirEnLineas(ctx, producto.nombre, ANCHO - 140, 3);
  let y = 1130;
  lineas.forEach((linea) => {
    ctx.fillText(linea, ANCHO / 2, y);
    y += 66;
  });

  // Precio
  const precioFinal = enOferta ? producto.precio_oferta : producto.precio;
  y += 30;

  if (enOferta) {
    ctx.font = "40px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    const textoTachado = formatearPrecio(producto.precio);
    ctx.fillText(textoTachado, ANCHO / 2, y);

    // Línea de tachado
    const anchoTachado = ctx.measureText(textoTachado).width;
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo((ANCHO - anchoTachado) / 2, y - 13);
    ctx.lineTo((ANCHO + anchoTachado) / 2, y - 13);
    ctx.stroke();
    y += 70;
  }

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 96px system-ui, sans-serif";
  ctx.fillText(formatearPrecio(precioFinal), ANCHO / 2, y + 20);

  // Aviso de últimas unidades, solo si es cierto
  const stock = Number(producto.stock || 0);
  if (!producto.bajo_pedido && stock > 0 && stock <= 3) {
    y += 90;
    ctx.fillStyle = NARANJA;
    ctx.font = "bold 38px system-ui, sans-serif";
    ctx.fillText(
      stock === 1 ? "¡ÚLTIMA UNIDAD!" : `¡SOLO QUEDAN ${stock}!`,
      ANCHO / 2,
      y
    );
  }

  // Pie con los datos de contacto
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(0, ALTO - 230, ANCHO, 230);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 46px system-ui, sans-serif";
  ctx.fillText(`📱 ${NEGOCIO.telefono}`, ANCHO / 2, ALTO - 150);

  ctx.font = "40px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText(`🛒 ${NEGOCIO.web}`, ANCHO / 2, ALTO - 90);

  ctx.font = "30px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText("Envíos a toda la Comarca", ANCHO / 2, ALTO - 40);

  return new Promise((resolve) => {
    lienzo.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
  });
}

// Texto que acompaña la placa, pensado para que invite a escribir
export function generarTextoPromo(producto, { etiqueta = "NOVEDAD" } = {}) {
  const enOferta =
    producto.precio_oferta && Number(producto.precio_oferta) < Number(producto.precio);
  const precio = enOferta ? producto.precio_oferta : producto.precio;
  const stock = Number(producto.stock || 0);

  const aperturas = {
    NOVEDAD: "🆕 ¡LLEGÓ!",
    OFERTA: "🔥 ¡OFERTA!",
    REPOSICION: "✅ ¡VOLVIÓ EL STOCK!",
    ULTIMAS: "⏰ ¡ÚLTIMAS UNIDADES!"
  };

  const apertura = enOferta ? aperturas.OFERTA : aperturas[etiqueta] || aperturas.NOVEDAD;

  let texto = `${apertura}\n\n${producto.nombre}\n\n`;

  if (enOferta) {
    const ahorro = Number(producto.precio) - Number(producto.precio_oferta);
    texto += `~$${Number(producto.precio).toLocaleString("es-AR")}~\n`;
    texto += `💰 *$${Number(precio).toLocaleString("es-AR")}*\n`;
    texto += `Ahorrás $${ahorro.toLocaleString("es-AR")}\n\n`;
  } else {
    texto += `💰 *$${Number(precio).toLocaleString("es-AR")}*\n\n`;
  }

  if (!producto.bajo_pedido && stock > 0 && stock <= 3) {
    texto += stock === 1 ? "⚠️ Queda 1 sola unidad\n\n" : `⚠️ Solo quedan ${stock}\n\n`;
  }

  if (producto.descripcion) {
    const corta = producto.descripcion.replace(/\s+/g, " ").trim().slice(0, 130);
    texto += `${corta}${producto.descripcion.length > 130 ? "..." : ""}\n\n`;
  }

  texto += `📲 Escribime al ${NEGOCIO.telefono}\n`;
  texto += `🛒 ${NEGOCIO.web}\n`;
  texto += `🚚 Entrega en ${NEGOCIO.zona}`;

  return texto;
}
