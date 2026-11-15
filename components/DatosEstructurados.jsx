import { SITIO, ZONAS, rutaProducto, precioFinal } from "@/lib/seo";
import { NEGOCIO } from "@/lib/config";

// Datos estructurados (schema.org): etiquetas invisibles que le dicen a
// Google qué es cada página. Con esto puede mostrar el producto con precio,
// foto y "En stock" en los resultados, y saber dónde está el negocio y a qué
// zonas llega. Solo describen lo que ya se ve en la página.

function Script({ datos }) {
  return (
    <script
      type="application/ld+json"
      // JSON seguro dentro de <script>: se escapa "<" para que ningún texto
      // de un producto pueda cerrar la etiqueta
      dangerouslySetInnerHTML={{ __html: JSON.stringify(datos).replace(/</g, "\\u003c") }}
    />
  );
}

export function DatosTienda() {
  return (
    <Script
      datos={{
        "@context": "https://schema.org",
        "@type": "OnlineStore",
        "@id": `${SITIO}/#tienda`,
        name: NEGOCIO.nombre,
        url: SITIO,
        logo: `${SITIO}/icons/icon-512.png`,
        image: `${SITIO}/icons/icon-512.png`,
        description:
          "Tienda online de productos para el hogar, cocina, iluminación, belleza y tecnología en El Bolsón. Entrega en la Comarca Andina y envíos a Bariloche, Villa La Angostura, San Martín de los Andes y todo el país.",
        telephone: `+${NEGOCIO.whatsapp}`,
        address: {
          "@type": "PostalAddress",
          addressLocality: NEGOCIO.localidad,
          addressRegion: NEGOCIO.provincia,
          addressCountry: "AR"
        },
        areaServed: [
          ...ZONAS.map((z) => ({ "@type": "City", name: `${z.nombre}, ${z.provincia}` })),
          { "@type": "Country", name: "Argentina" }
        ],
        currenciesAccepted: "ARS",
        paymentAccepted: "Efectivo, Transferencia bancaria",
        sameAs: [NEGOCIO.instagram, NEGOCIO.facebook].filter(Boolean)
      }}
    />
  );
}

export function DatosProducto({ producto }) {
  if (!producto || producto.bajo_pedido) return null;
  const url = `${SITIO}${rutaProducto(producto)}`;
  const precio = precioFinal(producto);
  const imagen = producto.imagen_url ? `${SITIO}/api/og-imagen/${producto.id}?m=2` : `${SITIO}/icons/icon-512.png`;
  return (
    <Script
      datos={{
        "@context": "https://schema.org",
        "@type": "Product",
        name: producto.nombre,
        image: [imagen],
        description: String(producto.descripcion || producto.nombre).slice(0, 5000),
        sku: String(producto.id),
        ...(producto.categoria ? { category: producto.categoria } : {}),
        url,
        offers: {
          "@type": "Offer",
          url,
          priceCurrency: "ARS",
          price: Number(precio || 0).toFixed(2),
          availability: Number(producto.stock) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          itemCondition: "https://schema.org/NewCondition",
          seller: { "@id": `${SITIO}/#tienda` },
          hasMerchantReturnPolicy: {
            "@type": "MerchantReturnPolicy",
            applicableCountry: "AR",
            returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
            merchantReturnDays: 10,
            returnFees: "https://schema.org/FreeReturn",
            returnMethod: "https://schema.org/ReturnByMail"
          }
        }
      }}
    />
  );
}

export function DatosMigas({ items }) {
  return (
    <Script
      datos={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((it, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: it.nombre,
          item: `${SITIO}${it.ruta}`
        }))
      }}
    />
  );
}
