"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import ProductCard from "@/components/ProductCard";
import { supabase } from "@/lib/supabaseClient";

export default function CatalogoPage() {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("todas");
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargarCatalogo() {
      setLoading(true);
      try {
        const { data: prodData, error: prodError } = await supabase
          .from("Productos")
          .select("*")
          .or("bajo_pedido.is.null,bajo_pedido.eq.false")
          .order("id", { ascending: false });

        if (prodError) console.error("Error en Productos:", prodError.message);
        if (prodData) setProductos(prodData);

        const { data: catData, error: catError } = await supabase
          .from("Categorias")
          .select("*")
          .order("nombre", { ascending: true });

        if (catError) console.error("Error en Categorias:", catError.message);
        if (catData) setCategorias(catData);
      } catch (err) {
        console.error("Error de red en catálogo:", err);
      } finally {
        setLoading(false);
      }
    }

    cargarCatalogo();
  }, []);

  const productosFiltrados = productos.filter((prod) => {
    const coincideCategoria =
      categoriaSeleccionada === "todas" ||
      prod.categoria_id === categoriaSeleccionada ||
      prod.categoria === categoriaSeleccionada;

    const coincideBusqueda =
      !busqueda.trim() ||
      prod.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
      prod.descripcion?.toLowerCase().includes(busqueda.toLowerCase());

    return coincideCategoria && coincideBusqueda;
  });

  return (
    <main className="min-h-screen bg-gray-50 pb-28">
      <Header busqueda={busqueda} setBusqueda={setBusqueda} showSearch={true} />

      <div className="max-w-md mx-auto px-4 mt-4">
        <h1 className="font-black text-gray-800 text-base mb-3">Catálogo Completo</h1>

        {categorias.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none">
            <button
              onClick={() => setCategoriaSeleccionada("todas")}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
                categoriaSeleccionada === "todas" ? "bg-brand-blue text-white shadow-sm" : "bg-white text-gray-600 border border-gray-200"
              }`}
            >
              Todas
            </button>
            {categorias.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoriaSeleccionada(cat.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
                  categoriaSeleccionada === cat.id ? "bg-brand-blue text-white shadow-sm" : "bg-white text-gray-600 border border-gray-200"
                }`}
              >
                {cat.nombre}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500 font-medium">Cargando productos...</p>
          </div>
        ) : productosFiltrados.length === 0 ? (
          <div className="text-center py-12 card p-6 bg-white rounded-2xl shadow-sm">
            <p className="text-2xl mb-2">🔍</p>
            <p className="text-sm font-bold text-gray-700">No encontramos productos con esos filtros</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 mt-2">
            {productosFiltrados.map((prod) => (
              <ProductCard key={prod.id} producto={prod} />
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
