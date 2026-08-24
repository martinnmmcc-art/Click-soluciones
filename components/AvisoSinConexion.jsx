"use client";

import { useEffect, useState } from "react";
import { cantidadPendientesCliente, sincronizarColaCliente } from "@/lib/colaPedidosCliente";
import { sincronizarCambios } from "@/lib/descargaOffline";

// Barra fija arriba de todo que avisa cuando el celular se queda sin señal.
// En la Comarca la cobertura es irregular, así que el cliente tiene que saber
// que puede seguir comprando igual y que su pedido no se pierde.
export default function AvisoSinConexion() {
  const [sinConexion, setSinConexion] = useState(false);
  const [recuperada, setRecuperada] = useState(false);
  const [pendientes, setPendientes] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [cambios, setCambios] = useState(null);

  useEffect(() => {
    function actualizar() {
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      setSinConexion(offline);
      setPendientes(cantidadPendientesCliente());
    }

    async function alVolver() {
      setSinConexion(false);
      setRecuperada(true);

      // Apenas vuelve la señal mandamos lo que quedó pendiente
      if (cantidadPendientesCliente() > 0) {
        setEnviando(true);
        await sincronizarColaCliente();
        setPendientes(cantidadPendientesCliente());
        setEnviando(false);
      }

      // Y actualizamos precios y stock que hayan cambiado mientras no había señal
      try {
        const res = await sincronizarCambios();
        if (res?.cambios > 0) {
          setCambios(res);
          setTimeout(() => setCambios(null), 6000);
        }
      } catch (e) {}

      setTimeout(() => setRecuperada(false), 4000);
    }

    actualizar();
    window.addEventListener("offline", actualizar);
    window.addEventListener("online", alVolver);
    return () => {
      window.removeEventListener("offline", actualizar);
      window.removeEventListener("online", alVolver);
    };
  }, []);

  if (!sinConexion && !recuperada && pendientes === 0 && !cambios) return null;

  let fondo = "bg-gray-800";
  let texto = "📡 Sin señal · podés seguir mirando y armar tu pedido";

  if (sinConexion && pendientes > 0) {
    texto = `📡 Sin señal · ${pendientes} pedido${pendientes === 1 ? "" : "s"} se enviará${
      pendientes === 1 ? "" : "n"
    } al volver`;
  } else if (enviando) {
    fondo = "bg-brand-blue";
    texto = "Enviando tu pedido...";
  } else if (cambios) {
    // Le contamos qué se actualizó: si vio un precio viejo mientras estaba
    // sin señal, tiene que saber que ahora puede ser otro.
    fondo = "bg-green-600";
    const partes = [];
    if (cambios.precios > 0) partes.push(`${cambios.precios} precio${cambios.precios === 1 ? "" : "s"}`);
    if (cambios.nuevos > 0) partes.push(`${cambios.nuevos} producto${cambios.nuevos === 1 ? "" : "s"} nuevo${cambios.nuevos === 1 ? "" : "s"}`);
    if (cambios.sinStock > 0) partes.push(`${cambios.sinStock} sin stock`);
    texto = partes.length
      ? `✓ Actualizado: ${partes.join(" · ")}`
      : "✓ Todo actualizado";
  } else if (recuperada) {
    fondo = "bg-green-600";
    texto = "✓ Volvió la señal · actualizando...";
  } else if (pendientes > 0) {
    fondo = "bg-amber-600";
    texto = `${pendientes} pedido${pendientes === 1 ? "" : "s"} esperando enviarse`;
  }

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[60] text-center text-[11px] font-bold py-2 px-3 text-white ${fondo}`}
    >
      {texto}
    </div>
  );
}
