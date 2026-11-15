"use client";

import { useEffect, useState } from "react";
import AdminGuard from "@/components/AdminGuard";
import { supabase } from "@/lib/supabaseClient";
import { useActualizarSolo } from "@/lib/datosFrescos";

// Pedidos legales de los clientes:
//  - Botón de arrepentimiento: hay que contestar dentro de las 24 horas y
//    devolver el dinero (Ley 24.240, art. 34).
//  - Eliminar datos: hay que hacerlo dentro de los 5 días hábiles
//    (Ley 25.326, art. 16). Los pedidos quedan, pero sin nombre ni celular.

function whatsapp(tel) {
  let n = String(tel || "").replace(/\D/g, "");
  if (n.startsWith("54")) n = n.slice(2);
  if (n.startsWith("9")) n = n.slice(1);
  return `https://wa.me/549${n}`;
}

function fecha(iso) {
  return new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function horasDesde(iso) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
}

const ESTADOS_ARR = {
  recibida: { label: "Nueva", clase: "bg-red-100 text-red-800" },
  en_proceso: { label: "En proceso", clase: "bg-amber-100 text-amber-800" },
  resuelta: { label: "Resuelta", clase: "bg-green-100 text-green-800" },
  rechazada: { label: "Fuera de plazo", clase: "bg-gray-200 text-gray-800" }
};

