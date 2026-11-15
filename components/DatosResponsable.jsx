import { NEGOCIO } from "@/lib/config";

// Quién está detrás de la tienda. Lo exige la Ley de Defensa del Consumidor
// (Ley 24.240) y la de Datos Personales (Ley 25.326): el cliente tiene que
// saber con quién compra y a quién reclamarle.

export function telefonoLindo(tel) {
  const n = String(tel || "").replace(/\D/g, "");
  return n.length === 10 ? `${n.slice(0, 3)} ${n.slice(3, 6)}-${n.slice(6)}` : n;
}

export default function DatosResponsable() {
  return (
    <ul className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm space-y-1">
      <li>
        <b>Comercio:</b> {NEGOCIO.nombre}
      </li>
      <li>
        <b>Responsable:</b> {NEGOCIO.responsable}
      </li>
      {NEGOCIO.cuit && (
        <li>
          <b>CUIT:</b> {NEGOCIO.cuit}
        </li>
      )}
      <li>
        <b>Domicilio:</b> {NEGOCIO.domicilio || `${NEGOCIO.localidad}, ${NEGOCIO.provincia}, Argentina`}
      </li>
      <li>
        <b>WhatsApp:</b>{" "}
        <a href={`https://wa.me/${NEGOCIO.whatsapp}`} className="text-brand-blue underline underline-offset-2">
          {telefonoLindo(NEGOCIO.telefono)}
        </a>
      </li>
      {NEGOCIO.email && (
        <li>
          <b>Correo:</b>{" "}
          <a href={`mailto:${NEGOCIO.email}`} className="text-brand-blue underline underline-offset-2">
            {NEGOCIO.email}
          </a>
        </li>
      )}
      <li>
        <b>Sitio:</b> {NEGOCIO.web}
      </li>
    </ul>
  );
}
