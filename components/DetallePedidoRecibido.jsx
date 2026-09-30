"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatPrice } from "@/lib/whatsapp";

// Detalle de un pedido al proveedor ya recibido: qué vino, cuánto costó
// cada cosa con el flete incluido, a cuánto se vende y cuánto deja.
//
// También permite corregir el flete, por ejemplo cuando la factura del
// transporte llega después: se reparte de nuevo entre los productos y se
// recalculan los precios.

const TRANSFERENCIA = 1.03;

export default function DetallePedidoRecibido({ pedido, onActualizado }) {
  const [abierto, setAbierto] = useState(false);
  const [editandoFlete, setEditandoFlete] = useState(false);
  const [flete, setFlete] = useState(String(pedido.flete ?? 0));
  const [guardando, setGuardando] = useState(false);

  const lineas = pedido.lineas_pedido_proveedor || [];
  const subtotal = Number(pedido.subtotal) || 0;
  const fleteTotal = Number(pedido.flete) || 0;
  const pctFlete = subtotal > 0 ? (fleteTotal / subtotal) * 100 : 0;

  // Por unidad: costo del proveedor + 3% de transferencia + su parte del flete
  const filas = lineas.map((l) => {
    const costo = Number(l.precio_unitario) || 0;
    const fleteUnidad = subtotal > 0 ? (costo * fleteTotal) / subtotal : 0;
    const costoReal = costo * TRANSFERENCIA + fleteUnidad;
    const precio = Number(l.Productos?.precio) || 0;
    return {
      ...l,
      costo,
      fleteUnidad,
      costoReal,
      precio,
      gananciaUnidad: precio - costoReal
    };
  });

  const unidades = filas.reduce((a, f) => a + Number(f.cantidad || 0), 0);
  const costoRealTotal = subtotal * TRANSFERENCIA + fleteTotal;
  const ventaPotencial = filas.reduce((a, f) => a + f.precio * Number(f.cantidad || 0), 0);
  const gananciaPotencial = ventaPotencial - costoRealTotal;

  async function guardarFlete() {
    const valor = Number(String(flete).replace(",", "."));
    if (!(valor >= 0)) {
      alert("Escribí el flete en pesos, por ejemplo 41107.92");
      return;
    }
    setGuardando(true);
    try {
      const { data, error } = await supabase.rpc("actualizar_flete_pedido", {
        p_pedido_id: pedido.id,
        p_flete: valor
      });
      if (error) throw new Error(error.message);
      alert(`✓ Flete actualizado. Se recalcularon ${data?.[0]?.productos_recalculados ?? 0} precios.`);
      setEditandoFlete(false);
      onActualizado?.();
    } catch (e) {
      alert("No se pudo actualizar: " + e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100">
      <button onClick={() => setAbierto(!abierto)} className="w-full text-left p-3">
        <div className="flex justify-between items-start gap-2">
          <div>
            <p className="text-xs font-bold text-gray-800">
              ✅ Pedido {pedido.numero_pedido || `#${pedido.id}`} · recibido el{" "}
              {new Date(pedido.fecha_recibido).toLocaleDateString("es-AR")}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {lineas.length} productos · {unidades} unidades · ${formatPrice(subtotal)}
              {fleteTotal > 0
                ? ` + flete $${formatPrice(fleteTotal)}`
                : " · sin flete cargado"}
            </p>
          </div>
          <span className="text-gray-400 text-sm">{abierto ? "▲" : "▼"}</span>
        </div>
      </button>

      {abierto && (
        <div className="border-t border-gray-100 p-3">
          {/* Resumen de costos */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-gray-50 rounded-xl p-2.5">
              <p className="text-[10px] text-gray-500">Mercadería</p>
              <p className="text-sm font-bold text-gray-800">${formatPrice(subtotal)}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-2.5">
              <p className="text-[10px] text-gray-500">Transporte</p>
              <p className="text-sm font-bold text-gray-800">
                ${formatPrice(fleteTotal)}
                <span className="text-[10px] font-normal text-gray-500">
                  {" "}
                  · {pctFlete.toFixed(1)}%
                </span>
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-2.5">
              <p className="text-[10px] text-gray-500">Te costó en total</p>
              <p className="text-sm font-bold text-gray-800">${formatPrice(costoRealTotal)}</p>
              <p className="text-[9px] text-gray-400">con 3% de transferencia</p>
            </div>
            <div className="bg-green-50 rounded-xl p-2.5">
              <p className="text-[10px] text-green-700">Si vendés todo</p>
              <p className="text-sm font-bold text-green-800">${formatPrice(ventaPotencial)}</p>
              <p className="text-[9px] text-green-700">ganancia ${formatPrice(gananciaPotencial)}</p>
            </div>
          </div>

          {/* Corregir el flete */}
          {editandoFlete ? (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 mb-3">
              <p className="text-[11px] font-bold text-gray-700 mb-1">Flete real de este pedido</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  value={flete}
                  onChange={(e) => setFlete(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                />
                <button
                  onClick={guardarFlete}
                  disabled={guardando}
                  className="bg-brand-blue text-white text-xs font-bold px-3 rounded-lg disabled:opacity-50"
                >
                  {guardando ? "..." : "Guardar"}
                </button>
                <button
                  onClick={() => setEditandoFlete(false)}
                  className="text-xs text-gray-500 px-1"
                >
                  ×
                </button>
              </div>
              <p className="text-[10px] text-gray-500 mt-1.5">
                Se reparte entre los productos según lo que costó cada uno, y se
                recalculan los precios de venta.
              </p>
            </div>
          ) : (
            <button
              onClick={() => setEditandoFlete(true)}
              className="w-full text-xs font-bold text-brand-blue border border-brand-blue rounded-xl py-2 mb-3"
            >
              ✏️ Corregir el flete
            </button>
          )}

          {/* Producto por producto */}
          <p className="text-[11px] font-bold text-gray-700 mb-1.5">Por unidad</p>
          <div className="space-y-1.5 max-h-[28rem] overflow-y-auto">
            {filas.map((f) => (
              <div key={f.id} className="flex gap-2 border-b border-gray-50 pb-1.5">
                <div className="w-9 h-9 bg-gray-50 rounded overflow-hidden flex-shrink-0">
                  {(f.imagen_url || f.Productos?.imagen_url) && (
                    <img
                      src={f.imagen_url || f.Productos?.imagen_url}
                      alt=""
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-gray-800 line-clamp-1">
                    {f.cantidad}× {f.Productos?.nombre || f.nombre_normalizado || f.nombre}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    ${formatPrice(f.costo)} + flete ${formatPrice(Math.round(f.fleteUnidad))} → te
                    costó <b>${formatPrice(Math.round(f.costoReal))}</b>
                  </p>
                  <p className="text-[10px] text-gray-500">
                    Se vende a <b className="text-gray-800">${formatPrice(f.precio)}</b>
                    {f.precio > 0 && (
                      <span className="text-green-700 font-semibold">
                        {" "}
                        · ganás ${formatPrice(Math.round(f.gananciaUnidad))}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
