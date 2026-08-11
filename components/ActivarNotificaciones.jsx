"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function ActivarNotificaciones({ telefono }) {
  const [estado, setEstado] = useState("cargando"); // cargando | disponible | activo | no-soportado | error
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    async function chequear() {
      if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        setEstado("no-soportado");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setEstado(sub ? "activo" : "disponible");
      } catch (e) {
        setEstado("error");
      }
    }
    chequear();
  }, []);

  async function activar() {
    setProcesando(true);
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setProcesando(false);
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
      });

      await fetch("/api/push/suscribir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub, telefono: telefono || null })
      });

      setEstado("activo");
    } catch (e) {
      setEstado("error");
    } finally {
      setProcesando(false);
    }
  }

  if (estado === "no-soportado" || estado === "cargando") return null;

  if (estado === "activo") {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-xs text-green-700 font-semibold text-center">
        🔔 Notificaciones activadas — te avisamos de ofertas y novedades
      </div>
    );
  }

  return (
    <button
      onClick={activar}
      disabled={procesando}
      className="w-full bg-brand-blue text-white text-sm font-bold py-2.5 rounded-xl shadow-sm disabled:opacity-50"
    >
      {procesando ? "Activando..." : "🔔 Activar notificaciones de ofertas"}
    </button>
  );
}
