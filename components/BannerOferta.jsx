"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { formatPrice } from "@/lib/whatsapp";

// Cartel de la oferta vigente.
//
// La leyenda del descuento y el tiempo restante quedan SIEMPRE fijos a la
// izquierda: son lo que hace decidir. A la derecha van pasando los productos
// en oferta, para que el cliente vea qué puede comprar sin tener que entrar.
export default function BannerOferta() {
  const [campana, setCampana] = useState(null);
  const [productos, setProductos] = useState([]);
  const [actual, setActual] = useState(0);
  const [restante, setRestante] = useState("");

  useEffect(() => {
    async function cargar() {
      try {
        const { data } = await supabase.rpc("campana_vigente");
        const c = data?.[0];
        if (!c) return;
        setCampana(c);

        // Traemos los productos rebajados para mostrarlos en el cartel
        const { data: prods } = await supabase
          .from("Productos")
          .select("id, nombre, precio, precio_oferta, imagen_url")
          .eq("campana_id", c.id)
          .not("imagen_url", "is", null)
          .limit(8);

        setProductos(prods || []);
      } catch (e) {
        // Sin conexión no mostramos nada: los precios guardados podrían no
        // reflejar la oferta y sería peor prometer algo que no está.
      }
    }
    cargar();
  }, []);

  // Cuenta regresiva
  useEffect(() => {
    if (!campana) return;

    function actualizar() {
      const ms = new Date(campana.termina) - new Date();
      if (ms <= 0) {
        setCampana(null);
        return;
      }

      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);

      if (h >= 24) {
        const d = Math.floor(h / 24);
        setRestante(`${d}d ${h % 24}h`);
      } else if (h > 0) {
        setRestante(`${h}h ${m}m`);
      } else {
        setRestante(`${m}:${String(s).padStart(2, "0")}`);
      }
    }

    actualizar();
    const t = setInterval(actualizar, 1000);
    return () => clearInterval(t);
  }, [campana]);

  // Los productos van rotando
  useEffect(() => {
    if (productos.length < 2) return;
    const t = setInterval(() => {
      setActual((i) => (i + 1) % productos.length);
    }, 3000);
    return () => clearInterval(t);
  }, [productos.length]);

  if (!campana) return null;

  const cantidad = Number(campana.productos_afectados || 0);
  if (cantidad === 0) return null;

  const total = Number(campana.total_propios || 0);
  const esTodo = cantidad >= total && total > 0;

  const detalle = esTodo
    ? "en todo el catálogo"
    : cantidad === 1
    ? "en 1 producto"
    : `en ${cantidad} productos`;

  const ultimasHoras = new Date(campana.termina) - new Date() < 6 * 3600000;
  const prod = productos[actual];

  return (
    <Link href="/catalogo?oferta=1" className="block px-4 mt-3">
      <div
        className={`rounded-2xl overflow-hidden shadow-lg relative ${
          ultimasHoras
            ? "bg-gradient-to-br from-red-600 via-red-600 to-red-800"
            : "bg-gradient-to-br from-brand-orange via-brand-orange to-brand-orangeDark"
        }`}
      >
        {/* Cinta superior con el tiempo */}
        <div className="bg-black/20 px-3 py-1.5 flex items-center justify-between">
          <span className="text-[10px] font-black text-white tracking-widest">
            {campana.titulo}
          </span>
          <span className="text-[10px] font-bold text-white flex items-center gap-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
            </span>
            Termina en {restante}
          </span>
        </div>

        <div className="flex items-stretch">
          {/* Descuento: siempre visible, nunca rota */}
          <div className="p-3 pr-2 flex flex-col justify-center min-w-[42%]">
            <p className="text-[42px] leading-none font-black text-white drop-shadow-sm">
              {Number(campana.porcentaje)}
              <span className="text-2xl">%</span>
            </p>
            <p className="text-sm font-black text-white leading-none -mt-0.5">OFF</p>
            <p className="text-[10px] text-white/90 mt-1 leading-tight">{detalle}</p>

            {campana.mensaje && (
              <p className="text-[9px] text-white/80 mt-1 leading-tight line-clamp-2">
                {campana.mensaje}
              </p>
            )}

            <span className="inline-block bg-white text-[10px] font-black px-2.5 py-1 rounded-full mt-2 w-fit text-gray-800">
              Ver ofertas →
            </span>
          </div>

          {/* Productos rotando */}
          {prod && (
            <div className="flex-1 bg-white/10 backdrop-blur-sm p-2 flex items-center gap-2 min-w-0">
              <div className="w-16 h-16 bg-white rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center p-1">
                <img
                  src={prod.imagen_url}
                  alt=""
                  className="max-w-full max-h-full object-contain transition-opacity duration-300"
                  key={prod.id}
                />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-white font-semibold leading-tight line-clamp-2">
                  {prod.nombre}
                </p>
                <p className="text-[10px] text-white/70 line-through leading-none mt-1">
                  ${formatPrice(prod.precio)}
                </p>
                <p className="text-base font-black text-white leading-none">
                  ${formatPrice(prod.precio_oferta)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Puntitos de los productos */}
        {productos.length > 1 && (
          <div className="flex justify-center gap-1 pb-1.5 bg-black/10">
            {productos.map((_, i) => (
              <span
                key={i}
                className={`h-1 rounded-full transition-all ${
                  i === actual ? "w-3 bg-white" : "w-1 bg-white/40"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
