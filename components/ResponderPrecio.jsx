"use client";

import { useEffect, useState } from "react";
import { useAdmin } from "@/context/AdminContext";
import { textoRespuesta, linkProducto, urlTarjeta } from "@/lib/respuestaPrecio";

// Para contestar "¿qué precio tiene?" en Facebook sin sacar capturas.
// Solo lo ve el administrador.
//
// Se copia una respuesta con el link del producto. Al pegarla en el
// comentario, Facebook arma solo la tarjeta con la foto y el precio, y al
// tocarla el cliente va directo al producto.
export default function ResponderPrecio({ producto }) {
  const { isAdmin } = useAdmin();
  const [copiado, setCopiado] = useState("");
  const [archivo, setArchivo] = useState(null);

  // La tarjeta como imagen, preparada de antemano: si se arma recién al
  // tocar, el celular bloquea el menú de compartir.
  useEffect(() => {
    if (!isAdmin || !producto?.id) return;
    let cancelado = false;
    fetch(urlTarjeta(producto))
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => {
        if (!cancelado && b) setArchivo(new File([b], `bolsonclick-${producto.id}.png`, { type: "image/png" }));
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [isAdmin, producto?.id, producto?.precio, producto?.precio_oferta]);

  if (!isAdmin || !producto) return null;

  function copiar(texto, cual) {
    navigator.clipboard
      ?.writeText(texto)
      .then(() => {
        setCopiado(cual);
        setTimeout(() => setCopiado(""), 2500);
      })
      .catch(() => window.prompt("Copiá este texto:", texto));
  }

  // Para mensajes privados (WhatsApp, Messenger): la tarjeta como imagen,
  // y la respuesta copiada para pegarla abajo.
  function compartirTarjeta() {
    const texto = textoRespuesta(producto, "wa");
    try {
      navigator.clipboard?.writeText(texto).catch(() => {});
    } catch (e) {}
    if (archivo && navigator.canShare && navigator.canShare({ files: [archivo] })) {
      navigator
        .share({ files: [archivo] })
        .then(() => setCopiado("tarjeta"))
        .catch(() => {});
      return;
    }
    window.open(urlTarjeta(producto), "_blank");
  }

  return (
    <div className="mt-4 rounded-2xl border-2 border-[#1877F2]/40 bg-white p-4">
      <p className="text-sm font-extrabold text-gray-800">💬 Responder consulta de precio</p>
      <p className="text-[11px] text-gray-500 mt-0.5 mb-3">
        Pegá la respuesta en el comentario: Facebook muestra sola esta tarjeta, y al tocarla lleva al producto.
      </p>

      <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
        <img
          src={urlTarjeta(producto)}
          alt="Tarjeta con foto y precio"
          className="w-full h-auto block"
          loading="lazy"
        />
      </div>

      <button
        onClick={() => copiar(textoRespuesta(producto, "fb"), "respuesta")}
        className="w-full bg-[#1877F2] text-white text-sm font-bold py-3 rounded-xl mt-3"
      >
        {copiado === "respuesta" ? "✓ Copiada: pegala en el comentario" : "📋 Copiar respuesta para Facebook"}
      </button>

      <div className="flex gap-2 mt-2">
        <button
          onClick={() => copiar(linkProducto(producto, "fb"), "link")}
          className="flex-1 bg-white border border-gray-200 text-gray-700 text-xs font-bold py-2.5 rounded-xl"
        >
          {copiado === "link" ? "✓ Link copiado" : "🔗 Solo el link"}
        </button>
        <button
          onClick={compartirTarjeta}
          className="flex-1 bg-white border border-gray-200 text-gray-700 text-xs font-bold py-2.5 rounded-xl"
        >
          {copiado === "tarjeta" ? "✓ Enviada" : "📲 Mandar la tarjeta"}
        </button>
      </div>

      <p className="text-[10px] text-gray-400 mt-2">
        "Mandar la tarjeta" es para mensajes privados (WhatsApp, Messenger): va la imagen y la respuesta queda copiada.
      </p>
    </div>
  );
}
