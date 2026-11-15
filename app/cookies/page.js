import PaginaLegal, { Seccion } from "@/components/PaginaLegal";
import BotonPreferenciasCookies from "@/components/BotonPreferenciasCookies";

export const metadata = {
  title: "Política de cookies | Bolson Click",
  description: "Qué guarda la app en tu celular, para qué, y cómo cambiar tu elección."
};

const NECESARIOS = [
  ["Sesión de tu cuenta", "Para que no tengas que entrar cada vez."],
  ["Carrito y pedidos sin enviar", "Para no perder lo que elegiste, aunque se corte la señal."],
  ["Favoritos y modo claro / oscuro", "Para recordar tus preferencias."],
  ["Catálogo guardado", "Para que la tienda funcione sin señal."],
  ["Avisos ya vistos", "Para no mostrarte el mismo cartel dos veces."],
  ["Tu elección sobre cookies", "Para no volver a preguntarte."]
];

const MEDICION = [
  ["Identificador anónimo del dispositivo", "Saber que varias visitas vienen del mismo celular."],
  ["De dónde llegaste (WhatsApp, Facebook, Instagram)", "Saber qué publicaciones funcionan. Se borra a los 7 días."],
  ["Productos que agregás o sacás del carrito", "Avisarle al negocio para poder ayudarte si te quedó alguna duda."]
];

function Tabla({ filas }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border border-gray-200 rounded-xl">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="text-left p-2 font-bold">
              Qué se guarda
            </th>
            <th scope="col" className="text-left p-2 font-bold">
              Para qué
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.map(([a, b]) => (
            <tr key={a} className="border-t border-gray-200">
              <td className="p-2 align-top">{a}</td>
              <td className="p-2 align-top">{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Cookies() {
  return (
    <PaginaLegal titulo="Política de cookies" actual="/cookies">
      <p>
        La app no usa cookies de publicidad ni herramientas de seguimiento de otras empresas. Lo que sí hace es
        guardar algunos datos en tu propio celular (en el “almacenamiento local” del navegador, que funciona como
        una cookie). Acá te contamos cuáles y para qué.
      </p>

      <Seccion titulo="Necesarios (siempre activos)">
        <p>Sin estos la tienda no funciona, por eso no se pueden desactivar:</p>
        <Tabla filas={NECESARIOS} />
      </Seccion>

      <Seccion titulo="Medición (solo si los aceptás)">
        <p>Nos ayudan a mejorar la tienda. Si elegís “Solo necesarias”, no se guardan:</p>
        <Tabla filas={MEDICION} />
      </Seccion>

      <Seccion titulo="Cambiar tu elección">
        <p>Podés cambiarla cuando quieras:</p>
        <BotonPreferenciasCookies />
        <p className="text-sm">
          También podés borrar todo desde la configuración de tu navegador (“Borrar datos de sitios”). Si lo hacés,
          vas a tener que volver a entrar a tu cuenta.
        </p>
      </Seccion>
    </PaginaLegal>
  );
}
