import Link from "next/link";
import PaginaLegal, { Seccion } from "@/components/PaginaLegal";
import DatosResponsable from "@/components/DatosResponsable";
import { NEGOCIO } from "@/lib/config";

export const metadata = {
  title: "Términos y condiciones | Bolson Click",
  description: "Las reglas de compra en Bolson Click: precios, pagos, envíos, productos a pedido y garantía."
};

const enlace = "text-brand-blue underline underline-offset-2";

export default function Terminos() {
  return (
    <PaginaLegal titulo="Términos y condiciones" actual="/terminos">
      <p>
        Estos términos explican cómo funciona la compra en {NEGOCIO.nombre} ({NEGOCIO.web}). Al crear una cuenta o
        hacer un pedido, los aceptás. Si algo no está claro, escribinos antes de comprar.
      </p>

      <Seccion titulo="1. Quién vende">
        <DatosResponsable />
      </Seccion>

      <Seccion titulo="2. Quién puede comprar">
        <p>
          Personas mayores de 18 años. Los datos que cargues tienen que ser verdaderos, porque los usamos para
          coordinar la entrega.
        </p>
      </Seccion>

      <Seccion titulo="3. Productos">
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <b>Disponibles ya:</b> los tenemos en stock en {NEGOCIO.localidad}.
          </li>
          <li>
            <b>A pedido:</b> los traemos de nuestro proveedor mayorista. Antes de cobrarte te confirmamos por
            WhatsApp que hay stock y cuándo llegan. Si el proveedor no lo tiene, te avisamos y no pagás nada (o te
            devolvemos lo que hayas pagado).
          </li>
        </ul>
        <p>
          Las fotos son ilustrativas y las provee nuestro proveedor, que autoriza su uso para la reventa. El color,
          el modelo o el empaque pueden variar levemente. Si algo importante es distinto a lo publicado, lo podés
          devolver.
        </p>
      </Seccion>

      <Seccion titulo="4. Precios">
        <p>
          Los precios están en pesos argentinos y son <b>precios finales</b>: no se suma nada al pagar por el medio
          de pago que elijas. El único costo que puede agregarse es el envío, que se informa como se explica abajo.
          El precio que vale es el que figura cuando confirmás el pedido. Si hubo un error evidente en un precio
          publicado, te avisamos antes de cobrar y podés cancelar sin costo.
        </p>
      </Seccion>

      <Seccion titulo="5. Formas de pago">
        <p>
          Efectivo al retirar o recibir (solo en la Comarca Andina), o transferencia bancaria. Las formas habilitadas se muestran al confirmar
          el pedido. Con transferencia, el pedido queda confirmado cuando recibimos el pago.
        </p>
      </Seccion>

      <Seccion titulo="6. Entrega y envío">
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <b>Retiro:</b> sin costo, en el lugar y horario que coordinamos por WhatsApp.
          </li>
          <li>
            <b>Envío a domicilio</b> en {NEGOCIO.zona}: el costo depende de la distancia.{" "}
            <b>Te lo decimos antes de que pagues</b>, y si no te sirve podés cancelar el pedido sin pagar nada.
          </li>
          <li>
            <b>Resto del país</b> (Bariloche, Villa La Angostura, San Martín de los Andes y cualquier localidad):
            despachamos por Andreani u otro transporte. El envío lo paga el comprador; te pasamos el costo exacto
            antes de cobrarte y el pago es por transferencia. Te damos el número de seguimiento. Desde que lo
            entregamos al transporte, los plazos dependen de la empresa de transporte.
          </li>
        </ul>
        <p>
          Más detalles en{" "}
          <Link href="/envios" className={enlace}>
            Envíos
          </Link>
          .
        </p>
      </Seccion>

      <Seccion titulo="7. Cancelar, cambiar o devolver">
        <p>
          Tenés 10 días corridos para arrepentirte de la compra, sin dar explicaciones. Podés hacerlo desde el{" "}
          <Link href="/arrepentimiento" className={enlace}>
            botón de arrepentimiento
          </Link>
          . Los detalles están en la{" "}
          <Link href="/reembolsos" className={enlace}>
            política de cambios, devoluciones y reembolsos
          </Link>
          .
        </p>
      </Seccion>

      <Seccion titulo="8. Garantía">
        <p>
          Los productos nuevos tienen la garantía legal de la Ley 24.240: 6 meses desde la entrega por fallas de
          fabricación. Si un producto viene fallado o deja de funcionar por un defecto, escribinos y lo cambiamos,
          lo reparamos o te devolvemos el dinero. La garantía no cubre el mal uso, golpes o desgaste normal.
        </p>
      </Seccion>

      <Seccion titulo="9. Tu cuenta">
        <p>
          Sos responsable de no compartir tu acceso. Podemos suspender una cuenta si se usa para fraudes o para
          molestar a otras personas. Podés borrar tu cuenta cuando quieras desde{" "}
          <Link href="/cuenta" className={enlace}>
            Mi cuenta
          </Link>
          .
        </p>
      </Seccion>

      <Seccion titulo="10. Opiniones">
        <p>
          Solo pueden opinar quienes compraron. Publicamos las opiniones buenas y las malas; solo quitamos las que
          tengan insultos, datos personales de otras personas o nada que ver con la compra.
        </p>
      </Seccion>

      <Seccion titulo="11. Privacidad">
        <p>
          Cómo cuidamos tus datos está en la{" "}
          <Link href="/privacidad" className={enlace}>
            política de privacidad
          </Link>
          .
        </p>
      </Seccion>

      <Seccion titulo="12. Reclamos">
        <p>
          Primero escribinos: casi todo se resuelve rápido por WhatsApp. Si no quedás conforme, podés reclamar ante
          Defensa del Consumidor de {NEGOCIO.provincia} o en la{" "}
          <a
            href="https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario"
            className={enlace}
            target="_blank"
            rel="noopener noreferrer"
          >
            Ventanilla Federal de Reclamos
          </a>
          . Estos términos se rigen por las leyes de Argentina; vale la jurisdicción de tu domicilio.
        </p>
      </Seccion>
    </PaginaLegal>
  );
}
