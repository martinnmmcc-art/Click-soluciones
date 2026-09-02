"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { formatPrice } from "@/lib/whatsapp";

// Carrusel de novedades de la semana.
//
// Criterio de marketing detrás del diseño:
//  - NOVEDAD: "llegó esta semana" da una razón concreta para volver a mirar.
//    Un banner fijo de "30% OFF" se vuelve invisible después de dos visitas.
//  - ESCASEZ REAL: mostramos "última unidad" SOLO cuando el stock es 1 de verdad.
//    La escasez inventada funciona una vez y después quema la confianza,
//    que en un pueblo es lo único que no se recupera.
//  - ANCLAJE DE PRECIO: si hay oferta, se ve el precio anterior tachado para
//    que el ahorro sea evidente sin tener que calcularlo.
//  - MOVIMIENTO: el auto-avance capta la atención, pero se frena al tocarlo
//    para no pelearse con quien está leyendo.

const MS_POR_SLIDE = 4500;

export default function BannerNovedades() {
  const [productos, setProductos] = useState([]);
  const [actual, setActual] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [cargando, setCargando] = useState(true);
  const touchX = useRef(null);

  useEffect(() => {
    async function cargar() {
      // Lo más nuevo que tengas en mano y con foto: es lo que se puede
      // entregar ya, y lo que más rápido se convierte en venta.
      const { data } = await supabase
        .from("Productos")
        .select("id, nombre, precio, precio_oferta, stock, imagen_url, descripcion, categoria, fecha_ingreso")
        .or("bajo_pedido.is.null,bajo_pedido.eq.false")
        .eq("activo", true)
        .gt("stock", 0)
        .not("imagen_url", "is", null)
        // fecha_ingreso = cuándo llegó la mercadería de verdad. No usamos
        // created_at porque un producto puede estar cargado hace meses
        // y haber recibido stock recién ahora.
        // Desempatamos por id: cuando llega un pedido entero se cargan todos
        // con el mismo horario, y sin este segundo criterio el orden cambiaba
        // al azar en cada visita.
        .order("fecha_ingreso", { ascending: false, nullsFirst: false })
        .order("id", { ascending: false })
        .limit(8);

      setProductos(data || []);
      setCargando(false);
    }
    cargar();

    // Al volver a la app volvemos a consultar: si no, alguien que la deja
    // abierta sigue viendo las novedades de hace días.
    function alVolver() {
      if (document.visibilityState === "visible") cargar();
    }
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, []);

  useEffect(() => {
    if (pausado || productos.length <= 1) return;
    const t = setInterval(() => {
      setActual((i) => (i + 1) % productos.length);
    }, MS_POR_SLIDE);
    return () => clearInterval(t);
  }, [pausado, productos.length]);

  function alTocar(e) {
    touchX.current = e.touches[0].clientX;
    setPausado(true);
  }

  function alSoltar(e) {
    if (touchX.current === null) return;
    const diff = touchX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      setActual((i) =>
        diff > 0 ? (i + 1) % productos.length : (i - 1 + productos.length) % productos.length
      );
    }
    touchX.current = null;
    setTimeout(() => setPausado(false), 6000);
  }

  if (cargando) {
    return (
      <div className="px-4 mt-4">
        <div className="rounded-2xl bg-gray-100 h-44 animate-pulse" />
      </div>
    );
  }

  // Sin novedades cargadas no mostramos un banner vacío: mejor nada que
  // una promesa que la tienda no puede cumplir.
  if (productos.length === 0) return null;

  const p = productos[actual];
  const enOferta = p.precio_oferta && Number(p.precio_oferta) < Number(p.precio);
  const precioFinal = enOferta ? Number(p.precio_oferta) : Number(p.precio);
  const ahorro = enOferta ? Number(p.precio) - Number(p.precio_oferta) : 0;
  const porcentaje = enOferta ? Math.round((ahorro / Number(p.precio)) * 100) : 0;
  const ultimaUnidad = Number(p.stock) === 1;
  const pocasUnidades = Number(p.stock) > 1 && Number(p.stock) <= 3;

  const descripcionCorta = (p.descripcion || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 95);

  return (
    <div className="px-4 mt-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-orange opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-orange" />
          </span>
          <p className="text-xs font-extrabold text-gray-800 uppercase tracking-wide">
            Novedades de esta semana
          </p>
        </div>
        <Link href="/catalogo" className="text-[11px] font-bold text-brand-blue">
          Ver todo →
        </Link>
      </div>

      <Link
        href={`/producto/${p.id}`}
        onTouchStart={alTocar}
        onTouchEnd={alSoltar}
        className="block rounded-2xl overflow-hidden shadow-md bg-white border border-gray-100 active:scale-[0.99] transition-transform"
      >
        <div className="flex">
          {/* FOTO */}
          <div className="relative w-2/5 flex-shrink-0 bg-white flex items-center justify-center aspect-square p-2">
            <img
              src={p.imagen_url}
              alt={p.nombre}
              // object-contain muestra el producto entero. Con object-cover
              // se recortaban los bordes y quedaban productos cortados.
              className="max-w-full max-h-full object-contain"
              loading="eager"
            />
            {enOferta && (
              <span className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow">
                -{porcentaje}%
              </span>
            )}
          </div>

          {/* TEXTO */}
          <div className="flex-1 p-3 min-w-0 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1 mb-1 flex-wrap">
                <span className="bg-brand-blue/10 text-brand-blue text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                  ✨ RECIÉN LLEGADO
                </span>
                {ultimaUnidad && (
                  <span className="bg-red-50 text-red-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                    ÚLTIMA UNIDAD
                  </span>
                )}
                {pocasUnidades && (
                  <span className="bg-amber-50 text-amber-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                    QUEDAN {p.stock}
                  </span>
                )}
              </div>

              <h3 className="font-bold text-sm text-gray-800 leading-tight line-clamp-2">
                {p.nombre}
              </h3>

              {descripcionCorta && (
                <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">
                  {descripcionCorta}
                </p>
              )}
            </div>

            <div className="mt-2">
              {enOferta && (
                <p className="text-[11px] text-gray-400 line-through leading-none">
                  ${formatPrice(p.precio)}
                </p>
              )}
              <div className="flex items-end justify-between gap-2">
                <p className="text-lg font-extrabold text-gray-900 leading-tight">
                  ${formatPrice(precioFinal)}
                </p>
                <span className="text-[11px] font-bold text-white bg-brand-blue px-2.5 py-1 rounded-lg whitespace-nowrap">
                  Ver
                </span>
              </div>
              {enOferta && (
                <p className="text-[10px] font-bold text-green-700 mt-0.5">
                  Ahorrás ${formatPrice(ahorro)}
                </p>
              )}
              <p className="text-[10px] text-gray-400 mt-0.5">🚚 Entrega en El Bolsón</p>
            </div>
          </div>
        </div>
      </Link>

      {/* INDICADORES */}
      {productos.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2">
          {productos.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setActual(i);
                setPausado(true);
                setTimeout(() => setPausado(false), 6000);
              }}
              aria-label={`Ver novedad ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === actual ? "w-5 bg-brand-blue" : "w-1.5 bg-gray-300"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
