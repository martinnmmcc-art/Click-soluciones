// Arma la "vista previa" que muestran WhatsApp, Facebook, etc. cuando se
// comparte el link de un producto: foto, nombre y precio.
//
// Se ejecuta en el servidor (las páginas de producto son "use client", así
// que la vista previa se genera desde el layout.js de cada ruta).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function traerProducto(id) {
  if (!SUPABASE_URL || !SUPABASE_KEY || !id) return null;
  try {
    const url =
      `${SUPABASE_URL}/rest/v1/Productos` +
      `?id=eq.${encodeURIComponent(id)}` +
      `&select=id,nombre,descripcion,precio,precio_oferta,imagen_url,bajo_pedido`;
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      // La vista previa se renueva cada 10 minutos como máximo
      next: { revalidate: 600 }
    });
    if (!res.ok) return null;
    const filas = await res.json();
    return filas?.[0] || null;
  } catch {
    return null;
  }
}

function precioTexto(valor) {
  return "$" + Number(valor || 0).toLocaleString("es-AR", { minimumFractionDigits: 0 });
}

export async function metadataDeProducto(id, seccion) {
  const producto = await traerProducto(decodeURIComponent(String(id || "")));

  if (!producto) {
    return { title: "Bolson Click | Productos para el hogar" };
  }

  const titulo = `${producto.nombre} | Bolson Click`;
  const descripcion = producto.bajo_pedido
    ? "Producto a pedido. Consultá precio final y tiempo de entrega por WhatsApp."
    : `${precioTexto(producto.precio_oferta || producto.precio)} · Envíos y retiro en El Bolsón.`;
  // Foto achicada y liviana para que WhatsApp la muestre sí o sí
  const imagenes = producto.imagen_url
    ? [
        {
          url: `https://www.bolsonclick.com.ar/api/og-imagen/${producto.id}`,
          width: 600,
          height: 600,
          type: "image/jpeg",
          alt: producto.nombre
        }
      ]
    : [];

  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: `/${seccion}/${producto.id}` },
    openGraph: {
      title: producto.nombre,
      description: descripcion,
      url: `/${seccion}/${producto.id}`,
      siteName: "Bolson Click",
      locale: "es_AR",
      type: "website",
      images: imagenes
    },
    twitter: {
      card: "summary",
      title: producto.nombre,
      description: descripcion,
      images: imagenes.map((i) => i.url)
    }
  };
}
