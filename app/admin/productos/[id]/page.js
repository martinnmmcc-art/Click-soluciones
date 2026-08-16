"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import ProductoForm from "@/components/ProductoForm";
import { supabase } from "@/lib/supabaseClient";

function EditarProducto() {
  const { id } = useParams();
  const router = useRouter();
  const [producto, setProducto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [historial, setHistorial] = useState([]);

  useEffect(() => {
    async function fetchProducto() {
      const { data, error } = await supabase
        .from("Productos")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) console.error(error.message);
      setProducto(data);
      setLoading(false);
    }
    if (id) fetchProducto();
  }, [id]);

  useEffect(() => {
    async function fetchHistorial() {
      const { data } = await supabase
        .from("historial_precios")
        .select("*")
        .eq("producto_id", id)
        .order("created_at", { ascending: false })
        .limit(10);
      setHistorial(data || []);
    }
    if (id) fetchHistorial();
  }, [id]);

  async function handleUpdate(data) {
    const stockViejo = Number(producto?.stock || 0);
    const stockNuevo = Number(data?.stock || 0);

    // Si cambió el precio o el precio de oferta, dejamos registro en el historial
    const precioCambio = Number(producto?.precio || 0) !== Number(data?.precio || 0);
    const ofertaCambio = Number(producto?.precio_oferta || 0) !== Number(data?.precio_oferta || 0);

    if (precioCambio || ofertaCambio) {
      await supabase.from("historial_precios").insert({
        producto_id: id,
        precio_anterior: producto?.precio || null,
        precio_nuevo: data?.precio || null,
        precio_oferta_anterior: producto?.precio_oferta || null,
        precio_oferta_nuevo: data?.precio_oferta || null
      });
    }

    const { error } = await supabase.from("Productos").update(data).eq("id", id);
    if (error) throw error;

    // Si el producto estaba sin stock y ahora tiene, avisamos a quienes pidieron aviso (no bloqueante)
    if (stockViejo <= 0 && stockNuevo > 0) {
      fetch("/api/avisos-stock/notificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ producto_id: id })
      }).catch(() => {});
    }

    router.push("/admin/productos");
  }

  async function handleEliminar() {
    if (!confirm("¿Seguro que querés eliminar este producto?")) return;
    const { error } = await supabase.from("Productos").delete().eq("id", id);
    if (error) {
      alert("No se pudo eliminar: " + error.message);
      return;
    }
    router.push("/admin/productos");
  }

  return (
    <main className="min-h-screen bg-brand-bg">
      <div className="container-app px-4 py-6">
        <Link href="/admin/productos" className="text-sm text-brand-blue font-medium">
          ← Productos
        </Link>
        <h1 className="font-extrabold text-xl text-gray-800 mt-1 mb-4">
          Editar producto
        </h1>

        {loading ? (
          <p className="text-center text-gray-400 py-10">Cargando...</p>
        ) : !producto ? (
          <div className="card p-6 text-center text-gray-500">
            No encontramos este producto.
          </div>
        ) : (
          <div className="card p-4">
            <ProductoForm
              initialData={producto}
              onSubmit={handleUpdate}
              submitLabel="Guardar cambios"
            />
            <button
              onClick={handleEliminar}
              className="w-full text-center text-red-500 font-semibold text-sm mt-4"
            >
              Eliminar producto
            </button>
          </div>
        )}

        {historial.length > 0 && (
          <div className="card p-4 mt-4">
            <p className="font-bold text-sm text-gray-800 mb-3">📈 Historial de precios</p>
            <div className="flex flex-col gap-2">
              {historial.map((h) => (
                <div key={h.id} className="text-xs border-b border-gray-50 pb-2 last:border-0">
                  <p className="text-gray-400 mb-0.5">
                    {new Date(h.created_at).toLocaleString("es-AR")}
                  </p>
                  {Number(h.precio_anterior) !== Number(h.precio_nuevo) && (
                    <p className="text-gray-700">
                      Precio: <span className="line-through text-gray-400">${Number(h.precio_anterior || 0).toLocaleString("es-AR")}</span>{" "}
                      → <span className="font-bold text-gray-800">${Number(h.precio_nuevo || 0).toLocaleString("es-AR")}</span>
                    </p>
                  )}
                  {Number(h.precio_oferta_anterior || 0) !== Number(h.precio_oferta_nuevo || 0) && (
                    <p className="text-gray-700">
                      Oferta: <span className="line-through text-gray-400">${Number(h.precio_oferta_anterior || 0).toLocaleString("es-AR")}</span>{" "}
                      → <span className="font-bold text-orange-600">${Number(h.precio_oferta_nuevo || 0).toLocaleString("es-AR")}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function EditarProductoPage() {
  return (
    <AdminGuard>
      <EditarProducto />
    </AdminGuard>
  );
}
