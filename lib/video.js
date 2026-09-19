// Todo lo que tiene que ver con los videos de los productos.
//
// Los videos se reproducen SIEMPRE dentro de la app, nunca mandan afuera.
// Se puede cargar el link de cualquiera de estas redes, tal cual se copia
// del celular (botón "Compartir" → "Copiar link"):
//   YouTube (videos y Shorts), Instagram (reels y posts), TikTok,
//   Facebook (videos, reels, fb.watch y links "share"), Vimeo.
// También un video subido desde el celular (archivo .mp4, .webm, .mov).
//
// Al cargarlo, el link se convierte al reproductor de cada red ("embed"),
// que se muestra dentro de la ficha del producto.

// Links que no dicen qué video es: hay que abrirlos primero en el servidor
const LINKS_CORTOS =
  /^(https?:\/\/)?(vm\.tiktok\.com|vt\.tiktok\.com|(www\.)?tiktok\.com\/t\/|fb\.watch|(m\.|www\.|web\.)?facebook\.com\/share\/)/i;

export function esLinkCorto(url) {
  return LINKS_CORTOS.test(String(url || "").trim());
}

// Convierte el link que pegás al reproductor para incrustar
export function normalizarVideoUrl(url) {
  if (!url) return "";
  let u = String(url).trim();
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;

  // YouTube (normal, Shorts, youtu.be, en vivo, ya incrustado)
  const yt = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/i);
  if (yt) {
    const vertical = /youtube\.com\/shorts\//i.test(u) || /vertical=1/.test(u);
    return `https://www.youtube.com/embed/${yt[1]}?playsinline=1&rel=0&modestbranding=1${vertical ? "&vertical=1" : ""}`;
  }

  // Instagram (reel, reels, post, tv)
  const ig = u.match(/instagram\.com\/(?:[\w.]+\/)?(?:p|reel|reels|tv)\/([\w-]+)/i);
  if (ig) return `https://www.instagram.com/p/${ig[1]}/embed/`;

  // TikTok: reproductor limpio, sin links hacia TikTok
  const tt = u.match(/tiktok\.com\/(?:@[\w.-]+\/video|embed\/v2|embed|player\/v1|v)\/(\d+)/i);
  if (tt) {
    return `https://www.tiktok.com/player/v1/${tt[1]}?music_info=0&description=0&rel=0&native_context_menu=0&controls=1&progress_bar=1&play_button=1&volume_control=1&fullscreen_button=1`;
  }

  // Vimeo
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}?playsinline=1`;

  // Facebook: cualquier link de facebook va al reproductor de Facebook
  if (/facebook\.com\/plugins\/video\.php/i.test(u)) return u;
  if (/(facebook\.com|fb\.watch)\//i.test(u)) {
    const limpio = u.replace(/\/\/(m|web)\.facebook\.com/i, "//www.facebook.com");
    const vertical = /\/reel\//i.test(limpio);
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(limpio)}&show_text=false&width=560${
      vertical ? "&vertical=1" : ""
    }`;
  }

  return u;
}

// Qué tipo de video es, para saber cómo mostrarlo.
// tipo: "iframe" (reproductor de la red), "archivo" (video subido) o
// "invalido" (un link que no se puede reproducir dentro de la app).
export function infoVideo(url) {
  const u = String(url || "");
  if (!u) return null;

  if (/youtube\.com\/embed\//i.test(u)) {
    return { tipo: "iframe", red: "YouTube", vertical: /vertical=1/.test(u), src: u.replace(/&vertical=1/, "") };
  }
  if (/instagram\.com\/p\/[\w-]+\/embed/i.test(u)) {
    return { tipo: "iframe", red: "Instagram", vertical: true, src: u, alto: 600 };
  }
  if (/tiktok\.com\/player\/v1\//i.test(u)) return { tipo: "iframe", red: "TikTok", vertical: true, src: u };
  if (/tiktok\.com\/embed/i.test(u)) {
    // Links viejos: se pasan al reproductor limpio
    return infoVideo(normalizarVideoUrl(u));
  }
  if (/player\.vimeo\.com/i.test(u)) return { tipo: "iframe", red: "Vimeo", vertical: false, src: u };
  if (/facebook\.com\/plugins\/video\.php/i.test(u)) {
    return { tipo: "iframe", red: "Facebook", vertical: /vertical=1/.test(u), src: u.replace(/&vertical=1/, "") };
  }

  // Archivo de video directo (el que se sube desde el celular)
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(u) || /\/storage\/v1\/object\/public\//i.test(u)) {
    return { tipo: "archivo", red: "Video", src: u };
  }

  // Cualquier otro link o una red conocida sin normalizar: se intenta convertir
  const convertido = normalizarVideoUrl(u);
  if (convertido !== u) return infoVideo(convertido);

  return { tipo: "invalido", src: u };
}

// Solo los archivos directos se pueden reproducir solos en las listas
export function esArchivoDeVideo(url) {
  return infoVideo(url)?.tipo === "archivo";
}
