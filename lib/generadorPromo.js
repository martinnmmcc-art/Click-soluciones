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
    img.src = `/api/img?u=${encodeURIComponent(src)}`;
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

    // Marca de agua en diagonal, repetida sobre toda la foto.
    //
    // Además de dejar clara la procedencia, dificulta la búsqueda inversa
    // en Google Imágenes: el buscador compara patrones visuales, y un texto
    // superpuesto que cruza el producto cambia bastante esos patrones.
    // No es infalible, pero sube mucho la barrera frente a la marca en una
    // sola esquina, que se recorta en dos segundos.
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(36, cajaY, ANCHO - 72, cajaAlto, 40);
    ctx.clip();

    ctx.translate(ANCHO / 2, cajaY + cajaAlto / 2);
    ctx.rotate(-Math.PI / 6);
    ctx.font = "bold 34px system-ui, sans-serif";
    ctx.textAlign = "center";

    const texto = NEGOCIO.web;
    const pasoY = 130;
    const pasoX = 380;

    for (let fila = -4; fila <= 4; fila++) {
      for (let col = -2; col <= 2; col++) {
        const x = col * pasoX + (fila % 2 ? pasoX / 2 : 0);
        const y = fila * pasoY;

        // Más tenue en el centro, para no tapar el producto
        const distancia = Math.sqrt(x * x + y * y);
        ctx.globalAlpha = distancia < 180 ? 0.1 : 0.19;

        ctx.fillStyle = "#0E3F91";
        ctx.fillText(texto, x, y);
      }
    }
    ctx.restore();

    // Y una marca sólida abajo, legible aunque recorten la foto
    ctx.save();
    ctx.textAlign = "right";
    ctx.font = "bold 28px system-ui, sans-serif";

    const anchoMarca = ctx.measureText(NEGOCIO.web).width;
    const xMarca = ANCHO - 70;
    const yMarca = cajaY + cajaAlto - 32;

    ctx.fillStyle = "rgba(14,63,145,0.82)";
    ctx.beginPath();
    ctx.roundRect(xMarca - anchoMarca - 24, yMarca - 29, anchoMarca + 34, 42, 21);
    ctx.fill();

    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(NEGOCIO.web, xMarca, yMarca);
    ctx.restore();
    ctx.textAlign = "center";
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

  // Pie con los datos de contacto y el logo del negocio.
  // Todo centrado: antes el texto se corría a la derecha para dejarle lugar
  // al logo y quedaba desbalanceado.
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(0, ALTO - 250, ANCHO, 250);

  ctx.textAlign = "center";

  try {
    const logo = await cargarLogo();
    const ladoLogo = 108;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect((ANCHO - ladoLogo) / 2, ALTO - 238, ladoLogo, ladoLogo, 22);
    ctx.clip();
    ctx.drawImage(logo, (ANCHO - ladoLogo) / 2, ALTO - 238, ladoLogo, ladoLogo);
    ctx.restore();
  } catch (e) {
    // Sin logo el pie igual funciona
  }

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 48px system-ui, sans-serif";
  ctx.fillText(NEGOCIO.telefono, ANCHO / 2, ALTO - 96);

  ctx.font = "36px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillText(NEGOCIO.web, ANCHO / 2, ALTO - 54);

  ctx.font = "26px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText("Envíos a toda la Comarca", ANCHO / 2, ALTO - 20);

  return new Promise((resolve) => {
    lienzo.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
  });
}

// Textos de la promoción, adaptados a cada red.
//
// Criterio de copywriting: el primer renglón NO es el nombre del producto,
// es el beneficio o el motivo por el que le importa. La gente decide en el
// primer segundo si sigue leyendo. El nombre va después, cuando ya enganchó.
//
// La escasez que se menciona es siempre real (sale del stock). Inventarla
// funciona una vez y después quema la confianza, que en un pueblo es lo
// único que no se recupera.

const NEGOCIO_INFO = {
  telefono: "2944396888",
  web: "bolsonclick.com.ar",
  zona: "El Bolsón y la Comarca Andina"
};

