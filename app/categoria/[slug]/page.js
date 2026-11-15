import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import ProductCard from "@/components/ProductCard";
import { DatosMigas } from "@/components/DatosEstructurados";
import { categoriasPropias, productosPropios, rutaCategoria, ZONAS } from "@/lib/seo";

// Página de cada categoría, armada en el SERVIDOR: Google recibe el título,
// el texto y la lista de productos con sus links ya escritos en la página
// (el catálogo común se arma en el celular y Google ve poco).
export const revalidate = 600;

async function buscar(slug) {
  const categorias = await categoriasPropias();
  return categorias.find((c) => c.slug === slug) || null;
}

export async function generateMetadata({ params }) {
  const cat = await buscar(params.slug);
  if (!cat) return { title: "Categoría | Bolson Click", robots: { index: false } };
  const titulo = `${cat.nombre} en El Bolsón | Bolson Click`;
  const descripcion = `${cat.nombre}: ${cat.cantidad} productos con precio y stock real. Entrega en El Bolsón y la Comarca Andina, envíos a Bariloche, Villa La Angostura, San Martín de los Andes y todo el país.`;
  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: rutaCategoria(cat.nombre) },
    openGraph: { title: titulo, description: descripcion, url: rutaCategoria(cat.nombre), siteName: "Bolson Click", locale: "es_AR", type: "website" }
  };
}

export default async function Categoria({ params }) {
  const cat = await buscar(params.slug);
  if (!cat) notFound();
  const [productos, todas] = await Promise.all([productosPropios({ categoria: cat.original, limite: 200 }), categoriasPropias()]);
  const conStock = productos.filter((p) => Number(p.stock) > 0).length;

  return (
    <main id="contenido" className="pb-28">
      <DatosMigas
        items={[
          { nombre: "Inicio", ruta: "/" },
          { nombre: cat.nombre, ruta: rutaCategoria(cat.nombre) }
        ]}
      />
      <Header />
      <div className="px-4 mt-4">
        <nav aria-label="Ruta" className="text-xs text-gray-600">
          <Link href="/" className="underline underline-offset-2">
            Inicio
          </Link>{" "}
          › {cat.nombre}
        </nav>
        <h1 className="text-2xl font-extrabold text-gray-900 mt-2">{cat.nombre} en El Bolsón</h1>
        <p className="text-sm text-gray-700 mt-1 leading-relaxed">
          {conStock > 0 ? `${conStock} productos disponibles ya` : "Productos"} en {cat.nombre.toLowerCase()}, con
          precio final. Entrega en mano en El Bolsón, Lago Puelo, El Hoyo y Epuyén, y envíos por transporte a
          Bariloche, Villa La Angostura, San Martín de los Andes y todo el país.{" "}
          <Link href="/envios" className="text-brand-blue underline underline-offset-2">
            Cómo son los envíos
          </Link>
          .
        </p>

        {productos.length === 0 ? (
          <p className="mt-6 text-sm text-gray-700">
            Por ahora no hay productos en esta categoría.{" "}
            <Link href="/catalogo" className="text-brand-blue underline">
              Ver todo el catálogo
            </Link>
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-4">
            {productos.map((p) => (
              <ProductCard key={p.id} producto={p} />
            ))}
          </div>
        )}

        <section className="mt-8" aria-labelledby="otras-categorias">
          <h2 id="otras-categorias" className="text-base font-bold text-gray-900">
            Otras categorías
          </h2>
          <ul className="flex flex-wrap gap-2 mt-2">
            {todas
              .filter((c) => c.slug !== cat.slug)
              .map((c) => (
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

        <section className="mt-6" aria-labelledby="zonas">
          <h2 id="zonas" className="text-base font-bold text-gray-900">
            Enviamos a
          </h2>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-sm">
            {ZONAS.map((z) => (
              <li key={z.slug}>
                <Link href={`/envios/${z.slug}`} className="text-brand-blue underline underline-offset-2">
                  {z.nombre}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
