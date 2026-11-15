import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import ProductCard from "@/components/ProductCard";
import { EnvioLocal, EnvioTransporte } from "@/components/InfoEnvios";
import { DatosMigas } from "@/components/DatosEstructurados";
import { ZONAS, zonaPorSlug, productosPropios, categoriasPropias, rutaCategoria } from "@/lib/seo";

// Una página por localidad: lo que alguien de Bariloche (o de Lago Puelo)
// necesita saber para comprar acá, con los productos que hay ya.
export const revalidate = 600;

export function generateStaticParams() {
  return ZONAS.map((z) => ({ zona: z.slug }));
}

export async function generateMetadata({ params }) {
  const z = zonaPorSlug(params.zona);
  if (!z) return { robots: { index: false } };
  const local = z.tipo === "local";
  const titulo = local
    ? `Productos para el hogar en ${z.nombre} | Bolson Click`
    : `Productos para el hogar con envío a ${z.nombre} | Bolson Click`;
  const descripcion = local
    ? `Comprá online cocina, iluminación, belleza, herramientas y tecnología con entrega en mano en ${z.nombre}. Pagás en efectivo o transferencia.`
    : `Comprá online cocina, iluminación, belleza, herramientas y tecnología desde El Bolsón con envío a ${z.nombre}, ${z.provincia}, por Andreani u otro transporte. Te decimos el costo del envío antes de pagar.`;
  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: `/envios/${z.slug}` },
    openGraph: { title: titulo, description: descripcion, url: `/envios/${z.slug}`, siteName: "Bolson Click", locale: "es_AR", type: "website" }
  };
}

export default async function Zona({ params }) {
  const z = zonaPorSlug(params.zona);
  if (!z) notFound();
  const local = z.tipo === "local";
  const [productos, categorias] = await Promise.all([productosPropios({ limite: 60 }), categoriasPropias()]);
  const disponibles = productos.filter((p) => Number(p.stock) > 0).slice(0, 12);

  return (
    <main id="contenido" className="pb-28">
      <DatosMigas
        items={[
          { nombre: "Inicio", ruta: "/" },
          { nombre: "Envíos", ruta: "/envios" },
          { nombre: z.nombre, ruta: `/envios/${z.slug}` }
        ]}
      />
      <Header />
      <div className="px-4 mt-4 space-y-4">
        <nav aria-label="Ruta" className="text-xs text-gray-600">
          <Link href="/" className="underline underline-offset-2">
            Inicio
          </Link>{" "}
          ›{" "}
          <Link href="/envios" className="underline underline-offset-2">
            Envíos
          </Link>{" "}
          › {z.nombre}
        </nav>
        <h1 className="text-2xl font-extrabold text-gray-900">
          {local ? `Productos para el hogar en ${z.nombre}` : `Productos para el hogar con envío a ${z.nombre}`}
        </h1>
        <p className="text-[15px] text-gray-800 leading-relaxed">
          {local
            ? `Somos Bolson Click, de El Bolsón. Si estás en ${z.nombre}, elegís online y te lo entregamos en mano: cocina, iluminación, belleza, herramientas, tecnología y mucho más.`
            : `Somos Bolson Click, una tienda de El Bolsón. Si estás en ${z.nombre} (${z.provincia}), elegís online y te lo mandamos por transporte: cocina, iluminación, belleza, herramientas, tecnología y mucho más.`}
        </p>

        {local ? <EnvioLocal lugar={z.nombre} /> : <EnvioTransporte lugar={z.nombre} />}

        {disponibles.length > 0 && (
          <section aria-labelledby="disponibles">
            <h2 id="disponibles" className="text-lg font-bold text-gray-900">
              Disponibles ya
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-2">
              {disponibles.map((p) => (
                <ProductCard key={p.id} producto={p} />
              ))}
            </div>
            <Link href="/catalogo" className="btn-primary block text-center mt-4">
              Ver todo el catálogo
            </Link>
          </section>
        )}

        <section aria-labelledby="categorias">
          <h2 id="categorias" className="text-base font-bold text-gray-900">
            Categorías
          </h2>
          <ul className="flex flex-wrap gap-2 mt-2">
            {categorias.map((c) => (
              <li key={c.slug}>
                <Link
                  href={rutaCategoria(c.nombre)}
                  className="inline-block px-3 py-1.5 rounded-full border border-gray-300 bg-white text-sm text-gray-800"
                >
                  {c.nombre}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
