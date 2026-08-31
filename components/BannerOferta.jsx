"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

// Cartel de la oferta vigente. Muestra el descuento y cuánto falta para que
// termine: la cuenta regresiva es lo que empuja a decidir hoy en vez de
// "lo pienso y vuelvo", que casi siempre termina en no comprar.
export default function BannerOferta() {
  const [campana, setCampana] = useState(null);
  const [restante, setRestante] = useState("");

  useEffect(() => {
    async function cargar() {
      try {
        const { data } = await supabase.rpc("campana_vigente");
        setCampana(data?.[0] || null);
      } catch (e) {
        // Sin conexión no mostramos nada: los precios locales podrían
        // no reflejar la oferta y sería peor prometer algo que no está.
      }
    }
    cargar();
  }, []);

  useEffect(() => {
    if (!campana) return;

    function actualizar() {
      const ms = new Date(campana.termina) - new Date();

      if (ms <= 0) {
        setCampana(null);
        return;
      }

      const horas = Math.floor(ms / 3600000);
      const min = Math.floor((ms % 3600000) / 60000);
      const seg = Math.floor((ms % 60000) / 1000);

      if (horas >= 24) {
        const dias = Math.floor(horas / 24);
        setRestante(`${dias} día${dias === 1 ? "" : "s"} y ${horas % 24}h`);
      } else if (horas > 0) {
        setRestante(`${horas}h ${min}min`);
      } else {
        setRestante(`${min}:${String(seg).padStart(2, "0")} min`);
      }
    }

    actualizar();
    const t = setInterval(actualizar, 1000);
    return () => clearInterval(t);
  }, [campana]);

  if (!campana) return null;
  // Si la campaña no tiene productos, no anunciamos nada
  if (Number(campana.productos_afectados || 0) === 0) return null;

  const ultimasHoras = new Date(campana.termina) - new Date() < 6 * 3600000;

  // El texto tiene que reflejar el alcance real. Si son 3 productos y decimos
  // "todos", el cliente entra, no encuentra la oferta que esperaba y se va
  // con la sensación de que le mintieron.
  const cantidad = Number(campana.productos_afectados || 0);
  const total = Number(campana.total_propios || 0);
  const esTodo = cantidad > 0 && cantidad >= total;

  const detalle = esTodo
    ? "En todos los productos disponibles"
    : cantidad === 1
    ? "En 1 producto seleccionado"
    : `En ${cantidad} productos seleccionados`;

  return (
    <Link href="/catalogo?oferta=1" className="block px-4 mt-3">
      <div
        className={`rounded-2xl p-4 text-white shadow-md relative overflow-hidden ${
          ultimasHoras
            ? "bg-gradient-to-r from-red-600 to-red-700"
            : "bg-gradient-to-r from-brand-orange to-brand-orangeDark"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold opacity-90 tracking-wide">
              {campana.titulo}
            </p>
            <p className="text-2xl font-black leading-tight mt-0.5">
              {Number(campana.porcentaje)}% OFF
            </p>
            <p className="text-[11px] opacity-95 mt-0.5">{detalle}</p>

            {campana.mensaje && (
              <p className="text-[11px] opacity-90 mt-1">{campana.mensaje}</p>
            )}
          </div>

          <div className="text-right flex-shrink-0">
            <p className="text-3xl">{ultimasHoras ? "🔥" : "🏷️"}</p>
            <div className="bg-white/20 rounded-lg px-2 py-1 mt-1">
              <p className="text-[9px] opacity-90 leading-none">Termina en</p>
              <p className="text-xs font-bold leading-tight mt-0.5">{restante}</p>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
