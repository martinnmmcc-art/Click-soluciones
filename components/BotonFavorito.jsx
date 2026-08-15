"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  obtenerTelefonoCliente,
  agregarFavorito,
  quitarFavorito,
  esFavorito
} from "@/lib/favoritos";

export default function BotonFavorito({ productoId, className = "" }) {
  const router = useRouter();
  const [activo, setActivo] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    async function chequear() {
      const tel = obtenerTelefonoCliente();
      if (!tel) {
        setListo(true);
        return;
      }
      const res = await esFavorito(tel, productoId);
      setActivo(res);
      setListo(true);
    }
    chequear();
  }, [productoId]);

  async function toggle(e) {
    e.preventDefault();
    e.stopPropagation();

    const tel = obtenerTelefonoCliente();
    if (!tel) {
      router.push("/login");
      return;
    }

    setCargando(true);
    try {
      if (activo) {
        await quitarFavorito(tel, productoId);
        setActivo(false);
      } else {
        await agregarFavorito(tel, productoId);
        setActivo(true);
      }
    } finally {
      setCargando(false);
    }
  }

  if (!listo) return null;

  return (
    <button
      onClick={toggle}
      disabled={cargando}
      aria-label="Favorito"
      className={`flex items-center justify-center rounded-full bg-white/90 shadow-sm disabled:opacity-50 ${className}`}
    >
      <span className={activo ? "text-red-500" : "text-gray-400"}>
        {activo ? "❤️" : "🤍"}
      </span>
    </button>
  );
}
