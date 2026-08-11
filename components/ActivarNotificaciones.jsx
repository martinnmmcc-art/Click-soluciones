"use client";

import { useEffect, useState } from "react";
import { pushSoportado, suscribirPush, desuscribirPush, estaSuscripto } from "@/lib/push";

export default function ActivarNotificaciones({ telefono }) {
  const [soportado, setSoportado] = useState(true);
  const [activo, setActivo] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);

  useEffect(() => {
    async function chequear() {
      if (!pushSoportado()) {
        setSoportado(false);
        setCargando(false);
        return;
      }
      setActivo(await estaSuscripto());
      setBloqueado(typeof Notification !== "undefined" && Notification.permission === "denied");
      setCargando(false);
    }
    chequear();
  }, []);

  async function toggle() {
    setProcesando(true);
    try {
      if (activo) {
        await desuscribirPush();
        setActivo(false);
      } else {
        const res = await suscribirPush(telefono);
        if (res.ok) {
          setActivo(true);
        } else if (res.motivo === "denegado") {
          setBloqueado(true);
        }
      }
    } finally {
      setProcesando(false);
    }
  }

  if (!soportado || cargando) return null;

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3 flex items-center justify-between gap-3 shadow-sm">
      <div>
        <p className="text-sm font-semibold text-gray-800">🔔 Notificaciones</p>
        <p className="text-xs text-gray-500">
          {bloqueado
            ? "Las bloqueaste desde el navegador. Habilitalas en Configuración del sitio para recibir avisos."
            : activo
            ? "Vas a recibir avisos de ofertas y novedades"
            : "Activalas para enterarte de ofertas y novedades"}
        </p>
      </div>
      {!bloqueado && (
        <button
          onClick={toggle}
          disabled={procesando}
          className={`relative w-12 h-7 rounded-full transition flex-shrink-0 ${activo ? "bg-brand-blue" : "bg-gray-300"} disabled:opacity-50`}
          aria-label="Activar o desactivar notificaciones"
        >
          <span
            className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${activo ? "translate-x-5" : ""}`}
          />
        </button>
      )}
    </div>
  );
}
