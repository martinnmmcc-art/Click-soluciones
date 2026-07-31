"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthGuard({ children }) {
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function verificarSesion() {
      // 1. Si ya estamos en el login, dejamos pasar sin trabar
      if (pathname.startsWith("/login")) {
        setLoading(false);
        return;
      }

      // 2. Buscamos sesión oficial en Supabase (Administrador)
      const { data: { session } } = await supabase.auth.getSession();

      // 3. Buscamos sesión de celular en el dispositivo (Cliente)
      const sesionCliente = typeof window !== "undefined" ? localStorage.getItem("cliente_sesion") : null;

      // 4. Si NO hay ninguna de las dos, lo mandamos al login
      if (!session && !sesionCliente) {
        // Usamos replace para no generar historial de navegación infinito
        router.replace("/login"); 
      } else {
        // Si tiene CUALQUIERA de las dos, le damos luz verde
        setLoading(false);
      }
    }

    verificarSesion();
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
