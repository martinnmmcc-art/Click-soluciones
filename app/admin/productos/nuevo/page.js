"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import ProductoForm from "@/components/ProductoForm";
import { supabase } from "@/lib/supabaseClient";

function NuevoProducto() {
  const router = useRouter();

  async function handleCreate(data) {
    const { error } = await supabase.from("Productos").insert(data);
    if (error) throw error;
    router.push("/admin/productos");
  }

  return (
    <main className="min-h-screen bg-brand-bg">
      <div className="container-app px-4 py-6">
        <Link href="/admin/productos" className="text-sm text-brand-blue font-medium">
          ← Productos
        </Link>
        <h1 className="font-extrabold text-xl text-gray-800 mt-1 mb-4">
          Nuevo producto
        </h1>
        <div className="card p-4">
          <ProductoForm onSubmit={handleCreate} submitLabel="Crear producto" />
        </div>
      </div>
    </main>
  );
}

export default function NuevoProductoPage() {
  return (
    <AdminGuard>
      <NuevoProducto />
    </AdminGuard>
  );
}
