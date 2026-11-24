"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AdminGuard from "@/components/AdminGuard";
import AdminOpinionesTienda from "@/components/AdminOpinionesTienda";
import AdminOpinionesProductos from "@/components/AdminOpinionesProductos";
import { supabase } from "@/lib/supabaseClient";

// Todas las opiniones en un solo lugar:
//  - "Tienda y app": lo que opinan de la compra, la atención y la app.
//  - "Productos": lo que opinan de un producto puntual.
// En la app los clientes ven las dos juntas en la página "Opiniones".

const PESTANAS = [
  { valor: "tienda", etiqueta: "🏪 Tienda y app" },
  { valor: "productos", etiqueta: "📦 Productos" }
];

function Opiniones() {
  const params = useSearchParams();
  const router = useRouter();
  const pestana = params.get("ver") === "productos" ? "productos" : "tienda";
  const [porRevisar, setPorRevisar] = useState({ tienda: 0, productos: 0 });

  // Cuántas esperan revisión en cada pestaña (punto rojo)
  useEffect(() => {
    Promise.all([
      supabase.from("opiniones_tienda").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
      supabase.from("resenas").select("id", { count: "exact", head: true }).eq("aprobada", false)
    ])
      .then(([t, p]) => setPorRevisar({ tienda: t.count || 0, productos: p.count || 0 }))
      .catch(() => {});
  }, [pestana]);

  function elegir(valor) {
    router.replace(valor === "productos" ? "/admin/opiniones?ver=productos" : "/admin/opiniones", { scroll: false });
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/admin" className="text-sm text-brand-blue font-medium">
          ← Panel
        </Link>
        <h1 className="text-2xl font-extrabold text-gray-800 mt-1">⭐ Opiniones</h1>
        <p className="text-xs text-gray-500 mb-3">
          Todas las opiniones de tus clientes. En la app se ven juntas en la página “Opiniones”.
        </p>

        <div className="grid grid-cols-2 gap-1 bg-gray-200 rounded-2xl p-1 mb-4">
          {PESTANAS.map((p) => (
            <button
              key={p.valor}
              onClick={() => elegir(p.valor)}
              className={`relative py-2.5 rounded-xl text-sm font-bold transition ${
                pestana === p.valor ? "bg-white text-gray-900 shadow" : "text-gray-600"
              }`}
            >
              {p.etiqueta}
              {porRevisar[p.valor] > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px]">
                  {porRevisar[p.valor]}
                </span>
              )}
            </button>
          ))}
        </div>

        {pestana === "productos" ? <AdminOpinionesProductos /> : <AdminOpinionesTienda />}
      </div>
    </main>
  );
}

export default function OpinionesPage() {
  return (
    <AdminGuard>
      <Suspense fallback={null}>
        <Opiniones />
      </Suspense>
    </AdminGuard>
  );
}
