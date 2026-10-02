"use client";

import { useEffect, useState } from "react";
import { useAdmin } from "@/context/AdminContext";
import { NEGOCIO as CFG } from "@/lib/config";
import { textoRespuesta, linkProducto, urlTarjeta } from "@/lib/respuestaPrecio";

// Para contestar "¿qué precio tiene?" en Facebook sin sacar capturas.
// Solo lo ve el administrador.
//
// "Responder en Facebook" copia la respuesta y abre las notificaciones de
// Facebook (ahí está "X comentó tu publicación": un toque y estás en el
// comentario). Facebook no deja abrir un comentario puntual desde afuera:
// las notificaciones son lo más directo posible.

const NOTIFICACIONES_FB = "https://www.facebook.com/notifications";

export default function ResponderPrecio({ producto }) {
  const { isAdmin } = useAdmin();
  const [archivo, setArchivo] = useState(null);
  const [aviso, setAviso] = useState("");

  // La tarjeta como archivo, preparada de antemano: si se arma recién al
  // tocar, el celular bloquea el menú de compartir.
  useEffect(() => {
    if (!isAdmin || !producto?.id) return;
    let cancelado = false;
    setArchivo(null);
    fetch(urlTarjeta(producto))
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => {
        if (!cancelado && b) {
          const nombre = `bolsonclick-${String(producto.nombre || producto.id)
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .slice(0, 40)}.png`;
          setArchivo(new File([b], nombre, { type: "image/png" }));
        }
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [isAdmin, producto?.id, producto?.precio, producto?.precio_oferta]);

  if (!isAdmin || !producto) return null;

  function avisar(texto) {
    setAviso(texto);
    setTimeout(() => setAviso(""), 7000);
  }

  // Copia y abre, todo en el mismo toque: si se espera a que termine de
  // copiar, el celular ya no deja abrir otra app.
  function copiarYAbrir(texto, destino) {
    try {
      navigator.clipboard?.writeText(texto).catch(() => {});
    } catch (e) {}
    window.open(destino, "_blank", "noopener");
  }

  function responderEnFacebook() {
    copiarYAbrir(textoRespuesta(producto, "fb"), NOTIFICACIONES_FB);
    avisar(
      "✓ Respuesta copiada. En Facebook tocá la notificación del comentario → Responder → mantené apretado → Pegar."
    );
  }

  function copiarSoloLink() {
    const link = linkProducto(producto, "fb");
    navigator.clipboard
      ?.writeText(link)
      .then(() => avisar("✓ Link copiado."))
      .catch(() => window.prompt("Copiá este link:", link));
  }

  function descargar() {
    if (!archivo) return;
    const url = URL.createObjectURL(archivo);
    const a = document.createElement("a");
    a.href = url;
    a.download = archivo.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    avisar("✓ Tarjeta descargada: la tenés en la galería o en Descargas.");
  }

  // Para mensajes privados: la tarjeta como imagen + la respuesta copiada
  function compartir() {
    if (!archivo) return;
    try {
      navigator.clipboard?.writeText(textoRespuesta(producto, "wa")).catch(() => {});
    } catch (e) {}
    if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
      navigator
        .share({ files: [archivo] })
        .then(() => avisar("✓ Tarjeta enviada. La respuesta quedó copiada: pegala abajo de la imagen."))
        .catch((e) => {
          if (e?.name === "AbortError") return;
          // No lo dejamos en silencio: la descargamos para mandarla a mano
          descargar();
        });
      return;
    }
    descargar();
  }

  return (
    <div className="mt-4 rounded-2xl border-2 border-[#1877F2]/40 bg-white p-4">
      <p className="text-sm font-extrabold text-gray-800">💬 Responder consulta de precio</p>
      <p className="text-[11px] text-gray-500 mt-0.5 mb-3">
        Al pegar la respuesta en el comentario, Facebook muestra esta tarjeta, y al tocarla el cliente va
        directo a este producto.
      </p>

      <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
        <img src={urlTarjeta(producto)} alt="Tarjeta con foto y precio" className="w-full h-auto block" loading="lazy" />
      </div>

      <button
        onClick={responderEnFacebook}
        className="w-full bg-[#1877F2] text-white text-sm font-bold py-3.5 rounded-xl mt-3"
      >
        💬 Responder en Facebook
        <span className="block text-[11px] font-semibold opacity-90">copia la respuesta y abre Facebook</span>
      </button>

      <div className="grid grid-cols-2 gap-2 mt-2">
        <button
          onClick={descargar}
          disabled={!archivo}
          className="bg-white border border-gray-200 text-gray-700 text-xs font-bold py-2.5 rounded-xl disabled:opacity-50"
        >
          {archivo ? "⬇️ Descargar tarjeta" : "Preparando..."}
        </button>
        <button
          onClick={compartir}
          disabled={!archivo}
          className="bg-white border border-gray-200 text-gray-700 text-xs font-bold py-2.5 rounded-xl disabled:opacity-50"
        >
          {archivo ? "📲 Mandar por privado" : "Preparando..."}
        </button>
        <button
          onClick={copiarSoloLink}
          className="bg-white border border-gray-200 text-gray-700 text-xs font-bold py-2.5 rounded-xl"
        >
          🔗 Solo el link
        </button>
        <button
          onClick={() => copiarYAbrir(textoRespuesta(producto, "fb"), CFG.facebook)}
          className="bg-white border border-gray-200 text-gray-700 text-xs font-bold py-2.5 rounded-xl"
        >
          📘 Abrir mi página
        </button>
      </div>

      {aviso && (
        <p
          className={`text-[11px] font-semibold rounded-lg p-2 mt-2 ${
            aviso.startsWith("✓") ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-900"
          }`}
        >
          {aviso}
        </p>
      )}
    </div>
  );
}
