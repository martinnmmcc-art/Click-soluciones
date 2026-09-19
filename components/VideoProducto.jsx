"use client";

import { infoVideo } from "@/lib/video";

// Muestra el video de un producto DENTRO de la app, venga de donde venga:
// YouTube, Instagram, TikTok, Facebook, Vimeo o un archivo subido.
// Si el link no se puede reproducir acá adentro, no se muestra nada
// (nunca manda al cliente afuera de la tienda).
export default function VideoProducto({ url, titulo = "Video del producto", compacto = false }) {
  const info = infoVideo(url);
  if (!info || info.tipo === "invalido") return null;

  const borde = compacto ? "rounded-lg" : "rounded-2xl border border-gray-100";

  if (info.tipo === "archivo") {
    return (
      <video
        src={info.src}
        controls
        playsInline
        preload="metadata"
        className={`w-full bg-black ${borde} ${compacto ? "max-h-52" : ""}`}
      />
    );
  }

  // Instagram necesita alto fijo (muestra la cuenta arriba del video);
  // el resto usa la proporción del video: vertical 9:16 u horizontal 16:9.
  const estilo = info.alto ? { height: compacto ? Math.round(info.alto * 0.7) : info.alto } : undefined;
  const proporcion = info.alto
    ? ""
    : info.vertical
      ? `aspect-[9/16] ${compacto ? "max-h-72" : "max-h-[75vh]"} mx-auto`
      : "aspect-video";

  return (
    <div className={`w-full overflow-hidden bg-black ${borde}`}>
      <iframe
        src={info.src}
        title={titulo}
        className={`w-full block ${proporcion}`}
        style={estilo}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        loading="lazy"
        scrolling="no"
        frameBorder="0"
      />
    </div>
  );
}
