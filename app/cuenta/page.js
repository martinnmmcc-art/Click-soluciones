"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";

export default function CuentaPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      setLoading(false);
    }
    checkUser();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 pb-20">
        <Header showSearch={false} />
        <div className="text-center py-20 text-gray-500">Cargando...</div>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <Header showSearch={false} />

      <div className="max-w-md mx-auto px-4 mt-6">
        <h1 className="text-2xl font-extrabold text-gray-800 mb-6">Mi Cuenta</h1>

        {user ? (
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <div>
              <span className="text-xs text-gray-400 block">Usuario conectado</span>
              <p className="text-sm font-semibold text-gray-800">{user.email}</p>
            </div>

            {/* BOTÓN SECRETO / ADMIN: Solo aparece porque estás logueado */}
            <div className="pt-2 border-t border-gray-100 space-y-2">
              <a
                href="/admin/pedidos"
                className="w-full bg-blue-50 text-brand-blue hover:bg-blue-100 font-bold py-3 px-4 rounded-xl text-center block text-sm transition"
              >
                📊 Panel de Administración (Pedidos)
              </a>
            </div>

            <button
              onClick={handleLogout}
              className="w-full bg-red-50 text-red-600 hover:bg-red-100 font-bold py-3 px-4 rounded-xl text-center block text-sm transition mt-4"
            >
              Cerrar Sesión
            </button>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm text-center space-y-4">
            <p className="text-sm text-gray-600">No hay ninguna sesión iniciada en este dispositivo.</p>
            <a
              href="/admin/login"
              className="btn-primary inline-block w-full py-3 text-center"
            >
              Iniciar Sesión (Admin)
            </a>
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
