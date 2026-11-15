import Link from "next/link";
import PaginaLegal, { Seccion } from "@/components/PaginaLegal";
import DatosResponsable from "@/components/DatosResponsable";
import { NEGOCIO } from "@/lib/config";

export const metadata = {
  title: "Política de privacidad | Bolson Click",
  description: "Qué datos guardamos, para qué, con quién se comparten y cómo pedir que los borremos."
};

export default function Privacidad() {
  return (
    <PaginaLegal titulo="Política de privacidad" actual="/privacidad">
      <p>
        Esta política explica qué datos personales guardamos cuando usás {NEGOCIO.nombre}, para qué los usamos y
        cómo podés consultarlos, corregirlos o pedir que los borremos. Cumple con la Ley 25.326 de Protección de
        los Datos Personales.
      </p>

      <Seccion titulo="1. Quién es responsable de tus datos">
        <DatosResponsable />
      </Seccion>

      <Seccion titulo="2. Qué datos guardamos">
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <b>Para crear tu cuenta:</b> nombre, celular y localidad. Si elegís una contraseña, se guarda cifrada:
            nadie (ni nosotros) puede leerla.
          </li>
          <li>
            <b>Para tus pedidos:</b> los productos, montos, forma de pago y entrega, la dirección (solo si pedís
            envío), las notas que nos dejes y el comprobante de pago si lo subís.
          </li>
          <li>
            <b>Si lo usás:</b> correo electrónico (solo para mandarte un código de verificación), favoritos,
            opiniones y reseñas, y la suscripción a notificaciones del celular.
          </li>
          <li>
            <b>Solo si lo aceptás en el aviso de cookies:</b> un identificador anónimo del dispositivo, de qué red
            social llegaste y qué productos agregás o sacás del carrito.
          </li>
        </ul>
        <p>
          No pedimos DNI, datos de tarjetas ni datos sensibles. No usamos herramientas de publicidad ni de
          seguimiento de terceros (como Google Analytics o el píxel de Facebook).
        </p>
      </Seccion>

      <Seccion titulo="3. Para qué los usamos">
        <ul className="list-disc pl-5 space-y-1">
          <li>Preparar, entregar y cobrar tus pedidos, y avisarte en qué estado están.</li>
          <li>Que entres a tu cuenta y veas tus compras sin volver a cargar tus datos.</li>
          <li>Responder consultas, reclamos y pedidos de cambio o devolución.</li>
          <li>
            Mandarte novedades y ofertas, <b>solo si lo aceptaste</b>. Te podés dar de baja cuando quieras desde{" "}
            <Link href="/cuenta" className="text-brand-blue underline underline-offset-2">
              Mi cuenta
            </Link>
            .
          </li>
          <li>Cumplir obligaciones legales, contables e impositivas.</li>
        </ul>
        <p>Nunca vendemos ni alquilamos tus datos.</p>
      </Seccion>

      <Seccion titulo="4. Con quién se comparten">
        <p>
          Solo con los servicios que hacen funcionar la tienda, que guardan los datos por nuestra cuenta y no
          pueden usarlos para otra cosa:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <b>Supabase</b>: base de datos donde se guardan las cuentas y los pedidos.
          </li>
          <li>
            <b>Vercel</b>: aloja la página web.
          </li>
          <li>
            <b>Resend</b>: envía el correo con el código de verificación, si lo pedís.
          </li>
          <li>
            <b>El servicio de notificaciones de tu celular</b> (Google, Apple o Mozilla), si activás los avisos.
          </li>
        </ul>
        <p>
          Estos servicios pueden guardar la información en servidores fuera de Argentina (por ejemplo, en Estados
          Unidos), con medidas de seguridad adecuadas. También podemos compartir datos si una autoridad competente
          lo exige por ley.
        </p>
      </Seccion>

      <Seccion titulo="5. Cuánto tiempo los guardamos">
        <ul className="list-disc pl-5 space-y-1">
          <li>Tu cuenta: mientras la uses o hasta que pidas borrarla.</li>
          <li>
            Los pedidos: hasta 10 años, porque la ley nos obliga a conservar los registros de ventas. Si borrás tu
            cuenta, quedan sin tu nombre, celular ni dirección.
          </li>
          <li>Los registros técnicos de visitas: se borran solos a los 30 días.</li>
        </ul>
      </Seccion>

      <Seccion titulo="6. Tus derechos">
        <p>
          Podés pedir ver qué datos tenemos tuyos, corregirlos, actualizarlos o que los borremos. Respondemos en un
          plazo máximo de 10 días corridos para el acceso y 5 días hábiles para la corrección o eliminación.
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <b>Borrar tu cuenta:</b> en{" "}
            <Link href="/cuenta" className="text-brand-blue underline underline-offset-2">
              Mi cuenta
            </Link>{" "}
            tocá “Eliminar mi cuenta y mis datos”.
          </li>
          <li>
            <b>Darte de baja de novedades:</b> en Mi cuenta, con un toque.
          </li>
          <li>
            <b>Cualquier otro pedido:</b> escribinos por WhatsApp al número de arriba.
          </li>
        </ul>
        <p className="text-sm bg-gray-50 border border-gray-200 rounded-xl p-3">
          El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en
          forma gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al
          efecto conforme lo establecido en el artículo 14, inciso 3 de la Ley Nº 25.326. La AGENCIA DE ACCESO A LA
          INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de
          atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por
          incumplimiento de las normas vigentes en materia de protección de datos personales.
        </p>
      </Seccion>

      <Seccion titulo="7. Menores de edad">
        <p>
          La tienda está pensada para mayores de 18 años. Si sos menor, pedile a una persona adulta responsable
          que haga la compra. Si nos enteramos de que una cuenta es de un menor sin autorización, la borramos.
        </p>
      </Seccion>

      <Seccion titulo="8. Seguridad">
        <p>
          Las conexiones van cifradas (HTTPS), las contraseñas se guardan cifradas y solo las personas autorizadas
          del negocio pueden ver los pedidos.
        </p>
      </Seccion>

      <Seccion titulo="9. Cambios en esta política">
        <p>
          Si cambiamos algo importante, lo avisamos en la app antes de que empiece a regir. La fecha de la última
          actualización figura arriba de todo.
        </p>
      </Seccion>
    </PaginaLegal>
  );
}
