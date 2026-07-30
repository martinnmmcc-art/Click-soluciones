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

  useEffect(() => {
    async function fetchPedido() {
      if (!numero) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("pedidos")
        .select("*")
        .eq("numero_pedido", numero)
        .maybeSingle();

      if (error) console.error(error.message);
      setPedido(data);
      setLoading(false);
    }
    fetchPedido();
  }, [numero]);

  return (
    <main className="pb-6">
      <Header showSearch={false} />
      <div className="px-4 mt-8 flex flex-col items-center text-center">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-2xl font-extrabold text-gray-800">
          ¡Pedido recibido!
        </h1>
        <p className="text-gray-500 mt-2 max-w-xs">
          Gracias por tu compra en Clic Soluciones. Nos pondremos en contacto
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
