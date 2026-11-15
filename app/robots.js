import { SITIO } from "@/lib/seo";

// Qué puede mirar Google y dónde está el mapa del sitio.
// Fuera de Google: el panel, las APIs, la cuenta, el carrito y el checkout
// (no son páginas para encontrar desde un buscador).
export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/cuenta", "/carrito", "/checkout", "/confirmacion", "/login", "/offline", "/catalogo-compartir"]
      }
    ],
    sitemap: `${SITIO}/sitemap.xml`,
    host: SITIO
  };
}
