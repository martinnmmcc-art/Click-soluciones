"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import { supabase } from "@/lib/supabaseClient";
import { formatPrice } from "@/lib/whatsapp";
import { nombreCategoria } from "@/lib/categorias";

function ListaProductos() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);

  async function cargarProductos() {
    setLoading(true);
    const { data, error } = await supabase
      .from("Productos")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) console.error(error.message);
    setProductos(data || []);
    setLoading(false);
  }

  useEffect(() => {
    cargarProductos();
  }, []);

  async function handleEliminar(id) {
    if (!confirm("¿Seguro que querés eliminar este producto?")) return;
    const { error } = await supabase.from("Productos").delete().eq("id", id);
    if (error) {
      alert("No se pudo eliminar: " + error.message);
      return;
    }
    setProductos((prev) => prev.filter((p) => p.id !== id));
  }

  const conStockBajo = productos.filter(
    (p) => Number(p.stock || 0) <= Number(p.stock_minimo ?? 3)
  ).length;

  return (
    <main className="min-h-screen bg-brand-bg">
      <div className="container-app px-4 py-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <Link href="/admin" className="text-sm text-brand-blue font-medium">
              ← Panel
            </Link>
            <h1 className="font-extrabold text-xl text-gray-800 mt-1">
              Productos
            </h1>
          </div>
          <Link href="/admin/productos/nuevo" className="btn-primary">
            + Nuevo
          </Link>
        </div>

        <Link
          href="/admin/pedido-proveedor"
          className="flex items-center justify-between bg-orange-50 border border-orange-200 text-orange-700 rounded-xl px-4 py-3 mb-5 font-semibold text-sm"
        >
          📋 Pedido a proveedor
          {conStockBajo > 0 && (
            <span className="bg-orange-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
              {conStockBajo} con stock bajo
            </span>
          )}
        </Link>

        {loading ? (
          <p className="text-center text-gray-400 py-10">Cargando...</p>
        ) : productos.length === 0 ? (
          <div className="card p-6 text-center text-gray-500">
            Todavía no hay productos cargados.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {productos.map((p) => {
              const stockBajo = Number(p.stock || 0) <= Number(p.stock_minimo ?? 3);
              return (
                <div key={p.id} className="card p-3 flex gap-3 items-center">
                  <div className="w-14 h-14 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                    {p.imagen_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.imagen_url}
                        alt={p.nombre}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xl">📦</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-800 truncate">
                      {p.nombre}
                    </p>
                    <p className="text-xs text-gray-500">
                      {nombreCategoria(p.categoria)} ·{" "}
                      <span className={stockBajo ? "text-orange-600 font-bold" : ""}>
                        Stock: {p.stock}
                        {stockBajo && " ⚠️"}
                      </span>
                      {!p.activo && " · Inactivo"}
                    </p>
                    <p className="text-brand-blueDark font-bold text-sm mt-0.5">
                      ${formatPrice(p.precio_oferta || p.precio)}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <Link
                      href={`/admin/productos/${p.id}`}
                      className="text-xs font-semibold text-brand-blue"
                    >
                      Editar
                    </Link>
                    <button
                      onClick={() => handleEliminar(p.id)}
                      className="text-xs font-semibold text-red-500"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

export default function AdminProductosPage() {
  return (
    <AdminGuard>
      <ListaProductos />
    </AdminGuard>
  );
}
