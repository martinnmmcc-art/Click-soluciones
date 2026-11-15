import FormularioArrepentimiento from "@/components/FormularioArrepentimiento";
import PaginaLegal, { Seccion } from "@/components/PaginaLegal";

export const metadata = {
  title: "Botón de arrepentimiento | Bolson Click",
  description: "Cancelá tu compra dentro de los 10 días, sin dar explicaciones."
};

export default function Arrepentimiento() {
  return (
    <PaginaLegal titulo="Botón de arrepentimiento" actual="/arrepentimiento">
      <p>
        Tenés <b>10 días corridos</b> desde que recibís el producto (o desde que confirmaste el pedido, si todavía
        no te lo entregamos) para cancelar la compra, sin dar explicaciones y sin costo. Completá este formulario y
        te damos un código de trámite al instante. Te contactamos dentro de las 24 horas.
      </p>
      <Seccion titulo="Pedí la cancelación">
        <FormularioArrepentimiento />
      </Seccion>
    </PaginaLegal>
  );
}
