// Todo lo que Google necesita para encontrar la tienda: direcciones legibles
// ("/producto/123-termo-acero-1-2l"), datos del servidor para el sitemap y
// las páginas de categoría, y las zonas de envío.
//
// Lo que trae datos se ejecuta en el SERVIDOR (sitemap, categorías, zonas,
// datos estructurados) con la clave pública de Supabase: solo lee lo mismo
// que ve cualquier visitante.

export const SITIO = "https://www.bolsonclick.com.ar";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// "Termo Acero 1.2l Con Mate" → "termo-acero-1-2l-con-mate"
export function slugify(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
    .replace(/-+$/g, "");
}

// El número va primero: "/producto/123-termo-acero". Así los links viejos
// ("/producto/123") siguen andando y el nombre puede cambiar sin romper nada.
export function idDeRuta(param) {
  const texto = decodeURIComponent(String(param || ""));
  const m = texto.match(/^(\d+)/);
  return m ? m[1] : texto;
}

export function rutaProducto(p) {
  if (!p?.id) return "/catalogo";
  const base = p.bajo_pedido ? "/a-pedido" : "/producto";
  const s = slugify(p.nombre);
  return s ? `${base}/${p.id}-${s}` : `${base}/${p.id}`;
}

export function rutaCategoria(nombre) {
  return `/categoria/${slugify(nombre)}`;
}

export function precioFinal(p) {
  const oferta = Number(p?.precio_oferta || 0);
  const precio = Number(p?.precio || 0);
  return oferta > 0 && oferta < precio ? oferta : precio;
}

export function precioTexto(valor) {
  return "$" + Number(valor || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

// Consulta de solo lectura a Supabase desde el servidor, con caché de 10 min
export async function consultar(ruta, { revalidar = 600 } = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      next: { revalidate: revalidar }
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

const CAMPOS_LISTA =
  "id,nombre,precio,precio_oferta,imagen_url,stock,categoria,bajo_pedido,actualizado_en,created_at,descripcion,video_url,sin_stock_proveedor";

// Productos propios (no "a pedido"), los que tienen stock primero
export async function productosPropios({ categoria, limite = 1000 } = {}) {
  let ruta =
    `Productos?select=${CAMPOS_LISTA}` +
    `&activo=eq.true&or=(bajo_pedido.is.null,bajo_pedido.eq.false)` +
    `&order=stock.desc.nullslast,actualizado_en.desc.nullslast&limit=${limite}`;
  // Una categoría puede venir con varias formas de escribirse ("Hogar", "hogar")
  if (categoria) {
    const lista = (Array.isArray(categoria) ? categoria : [categoria])
      .map((c) => `"${String(c).replace(/"/g, '\\"')}"`)
      .join(",");
    ruta += `&categoria=in.(${encodeURIComponent(lista)})`;
  }
  return consultar(ruta);
}

// Categorías con al menos un producto propio: [{ nombre, slug, cantidad }]
export async function categoriasPropias() {
  const filas = await consultar(
    `Productos?select=categoria&activo=eq.true&or=(bajo_pedido.is.null,bajo_pedido.eq.false)&categoria=not.is.null&limit=5000`
  );
  const cuenta = new Map();
  for (const f of filas) {
    const nombre = String(f.categoria || "").trim();
    const slug = slugify(nombre);
    if (!slug) continue;
    const previo = cuenta.get(slug);
    if (previo) previo.cantidad++;
    else cuenta.set(slug, { nombre: nombreLimpio(nombre), original: [nombre], slug, cantidad: 1 });
  }
  // Varias categorías pueden dar el mismo slug ("Hogar" / "hogar"): se juntan
  for (const f of filas) {
    const nombre = String(f.categoria || "").trim();
    const c = cuenta.get(slugify(nombre));
    if (c && !c.original.includes(nombre)) c.original.push(nombre);
  }
  return [...cuenta.values()].sort((a, b) => b.cantidad - a.cantidad);
}

// Sin emojis ni espacios de más: "Vinilos De Pared y Piso 🚩" → "Vinilos De Pared y Piso"
export function nombreLimpio(nombre) {
  return String(nombre || "")
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ---- Zonas de envío ----
// "local": entrega en mano o punto de encuentro, se puede pagar en efectivo.
// "transporte": se despacha por Andreani u otro transporte; el envío lo paga
// el cliente y se le informa el costo antes de cobrar.
export const ZONAS = [
  { slug: "el-bolson", nombre: "El Bolsón", provincia: "Río Negro", tipo: "local" },
  { slug: "lago-puelo", nombre: "Lago Puelo", provincia: "Chubut", tipo: "local" },
  { slug: "el-hoyo", nombre: "El Hoyo", provincia: "Chubut", tipo: "local" },
  { slug: "epuyen", nombre: "Epuyén", provincia: "Chubut", tipo: "local" },
  { slug: "mallin-ahogado", nombre: "Mallín Ahogado", provincia: "Río Negro", tipo: "local" },
  { slug: "bariloche", nombre: "Bariloche", provincia: "Río Negro", tipo: "transporte" },
  { slug: "villa-la-angostura", nombre: "Villa La Angostura", provincia: "Neuquén", tipo: "transporte" },
  { slug: "san-martin-de-los-andes", nombre: "San Martín de los Andes", provincia: "Neuquén", tipo: "transporte" },
  { slug: "esquel", nombre: "Esquel", provincia: "Chubut", tipo: "transporte" },
  { slug: "cholila", nombre: "Cholila", provincia: "Chubut", tipo: "transporte" }
];

export function zonaPorSlug(slug) {
  return ZONAS.find((z) => z.slug === slug) || null;
}
