"use client";

import Link from "next/link";
import { useCart } from "@/context/CartContext";

export default function ProductCard({ producto }) {
  const { addItem } = useCart();

  if (!producto) return null;

  const nombre = producto.nombre || "Producto sin nombre";
  const precio = producto.precio_oferta || producto.precio || 0;
  const imagenUrl = producto.imagen_url || "https://placehold.co/400x400?text=Sin+Foto";

  return (
    <div className="bg-white border border-gray-100 rounded-lg shadow-sm p-3 flex flex-col justify-between hover:shadow-md transition-shadow">
      
      {/* Zona clickeable para ir al detalle (Foto y Título) */}
      <Link href={`/producto/${producto.id}`} className="block group">
        <div className="w-full aspect-square bg-gray-50 rounded-md mb-3 overflow-hidden flex items-center justify-center">
          <img
            src={imagenUrl}
            alt={nombre}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
        
        <div>
          <h3 className="font-semibold text-sm text-gray-800 line-clamp-2 mb-1 group-hover:text-blue-600 transition-colors">
            {nombre}
          </h3>
          <p className="text-blue-600 font-bold text-lg">
            ${precio}
          </p>
        </div>
      </Link>

      {/* Botón de Agregar (fuera del Link para que no abra la página sin querer) */}
      <button 
        onClick={() => addItem(producto)}
        className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded-md text-sm font-medium transition-colors active:scale-95"
      >
        Agregar
      </button>
    </div>
  );
}