// Ganchos por tipo de aviso. Hablan del cliente, no del producto.
const GANCHOS = {
  NOVEDAD: [
    "Llegó algo que te va a servir 👀",
    "Nuevo en el depósito 📦",
    "Recién desembalado 🆕"
  ],
  OFERTA: [
    "Bajamos el precio por unos días 🔥",
    "Esta semana sale menos 💥",
    "Aprovechá que está en oferta 🏷️"
  ],
  REPOSICION: [
    "Volvió el que se había agotado ✅",
    "Nos volvió a entrar 🙌",
    "Ya lo tenemos de nuevo 📦"
  ],
  ULTIMAS: [
    "Quedan pocas y no sé si repongo ⏰",
    "Últimas unidades de este 👇",
    "Se está terminando ⚠️"
  ]
};

function elegirGancho(tipo) {
  const lista = GANCHOS[tipo] || GANCHOS.NOVEDAD;
  return lista[Math.floor(Math.random() * lista.length)];
}

function datosPrecio(producto) {
  const enOferta =
    producto.precio_oferta && Number(producto.precio_oferta) < Number(producto.precio);
  const precio = enOferta ? producto.precio_oferta : producto.precio;
  const ahorro = enOferta ? Number(producto.precio) - Number(producto.precio_oferta) : 0;
  const pct = enOferta ? Math.round((ahorro / Number(producto.precio)) * 100) : 0;
  return { enOferta, precio: Number(precio), ahorro, pct };
}

function textoEscasez(producto) {
  const stock = Number(producto.stock || 0);
  if (producto.bajo_pedido || stock <= 0 || stock > 3) return "";
  return stock === 1
    ? "⚠️ Queda *1 sola unidad*"
    : `⚠️ Solo quedan *${stock}*`;
}

// Para estados de WhatsApp: corto, porque se lee en 3 segundos mientras
// alguien pasa historias con el dedo.
export function textoWhatsApp(producto, { etiqueta = "NOVEDAD" } = {}) {
  const { enOferta, precio, ahorro } = datosPrecio(producto);
  const gancho = elegirGancho(enOferta ? "OFERTA" : etiqueta);
  const escasez = textoEscasez(producto);

  let m = `${gancho}\n\n*${producto.nombre}*\n\n`;

  if (enOferta) {
    m += `~$${Number(producto.precio).toLocaleString("es-AR")}~ → *$${precio.toLocaleString("es-AR")}*\n`;
    m += `Te ahorrás $${ahorro.toLocaleString("es-AR")} 💰\n\n`;
  } else {
    m += `*$${precio.toLocaleString("es-AR")}*\n\n`;
  }

  if (escasez) m += `${escasez}\n\n`;

  m += `📲 Escribime y te lo aparto\n`;
  m += `🚚 Entrego en ${NEGOCIO_INFO.zona}\n`;
  m += `🛒 ${NEGOCIO_INFO.web}/?de=wa`;

  return m;
}

// Para Facebook: más largo, con la descripción y etiquetas locales.
// Ahí la gente lee más y las etiquetas ayudan a que te encuentren vecinos.
export function textoFacebook(producto, { etiqueta = "NOVEDAD" } = {}) {
  const { enOferta, precio, ahorro, pct } = datosPrecio(producto);
  const gancho = elegirGancho(enOferta ? "OFERTA" : etiqueta);
  const escasez = textoEscasez(producto).replace(/\*/g, "");

  let m = `${gancho}\n\n${producto.nombre}\n\n`;

  if (producto.descripcion) {
    const corta = producto.descripcion.replace(/\s+/g, " ").trim().slice(0, 220);
    m += `${corta}${producto.descripcion.length > 220 ? "..." : ""}\n\n`;
  }

  if (enOferta) {
    m += `💰 Antes $${Number(producto.precio).toLocaleString("es-AR")}\n`;
    m += `🔥 AHORA $${precio.toLocaleString("es-AR")} (${pct}% menos)\n`;
    m += `Te ahorrás $${ahorro.toLocaleString("es-AR")}\n\n`;
  } else {
    m += `💰 $${precio.toLocaleString("es-AR")}\n\n`;
  }

  if (escasez) m += `${escasez}\n\n`;

  m += `📲 Consultas al ${NEGOCIO_INFO.telefono}\n`;
  m += `🛒 Comprá online: ${NEGOCIO_INFO.web}/?de=fb\n`;
  m += `🚚 Entregas en ${NEGOCIO_INFO.zona}\n\n`;
  // Etiquetas locales: son las que hacen que te vean vecinos, no gente
  // de Buenos Aires a la que no le podés entregar.
  m += `#ElBolson #ComarcaAndina #LagoPuelo #ElHoyo #Epuyen #BolsonClick`;

  return m;
}

