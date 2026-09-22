"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Estrellas from "@/components/Estrellas";
import { supabase } from "@/lib/supabaseClient";
import { sesionCliente, yaOpinoEnEsteCelular } from "@/lib/opiniones";

// Después de recibir un pedido, le pregunta al cliente cómo le fue.
// Aparece como mucho una vez por semana, solo si:
//  - tiene la sesión iniciada,
//  - tiene algún pedido entregado en los últimos 30 días,
//  - todavía no opinó sobre la tienda.
// Tocando una estrella va directo a la pantalla de opinar.

const CLAVE_CERRADO = "bolsonclick_aviso_opinar";
const DIAS_ENTRE_AVISOS = 7;
const PANTALLAS_SIN_AVISO = ["/admin", "/login", "/opinar", "/checkout", "/confirmacion", "/catalogo-compartir"];

function lePreguntamosHace() {
  try {
    const g = localStorage.getItem(CLAVE_CERRADO);
    if (!g) return Infinity;
    return (Date.now() - new Date(g).getTime()) / (1000 * 60 * 60 * 24);
  } catch (e) {
    return Infinity;
  }
}

export default function AvisoOpinar() {
  const pathname = usePathname() || "";
  const router = useRouter();
  const [pedido, setPedido] = useState(null);
  const [cerrado, setCerrado] = useState(false);

  useEffect(() => {
    if (PANTALLAS_SIN_AVISO.some((p) => pathname.startsWith(p))) return;
    if (yaOpinoEnEsteCelular() || lePreguntamosHace() < DIAS_ENTRE_AVISOS) return;

    const sesion = sesionCliente();
    if (!sesion?.telefono) return;

    const t = setTimeout(async () => {
      try {
        const { data: yaOpino } = await supabase.rpc("ya_opino_tienda", { p_telefono: sesion.telefono });
        if (yaOpino) return;

        const res = await fetch(`/api/mis-pedidos?telefono=${encodeURIComponent(sesion.telefono)}`);
        const data = await res.json();
        const hace30 = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const entregado = (data.pedidos || []).find(
          (p) => p.estado === "entregado" && new Date(p.created_at).getTime() > hace30
        );
        if (entregado) setPedido({ id: entregado.id, nombre: (sesion.nombre || "").split(" ")[0] });
      } catch (e) {}
    }, 4000);
    return () => clearTimeout(t);
  }, [pathname]);

  function cerrar() {
    setCerrado(true);
    try {
      localStorage.setItem(CLAVE_CERRADO, new Date().toISOString());
    } catch (e) {}
  }

  function elegir(n) {
    cerrar();
    router.push(`/opinar?pedido=${pedido.id}&estrellas=${n}`);
  }

  if (!pedido || cerrado || PANTALLAS_SIN_AVISO.some((p) => pathname.startsWith(p))) return null;

  return (
    <div className="fixed bottom-20 left-3 right-3 z-[57] md:bottom-6 md:left-auto md:right-6 md:max-w-sm">
      <div className="bg-white rounded-2xl shadow-xl border-2 border-amber-300 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-bold text-sm text-gray-800">
            {pedido.nombre ? `${pedido.nombre}, ¿cómo` : "¿Cómo"} fue tu compra en Bolson Click? 🙂
          </p>
          <button onClick={cerrar} aria-label="Cerrar" className="text-gray-300 text-lg leading-none px-1">
            ×
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1 mb-3">Tocá las estrellas. Te lleva 30 segundos.</p>
        <div className="flex justify-center">
          <Estrellas valor={0} tamano="text-3xl" onElegir={elegir} />
        </div>
      </div>
    </div>
  );
}
