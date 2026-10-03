"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { fechaYHora } from "@/lib/fechasPedido";

// Estado de la sincronización automática con el proveedor: si está
// corriendo, cómo salió la última vuelta y POR QUÉ el proveedor muestra más
// productos que la tienda (los que se saltean y el motivo).
export default function EstadoSincronizacion() {
  const [s, setS] = useState(null);
  const [pedida, setPedida] = useState(false);

  async function cargar() {
    const { data } = await supabase.from("sync_proveedor").select("*").eq("id", 1).single();
    if (data) setS(data);
  }

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 30000);
    return () => clearInterval(t);
  }, []);

  async function sincronizarAhora() {
    const { error } = await supabase.rpc("pedir_sincronizacion");
    if (!error) setPedida(true);
  }

  if (!s) return null;

  const r = s.ultimo_resumen;
  const m = r?.motivos || {};
  const salteados = (m.sin_precio || 0) + (m.nombre_repetido || 0) + (m.categoria_excluida || 0);
  const enCurso = s.estado === "en_curso";

  return (
    <div className="card p-4 mb-4 border-2 border-brand-blue/30">
      <p className="text-sm font-extrabold text-gray-800">🔄 Sincronización automática con Next Cell</p>
      <p className="text-[11px] text-gray-500 mt-0.5">
        Una vez por día, sola: trae los productos nuevos, actualiza los precios de los "a pedido" (los tuyos
        en stock no se tocan) y oculta los que el proveedor dio de baja.
      </p>

      {enCurso ? (
        <div className="bg-blue-50 rounded-xl p-2.5 mt-3">
          <p className="text-xs font-bold text-brand-blue">
            Sincronizando: página {Math.max(1, (s.pagina_actual || 1) - 1)} de {s.total_paginas || "…"}
          </p>
          {s.total_paginas && (
            <div className="w-full bg-white rounded-full h-2 mt-1.5">
              <div
                className="bg-brand-blue h-2 rounded-full"
                style={{ width: `${Math.min(100, ((s.pagina_actual - 1) / s.total_paginas) * 100)}%` }}
              />
            </div>
          )}
          {s.ultimo_error && (
            <p className="text-[11px] text-amber-800 mt-1.5">
              El proveedor no responde ({s.ultimo_error}). Se reintenta sola en unos minutos.
            </p>
          )}
        </div>
      ) : (
        !r && (
          <p className="text-xs text-gray-600 bg-gray-50 rounded-xl p-2.5 mt-3">
            Todavía no terminó ninguna vuelta. Arranca sola en los próximos minutos.
          </p>
        )
      )}

      {r && (
        <div className="mt-3">
          <p className="text-[11px] font-bold text-gray-500 uppercase">Última vuelta · {fechaYHora(r.fin)}</p>
          <div className="grid grid-cols-3 gap-2 mt-1.5">
            <div className="bg-green-50 rounded-xl p-2 text-center">
              <p className="text-lg font-extrabold text-green-800">{r.importados || 0}</p>
              <p className="text-[10px] text-green-800">nuevos</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-2 text-center">
              <p className="text-lg font-extrabold text-brand-blue">{r.actualizados || 0}</p>
              <p className="text-[10px] text-brand-blue">actualizados</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-2 text-center">
              <p className="text-lg font-extrabold text-gray-700">{r.retirados || 0}</p>
              <p className="text-[10px] text-gray-600">dados de baja</p>
            </div>
          </div>

          {salteados > 0 && (
            <div className="bg-amber-50 rounded-xl p-2.5 mt-2">
              <p className="text-[11px] font-bold text-amber-900">
                Por qué el proveedor muestra {salteados} productos más que la tienda:
              </p>
              <ul className="text-[11px] text-amber-900 mt-1 space-y-0.5">
                {m.nombre_repetido > 0 && (
                  <li>
                    • <b>{m.nombre_repetido}</b> con el mismo nombre que otro que ya tenés (variantes de color o
                    publicaciones repetidas): no se duplican.
                  </li>
                )}
                {m.sin_precio > 0 && (
                  <li>
                    • <b>{m.sin_precio}</b> sin precio en el proveedor ("consultar"): no se puede calcular el tuyo.
                  </li>
                )}
                {m.categoria_excluida > 0 && (
                  <li>
                    • <b>{m.categoria_excluida}</b> de categorías que sacaste de la tienda.
                  </li>
                )}
              </ul>
            </div>
          )}
          {r.protegidos > 0 && (
            <p className="text-[10px] text-gray-500 mt-1.5">
              {r.protegidos} de tus productos en stock cambiaron de precio en el proveedor: no se tocaron (su costo
              es lo que pagaste). Valen para tu próximo pedido.
            </p>
          )}
        </div>
      )}

      {!enCurso && (
        <button
          onClick={sincronizarAhora}
          disabled={pedida}
          className="w-full mt-3 text-xs font-bold py-2.5 rounded-xl border-2 border-brand-blue text-brand-blue disabled:opacity-60"
        >
          {pedida ? "✓ Empieza en menos de 10 minutos" : "Sincronizar ahora"}
        </button>
      )}
    </div>
  );
}
