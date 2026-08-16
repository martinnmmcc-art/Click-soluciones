"use client";

import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { buildWhatsAppLink, whatsappProductMessage, formatPrice } from "@/lib/whatsapp";
import BotonFavorito from "@/components/BotonFavorito";

export default function ProductCard({ producto }) {
  const { addItem } = useCart();

  if (!producto) return null;

  const idProducto = producto.id;
  const nombre = producto.nombre || "Producto sin nombre";
  const tieneOferta = producto.precio_oferta && producto.precio_oferta < producto.precio;
  const precio = tieneOferta ? producto.precio_oferta : producto.precio;

  const stock = producto.stock;
  const sinStock = stock !== null && stock !== undefined && Number(stock) <= 0;
  const ultimaUnidad = stock !== null && stock !== undefined && Number(stock) === 1;

  const esNuevo = (() => {
    if (!producto.created_at) return false;
    const dias = (Date.now() - new Date(producto.created_at).getTime()) / (1000 * 60 * 60 * 24);
    return dias <= 7;
  })();

  return (
    <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm flex flex-col justify-between">
      <div>
        <Link href={`/producto/${idProducto}`} className="block relative">
          {producto.imagen_url ? (
            <img
              src={producto.imagen_url}
              alt={nombre}
              className="w-full h-32 object-cover rounded-xl mb-2 bg-gray-50"
            />
          ) : (
            <div className="w-full h-32 bg-gray-100 rounded-xl mb-2 flex items-center justify-center text-gray-400 text-2xl">
              📦
            </div>
          )}

          {tieneOferta && (
            <span className="absolute top-1.5 left-1.5 bg-brand-orange text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
              OFERTA
            </span>
          )}
          {!tieneOferta && esNuevo && (
            <span className="absolute top-1.5 left-1.5 bg-emerald-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
              NUEVO
            </span>
          )}
          {sinStock && (
            <span className="absolute top-1.5 right-1.5 bg-gray-700 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
              Sin stock
            </span>
          )}
          {!sinStock && ultimaUnidad && (
            <span className="absolute top-1.5 right-1.5 bg-red-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full animate-pulse">
              ¡Última unidad!
            </span>
          )}

          <BotonFavorito productoId={idProducto} className="absolute bottom-3.5 right-1.5 w-7 h-7" />
        </Link>

        <h3 className="font-bold text-xs text-gray-800 line-clamp-2 leading-tight">
          <Link href={`/producto/${idProducto}`} className="block">
            {nombre}
          </Link>
        </h3>

        {producto.descripcion && (
          <p className="text-[11px] text-gray-500 line-clamp-2 mt-0.5">{producto.descripcion}</p>
        )}
      </div>

      <div className="mt-3 pt-2 border-t border-gray-50 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <span className="font-black text-sm text-brand-blue">
            ${formatPrice(precio)}
          </span>
          {tieneOferta && (
            <span className="text-[10px] text-gray-400 line-through">
              ${formatPrice(producto.precio)}
            </span>
          )}
        </div>

        {sinStock ? (
          <a
            href={buildWhatsAppLink(whatsappProductMessage(producto))}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-gray-600 text-white text-[11px] font-bold py-2 rounded-xl shadow-sm hover:opacity-95 active:scale-95 transition text-center"
          >
            Consultar al vendedor
          </a>
        ) : (
          <button
            onClick={() => addItem(producto)}
            className="w-full bg-brand-blue text-white text-[11px] font-bold py-2 rounded-xl shadow-sm hover:opacity-95 active:scale-95 transition"
          >
            + Agregar
          </button>
        )}
      </div>
    </div>
  );
}
