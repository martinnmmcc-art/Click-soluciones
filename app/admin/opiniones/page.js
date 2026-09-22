"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import Estrellas from "@/components/Estrellas";
import { supabase } from "@/lib/supabaseClient";
import { etiquetaAspecto } from "@/lib/opiniones";
import { useActualizarSolo } from "@/lib/datosFrescos";

// Opiniones de los clientes sobre la tienda (compra, atención, entrega, app).
// Llegan "Para revisar" y no se ven en la app hasta que las publicás.
// Podés publicarlas, ocultarlas, destacarlas (van primero en el inicio),
// responderlas públicamente o escribirle al cliente por WhatsApp.

const VISTAS = [
  { valor: "pendiente", etiqueta: "Para revisar", activa: "bg-amber-600 text-white" },
  { valor: "publicada", etiqueta: "Publicadas", activa: "bg-green-600 text-white" },
  { valor: "oculta", etiqueta: "Ocultas", activa: "bg-gray-700 text-white" }
];

function whatsapp(tel) {
  let n = String(tel || "").replace(/\D/g, "");
  if (n.startsWith("54")) n = n.slice(2);
  if (n.startsWith("9")) n = n.slice(1);
  return `https://wa.me/549${n}`;
}

function fecha(iso) {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function Opiniones() {
  const [opiniones, setOpiniones] = useState([]);
  const [vista, setVista] = useState("pendiente");
  const [cargando, setCargando] = useState(true);
  const [respondiendo, setRespondiendo] = useState(null);
  const [textoRespuesta, setTextoRespuesta] = useState("");
  const [trabajandoId, setTrabajandoId] = useState(null);

  async function cargar() {
    const { data, error } = await supabase
      .from("opiniones_tienda")
      .select("*, pedidos(numero_pedido, total)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    setOpiniones(data || []);
    setCargando(false);
  }

  useEffect(() => {
    cargar().catch(() => setCargando(false));
  }, []);

  // Llegan solas cuando un cliente opina (datos en vivo del panel)
  useActualizarSolo(cargar);

  async function actualizar(o, cambios) {
    setTrabajandoId(o.id);
    const { error } = await supabase
      .from("opiniones_tienda")
      .update({ ...cambios, revisada_at: new Date().toISOString() })
      .eq("id", o.id);
    setTrabajandoId(null);
    if (error) return alert("No se pudo guardar: " + error.message);
    await cargar();
  }

  async function eliminar(o) {
    if (!window.confirm(`¿Eliminar la opinión de ${o.nombre}? No se puede deshacer.`)) return;
    setTrabajandoId(o.id);
    const { error } = await supabase.from("opiniones_tienda").delete().eq("id", o.id);
    setTrabajandoId(null);
    if (error) return alert("No se pudo eliminar: " + error.message);
    await cargar();
  }

  async function guardarRespuesta(o) {
    await actualizar(o, {
      respuesta: textoRespuesta.trim() || null,
      respondida_at: textoRespuesta.trim() ? new Date().toISOString() : null
    });
    setRespondiendo(null);
    setTextoRespuesta("");
  }

  const cuenta = (estado) => opiniones.filter((o) => o.estado === estado).length;
  const lista = opiniones.filter((o) => o.estado === vista);

  const publicadas = opiniones.filter((o) => o.estado === "publicada");
  const promedio = publicadas.length
    ? publicadas.reduce((a, o) => a + o.estrellas, 0) / publicadas.length
    : 0;

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-extrabold text-gray-800">Opiniones sobre la tienda</h1>
        <p className="text-xs text-gray-500 mb-1">
          Lo que dicen los clientes de la compra, la atención y la app. Vos elegís cuáles se ven.
        </p>
        {publicadas.length > 0 && (
          <p className="text-xs text-gray-600 mb-4 flex items-center gap-1">
            En la app: <Estrellas valor={promedio} tamano="text-xs" />
            <b>{promedio.toFixed(1)}</b> con {publicadas.length} publicada{publicadas.length === 1 ? "" : "s"}
          </p>
        )}
        <p className="text-xs mb-4">
          <Link href="/admin/resenas" className="text-brand-blue font-semibold">
            Ver opiniones de productos →
          </Link>
        </p>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {VISTAS.map((v) => (
            <button
              key={v.valor}
              onClick={() => setVista(v.valor)}
              className={`py-2 rounded-xl text-xs font-bold relative ${
                vista === v.valor ? v.activa : "bg-white border border-gray-200 text-gray-600"
              }`}
            >
              {v.etiqueta} ({cuenta(v.valor)})
              {v.valor === "pendiente" && cuenta("pendiente") > 0 && vista !== "pendiente" && (
                <span className="absolute -top-1 -right-1 bg-red-600 w-2.5 h-2.5 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {cargando ? (
          <p className="text-center text-gray-400 py-10">Cargando...</p>
        ) : lista.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center border border-gray-100">
            <p className="text-sm text-gray-600">
              {vista === "pendiente"
                ? "No hay opiniones nuevas para revisar. 🙌"
                : vista === "publicada"
                  ? "Todavía no publicaste ninguna."
                  : "No hay opiniones ocultas."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {lista.map((o) => (
              <div
                key={o.id}
                className={`bg-white rounded-2xl p-4 border ${
                  o.destacada ? "border-amber-300" : o.estrellas <= 2 ? "border-red-200" : "border-gray-100"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Estrellas valor={o.estrellas} tamano="text-lg" />
                    <p className="text-sm font-bold text-gray-800 mt-1">
                      {o.nombre}
                      {o.localidad && <span className="font-normal text-gray-500"> · {o.localidad}</span>}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {fecha(o.created_at)}
                      {o.pedidos?.numero_pedido && ` · Pedido ${o.pedidos.numero_pedido}`}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {o.verificada ? (
                      <span className="text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                        ✓ Compró
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">
                        Sin compra entregada
                      </span>
                    )}
                    {o.destacada && (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                        ⭐ Destacada
                      </span>
                    )}
                  </div>
                </div>

                {o.texto ? (
                  <p className="text-sm text-gray-700 mt-2 whitespace-pre-line">“{o.texto}”</p>
                ) : (
                  <p className="text-xs text-gray-400 mt-2 italic">Solo puso estrellas, sin comentario.</p>
                )}

                {o.aspectos?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {o.aspectos.map((a) => (
                      <span key={a} className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {etiquetaAspecto(a)}
                      </span>
                    ))}
                  </div>
                )}

                {/* Respuesta pública */}
                {respondiendo === o.id ? (
                  <div className="mt-3">
                    <textarea
                      value={textoRespuesta}
                      onChange={(e) => setTextoRespuesta(e.target.value.slice(0, 600))}
                      rows={3}
                      className="w-full text-sm border border-gray-200 rounded-xl p-2"
                      placeholder="Ej: ¡Gracias Angela! Nos alegra que te haya gustado 🙌"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => guardarRespuesta(o)}
                        className="flex-1 py-2 rounded-xl bg-brand-blue text-white text-xs font-bold"
                      >
                        Guardar respuesta
                      </button>
                      <button
                        onClick={() => setRespondiendo(null)}
                        className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-xs font-bold"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  o.respuesta && (
                    <div className="mt-3 bg-blue-50 rounded-xl p-2.5">
                      <p className="text-[11px] font-bold text-brand-blue">Tu respuesta (se ve en la app)</p>
                      <p className="text-sm text-gray-700">{o.respuesta}</p>
                    </div>
                  )
                )}

                {/* Acciones */}
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {o.estado !== "publicada" ? (
                    <button
                      onClick={() => actualizar(o, { estado: "publicada" })}
                      disabled={trabajandoId === o.id}
                      className="py-2 rounded-xl bg-green-600 text-white text-xs font-bold disabled:opacity-50"
                    >
                      ✓ Publicar en la app
                    </button>
                  ) : (
                    <button
                      onClick={() => actualizar(o, { estado: "oculta", destacada: false })}
                      disabled={trabajandoId === o.id}
                      className="py-2 rounded-xl bg-gray-700 text-white text-xs font-bold disabled:opacity-50"
                    >
                      🙈 Ocultar de la app
                    </button>
                  )}

                  {o.estado === "pendiente" ? (
                    <button
                      onClick={() => actualizar(o, { estado: "oculta" })}
                      disabled={trabajandoId === o.id}
                      className="py-2 rounded-xl bg-white border border-gray-300 text-gray-700 text-xs font-bold disabled:opacity-50"
                    >
                      🙈 No mostrar
                    </button>
                  ) : o.estado === "publicada" ? (
                    <button
                      onClick={() => actualizar(o, { destacada: !o.destacada })}
                      disabled={trabajandoId === o.id}
                      className={`py-2 rounded-xl text-xs font-bold border disabled:opacity-50 ${
                        o.destacada
                          ? "bg-amber-500 text-white border-amber-500"
                          : "bg-white text-amber-700 border-amber-300"
                      }`}
                    >
                      {o.destacada ? "⭐ Quitar destacado" : "⭐ Destacar primero"}
                    </button>
                  ) : (
                    <button
                      onClick={() => eliminar(o)}
                      disabled={trabajandoId === o.id}
                      className="py-2 rounded-xl bg-white border border-red-200 text-red-600 text-xs font-bold disabled:opacity-50"
                    >
                      🗑 Eliminar
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setRespondiendo(o.id);
                      setTextoRespuesta(o.respuesta || "");
                    }}
                    className="py-2 rounded-xl bg-white border border-blue-200 text-brand-blue text-xs font-bold"
                  >
                    💬 {o.respuesta ? "Editar respuesta" : "Responder"}
                  </button>

                  {o.telefono ? (
                    <a
                      href={whatsapp(o.telefono)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2 rounded-xl bg-white border border-green-300 text-green-700 text-xs font-bold text-center"
                    >
                      WhatsApp al cliente
                    </a>
                  ) : (
                    <span className="py-2 rounded-xl bg-gray-50 text-gray-400 text-xs font-bold text-center">
                      Sin celular
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function OpinionesPage() {
  return (
    <AdminGuard>
      <Opiniones />
    </AdminGuard>
  );
}
