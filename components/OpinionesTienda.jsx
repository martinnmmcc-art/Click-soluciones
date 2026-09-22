"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Estrellas from "@/components/Estrellas";
import { supabase } from "@/lib/supabaseClient";
import { etiquetaAspecto } from "@/lib/opiniones";

// Sección del inicio con lo que opinan los clientes sobre la tienda.
// Muestra solo las que un admin publicó (primero las destacadas) y un
// botón para dejar la propia.

function fechaCorta(iso) {
  return new Date(iso).toLocaleDateString("es-AR", { month: "short", year: "numeric" });
}

export default function OpinionesTienda() {
  const [opiniones, setOpiniones] = useState([]);
  const [resumen, setResumen] = useState(null);

  useEffect(() => {
    supabase.rpc("opiniones_publicas", { p_limite: 12 }).then(({ data }) => setOpiniones(data || []));
    supabase.rpc("resumen_opiniones_tienda").then(({ data }) => setResumen(data?.[0] || null));
  }, []);

  const cantidad = Number(resumen?.cantidad || 0);

  return (
    <div className="mt-6 bg-gradient-to-b from-amber-50 to-transparent py-4">
      <div className="max-w-md mx-auto px-4 mb-3 flex items-end justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">💬</span>
            <h2 className="font-black text-gray-800 text-base leading-none">Lo que dicen nuestros clientes</h2>
          </div>
          {cantidad > 0 ? (
            <p className="text-[11px] text-amber-800 mt-1 ml-7 flex items-center gap-1">
              <Estrellas valor={Number(resumen.promedio)} tamano="text-[11px]" />
              <b>{Number(resumen.promedio).toLocaleString("es-AR")}</b> · {cantidad} opinión
              {cantidad === 1 ? "" : "es"}
            </p>
          ) : (
            <p className="text-[11px] text-amber-800 mt-1 ml-7">¡Sé el primero en contarnos cómo te fue!</p>
          )}
        </div>
        <Link
          href="/opinar"
          className="flex-shrink-0 text-xs font-bold text-white bg-amber-500 px-3 py-2 rounded-xl shadow-sm"
        >
          ⭐ Opinar
        </Link>
      </div>

      {opiniones.length > 0 && (
        <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-none">
          {opiniones.map((o) => (
            <div
              key={o.id}
              className={`flex-shrink-0 w-64 bg-white rounded-2xl p-3 shadow-sm border ${
                o.destacada ? "border-amber-300" : "border-gray-100"
              }`}
            >
              <div className="flex items-center justify-between">
                <Estrellas valor={o.estrellas} tamano="text-sm" />
                <span className="text-[10px] text-gray-400">{fechaCorta(o.created_at)}</span>
              </div>
              {o.texto && <p className="text-[13px] text-gray-700 mt-2 line-clamp-5">“{o.texto}”</p>}
              {o.aspectos?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {o.aspectos.slice(0, 3).map((a) => (
                    <span key={a} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {etiquetaAspecto(a)}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-xs font-bold text-gray-800 mt-2">
                {o.nombre}
                {o.localidad && <span className="font-normal text-gray-500"> · {o.localidad}</span>}
              </p>
              {o.verificada && <p className="text-[10px] text-green-700 font-semibold">✓ Compró en Bolson Click</p>}
              {o.respuesta && (
                <div className="mt-2 bg-blue-50 rounded-lg p-2">
                  <p className="text-[10px] font-bold text-brand-blue">Respuesta de Bolson Click</p>
                  <p className="text-[11px] text-gray-700 line-clamp-3">{o.respuesta}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
