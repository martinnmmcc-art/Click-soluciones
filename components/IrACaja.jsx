"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { correoGuardado } from "@/lib/sesionGuardada";
import { ADMIN_EMAILS } from "@/context/AdminContext";

// Lleva al admin directo a la caja al abrir la app.
//
// Es lo que más se usa en el mostrador: si hay que navegar hasta ahí cada
// vez que entra un cliente, se pierde tiempo justo cuando no sobra.
//
// Solo redirige desde la pantalla de inicio, para no interferir cuando el
// admin está mirando otra cosa a propósito.
const CLAVE = "bolsonclick_salio_de_caja";

export default function IrACaja() {
  const router = useRouter();
  const ruta = usePathname();

  useEffect(() => {
    if (ruta !== "/") return;

    async function revisar() {
      try {
        // Si salió de la caja hace poco, respetamos esa decisión
        const salio = sessionStorage.getItem(CLAVE);
        if (salio) return;

        // La sesión guardada en el celular (sin internet): con poca señal,
        // preguntarle a Supabase tarda o dice "no hay sesión".
        if (!ADMIN_EMAILS.includes(correoGuardado())) return;

        sessionStorage.setItem(CLAVE, "1");
        router.replace("/admin/caja");
      } catch (e) {}
    }

    revisar();
  }, [ruta, router]);

  return null;
}
