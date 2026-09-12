"use client";

import { useEffect, useRef, useState } from "react";

// Escáner de códigos de barras y QR.
//
// El permiso de cámara se pide al tocar el botón, no antes: los navegadores
// solo muestran el cartel de permiso si la acción viene de un toque directo
// del usuario. Si se pide al cargar la pantalla, lo bloquean en silencio y
// después parece que "no dio permiso" cuando en realidad nunca se le
// preguntó.

export default function EscanerCodigo({ abierto, onLeer, onCerrar }) {
  const video = useRef(null);
  const [estado, setEstado] = useState("iniciando");
  const [detalle, setDetalle] = useState("");
  const [instalada, setInstalada] = useState(false);

  // La app instalada no tiene barra de direcciones ni candado: el permiso
  // se maneja desde la configuración de Android, no desde el navegador.
  useEffect(() => {
    try {
      setInstalada(
        window.matchMedia("(display-mode: standalone)").matches ||
          window.navigator.standalone === true
      );
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (!abierto) return;

    let stream = null;
    let seguir = true;

    async function arrancar() {
      // 1. La cámara solo funciona en sitios seguros (https)
      if (typeof window !== "undefined" && !window.isSecureContext) {
        setEstado("no_seguro");
        return;
      }

      // 2. El navegador tiene que saber usar la cámara
      if (!navigator.mediaDevices?.getUserMedia) {
        setEstado("sin_camara");
        return;
      }

      // 3. Consultamos si ya está decidido. Si Android lo tiene denegado,
      //    pedirlo de nuevo no muestra ningún cartel: hay que mandar a la
      //    configuración del sistema.
      try {
        if (navigator.permissions?.query) {
          const p = await navigator.permissions.query({ name: "camera" });
          if (p.state === "denied") {
            setEstado("sin_permiso");
            return;
          }
        }
      } catch (e) {
        // Algunos navegadores no permiten consultarlo: seguimos igual
      }

      // 4. Pedimos la cámara. Acá aparece el cartel de permiso.
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false
        });
      } catch (e) {
        // Si falla pidiendo la cámara trasera, probamos con cualquiera:
        // algunos celulares no la identifican bien.
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (e2) {
          setDetalle(e2.name || e.name || "");
          setEstado(
            e2.name === "NotAllowedError" || e.name === "NotAllowedError"
              ? "sin_permiso"
              : e2.name === "NotFoundError"
              ? "sin_camara"
              : "error"
          );
          return;
        }
      }

      if (!seguir) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      if (video.current) {
        video.current.srcObject = stream;
        try {
          await video.current.play();
        } catch (e) {}
      }

      // 5. Lector de códigos. Si el navegador no lo trae, la cámara igual
      //    se ve y se puede escribir el código a mano.
      if (!("BarcodeDetector" in window)) {
        setEstado("sin_lector");
        return;
      }

      setEstado("leyendo");

      const detector = new window.BarcodeDetector({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code", "itf"]
      });

      async function buscar() {
        if (!seguir || !video.current) return;
        try {
          const codigos = await detector.detect(video.current);
          if (codigos.length > 0 && codigos[0].rawValue) {
            try { navigator.vibrate?.(60); } catch (e) {}
            onLeer(codigos[0].rawValue);
            return;
          }
        } catch (e) {}
        if (seguir) setTimeout(buscar, 250);
      }
      buscar();
    }

    arrancar();

    return () => {
      seguir = false;
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [abierto, onLeer]);

  if (!abierto) return null;

  const problemas = {
    sin_permiso: instalada
      ? {
          titulo: "Falta el permiso de cámara",
          texto:
            "Como la app está instalada, el permiso se da desde la configuración del celular:",
          pasos: [
            "Salí de la app y mantené apretado su ícono",
            'Tocá "Información de la app" (la ⓘ)',
            "Entrá en Permisos → Cámara",
            'Elegí "Permitir"',
            "Volvé a abrir la app y probá de nuevo"
          ]
        }
      : {
          titulo: "Falta el permiso de cámara",
          texto: "El navegador no está dejando usar la cámara en esta página.",
          pasos: [
            "Tocá el candado 🔒 al lado de la dirección, arriba",
            'Entrá en "Permisos" o "Configuración del sitio"',
            'En Cámara elegí "Permitir"',
            "Recargá la página"
          ]
        },
    no_seguro: {
      titulo: "Hace falta una conexión segura",
      texto:
        "La cámara solo funciona en direcciones que empiezan con https. Entrá desde bolsonclick.com.ar.",
      pasos: []
    },
    sin_camara: {
      titulo: "No se encontró la cámara",
      texto: "Este dispositivo no tiene cámara disponible o está en uso por otra app.",
      pasos: ["Cerrá otras apps que usen la cámara", "Volvé a intentar"]
    },
    sin_lector: {
      titulo: "Este navegador no lee códigos",
      texto:
        "La cámara funciona, pero el lector automático solo está en Chrome de Android. Escribí el código a mano.",
      pasos: []
    },
    error: {
      titulo: "No se pudo abrir la cámara",
      texto: detalle || "Probá cerrando y abriendo la app.",
      pasos: []
    }
  };

  const p = problemas[estado];

  return (
    <div className="fixed inset-0 z-[90] bg-black flex flex-col">
      <div className="flex justify-between items-center p-4 bg-black/70">
        <p className="text-white text-sm font-bold">
          {estado === "leyendo" ? "Apuntá al código" : "Cámara"}
        </p>
        <button onClick={onCerrar} className="text-white text-3xl px-2 leading-none">
          ×
        </button>
      </div>

      {p ? (
        <div className="flex-1 flex items-center justify-center p-5">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm">
            <p className="font-bold text-base text-gray-800">{p.titulo}</p>
            <p className="text-xs text-gray-600 mt-1.5">{p.texto}</p>

            {p.pasos.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-3 mt-3">
                {p.pasos.map((paso, i) => (
                  <p key={i} className="text-[11px] text-gray-700 mb-1">
                    {i + 1}. {paso}
                  </p>
                ))}
              </div>
            )}

            {estado === "sin_permiso" && (
              <>
                <button
                  onClick={() => {
                    // Reintentamos sin cerrar: si el permiso se acaba de
                    // dar desde la configuración, funciona en el momento.
                    setEstado("iniciando");
                    setDetalle("");
                  }}
                  className="w-full bg-green-600 text-white text-sm font-bold py-3 rounded-xl mt-4"
                >
                  Ya lo activé, probar de nuevo
                </button>

                {instalada && (
                  <a
                    href="https://www.bolsonclick.com.ar/admin/caja"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full bg-white border border-gray-300 text-gray-700 text-xs font-bold py-2.5 rounded-xl mt-2 text-center"
                  >
                    O abrilo en Chrome
                  </a>
                )}
              </>
            )}

            <button
              onClick={onCerrar}
              className="w-full bg-brand-blue text-white text-sm font-bold py-3 rounded-xl mt-2"
            >
              Escribir el código a mano
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 relative">
          <video
            ref={video}
            playsInline
            muted
            autoPlay
            className="w-full h-full object-cover"
          />

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-40 border-4 border-white/90 rounded-2xl shadow-lg" />
          </div>

          <p className="absolute bottom-10 left-0 right-0 text-center text-white text-sm px-6">
            {estado === "iniciando"
              ? "Abriendo la cámara..."
              : "Acercá el código del producto"}
          </p>
        </div>
      )}
    </div>
  );
}
