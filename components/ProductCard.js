"use client";

import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { buildWhatsAppLink, whatsappProductMessage } from "@/lib/whatsapp";

export default function ProductCard({ producto }) {
  const { addItem } = useCart();

  if (!producto) return null;

  const idProducto = producto.id;
  const nombre = producto.nombre || "Producto sin nombre";
  const tieneOferta = producto.precio_oferta && producto.precio_oferta < producto.precio;
  const precio = tieneOferta ? producto.precio_oferta : producto.precio;
  const imagenUrl = producto.imagen_url || "https://placehold.co/400x400?text=Sin+Foto";

  const stock = producto.stock;
  const sinStock = stock !== null && stock !== undefined && Number(stock) <= 0;
  const ultimaUnidad = stock !== null && stock !== undefined && Number(stock) === 1;

  const esNuevo = (() => {
    if (!producto.created_at) return false;
    const dias = (Date.now() - new Date(producto.created_at).getTime()) / (1000 * 60 * 60 * 24);
    return dias <= 7;
  })();

  return (
    <div className="bg-white border border-gray-100 rounded-lg shadow-sm p-3 flex flex-col justify-between hover:shadow-md transition-shadow">
      
      {/* Enlace seguro usando el id exacto del producto */}
      <Link href={`/producto/${idProducto}`} className="block group">
        <div className="relative w-full aspect-square bg-gray-50 rounded-md mb-3 overflow-hidden flex items-center justify-center">
          <img
            src={imagenUrl}
            alt={nombre}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {tieneOferta && (
            <span className="absolute top-1.5 left-1.5 bg-brand-orange text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              OFERTA
            </span>
          )}
          {!tieneOferta && esNuevo && (
            <span className="absolute top-1.5 left-1.5 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              NUEVO
            </span>
          )}
          {sinStock && (
            <span className="absolute top-1.5 right-1.5 bg-gray-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              Sin stock
            </span>
          )}
          {!sinStock && ultimaUnidad && (
            <span className="absolute top-1.5 right-1.5 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              ¡Última unidad!
            </span>
          )}
        </div>
        
        <div>
          <h3 className="font-semibold text-sm text-gray-800 line-clamp-2 mb-1 group-hover:text-blue-600 transition-colors">
            {nombre}
          </h3>
          {producto.descripcion && (
            <p className="text-[11px] text-gray-500 line-clamp-2 mb-1">{producto.descripcion}</p>
          )}
          <div className="flex items-center gap-2">
            <p className="text-blue-600 font-bold text-lg">
              ${Number(precio || 0).toLocaleString("es-AR")}
            </p>
            {tieneOferta && (
              <p className="text-gray-400 text-xs line-through">
                ${Number(producto.precio || 0).toLocaleString("es-AR")}
              </p>
            )}
          </div>
        </div>
      </Link>

      {sinStock ? (
        <a
          href={buildWhatsAppLink(whatsappProductMessage(producto))}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 w-full bg-gray-600 hover:bg-gray-700 text-white py-1.5 rounded-md text-sm font-medium transition-colors active:scale-95 text-center"
        >
          Consultar al vendedor
        </a>
      ) : (
        <button 
          onClick={() => addItem(producto)}
          className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded-md text-sm font-medium transition-colors active:scale-95"
        >
          Agregar
        </button>
      )}
    </div>
  );
}
