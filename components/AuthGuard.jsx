"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthGuard({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [autorizado, setAutorizado] = useState(false);

  useEffect(() => {
    // 1. Si estamos en login, pasamos de inmediato
    if (pathname.startsWith("/login")) {
      setAutorizado(true);
      return;
    }

    // 2. Verificación SÍNCRONA e instantánea en localStorage
    const sesionCliente = typeof window !== "undefined" ? localStorage.getItem("cliente_sesion") : null;
    const hasSupabaseToken = typeof window !== "undefined" && Object.keys(localStorage).some(key => key.includes("auth-token"));

    if (sesionCliente || hasSupabaseToken) {
      setAutorizado(true);
      return;
    }

    // 3. Fallback a Supabase solo si no hay nada en local
    let activo = true;
    async function verificarAdmin() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (activo) {
          if (session) {
            setAutorizado(true);
          } else {
            router.replace("/login");
          }
        }
      } catch (err) {
        if (activo) router.replace("/login");
      }
    }

    verificarAdmin();

    return () => {
      activo = false;
    };
  }, [pathname, router]);

  // Si no está autorizado, mostramos carga solo en el primer ingreso absoluto
  if (!autorizado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-500 font-medium text-xs">Cargando Clic Soluciones...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
