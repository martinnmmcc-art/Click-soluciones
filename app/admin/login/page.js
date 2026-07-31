"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Header from "@/components/Header";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleLogin(e) {
    e.preventDefault();
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("Email o contraseña incorrectos.");
    } else {
      router.push("/admin/pedidos");
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <Header showSearch={false} />

      <div className="max-w-md mx-auto px-4 pt-16">
        <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
          <h1 className="text-2xl font-extrabold text-gray-800 mb-2 text-center">Acceso Administrador</h1>
          <p className="text-xs text-gray-500 text-center mb-6">Ingresá tus credenciales de Supabase</p>

          {error && (
            <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl mb-4 text-center font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
                placeholder="tucorreo@admin.com"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
                placeholder="••••••••"
              />
            </div>

            <button type="submit" className="w-btn-primary btn-primary py-3 mt-2">
              Ingresar al Panel
            </button>
          </form>
        </div>
      </div>
    </main>
  );
            }
            
