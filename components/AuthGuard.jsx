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

    // Verificación síncrona e instantánea en localStorage
    const sesionCliente = typeof window !== "undefined" ? localStorage.getItem("cliente_sesion") : null;
    const hasSupabaseToken = typeof window !== "undefined" && Object.keys(localStorage).some(key => key.includes("auth-token"));

    if (sesionCliente || hasSupabaseToken) {
      return; // Hay sesión local válida, pasamos de largo sin bloquear
    }

    // Verificación de respaldo en segundo plano (no bloquea la UI)
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!session) {
          router.replace("/login");
        }
      })
      .catch(() => {
        // Ante cualquier error de red, evitamos congelar la app
      });
  }, [pathname, router]);

  // RENDERIZADO INMEDIATO: Cero pantallas de carga, cero bloqueos al cambiar de solapa.
  return <>{children}</>;
}
