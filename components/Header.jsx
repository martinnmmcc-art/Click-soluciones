"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import DatosSiempreAlDia from "@/components/DatosSiempreAlDia";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/context/CartContext";
import { useAdmin } from "@/context/AdminContext";
import SelectorTema from "@/components/SelectorTema";
import { LogoInstagram, LogoFacebook, LogoWhatsApp, telefonoLegible, ENLACES } from "@/components/LogosRedes";

// Encabezado de la tienda. Queda fijo arriba con lo que el cliente tiene que
// ver SIEMPRE, esté donde esté:
//  - Dónde entregamos (la duda número uno de quien no nos conoce).
//  - El WhatsApp con el número a la vista: se distingue y se puede anotar.
//  - Instagram y Facebook: abajo de todo nadie los encontraba.
// El buscador se esconde al bajar y vuelve al subir, para dejar más lugar a
// los productos sin perderlo.
//
// En el celular el carrito está en el menú de abajo (BottomNav); en PC, acá.
const MENU_PC = [
  { href: "/", label: "Inicio" },
  { href: "/catalogo", label: "Catálogo" },
  { href: "/a-pedido", label: "A pedido" },
  { href: "/proximamente", label: "Llega pronto" },
  { href: "/favoritos", label: "Favoritos" },
  { href: "/login", label: "Mi cuenta" }
];

const MENSAJE_ENVIOS =
  "Envíos a El Bolsón y la Comarca Andina — coordinamos transporte local o punto de encuentro.";

export default function Header({ showSearch = true, initialQuery = "", busqueda, setBusqueda, buscarEnCatalogo = false }) {
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

  // Buscador: se oculta al bajar, vuelve al subir o al llegar arriba
  const [buscadorVisible, setBuscadorVisible] = useState(true);
  const ultimoY = useRef(0);
  const enFoco = useRef(false);
  useEffect(() => {
    if (!showSearch) return;
    function alDesplazar() {
      const y = window.scrollY;
      const dif = y - ultimoY.current;
      if (y < 120 || enFoco.current) setBuscadorVisible(true);
      else if (dif > 8) setBuscadorVisible(false);
      else if (dif < -8) setBuscadorVisible(true);
      ultimoY.current = y;
    }
    window.addEventListener("scroll", alDesplazar, { passive: true });
    return () => window.removeEventListener("scroll", alDesplazar);
  }, [showSearch]);

  function handleSearch(e) {
    e.preventDefault();
    // Ya filtra en vivo en la misma página... salvo en el inicio, que solo
    // tiene lo que está en stock: ahí apretar buscar lleva al catálogo completo
    if (esControlado && !buscarEnCatalogo) return;
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    router.push(`/catalogo?${params.toString()}`);
  }

  return (
    <header className="sticky top-0 z-30 shadow-sm">
      {mostrarEstadoDatos && <DatosSiempreAlDia />}

      {/* Dónde entregamos: fijo, siempre a la vista */}
      <div className="bg-[#13284F] text-white px-3 py-1.5">
        <p className="text-[11px] leading-snug text-center max-w-2xl mx-auto">
          <span aria-hidden="true">🚚 </span>
          <span className="text-[#F2C75C] font-bold">Envíos</span>
          {MENSAJE_ENVIOS.replace(/^Envíos/, "")}
        </p>
      </div>

      <div className="bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="flex items-center gap-2 px-3 py-2 max-w-6xl mx-auto">
          <Link href="/" className="flex items-center gap-1.5 min-w-0 flex-shrink-0" aria-label="Bolson Click, inicio">
            <div className="w-8 h-8 rounded-lg overflow-hidden relative flex-shrink-0">
              <Image src="/logo.png" alt="" fill sizes="32px" className="object-cover" />
            </div>
            <span className="flex flex-col leading-tight">
              <span className="text-[14px] min-[400px]:text-[15px] font-extrabold text-brand-blueDark whitespace-nowrap">
                Bolson <span className="text-brand-orange">Click</span>
              </span>
              <span className="hidden sm:block text-[10px] font-semibold text-gray-400 -mt-0.5">
                Productos para tu casa en El Bolsón
              </span>
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1 ml-2" aria-label="Menú principal">
            {MENU_PC.map((item) => {
              const activo = item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 rounded-xl text-sm font-semibold transition ${
                    activo ? "bg-blue-50 text-brand-blue" : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5 ml-auto">
            {/* El número a la vista: se distingue y se puede anotar */}
            <a
              href={ENLACES.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-[#25D366] text-white rounded-full pl-2 pr-2.5 py-1.5 shadow-sm active:scale-95 transition"
              aria-label={`Escribinos por WhatsApp al ${telefonoLegible()}`}
            >
              <LogoWhatsApp size={16} />
              <span className="text-[12.5px] min-[400px]:text-[13.5px] font-extrabold tabular-nums whitespace-nowrap">
                {telefonoLegible()}
              </span>
            </a>
            {ENLACES.instagram && (
              <a
                href={ENLACES.instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram de Bolson Click"
                className="active:scale-95 transition"
              >
                <LogoInstagram size={28} />
              </a>
            )}
            {ENLACES.facebook && (
              <a
                href={ENLACES.facebook}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook de Bolson Click"
                className="active:scale-95 transition"
              >
                <LogoFacebook size={28} />
              </a>
            )}

            <div className="hidden lg:flex items-center gap-2 ml-1">
              <SelectorTema />
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
        </div>

        {showSearch && (
          <div
            className={`px-3 max-w-6xl mx-auto overflow-hidden transition-all duration-200 ${
              buscadorVisible ? "max-h-40 pb-2.5 opacity-100" : "max-h-0 pb-0 opacity-0"
            }`}
          >
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => (enFoco.current = true)}
                onBlur={() => (enFoco.current = false)}
                type="search"
                enterKeyHint="search"
                placeholder="¿Qué estás buscando?"
                className="input-field flex-1 py-2.5 text-sm"
              />
              <button type="submit" className="btn-primary px-4 py-2.5" aria-label="Buscar">
                🔍
              </button>
              {/* En el celular, el modo oscuro y el panel van acá: arriba no entran */}
              <div className="flex lg:hidden items-center gap-1">
                <SelectorTema />
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="bg-brand-blue text-white text-[11px] font-bold px-2.5 py-2.5 rounded-xl"
                    aria-label="Panel"
                  >
                    🏠
                  </Link>
                )}
              </div>
            </form>

            {/* En el inicio (que solo muestra lo que hay en stock), mientras escribe
                se ofrece buscar en TODO, también a pedido. */}
            {buscarEnCatalogo && String(query || "").trim().length >= 2 && (
              <Link
                href={`/catalogo?q=${encodeURIComponent(String(query).trim())}`}
                className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-brand-blue text-white px-3.5 py-2.5 text-sm font-bold"
              >
                <span>
                  🔍 Buscar &quot;{String(query).trim()}&quot; en todos los productos
                  <span className="block text-[11px] font-semibold opacity-85">también los que traemos a pedido</span>
                </span>
                <span aria-hidden="true">›</span>
              </Link>
            )}
          </div>
        )}

      </div>
    </header>
  );
}
