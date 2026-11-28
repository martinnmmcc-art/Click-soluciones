import InicioCliente from "@/components/InicioCliente";
import { productosPropios } from "@/lib/seo";

// Portada armada en el SERVIDOR: los productos ya vienen escritos en la
// página, así Google, la vista previa de WhatsApp y el cliente con mala señal
// ven la vidriera llena desde el primer momento. Después, en el celular, se
// recarga con todos los datos al día (ver components/InicioCliente).
export const revalidate = 600;

export default async function Inicio() {
  let productos = [];
  try {
    productos = await productosPropios({ limite: 60 });
  } catch {
    productos = [];
  }
  return <InicioCliente productosIniciales={Array.isArray(productos) ? productos : []} />;
}
