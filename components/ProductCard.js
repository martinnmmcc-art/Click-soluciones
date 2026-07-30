"use client";

import { useCart } from "@/context/CartContext";

export default function ProductCard({ producto }) {
  // Importamos la función exacta tal como la nombraste en tu contexto
  const { addItem } = useCart();

  if (!producto) return null;

  // Ajustamos los nombres para que coincidan con lo que espera tu base de datos y tu carrito
  const nombre = producto.nombre || "Producto sin nombre";
  const precio = producto.precio_oferta || producto.precio || 0;
  const imagenUrl = producto.imagen_url || "https://placehold.co/400x400?text=Sin+Foto";

  return (
    <div className="bg-white border border-gray-100 rounded-lg shadow-sm p-3 flex flex-col justify-between hover:shadow-md transition-shadow">
      <div className="w-full aspect-square bg-gray-50 rounded-md mb-3 overflow-hidden flex items-center justify-center">
        <img
          src={imagenUrl}
          alt={nombre}
          className="w-full h-full object-cover"
        />
      </div>
      
      <div>
        <h3 className="font-semibold text-sm text-gray-800 line-clamp-2 mb-1">
          {nombre}
        </h3>
        <p className="text-blue-600 font-bold text-lg">
          ${precio}
        </p>
      </div>

      <button 
        // Aquí disparamos tu función addItem pasándole el producto completo
        onClick={() => addItem(producto)}
        className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded-md text-sm font-medium transition-colors active:scale-95"
      >
        Agregar
      </button>
    </div>
  );
}
