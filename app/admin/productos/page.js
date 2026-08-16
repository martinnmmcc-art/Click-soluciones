"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AdminGuard from "@/components/AdminGuard";
import { supabase } from "@/lib/supabaseClient";
import { formatPrice } from "@/lib/whatsapp";
import { nombreCategoria } from "@/lib/categorias";

function ListaProductos() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filtro = searchParams.get("filtro"); // "sin-stock" | null
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [duplicandoId, setDuplicandoId] = useState(null);
  const [exportando, setExportando] = useState(false);

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

  async function handleDuplicar(producto) {
    setDuplicandoId(producto.id);
    try {
      const copia = { ...producto };
      delete copia.id;
      delete copia.created_at;
      copia.nombre = `${producto.nombre} (copia)`;
      copia.stock = 0;

      const { data, error } = await supabase.from("Productos").insert(copia).select().single();
      if (error) throw new Error(error.message);

      router.push(`/admin/productos/${data.id}`);
    } catch (e) {
      alert("No se pudo duplicar: " + e.message);
    } finally {
      setDuplicandoId(null);
    }
  }

  async function handleExportar() {
    setExportando(true);
    try {
      const XLSX = await import("xlsx");
      const filas = productos.map((p) => ({
        ID: p.id,
        Nombre: p.nombre,
        Categoría: nombreCategoria(p.categoria),
        Precio: p.precio,
        "Precio Oferta": p.precio_oferta || "",
        Costo: p.costo || "",
        Stock: p.stock ?? "",
        "A pedido": p.bajo_pedido ? "Sí" : "No",
        Activo: p.activo ? "Sí" : "No",
        Destacado: p.destacado ? "Sí" : "No"
      }));

      const hoja = XLSX.utils.json_to_sheet(filas);
      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, hoja, "Productos");
      XLSX.writeFile(libro, `productos-bolson-click-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
      alert("No se pudo exportar: " + e.message);
    } finally {
      setExportando(false);
    }
  }

  const conStockBajo = productos.filter(
    (p) => Number(p.stock || 0) <= Number(p.stock_minimo ?? 3)
  ).length;

  const productosMostrados =
    filtro === "sin-stock"
      ? productos.filter((p) => !p.bajo_pedido && p.stock !== null && Number(p.stock) <= 0)
      : productos;

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

        <button
          onClick={handleExportar}
          disabled={exportando || productos.length === 0}
          className="w-full flex items-center justify-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 mb-5 font-semibold text-sm disabled:opacity-50"
        >
          📊 {exportando ? "Generando..." : "Exportar catálogo a Excel"}
        </button>

        {filtro === "sin-stock" && (
          <div className="flex items-center justify-between bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 mb-4 text-sm font-semibold">
            <span>Mostrando solo productos sin stock ({productosMostrados.length})</span>
            <Link href="/admin/productos" className="underline text-xs">
              Ver todos
            </Link>
          </div>
        )}

        {loading ? (
          <p className="text-center text-gray-400 py-10">Cargando...</p>
        ) : productosMostrados.length === 0 ? (
          <div className="card p-6 text-center text-gray-500">
            {filtro === "sin-stock" ? "No tenés productos sin stock 🎉" : "Todavía no hay productos cargados."}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {productosMostrados.map((p) => {
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
                      onClick={() => handleDuplicar(p)}
                      disabled={duplicandoId === p.id}
                      className="text-xs font-semibold text-gray-500 disabled:opacity-50"
                    >
                      {duplicandoId === p.id ? "Duplicando..." : "Duplicar"}
                    </button>
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
      <Suspense fallback={<div className="text-center text-gray-400 py-16">Cargando...</div>}>
        <ListaProductos />
      </Suspense>
    </AdminGuard>
  );
}
