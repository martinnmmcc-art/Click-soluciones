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
      `&select=id,nombre,descripcion,precio,precio_oferta,imagen_url,bajo_pedido,actualizado_en`;
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

  const precioFinal =
    producto.precio_oferta && Number(producto.precio_oferta) < Number(producto.precio)
      ? producto.precio_oferta
      : producto.precio;
  const titulo = `${producto.nombre} | Bolson Click`;
  const descripcion = producto.bajo_pedido
    ? `${precioTexto(precioFinal)} · Producto a pedido. Pedilo online o consultá por WhatsApp.`
    : `${precioTexto(precioFinal)} · Pedilo online · Envíos a El Bolsón y la Comarca.`;

  // Tarjeta con foto + nombre + PRECIO (1200x630, el formato que Facebook
  // muestra más grande). El precio va en la dirección de la imagen: Facebook
  // guarda las vistas previas varios días, y si el precio cambia, la imagen
  // cambia de dirección y Facebook trae la nueva.
  const version = `${Math.round(Number(precioFinal || 0))}-${String(producto.actualizado_en || "").slice(0, 16)}`;
  const imagenes = [
    {
      url: `https://www.bolsonclick.com.ar/api/tarjeta/${producto.id}?v=${encodeURIComponent(version)}`,
      width: 1200,
      height: 630,
      type: "image/png",
      alt: `${producto.nombre} a ${precioTexto(precioFinal)}`
    },
    // La foto sola, cuadrada y liviana, por si alguna app la prefiere
    ...(producto.imagen_url
      ? [
          {
            url: `https://www.bolsonclick.com.ar/api/og-imagen/${producto.id}`,
            width: 600,
            height: 600,
            type: "image/jpeg",
            alt: producto.nombre
          }
        ]
      : [])
  ];

  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: `/${seccion}/${producto.id}` },
    openGraph: {
      title: `${producto.nombre} — ${precioTexto(precioFinal)}`,
      description: descripcion,
      url: `/${seccion}/${producto.id}`,
      siteName: "Bolson Click",
      locale: "es_AR",
      type: "website",
      images: imagenes
    },
    twitter: {
      // Imagen grande: la tarjeta con el precio
      card: "summary_large_image",
      title: `${producto.nombre} — ${precioTexto(precioFinal)}`,
      description: descripcion,
      images: imagenes.map((i) => i.url)
    }
  };
}
