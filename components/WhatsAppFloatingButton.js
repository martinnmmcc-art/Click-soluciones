"use client";

import { buildWhatsAppLink } from "@/lib/whatsapp";

export default function WhatsAppFloatingButton() {
  const link = buildWhatsAppLink(
    "Hola! Estoy viendo la tienda de Clic Soluciones y tengo una consulta."
  );

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-20 right-4 z-40 md:bottom-6 bg-[#25D366] text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-2xl hover:scale-105 transition-transform"
      aria-label="Consultar por WhatsApp"
    >
      💬
    </a>
  );
}
