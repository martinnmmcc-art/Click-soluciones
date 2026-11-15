import Link from "next/link";
import PaginaLegal, { Seccion } from "@/components/PaginaLegal";
import { NEGOCIO } from "@/lib/config";

export const metadata = {
  title: "Cambios, devoluciones y reembolsos | Bolson Click",
  description: "Tenés 10 días para arrepentirte de tu compra. Cómo devolver un producto y cómo te devolvemos el dinero."
};

const enlace = "text-brand-blue underline underline-offset-2";

export default function Reembolsos() {
  return (
    <PaginaLegal titulo="Cambios, devoluciones y reembolsos" actual="/reembolsos">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
        <p className="font-bold text-gray-900">En resumen</p>
        <ul className="list-disc pl-5 mt-1 space-y-1 text-sm">
          <li>Tenés 10 días corridos desde que recibís el producto para arrepentirte.</li>
          <li>No tenés que dar explicaciones y no pagás el envío de vuelta.</li>
          <li>Te devolvemos todo lo que pagaste, por transferencia o en efectivo.</li>
        </ul>
      </div>

      <Seccion titulo="1. Derecho de arrepentimiento (10 días)">
        <p>
          Como compraste a distancia, la ley (artículo 34 de la Ley 24.240 y artículo 1110 del Código Civil y
          Comercial) te da <b>10 días corridos</b> para cancelar la compra sin explicar por qué. El plazo cuenta
          desde que recibís el producto, o desde que confirmaste el pedido si todavía no te lo entregamos.
        </p>
        <p>
          Avisanos desde el{" "}
          <Link href="/arrepentimiento" className={enlace}>
            botón de arrepentimiento
          </Link>{" "}
          o por WhatsApp. En menos de 24 horas te mandamos el código de tu trámite y coordinamos el retiro.
        </p>
      </Seccion>

      <Seccion titulo="2. Cómo tiene que estar el producto">
        <p>
          Sin uso más allá de lo necesario para probarlo, con su caja, accesorios y manuales. Si le falta algo o
          está dañado por el uso, podemos descontar esa diferencia.
        </p>
        <p>
          Por su naturaleza no se pueden devolver los productos de higiene personal que estén abiertos (por
          ejemplo, depiladoras, cortapelo o cepillos) ni los hechos a medida, salvo que vengan fallados.
        </p>
      </Seccion>

      <Seccion titulo="3. Cómo te devolvemos el dinero">
        <p>
          Te devolvemos <b>el total que pagaste</b>, incluido el envío, por el mismo medio que usaste
          (transferencia o efectivo), apenas recibimos el producto y como máximo dentro de los 10 días. Los gastos
          de devolución corren por nuestra cuenta: en {NEGOCIO.zona} lo retiramos nosotros; si estás en otra ciudad,
          te mandamos la etiqueta del transporte pagada o te reintegramos lo que gastes en mandarlo.
        </p>
      </Seccion>

      <Seccion titulo="4. Cambios">
        <p>
          Si preferís cambiarlo por otro producto o por otro color o modelo, dentro de los mismos 10 días, también
          se puede. Si el nuevo cuesta distinto, pagás o te devolvemos la diferencia.
        </p>
      </Seccion>

      <Seccion titulo="5. Productos fallados (garantía)">
        <p>
          Si un producto viene fallado o se rompe por un defecto de fábrica dentro de los 6 meses, escribinos con
          una foto o video. Te lo cambiamos, lo hacemos reparar o te devolvemos el dinero, sin costo para vos.
        </p>
      </Seccion>

      <Seccion titulo="6. Pedidos que no pudimos entregar">
        <p>
          Si un producto a pedido no llega porque el proveedor no lo tiene, te avisamos y te devolvemos lo que
          hayas pagado, o lo dejamos como saldo a favor si así lo preferís.
        </p>
      </Seccion>
    </PaginaLegal>
  );
}
