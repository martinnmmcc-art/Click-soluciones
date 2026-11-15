import Link from "next/link";
import { NEGOCIO } from "@/lib/config";

// Cómo llega el pedido según la zona. Lo mismo que dicen los términos y el
// checkout: nada de prometer plazos o precios que no se pueden cumplir.

const enlace = "text-brand-blue underline underline-offset-2";

export function EnvioLocal({ lugar = "la Comarca Andina" }) {
  return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-gray-800 space-y-1.5">
      <p className="font-bold text-green-900">📍 Entrega en mano en {lugar}</p>
      <ul className="list-disc pl-5 space-y-1">
        <li>Retirás sin costo, o te lo llevamos y coordinamos por WhatsApp.</li>
        <li>Si es con envío a domicilio, te decimos el costo antes de cobrarte.</li>
        <li>Pagás en efectivo al recibir o por transferencia.</li>
      </ul>
    </div>
  );
}

export function EnvioTransporte({ lugar = "tu ciudad" }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-gray-800 space-y-1.5">
      <p className="font-bold text-blue-900">📦 Envío por transporte a {lugar}</p>
      <ul className="list-disc pl-5 space-y-1">
        <li>
          Despachamos desde {NEGOCIO.localidad} por <b>Andreani</b> u otro transporte (a domicilio o a sucursal).
        </li>
        <li>
          <b>El envío lo pagás vos</b>: te pasamos el costo exacto por WhatsApp antes de cobrarte. Si no te sirve,
          cancelás sin pagar nada.
        </li>
        <li>Se paga por transferencia. Te pasamos el número de seguimiento cuando sale.</li>
        <li>
          Tenés 10 días para arrepentirte y el envío de vuelta corre por nuestra cuenta (
          <Link href="/reembolsos" className={enlace}>
            ver cómo
          </Link>
          ).
        </li>
      </ul>
    </div>
  );
}
