"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import DatosSiempreAlDia from "@/components/DatosSiempreAlDia";
import { useState } from "react";
import { useCart } from "@/context/CartContext";
import { useAdmin } from "@/context/AdminContext";

export default function Header({ showSearch = true, initialQuery = "", busqueda, setBusqueda }) {
  const esControlado = typeof setBusqueda === "function";
  const [queryInterno, setQueryInterno] = useState(initialQuery);
  const query = esControlado ? busqueda : queryInterno;
  const setQuery = esControlado ? setBusqueda : setQueryInterno;

  const { cantidadTotal } = useCart();
  const { isAdmin } = useAdmin();
  const router = useRouter();
  const pathname = usePathname() || "";
  // Como admin, el aviso "🟢 Al día" también se ve en la tienda (Inicio,
  // Catálogo, productos...). En el panel ya lo pone app/admin/layout.js.
  const mostrarEstadoDatos = isAdmin && !pathname.startsWith("/admin");

  function handleSearch(e) {
    e.preventDefault();
    if (esControlado) return; // ya filtra en vivo en la misma página, no hace falta navegar
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    router.push(`/catalogo?${params.toString()}`);
  }

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-100 px-4 pt-4 pb-3">
      {mostrarEstadoDatos && (
        <div className="-mx-4 -mt-4 mb-3">
          <DatosSiempreAlDia />
        </div>
      )}
      <div className="flex items-center justify-between mb-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl overflow-hidden relative">
            <Image src="/logo.png" alt="Bolson Click" fill className="object-cover" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-lg font-extrabold text-brand-blueDark">
              Bolson <span className="text-brand-orange">Click</span>
            </span>
            <span className="text-[10px] font-semibold text-gray-400 -mt-0.5">
              Productos importados en El Bolsón
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link
              href="/admin"
              className="bg-brand-blue text-white text-xs font-bold px-3 py-2 rounded-xl shadow-sm hover:bg-blue-700 transition"
            >
              🏠 Panel
            </Link>
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
