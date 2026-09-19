import { metadataDeProducto } from "@/lib/metadataProducto";

// Vista previa con foto y nombre cuando se comparte el link por WhatsApp
export async function generateMetadata({ params }) {
  return metadataDeProducto(params.id, "a-pedido");
}

export default function Layout({ children }) {
  return children;
}
