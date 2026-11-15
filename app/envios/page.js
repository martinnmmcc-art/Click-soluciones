import Link from "next/link";
import Header from "@/components/Header";
import { EnvioLocal, EnvioTransporte } from "@/components/InfoEnvios";
import { ZONAS } from "@/lib/seo";

export const metadata = {
  title: "Envíos a la Comarca Andina, Bariloche y todo el país | Bolson Click",
  description:
    "Entrega en mano en El Bolsón, Lago Puelo, El Hoyo y Epuyén. Envíos por Andreani u otro transporte a Bariloche, Villa La Angostura, San Martín de los Andes, Esquel y todo el país.",
  alternates: { canonical: "/envios" }
};

export default function Envios() {
  const locales = ZONAS.filter((z) => z.tipo === "local");
  const lejos = ZONAS.filter((z) => z.tipo === "transporte");
  return (
    <main id="contenido" className="pb-28">
      <Header showSearch={false} />
      <article className="max-w-2xl mx-auto px-4 mt-5 space-y-5">
        <h1 className="text-2xl font-extrabold text-gray-900">Envíos</h1>
        <p className="text-[15px] text-gray-800 leading-relaxed">
          Somos una tienda de El Bolsón. En la Comarca Andina te lo llevamos nosotros; al resto del país lo mandamos
          por transporte.
        </p>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-gray-900">Comarca Andina</h2>
          <EnvioLocal />
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {locales.map((z) => (
              <li key={z.slug}>
                <Link href={`/envios/${z.slug}`} className="text-brand-blue underline underline-offset-2">
                  {z.nombre}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-gray-900">Bariloche, Villa La Angostura, San Martín y todo el país</h2>
          <EnvioTransporte lugar="cualquier punto de Argentina" />
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {lejos.map((z) => (
              <li key={z.slug}>
                <Link href={`/envios/${z.slug}`} className="text-brand-blue underline underline-offset-2">
                  {z.nombre}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <Link href="/catalogo" className="btn-primary block text-center">
          Ver el catálogo
        </Link>
      </article>
    </main>
  );
}
