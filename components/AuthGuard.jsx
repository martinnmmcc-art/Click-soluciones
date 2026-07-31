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
      // 1. Si estamos en login, pasa directo
      if (pathname.startsWith("/login")) {
        if (montado) setLoading(false);
        return;
      }

      // 2. Revisión SÍNCRONA e inmediata de sesión de celular
      const sesionCliente = typeof window !== "undefined" ? localStorage.getItem("cliente_sesion") : null;
      
      if (sesionCliente) {
        if (montado) setLoading(false);
        return; // Salimos rápido, no contactamos a Supabase
      }

      // 3. Revisión ASÍNCRONA de Supabase (Admin)
      const { data: { session } } = await supabase.auth.getSession();

      if (!session && !sesionCliente) {
        router.replace("/login");
      } else {
        if (montado) setLoading(false);
      }
    }

    verificarSesion();
    
    return () => {
      montado = false; // Evita fugas de memoria si el componente se desmonta
    };
  }, [pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-500 font-medium text-sm">Abriendo catálogo...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
