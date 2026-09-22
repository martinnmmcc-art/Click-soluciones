"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Estrellas from "@/components/Estrellas";
import { supabase } from "@/lib/supabaseClient";

// Prueba social: lo que opinan los clientes de Bolson Click.
//
// Dónde se muestra y por qué (criterio de marketing):
//  - "producto": justo debajo de los botones de compra. Es el momento de
//    la duda ("¿será confiable?"), y ahí una opinión real pesa más que
//    cualquier descuento. Formato corto: puntaje + 2 frases.
//  - "checkout": una sola línea de confianza antes de confirmar el pedido,
//    para bajar la ansiedad del último paso sin distraer.
//
// Se prende y se apaga desde el panel (Opiniones sobre la tienda →
// "Mostrar en la app"). Mientras esté apagado, no se ve nada.

function useOpiniones(limite) {
  const [datos, setDatos] = useState({ opiniones: [], cantidad: 0, promedio: 0 });

  useEffect(() => {
    let vivo = true;
    Promise.all([
      supabase.rpc("resumen_opiniones_tienda"),
      limite > 0 ? supabase.rpc("opiniones_publicas", { p_limite: limite }) : Promise.resolve({ data: [] })
    ]).then(([res, lista]) => {
      if (!vivo) return;
      const r = res.data?.[0];
      setDatos({
        opiniones: (lista.data || []).filter((o) => o.texto && o.estrellas >= 4),
        cantidad: Number(r?.cantidad || 0),
        promedio: Number(r?.promedio || 0)
      });
    });
    return () => {
      vivo = false;
    };
  }, [limite]);

  return datos;
}

export default function OpinionesTienda({ variante = "producto" }) {
  const { opiniones, cantidad, promedio } = useOpiniones(variante === "producto" ? 6 : 0);

  // Apagado desde el panel o todavía sin opiniones publicadas: no se muestra
  if (cantidad === 0) return null;

  const puntaje = promedio.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  if (variante === "checkout") {
    return (
      <Link
        href="/opiniones"
        className="flex items-center justify-center gap-1.5 text-[11px] text-gray-500 py-2"
      >
        <Estrellas valor={promedio} tamano="text-[11px]" />
        <b className="text-gray-700">{puntaje}</b> · {cantidad} cliente{cantidad === 1 ? "" : "s"} ya compraron y
        opinaron
      </Link>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-3">
      <Link href="/opiniones" className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs text-gray-700">
          <Estrellas valor={promedio} tamano="text-xs" />
          <b>{puntaje}</b>
          <span className="text-gray-500">
            · {cantidad} cliente{cantidad === 1 ? "" : "s"} opinaron de Bolson Click
          </span>
        </span>
        <span className="text-[11px] font-bold text-amber-700">Ver ›</span>
      </Link>

      {opiniones.length > 0 && (
        <div className="flex gap-2 overflow-x-auto mt-2 pb-1 scrollbar-none">
          {opiniones.slice(0, 4).map((o) => (
            <div key={o.id} className="flex-shrink-0 w-56 bg-white rounded-xl p-2.5 border border-amber-100">
              <p className="text-[12px] text-gray-700 line-clamp-3">“{o.texto}”</p>
              <p className="text-[11px] font-bold text-gray-800 mt-1">
                {o.nombre}
                {o.verificada && <span className="font-semibold text-green-700"> · ✓ Compró</span>}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
