"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Header from "@/components/Header";
import { supabase } from "@/lib/supabaseClient";
import { formatPrice, buildWhatsAppLink } from "@/lib/whatsapp";

export default function APedidoDetallePage() {
  const params = useParams();
  const id = params?.id ? decodeURIComponent(params.id) : null;
  const router = useRouter();

  const [producto, setProducto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imagenPrincipal, setImagenPrincipal] = useState("");

  useEffect(() => {
    async function fetchProducto() {
      if (!id) return;
      setLoading(true);
      const { data } = await supabase
        .from("Productos")
        .select("*")
        .eq("id", id)
        .eq("bajo_pedido", true)
        .maybeSingle();

      if (data) {
        setProducto(data);
        setImagenPrincipal(data.imagen_url || "");
      }
      setLoading(false);
    }
    fetchProducto();
  }, [id]);

  if (loading) {
    return (
      <main>
        <Header showSearch={false} />
        <div className="text-center text-gray-400 py-16">Cargando producto...</div>
      </main>
    );
  }

  if (!producto) {
    return (
      <main>
        <Header showSearch={false} />
        <div className="text-center text-gray-500 py-16 px-4">
          <p className="text-lg font-semibold text-gray-800">No encontramos este producto a pedido.</p>
        </div>
      </main>
    );
  }

  const listaImagenes = [producto.imagen_url, producto.imagen_url_2, producto.imagen_url_3].filter(Boolean);

  const linkWhatsapp = buildWhatsAppLink(
    `Hola! 👋 Vi "${producto.nombre}" en la sección de productos a pedido de Bolson Click. ¿Me contás precio final y tiempo de entrega?`
  );

  return (
    <main className="pb-12">
      <Header showSearch={false} />

      <div className="max-w-2xl mx-auto px-4 mt-3">
        <button
          onClick={() => router.back()}
          className="text-sm font-semibold text-brand-blue flex items-center gap-1"
        >
          ← Volver
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-4">
        <div className="relative w-full aspect-square bg-gray-100 rounded-2xl overflow-hidden border border-gray-100 flex items-center justify-center">
          {imagenPrincipal ? (
            <img src={imagenPrincipal} alt={producto.nombre} className="w-full h-full object-cover" />
          ) : (
            <div className="text-6xl">📦</div>
          )}
          <span className="absolute top-3 left-3 bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full z-10">
            A PEDIDO
          </span>
        </div>

        {listaImagenes.length > 1 && (
          <div className="flex gap-3 mt-3 overflow-x-auto pb-2">
            {listaImagenes.map((img, index) => (
              <button
                key={index}
                onClick={() => setImagenPrincipal(img)}
                className={`w-16 h-16 rounded-xl overflow-hidden border-2 bg-gray-50 flex-shrink-0 transition ${
                  imagenPrincipal === img ? "border-purple-600 ring-2 ring-purple-100" : "border-gray-200"
                }`}
              >
                <img src={img} className="w-full h-full object-cover" alt="miniatura" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-6">
        <h1 className="text-2xl font-extrabold text-gray-800">{producto.nombre}</h1>

        {producto.precio && (
          <p className="text-2xl font-extrabold text-purple-700 mt-2">
            Aprox. ${formatPrice(producto.precio)}
          </p>
        )}

        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 mt-3">
          <p className="text-sm text-purple-800">
            Este producto no está en stock ahora, lo pedimos especialmente a nuestro proveedor. Consultanos por WhatsApp para confirmar precio final y tiempo de entrega.
          </p>
        </div>

        <a
          href={linkWhatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary block text-center mt-4"
        >
          💬 Consultar y pedir por WhatsApp
        </a>

        <div className="mt-8 border-t border-gray-100 pt-6 space-y-6">
          {producto.descripcion && (
            <div className="bg-gray-50 p-5 rounded-2xl">
              <h2 className="text-lg font-bold text-gray-900 mb-2">Descripción</h2>
              <p className="text-gray-700 whitespace-pre-line leading-relaxed">{producto.descripcion}</p>
            </div>
          )}

          {producto.caracteristicas && (
            <div className="bg-gray-50 p-5 rounded-2xl">
              <h2 className="text-lg font-bold text-gray-900 mb-2">Características</h2>
              <p className="text-gray-700 whitespace-pre-line leading-relaxed">{producto.caracteristicas}</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
