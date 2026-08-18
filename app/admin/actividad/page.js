"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import { supabase } from "@/lib/supabaseClient";
import { formatPrice } from "@/lib/whatsapp";

const ICONOS = {
  registro: { emoji: "🎉", texto: "Se registró", color: "bg-green-50 border-green-200" },
  carrito: { emoji: "🛒", texto: "Agregó al carrito", color: "bg-blue-50 border-blue-200" },
  carrito_quitar: { emoji: "➖", texto: "Sacó del carrito", color: "bg-gray-50 border-gray-200" },
  pedido_nuevo: { emoji: "💰", texto: "Hizo un pedido", color: "bg-amber-50 border-amber-300" },
  pedido_modificado: { emoji: "✏️", texto: "Modificó su pedido", color: "bg-blue-50 border-blue-200" },
  pedido_agregado: { emoji: "➕", texto: "Sumó al pedido", color: "bg-green-50 border-green-200" },
  pedido_cancelado: { emoji: "❌", texto: "Canceló su pedido", color: "bg-red-50 border-red-200" },
  comprobante: { emoji: "📎", texto: "Subió comprobante", color: "bg-purple-50 border-purple-200" }
};

const FILTROS = [
  { id: "todos", label: "Todo" },
  { id: "ventas", label: "Ventas", tipos: ["pedido_nuevo", "pedido_agregado", "comprobante"] },
  { id: "clientes", label: "Clientes", tipos: ["registro"] },
  { id: "carrito", label: "Carrito", tipos: ["carrito", "carrito_quitar"] }
];

function telefonoParaWhatsapp(tel) {
  let limpio = (tel || "").replace(/\D/g, "");
  if (limpio.startsWith("54")) limpio = limpio.slice(2);
  if (limpio.startsWith("9")) limpio = limpio.slice(1);
  return `549${limpio}`;
}

function tiempoRelativo(fecha) {
  const ahora = new Date();
  const d = new Date(fecha);
  const seg = Math.floor((ahora - d) / 1000);

  if (seg < 60) return "recién";
  if (seg < 3600) return `hace ${Math.floor(seg / 60)} min`;
  if (seg < 86400) return `hace ${Math.floor(seg / 3600)} h`;
  if (seg < 172800) return "ayer";
  return d.toLocaleDateString("es-AR");
}

function Actividad() {
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("todos");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from("eventos_actividad")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(150);
    setEventos(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Se refresca solo cada 30 segundos, para ver la actividad casi en vivo
  useEffect(() => {
    if (!autoRefresh) return;
    const intervalo = setInterval(cargar, 30000);
    return () => clearInterval(intervalo);
  }, [autoRefresh, cargar]);

  const filtroActivo = FILTROS.find((f) => f.id === filtro);
  const eventosFiltrados = eventos.filter((e) => {
    if (filtro === "todos") return true;
    return filtroActivo?.tipos?.includes(e.tipo);
  });

  function mensajeWhatsapp(e) {
    const nombre = e.nombre && e.nombre !== "Visitante sin cuenta" ? e.nombre : "";
    if (e.tipo === "carrito") {
      return `¡Hola ${nombre}! 👋 Vi que estabas mirando ${e.detalle} en Bolson Click. ¿Te ayudo con algo o querés que te lo reserve?`;
    }
    if (e.tipo === "pedido_nuevo") {
      return `¡Hola ${nombre}! 👋 Recibimos tu pedido en Bolson Click 🛍️ Te escribo para coordinar el pago y la entrega.`;
    }
    if (e.tipo === "registro") {
      return `¡Hola ${nombre}! 👋 Bienvenido/a a Bolson Click 🛍️ Cualquier consulta escribime por acá.`;
    }
    if (e.tipo === "pedido_cancelado") {
      return `¡Hola ${nombre}! 👋 Vi que cancelaste tu pedido en Bolson Click. ¿Pasó algo o puedo ayudarte con otra cosa?`;
    }
    return `¡Hola ${nombre}! 👋 Te escribo de Bolson Click 🛍️`;
  }

  return (
    <main className="min-h-screen bg-brand-bg pb-16">
      <div className="container-app px-4 py-6">
        <Link href="/admin" className="text-sm text-brand-blue font-medium">
          ← Panel
        </Link>

        <div className="flex items-center justify-between mt-1 mb-4">
          <h1 className="font-extrabold text-xl text-gray-800">Actividad en vivo</h1>
          <button
            onClick={cargar}
            className="text-sm text-brand-blue font-medium"
          >
            🔄 Actualizar
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-3">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${
                filtro === f.id
                  ? "bg-brand-blue text-white"
                  : "bg-white text-gray-600 border border-gray-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-xs text-gray-500 mb-4">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          Actualizar solo cada 30 segundos
        </label>

        {loading ? (
          <p className="text-center text-gray-400 py-10">Cargando actividad...</p>
        ) : eventosFiltrados.length === 0 ? (
          <div className="card p-6 text-center text-gray-500 text-sm">
            Todavía no hay actividad registrada acá.
          </div>
        ) : (
          <div className="space-y-2">
            {eventosFiltrados.map((e) => {
              const info = ICONOS[e.tipo] || { emoji: "•", texto: e.tipo, color: "bg-white border-gray-200" };
              const tieneTelefono = e.telefono && e.telefono.length >= 8;

              return (
                <div key={e.id} className={`border rounded-xl p-3 ${info.color}`}>
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800">
                        {info.emoji} {info.texto}
                      </p>
                      <p className="text-xs text-gray-700 mt-0.5">
                        {e.nombre || "Sin nombre"}
                        {e.telefono && <span className="text-gray-500"> · {e.telefono}</span>}
                      </p>
                      {e.detalle && (
                        <p className="text-xs text-gray-600 mt-0.5">{e.detalle}</p>
                      )}
                      {e.monto && (
                        <p className="text-xs font-bold text-gray-800 mt-0.5">
                          ${formatPrice(e.monto)}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap">
                      {tiempoRelativo(e.created_at)}
                    </span>
                  </div>

                  {tieneTelefono && (
                    <a
                      href={`https://wa.me/${telefonoParaWhatsapp(e.telefono)}?text=${encodeURIComponent(mensajeWhatsapp(e))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg mt-2"
                    >
                      💬 Escribirle por WhatsApp
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

export default function ActividadPage() {
  return (
    <AdminGuard>
      <Actividad />
    </AdminGuard>
  );
}
