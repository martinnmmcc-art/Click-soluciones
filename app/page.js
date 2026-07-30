import Header from "@/components/Header";
import BannerOfertas from "@/components/BannerOfertas";
import CategoryList from "@/components/CategoryList";
import ProductCard from "@/components/ProductCard";
import { supabase } from "@/lib/supabaseClient";

export const revalidate = 0;

async function getDestacados() {
  const { data, error } = await supabase
    .from("productos")
    .select("*")
    .eq("activo", true)
    .eq("destacado", true)
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    console.error("Error cargando destacados:", error.message);
    return [];
  }

  return data || [];
}

// 👇 NUEVO: traer todos los productos si no hay destacados
async function getProductos() {
  const { data, error } = await supabase
    .from("productos")
    .select("*")
    .eq("activo", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error cargando productos:", error.message);
    return [];
  }

  return data || [];
}

export default async function HomePage() {
  const destacados = await getDestacados();
  const productos = await getProductos();

  // 👇 si no hay destacados, usa productos normales
  const productosMostrar =
    destacados.length > 0 ? destacados : productos;

  return (
    <main className="pb-6">
      <Header />
      <BannerOfertas />
      <CategoryList />

      <section className="mt-6 px-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-gray-800">
            {destacados.length > 0
              ? "Productos destacados"
              : "Productos disponibles"}
          </h2>
          <a href="/catalogo" className="text-sm text-brand-blue font-semibold">
            Ver todo
          </a>
        </div>

        {productosMostrar.length === 0 ? (
          <div className="card p-6 text-center text-gray-500 text-sm">
            Todavía no hay productos cargados. <br />
            Cargalos desde el panel de administración.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {productosMostrar.map((p) => (
              <ProductCard key={p.id} producto={p} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