function Solicitudes() {
  const [arrep, setArrep] = useState([]);
  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [trabajando, setTrabajando] = useState(null);

  async function cargar() {
    const [a, d] = await Promise.all([
      supabase.from("solicitudes_arrepentimiento").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("solicitudes_datos").select("*").order("created_at", { ascending: false }).limit(100)
    ]);
    if (a.error || d.error) setError((a.error || d.error).message);
    else setError("");
    setArrep(a.data || []);
    setDatos(d.data || []);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);
  useActualizarSolo(cargar);

  async function cambiarEstado(s, estado) {
    setTrabajando(`a${s.id}`);
    const { error: err } = await supabase
      .from("solicitudes_arrepentimiento")
      .update({ estado, resuelta_en: estado === "resuelta" || estado === "rechazada" ? new Date().toISOString() : null })
      .eq("id", s.id);
    setTrabajando(null);
    if (err) alert("No se pudo guardar: " + err.message);
    cargar();
  }

  async function borrarDatos(s) {
    if (
      !confirm(
        `¿Borrar la cuenta y los datos de ${s.nombre || s.telefono}?\n\n` +
          "Se borran la cuenta, favoritos, avisos y carritos. Los pedidos quedan (los necesitás para la contabilidad) " +
          "pero sin nombre, celular ni dirección. No se puede deshacer."
      )
    )
      return;
    setTrabajando(`d${s.id}`);
    const { data, error: err } = await supabase.rpc("eliminar_datos_cliente", { p_solicitud_id: s.id });
    setTrabajando(null);
    if (err) {
      const m = err.message || "";
      alert(m.includes("PEDIDOS_ABIERTOS") ? m.replace(/^.*PEDIDOS_ABIERTOS:\s*/, "") : "No se pudo: " + m);
    } else {
      alert(`Listo. ${data?.[0]?.pedidos_anonimizados ?? 0} pedidos quedaron sin datos personales.`);
    }
    cargar();
  }

  async function cancelarPedidoDatos(s) {
    if (!confirm("¿Marcar como cancelada? Usalo solo si el cliente te dijo que ya no quiere borrar su cuenta.")) return;
    await supabase.from("solicitudes_datos").update({ estado: "cancelada", resuelta_en: new Date().toISOString() }).eq("id", s.id);
    cargar();
  }

  const nuevas = arrep.filter((s) => s.estado === "recibida").length + datos.filter((s) => s.estado === "pendiente").length;

  return (
    <main className="max-w-2xl mx-auto px-4 py-5 pb-28">
      <h1 className="text-2xl font-extrabold text-gray-900">Solicitudes de clientes</h1>
      <p className="text-sm text-gray-600 mt-1">
        {nuevas > 0 ? `${nuevas} para atender` : "Nada pendiente"} · Arrepentimiento: responder en 24 h · Borrar datos: 5 días hábiles
      </p>
      {error && (
        <p className="mt-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3" role="alert">
          No se pudieron cargar: {error}
        </p>
      )}

      <h2 className="text-lg font-bold text-gray-900 mt-6 mb-2">↩️ Botón de arrepentimiento</h2>
      {cargando ? (
        <p className="text-sm text-gray-600">Cargando...</p>
      ) : arrep.length === 0 ? (
        <p className="text-sm text-gray-600 bg-white rounded-2xl p-4 border border-gray-100">Ninguna por ahora.</p>
      ) : (
        <ul className="space-y-2">
          {arrep.map((s) => {
            const est = ESTADOS_ARR[s.estado] || ESTADOS_ARR.recibida;
            const atrasada = s.estado === "recibida" && horasDesde(s.created_at) >= 20;
            return (
              <li key={s.id} className={`bg-white rounded-2xl p-3 border ${atrasada ? "border-red-400" : "border-gray-100"}`}>
                <div className="flex justify-between gap-2">
                  <p className="font-bold text-gray-900 text-sm">
                    {s.codigo} · {s.nombre}
                  </p>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full h-fit ${est.clase}`}>{est.label}</span>
                </div>
                <p className="text-xs text-gray-600 mt-0.5">
                  {fecha(s.created_at)}
                  {s.numero_pedido ? ` · pedido ${s.numero_pedido}` : ""}
                  {atrasada ? " · ⚠️ ya pasaron casi 24 h" : ""}
                </p>
                {s.detalle && <p className="text-sm text-gray-800 mt-1">{s.detalle}</p>}
                <div className="flex flex-wrap gap-2 mt-2">
                  <a href={whatsapp(s.telefono)} target="_blank" rel="noopener noreferrer" className="text-xs font-bold bg-green-600 text-white rounded-lg px-3 py-2">
                    WhatsApp
                  </a>
                  {s.estado !== "en_proceso" && s.estado !== "resuelta" && (
                    <button disabled={trabajando} onClick={() => cambiarEstado(s, "en_proceso")} className="text-xs font-bold border border-amber-400 text-amber-800 rounded-lg px-3 py-2">
                      En proceso
                    </button>
                  )}
                  {s.estado !== "resuelta" && (
                    <button disabled={trabajando} onClick={() => cambiarEstado(s, "resuelta")} className="text-xs font-bold border border-green-500 text-green-800 rounded-lg px-3 py-2">
                      Devuelto / resuelto
                    </button>
                  )}
                  {s.estado === "recibida" && (
                    <button disabled={trabajando} onClick={() => cambiarEstado(s, "rechazada")} className="text-xs font-bold border border-gray-300 text-gray-700 rounded-lg px-3 py-2">
                      Fuera de plazo
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <h2 className="text-lg font-bold text-gray-900 mt-6 mb-2">🗑️ Borrar cuenta y datos</h2>
      {cargando ? null : datos.length === 0 ? (
        <p className="text-sm text-gray-600 bg-white rounded-2xl p-4 border border-gray-100">Ninguna por ahora.</p>
      ) : (
        <ul className="space-y-2">
          {datos.map((s) => (
            <li key={s.id} className="bg-white rounded-2xl p-3 border border-gray-100">
              <div className="flex justify-between gap-2">
                <p className="font-bold text-gray-900 text-sm">{s.nombre || "Cliente"}</p>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full h-fit ${
                    s.estado === "pendiente" ? "bg-red-100 text-red-800" : s.estado === "hecha" ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-800"
                  }`}
                >
                  {s.estado === "pendiente" ? "Pendiente" : s.estado === "hecha" ? "Borrado" : "Cancelada"}
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-0.5">
                {fecha(s.created_at)}
                {s.estado === "pendiente" ? ` · ${s.telefono}` : ""}
              </p>
              {s.motivo && <p className="text-sm text-gray-800 mt-1">{s.motivo}</p>}
              {s.estado === "pendiente" && (
                <div className="flex flex-wrap gap-2 mt-2">
                  <button disabled={trabajando} onClick={() => borrarDatos(s)} className="text-xs font-bold bg-red-600 text-white rounded-lg px-3 py-2">
                    {trabajando === `d${s.id}` ? "Borrando..." : "Borrar sus datos"}
                  </button>
                  <a href={whatsapp(s.telefono)} target="_blank" rel="noopener noreferrer" className="text-xs font-bold border border-green-600 text-green-800 rounded-lg px-3 py-2">
                    WhatsApp
                  </a>
                  <button disabled={trabajando} onClick={() => cancelarPedidoDatos(s)} className="text-xs font-bold border border-gray-300 text-gray-700 rounded-lg px-3 py-2">
                    Ya no quiere
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export default function SolicitudesPage() {
  return (
    <AdminGuard>
      <Solicitudes />
    </AdminGuard>
  );
}
