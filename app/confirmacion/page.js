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
import { avisarAdmin, clienteActual } from "@/lib/avisarAdmin";
import PedirNotificaciones from "@/components/PedirNotificaciones";

// Un toque para que le avisemos de novedades. Es el mejor momento para
// pedirlo: acaba de comprar y está contento. Sin este permiso no se le
// pueden mandar ofertas.
function AceptarNovedades({ numero, telefono }) {
  const [estado, setEstado] = useState("pregunta"); // pregunta | listo | oculto
  useEffect(() => {
    try {
      if (localStorage.getItem("bolsonclick_novedades_ok") === "1") setEstado("oculto");
    } catch (e) {}
  }, []);
  if (estado === "oculto") return null;

  async function aceptar() {
    try {
      const { data } = await supabase.rpc("aceptar_novedades_pedido", {
        p_numero_pedido: numero,
        p_telefono: telefono
      });
      if (data) {
        try {
          localStorage.setItem("bolsonclick_novedades_ok", "1");
        } catch (e) {}
      }
    } catch (e) {}
    setEstado("listo");
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 mt-4 w-full max-w-xs text-left">
      {estado === "listo" ? (
        <p className="text-sm font-semibold text-green-700">✓ ¡Listo! Te avisamos cuando llegue algo nuevo.</p>
      ) : (
        <>
          <p className="text-sm font-bold text-gray-800">📲 ¿Te avisamos cuando llegue mercadería nueva?</p>
          <p className="text-[11.5px] text-gray-500 mt-0.5">
            Novedades y ofertas, sin llenarte de mensajes. Te das de baja cuando quieras.
          </p>
          <div className="flex gap-2 mt-2.5">
            <button
              type="button"
              onClick={aceptar}
              className="flex-1 bg-brand-blue text-white text-sm font-bold rounded-xl py-2"
            >
              Sí, avisame
            </button>
            <button
              type="button"
              onClick={() => setEstado("oculto")}
              className="px-3 text-sm text-gray-500 font-semibold"
            >
              No, gracias
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ConfirmacionContent() {
  const searchParams = useSearchParams();
  const numero = searchParams.get("numero");
  const esPendiente = searchParams.get("pendiente") === "1";
  const cuentaCreada = searchParams.get("cuenta") === "1";

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

      const { data: guardado, error: updateError } = await supabase.rpc(
        "subir_comprobante_pedido",
        { p_numero_pedido: numero, p_url: urlData.publicUrl }
      );

      if (updateError) throw new Error(updateError.message);

      const cliente = clienteActual();
      avisarAdmin({
        tipo: "comprobante",
        telefono: cliente?.telefono,
        nombre: cliente?.nombre,
        detalle: numero
      });

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
        <div className="text-6xl mb-4">{esPendiente ? "📡" : "✅"}</div>
        <h1 className="text-2xl font-extrabold text-gray-800">
          {esPendiente ? "¡Pedido guardado!" : "¡Pedido recibido!"}
        </h1>

        {esPendiente ? (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 mt-3 max-w-xs">
            <p className="text-sm text-amber-900 font-semibold">
              Estás sin señal, pero tu pedido está a salvo
            </p>
            <p className="text-xs text-amber-800 mt-1.5">
              Quedó guardado en tu celular y se va a enviar solo apenas vuelva
              internet. No hace falta que hagas nada: cuando llegue, te
              escribimos por WhatsApp para coordinar.
            </p>
            <p className="text-[11px] text-amber-700 mt-2">
              Anotá tu número de pedido por las dudas: <b>{numero}</b>
            </p>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mt-3 w-full max-w-xs text-left">
            <p className="text-sm font-bold text-green-900">¿Qué sigue?</p>
            <ol className="text-[12.5px] text-green-900 mt-1.5 space-y-1 list-none">
              <li>✅ Recibimos tu pedido.</li>
              <li>💬 Te escribimos por WhatsApp para confirmar stock, precio y {pedido?.metodo_entrega === "envio" ? "el envío" : "el retiro"}.</li>
              <li>💳 Recién ahí pagás. Ahora no tenés que hacer nada.</li>
            </ol>
          </div>
        )}

        {cuentaCreada && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mt-4 w-full max-w-xs">
            <p className="text-sm font-bold text-blue-900">✓ Ya tenés tu cuenta lista</p>
            <p className="text-xs text-blue-800 mt-1">
              Quedaste dentro de la app. Desde &quot;Cuenta&quot; podés ver este
              pedido y los que hagas más adelante, sin cargar tus datos de nuevo.
            </p>
            <Link
              href="/login"
              className="inline-block bg-brand-blue text-white text-xs font-bold px-3 py-2 rounded-xl mt-2"
            >
              Ver mi pedido →
            </Link>
          </div>
        )}

        {!esPendiente && numero && (pedido?.telefono_cliente || clienteActual()?.telefono) && (
          <AceptarNovedades numero={numero} telefono={pedido?.telefono_cliente || clienteActual()?.telefono} />
        )}

        <div className="w-full max-w-xs mt-5">
          <PedirNotificaciones
            telefono={pedido?.telefono_cliente || clienteActual()?.telefono}
            motivo="compra"
          />
        </div>

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
            <p className="text-sm font-bold text-gray-800 mb-1">📎 ¿Ya transferiste?</p>
            <p className="text-xs text-gray-500 mb-3">
              Cuando te confirmemos el pedido y pagues, podés subir el comprobante acá
              (o desde Mi cuenta). No hace falta hacerlo ahora.
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
