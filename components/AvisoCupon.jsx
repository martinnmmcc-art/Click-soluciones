"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

// Le recuerda al cliente que tiene un cupón sin usar.
//
// El WhatsApp se pierde entre otros mensajes y la notificación se descarta
// sin leer. Este cartel aparece cuando ya está adentro de la app, que es
// justo cuando puede usarlo.

const CLAVE_VISTO = "bolsonclick_cupon_visto";

function vistoHoy(codigo) {
  try {
    const g = localStorage.getItem(CLAVE_VISTO);
    if (!g) return false;
    const { codigo: c, fecha } = JSON.parse(g);
    return c === codigo && new Date(fecha).toDateString() === new Date().toDateString();
  } catch (e) {
    return false;
  }
}

export default function AvisoCupon() {
  const [cupon, setCupon] = useState(null);
  const [cerrado, setCerrado] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    async function buscar() {
      try {
        const s = localStorage.getItem("cliente_sesion");
        if (!s) return;
        const tel = JSON.parse(s)?.telefono;
        if (!tel) return;

        const { data } = await supabase
          .from("cupones")
          .select("*")
          .eq("telefono", tel)
          .is("usado_en", null)
          .gt("vence_en", new Date().toISOString())
          .order("vence_en", { ascending: true })
          .limit(1);

        const c = data?.[0];
        if (!c || vistoHoy(c.codigo)) return;

        setCupon(c);
      } catch (e) {
        // Sin conexión no mostramos nada
      }
    }

    // Esperamos un poco: si salta apenas abre, se cierra por reflejo
    const t = setTimeout(buscar, 3500);
    return () => clearTimeout(t);
  }, []);

  function cerrar() {
    setCerrado(true);
    try {
      localStorage.setItem(
        CLAVE_VISTO,
        JSON.stringify({ codigo: cupon.codigo, fecha: new Date().toISOString() })
      );
    } catch (e) {}
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(cupon.codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch (e) {}
  }

  if (!cupon || cerrado) return null;

  const horas = Math.floor((new Date(cupon.vence_en) - new Date()) / 3600000);
  const urgente = horas < 48;

  const restante =
    horas < 24
      ? `${horas} hora${horas === 1 ? "" : "s"}`
      : `${Math.floor(horas / 24)} día${Math.floor(horas / 24) === 1 ? "" : "s"}`;

  return (
    <div className="fixed bottom-20 left-3 right-3 z-[57] md:bottom-6 md:left-auto md:right-6 md:max-w-sm">
      <div
        className={`rounded-2xl shadow-xl p-4 text-white ${
          urgente
            ? "bg-gradient-to-br from-red-600 to-red-700"
            : "bg-gradient-to-br from-brand-orange to-brand-orangeDark"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold opacity-90">
              🎁 TENÉS UN DESCUENTO SIN USAR
            </p>
            <p className="text-2xl font-black leading-none mt-1">
              {Number(cupon.porcentaje)}% OFF
            </p>

            {Number(cupon.porcentaje_segundo) > 0 && (
              <p className="text-[11px] opacity-95 mt-0.5">
                {cupon.porcentaje_segundo}% si llevás 2 productos o más
              </p>
            )}

            {Number(cupon.minimo_compra) > 0 && (
              <p className="text-[11px] opacity-90 mt-0.5">
                En compras desde ${Number(cupon.minimo_compra).toLocaleString("es-AR")}
              </p>
            )}
          </div>

          <button
            onClick={cerrar}
            aria-label="Cerrar"
            className="text-white/60 text-lg leading-none px-1 flex-shrink-0"
          >
            ×
          </button>
        </div>

        <button
          onClick={copiar}
          className="w-full bg-white rounded-xl py-2 mt-3"
        >
          <span className="block text-[10px] text-gray-500 font-semibold">
            Tu código
          </span>
          <span className="block text-lg font-black text-gray-800 leading-tight">
            {cupon.codigo}
          </span>
          <span className="block text-[10px] text-gray-500">
            {copiado ? "✓ Copiado" : "Tocá para copiar"}
          </span>
        </button>

        <p className="text-[11px] opacity-90 mt-2 text-center">
          ⏰ Te quedan {restante}
        </p>

        <Link
          href="/catalogo"
          onClick={cerrar}
          className="block w-full bg-white/20 text-white text-xs font-bold py-2 rounded-xl mt-2 text-center"
        >
          Ver productos
        </Link>
      </div>
    </div>
  );
}
