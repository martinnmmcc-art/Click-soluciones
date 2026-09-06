// Devuelve la dirección de una foto pasándola siempre por nuestro dominio.
//
// Por qué: las fotos venían directo de nextcell.com.ar, así que cualquiera
// que mire el código de la página (o mantenga apretada una foto) descubre
// nuestro proveedor en un segundo. Pasándolas por bolsonclick.com.ar, el
// origen deja de estar a la vista.

export function urlImagen(url) {
  if (!url) return null;

  const s = String(url).trim();
  if (s === "") return null;

  // Las nuestras (Supabase, fotos propias) van directo: son de nuestro dominio
  if (s.includes("supabase.co") || s.startsWith("/")) return s;

  return `/api/img?u=${encodeURIComponent(s)}`;
}

// Para listas: aplica lo mismo a todas las fotos de un producto
export function fotosDe(producto) {
  return [
    producto?.imagen_url,
    producto?.imagen_url_2,
    producto?.imagen_url_3,
    producto?.imagen_url_4,
    producto?.imagen_url_5,
    producto?.imagen_url_6
  ]
    .map(urlImagen)
    .filter(Boolean);
}
