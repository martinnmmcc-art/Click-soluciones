"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Header from "@/components/Header";
import { supabase } from "@/lib/supabaseClient";
import { useCart } from "@/context/CartContext";
import { formatPrice, buildWhatsAppLink, whatsappProductMessage } from "@/lib/whatsapp";
import { nombreCategoria } from "@/lib/categorias";

export default function ProductoDetallePage() {
  const { id } = useParams();
  const router = useRouter();
  const { addItem } = useCart();

  const [producto, setProducto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cantidad, setCantidad] = useState(1);
  const [agregado, setAgregado] = useState(false);

  useEffect(() => {
    async function fetchProducto() {
      setLoading(true);
      const { data, error } = await supabase
        .from("productos")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) console.error(error.message);
      setProducto(data);
      setLoading(false);
    }
    if (id) fetchProducto();
  }, [id]);

  if (loading) {
    return (
      <main>
        <Header showSearch={false} />
        <div className="text-center text-gray-400 py-16">Cargando producto...</div>
      </main>
    );
  }

  if (!producto) {
    return (
      <main>
        <Header showSearch={false} />
        <div className="text-center text-gray-500 py-16 px-4">
          No encontramos este producto. Puede que ya no esté disponible.
        </div>
      </main>
    );
  }

  const tieneOferta =
    producto.precio_oferta && producto.precio_oferta < producto.precio;
  const precioFinal = tieneOferta ? producto.precio_oferta : producto.precio;

  function handleAgregar() {
    addItem(producto, cantidad);
    setAgregado(true);
    setTimeout(() => setAgregado(false), 1500);
  }

  function handleComprarAhora() {
    addItem(producto, cantidad);
    router.push("/carrito");
  }

  return (
    <main className="pb-6">
      <Header showSearch={false} />

      <div className="relative w-full aspect-square bg-gray-100">
        {producto.imagen_url ? (
          <Image
            src={producto.imagen_url}
            alt={producto.nombre}
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl">
            📦
          </div>
        )}
        {tieneOferta && (
          <span className="absolute top-3 left-3 bg-brand-orange text-white text-xs font-bold px-3 py-1 rounded-full">
            OFERTA
          </span>
        )}
      </div>

      <div className="px-4 mt-4">
        <p className="text-xs uppercase tracking-wide text-brand-blue font-semibold">
          {nombreCategoria(producto.categoria)}
        </p>
        <h1 className="text-2xl font-extrabold text-gray-800 mt-1">
          {producto.nombre}
        </h1>

        <div className="mt-2 flex items-center gap-3">
          <span className="text-2xl font-extrabold text-brand-blueDark">
            ${formatPrice(precioFinal)}
          </span>
          {tieneOferta && (
            <span className="text-gray-400 line-through">
              ${formatPrice(producto.precio)}
            </span>
          )}
        </div>

        {producto.descripcion && (
          <p className="text-gray-600 mt-4 leading-relaxed">
            {producto.descripcion}
          </p>
        )}

        <div className="flex items-center gap-4 mt-5">
          <span className="text-sm font-medium text-gray-700">Cantidad:</span>
          <div className="flex items-center border border-gray-300 rounded-xl overflow-hidden">
            <button
              onClick={() => setCantidad((c) => Math.max(1, c - 1))}
              className="px-3 py-2 text-lg text-gray-600 hover:bg-gray-50"
            >
              −
            </button>
            <span className="px-4 font-semibold">{cantidad}</span>
            <button
              onClick={() => setCantidad((c) => c + 1)}
              className="px-3 py-2 text-lg text-gray-600 hover:bg-gray-50"
            >
              +
            </button>
          </div>
        </div>

        <div className="grid gap-3 mt-6">
          <button onClick={handleAgregar} className="btn-secondary">
            {agregado ? "✓ Agregado al carrito" : "Agregar al carrito"}
          </button>
          <button onClick={handleComprarAhora} className="btn-primary">
            Comprar ahora
          </button>
          <a
            href={buildWhatsAppLink(whatsappProductMessage(producto))}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-accent text-center"
          >
            💬 Consultar por WhatsApp
          </a>
        </div>
      </div>
    </main>
  );
}
