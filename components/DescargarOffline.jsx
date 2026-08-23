"use client";

import { useEffect, useState } from "react";
import {
  descargarTodoOffline,
  fechaDescargaOffline,
  espacioUsado,
  leerProductosOffline
} from "@/lib/descargaOffline";

// Permite guardar la app entera en el celular para usarla sin señal.
// En la Comarca la cobertura es irregular, así que conviene que el cliente
// pueda dejar todo descargado desde su casa con wifi y después andar tranquilo.
export default function DescargarOffline({ telefono = null, esAdmin = false }) {
  const [descargando, setDescargando] = useState(false);
  const [progreso, setProgreso] = useState(null);
  const [fecha, setFecha] = useState(null);
  const [espacio, setEspacio] = useState(null);
  const [guardados, setGuardados] = useState(0);
  const [resultado, setResultado] = useState(null);
  const [incluirAPedido, setIncluirAPedido] = useState(false);

  useEffect(() => {
    setFecha(fechaDescargaOffline());
    setGuardados(leerProductosOffline().length);
    espacioUsado().then(setEspacio);
  }, []);

  async function descargar() {
    setDescargando(true);
    setResultado(null);

    try {
      const res = await descargarTodoOffline({
        soloPropios: !incluirAPedido,
        incluirFotos: true,
        telefono,
        alAvanzar: setProgreso
      });

      setResultado(res);
      setFecha(new Date());
      setGuardados(res.productos);
      espacioUsado().then(setEspacio);
    } catch (e) {
      alert("No se pudo completar la descarga: " + e.message);
    } finally {
      setDescargando(false);
      setProgreso(null);
    }
  }

  const porcentaje =
    progreso && progreso.total > 0
      ? Math.round((progreso.hechos / progreso.total) * 100)
      : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl">📥</span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-gray-800">Usar la app sin internet</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Guardá los productos y sus fotos en el celular. Después podés mirar
            {esAdmin ? " y armar pedidos" : " y armar tu carrito"} aunque no tengas señal.
          </p>

          {fecha && !descargando && (
            <p className="text-[11px] text-green-700 font-semibold mt-2">
              ✓ {guardados} productos guardados el{" "}
              {fecha.toLocaleDateString("es-AR")} a las{" "}
              {fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}

          {descargando && (
            <div className="mt-3">
              <p className="text-[11px] font-semibold text-brand-blue mb-1">
                {progreso?.etapa === "fotos"
                  ? `Guardando fotos... ${progreso.hechos} de ${progreso.total}`
                  : "Bajando los productos..."}
              </p>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-brand-blue h-full transition-all duration-300"
                  style={{ width: `${porcentaje}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                No cierres la app hasta que termine.
              </p>
            </div>
          )}

          {resultado && !descargando && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-2.5 mt-2">
              <p className="text-[11px] font-bold text-green-800">
                ✓ Listo: {resultado.productos} productos y {resultado.fotos} fotos guardadas
              </p>
              {resultado.fotosFallidas > 0 && (
                <p className="text-[10px] text-green-700 mt-0.5">
                  ({resultado.fotosFallidas} fotos no se pudieron guardar, se van a
                  cargar cuando haya señal)
                </p>
              )}
            </div>
          )}

          <label className="flex items-center gap-2 text-[11px] text-gray-600 mt-3">
            <input
              type="checkbox"
              checked={incluirAPedido}
              onChange={(e) => setIncluirAPedido(e.target.checked)}
              disabled={descargando}
            />
            Incluir también los productos a pedido (ocupa bastante más)
          </label>

          <button
            onClick={descargar}
            disabled={descargando}
            className="w-full bg-brand-blue text-white text-xs font-bold py-2.5 rounded-xl mt-3 disabled:opacity-50"
          >
            {descargando
              ? "Descargando..."
              : fecha
              ? "Actualizar lo guardado"
              : "Guardar para usar sin internet"}
          </button>

          {espacio && (
            <p className="text-[10px] text-gray-400 mt-2 text-center">
              La app ocupa {espacio.usadoMB} MB en tu celular
            </p>
          )}

          <p className="text-[10px] text-gray-400 mt-2">
            Conviene hacerlo con wifi: la primera vez baja todas las fotos.
          </p>
        </div>
      </div>
    </div>
  );
}
