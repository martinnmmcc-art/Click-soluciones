"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatPrice } from "@/lib/whatsapp";

// Detalle de un pedido al proveedor ya recibido: qué vino, cuánto costó
// cada cosa con el flete incluido, a cuánto se vende y cuánto deja.
//
// El flete real de este pedido se muestra para saber cuánto salió de verdad.
// Los PRECIOS no se calculan con él: usan la regla (10% de transporte).
// Corregir el flete acá actualiza solo las cuentas (pedido y compra).
//
// El descuento del proveedor (ej: 5% sobre el total) baja la plata que
// pagaste, pero NO el costo de los productos: sus precios de venta siguen
// saliendo de la lista del proveedor. Por eso lo ganado de más aparece aparte.
//
// "Lo que no llegó": se marca acá cuántas unidades de cada producto no
// vinieron. Se les resta el stock (al recibir ya se había sumado), la plata
// no cambia (ya estaba pagado) y quedan pendientes para agregarlas sin cargo
// al próximo pedido.

const TRANSFERENCIA = 1.03;

// repuestoEn: { [id de línea]: [{ cantidad, pedido, estado }] } — dónde se
// agregó como reposición lo que no llegó de cada línea.
export default function DetallePedidoRecibido({ pedido, onActualizado, repuestoEn = {} }) {
  const [abierto, setAbierto] = useState(false);
  const [editandoFlete, setEditandoFlete] = useState(false);
  const [flete, setFlete] = useState(String(pedido.flete ?? 0));
  const [guardando, setGuardando] = useState(false);
  const [editandoDescuento, setEditandoDescuento] = useState(false);
  const [descuento, setDescuento] = useState(String(Number(pedido.descuento_pct) || 0));
  const [marcandoNoLlego, setMarcandoNoLlego] = useState(false);
  const [noLlego, setNoLlego] = useState({});

  const lineas = pedido.lineas_pedido_proveedor || [];
  const subtotal = Number(pedido.subtotal) || 0;
  const fleteTotal = Number(pedido.flete) || 0;
  const pctDescuento = Number(pedido.descuento_pct) || 0;
  const descuentoPesos = Math.round((subtotal * pctDescuento) / 100);
  const pagadoMercaderia = subtotal - descuentoPesos;

  // Lo que se pagó en este pedido (reposiciones a $0, cambios solo la diferencia)
  // no es lo que cuesta el producto. Para las cuentas de ganancia cada unidad
  // vale su costo real: lo que se pagó antes o el precio del producto nuevo.
  const costoBase = (l) => {
    const pagado = Number(l.precio_unitario) || 0;
    if (l.tipo === "reposicion" || l.tipo === "cambio") {
      const real = Number(l.costo_real) || 0;
      return real > 0 ? real : pagado;
    }
    return pagado;
  };
  const baseTotal = lineas.reduce((a, l) => a + costoBase(l) * Number(l.cantidad || 0), 0);
  const pctFlete = subtotal > 0 ? (fleteTotal / subtotal) * 100 : 0;

  // Por unidad: costo real + 3% de transferencia + su parte del flete
  const filas = lineas.map((l) => {
    const pagado = Number(l.precio_unitario) || 0;
    const costo = costoBase(l);
    const fleteUnidad = baseTotal > 0 ? (costo * fleteTotal) / baseTotal : 0;
    const costoReal = costo * TRANSFERENCIA + fleteUnidad;
    const precio = Number(l.Productos?.precio) || 0;
    return {
      ...l,
      pagado,
      costo,
      fleteUnidad,
      costoReal,
      precio,
      gananciaUnidad: precio - costoReal
    };
  });

  const reposiciones = filas.filter((f) => f.tipo === "reposicion").length;
  const cambios = filas.filter((f) => f.tipo === "cambio").length;
  const yaPagadoAntes = filas.reduce(
    (a, f) => a + Math.max(0, f.costo - f.pagado) * Number(f.cantidad || 0),
    0
  );

  const unidades = filas.reduce((a, f) => a + Number(f.cantidad || 0), 0);
  // Plata que salió en ESTE pedido (con el descuento ya restado)
  const costoRealTotal = pagadoMercaderia * TRANSFERENCIA + fleteTotal;
  // Lo que vale la mercadería (incluye lo que ya habías pagado antes) menos
  // el descuento: es lo que de verdad te costó todo lo que vas a vender
  const costoMercaderia = (baseTotal - descuentoPesos) * TRANSFERENCIA + fleteTotal;
  const ventaPotencial = filas.reduce((a, f) => a + f.precio * Number(f.cantidad || 0), 0);
  const gananciaPotencial = ventaPotencial - costoMercaderia;

  const faltantes = filas.filter((f) => Number(f.cantidad_no_llego) > 0);
  const unidadesFaltantes = faltantes.reduce((a, f) => a + Number(f.cantidad_no_llego), 0);
  const pagadoFaltante = faltantes.reduce((a, f) => a + f.pagado * Number(f.cantidad_no_llego), 0);

  function empezarNoLlego() {
    const inicial = {};
    lineas.forEach((l) => (inicial[l.id] = Number(l.cantidad_no_llego) || 0));
    setNoLlego(inicial);
    setMarcandoNoLlego(true);
    setEditandoFlete(false);
    setEditandoDescuento(false);
  }

  function ponerNoLlego(linea, valor) {
    const max = Number(linea.cantidad) || 0;
    const n = Math.max(0, Math.min(max, Math.round(Number(valor) || 0)));
    setNoLlego((prev) => ({ ...prev, [linea.id]: n }));
  }

  async function guardarNoLlego() {
    const cambiadas = lineas.filter((l) => (noLlego[l.id] ?? 0) !== (Number(l.cantidad_no_llego) || 0));
    if (cambiadas.length === 0) {
      setMarcandoNoLlego(false);
      return;
    }
    const unidadesQueSalen = cambiadas.reduce(
      (a, l) => a + Math.max(0, noLlego[l.id] - (Number(l.cantidad_no_llego) || 0)),
      0
    );
    if (
      !confirm(
        `Vas a cambiar ${cambiadas.length} producto${cambiadas.length > 1 ? "s" : ""}.\n\n` +
          (unidadesQueSalen > 0 ? `Se restan ${unidadesQueSalen} unidades del stock. ` : "") +
          "Quedan pendientes para agregarlas sin cargo al próximo pedido. La plata no cambia: ya estaba pagado."
      )
    )
      return;

    setGuardando(true);
    const avisos = [];
    let hechas = 0;
    try {
      for (const l of cambiadas) {
        const { data, error } = await supabase.rpc("marcar_no_llego", {
          p_linea_id: l.id,
          p_cantidad: noLlego[l.id]
        });
        const nombre = l.Productos?.nombre || l.nombre_normalizado || l.nombre;
        if (error) {
          avisos.push(`✗ ${nombre}: ${error.message.replace(/^[A-Z_]+: ?/, "")}`);
          continue;
        }
        hechas++;
        const r = Array.isArray(data) ? data[0] : data;
        if (r?.sin_descontar > 0) {
          avisos.push(
            `⚠️ ${nombre}: tenía menos stock del que había que restar (faltaron ${r.sin_descontar}). Quedó en 0: fijate si se vendió.`
          );
        }
      }
      alert(`✓ ${hechas} producto${hechas === 1 ? "" : "s"} actualizado${hechas === 1 ? "" : "s"}.` + (avisos.length ? "\n\n" + avisos.join("\n") : ""));
      setMarcandoNoLlego(false);
      onActualizado?.();
    } finally {
      setGuardando(false);
    }
  }

  function estadoReposicion(l) {
    const destinos = repuestoEn[l.id] || [];
    const agregadas = destinos.reduce((a, d) => a + Number(d.cantidad || 0), 0);
    const pendiente = Math.max(0, Number(l.cantidad_no_llego) - agregadas);
    return { destinos, pendiente };
  }

  async function guardarDescuento() {
    const valor = Number(String(descuento).trim().replace(",", ".") || 0);
    if (!(valor >= 0 && valor < 100)) {
      alert("Escribí el descuento en porcentaje, por ejemplo 5 o 7,5");
      return;
    }
    if (valor > 30 && !confirm(`¿Seguro que el descuento es del ${String(valor).replace(".", ",")}%?`)) return;
    setGuardando(true);
    try {
      const { error } = await supabase.rpc("actualizar_descuento_pedido", {
        p_pedido_id: pedido.id,
        p_pct: valor
      });
      if (error) throw new Error(error.message);
      alert("✓ Descuento actualizado en el pedido y en Compras al proveedor. Los precios de venta no cambian.");
      setEditandoDescuento(false);
      onActualizado?.();
    } catch (e) {
      alert("No se pudo actualizar: " + e.message);
    } finally {
      setGuardando(false);
    }
  }

  async function guardarFlete() {
    const valor = Number(String(flete).replace(",", "."));
    if (!(valor >= 0)) {
      alert("Escribí el flete en pesos, por ejemplo 41107.92");
      return;
    }
    setGuardando(true);
    try {
      const { error } = await supabase.rpc("actualizar_flete_pedido", {
        p_pedido_id: pedido.id,
        p_flete: valor
      });
      if (error) throw new Error(error.message);
      alert("✓ Flete actualizado en el pedido y en Compras al proveedor.");
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
            {pctDescuento > 0 && (
              <p className="text-[11px] text-green-700 mt-0.5">
                🏷️ {String(pctDescuento).replace(".", ",")}% de descuento: −${formatPrice(descuentoPesos)}
              </p>
            )}
            {faltantes.length > 0 && (
              <p className="text-[11px] font-bold text-red-600 mt-0.5">
                ❌ No llegaron {unidadesFaltantes} unidades ({faltantes.length} productos) · ya pagado $
                {formatPrice(pagadoFaltante)}
              </p>
            )}
            {(reposiciones > 0 || cambios > 0) && (
              <p className="text-[11px] text-amber-700 mt-0.5">
                {reposiciones > 0 && `🔁 ${reposiciones} reposición${reposiciones > 1 ? "es" : ""}`}
                {reposiciones > 0 && cambios > 0 && " · "}
                {cambios > 0 && `🔄 ${cambios} cambio${cambios > 1 ? "s" : ""}`}
              </p>
            )}
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
              <p className="text-sm font-bold text-gray-800">${formatPrice(pagadoMercaderia)}</p>
              {pctDescuento > 0 && (
                <p className="text-[9px] text-green-700">
                  lista ${formatPrice(subtotal)} − {String(pctDescuento).replace(".", ",")}%
                </p>
              )}
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
              <p className="text-sm font-bold text-gray-800">${formatPrice(Math.round(costoRealTotal))}</p>
              <p className="text-[9px] text-gray-400">con 3% de transferencia</p>
              {yaPagadoAntes > 0 && (
                <p className="text-[9px] text-amber-700">
                  + ${formatPrice(Math.round(yaPagadoAntes))} ya pagado en pedidos anteriores
                </p>
              )}
            </div>
            <div className="bg-green-50 rounded-xl p-2.5">
              <p className="text-[10px] text-green-700">Si vendés todo</p>
              <p className="text-sm font-bold text-green-800">${formatPrice(ventaPotencial)}</p>
              <p className="text-[9px] text-green-700">ganancia ${formatPrice(Math.round(gananciaPotencial))}</p>
              {descuentoPesos > 0 && (
                <p className="text-[9px] text-green-700">
                  (incluye ${formatPrice(Math.round(descuentoPesos * TRANSFERENCIA))} extra por el descuento)
                </p>
              )}
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
                Se actualiza en el pedido y en Compras al proveedor. Los precios
                no cambian: usan el 10% de transporte de tu regla.
              </p>
            </div>
          ) : editandoDescuento ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-2.5 mb-3">
              <p className="text-[11px] font-bold text-gray-700 mb-1">Descuento del proveedor (%)</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={descuento}
                  onChange={(e) => setDescuento(e.target.value.replace(/[^0-9.,]/g, ""))}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                />
                <button
                  onClick={guardarDescuento}
                  disabled={guardando}
                  className="bg-green-600 text-white text-xs font-bold px-3 rounded-lg disabled:opacity-50"
                >
                  {guardando ? "..." : "Guardar"}
                </button>
                <button
                  onClick={() => setEditandoDescuento(false)}
                  className="text-xs text-gray-500 px-1"
                >
                  ×
                </button>
              </div>
              <p className="text-[10px] text-gray-500 mt-1.5">
                Baja lo que pagaste en Compras al proveedor. Los precios de venta no
                cambian: salen de la lista del proveedor.
              </p>
            </div>
          ) : marcandoNoLlego ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 mb-3 sticky top-0 z-10">
              <p className="text-[11px] font-bold text-red-800">❌ ¿Qué no llegó?</p>
              <p className="text-[10px] text-red-900/80 mt-0.5">
                Tocá un producto para marcarlo entero, o poné cuántas unidades faltaron. Se
                restan del stock y quedan pendientes para el próximo pedido, sin cargo.
              </p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setMarcandoNoLlego(false)}
                  className="px-3 text-xs font-bold text-gray-500"
                >
                  Cancelar
                </button>
                <button
                  onClick={guardarNoLlego}
                  disabled={guardando}
                  className="flex-1 bg-red-600 text-white text-xs font-bold py-2 rounded-lg disabled:opacity-50"
                >
                  {guardando
                    ? "Guardando..."
                    : `Guardar (${Object.values(noLlego).filter((n) => n > 0).length} sin llegar)`}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={empezarNoLlego}
                className="col-span-2 text-xs font-bold text-red-600 border border-red-400 rounded-xl py-2"
              >
                ❌ Marcar lo que no llegó
              </button>
              <button
                onClick={() => setEditandoFlete(true)}
                className="text-xs font-bold text-brand-blue border border-brand-blue rounded-xl py-2"
              >
                ✏️ Corregir el flete
              </button>
              <button
                onClick={() => setEditandoDescuento(true)}
                className="text-xs font-bold text-green-700 border border-green-600 rounded-xl py-2"
              >
                🏷️ {pctDescuento > 0 ? "Corregir descuento" : "Cargar descuento"}
              </button>
            </div>
          )}

          {/* Producto por producto */}
          <p className="text-[11px] font-bold text-gray-700">Por unidad</p>
          <p className="text-[10px] text-gray-500 mb-1.5">
            Lo que te costó con el flete real de este pedido. El precio de venta
            sale de tu regla (3% + 10% transporte + 80%).
          </p>
          <div className="space-y-1.5 max-h-[28rem] overflow-y-auto">
            {filas.map((f) => {
              const faltan = marcandoNoLlego ? noLlego[f.id] || 0 : Number(f.cantidad_no_llego) || 0;
              const { destinos, pendiente } = estadoReposicion(f);
              return (
              <div
                key={f.id}
                onClick={
                  marcandoNoLlego
                    ? () => ponerNoLlego(f, faltan > 0 ? 0 : f.cantidad)
                    : undefined
                }
                className={`flex gap-2 border-b border-gray-50 pb-1.5 ${
                  faltan > 0 ? "bg-red-50/60 rounded-lg" : ""
                } ${marcandoNoLlego ? "cursor-pointer select-none pt-1" : ""}`}
              >
                {marcandoNoLlego && (
                  <span
                    className={`w-5 h-5 mt-2 rounded border-2 flex-shrink-0 flex items-center justify-center text-[11px] font-black ${
                      faltan > 0 ? "bg-red-600 border-red-600 text-white" : "border-gray-300"
                    }`}
                  >
                    {faltan > 0 ? "✕" : ""}
                  </span>
                )}
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
                    {f.tipo === "reposicion" && "🔁 "}
                    {f.tipo === "cambio" && "🔄 "}
                    {f.cantidad}× {f.Productos?.nombre || f.nombre_normalizado || f.nombre}
                  </p>
                  {marcandoNoLlego && Number(f.cantidad) > 1 && (
                    <div
                      className="flex items-center gap-1.5 mt-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-[10px] font-bold text-red-800">No llegaron:</span>
                      <button
                        type="button"
                        onClick={() => ponerNoLlego(f, faltan - 1)}
                        className="w-6 h-6 rounded border border-red-300 bg-white text-red-700 font-bold text-xs"
                      >
                        −
                      </button>
                      <span className="text-xs font-black text-red-800 w-4 text-center">{faltan}</span>
                      <button
                        type="button"
                        onClick={() => ponerNoLlego(f, faltan + 1)}
                        className="w-6 h-6 rounded border border-red-300 bg-white text-red-700 font-bold text-xs"
                      >
                        +
                      </button>
                      <span className="text-[10px] text-red-800/70">de {f.cantidad}</span>
                    </div>
                  )}
                  {!marcandoNoLlego && faltan > 0 && (
                    <p className="text-[10px] font-bold text-red-600">
                      ❌{" "}
                      {faltan === 1
                        ? Number(f.cantidad) > 1
                          ? `No llegó 1 de ${f.cantidad}`
                          : "No llegó"
                        : faltan < Number(f.cantidad)
                          ? `No llegaron ${faltan} de ${f.cantidad}`
                          : `No llegaron las ${faltan}`}
                      {pendiente > 0 ? " · ⏳ pendiente para el próximo pedido" : ""}
                      {destinos.map((d, i) => (
                        <span key={i} className="text-green-700">
                          {" "}
                          · {d.estado === "recibido" ? "✓ llegó en" : "🚚 agregado al"} pedido {d.pedido}
                          {destinos.length > 1 || d.cantidad < faltan ? ` (${d.cantidad})` : ""}
                        </span>
                      ))}
                    </p>
                  )}
                  {f.tipo === "reposicion" && (
                    <p className="text-[10px] text-amber-700">
                      Reposición: pagaste ${formatPrice(f.pagado)} ahora, ya estaba pagado antes
                    </p>
                  )}
                  {f.tipo === "cambio" && (
                    <p className="text-[10px] text-amber-700">
                      Cambio: pagaste la diferencia ${formatPrice(f.pagado)}
                      {f.nota ? ` · ${f.nota}` : ""}
                    </p>
                  )}
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
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
