"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";

function Referidos() {
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function cargar() {
      try {
        const res = await fetch("/api/admin/referidos");
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

  return (
    <main className="min-h-screen bg-brand-bg pb-16">
      <div className="container-app px-4 py-6">
        <Link href="/admin" className="text-sm text-brand-blue font-medium">
          ← Panel
        </Link>
        <h1 className="font-extrabold text-xl text-gray-800 mt-1 mb-5">
          🎁 Referidos
        </h1>

        {loading ? (
          <p className="text-center text-gray-400 py-10">Cargando...</p>
        ) : error ? (
          <div className="card p-4 text-center text-red-500 text-sm bg-red-50 border border-red-200">{error}</div>
        ) : datos.total === 0 ? (
          <div className="card p-6 text-center text-gray-500">
            Todavía nadie se registró con un link de referido.
          </div>
        ) : (
          <>
            <div className="card p-4 mb-5 bg-amber-50 border border-amber-200">
              <p className="text-amber-800 text-sm font-bold">{datos.total} clientes llegaron por referido</p>
            </div>

            <h2 className="font-bold text-sm text-gray-800 mb-3">🏆 Ranking de referentes</h2>
            <div className="flex flex-col gap-2 mb-6">
              {datos.ranking.map((r, i) => (
                <div key={r.telefono} className="card p-3 flex items-center gap-3">
                  <span className="text-gray-400 font-bold w-5">{i + 1}°</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {r.nombre || "Cliente sin nombre"}
                    </p>
                    <p className="text-xs text-gray-500">📱 {r.telefono}</p>
                  </div>
                  <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full">
                    {r.cantidad} referido{r.cantidad !== 1 ? "s" : ""}
                  </span>
                </div>
              ))}
            </div>

            <h2 className="font-bold text-sm text-gray-800 mb-3">📋 Detalle de cada referido</h2>
            <div className="flex flex-col gap-2">
              {datos.referidos.map((r) => (
                <div key={r.id} className="card p-3">
                  <p className="text-sm font-semibold text-gray-800">{r.nombre}</p>
                  <p className="text-xs text-gray-500">📱 {r.telefono}</p>
                  <p className="text-xs text-amber-700 font-semibold mt-1">
                    🎁 Invitado por: {r.referente.nombre || r.referente.telefono}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Se registró el {new Date(r.created_at).toLocaleDateString("es-AR")}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default function ReferidosPage() {
  return (
    <AdminGuard>
      <Referidos />
    </AdminGuard>
  );
}
