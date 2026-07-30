"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Header from "@/components/Header";
import ProductCard from "@/components/ProductCard";
import { CATEGORIAS } from "@/lib/categorias";
import { supabase } from "@/lib/supabaseClient";

function CatalogoContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const categoriaActiva = searchParams.get("categoria") || "";
  const query = searchParams.get("q") || "";

  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProductos() {
      setLoading(true);
      let req = supabase.from("productos").select("*").eq("activo", true);

      if (categoriaActiva === "ofertas") {
        req = req.not("precio_oferta", "is", null);
      } else if (categoriaActiva) {
        req = req.eq("categoria", categoriaActiva);
      }

      if (query) {
        req = req.ilike("nombre", `%${query}%`);
      }

      const { data, error } = await req.order("created_at", {
        ascending: false
      });

      if (error) {
        console.error("Error cargando catálogo:", error.message);
        setProductos([]);
      } else {
        setProductos(data || []);
      }
      setLoading(false);
    }
    fetchProductos();
  }, [categoriaActiva, query]);

  function setCategoria(slug) {
    const params = new URLSearchParams(searchParams.toString());
    if (slug) params.set("categoria", slug);
    else params.delete("categoria");
    router.push(`/catalogo?${params.toString()}`);
  }

  return (
    <main className="pb-6">
      <Header initialQuery={query} />

      <div className="px-4 mt-4">
        <h1 className="font-bold text-xl text-gray-800 mb-3">
          {query ? `Resultados para "${query}"` : "Catálogo"}
        </h1>

        <div className="flex gap-2 overflow-x-auto pb-3">
          <button
            onClick={() => setCategoria("")}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border ${
              !categoriaActiva
                ? "bg-brand-blue text-white border-brand-blue"
                : "bg-white text-gray-600 border-gray-200"
            }`}
          >
            Todas
          </button>
          {CATEGORIAS.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => setCategoria(cat.slug)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border ${
                categoriaActiva === cat.slug
                  ? "bg-brand-blue text-white border-brand-blue"
                  : "bg-white text-gray-600 border-gray-200"
              }`}
            >
              {cat.emoji} {cat.nombre}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-10">Cargando productos...</div>
        ) : productos.length === 0 ? (
          <div className="card p-6 text-center text-gray-500 text-sm mt-4">
            No encontramos productos con esos filtros.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
            {productos.map((p) => (
              <ProductCard key={p.id} producto={p} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function CatalogoPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-gray-400">Cargando...</div>}>
      <CatalogoContent />
    </Suspense>
  );
}
