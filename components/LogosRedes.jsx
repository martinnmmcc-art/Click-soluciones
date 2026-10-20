import { FaInstagram, FaFacebookF, FaWhatsapp } from "react-icons/fa";
import { NEGOCIO, linkWhatsApp } from "@/lib/config";

// Logos con los colores reales de cada red, para que se reconozcan de un
// vistazo: el cuadrado con degradé de Instagram, el círculo azul de Facebook
// y el verde de WhatsApp. Un emoji 📸 o 📘 no se asocia con la red.

export function LogoInstagram({ size = 28, className = "" }) {
  return (
    <span
      className={`inline-flex items-center justify-center text-white flex-shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background:
          "radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%)"
      }}
      aria-hidden="true"
    >
      <FaInstagram style={{ width: size * 0.66, height: size * 0.66 }} />
    </span>
  );
}

export function LogoFacebook({ size = 28, className = "" }) {
  return (
    <span
      className={`inline-flex items-end justify-center text-white flex-shrink-0 rounded-full overflow-hidden ${className}`}
      style={{ width: size, height: size, background: "#1877F2" }}
      aria-hidden="true"
    >
      <FaFacebookF style={{ width: size * 0.56, height: size * 0.8, marginBottom: -size * 0.04 }} />
    </span>
  );
}

export function LogoWhatsApp({ size = 18, className = "" }) {
  return <FaWhatsapp className={className} style={{ width: size, height: size }} aria-hidden="true" />;
}

// "2944396888" → "294 439-6888": así se lee y se recuerda más fácil
export function telefonoLegible(tel = NEGOCIO.telefono) {
  const d = String(tel || "").replace(/\D/g, "");
  if (d.length === 10) return `${d.slice(0, 3)} ${d.slice(3, 6)}-${d.slice(6)}`;
  return d;
}

export const ENLACES = {
  instagram: NEGOCIO.instagram,
  facebook: NEGOCIO.facebook,
  whatsapp: linkWhatsApp("¡Hola Bolson Click! Quería hacer una consulta 🙂")
};
