// La lista de "a pedido" sí va a Google (explica que traemos lo que no está
// en stock); cada producto a pedido no (ver lib/metadataProducto.js).
export const metadata = {
  title: "Productos a pedido | Bolson Click",
  description:
    "¿No lo encontrás en stock? Lo traemos en el próximo pedido a nuestro proveedor. Miles de productos para el hogar, tecnología, belleza y herramientas con envío a la Comarca Andina y todo el país.",
  alternates: { canonical: "/a-pedido" }
};

export default function Layout({ children }) {
  return children;
}
