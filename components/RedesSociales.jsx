import { NEGOCIO } from "@/lib/config";

// Enlaces a las redes del negocio. Cada seguidor nuevo es alguien que va a
// ver tus próximas promociones sin que tengas que mandárselas una por una.
export default function RedesSociales({ titulo = "Seguinos en redes", compacto = false }) {
  const redes = [
    NEGOCIO.instagram && {
      href: NEGOCIO.instagram,
      nombre: "Instagram",
      detalle: NEGOCIO.instagramUsuario ? `@${NEGOCIO.instagramUsuario}` : "Instagram",
      icono: "📸",
      color: "bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#8134AF]"
    },
    NEGOCIO.facebook && {
      href: NEGOCIO.facebook,
      nombre: "Facebook",
      detalle: "Bolson Click",
      icono: "📘",
      color: "bg-[#1877F2]"
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
      <div className="grid grid-cols-2 gap-2">
        {redes.map((r) => (
          <a
            key={r.nombre}
            href={r.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`${r.color} text-white rounded-xl px-3 py-2.5 flex items-center gap-2`}
          >
            <span className="text-xl">{r.icono}</span>
            <span className="leading-tight min-w-0">
              <span className="block text-xs font-bold">{r.nombre}</span>
              <span className="block text-[10px] opacity-90 truncate">{r.detalle}</span>
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
