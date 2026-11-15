import Link from "next/link";
import Header from "@/components/Header";

// Marco común de las páginas legales: título, fecha de actualización,
// texto legible (tamaño cómodo, buen contraste) y links a las demás.

export const ACTUALIZADO = "15 de noviembre de 2026";

const PAGINAS = [
  { href: "/terminos", label: "Términos y condiciones" },
  { href: "/privacidad", label: "Política de privacidad" },
  { href: "/reembolsos", label: "Cambios, devoluciones y reembolsos" },
  { href: "/cookies", label: "Política de cookies" },
  { href: "/arrepentimiento", label: "Botón de arrepentimiento" }
];

export default function PaginaLegal({ titulo, actual, children }) {
  return (
    <main id="contenido" className="min-h-screen pb-28">
      <Header showSearch={false} />
      <article className="max-w-2xl mx-auto px-4 mt-5 legal">
        <h1 className="text-2xl font-extrabold text-gray-900">{titulo}</h1>
        <p className="text-xs text-gray-600 mt-1">Última actualización: {ACTUALIZADO}</p>
        <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-gray-800">{children}</div>

        <nav aria-label="Otras páginas legales" className="mt-8 border-t border-gray-200 pt-4">
          <p className="text-xs font-bold text-gray-700 mb-2">También te puede servir</p>
          <ul className="space-y-1.5">
            {PAGINAS.filter((p) => p.href !== actual).map((p) => (
              <li key={p.href}>
                <Link href={p.href} className="text-sm text-brand-blue underline underline-offset-2">
                  {p.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </article>
    </main>
  );
}

export function Seccion({ titulo, children }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-bold text-gray-900 pt-2">{titulo}</h2>
      {children}
    </section>
  );
}
