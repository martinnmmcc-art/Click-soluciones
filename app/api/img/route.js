export const dynamic = "force-dynamic";

import { taparMarcaProveedor } from "@/lib/taparMarca";
import { agregarMarcaDeAgua, yaTieneMarcaDeAgua } from "@/lib/marcaDeAgua";

// Trae una foto de producto desde el sitio del proveedor y la devuelve desde
// nuestro dominio. Sirve para dos cosas: no dejar a la vista de dónde
// compramos, y poder usar la foto para armar placas de promoción (el
// navegador no permite dibujar imágenes de otros sitios).
//
// Pensada para que una caída del proveedor NO nos afecte:
//  - Las fotos quedan guardadas un mes en la red de Vercel (s-maxage), así
//    que aunque el proveedor se caiga, las ya vistas se siguen mostrando.
//  - Si el proveedor no responde o devuelve su página de mantenimiento en
//    vez de la foto, mostramos un marcador neutro en lugar de una imagen
//    rota. Ese marcador se guarda pocos minutos, así se reintenta pronto.
//  - De fondo, el panel copia las fotos a nuestro propio servidor: las
//    copiadas ya no pasan por acá.

const DOMINIOS_PERMITIDOS = [
  "nextcell.com.ar",
  "mzstore.com.ar",
  "supabase.co",
  "supabase.in",
  "mitiendanube.com",
  "tiendanube.com",
  "gstatic.com",
  "googleusercontent.com",
  "mlstatic.com",
  "cloudinary.com",
  "imgur.com",
  "wixstatic.com",
  "shopify.com",
  "cdn.shopify.com"
];

const MARCADOR = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
<rect width="400" height="400" fill="#F3F4F6"/>
<text x="200" y="195" font-size="64" text-anchor="middle">📦</text>
<text x="200" y="250" font-size="20" fill="#9CA3AF" text-anchor="middle" font-family="sans-serif">Foto en camino</text>
</svg>`;

function marcadorSvg() {
  return new Response(MARCADOR, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      // Poco tiempo: apenas el proveedor vuelva, se muestra la foto real
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Access-Control-Allow-Origin": "*"
    }
  });
}

// Con ?f=jpg la foto sale en JPG. Es para el catálogo de Meta (Facebook,
// Instagram, WhatsApp), que no acepta WebP ni SVG. En ese modo, si la foto
// no se puede traer, se responde un error y no el marcador "Foto en camino":
// así Meta reintenta más tarde en vez de publicar el marcador como foto.
function sinFoto(enJpg) {
  if (!enJpg) return marcadorSvg();
  return new Response("Foto no disponible", { status: 503, headers: { "Retry-After": "3600" } });
}

async function aJpg(bytes) {
  const sharp = (await import("sharp")).default;
  return sharp(bytes).flatten({ background: "#ffffff" }).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("u") || searchParams.get("url");
  const enJpg = searchParams.get("f") === "jpg";
  const marcador = () => sinFoto(enJpg);

  if (!url) return marcador();

  let destino;
  try {
    destino = new URL(url);
  } catch (e) {
    return marcador();
  }

  // Solo los sitios que usamos: si no, cualquiera podría usar nuestro
  // servidor para descargar cualquier cosa.
  const permitido = DOMINIOS_PERMITIDOS.some((d) => destino.hostname.endsWith(d));
  if (!permitido || destino.protocol !== "https:") {
    return new Response("Origen no permitido", { status: 403 });
  }

  try {
    const res = await fetch(destino.toString(), {
      headers: { "User-Agent": "BolsonClick/1.0" },
      signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined
    });

    if (!res.ok) return marcador();

    // En mantenimiento el proveedor puede devolver su página en vez de la foto
    const tipo = res.headers.get("content-type") || "";
    if (!tipo.startsWith("image/")) return marcador();

    // Si la foto trae la franja con la marca del proveedor, sale con la
    // nuestra encima (ver lib/taparMarca.js)
    const original = Buffer.from(await res.arrayBuffer());
    let { bytes, tipo: tipoFinal } = await taparMarcaProveedor(original, tipo);
    // Nuestra marca de agua, salvo que la foto ya la tenga
    if (!yaTieneMarcaDeAgua(destino.pathname)) {
      ({ bytes, tipo: tipoFinal } = await agregarMarcaDeAgua(bytes, tipoFinal || tipo));
    }
    if (enJpg) {
      bytes = await aJpg(bytes);
      tipoFinal = "image/jpeg";
    }

    return new Response(bytes, {
      headers: {
        "Content-Type": tipoFinal || tipo,
        // Un mes en el navegador Y en la red de Vercel: si el proveedor se
        // cae, las fotos ya vistas se siguen sirviendo desde Vercel.
        "Cache-Control":
          "public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=604800, stale-if-error=2592000, immutable",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (err) {
    return marcador();
  }
}
