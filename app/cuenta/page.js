"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { supabase } from "@/lib/supabaseClient";

export default function CuentaPage() {
  const [tipoUsuario, setTipoUsuario] = useState(null); // 'admin' o 'cliente'
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    try {
      // 1. Verificamos si entró como cliente por celular en localStorage
      const clienteSesion = localStorage.getItem("cliente_sesion");
      if (clienteSesion) {
        setTipoUsuario("cliente");
        setDatos(JSON.parse(clienteSesion));
        setLoading(false);
        return;
      }

      // 2. Si no es cliente local, verificamos si es admin en Supabase
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setTipoUsuario("admin");
          setDatos(session.user);
        } else {
          router.replace("/login");
        }
      }).catch(() => {
        router.replace("/login");
      }).finally(() => {
        setLoading(false);
      });
    } catch (e) {
      console.error("Error al leer sesión:", e);
      setLoading(false);
    }
  }, [router]);

  function cerrarSesion() {
    try {
      localStorage.removeItem("cliente_sesion");
      localStorage.removeItem("carrito");
      supabase.auth.signOut();
    } catch (e) {
      console.error("Error al cerrar sesión:", e);
    }
    router.replace("/login");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 pb-28">
        <Header showSearch={false} />
        <div className="text-center py-20 text-gray-500 font-medium text-xs">Cargando perfil...</div>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-28">
      <Header showSearch={false} />

      <div className="max-w-md mx-auto px-4 mt-6">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
            <div className="w-12 h-12 bg-brand-blue/10 rounded-full flex items-center justify-center text-brand-blue text-xl font-bold">
              {tipoUsuario === "admin" ? "🛡️" : "📱"}
            </div>
            <div>
              <h2 className="font-bold text-gray-800 text-sm">
                {tipoUsuario === "admin" ? "Panel de Administrador" : "Mi Cuenta"}
              </h2>
              <p className="text-xs text-gray-500">
                {tipoUsuario === "admin" ? "Sesión oficial de Supabase" : "Acceso por número de celular"}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-gray-500 font-medium">Identificador de sesión:</p>
            <p className="text-sm font-bold text-gray-800 bg-gray-50 p-3 rounded-xl border border-gray-100 break-all">
              {tipoUsuario === "admin" ? datos?.email : (datos?.telefono || datos?.phone || "Usuario Conectado")}
            </p>
          </div>

          <button
            onClick={cerrarSesion}
            className="w-full bg-red-50 text-red-600 border border-red-100 text-xs font-bold py-3 rounded-xl hover:bg-red-100 active:scale-95 transition mt-4"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
