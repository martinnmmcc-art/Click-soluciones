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
  const params = useParams();
  const id = params?.id ? decodeURIComponent(params.id) : null;
  
  const router = useRouter();
  const { addItem } = useCart();

  const [producto, setProducto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cantidad, setCantidad] = useState(1);
  const [agregado, setAgregado] = useState(false);
  const [imagenPrincipal, setImagenPrincipal] = useState("");
  
  // Agregamos esto para ver el error exacto en pantalla si falla
  const [debugError, setDebugError] = useState(""); 

  useEffect(() => {
    async function fetchProducto() {
      if (!id) return;
      setLoading(true);
      
      try {
        // CAMBIO CLAVE: "Productos" con P mayúscula tal cual está en tu BD
        const { data, error } = await supabase
          .from("Productos")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (error) {
          setDebugError(error.message);
        } else if (data) {
          setProducto(data);
          setImagenPrincipal(data.imagen_url || "");
        } else {
          setDebugError("El producto no existe en la base de datos con ese ID.");
        }
      } catch (err) {
        setDebugError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchProducto();
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
          <p className="text-lg font-semibold text-gray-800">No encontramos este producto.</p>
          
          {/* CAJA DE DEBUG: Te mostrará qué está fallando realmente */}
          <div className="mt-6 p-4 bg-red-50 rounded-lg border border-red-200 text-left">
            <p className="text-xs text-red-600 font-bold mb-1">Info técnica para Martín:</p>
            <p className="text-xs text-red-600">ID buscado: {id}</p>
            <p className="text-xs text-red-600">Error devuelto: {debugError || "Ninguno"}</p>
          </div>
        </div>
      </main>
    );
  }

  const tieneOferta = producto.precio_oferta && producto.precio_oferta < producto.precio;
  const precioFinal = tieneOferta ? producto.precio_oferta : producto.precio;

  const stock = producto.stock !== null && producto.stock !== undefined ? Number(producto.stock) : null;
  const sinStock = stock !== null && stock <= 0;
  const ultimaUnidad = stock !== null && stock === 1;

  const listaImagenes = [
    producto.imagen_url,
    producto.imagen_url_2,
    producto.imagen_url_3,
    producto.imagen_url_4,
    producto.imagen_url_5,
    producto.imagen_url_6
  ].filter(Boolean);

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
    <main className="pb-12">
      <Header showSearch={false} />

      {/* GALERÍA DE IMÁGENES */}
      <div className="max-w-2xl mx-auto px-4 mt-4">
        <div className="relative w-full aspect-square bg-gray-100 rounded-2xl overflow-hidden border border-gray-100 flex items-center justify-center">
          {imagenPrincipal ? (
            <img
              src={imagenPrincipal}
              alt={producto.nombre}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-6xl">📦</div>
          )}
          {tieneOferta && (
            <span className="absolute top-3 left-3 bg-brand-orange text-white text-xs font-bold px-3 py-1 rounded-full z-10">
              OFERTA
            </span>
          )}
        </div>

        {listaImagenes.length > 1 && (
          <div className="flex gap-3 mt-3 overflow-x-auto pb-2">
            {listaImagenes.map((img, index) => (
              <button
                key={index}
                onClick={() => setImagenPrincipal(img)}
                className={`w-16 h-16 rounded-xl overflow-hidden border-2 bg-gray-50 flex-shrink-0 transition ${
                  imagenPrincipal === img ? "border-brand-blue ring-2 ring-blue-100" : "border-gray-200"
                }`}
              >
                <img src={img} className="w-full h-full object-cover" alt="miniatura" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* INFORMACIÓN DEL PRODUCTO */}
      <div className="max-w-2xl mx-auto px-4 mt-6">
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

        {sinStock && (
          <span className="inline-block mt-2 bg-gray-700 text-white text-xs font-bold px-3 py-1 rounded-full">
            Sin stock por el momento
          </span>
        )}
        {!sinStock && ultimaUnidad && (
          <span className="inline-block mt-2 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full">
            ¡Última unidad disponible!
          </span>
        )}

        {/* CANTIDAD Y BOTONES */}
        {!sinStock && (
          <div className="flex items-center gap-4 mt-6">
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
                onClick={() => setCantidad((c) => (stock !== null ? Math.min(stock, c + 1) : c + 1))}
                disabled={stock !== null && cantidad >= stock}
                className="px-3 py-2 text-lg text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                +
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-3 mt-6">
          {sinStock ? (
            <a
              href={buildWhatsAppLink(whatsappProductMessage(producto))}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary text-center"
            >
              💬 Consultar al vendedor
            </a>
          ) : (
            <>
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
            </>
          )}
        </div>

        {/* DESCRIPCIÓN, CARACTERÍSTICAS Y ACCESORIOS */}
        <div className="mt-10 border-t border-gray-100 pt-8 space-y-6">
          {producto.descripcion && (
            <div className="bg-gray-50 p-5 rounded-2xl">
              <h2 className="text-lg font-bold text-gray-900 mb-2">Descripción</h2>
              <p className="text-gray-700 whitespace-pre-line leading-relaxed">
                {producto.descripcion}
              </p>
            </div>
          )}

          {producto.caracteristicas && (
            <div className="bg-gray-50 p-5 rounded-2xl">
              <h2 className="text-lg font-bold text-gray-900 mb-2">Características principales</h2>
              <p className="text-gray-700 whitespace-pre-line leading-relaxed">
                {producto.caracteristicas}
              </p>
            </div>
          )}

          {producto.accesorios && (
            <div className="bg-blue-50/50 border border-blue-100 p-5 rounded-2xl">
              <h2 className="text-lg font-bold text-blue-900 mb-2">¿Qué incluye la caja?</h2>
              <p className="text-gray-800 whitespace-pre-line leading-relaxed">
                {producto.accesorios}
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
