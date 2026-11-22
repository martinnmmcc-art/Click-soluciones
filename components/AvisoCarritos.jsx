"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { formatPrice } from "@/lib/whatsapp";

// Aviso arriba del panel: carritos que la gente dejó y a los que todavía
// no les escribiste. Es la plata más fácil de recuperar (a fines de noviembre
// había $138.000 en carritos sin que nadie los mirara).
export default function AvisoCarritos() {
  const [datos, setDatos] = useState(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const haceUnaHora = new Date(Date.now() - 3600000).toISOString();
        const { data } = await supabase
          .from("carritos_abandonados")
          .select("total")
          .eq("recuperado", false)
          .is("avisado_en", null)
          .lt("actualizado_en", haceUnaHora);
        if (!vivo || !data) return;
        const total = data.reduce((s, c) => s + Number(c.total || 0), 0);
        setDatos({ cantidad: data.length, total });
      } catch (e) {}
    })();
    return () => {
      vivo = false;
    };
  }, []);

  if (!datos || datos.cantidad === 0) return null;

  return (
    <Link
      href="/admin/oportunidades"
      className="block bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 mb-4"
    >
      <p className="font-bold text-amber-900">
        🛒 {datos.cantidad} carrito{datos.cantidad === 1 ? "" : "s"} sin escribir · ${formatPrice(datos.total)}
      </p>
      <p className="text-sm text-amber-800 mt-0.5">
        Gente registrada que dejó productos sin pedir. Tocá para escribirles por WhatsApp con un toque →
      </p>
    </Link>
  );
}
