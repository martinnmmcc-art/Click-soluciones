"use client";

import { useEffect } from "react";
import { cargarProductosGuardados } from "@/lib/productosSync";

// Apenas abre la app, se lee el catálogo de la base del celular a memoria:
// así cualquier pantalla lo tiene al instante, con o sin señal.
export default function CargarBaseLocal() {
  useEffect(() => {
    cargarProductosGuardados().catch(() => {});
  }, []);
  return null;
}
