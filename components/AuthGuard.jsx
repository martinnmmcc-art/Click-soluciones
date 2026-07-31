"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthGuard({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Si estamos en login, no validamos nada
    if (pathname.startsWith("/login")) return;

    // Verificación rápida de sesiones locales (cliente o admin)
    const hasLocalSession = typeof window !== "undefined" && (
      localStorage.getItem("cliente_sesion") !== null ||
      Object.keys(localStorage).some(key => key.includes("auth-token"))
    );

    if (!hasLocalSession) {
      // Verificación en segundo plano sin bloquear la UI
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
          router.replace("/login");
        }
      }).catch(() => {
        router.replace("/login");
      });
    }
  }, [pathname, router]);

  // Renderiza instantáneamente para evitar cualquier congelamiento visual
  return <>{children}</>;
}
