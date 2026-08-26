export const dynamic = "force-dynamic";

// Trae una foto de producto desde el sitio del proveedor y la devuelve desde
// nuestro dominio. Hace falta porque el navegador no permite usar imágenes de
// otros sitios para armar una placa nueva (por seguridad), y sin esto la
// promoción saldría con el espacio de la foto en blanco.

// Sitios desde donde aceptamos traer fotos de productos. Si falta uno, las
// promociones de esos productos salen sin imagen.
const DOMINIOS_PERMITIDOS = [
  "nextcell.com.ar",
  "mzstore.com.ar",
  "supabase.co",
  "supabase.in",
  // Tiendanube: varios productos propios tienen las fotos alojadas ahí
  "mitiendanube.com",
  "tiendanube.com",
  // Imágenes que vienen de búsquedas de Google
  "gstatic.com",
  "googleusercontent.com",
  // Plataformas habituales de fotos de productos
  "mlstatic.com",
  "cloudinary.com",
  "imgur.com",
  "wixstatic.com",
  "shopify.com",
  "cdn.shopify.com"
];

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return new Response("Falta la dirección de la imagen", { status: 400 });
  }

  let destino;
  try {
    destino = new URL(url);
  } catch (e) {
    return new Response("Dirección inválida", { status: 400 });
  }

  // Solo dejamos pasar los sitios que usamos: si no, cualquiera podría usar
  // nuestro servidor para descargar cosas de cualquier lado.
  const permitido = DOMINIOS_PERMITIDOS.some((d) => destino.hostname.endsWith(d));
  if (!permitido || destino.protocol !== "https:") {
    return new Response("Origen no permitido", { status: 403 });
  }

  try {
    const res = await fetch(destino.toString(), {
      headers: { "User-Agent": "BolsonClick/1.0" }
    });

    if (!res.ok) {
      return new Response("No se pudo traer la imagen", { status: 502 });
    }

    const tipo = res.headers.get("content-type") || "";
    if (!tipo.startsWith("image/")) {
      return new Response("El enlace no es una imagen", { status: 400 });
    }

    const buffer = await res.arrayBuffer();

    return new Response(buffer, {
      headers: {
        "Content-Type": tipo,
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (err) {
    return new Response("Error al traer la imagen", { status: 500 });
  }
}
