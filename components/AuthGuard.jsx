"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthGuard({ children }) {
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let montado = true;

    async function verificarSesion() {
      // 1. Si estamos en login, pasa directo sin trabar
      if (pathname.startsWith("/login")) {
        if (montado) setLoading(false);
        return;
      }

      // 2. Revisión de sesión local (Celular) y Supabase de forma simultánea
      const sesionCliente = typeof window !== "undefined" ? localStorage.getItem("cliente_sesion") : null;
      
      if (sesionCliente) {
        if (montado) setLoading(false);
        return; 
      }

      const { data: { session } } = await supabase.auth.getSession();

      if (!session && !sesionCliente) {
        router.replace("/login");
      } else {
        if (montado) setLoading(false);
      }
    }

    verificarSesion();
    
    return () => {
      montado = false;
    };
  }, [pathname, router]);

  // CORRECCIÓN SENIOR: Si ya pasó la validación inicial, 
  // NUNCA volvemos a mostrar pantalla de carga al cambiar de solapa interna (Inicio, Catálogo, Carrito, Cuenta).
  // Esto elimina el parpadeo y el bloqueo al navegar.

  return <>{children}</>;
}
