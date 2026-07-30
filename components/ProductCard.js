"use client";

import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/context/CartContext";
import { formatPrice } from "@/lib/whatsapp";

export default function ProductCard({ producto }) {
  const { addItem } = useCart();

  const tieneOferta =
    producto.precio_oferta && producto.precio_oferta < producto.precio;

  function handleAdd(e) {
    e.preventDefault();
    e.stopPropagation();
    addItem(producto, 1);
  }

  function handleWhatsApp(e) {
    e.preventDefault();
    e.stopPropagation();

    const telefono = "5492944396888";

    const precio = producto.precio_oferta || producto.precio;

    const mensaje = encodeURIComponent(
`Hola! 👋

Quiero comprar este producto:

🛒 ${producto.nombre}
💰 Precio: $${formatPrice(precio)}

¿Está disponible?`
    );

    const link = `https://wa.me/${telefono}?text=${mensaje}`;

    window.open(link, "_blank");
  }

  return (
    <Link
      href={`/producto/${producto.id}`}
      className="card overflow-hidden flex flex-col hover:shadow-md transition-shadow"
    >
      <div className="relative w-full aspect-square bg-gray-100">
        {producto.imagen_url ? (
          <Image
            src={producto.imagen_url}
            alt={producto.nombre}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">
            📦
          </div>
        )}
        {tieneOferta && (
          <span className="absolute top-2 left-2 bg-brand-orange text-white text-[10px] font-bold px-2 py-1 rounded-full">
            OFERTA
          </span>
        )}
      </div>

      <div className="p-3 flex flex-col gap-1 flex-1">
        <h3 className="text-sm font-semibold text-gray-800 line-clamp-2 min-h-[2.5rem]">
          {producto.nombre}
        </h3>

        <div className="mt-1">
          {tieneOferta ? (
            <div className="flex items-center gap-2">
              <span className="text-brand-blueDark font-extrabold">
                ${formatPrice(producto.precio_oferta)}
              </span>
              <span className="text-xs text-gray-400 line-through">
                ${formatPrice(producto.precio)}
              </span>
            </div>
          ) : (
            <span className="text-brand-blueDark font-extrabold">
              ${formatPrice(producto.precio)}
            </span>
          )}
        </div>

        <button
          onClick={handleAdd}
          className="btn-primary text-sm mt-2 w-full"
        >
          Agregar al carrito
        </button>

        <button
          onClick={handleWhatsApp}
          className="mt-2 w-full bg-[#25D366] text-white text-sm font-semibold py-2 rounded-lg hover:scale-105 transition-transform"
        >
          Comprar por WhatsApp
        </button>
      </div>
    </Link>
  );
}
