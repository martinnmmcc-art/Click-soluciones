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

  useEffect(() => {
    async function fetchProducto() {
      const { data, error } = await supabase
        .from("productos")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) console.error(error.message);
      setProducto(data);
      setLoading(false);
    }
    if (id) fetchProducto();
  }, [id]);

  async function handleUpdate(data) {
    const { error } = await supabase.from("productos").update(data).eq("id", id);
    if (error) throw error;
    router.push("/admin/productos");
  }

  async function handleEliminar() {
    if (!confirm("¿Seguro que querés eliminar este producto?")) return;
    const { error } = await supabase.from("productos").delete().eq("id", id);
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
