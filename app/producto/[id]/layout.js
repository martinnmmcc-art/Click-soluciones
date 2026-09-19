import { metadataDeProducto } from "@/lib/metadataProducto";

// Vista previa con foto, nombre y precio cuando se comparte el link por WhatsApp
export async function generateMetadata({ params }) {
  return metadataDeProducto(params.id, "producto");
}

export default function Layout({ children }) {
  return children;
}
