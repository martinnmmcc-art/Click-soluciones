"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Estrellas from "@/components/Estrellas";
import { supabase } from "@/lib/supabaseClient";
import { etiquetaAspecto } from "@/lib/opiniones";

// Todas las opiniones publicadas sobre la tienda
export default function OpinionesPage() {
  const [opiniones, setOpiniones] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.rpc("opiniones_publicas", { p_limite: 100 }),
      supabase.rpc("resumen_opiniones_tienda")
    ]).then(([lista, res]) => {
      setOpiniones(lista.data || []);
      setResumen(res.data?.[0] || null);
      setCargando(false);
    });
  }, []);

  const cantidad = Number(resumen?.cantidad || 0);
  const promedio = Number(resumen?.promedio || 0);

  return (
    <main className="min-h-screen bg-brand-bg pb-24">
      <Header showSearch={false} />
      <div className="max-w-md mx-auto px-4 py-6">
        <h1 className="text-xl font-extrabold text-gray-800">Opiniones de clientes</h1>

        {cargando ? (
          <p className="text-center text-gray-400 py-10">Cargando...</p>
        ) : cantidad === 0 ? (
          <p className="text-sm text-gray-500 mt-3">Todavía no hay opiniones publicadas.</p>
        ) : (
          <>
            <div className="flex items-center gap-2 mt-2 mb-5">
              <span className="text-3xl font-black text-gray-800">
                {promedio.toLocaleString("es-AR", { minimumFractionDigits: 1 })}
              </span>
              <div>
                <Estrellas valor={promedio} tamano="text-base" />
                <p className="text-xs text-gray-500">
                  {cantidad} opinión{cantidad === 1 ? "" : "es"}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {opiniones.map((o) => (
                <div key={o.id} className="card p-4">
                  <div className="flex items-center justify-between">
                    <Estrellas valor={o.estrellas} tamano="text-sm" />
                    <span className="text-[11px] text-gray-400">
                      {new Date(o.created_at).toLocaleDateString("es-AR")}
                    </span>
                  </div>
                  {o.texto && <p className="text-sm text-gray-700 mt-2">“{o.texto}”</p>}
                  {o.aspectos?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {o.aspectos.map((a) => (
                        <span key={a} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {etiquetaAspecto(a)}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs font-bold text-gray-800 mt-2">
                    {o.nombre}
                    {o.localidad && <span className="font-normal text-gray-500"> · {o.localidad}</span>}
                    {o.verificada && <span className="font-semibold text-green-700"> · ✓ Compró</span>}
                  </p>
                  {o.respuesta && (
                    <div className="mt-2 bg-blue-50 rounded-lg p-2.5">
                      <p className="text-[11px] font-bold text-brand-blue">Respuesta de Bolson Click</p>
                      <p className="text-xs text-gray-700">{o.respuesta}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        <Link href="/opinar" className="btn-primary block text-center mt-6">
          ⭐ Dejar mi opinión
        </Link>
      </div>
    </main>
  );
}
