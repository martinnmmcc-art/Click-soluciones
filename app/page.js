"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import BannerOfertas from "@/components/BannerOfertas";
import { supabase } from "@/lib/supabaseClient";
import { useCart } from "@/context/CartContext";
import { buildWhatsAppLink, whatsappProductMessage } from "@/lib/whatsapp";

export default function HomePage() {
  const { addItem } = useCart();
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("todas");
  const [busqueda, setBusqueda] = useState("");
  const [loadingData, setLoadingData] = useState(true);
  const [mensajeCarrito, setMensajeCarrito] = useState("");

  useEffect(() => {
    async function cargarDatos() {
      setLoadingData(true);
      try {
        const { data: prodData, error: prodError } = await supabase
          .from("Productos")
          .select("*")
          .or("bajo_pedido.is.null,bajo_pedido.eq.false")
          .order("id", { ascending: true });

        if (prodError) {
          console.error("Error en Productos:", prodError.message);
        } else if (prodData) {
          setProductos(prodData);
        }

        const { data: catData, error: catError } = await supabase
          .from("Categorias")
          .select("*")
          .order("nombre", { ascending: true });

        if (catError) {
          console.error("Error en Categorias:", catError.message);
        } else if (catData) {
          setCategorias(catData);
        }
      } catch (err) {
        console.error("Error general de red:", err);
      } finally {
        setLoadingData(false);
      }
    }

    cargarDatos();
  }, []);

  function agregarAlCarrito(producto) {
    addItem(producto, 1);
    setMensajeCarrito(`¡${producto.nombre || "Producto"} agregado!`);
    setTimeout(() => setMensajeCarrito(""), 2500);
  }

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

      {mensajeCarrito && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg transition animate-bounce">
          {mensajeCarrito}
        </div>
      )}

      <BannerOfertas />

      <div className="max-w-md mx-auto px-4 mt-3">
        <Link
          href="/a-pedido"
          className="block bg-purple-50 border border-purple-200 rounded-xl py-2.5 px-3 text-center"
        >
          <span className="text-[12px] text-purple-800 font-bold">
            🛍️ ¿No lo encontrás? Mirá los productos a pedido →
          </span>
        </Link>
      </div>

      <div className="max-w-md mx-auto px-4 mt-3">
        <p className="text-[11px] text-gray-500 text-center bg-gray-100 rounded-full py-1.5 px-3">
          🚚 Envíos a El Bolsón y la Comarca Andina — coordinamos transporte local o punto de encuentro
        </p>
      </div>

      <div className="max-w-md mx-auto px-4 mt-4">
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

        {loadingData ? (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500 font-medium">Cargando catálogo...</p>
          </div>
        ) : productosFiltrados.length === 0 ? (
          <div className="text-center py-12 card p-6 bg-white rounded-2xl shadow-sm">
            <p className="text-2xl mb-2">🔍</p>
            <p className="text-sm font-bold text-gray-700">No hay productos disponibles</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 mt-2">
            {productosFiltrados.map((prod) => (
              <div key={prod.id} className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm flex flex-col justify-between">
                <div>
                  <Link href={`/producto/${prod.id}`} className="block relative">
                    {prod.imagen_url ? (
                      <img src={prod.imagen_url} alt={prod.nombre} className="w-full h-32 object-cover rounded-xl mb-2 bg-gray-50" />
                    ) : (
                      <div className="w-full h-32 bg-gray-100 rounded-xl mb-2 flex items-center justify-center text-gray-400 text-2xl">📦</div>
                    )}
                    {prod.precio_oferta && prod.precio_oferta < prod.precio && (
                      <span className="absolute top-1.5 left-1.5 bg-brand-orange text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                        OFERTA
                      </span>
                    )}
                    {prod.stock !== null && prod.stock !== undefined && Number(prod.stock) <= 0 && (
                      <span className="absolute top-1.5 right-1.5 bg-gray-700 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                        Sin stock
                      </span>
                    )}
                    {prod.stock !== null && prod.stock !== undefined && Number(prod.stock) === 1 && (
                      <span className="absolute top-1.5 right-1.5 bg-red-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                        ¡Última unidad!
                      </span>
                    )}
                  </Link>

                  <h3 className="font-bold text-xs text-gray-800 line-clamp-2 leading-tight">
                    <Link href={`/producto/${prod.id}`} className="block">
                      {prod.nombre}
                    </Link>
                  </h3>

                  {prod.descripcion && (
                    <p className="text-[11px] text-gray-500 line-clamp-2 mt-0.5">{prod.descripcion}</p>
                  )}
                </div>

                <div className="mt-3 pt-2 border-t border-gray-50 flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-sm text-brand-blue">
                      ${Number((prod.precio_oferta && prod.precio_oferta < prod.precio ? prod.precio_oferta : prod.precio) || 0).toLocaleString("es-AR")}
                    </span>
                    {prod.precio_oferta && prod.precio_oferta < prod.precio && (
                      <span className="text-[10px] text-gray-400 line-through">
                        ${Number(prod.precio || 0).toLocaleString("es-AR")}
                      </span>
                    )}
                  </div>
                  {prod.stock !== null && prod.stock !== undefined && Number(prod.stock) <= 0 ? (
                    <a
                      href={buildWhatsAppLink(whatsappProductMessage(prod))}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-gray-600 text-white text-[11px] font-bold py-2 rounded-xl shadow-sm hover:opacity-95 active:scale-95 transition text-center"
                    >
                      Consultar al vendedor
                    </a>
                  ) : (
                    <button onClick={() => agregarAlCarrito(prod)} className="w-full bg-brand-blue text-white text-[11px] font-bold py-2 rounded-xl shadow-sm hover:opacity-95 active:scale-95 transition">+ Agregar</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
