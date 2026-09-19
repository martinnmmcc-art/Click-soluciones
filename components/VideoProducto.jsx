"use client";

import { infoVideo } from "@/lib/video";

// Muestra el video de un producto, venga de donde venga:
// YouTube, Instagram, TikTok, Facebook, Vimeo, X o un archivo subido.
export default function VideoProducto({ url, titulo = "Video del producto", compacto = false }) {
  const info = infoVideo(url);
  if (!info) return null;

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

  if (info.tipo === "iframe") {
    // Instagram, TikTok y X necesitan un alto fijo porque muestran
    // también el nombre de la cuenta; el resto usa la proporción del video.
    const estilo = info.alto
      ? { height: compacto ? Math.round(info.alto * 0.7) : info.alto }
      : undefined;
    const proporcion = info.alto ? "" : info.vertical ? "aspect-[9/16] max-h-[80vh] mx-auto" : "aspect-video";

    return (
      <div className={`w-full overflow-hidden bg-white ${borde}`}>
        <iframe
          src={info.src}
          title={titulo}
          className={`w-full block ${proporcion}`}
          style={estilo}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
          scrolling="no"
          frameBorder="0"
        />
      </div>
    );
  }

  // Link de otra página: botón para abrirlo
  return (
    <a
      href={info.src}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center justify-center gap-2 w-full py-4 bg-gray-900 text-white font-bold text-sm ${borde}`}
    >
      ▶ Ver el video en {info.red}
    </a>
  );
}
