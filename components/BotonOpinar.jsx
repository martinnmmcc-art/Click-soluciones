"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAdmin } from "@/context/AdminContext";
import { sesionCliente, yaOpinoEnEsteCelular } from "@/lib/opiniones";

// Botón flotante para opinar, arriba del de WhatsApp.
//
// Criterio de diseño (producto + marketing):
//  - Discreto: más chico que el de WhatsApp y del mismo estilo, para que se
//    lea como parte de la app y no como publicidad.
//  - Invita en el momento justo: la burbuja "¿Qué te pareció tu compra?"
//    aparece solo si el cliente ya recibió un pedido (tiene algo para contar)
//    y todavía no opinó. Nunca al mismo tiempo que la burbuja de WhatsApp.
//  - No insiste: si la cierran, vuelve a aparecer recién a los 3 días; y
//    cuando ya opinó, el botón desaparece.
//  - No aparece en el panel, el login, el checkout ni la pantalla de opinar.

const CLAVE_BURBUJA = "bolsonclick_opinar_burbuja";
const DIAS_ENTRE_BURBUJAS = 3;
const SEGUNDOS_HASTA_BURBUJA = 24; // después de que se fue la de WhatsApp
const SEGUNDOS_BURBUJA_VISIBLE = 12;
const PANTALLAS_SIN_BOTON = ["/admin", "/login", "/opinar", "/checkout", "/confirmacion", "/catalogo-compartir", "/offline"];

function burbujaVistaHace() {
  try {
    const g = localStorage.getItem(CLAVE_BURBUJA);
    if (!g) return Infinity;
    return (Date.now() - new Date(g).getTime()) / (1000 * 60 * 60 * 24);
  } catch (e) {
    return Infinity;
  }
}

function marcarBurbujaVista() {
  try {
    localStorage.setItem(CLAVE_BURBUJA, new Date().toISOString());
  } catch (e) {}
}

export default function BotonOpinar() {
  const pathname = usePathname() || "";
  const { isAdmin } = useAdmin();
  const [visible, setVisible] = useState(false);
  const [pedidoId, setPedidoId] = useState(null);
  const [burbuja, setBurbuja] = useState(false);
  const [nombre, setNombre] = useState("");

  const pantallaSinBoton = PANTALLAS_SIN_BOTON.some((p) => pathname.startsWith(p));

  useEffect(() => {
    const sesion = sesionCliente();
    if (!sesion?.telefono || yaOpinoEnEsteCelular()) return;
    setNombre((sesion.nombre || "").split(" ")[0]);

    let cancelado = false;
    (async () => {
      try {
        const { data: yaOpino } = await supabase.rpc("ya_opino_tienda", { p_telefono: sesion.telefono });
        if (cancelado || yaOpino) return;
        setVisible(true);

        // ¿Ya recibió algún pedido? Entonces tiene algo para contar
        const res = await fetch(`/api/mis-pedidos?telefono=${encodeURIComponent(sesion.telefono)}`);
        const data = await res.json();
        const entregado = (data.pedidos || []).find((p) => p.estado === "entregado");
        if (!cancelado && entregado) setPedidoId(entregado.id);
      } catch (e) {}
    })();

    return () => {
      cancelado = true;
    };
  }, []);

  // La burbuja: solo a quien ya recibió un pedido, y cada 3 días como mucho
  useEffect(() => {
    if (!visible || !pedidoId || pantallaSinBoton) return;
    if (burbujaVistaHace() < DIAS_ENTRE_BURBUJAS) return;

    let esconder;
    const aparecer = setTimeout(() => {
      setBurbuja(true);
      marcarBurbujaVista();
      esconder = setTimeout(() => setBurbuja(false), SEGUNDOS_BURBUJA_VISIBLE * 1000);
    }, SEGUNDOS_HASTA_BURBUJA * 1000);

    return () => {
      clearTimeout(aparecer);
      clearTimeout(esconder);
    };
  }, [visible, pedidoId, pantallaSinBoton]);

  if (!visible || isAdmin || pantallaSinBoton) return null;

  const destino = pedidoId ? `/opinar?pedido=${pedidoId}` : "/opinar";

  return (
    <div className="fixed bottom-[9.5rem] right-5 z-40 md:bottom-24 flex items-end gap-2">
      {burbuja && (
        <Link
          href={destino}
          className="relative bg-white rounded-2xl rounded-br-sm shadow-lg border border-gray-100 px-3 py-2.5 max-w-[200px] animate-[fadeIn_0.3s_ease-out]"
        >
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setBurbuja(false);
            }}
            aria-label="Cerrar mensaje"
            className="absolute -top-2 -left-2 bg-gray-200 text-gray-600 w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center shadow-sm"
          >
            ×
          </button>
          <p className="text-[11px] text-gray-700 leading-snug font-medium">
            {nombre ? `${nombre}, ¿qué` : "¿Qué"} te pareció tu compra? Contanos en 30 segundos 🙂
          </p>
          <p className="text-[11px] leading-none mt-1 tracking-wider">⭐⭐⭐⭐⭐</p>
        </Link>
      )}

      <Link
        href={destino}
        aria-label="Opinar sobre Bolson Click"
        className="relative w-11 h-11 rounded-full shadow-lg flex items-center justify-center bg-gradient-to-br from-amber-300 to-amber-500 text-white hover:scale-110 transition-all duration-300 flex-shrink-0"
      >
        <span className="text-xl leading-none drop-shadow-sm">★</span>
      </Link>
    </div>
  );
}
