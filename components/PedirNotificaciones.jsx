"use client";

import { useEffect, useState } from "react";
import { pushSoportado, suscribirPush, estaSuscripto } from "@/lib/push";

// Pide activar las notificaciones, pero con una pregunta previa dentro de la app.
//
// Por qué no disparamos el permiso del navegador de una: si el cliente toca
// "Bloquear", el navegador NO deja volver a pedirlo nunca más. Ese cliente se
// pierde para siempre. Preguntando antes, el que no está interesado dice
// "ahora no" y lo podemos volver a intentar en unos días.
//
// Los momentos elegidos no son casuales: se pide justo después de comprar
// (cuando el cliente quiere saber de su pedido) y no al entrar a la app,
// donde todavía no sabe si le importa.

const CLAVE_RECHAZOS = "bolsonclick_push_rechazos";
const CLAVE_ULTIMO = "bolsonclick_push_ultimo_intento";
const DIAS_ESPERA = 7;
const MAX_INTENTOS = 3;

function puedePreguntar() {
  try {
    const rechazos = Number(localStorage.getItem(CLAVE_RECHAZOS) || 0);
    if (rechazos >= MAX_INTENTOS) return false;

    const ultimo = localStorage.getItem(CLAVE_ULTIMO);
    if (!ultimo) return true;

    const dias = (Date.now() - new Date(ultimo).getTime()) / (1000 * 60 * 60 * 24);
    return dias >= DIAS_ESPERA;
  } catch (e) {
    return true;
  }
}

function registrarRechazo() {
  try {
    const rechazos = Number(localStorage.getItem(CLAVE_RECHAZOS) || 0);
    localStorage.setItem(CLAVE_RECHAZOS, String(rechazos + 1));
    localStorage.setItem(CLAVE_ULTIMO, new Date().toISOString());
  } catch (e) {}
}

export default function PedirNotificaciones({ telefono, motivo = "general" }) {
  const [mostrar, setMostrar] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    async function chequear() {
      if (!pushSoportado()) return;

      // Si ya las tiene activas, o ya las bloqueó en el navegador, no insistimos
      if (typeof Notification !== "undefined" && Notification.permission !== "default") return;
      if (await estaSuscripto()) return;
      if (!puedePreguntar()) return;

      setMostrar(true);
    }
    chequear();
  }, []);

  async function activar() {
    setProcesando(true);
    try {
      const res = await suscribirPush(telefono);
      if (res?.ok) {
        setListo(true);
        setTimeout(() => setMostrar(false), 2500);
      } else {
        // Si lo bloqueó en el navegador, no hay vuelta atrás: dejamos de pedir
        registrarRechazo();
        setMostrar(false);
      }
    } finally {
      setProcesando(false);
    }
  }

  function ahoraNo() {
    registrarRechazo();
    setMostrar(false);
  }

  if (!mostrar) return null;

  // El texto cambia según el momento: cuanto más concreto el beneficio,
  // más gente acepta.
  const textos = {
    compra: {
      emoji: "📦",
      titulo: "¿Te aviso cuando salga tu pedido?",
      detalle:
        "Te llega un aviso al celular cuando lo preparamos y cuando está listo para entregarte. Sin tener que preguntar."
    },
    novedades: {
      emoji: "✨",
      titulo: "¿Querés enterarte primero?",
      detalle:
        "Te avisamos cuando llega mercadería nueva. Las cosas buenas se agotan rápido y así no te las perdés."
    },
    stock: {
      emoji: "🔔",
      titulo: "¿Te aviso cuando vuelva a haber?",
      detalle: "Te mandamos un aviso apenas repongamos este producto."
    },
    general: {
      emoji: "🔔",
      titulo: "¿Te avisamos de las novedades?",
      detalle:
        "Mercadería nueva, ofertas y el estado de tus pedidos, directo al celular."
    }
  };

  const t = textos[motivo] || textos.general;

  if (listo) {
    return (
      <div className="bg-green-50 border border-green-300 rounded-2xl p-4 text-center">
        <p className="text-sm font-bold text-green-800">✓ ¡Listo! Te vamos a avisar</p>
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-brand-blue/30 rounded-2xl p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="text-3xl">{t.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-gray-800">{t.titulo}</p>
          <p className="text-xs text-gray-600 mt-1">{t.detalle}</p>

          <div className="flex gap-2 mt-3">
            <button
              onClick={activar}
              disabled={procesando}
              className="flex-1 bg-brand-blue text-white text-xs font-bold py-2.5 rounded-xl disabled:opacity-50"
            >
              {procesando ? "Activando..." : "Sí, avisame"}
            </button>
            <button
              onClick={ahoraNo}
              className="px-3 text-xs font-semibold text-gray-500"
            >
              Ahora no
            </button>
          </div>

          <p className="text-[10px] text-gray-400 mt-2">
            Podés desactivarlas cuando quieras desde tu cuenta.
          </p>
        </div>
      </div>
    </div>
  );
}
