// Todo lo que tiene que ver con los videos de los productos.
//
// Se puede cargar el link de cualquiera de estas redes, tal cual se copia
// del celular (botón "Compartir" → "Copiar link"):
//   YouTube (videos y Shorts), Instagram (reels y posts), TikTok,
//   Facebook (videos, reels y fb.watch), Vimeo y X/Twitter.
// También un video subido desde el celular (archivo .mp4, .webm, .mov).
//
// Al guardar, el link se convierte al formato que se puede mostrar dentro
// de la ficha del producto ("embed").

// Links cortos que hay que "abrir" primero para saber a qué video apuntan
const LINKS_CORTOS = /^(https?:\/\/)?(vm\.tiktok\.com|vt\.tiktok\.com|www\.tiktok\.com\/t\/|tiktok\.com\/t\/|fb\.watch|m\.facebook\.com\/share|www\.facebook\.com\/share|facebook\.com\/share)/i;

export function esLinkCorto(url) {
  return LINKS_CORTOS.test(String(url || "").trim());
}

// Convierte el link que pegás al formato para incrustar
export function normalizarVideoUrl(url) {
  if (!url) return "";
  let u = String(url).trim();
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;

  // YouTube (normal, Shorts, youtu.be, ya incrustado)
  const yt = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/i);
  if (yt) {
    const esShort = /youtube\.com\/shorts\//i.test(u);
    return `https://www.youtube.com/embed/${yt[1]}${esShort ? "?vertical=1" : ""}`;
  }

  // Instagram (reel, reels, post, tv)
  const ig = u.match(/instagram\.com\/(?:[\w.]+\/)?(?:p|reel|reels|tv)\/([\w-]+)/i);
  if (ig) return `https://www.instagram.com/p/${ig[1]}/embed/`;

  // TikTok
  const tt = u.match(/tiktok\.com\/(?:@[\w.-]+\/video|embed\/v2|embed|v)\/(\d+)/i);
  if (tt) return `https://www.tiktok.com/embed/v2/${tt[1]}`;

  // Vimeo
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;

  // X / Twitter
  const tw = u.match(/(?:twitter|x)\.com\/[\w]+\/status\/(\d+)/i);
  if (tw) return `https://platform.twitter.com/embed/Tweet.html?id=${tw[1]}`;

  // Facebook (videos, watch, reels). Ya incrustado: se deja como está.
  if (/facebook\.com\/plugins\/video\.php/i.test(u)) return u;
  if (/facebook\.com\/(?:.*\/)?(?:videos\/|watch|reel\/)/i.test(u) || /fb\.watch\//i.test(u)) {
    const limpio = u.replace("m.facebook.com", "www.facebook.com");
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(limpio)}&show_text=false`;
  }

  return u;
}

// Qué tipo de video es, para saber cómo mostrarlo
export function infoVideo(url) {
  const u = String(url || "");
  if (!u) return null;

  if (/youtube\.com\/embed\//i.test(u)) {
    return { tipo: "iframe", red: "YouTube", vertical: /vertical=1/.test(u), src: u.replace(/[?&]vertical=1/, "") };
  }
  if (/instagram\.com\/p\/[\w-]+\/embed/i.test(u)) return { tipo: "iframe", red: "Instagram", vertical: true, src: u, alto: 620 };
  if (/tiktok\.com\/embed/i.test(u)) return { tipo: "iframe", red: "TikTok", vertical: true, src: u, alto: 740 };
  if (/player\.vimeo\.com/i.test(u)) return { tipo: "iframe", red: "Vimeo", vertical: false, src: u };
  if (/facebook\.com\/plugins\/video\.php/i.test(u)) {
    const vertical = /\/reel\//i.test(decodeURIComponent(u));
    return { tipo: "iframe", red: "Facebook", vertical, src: u };
  }
  if (/platform\.twitter\.com\/embed/i.test(u)) return { tipo: "iframe", red: "X", vertical: false, src: u, alto: 560 };

  // Archivo de video directo (el que se sube desde el celular)
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(u) || /\/storage\/v1\/object\/public\//i.test(u)) {
    return { tipo: "archivo", red: "Video", src: u };
  }

  // Cualquier otro link: se muestra un botón para abrirlo
  let red = "el link";
  try {
    red = new URL(u).hostname.replace(/^www\./, "");
  } catch {}
  return { tipo: "link", red, src: u };
}

// Solo los archivos directos se pueden reproducir solos en las listas
export function esArchivoDeVideo(url) {
  return infoVideo(url)?.tipo === "archivo";
}
