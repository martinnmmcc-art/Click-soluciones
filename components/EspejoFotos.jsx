"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { cabeceraAdmin } from "@/lib/verificarAdmin";

// Muestra cuántas fotos ya están guardadas en nuestro servidor y cuántas
// todavía dependen de la página del proveedor.
//
// Cada vez que se abre el panel copia una tanda chica en silencio, así el
// trabajo avanza solo con el uso normal. El botón hace todo de una vez.
export default function EspejoFotos() {
  const [resumen, setResumen] = useState(null);
  const [trabajando, setTrabajando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const detener = useRef(false);

  async function llamar(metodo, cuerpo) {
    const headers = await cabeceraAdmin(supabase);
    const res = await fetch("/api/admin/espejar-fotos", {
      method: metodo,
      headers,
      body: cuerpo ? JSON.stringify(cuerpo) : undefined
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Error");
    return res.json();
  }

  async function actualizarResumen() {
    try {
      const r = await llamar("GET");
      setResumen(r.resumen);
      return r.resumen;
    } catch (e) {
      return null;
    }
  }

  useEffect(() => {
    let cancelado = false;

    (async () => {
      const r = await actualizarResumen();
      // Tanda automática y silenciosa, solo si hay algo pendiente
      const pendientes = (r?.tuyos_pendientes || 0) + (r?.pedido_pendientes || 0);
      if (!cancelado && pendientes > 0 && navigator.onLine) {
        try {
          const res = await llamar("POST", { productos: 6 });
          if (!cancelado && res?.resumen) setResumen(res.resumen);
        } catch (e) {}
      }
    })();

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function copiarTodo() {
    setTrabajando(true);
    detener.current = false;
    setMensaje("");

    let totalCopiadas = 0;
    let vueltasSinAvance = 0;
    let avisoFinal = "";

    try {
      while (!detener.current) {
        const res = await llamar("POST", { productos: 10 });
        setResumen(res.resumen);
        totalCopiadas += res.copiadas;

        const quedan =
          (res.resumen?.tuyos_pendientes || 0) + (res.resumen?.pedido_pendientes || 0);
        if (quedan === 0) break;

        // Si varias tandas seguidas no copian nada, el proveedor está caído
        vueltasSinAvance = res.copiadas === 0 ? vueltasSinAvance + 1 : 0;
        if (vueltasSinAvance >= 3) {
          avisoFinal =
            "El proveedor no está respondiendo. Lo que falta se sigue copiando solo cuando vuelva.";
          break;
        }
      }
      setMensaje(avisoFinal || `✓ Se copiaron ${totalCopiadas} fotos a tu servidor.`);
    } catch (e) {
      setMensaje("Se cortó la copia: " + e.message + ". Podés seguir después, retoma donde quedó.");
    } finally {
      setTrabajando(false);
    }
  }

  if (!resumen) return null;

  const tuyosTotal = resumen.tuyos_en_servidor + resumen.tuyos_pendientes;
  const pedidoTotal = resumen.pedido_en_servidor + resumen.pedido_pendientes;
  const pendientes = resumen.tuyos_pendientes + resumen.pedido_pendientes;
  const pctTuyos = tuyosTotal ? Math.round((resumen.tuyos_en_servidor / tuyosTotal) * 100) : 100;
  const pctPedido = pedidoTotal ? Math.round((resumen.pedido_en_servidor / pedidoTotal) * 100) : 100;

  return (
    <div
      className={`rounded-2xl p-4 border-2 ${
        pendientes === 0 ? "bg-green-50 border-green-300" : "bg-white border-brand-blue/40"
      }`}
    >
      <p className="text-sm font-bold text-gray-800">
        {pendientes === 0 ? "🖼️ Fotos a salvo en tu servidor" : "🖼️ Fotos en tu servidor"}
      </p>
      <p className="text-[11px] text-gray-500 mt-0.5">
        Las guardadas acá se siguen viendo aunque la página del proveedor se caiga.
      </p>

      <div className="mt-3 space-y-2">
        <div>
          <div className="flex justify-between text-[11px] text-gray-700">
            <span>Tus productos</span>
            <span className="font-bold">
              {resumen.tuyos_en_servidor} de {tuyosTotal}
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 mt-1">
            <div className="bg-green-500 h-2 rounded-full" style={{ width: `${pctTuyos}%` }} />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-[11px] text-gray-700">
            <span>Productos a pedido</span>
            <span className="font-bold">
              {resumen.pedido_en_servidor} de {pedidoTotal}
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 mt-1">
            <div className="bg-brand-blue h-2 rounded-full" style={{ width: `${pctPedido}%` }} />
          </div>
        </div>
      </div>

      {resumen.con_error > 0 && (
        <p className="text-[10px] text-gray-500 mt-2">
          {resumen.con_error} productos tienen la foto rota en el proveedor y se dejaron de reintentar.
        </p>
      )}

      {mensaje && (
        <p className="text-[11px] font-semibold text-gray-700 bg-gray-50 rounded-lg p-2 mt-2">
          {mensaje}
        </p>
      )}

      {pendientes > 0 && (
        <button
          onClick={trabajando ? () => (detener.current = true) : copiarTodo}
          className={`w-full text-xs font-bold py-2.5 rounded-xl mt-3 ${
            trabajando ? "bg-gray-200 text-gray-700" : "bg-brand-blue text-white"
          }`}
        >
          {trabajando ? "Copiando... (tocá para pausar)" : `Copiar las ${pendientes} fotos que faltan`}
        </button>
      )}

      {pendientes > 0 && !trabajando && (
        <p className="text-[10px] text-gray-400 mt-1.5 text-center">
          Conviene hacerlo con wifi. Si se corta, retoma donde quedó.
        </p>
      )}
    </div>
  );
}
