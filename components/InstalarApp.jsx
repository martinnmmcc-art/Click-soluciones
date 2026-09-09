"use client";

import { useEffect, useState } from "react";

// Invita a instalar la app en el celular.
//
// Aparece enseguida y como barra chica arriba de la navegación: instalar es
// lo que hace que el cliente vuelva sin tener que acordarse de la dirección,
// y al no tapar contenido puede quedar a la vista sin molestar.
//
// En iPhone no se puede instalar con un botón, así que le mostramos los
// pasos: es el sistema el que lo exige, no un capricho.

const CLAVE_CERRADO = "bolsonclick_instalar_cerrado";
const DIAS_ESPERA = 5;
const SEGUNDOS_HASTA_APARECER = 4;

function esIOS() {
  try {
    return (
      /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    );
  } catch (e) {
    return false;
  }
}

function yaEstaInstalada() {
  try {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  } catch (e) {
    return false;
  }
}

function loCerroHacePoco() {
  try {
    const g = localStorage.getItem(CLAVE_CERRADO);
    if (!g) return false;
    const dias = (Date.now() - new Date(g).getTime()) / 86400000;
    return dias < DIAS_ESPERA;
  } catch (e) {
    return false;
  }
}

export default function InstalarApp() {
  const [mostrar, setMostrar] = useState(false);
  const [evento, setEvento] = useState(null);
  const [mostrarPasos, setMostrarPasos] = useState(false);

  useEffect(() => {
    if (yaEstaInstalada() || loCerroHacePoco()) return;

    // Android: el navegador avisa cuando se puede instalar
    function alPoderInstalar(e) {
      e.preventDefault();
      setEvento(e);
      setTimeout(() => setMostrar(true), SEGUNDOS_HASTA_APARECER * 1000);
    }

    window.addEventListener("beforeinstallprompt", alPoderInstalar);

    // iPhone nunca dispara ese aviso: mostramos igual con los pasos
    let t = null;
    if (esIOS()) {
      t = setTimeout(() => setMostrar(true), SEGUNDOS_HASTA_APARECER * 1000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", alPoderInstalar);
      if (t) clearTimeout(t);
    };
  }, []);

  // Si la instala, la barra se va sola
  useEffect(() => {
    function instalada() {
      setMostrar(false);
    }
    window.addEventListener("appinstalled", instalada);
    return () => window.removeEventListener("appinstalled", instalada);
  }, []);

  function cerrar() {
    setMostrar(false);
    try {
      localStorage.setItem(CLAVE_CERRADO, new Date().toISOString());
    } catch (e) {}
  }

  async function instalar() {
    if (evento) {
      try {
        evento.prompt();
        const { outcome } = await evento.userChoice;
        if (outcome === "accepted") setMostrar(false);
      } catch (e) {
        setMostrarPasos(true);
      }
      return;
    }
    setMostrarPasos(true);
  }

  if (!mostrar) return null;

  return (
    <>
      {/* Barra fija arriba de la navegación inferior. Ocupa poco y no tapa
          el contenido, así puede quedar a la vista sin molestar. */}
      <div className="fixed bottom-16 left-0 right-0 z-[45] px-3 md:bottom-4 md:left-auto md:right-4 md:max-w-xs">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-lg p-2.5 flex items-center gap-2.5">
          <img
            src="/icons/icon-192.png"
            alt=""
            className="w-9 h-9 rounded-xl flex-shrink-0"
          />

          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-gray-800 leading-tight">
              Instalá Bolson Click
            </p>
            <p className="text-[10px] text-gray-500 leading-tight">
              Entrá de una, sin buscar la página
            </p>
          </div>

          <button
            onClick={instalar}
            className="bg-brand-blue text-white text-[11px] font-bold px-3 py-1.5 rounded-xl flex-shrink-0"
          >
            Instalar
          </button>

          <button
            onClick={cerrar}
            aria-label="Cerrar"
            className="text-gray-300 text-base leading-none px-1 flex-shrink-0"
          >
            ×
          </button>
        </div>
      </div>

      {/* Pasos para iPhone, que no permite instalar con un botón */}
      {mostrarPasos && (
        <div
          className="fixed inset-0 z-[75] bg-black/60 flex items-end sm:items-center sm:justify-center"
          onClick={() => setMostrarPasos(false)}
        >
          <div
            className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4 sm:hidden" />

            <div className="text-center mb-4">
              <img
                src="/icons/icon-192.png"
                alt=""
                className="w-14 h-14 rounded-2xl mx-auto mb-2"
              />
              <p className="font-extrabold text-base text-gray-800">
                Instalar en tu iPhone
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Son 3 pasos y queda como una app más
              </p>
            </div>

            <div className="space-y-2.5">
              {[
                ["1", "Tocá el botón Compartir", "El cuadrado con la flecha hacia arriba, abajo de la pantalla"],
                ["2", "Elegí Agregar a inicio", "Vas a tener que bajar un poco en la lista"],
                ["3", "Tocá Agregar", "Arriba a la derecha. ¡Listo!"]
              ].map(([n, titulo, ayuda]) => (
                <div key={n} className="flex gap-3">
                  <span className="w-6 h-6 bg-brand-blue text-white rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {n}
                  </span>
                  <div>
                    <p className="text-xs font-bold text-gray-800">{titulo}</p>
                    <p className="text-[11px] text-gray-500">{ayuda}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setMostrarPasos(false)}
              className="w-full bg-brand-blue text-white text-sm font-bold py-2.5 rounded-xl mt-4"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}
