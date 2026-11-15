import { metadataDeProducto, traerProducto } from "@/lib/metadataProducto";
import { DatosProducto, DatosMigas } from "@/components/DatosEstructurados";
import { idDeRuta, rutaProducto, rutaCategoria, nombreLimpio } from "@/lib/seo";

// Vista previa con foto, nombre y precio cuando se comparte el link por WhatsApp,
// y los datos para Google (precio, stock, foto) armados en el servidor.
export async function generateMetadata({ params }) {
  return metadataDeProducto(params.id, "producto");
}

export default async function Layout({ children, params }) {
  const producto = await traerProducto(idDeRuta(params.id));
  const migas = producto
    ? [
        { nombre: "Inicio", ruta: "/" },
        ...(producto.categoria
          ? [{ nombre: nombreLimpio(producto.categoria), ruta: rutaCategoria(producto.categoria) }]
          : [{ nombre: "Catálogo", ruta: "/catalogo" }]),
        { nombre: producto.nombre, ruta: rutaProducto(producto) }
      ]
    : null;
  return (
    <>
      {producto && <DatosProducto producto={producto} />}
      {migas && <DatosMigas items={migas} />}
      {children}
    </>
  );
}
