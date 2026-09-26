"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { supabase } from "@/lib/supabaseClient";
import { urlImagen } from "@/lib/imagenProducto";

// Lo que viene en el próximo pedido al proveedor.
//
// Sin precio para ninguno, a propósito: el precio final se calcula recién
// cuando llega, con el costo y el flete reales. Mostrar el precio viejo de
// los que ya vendíamos prometería un número que puede cambiar, y mezclar
// productos con y sin precio confunde.
//
// El nombre siempre sale limpio: nunca el texto tal cual del proveedor,
// que delataría de dónde compramos.
export default function ProximamentePage() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargar() {
      const [{ data: enCamino }, { data: manuales }] = await Promise.all([
        supabase.rpc("productos_en_camino"),
        supabase
          .from("proximo_pedido")
          .select("id, nombre, imagen_url, fecha_estimada")
          .eq("visible", true)
          .order("created_at", { ascending: false })
      ]);

      const lista = [
        ...(enCamino || []).map((p) => ({
          key: `linea-${p.linea_id}`,
          nombre: p.nombre,
          imagen_url: p.imagen_url
        })),
        ...(manuales || []).map((m) => ({
          key: `manual-${m.id}`,
          nombre: m.nombre,
          imagen_url: m.imagen_url,
          fecha_estimada: m.fecha_estimada
        }))
      ];

      // Nunca mostramos el mismo producto dos veces, aunque se haya
      // cargado a mano y también venga en un pedido.
      const vistos = new Set();
      const sinRepetir = lista.filter((p) => {
        const clave = String(p.nombre || "").trim().toLowerCase();
        if (!clave || vistos.has(clave)) return false;
        vistos.add(clave);
        return true;
      });

      setProductos(sinRepetir);
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
          <h1 className="text-2xl font-extrabold text-gray-800">Llega pronto</h1>
          <p className="text-sm text-gray-500 mt-1">
            Esto ya lo pedimos al proveedor. Avisanos si te interesa y te lo
            reservamos apenas llegue, antes de que se agote.
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
          <>
            <p className="text-xs text-gray-500 text-center mb-3">
              {productos.length} productos en camino
            </p>

            <div className="grid grid-cols-2 gap-3">
              {productos.map((p) => (
                <div
                  key={p.key}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col"
                >
                  <div className="relative w-full aspect-square bg-gray-50 flex items-center justify-center">
                    {p.imagen_url ? (
                      <img
                        src={urlImagen(p.imagen_url)}
                        alt={p.nombre}
                        className="w-full h-full object-contain p-2"
                        loading="lazy"
                      />
                    ) : (
                      <div className="text-center">
                        <span className="text-4xl">📦</span>
                        <p className="text-[10px] text-gray-400 mt-1">Foto pronto</p>
                      </div>
                    )}

                    <span className="absolute top-2 left-2 bg-amber-500 text-white text-[10px] font-bold px-2 py-1 rounded-full">
                      🚚 Llega pronto
                    </span>
                  </div>

                  <div className="p-2.5 flex flex-col flex-1">
                    <p className="text-xs font-bold text-gray-800 line-clamp-2 leading-tight flex-1">
                      {p.nombre}
                    </p>

                    {p.fecha_estimada && (
                      <p className="text-[10px] text-amber-700 font-semibold mt-1">
                        Estimado:{" "}
                        {new Date(p.fecha_estimada).toLocaleDateString("es-AR", {
                          day: "numeric",
                          month: "short"
                        })}
                      </p>
                    )}

                    <a
                      href={`https://wa.me/5492944396888?text=${encodeURIComponent(
                        `¡Hola! Vi que vas a tener "${p.nombre}" y me interesa. ¿Me lo reservás cuando llegue?`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full bg-[#25D366] text-white text-[11px] font-bold py-2 rounded-lg text-center mt-2"
                    >
                      💬 Reservar
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
