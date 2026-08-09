"use client";

import Link from "next/link";
import Image from "next/image";
import Header from "@/components/Header";
import { useCart } from "@/context/CartContext";
import { formatPrice } from "@/lib/whatsapp";

export default function CarritoPage() {
  const { items, updateQuantity, removeItem, nota, setNota, total } = useCart();

  return (
    <main className="pb-6">
      <Header showSearch={false} />

      <div className="px-4 mt-4">
        <h1 className="font-bold text-xl text-gray-800 mb-4">Tu carrito</h1>

        {items.length === 0 ? (
          <div className="card p-8 text-center text-gray-500">
            <p className="text-4xl mb-3">🛒</p>
            <p>Tu carrito está vacío.</p>
            <Link href="/catalogo" className="btn-primary inline-block mt-4">
              Ver catálogo
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {items.map((item) => (
                <div key={item.id} className="card p-3 flex gap-3 items-center">
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                    {item.imagen_url ? (
                      <Image
                        src={item.imagen_url}
                        alt={item.nombre}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl">
                        📦
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 line-clamp-2">
                      {item.nombre}
                    </p>
                    <p className="text-brand-blueDark font-bold text-sm mt-1">
                      ${formatPrice(item.precio)}
                    </p>

                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                        <button
                          onClick={() => updateQuantity(item.id, item.cantidad - 1)}
                          className="px-2 py-1 text-gray-600 hover:bg-gray-50"
                        >
                          −
                        </button>
                        <span className="px-3 text-sm font-semibold">
                          {item.cantidad}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.cantidad + 1)}
                          disabled={item.stock !== null && item.stock !== undefined && item.cantidad >= Number(item.stock)}
                          className="px-2 py-1 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-xs text-red-500 font-medium"
                      >
                        Eliminar
                      </button>
                    </div>
                    {item.stock !== null && item.stock !== undefined && item.cantidad >= Number(item.stock) && (
                      <p className="text-[11px] text-orange-600 font-semibold mt-1">
                        Llegaste al stock disponible ({item.stock})
                      </p>
                    )}
                  </div>

                  <div className="text-sm font-bold text-gray-700 whitespace-nowrap">
                    ${formatPrice(item.precio * item.cantidad)}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5">
              <label className="text-sm font-semibold text-gray-700 block mb-2">
                Nota para tu pedido (opcional)
              </label>
              <textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                rows={3}
                placeholder="Ej: llamar antes de entregar, color preferido, etc."
                className="input-field resize-none"
              />
            </div>

            <div className="card p-4 mt-5 flex items-center justify-between">
              <span className="font-semibold text-gray-700">Total</span>
              <span className="text-xl font-extrabold text-brand-blueDark">
                ${formatPrice(total)}
              </span>
            </div>

            <Link href="/checkout" className="btn-primary block text-center mt-4">
              Continuar con la compra
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
