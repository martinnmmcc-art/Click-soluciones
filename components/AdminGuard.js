"use client";

import Link from "next/link";
import { useAdmin } from "@/context/AdminContext";

export default function AdminGuard({ children }) {
  const { isAdmin, loading } = useAdmin();

  if (loading) {
    return <div className="p-6 text-center text-gray-400">Cargando...</div>;
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-brand-bg px-4">
        <div className="card p-6 w-full max-w-sm flex flex-col gap-3 text-center">
          <h1 className="font-bold text-xl text-gray-800 mb-1">
            Acceso restringido
          </h1>
          <p className="text-sm text-gray-500 mb-2">
            Esta sección es solo para administradores. Iniciá sesión con tu correo.
          </p>
          <Link href="/login" className="btn-primary">
            Ir a iniciar sesión
          </Link>
        </div>
      </main>
    );
  }

  return children;
}
