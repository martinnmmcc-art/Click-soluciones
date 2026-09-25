"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import { supabase } from "@/lib/supabaseClient";
import { formatPrice } from "@/lib/whatsapp";

// Pega el texto del pedido tal como sale de la web del proveedor, la app
// interpreta cada línea y busca la foto. Es lo mismo que se hacía a mano en
// el chat, ahora en un paso.
//
// El pedido queda en "camino": aparece sin precio en /proximamente para
// que el cliente se anticipe. Al llegar, un botón carga todo a Productos
// con stock, precio y foto.
function PedidoProveedor() {
  const [vista, setVista] = useState("nuevo"); // nuevo | camino | recibidos
  const [texto, setTexto] = useState("");
  const [flete, setFlete] = useState("");
  const [interpretando, setInterpretando] = useState(false);
  const [items, setItems] = useState([]);
  const [subtotal, setSubtotal] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recibiendoId, setRecibiendoId] = useState(null);

  async function cargarPedidos() {
    setLoading(true);
    const { data } = await supabase
      .from("pedidos_proveedor")
      .select("*, lineas_pedido_proveedor(id, nombre, cantidad, precio_unitario, imagen_url, aplicada)")
      .order("created_at", { ascending: false });
    setPedidos(data || []);
    setLoading(false);
  }

  useEffect(() => {
    cargarPedidos();
  }, []);

  async function interpretar() {
    if (!texto.trim()) return;
    setInterpretando(true);
    try {
      const res = await fetch("/api/admin/interpretar-pedido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto })
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error);
        return;
      }

      setItems(data.items);
      setSubtotal(data.subtotal);
    } finally {
      setInterpretando(false);
    }
  }

  function confirmarSugerido(i) {
    setItems((prev) =>
      prev.map((it, idx) =>
        idx === i ? { ...it, producto_id: it.sugerido.id, sugerido: null } : it
      )
    );
  }

  function descartarSugerido(i) {
    setItems((prev) =>
      prev.map((it, idx) => (idx === i ? { ...it, sugerido: null } : it))
    );
  }

  function quitarItem(i) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function guardarComoEnCamino() {
    if (items.length === 0) return;
    setGuardando(true);

    try {
      const { data: pedido, error } = await supabase
        .from("pedidos_proveedor")
        .insert({
          texto_original: texto,
          subtotal,
          flete: Number(flete) || 0,
          estado: "en_camino"
        })
        .select()
        .single();

      if (error) throw new Error(error.message);

      const lineas = items.map((i) => ({
        pedido_proveedor_id: pedido.id,
        producto_id: i.producto_id,
        nombre: i.nombre,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
        imagen_url: i.imagen_url
      }));

      await supabase.from("lineas_pedido_proveedor").insert(lineas);

      // Los que no teníamos cargados van a "Próximo pedido" para que el
      // cliente los vea sin precio y se anticipe.
      const nuevos = items.filter((i) => !i.producto_id && i.imagen_url);
      if (nuevos.length > 0) {
        await supabase.from("proximo_pedido").insert(
          nuevos.map((i) => ({
            nombre: i.nombre,
            imagen_url: i.imagen_url,
            visible: true
          }))
        );
      }

      alert(
        `✓ Pedido guardado como "en camino".\n\n${items.length} productos, ` +
          `${nuevos.length} nuevos van a mostrarse en "Llega pronto".`
      );

      setTexto("");
      setFlete("");
      setItems([]);
      setSubtotal(0);
      setVista("camino");
      cargarPedidos();
    } catch (e) {
      alert("No se pudo guardar: " + e.message);
    } finally {
      setGuardando(false);
    }
  }

  async function marcarRecibido(pedido) {
    if (
      !confirm(
        `¿Marcar como recibido "${pedido.numero_pedido || "este pedido"}"?\n\n` +
          `Se va a sumar el stock, actualizar precios y sacarlos de "Próximo pedido".`
      )
    )
      return;

    setRecibiendoId(pedido.id);
    try {
      const { data, error } = await supabase.rpc("recibir_pedido_proveedor", {
        p_pedido_id: pedido.id
      });

      if (error) throw new Error(error.message);

      const r = data?.[0];

      // Sacamos de "Próximo pedido" los que ya llegaron
      const nombres = (pedido.lineas_pedido_proveedor || []).map((l) => l.nombre);
      if (nombres.length > 0) {
        await supabase.from("proximo_pedido").delete().in("nombre", nombres);
      }

      alert(
        `✓ Pedido recibido.\n\n` +
          `${r.productos_actualizados} productos actualizados\n` +
          `${r.productos_creados} productos nuevos creados`
      );

      cargarPedidos();
    } catch (e) {
      alert("No se pudo recibir: " + e.message);
    } finally {
      setRecibiendoId(null);
    }
  }

  const enCamino = pedidos.filter((p) => p.estado === "en_camino");
  const recibidos = pedidos.filter((p) => p.estado === "recibido");

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/admin" className="text-sm text-brand-blue font-medium">
          ← Panel
        </Link>
        <h1 className="text-2xl font-extrabold text-gray-800 mt-1 mb-1">
          Pedido al proveedor
        </h1>
        <p className="text-xs text-gray-500 mb-4">
          Pegá el texto tal cual sale de la web del proveedor.
        </p>

        <div className="flex gap-2 mb-4">
          {[
            { id: "nuevo", label: "📋 Cargar" },
            { id: "camino", label: `🚚 En camino (${enCamino.length})` },
            { id: "recibidos", label: `✅ Recibidos (${recibidos.length})` }
          ].map((v) => (
            <button
              key={v.id}
              onClick={() => setVista(v.id)}
              className={`flex-1 py-2 rounded-xl text-[11px] font-bold ${
                vista === v.id
                  ? "bg-brand-blue text-white"
                  : "bg-white border border-gray-200 text-gray-600"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {vista === "nuevo" && (
          <>
            <div className="bg-white rounded-2xl border-2 border-brand-blue p-4 mb-4">
              <p className="text-xs font-bold text-gray-700 mb-2">
                Pegá el detalle del pedido
              </p>
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={8}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono"
                placeholder={
                  "Rollo Vinilo Blanco Con Gris WMA-003 60x200cm × 2\t$9.200,00\n" +
                  "Toalla De Algodon De Baño 40x70Cm Blanco Oriental TOA-YW1 × 3\t$9.000,00\n" +
                  "..."
                }
              />

              <button
                onClick={interpretar}
                disabled={interpretando || !texto.trim()}
                className="w-full bg-brand-blue text-white text-sm font-bold py-2.5 rounded-xl mt-2 disabled:opacity-50"
              >
                {interpretando ? "Buscando fotos..." : "Interpretar pedido"}
              </button>
            </div>

            {items.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
                <p className="text-sm font-bold text-gray-800 mb-1">
                  {items.length} productos · ${formatPrice(subtotal)}
                </p>
                <p className="text-[11px] text-gray-500 mb-3">
                  Revisá que esté bien antes de guardar. Podés sacar los que sobren.
                </p>

                <div className="space-y-2 max-h-96 overflow-y-auto mb-3">
                  {items.map((i, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 border-b border-gray-50 pb-2"
                    >
                      <div className="w-10 h-10 bg-gray-50 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {i.imagen_url ? (
                          <img src={i.imagen_url} alt="" className="w-full h-full object-contain" />
                        ) : (
                          <span className="text-sm">📦</span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-gray-800 line-clamp-1">
                          {i.nombre}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {i.cantidad}x ${formatPrice(i.precio_unitario)}
                          {i.producto_id && (
                            <span className="text-green-700 font-bold"> · ya lo tenés</span>
                          )}
                          {!i.imagen_url && (
                            <span className="text-amber-700 font-bold"> · sin foto</span>
                          )}
                        </p>

                        {i.sugerido && (
                          <div className="bg-amber-50 border border-amber-300 rounded-lg p-1.5 mt-1">
                            <p className="text-[10px] text-amber-800">
                              ¿Es lo mismo que <b>{i.sugerido.nombre}</b>?
                            </p>
                            <div className="flex gap-1.5 mt-1">
                              <button
                                onClick={() => confirmarSugerido(idx)}
                                className="text-[10px] font-bold bg-amber-600 text-white px-2 py-0.5 rounded"
                              >
                                Sí, es este
                              </button>
                              <button
                                onClick={() => descartarSugerido(idx)}
                                className="text-[10px] font-bold text-gray-500 px-2 py-0.5"
                              >
                                No, es nuevo
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => quitarItem(idx)}
                        className="text-red-500 text-sm font-bold px-1"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                <label className="text-xs font-bold text-gray-600 block mb-1">
                  Flete (estimado si todavía no lo sabés)
                </label>
                <input
                  type="number"
                  value={flete}
                  onChange={(e) => setFlete(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3"
                  placeholder="$"
                />

                <button
                  onClick={guardarComoEnCamino}
                  disabled={guardando}
                  className="w-full bg-amber-600 text-white text-sm font-bold py-3 rounded-xl disabled:opacity-50"
                >
                  {guardando ? "Guardando..." : "🚚 Guardar como \"en camino\""}
                </button>

                <p className="text-[10px] text-gray-500 mt-2 text-center">
                  Los productos nuevos van a mostrarse sin precio en &quot;Llega pronto&quot;
                </p>
              </div>
            )}
          </>
        )}

        {vista === "camino" && (
          <div className="space-y-3">
            {loading ? (
              <p className="text-center text-gray-400 py-10">Cargando...</p>
            ) : enCamino.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 text-center border border-gray-100">
                <p className="text-sm text-gray-600">No hay pedidos en camino.</p>
              </div>
            ) : (
              enCamino.map((p) => (
                <div key={p.id} className="bg-white rounded-2xl border-2 border-amber-300 p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-sm font-bold text-gray-800">
                        {new Date(p.fecha_pedido).toLocaleDateString("es-AR")}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {p.lineas_pedido_proveedor?.length || 0} productos · $
                        {formatPrice(p.subtotal)}
                        {p.flete > 0 && ` + $${formatPrice(p.flete)} flete`}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => marcarRecibido(p)}
                    disabled={recibiendoId === p.id}
                    className="w-full bg-green-600 text-white text-sm font-bold py-3 rounded-xl disabled:opacity-50"
                  >
                    {recibiendoId === p.id ? "Cargando..." : "✅ Marcar como llegado"}
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {vista === "recibidos" && (
          <div className="space-y-2">
            {recibidos.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 text-center border border-gray-100">
                <p className="text-sm text-gray-600">Todavía no recibiste ninguno.</p>
              </div>
            ) : (
              recibidos.map((p) => (
                <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-3">
                  <p className="text-xs font-bold text-gray-800">
                    ✅ Recibido el {new Date(p.fecha_recibido).toLocaleDateString("es-AR")}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {p.lineas_pedido_proveedor?.length || 0} productos · ${formatPrice(p.subtotal)}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </main>
  );
}

export default function PedidoProveedorPage() {
  return (
    <AdminGuard>
      <PedidoProveedor />
    </AdminGuard>
  );
}
