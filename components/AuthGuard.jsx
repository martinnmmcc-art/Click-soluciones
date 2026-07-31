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
      // Si ya estamos en el login, dejamos pasar sin trabar
      if (pathname.startsWith("/login")) {
        setLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // Si no hay sesión, redirigimos de inmediato al login
        router.push("/login");
      }
      setLoading(false);
    }

    verificarSesion();
  }, [pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 font-medium text-sm">Cargando Clic Soluciones...</p>
      </div>
    );
  }

  return <>{children}</>;
}
