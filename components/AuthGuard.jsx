"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthGuard({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [autorizado, setAutorizado] = useState(false);

  useEffect(() => {
    let activo = true;

    async function verificarAcceso() {
      // 1. Si estamos en login, pasa directo
      if (pathname.startsWith("/login")) {
        if (activo) setAutorizado(true);
        return;
      }

      // 2. Verificación síncrona e inmediata de sesión local (Cliente o Admin en localStorage)
      const hasLocalSession = typeof window !== "undefined" && (
        localStorage.getItem("cliente_sesion") !== null ||
        Object.keys(localStorage).some(key => key.includes("auth-token"))
      );

      if (hasLocalSession) {
        if (activo) setAutorizado(true);
        return;
      }

      // 3. Verificación con TIMEOUT de Supabase (Evita que se cuelgue si la red o Supabase demoran)
      try {
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Timeout de sesión")), 2500)
        );

        const result = await Promise.race([sessionPromise, timeoutPromise]);
        const session = result?.data?.session;

        if (activo) {
          if (session) {
            setAutorizado(true);
          } else {
            router.replace("/login");
          }
        }
      } catch (err) {
        // Si hay timeout o error de red, pero sabemos que está intentando entrar, 
        // evitamos el bloqueo eterno mandándolo al login de forma segura
        if (activo) {
          router.replace("/login");
        }
      }
    }

    verificarAcceso();

    return () => {
      activo = false;
    };
  }, [pathname, router]);

  if (!autorizado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-500 font-medium text-xs">Abriendo Clic Soluciones...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
