export const CATEGORIAS = [
  { slug: "iluminacion", nombre: "Iluminación", emoji: "💡" },
  { slug: "cocina", nombre: "Cocina", emoji: "🍳" },
  { slug: "hogar", nombre: "Hogar", emoji: "🏠" },
  { slug: "organizacion", nombre: "Organización", emoji: "🗂️" },
  { slug: "ofertas", nombre: "Ofertas", emoji: "🔥" }
];

export function nombreCategoria(slug) {
  const cat = CATEGORIAS.find((c) => c.slug === slug);
  return cat ? cat.nombre : slug;
}
