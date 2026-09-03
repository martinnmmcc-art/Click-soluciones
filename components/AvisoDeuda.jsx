"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatPrice } from "@/lib/whatsapp";

// Le recuerda al cliente lo que debe, una vez por día.
//
// Por qué una vez por día y no en cada pantalla: si el aviso aparece todo el
// tiempo se vuelve invisible y molesta. Una vez al día lo ve, lo registra y
// puede seguir comprando tranquilo.
//
// El tono importa: no es un reclamo, es un recordatorio. En un pueblo donde
// te cruzás con los clientes, la forma de cobrar es parte del negocio.

const CLAVE_VISTO = "bolsonclick_aviso_deuda";

function yaLoVioHoy() {
  try {
    const g = localStorage.getItem(CLAVE_VISTO);
    if (!g) return false;
    return new Date(g).toDateString() === new Date().toDateString();
  } catch (e) {
    return false;
  }
}

export default function AvisoDeuda() {
  const [deuda, setDeuda] = useState(null);
  const [cerrado, setCerrado] = useState(false);

  useEffect(() => {
    if (yaLoVioHoy()) return;

    async function revisar() {
      try {
        const sesionStr = localStorage.getItem("cliente_sesion");
        if (!sesionStr) return;
        const sesion = JSON.parse(sesionStr);
        if (!sesion?.telefono) return;

        const res = await fetch(
          `/api/mis-pedidos?telefono=${encodeURIComponent(sesion.telefono)}`
        );
        const data = await res.json();
        if (!res.ok) return;

        const pendientes = (data.pedidos || []).filter((p) => {
          if (p.estado === "cancelado") return false;
          return Number(p.total || 0) - Number(p.monto_pagado || 0) > 0;
        });

        if (pendientes.length === 0) return;

        const total = pendientes.reduce(
          (a, p) => a + (Number(p.total || 0) - Number(p.monto_pagado || 0)),
          0
        );

        // Si ya pagó una parte lo decimos: reconocerlo cambia el tono
        const pagadoAlgo = pendientes.some((p) => Number(p.monto_pagado || 0) > 0);

        setDeuda({
          total,
          cantidad: pendientes.length,
          entregados: pendientes.filter((p) => p.estado === "entregado").length,
          pagadoAlgo,
          nombre: sesion.nombre
        });
      } catch (e) {
        // Sin conexión no molestamos: los datos podrían estar desactualizados
      }
    }

    // Esperamos un poco: si aparece apenas abre, se cierra por reflejo
    const t = setTimeout(revisar, 2500);
    return () => clearTimeout(t);
  }, []);

  function cerrar() {
    setCerrado(true);
    try {
      localStorage.setItem(CLAVE_VISTO, new Date().toISOString());
    } catch (e) {}
  }

  if (!deuda || cerrado) return null;

  const primerNombre = (deuda.nombre || "").split(" ")[0];

  return (
    <div className="fixed bottom-20 left-3 right-3 z-[58] md:bottom-6 md:left-auto md:right-6 md:max-w-sm">
      <div className="bg-white rounded-2xl shadow-xl border-2 border-amber-300 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-gray-800">
              {primerNombre ? `Hola ${primerNombre} 👋` : "Recordatorio"}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {deuda.pagadoAlgo
                ? "Te queda un saldo pendiente de"
                : deuda.entregados > 0
                ? "Tenés pendiente de pago"
                : "Tenés un pedido pendiente de pago"}
            </p>
            <p className="text-2xl font-extrabold text-amber-700 leading-none mt-1">
              ${formatPrice(deuda.total)}
            </p>
            <p className="text-[11px] text-gray-500 mt-1">
              {deuda.cantidad === 1
                ? "En 1 pedido"
                : `Repartido en ${deuda.cantidad} pedidos`}
              {deuda.entregados > 0 && " · ya entregado"}
            </p>
          </div>

          <button
            onClick={cerrar}
            aria-label="Cerrar"
            className="text-gray-300 text-lg leading-none px-1 flex-shrink-0"
          >
            ×
          </button>
        </div>

        <div className="bg-amber-50 rounded-xl p-2.5 mt-3">
          <p className="text-[10px] text-amber-800 font-semibold">
            Transferí al alias
          </p>
          <p className="text-base font-black text-amber-900 leading-tight">
            bolsonclick
          </p>
          <p className="text-[10px] text-amber-700">
            O pagá en efectivo cuando nos veamos
          </p>
        </div>

        <div className="flex gap-2 mt-3">
          <Link
            href="/login"
            onClick={cerrar}
            className="flex-1 bg-brand-blue text-white text-xs font-bold py-2 rounded-xl text-center"
          >
            Ver mis pedidos
          </Link>
          <button
            onClick={cerrar}
            className="px-3 text-xs font-semibold text-gray-500"
          >
            Después
          </button>
        </div>
      </div>
    </div>
  );
}
