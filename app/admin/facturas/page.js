"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import { supabase } from "@/lib/supabaseClient";
import { cabeceraAdmin } from "@/lib/verificarAdmin";
import { formatPrice } from "@/lib/whatsapp";
import { numeroFactura, linkWhatsApp } from "@/components/BotonFacturar";

// Facturas (Factura C por ARCA):
//  - "Probar conexión": revisa paso a paso que ARCA acepte tu certificado.
//  - Factura suelta: para una venta que no está en la app.
//  - Lista de facturas emitidas con su link, y lo facturado en el mes y el año
//    (sirve para no pasarte del tope de tu categoría de monotributo).
//  - "Anular": emite una Nota de Crédito C por el total de la factura (se
//    descuenta de lo facturado y el pedido se puede volver a facturar).

function Facturas() {
  const [prueba, setPrueba] = useState(null);
  const [probando, setProbando] = useState(false);
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [suelta, setSuelta] = useState({ descripcion: "", total: "", doc: "", nombre: "" });
  const [emitiendo, setEmitiendo] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [anulando, setAnulando] = useState(null); // { id, motivo, enviando, error }

  async function cargar() {
    setCargando(true);
    const { data } = await supabase
      .from("facturas")
      .select("id, pedido_id, tipo, factura_asociada, numero, punto_venta, fecha, total, estado, error, produccion, receptor_nombre, codigo, creada_en, detalle, motivo")
      .order("creada_en", { ascending: false })
      .limit(300);
    const facturas = data || [];
    // Teléfono del cliente de cada pedido, para mandar la factura por WhatsApp
    const ids = [...new Set(facturas.map((f) => f.pedido_id).filter(Boolean))];
    if (ids.length) {
      const { data: peds } = await supabase.from("pedidos").select("id, telefono_cliente").in("id", ids);
      const tel = Object.fromEntries((peds || []).map((p) => [p.id, p.telefono_cliente]));
      facturas.forEach((f) => (f.telefono = tel[f.pedido_id] || ""));
    }
    // La nota de crédito usa el teléfono del pedido de la factura que anula
    const porId = Object.fromEntries(facturas.map((f) => [f.id, f]));
    facturas.forEach((f) => {
      if (f.factura_asociada && porId[f.factura_asociada]) f.telefono = porId[f.factura_asociada].telefono || "";
    });
    setLista(facturas);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function probar() {
    setProbando(true);
    setPrueba(null);
    try {
      const res = await fetch("/api/admin/arca/estado", { headers: await cabeceraAdmin(supabase) });
      setPrueba(await res.json());
    } catch (e) {
      setPrueba({ listo: false, pasos: [{ nombre: "Conexión", ok: false, error: "Sin señal" }] });
    } finally {
      setProbando(false);
    }
  }

  async function emitirSuelta(e) {
    e.preventDefault();
    setMensaje("");
    const total = Number(String(suelta.total).replace(/\./g, "").replace(",", "."));
    if (!suelta.descripcion.trim() || !(total > 0)) {
      setMensaje("❌ Completá qué vendiste y el total.");
      return;
    }
    setEmitiendo(true);
    try {
      const doc = suelta.doc.replace(/\D/g, "");
      const res = await fetch("/api/admin/arca/facturar", {
        method: "POST",
        headers: await cabeceraAdmin(supabase),
        body: JSON.stringify({
          total,
          descripcion: suelta.descripcion,
          doc_nro: doc,
          nombre: suelta.nombre
        })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `Error ${res.status}`);
      setMensaje(`✅ Factura C ${numeroFactura(j.factura)} emitida. CAE ${j.factura.cae}`);
      setSuelta({ descripcion: "", total: "", doc: "", nombre: "" });
      cargar();
    } catch (err) {
      setMensaje(`❌ ${err.message}`);
    } finally {
      setEmitiendo(false);
    }
  }

  async function anular() {
    if (!anulando) return;
    setAnulando({ ...anulando, enviando: true, error: "" });
    try {
      const res = await fetch("/api/admin/arca/nota-credito", {
        method: "POST",
        headers: await cabeceraAdmin(supabase),
        body: JSON.stringify({ factura_id: anulando.id, motivo: anulando.motivo })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `Error ${res.status}`);
      setAnulando(null);
      setMensaje(`✅ Nota de Crédito C ${numeroFactura(j.nota)} emitida. CAE ${j.nota.cae}`);
      cargar();
    } catch (err) {
      const msj = /Failed to fetch|NetworkError/i.test(err.message) ? "Sin conexión. Probá de nuevo con señal." : err.message;
      setAnulando((a) => (a ? { ...a, enviando: false, error: msj } : a));
    }
  }

  // Lo facturado neto: facturas (aunque después se anulen) menos notas de crédito
  const validas = lista.filter((f) => f.produccion && (f.estado === "emitida" || f.estado === "anulada"));
  const signo = (f) => (Number(f.tipo) === 13 ? -1 : 1);
  const hoy = new Date();
  const mes = validas
    .filter((f) => f.fecha && new Date(f.fecha + "T12:00:00").getMonth() === hoy.getMonth() && new Date(f.fecha + "T12:00:00").getFullYear() === hoy.getFullYear())
    .reduce((s, f) => s + signo(f) * Number(f.total), 0);
  const doceMeses = validas
    .filter((f) => f.fecha && new Date(f.fecha + "T12:00:00") > new Date(hoy.getTime() - 365 * 86400000))
    .reduce((s, f) => s + signo(f) * Number(f.total), 0);

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/admin" className="text-sm text-brand-blue font-medium">
          ← Panel
        </Link>
        <h1 className="text-2xl font-extrabold text-gray-800 mt-1">🧾 Facturas</h1>
        <p className="text-xs text-gray-500 mb-4">Factura C de monotributo, emitida en ARCA con CAE y QR.</p>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-3">
            <p className="text-[11px] text-gray-500">Facturado este mes</p>
            <p className="text-lg font-extrabold text-gray-800">${formatPrice(mes)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-3">
            <p className="text-[11px] text-gray-500">Últimos 12 meses</p>
            <p className="text-lg font-extrabold text-gray-800">${formatPrice(doceMeses)}</p>
            <p className="text-[10px] text-gray-400">Comparalo con el tope de tu categoría</p>
          </div>
        </div>

        <section className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
          <div className="flex justify-between items-center gap-2">
            <div>
              <h2 className="font-bold text-gray-800">Conexión con ARCA</h2>
              <p className="text-[11px] text-gray-500">Revisa todo sin emitir ninguna factura.</p>
            </div>
            <button
              onClick={probar}
              disabled={probando}
              className="bg-brand-blue text-white text-xs font-bold px-3 py-2 rounded-xl disabled:opacity-50"
            >
              {probando ? "Probando..." : "Probar conexión"}
            </button>
          </div>
          {prueba && (
            <ul className="mt-3 space-y-1.5">
              {prueba.pasos.map((p, i) => (
                <li key={i} className={`text-sm rounded-lg px-2.5 py-1.5 ${p.ok ? "bg-green-50" : "bg-red-50"}`}>
                  <b>{p.ok ? "✅" : "❌"} {p.nombre}</b>
                  <span className="block text-[12px] text-gray-700">{p.ok ? p.texto : p.error}</span>
                  {p.detalle && (
                    <details className="text-[10px] text-gray-500">
                      <summary>Detalle técnico</summary>
                      <pre className="whitespace-pre-wrap break-all">{p.detalle}</pre>
                    </details>
                  )}
                </li>
              ))}
              {prueba.listo && (
                <li className="text-sm font-bold text-green-700 pt-1">
                  {prueba.produccion
                    ? "Todo listo para emitir facturas reales."
                    : "Todo listo en modo PRUEBA (las facturas no tienen validez fiscal)."}
                </li>
              )}
            </ul>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
          <h2 className="font-bold text-gray-800">Factura suelta</h2>
          <p className="text-[11px] text-gray-500 mb-2">
            Para una venta que no está cargada como pedido. Los pedidos se facturan desde Pedidos con el botón 🧾.
          </p>
          <form onSubmit={emitirSuelta} className="space-y-2">
            <input
              value={suelta.descripcion}
              onChange={(e) => setSuelta({ ...suelta, descripcion: e.target.value })}
              className="input-field text-sm"
              placeholder="Qué vendiste (ej: Lámpara LED recargable)"
            />
            <input
              value={suelta.total}
              onChange={(e) => setSuelta({ ...suelta, total: e.target.value })}
              inputMode="decimal"
              className="input-field text-sm"
              placeholder="Total $"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={suelta.doc}
                onChange={(e) => setSuelta({ ...suelta, doc: e.target.value })}
                inputMode="numeric"
                className="input-field text-sm"
                placeholder="DNI (opcional)"
              />
              <input
                value={suelta.nombre}
                onChange={(e) => setSuelta({ ...suelta, nombre: e.target.value })}
                className="input-field text-sm"
                placeholder="Nombre (opcional)"
              />
            </div>
            <button disabled={emitiendo} className="btn-primary w-full disabled:opacity-50">
              {emitiendo ? "Pidiendo CAE..." : "Emitir Factura C a consumidor final"}
            </button>
            {mensaje && <p className="text-sm">{mensaje}</p>}
          </form>
        </section>

        <h2 className="font-bold text-gray-800 mb-2">Emitidas</h2>
        {cargando ? (
          <p className="text-sm text-gray-400">Cargando...</p>
        ) : lista.length === 0 ? (
          <p className="text-sm text-gray-500 bg-white rounded-2xl border border-gray-100 p-4">Todavía no hay facturas.</p>
        ) : (
          <div className="space-y-2">
            {lista.map((f) => (
              <div key={f.id} className="bg-white rounded-2xl border border-gray-100 p-3 flex justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-800">
                    {f.estado === "emitida" || f.estado === "anulada"
                      ? `${Number(f.tipo) === 13 ? "Nota de Crédito C" : "Factura C"} ${numeroFactura(f)}`
                      : f.estado === "error"
                      ? `❌ ${Number(f.tipo) === 13 ? "Nota de crédito no emitida" : "No se emitió"}`
                      : "⏳ Emitiendo"}
                    {f.estado === "anulada" && <span className="text-[10px] font-bold text-amber-700 ml-1">ANULADA</span>}
                    {!f.produccion && <span className="text-[10px] font-bold text-red-600 ml-1">PRUEBA</span>}
                  </p>
                  <p className="text-[11px] text-gray-500 truncate">
                    {f.fecha ? new Date(f.fecha + "T12:00:00").toLocaleDateString("es-AR") : new Date(f.creada_en).toLocaleDateString("es-AR")}
                    {" · "}
                    {f.receptor_nombre || "Consumidor final"}
                    {f.detalle?.pedido ? ` · Pedido ${f.detalle.pedido}` : ""}
                    {f.detalle?.anula ? ` · Anula ${f.detalle.anula}` : ""}
                  </p>
                  {f.motivo && <p className="text-[11px] text-gray-500">Motivo: {f.motivo}</p>}
                  {f.estado === "error" && <p className="text-[11px] text-red-600">{f.error}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-extrabold ${Number(f.tipo) === 13 ? "text-red-600" : "text-gray-800"}`}>
                    {Number(f.tipo) === 13 ? "-" : ""}${formatPrice(f.total)}
                  </p>
                  {(f.estado === "emitida" || f.estado === "anulada") && (
                    <>
                      <a href={`/factura/${f.codigo}`} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-brand-blue block">
                        Ver / PDF
                      </a>
                      <a
                        href={linkWhatsApp(f.telefono, f)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-bold text-green-600 block"
                      >
                        📲 Mandar por WhatsApp
                      </a>
                      {f.estado === "emitida" && Number(f.tipo) === 11 && f.produccion && (
                        <button
                          onClick={() => setAnulando({ id: f.id, numero: numeroFactura(f), total: f.total, motivo: "" })}
                          className="text-[11px] font-bold text-red-600 block ml-auto mt-1"
                        >
                          ↩️ Anular
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {anulando && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-3" role="dialog" aria-modal="true">
          <div className="bg-white rounded-3xl w-full max-w-sm p-5">
            <h3 className="font-extrabold text-lg text-gray-800">↩️ Anular factura</h3>
            <p className="text-sm text-gray-600 mt-1">
              Se emite una <b>Nota de Crédito C</b> por <b>${formatPrice(anulando.total)}</b> que anula la Factura C{" "}
              {anulando.numero}.
            </p>
            <input
              value={anulando.motivo}
              onChange={(e) => setAnulando({ ...anulando, motivo: e.target.value })}
              className="input-field text-sm mt-3"
              placeholder="Motivo (opcional). Ej: devolución, error en el importe"
              maxLength={200}
            />
            {anulando.error && (
              <p className="text-xs text-red-600 mt-2" role="alert">
                {anulando.error}
              </p>
            )}
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setAnulando(null)}
                disabled={anulando.enviando}
                className="flex-1 border border-gray-300 rounded-xl py-2.5 text-sm font-semibold text-gray-600"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={anular}
                disabled={anulando.enviando}
                className="flex-1 bg-red-600 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50"
              >
                {anulando.enviando ? "Pidiendo CAE..." : "Emitir nota de crédito"}
              </button>
            </div>
            <p className="text-[10.5px] text-gray-400 mt-2 text-center">
              También se emite en ARCA al instante y no se puede borrar. Después podés volver a facturar el pedido.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}

export default function FacturasPage() {
  return (
    <AdminGuard>
      <Facturas />
    </AdminGuard>
  );
}
