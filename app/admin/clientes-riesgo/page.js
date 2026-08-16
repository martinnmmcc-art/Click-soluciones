"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";

function ClientesRiesgo() {
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function cargar() {
      try {
        const res = await fetch("/api/admin/clientes-riesgo");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setDatos(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    cargar();
  }, []);

  function linkWhatsapp(telefono, nombre) {
    const numero = telefono.replace(/\D/g, "");
    const mensaje = encodeURIComponent(
      `¡Hola ${nombre?.split(" ")[0] || ""}! 👋 Somos Bolson Click. Te extrañamos por acá, ¿viste las novedades que sumamos? Cualquier cosa que necesites, contanos.`
    );
    return `https://wa.me/549${numero}?text=${mensaje}`;
  }

  return (
    <main className="min-h-screen bg-brand-bg pb-16">
      <div className="container-app px-4 py-6">
        <Link href="/admin" className="text-sm text-brand-blue font-medium">
          ← Panel
        </Link>
        <h1 className="font-extrabold text-xl text-gray-800 mt-1 mb-1">
          😴 Clientes en riesgo
        </h1>
        <p className="text-sm text-gray-500 mb-5">
          Compraron al menos una vez y no volvieron a pedir hace 30 días o más.
        </p>

        {loading ? (
          <p className="text-center text-gray-400 py-10">Cargando...</p>
        ) : error ? (
          <div className="card p-4 text-center text-red-500 text-sm bg-red-50 border border-red-200">{error}</div>
        ) : datos.clientes.length === 0 ? (
          <div className="card p-6 text-center text-gray-500">
            🎉 Todos tus clientes compraron en los últimos {datos.umbralDias} días.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {datos.clientes.map((c) => (
              <div key={c.telefono} className="card p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-800">{c.nombre || "Cliente"}</p>
                  <span className="bg-gray-100 text-gray-600 text-[11px] font-bold px-2 py-0.5 rounded-full">
                    {c.diasSinComprar} días sin comprar
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">📱 {c.telefono}</p>
                {c.localidad && <p className="text-xs text-gray-500">📍 {c.localidad}</p>}
                <p className="text-xs text-gray-500">
                  {c.cantidad} pedido{c.cantidad !== 1 ? "s" : ""} · ${c.totalGastado.toLocaleString("es-AR")} gastado
                </p>
                <a
                  href={linkWhatsapp(c.telefono, c.nombre)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2 bg-green-50 border border-green-200 text-green-700 text-xs font-bold px-3 py-1.5 rounded-lg"
                >
                  💬 Escribirle por WhatsApp
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function ClientesRiesgoPage() {
  return (
    <AdminGuard>
      <ClientesRiesgo />
    </AdminGuard>
  );
}
