"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthGuard({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Si estamos en el login, no validamos nada
    if (pathname.startsWith("/login")) return;

    // Verificación instantánea de sesión local (Cliente o Admin)
    const sesionCliente = typeof window !== "undefined"
      ? (localStorage.getItem("clic_soluciones_user") || localStorage.getItem("cliente_sesion"))
      : null;
    const hasSupabaseToken = typeof window !== "undefined" && Object.keys(localStorage).some(key => key.includes("auth-token"));

    if (sesionCliente || hasSupabaseToken) {
      return; // Hay sesión local válida, pasamos libremente sin bloquear
    }

    // Verificación de respaldo en segundo plano
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!session) {
          router.replace("/login");
        }
      })
      .catch(() => {});
  }, [pathname, router]);

  // Renderizado inmediato: Cero pantallas de carga bloqueantes ("Verificando acceso...")
  return <>{children}</>;
}
