"use client";

import { useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";

const PLANTILLAS = [
  { label: "🆕 Producto nuevo", titulo: "¡Llegó algo nuevo a Bolson Click!", mensaje: "Sumamos productos nuevos al catálogo. Entrá a ver las novedades." },
  { label: "🔥 Oferta", titulo: "Oferta especial en Bolson Click", mensaje: "Tenemos descuentos por tiempo limitado. Aprovechá antes de que se agoten." },
  { label: "⏰ Recordatorio", titulo: "Te extrañamos por Bolson Click", mensaje: "Todavía tenemos lo que buscabas. Date una vuelta por el catálogo." }
];

function EnviarNotificacion() {
  const [titulo, setTitulo] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [url, setUrl] = useState("/");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState("");

  function usarPlantilla(p) {
    setTitulo(p.titulo);
    setMensaje(p.mensaje);
  }

  async function enviar() {
    if (!titulo.trim() || !mensaje.trim()) {
      setError("Completá título y mensaje.");
      return;
    }
    setError("");
    setEnviando(true);
    setResultado(null);
    try {
      const res = await fetch("/api/push/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo, mensaje, url })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al enviar");
      setResultado(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="min-h-screen bg-brand-bg pb-16">
      <div className="container-app px-4 py-6">
        <Link href="/admin" className="text-sm text-brand-blue font-medium">
          ← Panel
        </Link>
        <h1 className="font-extrabold text-xl text-gray-800 mt-1 mb-5">
          Enviar notificación
        </h1>

        <div className="card p-4 mb-4">
          <p className="text-xs font-semibold text-gray-600 mb-2">Plantillas rápidas</p>
          <div className="flex flex-col gap-2">
            {PLANTILLAS.map((p) => (
              <button
                key={p.label}
                onClick={() => usarPlantilla(p)}
                className="text-left text-sm bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl px-3 py-2"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card p-4 mb-4 space-y-3">
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1">Título</label>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="input-field" placeholder="Ej: Oferta especial" />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1">Mensaje</label>
            <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={3} className="input-field resize-none" placeholder="Ej: 20% off en iluminación esta semana" />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1">Al tocarla, abrir (opcional)</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} className="input-field" placeholder="/catalogo" />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3 mb-4">{error}</div>
        )}

        {resultado && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl p-3 mb-4">
            Enviado a {resultado.enviados} de {resultado.total} suscriptos.
            {resultado.vencidos > 0 && ` (${resultado.vencidos} suscripciones vencidas se limpiaron solas)`}
          </div>
        )}

        <button onClick={enviar} disabled={enviando} className="btn-primary w-full disabled:opacity-50">
          {enviando ? "Enviando..." : "📤 Enviar notificación"}
        </button>
      </div>
    </main>
  );
}

export default function NotificacionesPage() {
  return (
    <AdminGuard>
      <EnviarNotificacion />
    </AdminGuard>
  );
}
