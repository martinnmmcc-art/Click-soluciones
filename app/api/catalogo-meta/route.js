export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SITIO = "https://www.bolsonclick.com.ar";

// Catálogo en el formato que entiende Meta (WhatsApp, Instagram y Facebook).
//
// Se configura una sola vez en Commerce Manager con esta dirección, y Meta
// la lee todos los días: los precios y el stock se actualizan solos, sin
// tener que cargar producto por producto en el celular.
//
// Formato: XML de Google Shopping, que es el que Meta acepta.

function escapar(texto) {
  if (!texto) return "";
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function limpiarTexto(texto, maxLargo) {
  if (!texto) return "";
  const limpio = String(texto)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return limpio.length > maxLargo ? limpio.slice(0, maxLargo - 3) + "..." : limpio;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    // Por defecto solo los productos propios: son los que podés entregar.
    // Con ?todos=1 se incluyen también los del proveedor.
    const incluirAPedido = searchParams.get("todos") === "1";

    const TANDA = 1000;
    let productos = [];
    let desde = 0;

    while (true) {
      let q = supabase
        .from("Productos")
        .select(
          "id, nombre, descripcion, precio, precio_oferta, imagen_url, imagen_url_2, imagen_url_3, stock, bajo_pedido, categoria"
        )
        .eq("activo", true)
        .gt("precio", 0)
        .not("imagen_url", "is", null);

      if (!incluirAPedido) {
        q = q.or("bajo_pedido.is.null,bajo_pedido.eq.false");
      }

      const { data, error } = await q.range(desde, desde + TANDA - 1);
      if (error) throw new Error(error.message);

      const tanda = data || [];
      productos = productos.concat(tanda);

      if (tanda.length < TANDA) break;
      desde += TANDA;
      if (desde > 20000) break;
    }

    const items = productos
      .map((p) => {
        const enOferta =
          p.precio_oferta && Number(p.precio_oferta) < Number(p.precio);

        // Meta necesita saber si se puede entregar. Los "a pedido" van como
        // encargo, así el cliente sabe que no es entrega inmediata.
        const disponible =
          !p.bajo_pedido && Number(p.stock || 0) > 0
            ? "in stock"
            : p.bajo_pedido
            ? "available for order"
            : "out of stock";

        const descripcion =
          limpiarTexto(p.descripcion, 4500) ||
          `${p.nombre}. Disponible en Bolson Click, El Bolsón y la Comarca Andina.`;

        // Las fotos pasan por nuestro dominio para no exponer al proveedor
        const foto = `${SITIO}/api/img?u=${encodeURIComponent(p.imagen_url)}`;
        const extras = [p.imagen_url_2, p.imagen_url_3]
          .filter(Boolean)
          .map(
            (u) =>
              `    <g:additional_image_link>${escapar(
                `${SITIO}/api/img?u=${encodeURIComponent(u)}`
              )}</g:additional_image_link>`
          )
          .join("\n");

        return `  <item>
    <g:id>BC${p.id}</g:id>
    <g:title>${escapar(limpiarTexto(p.nombre, 150))}</g:title>
    <g:description>${escapar(descripcion)}</g:description>
    <g:link>${SITIO}/producto/${p.id}</g:link>
    <g:image_link>${escapar(foto)}</g:image_link>
${extras}
    <g:availability>${disponible}</g:availability>
    <g:condition>new</g:condition>
    <g:price>${Number(p.precio).toFixed(2)} ARS</g:price>${
          enOferta
            ? `\n    <g:sale_price>${Number(p.precio_oferta).toFixed(2)} ARS</g:sale_price>`
            : ""
        }
    <g:brand>Bolson Click</g:brand>
    <g:product_type>${escapar(p.categoria || "Hogar")}</g:product_type>
    <g:google_product_category>Home &amp; Garden</g:google_product_category>
  </item>`;
      })
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
  <title>Bolson Click</title>
  <link>${SITIO}</link>
  <description>Productos para el hogar en El Bolsón y la Comarca Andina</description>
${items}
</channel>
</rss>`;

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        // Meta lee esto una vez por día: guardarlo una hora alcanza
        "Cache-Control": "public, max-age=3600"
      }
    });
  } catch (err) {
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}
