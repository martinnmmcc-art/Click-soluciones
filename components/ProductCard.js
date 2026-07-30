export default function ProductCard({ producto }) {
  // Si por algún motivo el producto llega vacío, no mostramos nada para no romper el servidor
  if (!producto) return null;

  // Ajusta los nombres de las propiedades (nombre, precio, imagen) según cómo estén en tu Supabase
  const nombre = producto.nombre || producto.title || producto.name || "Producto sin nombre";
  const precio = producto.precio || producto.price || 0;
  const imagenUrl = producto.imagen || producto.image_url || producto.url_imagen || "https://placehold.co/400x400?text=Sin+Foto";

  return (
    <div className="bg-white border border-gray-100 rounded-lg shadow-sm p-3 flex flex-col justify-between hover:shadow-md transition-shadow">
      <div className="w-full aspect-square bg-gray-50 rounded-md mb-3 overflow-hidden flex items-center justify-center">
        {/* Usamos una etiqueta img estándar para evitar problemas iniciales con Next.js */}
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

      <button className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded-md text-sm font-medium transition-colors">
        Agregar
      </button>
    </div>
  );
}
