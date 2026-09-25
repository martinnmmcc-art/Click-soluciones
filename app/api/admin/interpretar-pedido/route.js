export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Interpreta el texto de un pedido pegado tal cual como aparece en la web
// del proveedor (Producto \t Total) y busca cada uno en el catálogo del
// proveedor para traer su foto. Es lo mismo que se hacía a mano en el chat,
// ahora automático.

// "Nombre Producto CODIGO x 2	$9.200,00" → { nombre, cantidad, precioUnitario }
function parsearLinea(linea) {
  const m = linea.match(/^(.+?)\s*[×x]\s*(\d+)\s*\t?\s*\$?\s*([\d.,]+)\s*$/i);
  if (!m) return null;

  const nombre = m[1].trim();
  const cantidad = parseInt(m[2], 10);
  const totalTexto = m[3].replace(/\./g, "").replace(",", ".");
  const total = parseFloat(totalTexto);

  if (!nombre || !cantidad || !total) return null;

  return {
    nombre,
    cantidad,
    precioUnitario: Math.round((total / cantidad) * 100) / 100,
    total
  };
}

function normalizar(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(request) {
  try {
    const { texto } = await request.json();
    if (!texto?.trim()) {
      return Response.json({ error: "Pegá el texto del pedido" }, { status: 400 });
    }

    const lineas = texto.split("\n").map((l) => l.trim()).filter(Boolean);
    const items = [];

    for (const linea of lineas) {
      const parseada = parsearLinea(linea);
      if (parseada) items.push(parseada);
    }

    if (items.length === 0) {
      return Response.json(
        { error: "No pude reconocer ningún producto. Fijate que el formato sea el de la web del proveedor." },
        { status: 400 }
      );
    }

    // Buscamos cada producto en nuestra base (por si ya lo tenemos) y en
    // el catálogo del proveedor (para traer la foto)
    const resultado = [];

    for (const item of items) {
      const norm = normalizar(item.nombre);

      // ¿Ya lo tenemos cargado?
      const { data: existentes } = await supabase
        .from("Productos")
        .select("id, nombre, imagen_url")
        .or(`nombre_proveedor.ilike.%${item.nombre.slice(0, 30)}%,nombre.ilike.%${norm.split(" ").slice(0, 3).join("%")}%`)
        .limit(1);

      const encontrado = existentes?.[0] || null;

      let imagenUrl = encontrado?.imagen_url || null;

      // Si no tenemos foto, buscamos en el catálogo del proveedor
      if (!imagenUrl) {
        try {
          const q = encodeURIComponent(item.nombre.split(" ").slice(0, 4).join(" "));
          const res = await fetch(
            `https://nextcell.com.ar/wp-json/wc/store/v1/products?search=${q}&per_page=3`,
            { signal: AbortSignal.timeout(6000) }
          );
          if (res.ok) {
            const datos = await res.json();
            if (datos?.[0]?.images?.[0]?.src) {
              imagenUrl = datos[0].images[0].src;
            }
          }
        } catch (e) {
          // Sin foto no es grave: se puede cargar después a mano
        }
      }

      resultado.push({
        nombre: item.nombre,
        cantidad: item.cantidad,
        precio_unitario: item.precioUnitario,
        producto_id: encontrado?.id || null,
        imagen_url: imagenUrl
      });
    }

    const subtotal = items.reduce((a, i) => a + i.total, 0);

    return Response.json({ items: resultado, subtotal, cantidad: resultado.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
