import { NEGOCIO } from "@/lib/config";
import { LogoInstagram, LogoFacebook, LogoWhatsApp, telefonoLegible, ENLACES } from "@/components/LogosRedes";

// Enlaces a las redes del negocio, con los logos reales. Cada seguidor nuevo
// es alguien que va a ver tus próximas promociones sin que tengas que
// mandárselas una por una.
export default function RedesSociales({ titulo = "Seguinos en redes", compacto = false, conWhatsApp = false }) {
  const redes = [
    NEGOCIO.instagram && {
      href: NEGOCIO.instagram,
      nombre: "Instagram",
      detalle: NEGOCIO.instagramUsuario ? `@${NEGOCIO.instagramUsuario}` : "Instagram",
      logo: <LogoInstagram size={34} />
    },
    NEGOCIO.facebook && {
      href: NEGOCIO.facebook,
      nombre: "Facebook",
      detalle: "Bolson Click",
      logo: <LogoFacebook size={34} />
    },
    conWhatsApp && {
      href: ENLACES.whatsapp,
      nombre: "WhatsApp",
      detalle: telefonoLegible(),
      logo: (
        <span className="w-[34px] h-[34px] rounded-full bg-[#25D366] text-white flex items-center justify-center flex-shrink-0">
          <LogoWhatsApp size={20} />
        </span>
      )
    }
  ].filter(Boolean);

  if (redes.length === 0) return null;

  return (
    <div className={compacto ? "" : "card p-4"}>
      {titulo && <p className="text-sm font-bold text-gray-800 mb-1">{titulo}</p>}
      {!compacto && (
        <p className="text-xs text-gray-500 mb-3">
          Novedades, ofertas y lo que llega en el próximo pedido.
        </p>
      )}
      <div className={`grid gap-2 ${redes.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2"}`}>
        {redes.map((r) => (
          <a
            key={r.nombre}
            href={r.href}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 flex items-center gap-2.5 active:scale-[0.98] transition"
          >
            {r.logo}
            <span className="leading-tight min-w-0">
              <span className="block text-xs font-bold text-gray-800">{r.nombre}</span>
              <span className="block text-[11px] text-gray-500 truncate">{r.detalle}</span>
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
