import Link from "next/link";

export default function BannerOfertas() {
  return (
    <Link href="/catalogo?categoria=ofertas" className="block px-4 mt-4">
      <div className="rounded-2xl bg-gradient-to-r from-brand-orange to-brand-orangeDark p-5 text-white shadow-md flex items-center justify-between overflow-hidden relative">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide opacity-90">
            Ofertas de la semana
          </p>
          <p className="text-xl font-extrabold mt-1">Hasta 30% OFF</p>
          <p className="text-sm mt-1 opacity-90">
            En iluminación, cocina y organización
          </p>
        </div>
        <div className="text-5xl opacity-80">🔥</div>
      </div>
    </Link>
  );
}
