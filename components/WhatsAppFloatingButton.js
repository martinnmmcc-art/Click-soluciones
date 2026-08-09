"use client";

import { FaWhatsapp } from "react-icons/fa";

export default function WhatsAppFloatingButton() {
  const telefono = "5492944396888";

  const mensaje = encodeURIComponent(
`Hola! 👋

Te escribo desde la app de *Bolson Click*.

Quisiera recibir información sobre sus productos.

Muchas gracias 🙌`
  );

  const link = `https://wa.me/${telefono}?text=${mensaje}`;

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-20 right-4 z-40 md:bottom-6 bg-[#25D366] text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center hover:scale-110 hover:shadow-xl transition-all duration-300"
      aria-label="Consultar por WhatsApp"
    >
      <FaWhatsapp size={28} />
    </a>
  );
}
