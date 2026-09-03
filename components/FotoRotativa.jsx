"use client";

import { useState, useEffect, useRef } from "react";

// Muestra la foto de un producto y, si tiene más de una cargada, las va
// rotando. Sirve para que la lista no se vea siempre igual y para mostrar
// el producto desde varios ángulos sin que el cliente tenga que entrar.
//
// Detalles pensados para que no moleste ni ponga lento el celular:
//  - Solo rota mientras la tarjeta está visible en pantalla.
//  - Cada tarjeta arranca en un momento distinto, si no parpadearía todo junto.
//  - Si el producto tiene una sola foto, se comporta como una imagen normal.
export default function FotoRotativa({
  fotos = [],
  alt = "",
  className = "",
  intervalo = 5500,
  mostrarIndicadores = true
}) {
  const disponibles = fotos.filter((f) => f && String(f).trim() !== "");

  const [actual, setActual] = useState(0);
  const [visible, setVisible] = useState(true);
  const contenedor = useRef(null);

  useEffect(() => {
    if (disponibles.length < 2) return;

    let temporizador = null;
    let arranque = null;

    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting && !temporizador && !arranque) {
          arranque = setTimeout(() => {
            temporizador = setInterval(() => {
              setVisible(false);
              setTimeout(() => {
                setActual((i) => (i + 1) % disponibles.length);
                setVisible(true);
              }, 250);
            }, intervalo);
          }, 400 + Math.random() * 2500);
        } else if (!entrada.isIntersecting) {
          if (temporizador) clearInterval(temporizador);
          if (arranque) clearTimeout(arranque);
          temporizador = null;
          arranque = null;
        }
      },
      { threshold: 0.15 }
    );

    if (contenedor.current) observador.observe(contenedor.current);

    return () => {
      if (temporizador) clearInterval(temporizador);
      if (arranque) clearTimeout(arranque);
      observador.disconnect();
    };
  }, [disponibles.length, intervalo]);

  if (disponibles.length === 0) {
    return (
      <div className={`${className} bg-gray-100 flex items-center justify-center text-gray-400 text-2xl`}>
        📦
      </div>
    );
  }

  return (
    <span
      ref={contenedor}
      className="block relative"
      onTouchStart={alTocar}
      onTouchEnd={alSoltar}
    >
      <img
        src={disponibles[actual]}
        alt={alt}
        className={`${className} transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      />

      {mostrarIndicadores && disponibles.length > 1 && (
        <span className="absolute bottom-1.5 left-1.5 flex gap-1">
          {disponibles.map((_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all ${
                i === actual ? "w-3 bg-white" : "w-1 bg-white/60"
              }`}
              style={{ boxShadow: "0 0 2px rgba(0,0,0,0.5)" }}
            />
          ))}
        </span>
      )}
    </span>
  );
}
