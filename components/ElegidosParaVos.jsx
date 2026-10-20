"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import FotoRotativa from "@/components/FotoRotativa";
import { fotosDe } from "@/lib/imagenProducto";
import { formatPrice } from "@/lib/whatsapp";

// "Elegidos para vos": mezcla los que marcás vos en el panel con otros que
// rotan solos cada 6 horas, alternando categorías. Así el que entra seguido
// siempre encuentra algo distinto, y lo que querés empujar no se pierde.
// Se configura en /admin/elegidos.
//
// Sin señal usa los destacados de la copia guardada en el celular.
export default function ElegidosParaVos({ respaldo = [], onSalir }) {
  const [productos, setProductos] = useState(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("elegidos_para_vos");
        if (error) throw error;
        if (vivo) setProductos(data || []);
      } catch {
        if (vivo) setProductos(null);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const lista =
    productos && productos.length
      ? productos
      : respaldo.filter((p) => p.destacado && Number(p.stock) > 0).slice(0, 10);

  if (!lista.length) return null;

  return (
    <section className="mt-6 py-4 bg-gradient-to-b from-amber-50 to-transparent" aria-labelledby="titulo-elegidos">
      <div className="max-w-md md:max-w-none mx-auto px-4 mb-3">
        <h2 id="titulo-elegidos" className="font-black text-gray-800 text-base leading-none flex items-center gap-2">
          <span className="text-[#C9971F]" aria-hidden="true">★</span>
          Elegidos para vos
        </h2>
        <p className="text-[11px] text-amber-800 mt-1 ml-6">
          Lo que te recomendamos hoy, listo para llevar
        </p>
      </div>
      <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-none snap-x snap-mandatory scroll-px-4">
        {lista.map((prod) => {
          const tieneOferta = Number(prod.precio_oferta) > 0 && Number(prod.precio_oferta) < Number(prod.precio);
          const final = tieneOferta ? Number(prod.precio_oferta) : Number(prod.precio);
          const pct = tieneOferta ? Math.round((1 - final / Number(prod.precio)) * 100) : 0;
          return (
            <Link
              key={prod.id}
              href={`/producto/${prod.id}`}
              onClick={onSalir}
              className="snap-start flex-shrink-0 w-44 bg-white rounded-2xl p-3 border border-amber-200 shadow-sm active:scale-[0.98] transition"
            >
              <div className="relative">
                <FotoRotativa
                  fotos={fotosDe(prod)}
                  video={prod.video_url}
                  alt={prod.nombre}
                  className="w-full h-40 object-contain rounded-xl mb-2 bg-white"
                />
                {tieneOferta && (
                  <span className="absolute top-1 left-1 bg-red-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                    −{pct}%
                  </span>
                )}
                {Number(prod.stock) === 1 && (
                  <span className="absolute top-1 right-1 bg-white/95 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-red-200">
                    Queda 1
                  </span>
                )}
              </div>
              <p className="text-[13px] font-bold text-gray-800 line-clamp-2 leading-snug min-h-[2.2rem]">{prod.nombre}</p>
              <p className="text-lg font-black text-brand-blue mt-1 leading-tight">${formatPrice(final)}</p>
              {tieneOferta ? (
                <p className="text-[11px] text-gray-400 line-through leading-none">${formatPrice(prod.precio)}</p>
              ) : (
                <p className="text-[11px] text-green-700 font-semibold leading-none">Disponible ya</p>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
