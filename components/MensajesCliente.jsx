"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

// Avisos que el negocio dejó para este cliente.
//
// Es el canal que llega al 100%: no depende de que haya aceptado las
// notificaciones (solo el 15% las tiene) ni de que lea el WhatsApp. Si
// abre la app, lo ve.
//
// Se muestra de a uno y solo hasta que lo lee, para que no se acumulen
// carteles y termine ignorándolos todos.

const COLORES = {
  azul: "from-brand-blue to-brand-blueDark",
  naranja: "from-brand-orange to-brand-orangeDark",
  verde: "from-green-600 to-green-700",
  rojo: "from-red-600 to-red-700"
};

export default function MensajesCliente() {
  const [mensajes, setMensajes] = useState([]);
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    async function cargar() {
      try {
        const s = localStorage.getItem("cliente_sesion");
        if (!s) return;
        const tel = JSON.parse(s)?.telefono;
        if (!tel) return;

        const { data } = await supabase.rpc("mis_mensajes", { p_telefono: tel });
        setMensajes(data || []);
      } catch (e) {
        // Sin conexión no mostramos nada
      }
    }

    // Un respiro antes de aparecer: si salta apenas abre, se cierra sin leer
    const t = setTimeout(cargar, 2000);
    return () => clearTimeout(t);
  }, []);

  async function cerrar(m) {
    try {
      await supabase.rpc("marcar_mensaje_visto", { p_id: m.id });
    } catch (e) {}

    // Pasamos al siguiente si hay más
    if (indice < mensajes.length - 1) {
      setIndice(indice + 1);
    } else {
      setMensajes([]);
    }
  }

  const m = mensajes[indice];
  if (!m) return null;

  const gradiente = COLORES[m.color] || COLORES.azul;

  return (
    <div className="fixed inset-x-3 bottom-20 z-[59] md:bottom-6 md:left-auto md:right-6 md:max-w-sm">
      <div className={`bg-gradient-to-br ${gradiente} rounded-2xl shadow-xl p-4 text-white`}>
        <div className="flex items-start gap-3">
          <span className="text-3xl flex-shrink-0">{m.icono}</span>

          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm leading-tight">{m.titulo}</p>
            {m.cuerpo && (
              <p className="text-xs opacity-95 mt-1 leading-snug">{m.cuerpo}</p>
            )}
          </div>

          <button
            onClick={() => cerrar(m)}
            aria-label="Cerrar"
            className="text-white/60 text-lg leading-none px-1 flex-shrink-0"
          >
            ×
          </button>
        </div>

        <div className="flex gap-2 mt-3">
          {m.url ? (
            <Link
              href={m.url}
              onClick={() => cerrar(m)}
              className="flex-1 bg-white text-gray-800 text-xs font-bold py-2.5 rounded-xl text-center"
            >
              Ver
            </Link>
          ) : (
            <button
              onClick={() => cerrar(m)}
              className="flex-1 bg-white text-gray-800 text-xs font-bold py-2.5 rounded-xl"
            >
              Entendido
            </button>
          )}

          {mensajes.length > 1 && (
            <span className="text-[10px] opacity-80 self-center px-2">
              {indice + 1} de {mensajes.length}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
  
