"use client";

import { useState } from "react";
import { useAdmin } from "@/context/AdminContext";

export default function AdminGuard({ children }) {
  const { isAdmin, loading, login } = useAdmin();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (loading) {
    return <div className="p-6 text-center text-gray-400">Cargando...</div>;
  }

  if (!isAdmin) {
    function handleSubmit(e) {
      e.preventDefault();
      const ok = login(password);
      if (!ok) setError("Clave incorrecta.");
    }

    return (
      <main className="min-h-screen flex items-center justify-center bg-brand-bg px-4">
        <form
          onSubmit={handleSubmit}
          className="card p-6 w-full max-w-sm flex flex-col gap-3"
        >
          <h1 className="font-bold text-xl text-gray-800 text-center mb-1">
            Panel de administración
          </h1>
          <p className="text-sm text-gray-500 text-center mb-2">
            Clic Soluciones
          </p>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-2 text-center">
              {error}
            </div>
          )}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Clave de administrador"
            className="input-field"
          />
          <button className="btn-primary">Ingresar</button>
        </form>
      </main>
    );
  }

  return children;
}
