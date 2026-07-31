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
    const sesionCliente = typeof window !== "undefined" ? localStorage.getItem("cliente_sesion") : null;
    const hasSupabaseToken = typeof window !== "undefined" && Object.keys(localStorage).some(key => key.includes("auth-token"));

    if (sesionCliente || hasSupabaseToken) {
      return; // Hay sesión local válida, pasamos libremente
    }

    // Validación de respaldo en segundo plano (sin bloquear la interfaz)
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!session) {
          router.replace("/login");
        }
      })
      .catch(() => {
        // Ante cualquier error de red, evitamos bloquear la app
      });
  }, [pathname, router]);

  // Renderizado inmediato para eliminar cualquier pantalla de carga bloqueante ("Verificando acceso...")
  return <>{children}</>;
}