// Se mantiene por compatibilidad con lo que ya estaba
export function generarTextoPromo(producto, opciones = {}) {
  return textoWhatsApp(producto, opciones);
}


// ---------- PLACA CON VARIOS PRODUCTOS ----------
//
// Para publicar en Facebook una sola imagen con varias ofertas, en vez de
// subir un producto por publicación. En Facebook una publicación con varios
// productos rinde más que varias seguidas: no satura el muro de tus
// seguidores y da sensación de surtido.
//
// Formato cuadrado (1080x1080), que es el que mejor se ve en el muro.

// La medida depende de dónde se publica: los estados de WhatsApp son
// verticales (9:16) y una imagen cuadrada queda con bandas negras arriba y
// abajo. Facebook, en cambio, muestra mejor el cuadrado en el muro.
const MEDIDAS = {
  whatsapp: { ancho: 1080, alto: 1920, columnas: 2 },
  facebook: { ancho: 1080, alto: 1080, columnas: 2 }
};

export async function generarPlacaMultiple(
  productos,
  { titulo = "OFERTAS", formato = "whatsapp" } = {}
) {
  const lista = productos.slice(0, 4);
  if (lista.length === 0) throw new Error("Sin productos");

  const { ancho: ANCHO_P, alto: ALTO_P } = MEDIDAS[formato] || MEDIDAS.whatsapp;
  const vertical = ALTO_P > ANCHO_P;

  const lienzo = document.createElement("canvas");
  lienzo.width = ANCHO_P;
  lienzo.height = ALTO_P;
  const ctx = lienzo.getContext("2d");
  asegurarRoundRect(ctx);

  const fondo = ctx.createLinearGradient(0, 0, ANCHO_P, ALTO_P);
  fondo.addColorStop(0, AZUL);
  fondo.addColorStop(1, AZUL_OSCURO);
  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, ANCHO_P, ALTO_P);

  // Encabezado
  ctx.textAlign = "center";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `bold ${vertical ? 48 : 40}px system-ui, sans-serif`;
  ctx.fillText(NEGOCIO.nombre, ANCHO_P / 2, vertical ? 78 : 62);

  ctx.font = `bold ${vertical ? 36 : 30}px system-ui, sans-serif`;
  const anchoEt = ctx.measureText(titulo).width + 70;
  const yEt = vertical ? 108 : 82;
  ctx.fillStyle = NARANJA;
  ctx.beginPath();
  ctx.roundRect((ANCHO_P - anchoEt) / 2, yEt, anchoEt, vertical ? 62 : 54, 31);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(titulo, ANCHO_P / 2, yEt + (vertical ? 44 : 38));

  // Grilla
  const margen = vertical ? 34 : 30;
  const inicioY = vertical ? 200 : 160;
  const altoPie = vertical ? 200 : 150;
  const anchoCelda = (ANCHO_P - margen * 3) / 2;
  const filas = Math.ceil(lista.length / 2);
  const altoCelda = (ALTO_P - inicioY - altoPie - margen * (filas - 1)) / filas;

  for (let i = 0; i < lista.length; i++) {
    const p = lista[i];
    const col = i % 2;
    const fila = Math.floor(i / 2);
    const x = margen + col * (anchoCelda + margen);
    const y = inicioY + fila * (altoCelda + margen);

    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.roundRect(x, y, anchoCelda, altoCelda, 24);
    ctx.fill();

    const enOferta = p.precio_oferta && Number(p.precio_oferta) < Number(p.precio);

    // La zona de texto crece si hay que mostrar el precio tachado
    const altoTexto = enOferta ? 148 : 118;
    const altoFoto = altoCelda - altoTexto;

    try {
      const img = await cargarImagen(p.imagen_url);
      const escala = Math.min(
        (anchoCelda - 30) / img.width,
        (altoFoto - 20) / img.height
      );
      const w = img.width * escala;
      const h = img.height * escala;
      ctx.drawImage(img, x + (anchoCelda - w) / 2, y + 14 + (altoFoto - h) / 2, w, h);
    } catch (e) {
      ctx.fillStyle = "#E5E7EB";
      ctx.font = "64px system-ui, sans-serif";
      ctx.fillText("📦", x + anchoCelda / 2, y + altoFoto / 2 + 24);
    }

    // Etiqueta de oferta sobre la foto
    if (enOferta) {
      const pct = Math.round(
        ((Number(p.precio) - Number(p.precio_oferta)) / Number(p.precio)) * 100
      );
      ctx.fillStyle = "#DC2626";
      ctx.beginPath();
      ctx.roundRect(x + 12, y + 12, 84, 38, 19);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 22px system-ui, sans-serif";
      ctx.fillText(`-${pct}%`, x + 54, y + 38);
    }

    // Nombre
    ctx.fillStyle = "#1F2937";
    ctx.font = `bold ${vertical ? 24 : 21}px system-ui, sans-serif`;
    const lineas = repartirEnLineas(ctx, p.nombre, anchoCelda - 30, 2);
    let ty = y + altoFoto + 30;
    lineas.forEach((linea) => {
      ctx.fillText(linea, x + anchoCelda / 2, ty);
      ty += vertical ? 28 : 25;
    });

    // Precios: el tachado va arriba del final, el vigente abajo
    const precio = enOferta ? p.precio_oferta : p.precio;

    if (enOferta) {
      ctx.fillStyle = "#9CA3AF";
      ctx.font = `${vertical ? 22 : 19}px system-ui, sans-serif`;
      const tachado = formatearPrecio(p.precio);
      const yTach = y + altoCelda - 52;
      ctx.fillText(tachado, x + anchoCelda / 2, yTach);

      const anchoTach = ctx.measureText(tachado).width;
      ctx.strokeStyle = "#9CA3AF";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + anchoCelda / 2 - anchoTach / 2, yTach - 7);
      ctx.lineTo(x + anchoCelda / 2 + anchoTach / 2, yTach - 7);
      ctx.stroke();
    }

    ctx.fillStyle = enOferta ? "#DC2626" : "#1560D4";
    ctx.font = `bold ${vertical ? 38 : 32}px system-ui, sans-serif`;
    ctx.fillText(formatearPrecio(precio), x + anchoCelda / 2, y + altoCelda - 16);
  }

  // Pie
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fillRect(0, ALTO_P - altoPie, ANCHO_P, altoPie);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = `bold ${vertical ? 46 : 38}px system-ui, sans-serif`;
  ctx.fillText(NEGOCIO.telefono, ANCHO_P / 2, ALTO_P - (vertical ? 118 : 78));

  ctx.font = `${vertical ? 34 : 28}px system-ui, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillText(NEGOCIO.web, ANCHO_P / 2, ALTO_P - (vertical ? 72 : 42));

  ctx.font = `${vertical ? 26 : 22}px system-ui, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.fillText(`Envíos en ${NEGOCIO.zona}`, ANCHO_P / 2, ALTO_P - (vertical ? 32 : 14));

  return new Promise((resolve) => {
    lienzo.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
  });
}

// Texto para acompañar la placa con varios productos
export function textoMultiple(productos, { titulo = "OFERTAS" } = {}) {
  const lista = productos.slice(0, 4);

  let m = `🔥 ${titulo} EN BOLSON CLICK\n\n`;

  lista.forEach((p) => {
    const enOferta = p.precio_oferta && Number(p.precio_oferta) < Number(p.precio);
    const precio = enOferta ? p.precio_oferta : p.precio;

    m += `▸ ${p.nombre}\n`;
    if (enOferta) {
      m += `   ~$${Number(p.precio).toLocaleString("es-AR")}~ → *$${Number(precio).toLocaleString("es-AR")}*\n`;
    } else {
      m += `   $${Number(precio).toLocaleString("es-AR")}\n`;
    }
  });

  m += `\n📲 Consultas al ${NEGOCIO.telefono}\n`;
  m += `🛒 Todo el catálogo: ${NEGOCIO.web}/?de=promo\n`;
  m += `🚚 Entregas en ${NEGOCIO.zona}\n\n`;
  m += `#ElBolson #ComarcaAndina #LagoPuelo #ElHoyo #Epuyen #BolsonClick`;

  return m;
}
