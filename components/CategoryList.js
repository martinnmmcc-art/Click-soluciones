import Link from "next/link";
import { CATEGORIAS } from "@/lib/categorias";

export default function CategoryList() {
  return (
    <div className="mt-5 px-4">
      <h2 className="font-bold text-gray-800 mb-3">Categorías</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {CATEGORIAS.map((cat) => (
          <Link
            key={cat.slug}
            href={`/catalogo?categoria=${cat.slug}`}
            className="flex flex-col items-center justify-center min-w-[76px] card px-3 py-3 hover:shadow-md transition-shadow"
          >
            <span className="text-2xl">{cat.emoji}</span>
            <span className="text-xs font-medium text-gray-700 mt-1 text-center">
              {cat.nombre}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
