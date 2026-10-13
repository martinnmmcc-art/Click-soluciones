"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { buildWhatsAppLink, formatPrice } from "@/lib/whatsapp";
import { urlImagen } from "@/lib/imagenProducto";

// Banner de "Llega pronto" en el inicio: lo que viene en el pedido al
// proveedor, con foto y precio, para que el cliente lo reserve antes de que
// llegue.
//
// El precio es el que va a tener al llegar: sale de la misma regla que se
// usa al recibir el pedido, así que no es una promesa que después cambia.
// Solo mostramos los que tienen foto y precio: un banner con huecos
// transmite desorden.

const MS_POR_SLIDE = 4000;

export default function BannerLlegaPronto() {
  const [productos, setProductos] = useState([]);
  const [total, setTotal] = useState(0);
  const [actual, setActual] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [cargando, setCargando] = useState(true);
  const touchX = useRef(null);

  useEffect(() => {
    let vivo = true;
    async function cargar() {
      try {
        const { data, error } = await supabase.rpc("llega_pronto");
        if (error) throw error;
        const vistos = new Set();
        const lista = (data || []).filter((p) => {
          const clave = String(p.nombre || "").trim().toLowerCase();
          if (!clave || vistos.has(clave)) return false;
          vistos.add(clave);
          return true;
        });
        if (!vivo) return;
        setTotal(lista.length);
        setProductos(lista.filter((p) => p.imagen_url && Number(p.precio) > 0));
      } catch {
        // Sin señal: no mostramos nada antes que un banner roto
        if (vivo) setProductos([]);
      } finally {
        if (vivo) setCargando(false);
      }
    }
    cargar();
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    if (pausado || productos.length <= 1) return;
    const t = setInterval(() => setActual((i) => (i + 1) % productos.length), MS_POR_SLIDE);
    return () => clearInterval(t);
  }, [pausado, productos.length]);

  function pausarUnRato() {
    setPausado(true);
    setTimeout(() => setPausado(false), 6000);
  }

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
      <div className="px-4 mt-3">
        <div className="rounded-2xl bg-amber-50 h-40 animate-pulse" />
      </div>
    );
  }

  if (productos.length === 0) return null;

  const p = productos[Math.min(actual, productos.length - 1)];
  const enOferta = Number(p.precio_oferta) > 0 && Number(p.precio_oferta) < Number(p.precio);
  const precioFinal = enOferta ? Number(p.precio_oferta) : Number(p.precio);
  const mensaje =
    `¡Hola! Vi que va a llegar *${p.nombre}* a $${formatPrice(precioFinal)} y me interesa. ` +
    `¿Me lo reservás cuando llegue?`;

  return (
    <div className="px-4 mt-3 py-4 bg-gradient-to-b from-amber-50 to-transparent">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg leading-none">🚚</span>
            <h2 className="font-black text-gray-800 text-base leading-none">Llega pronto</h2>
          </div>
          <p className="text-[11px] text-amber-800 mt-1 ml-7">
            Reservalo ahora y es tuyo apenas llegue
          </p>
        </div>
        <Link
          href="/proximamente"
          className="text-[11px] font-bold text-amber-700 whitespace-nowrap mt-1"
        >
          Ver los {total} →
        </Link>
      </div>

      <div
        onTouchStart={alTocar}
        onTouchEnd={alSoltar}
        className="rounded-2xl overflow-hidden shadow-md bg-white border border-amber-200"
      >
        <div className="flex">
          <Link
            href="/proximamente"
            className="relative w-2/5 flex-shrink-0 bg-white flex items-center justify-center aspect-square p-2"
          >
            <img
              src={urlImagen(p.imagen_url)}
              alt={p.nombre}
              className="max-w-full max-h-full object-contain"
              loading="eager"
            />
            <span className="absolute top-2 left-2 bg-amber-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow">
              EN CAMINO
            </span>
          </Link>

          <div className="flex-1 p-3 min-w-0 flex flex-col justify-between">
            <Link href="/proximamente" className="block">
              <span className="inline-block bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full mb-1">
                🚚 LLEGA PRONTO
              </span>
              <h3 className="font-bold text-sm text-gray-800 leading-tight line-clamp-2">{p.nombre}</h3>
              {enOferta && (
                <p className="text-[11px] text-gray-400 line-through leading-none mt-1.5">
                  ${formatPrice(p.precio)}
                </p>
              )}
              <p className="text-lg font-extrabold text-gray-900 leading-tight mt-1">
                ${formatPrice(precioFinal)}
              </p>
            </Link>

            <a
              href={buildWhatsAppLink(mensaje)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block w-full bg-[#25D366] text-white text-[11px] font-bold py-2 rounded-lg text-center active:scale-95 transition"
            >
              💬 Reservar
            </a>
          </div>
        </div>
      </div>

      {productos.length > 12 ? (
        <div className="flex justify-center items-center gap-3 mt-2">
          <button
            onClick={() => {
              setActual((i) => (i - 1 + productos.length) % productos.length);
              pausarUnRato();
            }}
            aria-label="Anterior"
            className="w-7 h-7 rounded-full bg-white border border-amber-200 text-amber-700 font-bold"
          >
            ‹
          </button>
          <span className="text-[11px] font-bold text-amber-800">
            {actual + 1} / {productos.length}
          </span>
          <button
            onClick={() => {
              setActual((i) => (i + 1) % productos.length);
              pausarUnRato();
            }}
            aria-label="Siguiente"
            className="w-7 h-7 rounded-full bg-white border border-amber-200 text-amber-700 font-bold"
          >
            ›
          </button>
        </div>
      ) : productos.length > 1 && (
        <div className="flex justify-center gap-1 mt-2 flex-wrap">
          {productos.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setActual(i);
                pausarUnRato();
              }}
              aria-label={`Ver producto en camino ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === actual ? "w-4 bg-amber-500" : "w-1.5 bg-amber-200"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
