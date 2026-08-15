"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { supabase } from "@/lib/supabaseClient";
import { formatPrice, buildWhatsAppLink } from "@/lib/whatsapp";

export default function APedidoPage() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState("nombre-asc"); // nombre-asc | precio-asc | precio-desc

  useEffect(() => {
    async function cargar() {
      const { data } = await supabase
        .from("Productos")
        .select("*")
        .eq("bajo_pedido", true)
        .eq("activo", true)
        .order("nombre", { ascending: true });
      setProductos(data || []);
      setLoading(false);
    }
    cargar();
  }, []);

  function mensajeConsulta(nombre) {
    return buildWhatsAppLink(
      `Hola! 👋 Vi "${nombre}" en la sección de productos a pedido de Bolson Click. ¿Me contás precio final y tiempo de entrega?`
    );
  }

  const productosFiltrados = productos
    .filter((p) => !busqueda.trim() || p.nombre?.toLowerCase().includes(busqueda.toLowerCase()))
    .sort((a, b) => {
      if (orden === "precio-asc") return (a.precio || 0) - (b.precio || 0);
      if (orden === "precio-desc") return (b.precio || 0) - (a.precio || 0);
      return (a.nombre || "").localeCompare(b.nombre || "");
    });

  return (
    <main className="min-h-screen bg-gray-50 pb-28">
      <Header showSearch={false} />

      <div className="max-w-md mx-auto px-4 mt-4">
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 mb-4">
          <h1 className="font-bold text-purple-900">🛍️ Productos a pedido</h1>
          <p className="text-sm text-purple-800 mt-1">
            Estos productos no están en stock ahora mismo, pero los podemos pedir a nuestro proveedor.
            Consultanos por WhatsApp el precio final y el tiempo de entrega estimado.
          </p>
        </div>

        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="input-field mb-3"
          placeholder="Buscar producto a pedido..."
        />

        <div className="flex gap-2 overflow-x-auto pb-3 mb-1 scrollbar-none">
          {[
            { key: "nombre-asc", label: "A-Z" },
            { key: "precio-asc", label: "Más barato" },
            { key: "precio-desc", label: "Más caro" }
          ].map((op) => (
            <button
              key={op.key}
              onClick={() => setOrden(op.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
                orden === op.key ? "bg-purple-600 text-white shadow-sm" : "bg-white text-gray-600 border border-gray-200"
              }`}
            >
              {op.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-center text-gray-400 text-sm py-10">Cargando...</p>
        ) : productosFiltrados.length === 0 ? (
          <div className="text-center py-12 card p-6 bg-white rounded-2xl shadow-sm">
            <p className="text-2xl mb-2">📦</p>
            <p className="text-sm font-bold text-gray-700">
              {busqueda ? "No encontramos productos con ese nombre" : "Todavía no hay productos a pedido cargados"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {productosFiltrados.map((prod) => (
              <div key={prod.id} className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm flex flex-col justify-between">
                <div>
                  <Link href={`/a-pedido/${prod.id}`} className="block relative">
                    {prod.imagen_url ? (
                      <img src={prod.imagen_url} alt={prod.nombre} className="w-full h-32 object-cover rounded-xl mb-2 bg-gray-50" />
                    ) : (
                      <div className="w-full h-32 bg-gray-100 rounded-xl mb-2 flex items-center justify-center text-gray-400 text-2xl">📦</div>
                    )}
                    <span className="absolute top-1.5 left-1.5 bg-purple-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                      A PEDIDO
                    </span>
                  </Link>

                  <h3 className="font-bold text-xs text-gray-800 line-clamp-2 leading-tight">
                    <Link href={`/a-pedido/${prod.id}`}>{prod.nombre}</Link>
                  </h3>

                  {prod.descripcion && (
                    <p className="text-[11px] text-gray-500 line-clamp-2 mt-0.5">{prod.descripcion}</p>
                  )}
                </div>

                <div className="mt-3 pt-2 border-t border-gray-50 flex flex-col gap-1.5">
                  {prod.precio && (
                    <span className="font-black text-sm text-purple-700">
                      Aprox. ${formatPrice(prod.precio)}
                    </span>
                  )}
                  <a
                    href={mensajeConsulta(prod.nombre)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-purple-600 text-white text-[11px] font-bold py-2 rounded-xl shadow-sm text-center"
                  >
                    Consultar y pedir
                  </a>
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
