"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import { supabase } from "@/lib/supabaseClient";
import {
  buildWhatsAppLink,
  whatsappOrderMessage,
  formatPrice
} from "@/lib/whatsapp";

function ConfirmacionContent() {
  const searchParams = useSearchParams();
  const numero = searchParams.get("numero");

  const [pedido, setPedido] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [comprobanteUrl, setComprobanteUrl] = useState(null);
  const [errorSubida, setErrorSubida] = useState("");

  useEffect(() => {
    async function fetchPedido() {
      if (!numero) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/pedidos?numero=${encodeURIComponent(numero)}`);
        const result = await res.json();
        if (!res.ok) throw new Error(result.error);
        setPedido(result.pedido);
        setComprobanteUrl(result.pedido?.comprobante_url || null);
      } catch (e) {
        console.error(e.message);
      }
      setLoading(false);
    }
    fetchPedido();
  }, [numero]);

  async function handleSubirComprobante(e) {
    const archivo = e.target.files?.[0];
    if (!archivo || !numero) return;

    setSubiendo(true);
    setErrorSubida("");
    try {
      const extension = archivo.name.split(".").pop();
      const rutaArchivo = `${numero}-${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("comprobantes")
        .upload(rutaArchivo, archivo);

      if (uploadError) throw new Error(uploadError.message);

      const { data: urlData } = supabase.storage
        .from("comprobantes")
        .getPublicUrl(rutaArchivo);

      const { error: updateError } = await supabase
        .from("pedidos")
        .update({ comprobante_url: urlData.publicUrl })
        .eq("numero_pedido", numero);

      if (updateError) throw new Error(updateError.message);

      setComprobanteUrl(urlData.publicUrl);
    } catch (err) {
      setErrorSubida(err.message || "No se pudo subir el comprobante.");
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <main className="pb-6">
      <Header showSearch={false} />
      <div className="px-4 mt-8 flex flex-col items-center text-center">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-2xl font-extrabold text-gray-800">
          ¡Pedido recibido!
        </h1>
        <p className="text-gray-500 mt-2 max-w-xs">
          Gracias por tu compra en Bolson Click. Nos pondremos en contacto
          para coordinar {pedido?.metodo_entrega === "envio" ? "el envío" : "el retiro"}.
        </p>

        {loading ? (
          <p className="text-gray-400 text-sm mt-6">Cargando datos del pedido...</p>
        ) : numero ? (
          <div className="card p-5 mt-6 w-full max-w-xs">
            <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">
              Número de pedido
            </p>
            <p className="text-lg font-extrabold text-brand-blueDark mt-1">
              {numero}
            </p>
            {pedido && (
              <p className="text-sm text-gray-600 mt-2">
                Total: <strong>${formatPrice(pedido.total)}</strong>
              </p>
            )}
          </div>
        ) : null}

        {pedido?.metodo_pago === "transferencia" && (
          <div className="card p-4 mt-4 w-full max-w-xs">
            <p className="text-sm font-bold text-gray-800 mb-1">📎 Subí tu comprobante</p>
            <p className="text-xs text-gray-500 mb-3">
              Así confirmamos tu pago más rápido, sin esperar el WhatsApp.
            </p>

            {comprobanteUrl ? (
              <div className="text-center">
                <img
                  src={comprobanteUrl}
                  alt="Comprobante"
                  className="w-full max-h-40 object-contain rounded-xl border border-gray-200 mb-2"
                />
                <p className="text-xs text-green-700 font-semibold">✓ Comprobante recibido</p>
                <label className="text-xs text-brand-blue font-medium mt-1 inline-block cursor-pointer">
                  Cambiar imagen
                  <input type="file" accept="image/*" onChange={handleSubirComprobante} className="hidden" />
                </label>
              </div>
            ) : (
              <label className="btn-secondary w-full text-center cursor-pointer block">
                {subiendo ? "Subiendo..." : "📷 Elegir foto del comprobante"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleSubirComprobante}
                  disabled={subiendo}
                  className="hidden"
                />
              </label>
            )}

            {errorSubida && (
              <p className="text-xs text-red-600 font-medium mt-2">{errorSubida}</p>
            )}
          </div>
        )}

        <a
          href={buildWhatsAppLink(
            whatsappOrderMessage(pedido || { numero_pedido: numero, total: 0 })
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-accent w-full max-w-xs mt-5 text-center"
        >
          💬 Avisar por WhatsApp
        </a>

        <Link href="/" className="btn-secondary w-full max-w-xs mt-3 text-center">
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}

export default function ConfirmacionPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-gray-400">Cargando...</div>}>
      <ConfirmacionContent />
    </Suspense>
  );
}
