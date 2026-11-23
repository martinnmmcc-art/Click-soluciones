import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";
import { urlQR } from "@/lib/arca";
import BotonImprimir from "@/components/BotonImprimir";

// Factura C para mostrar, imprimir o guardar en PDF. Se llega por un link con
// un código secreto (el que se le manda al cliente): sin el código no se ve.
//
// Datos del emisor (Vercel → Environment Variables):
//  ARCA_RAZON_SOCIAL, ARCA_DOMICILIO, ARCA_INICIO_ACTIVIDADES (dd/mm/aaaa),
//  ARCA_IIBB (número de Ingresos Brutos o "Exento"), ARCA_CUIT.

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false }, title: "Factura · Bolson Click" };

const CONDICIONES = {
  1: "IVA Responsable Inscripto",
  4: "IVA Sujeto Exento",
  5: "Consumidor Final",
  6: "Responsable Monotributo"
};
const DOCS = { 80: "CUIT", 86: "CUIL", 96: "DNI", 99: "" };

function pesos(n) {
  return Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fechaAR(iso) {
  if (!iso) return "";
  const [a, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}
function cuitConGuiones(c) {
  const s = String(c || "").replace(/\D/g, "");
  return s.length === 11 ? `${s.slice(0, 2)}-${s.slice(2, 10)}-${s.slice(10)}` : s;
}

async function cargar(codigo) {
  if (!/^[0-9a-f-]{36}$/i.test(codigo)) return null;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data } = await supabase.rpc("factura_por_codigo", { p_codigo: codigo });
  return data?.[0] || null;
}

export default async function FacturaPage({ params }) {
  const f = await cargar(params.codigo);
  if (!f) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <p className="text-gray-600">No encontramos esa factura.</p>
      </main>
    );
  }

  const cuit = String(process.env.ARCA_CUIT || "").replace(/\D/g, "");
  const qr = await QRCode.toString(
    urlQR({
      cuit,
      puntoVenta: f.punto_venta,
      numero: f.numero,
      fecha: f.fecha,
      total: f.total,
      docTipo: f.doc_tipo,
      docNro: f.doc_nro,
      cae: f.cae
    }),
    { type: "svg", margin: 0, errorCorrectionLevel: "M" }
  );
  const items = f.detalle?.items || [];
  const esCF = Number(f.condicion_iva) === 5;
  const pv = String(f.punto_venta).padStart(5, "0");
  const nro = String(f.numero).padStart(8, "0");

  return (
    <main className="factura-imprimible min-h-screen bg-gray-100 print:bg-white py-6 print:py-0 px-3">
      <div className="max-w-2xl mx-auto bg-white text-gray-900 border border-gray-300 print:border-0 text-[13px]">
        {!f.produccion && (
          <div className="bg-red-600 text-white text-center font-bold py-1.5 text-xs">
            COMPROBANTE DE PRUEBA — SIN VALIDEZ FISCAL
          </div>
        )}
        <div className="text-center font-bold border-b border-gray-300 py-1 text-xs tracking-widest">ORIGINAL</div>

        <div className="grid grid-cols-[1fr_auto_1fr] border-b border-gray-300">
          <div className="p-3">
            <p className="font-extrabold text-base">{process.env.ARCA_RAZON_SOCIAL || "Bolson Click"}</p>
            <p className="mt-1">
              <b>Domicilio:</b> {process.env.ARCA_DOMICILIO || "El Bolsón, Río Negro"}
            </p>
            <p>
              <b>Condición frente al IVA:</b> Responsable Monotributo
            </p>
          </div>
          <div className="flex flex-col items-center border-x border-gray-300 px-4 py-2">
            <span className="text-4xl font-extrabold leading-none border border-gray-900 px-3 py-1">C</span>
            <span className="text-[10px] font-bold mt-1">COD. 011</span>
          </div>
          <div className="p-3">
            <p className="font-extrabold text-base">FACTURA</p>
            <p className="mt-1">
              <b>Punto de venta:</b> {pv} <b className="ml-2">Comp. Nro:</b> {nro}
            </p>
            <p>
              <b>Fecha de emisión:</b> {fechaAR(f.fecha)}
            </p>
            <p>
              <b>CUIT:</b> {cuitConGuiones(cuit)}
            </p>
            <p>
              <b>Ingresos Brutos:</b> {process.env.ARCA_IIBB || cuitConGuiones(cuit)}
            </p>
            <p>
              <b>Inicio de actividades:</b> {process.env.ARCA_INICIO_ACTIVIDADES || "-"}
            </p>
          </div>
        </div>

        <div className="p-3 border-b border-gray-300">
          {esCF && f.doc_tipo === 99 ? (
            <p className="font-bold">A CONSUMIDOR FINAL</p>
          ) : (
            <>
              <p>
                <b>{DOCS[f.doc_tipo] || "Doc."}:</b> {f.doc_tipo === 80 ? cuitConGuiones(f.doc_nro) : f.doc_nro}
                <b className="ml-3">Condición frente al IVA:</b> {CONDICIONES[f.condicion_iva] || ""}
              </p>
              {f.receptor_nombre && (
                <p>
                  <b>Nombre / Razón social:</b> {f.receptor_nombre}
                </p>
              )}
              {esCF && <p className="font-bold mt-1">A CONSUMIDOR FINAL</p>}
            </>
          )}
          <p>
            <b>Condición de venta:</b> Contado
          </p>
        </div>

        <table className="w-full">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="p-2">Producto / Servicio</th>
              <th className="p-2 text-right">Cant.</th>
              <th className="p-2 text-right">Precio unit.</th>
              <th className="p-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i, k) => (
              <tr key={k} className="border-b border-gray-100">
                <td className="p-2">{i.descripcion}</td>
                <td className="p-2 text-right">{i.cantidad}</td>
                <td className="p-2 text-right">{pesos(i.precio)}</td>
                <td className="p-2 text-right">{pesos(i.subtotal)}</td>
              </tr>
            ))}
            {f.detalle?.ajuste ? (
              <tr className="border-b border-gray-100">
                <td className="p-2" colSpan={3}>
                  {f.detalle.ajuste < 0 ? "Descuento" : "Ajuste"}
                </td>
                <td className="p-2 text-right">{pesos(f.detalle.ajuste)}</td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <div className="flex justify-end p-3 border-t border-gray-300">
          <p className="text-base font-extrabold">Importe total: $ {pesos(f.total)}</p>
        </div>

        <div className="flex items-center gap-4 p-3 border-t border-gray-300">
          <div className="w-28 h-28 flex-shrink-0" dangerouslySetInnerHTML={{ __html: qr }} />
          <div>
            <p className="font-bold">Comprobante autorizado por ARCA</p>
            <p>
              <b>CAE N°:</b> {f.cae}
            </p>
            <p>
              <b>Vencimiento del CAE:</b> {fechaAR(f.cae_vence)}
            </p>
            {f.detalle?.pedido && <p className="text-gray-500 text-[11px] mt-1">Pedido {f.detalle.pedido}</p>}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto mt-4 flex justify-center print:hidden">
        <BotonImprimir />
      </div>
    </main>
  );
}
