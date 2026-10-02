"use client";

import { useEffect, useRef, useState } from "react";
import { formatPrice } from "@/lib/whatsapp";
import { datosComprobante, dibujarComprobante } from "@/lib/comprobanteImagen";

export default function ComprobantePedido({ pedido, onClose }) {
  const canvasRef = useRef(null);
  const [imagenLista, setImagenLista] = useState(false);
  const [generando, setGenerando] = useState(true);
  // La imagen ya convertida en archivo, lista para compartir. Se prepara
  // apenas se dibuja: si se convierte recién al tocar "Enviar", el celular
  // considera que el menú de compartir no lo pidió el usuario y lo bloquea.
  const [archivo, setArchivo] = useState(null);
  const [aviso, setAviso] = useState("");

  // Venta cobrada: comprobante de compra. Con saldo pendiente: presupuesto.
  const {
    pagadoTotal, saldoTotal, esVentaPagada, tituloDocumento, nombreArchivo,
    nombreCliente, telefonoCliente, mensajeCliente
  } = datosComprobante(pedido);

  useEffect(() => {
    dibujar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function dibujar() {
    const canvas = canvasRef.current;
    await dibujarComprobante(canvas, pedido);
    setGenerando(false);

    // Dejamos el archivo listo ya, antes de que toquen "Enviar"
    canvas.toBlob((blob) => {
      if (blob) setArchivo(new File([blob], nombreArchivo, { type: "image/png" }));
      setImagenLista(true);
    }, "image/png");
  }


  function descargar() {
    const canvas = canvasRef.current;
    const link = document.createElement("a");
    link.download = nombreArchivo;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  // Abre el chat de WhatsApp de ESTE cliente, con el mensaje ya escrito.
  // WhatsApp no deja adjuntar una imagen desde un enlace: en la PC la
  // descargamos para que la arrastres al chat.
  function abrirChatCliente(conDescarga = false) {
    if (conDescarga) descargar();
    const destino = telefonoCliente ? `https://wa.me/549${telefonoCliente}` : "https://wa.me/";
    window.open(`${destino}?text=${encodeURIComponent(mensajeCliente)}`, "_blank", "noopener");
  }

  // Menú de compartir del celular con la imagen y el mensaje: elegís
  // WhatsApp y el chat del cliente. Se llama sin ninguna espera antes, para
  // que el celular lo reconozca como un toque tuyo.
  function compartir() {
    setAviso("");
    if (archivo && navigator.canShare && navigator.canShare({ files: [archivo] })) {
      // El mensaje va copiado aparte: si se manda la imagen JUNTO con texto,
      // muchas versiones de WhatsApp en Android se quedan solo con el texto
      // y descartan la imagen.
      try {
        navigator.clipboard?.writeText(mensajeCliente).catch(() => {});
      } catch (e) {}

      navigator
        .share({ files: [archivo] })
        .then(() =>
          setAviso("✓ Imagen enviada. El mensaje quedó copiado: si querés, pegalo en el chat.")
        )
        .catch((e) => {
          if (e?.name === "AbortError") return; // lo cerraste vos
          abrirChatCliente(true);
          setAviso(
            "Tu celular no dejó abrir el menú de compartir. Se descargó la imagen y se abrió el chat del cliente: adjuntala desde la galería."
          );
        });
      return;
    }
    // PC o navegador sin menú de compartir
    abrirChatCliente(true);
    setAviso("Se descargó la imagen y se abrió el chat del cliente: adjuntala con el clip 📎.");
  }


  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl p-4 max-w-md w-full">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-gray-800">Comprobante</h3>
          <button onClick={onClose} className="text-gray-400 text-xl leading-none px-2">
            ×
          </button>
        </div>

        <div className="border border-gray-100 rounded-xl overflow-hidden mb-4 max-h-[60vh] overflow-y-auto">
          {generando && (
            <p className="text-center text-sm text-gray-400 py-10">Generando comprobante...</p>
          )}
          <canvas ref={canvasRef} className={`w-full ${generando ? "hidden" : ""}`} />
        </div>

        {imagenLista && (
          <div className="space-y-2">
            <button
              onClick={compartir}
              className="w-full bg-[#25D366] text-white font-bold text-sm py-3 rounded-xl"
            >
              📲 Enviar {esVentaPagada ? "comprobante" : "presupuesto"}
              {nombreCliente ? ` a ${nombreCliente}` : ""}
            </button>

            <div className="flex gap-2">
              {telefonoCliente && (
                <button
                  onClick={() => abrirChatCliente(false)}
                  className="flex-1 bg-white border border-gray-200 text-gray-700 font-bold text-xs py-2.5 rounded-xl"
                >
                  💬 Solo mensaje
                </button>
              )}
              <button
                onClick={descargar}
                className="flex-1 bg-gray-100 text-gray-700 font-bold text-xs py-2.5 rounded-xl"
              >
                ⬇️ Descargar
              </button>
            </div>

            {aviso && (
              <p
                className={`text-[11px] rounded-lg p-2 ${
                  aviso.startsWith("✓") ? "text-green-800 bg-green-50" : "text-amber-800 bg-amber-50"
                }`}
              >
                {aviso}
              </p>
            )}

            <p className="text-[10px] text-gray-400 text-center">
              "Enviar" abre el menú del celular: elegí WhatsApp y el chat del cliente. Se manda la imagen, y el mensaje queda copiado para pegarlo.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
