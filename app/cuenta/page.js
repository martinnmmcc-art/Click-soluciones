"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { supabase } from "@/lib/supabaseClient";

export default function CuentaPage() {
  const router = useRouter();
  const [datosCliente, setDatosCliente] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      // 1. Buscamos la sesión del celular en el almacenamiento local
      const sesionGuardada = localStorage.getItem("cliente_sesion");
      if (sesionGuardada) {
        setDatosCliente(JSON.parse(sesionGuardada));
      }
    } catch (e) {
      console.error("Error al leer la sesión:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  function cerrarSesion() {
    try {
      // Borramos las credenciales locales y de Supabase
      localStorage.removeItem("cliente_sesion");
      localStorage.removeItem("carrito");
      supabase.auth.signOut();
    } catch (e) {
      console.error("Error al limpiar sesión:", e);
    }
    router.replace("/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500 font-medium">Cargando perfil...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-28">
      <Header showSearch={false} />

      <div className="max-w-md mx-auto px-4 mt-6">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
            <div className="w-12 h-12 bg-brand-blue/10 rounded-full flex items-center justify-center text-brand-blue text-xl font-bold">
              📱
            </div>
            <div>
              <h2 className="font-bold text-gray-800 text-sm">Mi Cuenta</h2>
              <p className="text-xs text-gray-500">Acceso por número de celular</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-gray-500 font-medium">Teléfono registrado:</p>
            <p className="text-sm font-bold text-gray-800 bg-gray-50 p-3 rounded-xl border border-gray-100">
              {datosCliente?.telefono || datosCliente?.phone || "Sesión Activa"}
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
