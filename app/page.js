import Header from "@/components/Header";
import BannerOfertas from "@/components/BannerOfertas";
import CategoryList from "@/components/CategoryList";
import ProductCard from "@/components/ProductCard";
import { supabase } from "@/lib/supabaseClient";

export const revalidate = 0;


async function getProductos() {
  const { data, error } = await supabase
    .from("Productos")
    .select("*");

  if (error) {
    console.error("Error cargando productos:", error.message);
    return [];
  }

  return data || [];
}

export default async function HomePage() {
  const productos = await getProductos();

  return (
    <main className="pb-6">
      <Header />
      <BannerOfertas />
      <CategoryList />

      <section className="mt-6 px-4">
        <h2 className="font-bold text-gray-800 mb-3">
          Productos disponibles
        </h2>

        {productos.length === 0 ? (
          <div className="card p-6 text-center text-gray-500 text-sm">
            No hay productos cargados.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {productos.map((p) => (
              <ProductCard key={p.id} producto={p} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
