export const CATEGORIAS = [
  { slug: "hogar-cocina", nombre: "Hogar y Cocina", emoji: "🏠" },
  { slug: "iluminacion", nombre: "Iluminación", emoji: "💡" },
  { slug: "bebes-ninos", nombre: "Bebés y Niños", emoji: "👶" },
  { slug: "belleza", nombre: "Belleza y Cuidado Personal", emoji: "💄" },
  { slug: "tecnologia", nombre: "Tecnología y Accesorios", emoji: "📱" },
  { slug: "herramientas", nombre: "Herramientas y Ferretería", emoji: "🔧" },
  { slug: "ofertas", nombre: "Ofertas de la Semana", emoji: "🎁" }
];

export function nombreCategoria(slug) {
  const cat = CATEGORIAS.find((c) => c.slug === slug);
  return cat ? cat.nombre : slug;
}
