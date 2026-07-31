"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";

export default function CuentaPage() {
  const [userType, setUserType] = useState(null); // 'admin' o 'cliente'
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function resolverSesion() {
      try {
        // 1. Verificamos si hay sesión de celular en localStorage
        const sesionCliente = localStorage.getItem("cliente_sesion");
        if (sesionCliente) {
          setUserType("cliente");
          setUserData(JSON.parse(sesionCliente));
          setLoading(false);
          return;
        }

        // 2. Si no es cliente, verificamos si es administrador en Supabase
        const { data: { session }, error } = await supabase.auth.getSession();
        if (session && !error) {
          setUserType("admin");
          setUserData(session.user);
        } else {
          // Si no hay ninguna sesión válida, redirigimos al login
          router.replace("/login");
        }
      } catch (err) {
        console.error("Error al resolver sesión:", err);
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    }

    resolverSesion();
  }, [router]);

  async function handleLogout() {
    try {
      // Limpiamos todo rastro local y de Supabase
      localStorage.removeItem("cliente_sesion");
      localStorage.removeItem("carrito");
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
    }
    router.replace("/login");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 pb-20">
        <Header showSearch={false} />
        <div className="flex items-center justify-center py-32">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-4 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm text-gray-500 font-medium">Cargando cuenta...</p>
          </div>
        </div>
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
              {userType === "admin" ? "🛡️" : "📱"}
            </div>
            <div>
              <h2 className="font-bold text-gray-800 text-sm">
                {userType === "admin" ? "Panel de Administrador" : "Mi Cuenta"}
              </h2>
              <p className="text-xs text-gray-500">
                {userType === "admin" ? "Sesión oficial de Supabase" : "Acceso por número de celular"}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-gray-500 font-medium">Identificador de sesión:</p>
            <p className="text-sm font-bold text-gray-800 bg-gray-50 p-3 rounded-xl border border-gray-100 break-all">
              {userType === "admin" ? userData?.email : (userData?.telefono || userData?.phone || "Usuario Conectado")}
            </p>
          </div>

          <button
            onClick={handleLogout}
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
