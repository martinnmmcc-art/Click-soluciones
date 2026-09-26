// Fotos del proveedor: buscarlas y guardarlas en NUESTRO servidor.
//
// Solo se usa del lado del servidor (rutas /api), nunca en el navegador.
//
// Por qué guardarlas: si las fotos se muestran directo desde la página del
// proveedor, el día que su página se cae o entra en mantenimiento, nuestra
// tienda se queda sin fotos. Copiándolas a nuestro almacenamiento, lo que
// le pase a su página no nos afecta.
//
// Para encontrar la foto de un producto probamos tres caminos, en orden,
// porque cuando el proveedor está en mantenimiento algunos se cortan y
// otros siguen andando:
//   1. El buscador de su tienda (la API de WooCommerce).
//   2. La ficha del producto, armando su dirección a partir del nombre.
//   3. Sus páginas de listado (portada, ofertas), que suelen quedar en caché.
// En todos los casos la foto se acepta SOLO si el nombre coincide con
// seguridad: preferimos no poner foto antes que poner la de otro producto.

const BASE = "https://nextcell.com.ar";
const AGENTE = "Mozilla/5.0 (compatible; BolsonClick/1.0; +https://www.bolsonclick.com.ar)";
const BUCKET = "fotos-productos";

function limite(ms) {
  try {
    return AbortSignal.timeout(ms);
  } catch (e) {
    return undefined;
  }
}

function decodificar(texto) {
  return String(texto || "")
    .replace(/&#215;|&times;/g, "×")
    .replace(/&#8243;|&#8221;|&#8220;|&quot;/g, '"')
    .replace(/&#8211;|&#8212;/g, "-")
    .replace(/&#8217;|&#8216;/g, "'")
    .replace(/&#038;|&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d{2,5});/g, (_, n) => String.fromCharCode(Number(n)));
}

export function normalizar(texto) {
  return decodificar(texto)
    .replace(/×/g, "x")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Así arma WordPress la dirección de cada producto a partir del nombre:
// "Set x 25 CJ25 24 Cubiertos + Organizador" → set-x-25-cj25-24-cubiertos-organizador
export function slugWordpress(nombre) {
  return normalizar(nombre).replace(/ /g, "-");
}

function mismoNombre(a, b) {
  const x = normalizar(a);
  return x.length > 0 && x === normalizar(b);
}

// Las fotos de listado vienen achicadas (foto-300x300.jpg). La original
// suele existir sin ese sufijo, y se ve mucho mejor.
function sinTamano(url) {
  return String(url).replace(/-\d{2,4}x\d{2,4}(?=\.(jpe?g|png|webp)$)/i, "");
}

async function traerTexto(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": AGENTE, Accept: "text/html,application/json" },
      signal: limite(8000),
      cache: "no-store"
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    return null;
  }
}

// Camino 1: el buscador de la tienda del proveedor
async function porBuscador(nombre) {
  const texto = await traerTexto(
    `${BASE}/wp-json/wc/store/v1/products?search=${encodeURIComponent(decodificar(nombre))}&per_page=20`
  );
  if (!texto) return null;

  let lista;
  try {
    lista = JSON.parse(texto);
  } catch (e) {
    return null; // en mantenimiento devuelve una página, no datos
  }
  if (!Array.isArray(lista)) return null;

  const exacto = lista.find((p) => mismoNombre(p?.name, nombre) && p?.images?.[0]?.src);
  return exacto ? exacto.images[0].src : null;
}

// Camino 2: la ficha del producto
async function porFicha(nombre) {
  const html = await traerTexto(`${BASE}/tienda/${slugWordpress(nombre)}/`);
  if (!html || /sitio en mantenimiento/i.test(html)) return null;

  // Confirmamos que la ficha sea de este producto mirando su título
  const titulo = html.match(/<h1[^>]*product_title[^>]*>([\s\S]*?)<\/h1>/i);
  if (!titulo || !mismoNombre(titulo[1].replace(/<[^>]+>/g, ""), nombre)) return null;

  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  return og ? og[1] : null;
}

// Camino 3: las páginas de listado. Cada producto aparece con su foto y el
// nombre en el texto alternativo de la imagen, así que buscamos la imagen
// cuyo texto alternativo coincide exacto con el nombre.
async function porListados(nombre) {
  for (const pagina of ["/", "/ofertas/", "/tienda/"]) {
    const html = await traerTexto(`${BASE}${pagina}`);
    if (!html) continue;

    const imagenes = html.match(/<img\b[^>]*>/gi) || [];
    for (const tag of imagenes) {
      const alt = tag.match(/\balt=["']([^"']*)["']/i);
      if (!alt || !mismoNombre(alt[1], nombre)) continue;

      const fuente =
        tag.match(/\bdata-lazy-src=["']([^"']+)["']/i) ||
        tag.match(/\bdata-src=["']([^"']+)["']/i) ||
        tag.match(/\bsrc=["'](https?:[^"']+)["']/i);

      if (fuente && /wp-content\/uploads/i.test(fuente[1])) {
        return fuente[1];
      }
    }
  }
  return null;
}

// Busca la foto de un producto por los tres caminos. Devuelve la dirección
// de la foto en la página del proveedor, o null si no hay certeza.
export async function buscarFotoEnProveedor(nombreProveedor) {
  if (!nombreProveedor) return null;

  return (
    (await porBuscador(nombreProveedor)) ||
    (await porFicha(nombreProveedor)) ||
    (await porListados(nombreProveedor)) ||
    null
  );
}

async function descargarImagen(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": AGENTE },
      signal: limite(12000),
      cache: "no-store"
    });
    if (!res.ok) return null;
    const tipo = res.headers.get("content-type") || "";
    // En mantenimiento puede devolver una página en vez de la foto
    if (!tipo.startsWith("image/")) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length < 500) return null;
    return { bytes, tipo };
  } catch (e) {
    return null;
  }
}

// Achica la foto para que ocupe poco espacio y cargue rápido en el celular.
// Si la herramienta de compresión no está disponible, se guarda tal cual.
async function comprimir(bytes, tipo) {
  try {
    const sharp = (await import("sharp")).default;
    const salida = await sharp(bytes)
      .rotate()
      .resize({ width: 900, height: 900, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    return { bytes: salida, tipo: "image/webp", extension: "webp" };
  } catch (e) {
    const extension = tipo.includes("png") ? "png" : tipo.includes("webp") ? "webp" : "jpg";
    return { bytes, tipo, extension };
  }
}

// Copia una foto a nuestro almacenamiento y devuelve la dirección nueva.
// Si la foto original es una miniatura, intenta primero con la grande.
export async function copiarAFotosPropias(supabaseAdmin, urlOrigen, nombreArchivo) {
  if (!urlOrigen) return null;

  const grande = sinTamano(urlOrigen);
  const descargada =
    (grande !== urlOrigen ? await descargarImagen(grande) : null) ||
    (await descargarImagen(urlOrigen));

  if (!descargada) return null;

  const final = await comprimir(descargada.bytes, descargada.tipo);
  const ruta = `espejo/${nombreArchivo}.${final.extension}`;

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(ruta, final.bytes, {
      contentType: final.tipo,
      upsert: true,
      cacheControl: "31536000"
    });

  if (error) return null;

  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(ruta);
  return data?.publicUrl || null;
}

export function esFotoPropia(url) {
  return !!url && /supabase\.co/i.test(url);
}
