"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import { formatPrice, buildWhatsAppLink } from "@/lib/whatsapp";

function CatalogoCompartirContent() {
  const searchParams = useSearchParams();

  const idsParam = searchParams.get("ids") || "";
  const titulo = searchParams.get("titulo") || "Catálogo Bolson Click";
  const fotos = searchParams.get("fotos") || "principal"; // "principal" o "todas"
  const mostrarPrecio = searchParams.get("precio") !== "0";
  const mostrarStock = searchParams.get("stock") !== "0";
  const mostrarDescripcion = searchParams.get("desc") !== "0";

  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargar() {
      const ids = idsParam
        .split(",")
        .map((i) => i.trim())
        .filter(Boolean);

      if (ids.length === 0) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("Productos")
        .select("*")
        .in("id", ids);

      if (!error && data) {
        // mantener el orden en el que vinieron los ids
        const ordenado = ids
          .map((id) => data.find((p) => String(p.id) === String(id)))
          .filter(Boolean);
        setProductos(ordenado);
      }
      setLoading(false);
    }
    cargar();
  }, [idsParam]);

  const mensajeConsulta = (nombre) =>
    `Hola! 👋 Vi el catálogo de Bolson Click y me interesa *${nombre}*. ¿Está disponible?`;

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      {/* HERO */}
      <div className="bg-brand-blueDark text-white px-5 pt-8 pb-6 text-center">
        <div className="w-16 h-16 rounded-2xl overflow-hidden relative mx-auto mb-3 bg-white">
          <Image src="/logo.png" alt="Bolson Click" fill className="object-cover" />
        </div>
        <h1 className="text-2xl font-extrabold">{titulo}</h1>
        <p className="text-sm text-blue-100 mt-1">
          Productos importados en El Bolsón y la Comarca Andina
        </p>
      </div>

      {/* SOBRE EL EMPRENDIMIENTO */}
      <div className="max-w-md mx-auto px-4 -mt-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-2 text-sm text-gray-700">
          <p>
            🏔️ Somos de <strong>El Bolsón</strong> y vendemos en toda la <strong>Comarca Andina</strong>. Trabajamos con productos importados de hogar, cocina, tecnología y más.
          </p>
          <p>
            🚚 <strong>Envíos</strong> a El Bolsón y la Comarca Andina — coordinamos transporte local o punto de encuentro.
          </p>
          <p>
            🛒 <strong>Cómo comprar:</strong> pedí directo por acá o entrá a nuestra tienda online en{" "}
            <a href="https://www.bolsonclick.com.ar" target="_blank" rel="noopener noreferrer" className="text-brand-blue font-semibold underline">
              www.bolsonclick.com.ar
            </a>{" "}
            y coordinamos el envío o un punto de encuentro.
          </p>
        </div>

        <a
          href={buildWhatsAppLink(
            `Hola! 👋 Vi el catálogo de Bolson Click y quisiera hacer una consulta.`
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center justify-center gap-2 bg-[#25D366] text-white font-bold py-3 rounded-xl shadow-sm"
        >
          💬 Escribinos por WhatsApp
        </a>
      </div>

      {/* PRODUCTOS */}
      <div className="max-w-md mx-auto px-4 mt-6">
        {loading ? (
          <p className="text-center text-gray-400 text-sm py-10">Cargando catálogo...</p>
        ) : productos.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-10">Este catálogo no tiene productos.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {productos.map((prod) => {
              const imagenes = fotos === "todas"
                ? [prod.imagen_url, prod.imagen_url_2, prod.imagen_url_3, prod.imagen_url_4, prod.imagen_url_5, prod.imagen_url_6].filter(Boolean)
                : [prod.imagen_url].filter(Boolean);

              const stock = prod.stock !== null && prod.stock !== undefined ? Number(prod.stock) : null;
              const sinStock = stock !== null && stock <= 0;
              const ultimaUnidad = stock !== null && stock === 1;

              const tieneOferta = prod.precio_oferta && prod.precio_oferta < prod.precio;

              return (
                <div key={prod.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex flex-col">
                  <div className="relative w-full aspect-square bg-gray-50 rounded-xl overflow-hidden mb-2">
                    {imagenes[0] ? (
                      <img src={imagenes[0]} alt={prod.nombre} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl">📦</div>
                    )}
                    {tieneOferta && (
                      <span className="absolute top-1.5 left-1.5 bg-brand-orange text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                        OFERTA
                      </span>
                    )}
                    {mostrarStock && sinStock && (
                      <span className="absolute top-1.5 right-1.5 bg-gray-700 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                        Sin stock
                      </span>
                    )}
                    {mostrarStock && !sinStock && ultimaUnidad && (
                      <span className="absolute top-1.5 right-1.5 bg-red-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                        ¡Última unidad!
                      </span>
                    )}
                  </div>

                  {imagenes.length > 1 && (
                    <div className="flex gap-1 mb-2 overflow-x-auto">
                      {imagenes.slice(1).map((img, i) => (
                        <img key={i} src={img} className="w-8 h-8 rounded-md object-cover border border-gray-200 flex-shrink-0" alt="" />
                      ))}
                    </div>
                  )}

                  <h3 className="font-bold text-xs text-gray-800 line-clamp-2 leading-tight">
                    {prod.nombre}
                  </h3>

                  {mostrarDescripcion && prod.descripcion && (
                    <p className="text-[10px] text-gray-500 line-clamp-2 mt-0.5">{prod.descripcion}</p>
                  )}

                  {mostrarPrecio && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="font-black text-sm text-brand-blue">
                        ${formatPrice(tieneOferta ? prod.precio_oferta : prod.precio)}
                      </span>
                      {tieneOferta && (
                        <span className="text-[10px] text-gray-400 line-through">
                          ${formatPrice(prod.precio)}
                        </span>
                      )}
                    </div>
                  )}

                  <a
                    href={buildWhatsAppLink(mensajeConsulta(prod.nombre))}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 w-full bg-brand-blue text-white text-[11px] font-bold py-1.5 rounded-lg text-center"
                  >
                    Consultar
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="max-w-md mx-auto px-4 mt-8 text-center">
        <p className="text-xs text-gray-400">
          Ver todo el catálogo y comprar online en{" "}
          <a href="https://www.bolsonclick.com.ar" target="_blank" rel="noopener noreferrer" className="text-brand-blue font-semibold underline">
            www.bolsonclick.com.ar
          </a>
        </p>
      </div>
    </main>
  );
}

export default function CatalogoCompartirPage() {
  return (
    <Suspense fallback={<div className="text-center text-gray-400 py-16">Cargando...</div>}>
      <CatalogoCompartirContent />
    </Suspense>
  );
}
