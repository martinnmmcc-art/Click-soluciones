import { supabase } from "@/lib/supabaseClient";

export const revalidate = 0;

export default async function HomePage() {
  // Traemos solo una pequeña muestra y columnas básicas para no saturar memoria
  const { data, error } = await supabase
    .from("Productos")
    .select("id, nombre")
    .limit(5);

  return (
    <main className="p-6">
      <h1 className="text-xl font-bold mb-4">Prueba de Diagnóstico</h1>

      {error ? (
        <div className="p-4 bg-red-100 text-red-700 rounded">
          Error en Supabase: {error.message}
        </div>
      ) : (
        <div>
          <p className="text-green-600 font-semibold mb-2">
            ¡Conexión exitosa! El servidor no se cayó.
          </p>
          <p className="text-gray-600 text-sm mb-4">
            Productos encontrados (muestra de 5): {data?.length || 0}
          </p>
          <ul className="list-disc pl-5 space-y-1">
            {data?.map((p) => (
              <li key={p.id} className="text-gray-800">
                {p.nombre || "Producto sin nombre"}
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
