// Abre un link de video que no dice directamente qué video es
// (vm.tiktok.com, fb.watch, facebook.com/share/v/..., etc.) y devuelve el
// link completo, para poder reproducirlo DENTRO de la app.
//
// Facebook no redirige igual a todos: se prueba primero como el robot de
// Facebook (que recibe la página con los datos del video) y después como
// un celular común. Se sigue cada redirección a mano y además se lee la
// página buscando el link real del video.

export const runtime = "nodejs";

const PERMITIDOS =
  /^(vm\.tiktok\.com|vt\.tiktok\.com|www\.tiktok\.com|tiktok\.com|m\.tiktok\.com|fb\.watch|m\.facebook\.com|www\.facebook\.com|facebook\.com|web\.facebook\.com|l\.facebook\.com)$/i;

const NAVEGADORES = [
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36"
];

// ¿Este link ya dice qué video es?
function esLinkFinal(u) {
  return (
    /tiktok\.com\/@[\w.-]+\/video\/\d+/i.test(u) ||
    /facebook\.com\/(?:[\w.]+\/videos\/|watch\/?\?v=|reel\/)\d+/i.test(u) ||
    /facebook\.com\/[\w.]+\/videos\/[\w.-]+\/\d+/i.test(u)
  );
}

// Busca el link real del video dentro del HTML de la página
function buscarEnHtml(html) {
  const decod = (s) =>
    s.replace(/\\\//g, "/").replace(/&amp;/g, "&").replace(/\\u0025/g, "%");

  const og = html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)/i);
  if (og && esLinkFinal(decod(og[1]))) return decod(og[1]);

  const canon = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i);
  if (canon && esLinkFinal(decod(canon[1]))) return decod(canon[1]);

  const reel = html.match(/facebook\.com\\?\/reel\\?\/(\d{6,})/i);
  if (reel) return `https://www.facebook.com/reel/${reel[1]}`;

  const vid = html.match(/"video_id":"(\d{6,})"/) || html.match(/videos\\?\/(\d{8,})/);
  if (vid) return `https://www.facebook.com/watch/?v=${vid[1]}`;

  const tt = html.match(/tiktok\.com\\?\/@([\w.-]+)\\?\/video\\?\/(\d+)/i);
  if (tt) return `https://www.tiktok.com/@${tt[1]}/video/${tt[2]}`;

  return null;
}

async function resolverCon(url, userAgent) {
  let actual = url;
  for (let salto = 0; salto < 6; salto++) {
    if (esLinkFinal(actual)) return actual;

    const res = await fetch(actual, {
      redirect: "manual",
      headers: { "User-Agent": userAgent, "Accept-Language": "es-AR,es;q=0.9" }
    });

    const destino = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && destino) {
      const siguiente = new URL(destino, actual).toString();
      // Si Facebook manda a iniciar sesión, el video viene en "next"
      const next = new URL(siguiente).searchParams.get("next");
      if (next && esLinkFinal(next)) return next;
      actual = siguiente;
      continue;
    }

    const html = await res.text();
    return buscarEnHtml(html);
  }
  return esLinkFinal(actual) ? actual : null;
}

export async function GET(req) {
  const url = new URL(req.url).searchParams.get("url") || "";
  let origen;
  try {
    origen = new URL(url.startsWith("http") ? url : "https://" + url);
  } catch {
    return Response.json({ url, resuelto: false }, { status: 400 });
  }
  if (!PERMITIDOS.test(origen.hostname)) {
    return Response.json({ url, resuelto: false }, { status: 400 });
  }

  for (const ua of NAVEGADORES) {
    try {
      const final = await resolverCon(origen.toString(), ua);
      if (final) return Response.json({ url: final, resuelto: true });
    } catch {}
  }
  return Response.json({ url: origen.toString(), resuelto: false });
}
