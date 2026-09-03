"use client";

import { useState, useEffect, useRef } from "react";

// Muestra las fotos de un producto rotándolas, y si tiene un video corto
// también lo reproduce dentro de la rotación.
//
// Cuidados pensados para clientes con datos limitados:
//  - Solo rota mientras la tarjeta está a la vista.
//  - Nunca reproduce con sonido.
//  - Si el celular está con ahorro de datos o red lenta, no carga videos.
//  - Los videos de YouTube no se reproducen en las listas (pesan demasiado):
//    quedan para la ficha del producto.
//
// El cliente puede cambiar la foto tocando los puntitos o deslizando,
// sin tener que entrar al producto.

function conexionLimitada() {
  try {
    const con =
      navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!con) return false;
    if (con.saveData) return true;
    return ["slow-2g", "2g", "3g"].includes(con.effectiveType);
  } catch (e) {
    return false;
  }
}

export default function FotoRotativa({
  fotos = [],
  video = null,
  alt = "",
  className = "",
  intervalo = 5500,
  mostrarIndicadores = true
}) {
  const disponibles = Array.isArray(fotos)
    ? fotos.filter((f) => f && String(f).trim() !== "")
    : [];

  const [videoUsable, setVideoUsable] = useState(null);
  const [actual, setActual] = useState(0);
  const [visible, setVisible] = useState(true);
  const [enPantalla, setEnPantalla] = useState(false);
  const [pausado, setPausado] = useState(false);

  const contenedor = useRef(null);
  const refVideo = useRef(null);
  const touchX = useRef(null);
  const pausadoRef = useRef(false);

  // La conexión solo se puede consultar en el navegador, nunca al generar
  // la página en el servidor.
  useEffect(() => {
    if (video && !String(video).includes("youtube") && !conexionLimitada()) {
      setVideoUsable(video);
    } else {
      setVideoUsable(null);
    }
  }, [video]);

  useEffect(() => {
    pausadoRef.current = pausado;
  }, [pausado]);

  const totalSlides = disponibles.length + (videoUsable ? 1 : 0);
  const mostrandoVideo = videoUsable && actual === disponibles.length;

  // Si cambia la cantidad de fotos, evitamos quedar apuntando a una que ya no existe
  useEffect(() => {
    if (totalSlides > 0 && actual >= totalSlides) setActual(0);
  }, [totalSlides, actual]);

  useEffect(() => {
    if (totalSlides < 2) return;

    let temporizador = null;
    let arranque = null;

    const observador = new IntersectionObserver(
      ([entrada]) => {
        setEnPantalla(entrada.isIntersecting);

        if (entrada.isIntersecting && !temporizador && !arranque) {
          // Cada tarjeta arranca en un momento distinto: si cambiaran todas
          // juntas quedaría como un parpadeo de toda la pantalla.
          arranque = setTimeout(() => {
            temporizador = setInterval(() => {
              if (pausadoRef.current) return;
              setVisible(false);
              setTimeout(() => {
                setActual((i) => (i + 1) % totalSlides);
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
      // Umbral bajo: en los carruseles horizontales las tarjetas quedan
      // parcialmente cortadas y con un umbral alto nunca arrancaban.
      { threshold: 0.15 }
    );

    if (contenedor.current) observador.observe(contenedor.current);

    return () => {
      if (temporizador) clearInterval(temporizador);
      if (arranque) clearTimeout(arranque);
      observador.disconnect();
    };
  }, [totalSlides, intervalo]);

  // El video se reproduce solo mientras está a la vista
  useEffect(() => {
    const v = refVideo.current;
    if (!v) return;

    if (mostrandoVideo && enPantalla) {
      v.play().catch(() => {});
    } else {
      v.pause();
      try {
        v.currentTime = 0;
      } catch (e) {}
    }
  }, [mostrandoVideo, enPantalla]);

  function irA(i, e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setActual(i);
    setVisible(true);
    setPausado(true);
    setTimeout(() => setPausado(false), 8000);
  }

  function alTocar(e) {
    touchX.current = e.touches?.[0]?.clientX ?? null;
  }

  function alSoltar(e) {
    if (touchX.current === null || totalSlides < 2) return;
    const fin = e.changedTouches?.[0]?.clientX;
    if (fin === undefined) return;

    const dif = touchX.current - fin;
    if (Math.abs(dif) > 30) {
      e.preventDefault();
      e.stopPropagation();
      irA(dif > 0 ? (actual + 1) % totalSlides : (actual - 1 + totalSlides) % totalSlides);
    }
    touchX.current = null;
  }

  if (disponibles.length === 0 && !videoUsable) {
    return (
      <div
        className={`${className} bg-gray-100 flex items-center justify-center text-gray-400 text-2xl`}
      >
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
      {mostrandoVideo ? (
        <video
          ref={refVideo}
          src={videoUsable}
          className={`${className} transition-opacity duration-300 ${
            visible ? "opacity-100" : "opacity-0"
          }`}
          muted
          loop
          playsInline
          preload="none"
          poster={disponibles[0] || undefined}
        />
      ) : (
        <img
          src={disponibles[actual] || disponibles[0]}
          alt={alt}
          className={`${className} transition-opacity duration-300 ${
            visible ? "opacity-100" : "opacity-0"
          }`}
        />
      )}

      {video && (
        <span className="absolute top-1.5 right-1.5 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
          ▶ video
        </span>
      )}

      {mostrarIndicadores && totalSlides > 1 && (
        <span className="absolute bottom-1 left-0 right-0 flex justify-center gap-1.5 py-1">
          {Array.from({ length: totalSlides }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => irA(i, e)}
              aria-label={`Ver foto ${i + 1}`}
              className="p-1.5 -m-1"
            >
              <span
                className={`block h-1.5 rounded-full transition-all ${
                  i === actual ? "w-4 bg-white" : "w-1.5 bg-white/70"
                }`}
                style={{ boxShadow: "0 0 3px rgba(0,0,0,0.6)" }}
              />
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
