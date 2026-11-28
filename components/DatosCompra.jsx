import { VENTA, NEGOCIO } from "@/lib/config";
import { formatPrice } from "@/lib/whatsapp";

// Las líneas chiquitas debajo del precio que hacen vender a MercadoLibre:
// cuotas, entrega, envío gratis y "quedan pocas". Todo sale de datos reales
// (stock de la base y lo que configuraste en lib/config): nada inventado.
//
// tamano: "chico" para las tarjetas, "grande" para la ficha del producto.
export default function DatosCompra({ producto, tamano = "chico" }) {
  if (!producto) return null;

  const aPedido = producto.bajo_pedido === true;
  const oferta = Number(producto.precio_oferta || 0);
  const lista = Number(producto.precio || 0);
  const precio = oferta > 0 && oferta < lista ? oferta : lista;

  const tieneStock = producto.stock !== null && producto.stock !== undefined;
  const stock = Number(producto.stock || 0);
  const disponible = !aPedido && tieneStock && stock > 0;
  const quedanPocas = disponible && stock >= 2 && stock <= 3;

  const envioGratis = VENTA.envioGratisDesde > 0 && precio >= VENTA.envioGratisDesde;

  let cuotas = null;
  if (precio > 0 && VENTA.cuotasSinInteres > 1) {
    const valor = Math.ceil(precio / VENTA.cuotasSinInteres);
    cuotas = (
      <>
        {VENTA.cuotasSinInteres} cuotas sin interés de <b>${formatPrice(valor)}</b>
      </>
    );
  } else if (precio > 0 && VENTA.textoCuotas) {
    cuotas = VENTA.textoCuotas;
  }

  const t = tamano === "grande" ? "text-[13px]" : "text-[10.5px]";

  if (!cuotas && !disponible && !envioGratis) return null;

  return (
    <div className={`flex flex-col gap-0.5 ${t} leading-tight`}>
      {cuotas && (
        <span className={VENTA.cuotasSinInteres > 1 ? "text-emerald-700 font-semibold" : "text-gray-500"}>
          💳 {cuotas}
        </span>
      )}
      {envioGratis && disponible && (
        <span className="text-emerald-700 font-bold">🚚 Envío gratis en la Comarca</span>
      )}
      {disponible && !envioGratis && (
        <span className="text-emerald-700 font-semibold">
          📍 Listo para entregar en {tamano === "grande" ? NEGOCIO.zona : "la Comarca"}
        </span>
      )}
      {quedanPocas && <span className="text-red-600 font-bold">¡Quedan solo {stock}!</span>}
    </div>
  );
}
