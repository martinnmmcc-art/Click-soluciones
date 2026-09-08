"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { formatPrice } from "@/lib/whatsapp";
import { urlImagen } from "@/lib/imagenProducto";

// Muestra qué se llevaron otros junto con este producto.
//
// Es la forma más barata de subir el ticket: no hay que conseguir un cliente
// nuevo, solo sugerirle algo que le sirve a alguien que ya está decidido a
// comprar. Y no es un invento: sale de pedidos reales.
export default function CompradosJuntos({ productoId }) {
  const [productos, setProductos] = useState([]);

  useEffect(() => {
    async function cargar() {
      if (!productoId) return;
      const { data } = await supabase.rpc("comprados_juntos", {
        p_producto_id: productoId,
        p_limite: 4
      });
      setProductos(data || []);
    }
    cargar();
  }, [productoId]);

  // Sin datos suficientes preferimos no mostrar nada: una sugerencia al azar
  // es peor que ninguna.
  if (productos.length === 0) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 mt-5">
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <p className="font-bold text-sm text-gray-800">🛒 Se suele llevar junto</p>
        <p className="text-[11px] text-gray-500 mt-0.5 mb-3">
          Otros clientes compraron esto en el mismo pedido
        </p>

        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
          {productos.map((p) => (
            <Link
              key={p.producto_id}
              href={`/producto/${p.producto_id}`}
              className="flex-shrink-0 w-32"
            >
              <div className="w-full h-28 bg-white rounded-xl overflow-hidden flex items-center justify-center border border-gray-100">
                {p.imagen_url ? (
                  <img
                    src={urlImagen(p.imagen_url)}
                    alt=""
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <span className="text-2xl">📦</span>
                )}
              </div>

              <p className="text-[11px] font-semibold text-gray-800 line-clamp-2 leading-tight mt-1.5">
                {p.nombre}
              </p>
              <p className="text-sm font-extrabold text-brand-blue">
                ${formatPrice(p.precio)}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
