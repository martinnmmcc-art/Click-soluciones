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
  telefono: "2944396888",
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

// El logo está en nuestro propio sitio, así que se carga directo
function cargarLogo() {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = "/icons/icon-192.png";
  });
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

  // Encabezado con la marca, más compacto para dejarle lugar a la foto
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 46px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(NEGOCIO.nombre, ANCHO / 2, 78);

  ctx.font = "26px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(NEGOCIO.zona, ANCHO / 2, 118);

  // Etiqueta (NOVEDAD, OFERTA, etc.)
  const enOferta =
    producto.precio_oferta && Number(producto.precio_oferta) < Number(producto.precio);
  const textoEtiqueta = enOferta ? "OFERTA" : etiqueta;

  ctx.font = "bold 34px system-ui, sans-serif";
  const anchoEtiqueta = ctx.measureText(textoEtiqueta).width + 66;
  ctx.fillStyle = enOferta ? "#DC2626" : NARANJA;
  ctx.beginPath();
  ctx.roundRect((ANCHO - anchoEtiqueta) / 2, 148, anchoEtiqueta, 60, 30);
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(textoEtiqueta, ANCHO / 2, 190);

  // Foto del producto sobre fondo blanco
  const cajaY = 240;
  const cajaAlto = 980;
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.roundRect(36, cajaY, ANCHO - 72, cajaAlto, 40);
  ctx.fill();

  try {
    const img = await cargarImagen(producto.imagen_url);

    // Entra completa, sin recortar ni deformar
    const maxAncho = ANCHO - 110;
    const maxAlto = cajaAlto - 50;
    const escala = Math.min(maxAncho / img.width, maxAlto / img.height);
    const ancho = img.width * escala;
    const alto = img.height * escala;

    ctx.drawImage(img, (ANCHO - ancho) / 2, cajaY + (cajaAlto - alto) / 2, ancho, alto);
  } catch (e) {
    // Si la foto no se puede traer, no dejamos el espacio vacío: ponemos el
    // nombre del producto grande para que la placa siga sirviendo.
    ctx.fillStyle = "#E5E7EB";
    ctx.font = "100px system-ui, sans-serif";
    ctx.fillText("📦", ANCHO / 2, cajaY + cajaAlto / 2 - 60);

    ctx.fillStyle = "#374151";
    ctx.font = "bold 46px system-ui, sans-serif";
    const lineasFallback = repartirEnLineas(ctx, producto.nombre, ANCHO - 220, 4);
    let yf = cajaY + cajaAlto / 2 + 30;
    lineasFallback.forEach((linea) => {
      ctx.fillText(linea, ANCHO / 2, yf);
      yf += 56;
    });
  }

  // Nombre del producto
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 54px system-ui, sans-serif";
  const lineas = repartirEnLineas(ctx, producto.nombre, ANCHO - 140, 3);
  let y = 1300;
  lineas.forEach((linea) => {
    ctx.fillText(linea, ANCHO / 2, y);
    y += 64;
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

  // Pie con los datos de contacto y el logo del negocio
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(0, ALTO - 250, ANCHO, 250);

  // El logo va a la izquierda; el texto se corre para que quede parejo
  let xTexto = ANCHO / 2;
  try {
    const logo = await cargarLogo();
    const ladoLogo = 150;
    const xLogo = 70;
    const yLogo = ALTO - 205;

    // Recuadro redondeado para que el logo no quede cortado ni pegado al borde
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(xLogo, yLogo, ladoLogo, ladoLogo, 28);
    ctx.clip();
    ctx.drawImage(logo, xLogo, yLogo, ladoLogo, ladoLogo);
    ctx.restore();

    xTexto = xLogo + ladoLogo + (ANCHO - xLogo - ladoLogo) / 2 - 20;
  } catch (e) {
    // Sin logo el pie sigue funcionando, solo queda centrado
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 50px system-ui, sans-serif";
  ctx.fillText(NEGOCIO.telefono, xTexto, ALTO - 160);

  ctx.font = "38px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillText(NEGOCIO.web, xTexto, ALTO - 108);

  ctx.font = "28px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText("Envíos a toda la Comarca", xTexto, ALTO - 62);

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
