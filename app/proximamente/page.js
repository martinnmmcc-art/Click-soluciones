"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { supabase } from "@/lib/supabaseClient";
import { urlImagen } from "@/lib/imagenProducto";

export default function ProximamentePage() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargar() {
      const { data } = await supabase
        .from("proximo_pedido")
        .select("*")
        .eq("visible", true)
        .order("orden", { ascending: true })
        .order("created_at", { ascending: false });
      setProductos(data || []);
      setLoading(false);
    }
    cargar();
  }, []);

  return (
    <main className="min-h-screen bg-brand-bg pb-16">
      <Header />

      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="text-center mb-6">
          <p className="text-4xl mb-2">🚚</p>
          <h1 className="text-2xl font-extrabold text-gray-800">
            Llega pronto
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Esto ya lo pedimos al proveedor. Todavía no tiene precio, pero
            podés avisarnos que te interesa para reservarlo apenas llegue.
          </p>
        </div>

        {loading ? (
          <p className="text-center text-gray-400 py-10">Cargando...</p>
        ) : productos.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
            <p className="text-sm text-gray-500">
              Por ahora no hay nada en camino. Mirá el{" "}
              <Link href="/catalogo" className="text-brand-blue font-semibold underline">
                catálogo
              </Link>{" "}
              para ver lo que ya tenemos.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {productos.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
              >
                <div className="relative w-full aspect-square bg-gray-50 flex items-center justify-center">
                  {p.imagen_url ? (
                    <img
                      src={urlImagen(p.imagen_url)}
                      alt={p.nombre}
                      className="w-full h-full object-contain p-2"
                    />
                  ) : (
                    <span className="text-3xl">📦</span>
                  )}

                  <span className="absolute top-2 left-2 bg-amber-500 text-white text-[10px] font-bold px-2 py-1 rounded-full">
                    🚚 Llega pronto
                  </span>
                </div>

                <div className="p-2.5">
                  <p className="text-xs font-bold text-gray-800 line-clamp-2 leading-tight">
                    {p.nombre}
                  </p>

                  {p.descripcion && (
                    <p className="text-[10px] text-gray-500 line-clamp-2 mt-1">
                      {p.descripcion}
                    </p>
                  )}

                  {p.fecha_estimada && (
                    <p className="text-[10px] text-amber-700 font-semibold mt-1">
                      Estimado: {new Date(p.fecha_estimada).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
                    </p>
                  )}

                  <a
                    href={`https://wa.me/5492944396888?text=${encodeURIComponent(
                      `¡Hola! Vi que vas a tener "${p.nombre}" y me interesa. ¿Me avisás cuando llegue?`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full bg-[#25D366] text-white text-[11px] font-bold py-2 rounded-lg text-center mt-2"
                  >
                    💬 Avisame cuando llegue
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
