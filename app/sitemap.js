import { SITIO, ZONAS, productosPropios, categoriasPropias, rutaProducto, rutaCategoria } from "@/lib/seo";

// Mapa del sitio para Google: portada, catálogo, categorías, zonas de envío
// y cada producto propio (los "a pedido" no: son miles con el mismo texto
// que la página del proveedor, y Google castiga el contenido repetido).
// Se rehace cada hora.
export const revalidate = 3600;

export default async function sitemap() {
  const ahora = new Date();
  const [productos, categorias] = await Promise.all([productosPropios({ limite: 2000 }), categoriasPropias()]);

  const fijas = [
    { url: `${SITIO}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITIO}/catalogo`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITIO}/envios`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITIO}/a-pedido`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITIO}/proximamente`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${SITIO}/terminos`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITIO}/privacidad`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITIO}/reembolsos`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITIO}/arrepentimiento`, changeFrequency: "yearly", priority: 0.2 }
  ].map((p) => ({ ...p, lastModified: ahora }));

  const zonas = ZONAS.map((z) => ({
    url: `${SITIO}/envios/${z.slug}`,
    lastModified: ahora,
    changeFrequency: "weekly",
    priority: 0.7
  }));

  const cats = categorias.map((c) => ({
    url: `${SITIO}${rutaCategoria(c.nombre)}`,
    lastModified: ahora,
    changeFrequency: "daily",
    priority: 0.8
  }));

  const prods = productos.map((p) => ({
    url: `${SITIO}${rutaProducto(p)}`,
    lastModified: p.actualizado_en ? new Date(p.actualizado_en) : ahora,
    changeFrequency: "weekly",
    priority: Number(p.stock) > 0 ? 0.7 : 0.4
  }));

  return [...fijas, ...zonas, ...cats, ...prods];
}
