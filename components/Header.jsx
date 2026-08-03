"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

export default function Header({ showSearch = true, initialQuery = "" }) {
  const [query, setQuery] = useState(initialQuery);
  const { cantidadTotal } = useCart();
  const { user } = useAuth();
  const [adminEmail, setAdminEmail] = useState(null);
  const router = useRouter();

  useEffect(() => {
    async function checkAdmin() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setAdminEmail(session.user.email);
      }
    }
    checkAdmin();
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    router.push(`/catalogo?${params.toString()}`);
  }

  // Verificamos si sos vos el admin
  const isAdmin = adminEmail === "maricelcanumir@gmail.com" || user?.email === "maricelcanumir@gmail.com";

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-100 px-4 pt-4 pb-3">
      <div className="flex items-center justify-between mb-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl overflow-hidden relative">
            <Image src="/logo.png" alt="Bolson Click" fill className="object-cover" />
          </div>
          <span className="text-lg font-extrabold text-brand-blueDark">
            Bolson <span className="text-brand-orange">Click</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          {/* BOTONES DE ADMIN FIJOS: Si sos vos, aparecen arriba en todas partes */}
          {isAdmin && (
            <>
              <Link
                href="/admin/pedidos"
                className="bg-brand-blue text-white text-xs font-bold px-3 py-2 rounded-xl shadow-sm hover:bg-blue-700 transition"
              >
                📊 Ventas
              </Link>
              <Link
                href="/admin/productos"
                className="bg-orange-500 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-sm hover:bg-orange-600 transition"
              >
                📦 Productos
              </Link>
            </>
          )}

          <Link href="/carrito" className="relative p-1" aria-label="Carrito">
            <span className="text-2xl">🛒</span>
            {cantidadTotal > 0 && (
              <span className="absolute -top-1 -right-2 bg-brand-orange text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {cantidadTotal}
              </span>
            )}
          </Link>
        </div>
      </div>

      {showSearch && (
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="text"
            placeholder="Buscar lámparas, ollas, organizadores..."
            className="input-field flex-1"
          />
          <button type="submit" className="btn-primary px-4">
            🔍
          </button>
        </form>
      )}
    </header>
  );
}
