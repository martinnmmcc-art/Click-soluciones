import sharp from "sharp";

// Devuelve la foto de un producto achicada a JPG liviano (600x600, < 100 KB).
// WhatsApp solo muestra la foto en la vista previa del link si la imagen
// pesa menos de ~300 KB, y las fotos del proveedor suelen ser PNG pesados.
// Esta ruta es la que usa la vista previa (og:image) de cada producto.

export const runtime = "nodejs";
export const revalidate = 86400;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function urlDeImagen(id) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/Productos?id=eq.${encodeURIComponent(id)}&select=imagen_url`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, next: { revalidate: 600 } }
  );
  if (!res.ok) return null;
  const filas = await res.json();
  return filas?.[0]?.imagen_url || null;
}

export async function GET(_req, { params }) {
  try {
    const original = await urlDeImagen(params.id);
    if (!original) return new Response("Sin imagen", { status: 404 });

    const res = await fetch(original, { next: { revalidate: 86400 } });
    if (!res.ok) return Response.redirect(original, 302);

    const buffer = Buffer.from(await res.arrayBuffer());
    const jpg = await sharp(buffer)
      .resize(600, 600, { fit: "contain", background: "#ffffff" })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer();

    return new Response(jpg, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"
      }
    });
  } catch {
    return new Response("Error", { status: 500 });
  }
}
