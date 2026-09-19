// Abre un link corto de video (vm.tiktok.com, fb.watch, facebook.com/share...)
// y devuelve el link completo al que redirige, para poder incrustarlo.

export const runtime = "nodejs";

const PERMITIDOS = /^(vm\.tiktok\.com|vt\.tiktok\.com|www\.tiktok\.com|tiktok\.com|fb\.watch|m\.facebook\.com|www\.facebook\.com|facebook\.com)$/i;

export async function GET(req) {
  const url = new URL(req.url).searchParams.get("url") || "";
  let destino;
  try {
    destino = new URL(url.startsWith("http") ? url : "https://" + url);
  } catch {
    return Response.json({ url }, { status: 400 });
  }
  if (!PERMITIDOS.test(destino.hostname)) {
    return Response.json({ url }, { status: 400 });
  }

  try {
    const res = await fetch(destino.toString(), {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36"
      }
    });
    return Response.json({ url: res.url || url });
  } catch {
    return Response.json({ url });
  }
}
