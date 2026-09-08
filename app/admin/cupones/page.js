"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import { supabase } from "@/lib/supabaseClient";
import { formatPrice } from "@/lib/whatsapp";

function wa(tel) {
  let n = (tel || "").replace(/\D/g, "");
  if (n.startsWith("54")) n = n.slice(2);
  if (n.startsWith("9")) n = n.slice(1);
  return `549${n}`;
}

const MOTIVOS = {
  carrito: { label: "Carrito abandonado", icono: "🛒" },
  favorito: { label: "Favorito en oferta", icono: "⭐" },
  bienvenida: { label: "Primera compra", icono: "👋" },
  manual: { label: "Creado a mano", icono: "🎁" }
};

function Cupones() {
  const [cupones, setCupones] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState("activos");
  const [creando, setCreando] = useState(false);

  // Formulario de cupón nuevo
  const [busqueda, setBusqueda] = useState("");
  const [elegido, setElegido] = useState(null);
  const [porcentaje, setPorcentaje] = useState(10);
  const [dias, setDias] = useState(7);
  const [segundo, setSegundo] = useState(0);
  const [minimo, setMinimo] = useState(0);
  const [generando, setGenerando] = useState(false);

  async function cargar() {
    setLoading(true);
    const [c, cl] = await Promise.all([
      supabase.from("cupones").select("*").order("created_at", { ascending: false }),
      supabase.from("clientes").select("telefono, nombre, localidad").order("nombre")
    ]);
    setCupones(c.data || []);
    setClientes(cl.data || []);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function crear() {
    if (!elegido) return;

    setGenerando(true);
    try {
      const { data, error } = await supabase.rpc("generar_cupon", {
        p_telefono: elegido.telefono,
        p_motivo: "manual",
        p_porcentaje: Number(porcentaje),
        p_dias: Number(dias),
        p_porcentaje_segundo: Number(segundo) || 0,
        p_minimo: Number(minimo) || 0
      });

      if (error || !data?.[0]) {
        alert("No se pudo crear: " + (error?.message || ""));
        return;
      }

      const cupon = data[0];

      if (cupon.ya_existia) {
        alert(
          `Este cliente ya tenía un cupón vigente: ${cupon.codigo}\n\n` +
            "No creamos otro para que no acumule descuentos."
        );
      }

      const vence = new Date(cupon.vence_en).toLocaleDateString("es-AR");
      const nombre = (elegido.nombre || "").split(" ")[0];

      fetch("/api/avisar-cupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telefono: elegido.telefono,
          codigo: cupon.codigo,
          porcentaje: Number(porcentaje),
          vence_en: cupon.vence_en,
          motivo: "manual"
        })
      }).catch(() => {});

      const mensaje =
        `¡Hola ${nombre}! 👋 Soy de Bolson Click.\n\n` +
        `Te preparé un descuento especial 🎁\n\n` +
        `🎟️ Código: *${cupon.codigo}*\n` +
        `💰 ${porcentaje}% off en tu compra\n` +
        (Number(segundo) > 0
          ? `🎉 Y ${segundo}% si llevás 2 productos o más\n`
          : "") +
        (Number(minimo) > 0
          ? `🛒 En compras desde $${Number(minimo).toLocaleString("es-AR")}\n`
          : "") +
        `⏰ Válido hasta el ${vence}\n\n` +
        `Es solo para vos y por única vez. Ponelo al finalizar la compra:\n` +
        `https://www.bolsonclick.com.ar`;

      window.open(
        `https://wa.me/${wa(elegido.telefono)}?text=${encodeURIComponent(mensaje)}`,
        "_blank"
      );

      setCreando(false);
      setElegido(null);
      setBusqueda("");
      cargar();
    } finally {
      setGenerando(false);
    }
  }

  async function anular(c) {
    if (!confirm(`¿Anular el cupón ${c.codigo}?\n\nEl cliente ya no va a poder usarlo.`))
      return;

    const { error } = await supabase.from("cupones").delete().eq("id", c.id);
    if (error) {
      alert("No se pudo anular: " + error.message);
      return;
    }
    cargar();
  }

  const ahora = new Date();
  const activos = cupones.filter((c) => !c.usado_en && new Date(c.vence_en) > ahora);
  const usados = cupones.filter((c) => c.usado_en);
  const vencidos = cupones.filter((c) => !c.usado_en && new Date(c.vence_en) <= ahora);

  const lista =
    vista === "activos" ? activos : vista === "usados" ? usados : vencidos;

  const sugerencias = busqueda.trim().length >= 2
    ? clientes
        .filter(
          (c) =>
            c.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
            c.telefono?.includes(busqueda.replace(/\D/g, ""))
        )
        .slice(0, 6)
    : [];

  // Cuánto descuento entregaste realmente
  const descontado = usados.length;

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/admin" className="text-sm text-brand-blue font-medium">
          ← Panel
        </Link>
        <h1 className="text-2xl font-extrabold text-gray-800 mt-1 mb-1">Cupones</h1>
        <p className="text-xs text-gray-500 mb-4">
          Descuentos personales, de un solo uso y con vencimiento.
        </p>

        <div className="grid grid-cols-3 gap-2 mb-4 text-center">
          <div className="bg-white rounded-xl p-3 border border-gray-100">
            <p className="text-xl font-extrabold text-green-600">{activos.length}</p>
            <p className="text-[10px] text-gray-500">activos</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-gray-100">
            <p className="text-xl font-extrabold text-brand-blue">{descontado}</p>
            <p className="text-[10px] text-gray-500">usados</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-gray-100">
            <p className="text-xl font-extrabold text-gray-400">{vencidos.length}</p>
            <p className="text-[10px] text-gray-500">vencidos</p>
          </div>
        </div>

        {!creando ? (
          <button
            onClick={() => setCreando(true)}
            className="w-full bg-brand-blue text-white text-sm font-bold py-3 rounded-xl mb-4"
          >
            🎁 Crear cupón para un cliente
          </button>
        ) : (
          <div className="bg-white rounded-2xl border-2 border-brand-blue p-4 mb-4">
            <p className="font-bold text-sm text-gray-800 mb-2">Cupón nuevo</p>

            {elegido ? (
              <div className="bg-blue-50 rounded-xl p-2.5 mb-3 flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-gray-800">{elegido.nombre}</p>
                  <p className="text-[11px] text-gray-500">{elegido.telefono}</p>
                </div>
                <button
                  onClick={() => setElegido(null)}
                  className="text-[11px] font-semibold text-gray-500"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="mb-3">
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="input-field"
                  placeholder="Buscar cliente por nombre o celular..."
                  autoFocus
                />
                {sugerencias.length > 0 && (
                  <div className="border border-gray-200 rounded-lg mt-1 overflow-hidden">
                    {sugerencias.map((c) => (
                      <button
                        key={c.telefono}
                        onClick={() => setElegido(c)}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-0"
                      >
                        <p className="text-xs font-semibold text-gray-800">{c.nombre}</p>
                        <p className="text-[11px] text-gray-500">{c.telefono}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <label className="text-[11px] font-bold text-gray-600 block mb-1">
                  Descuento
                </label>
                <select
                  value={porcentaje}
                  onChange={(e) => setPorcentaje(e.target.value)}
                  className="input-field text-sm"
                >
                  {[5, 10, 15, 20, 25, 30].map((p) => (
                    <option key={p} value={p}>
                      {p}%
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-600 block mb-1">
                  Válido por
                </label>
                <select
                  value={dias}
                  onChange={(e) => setDias(e.target.value)}
                  className="input-field text-sm"
                >
                  <option value={3}>3 días</option>
                  <option value={5}>5 días</option>
                  <option value={7}>1 semana</option>
                  <option value={15}>15 días</option>
                  <option value={30}>1 mes</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-600 block mb-1">
                  Si lleva 2 o más
                </label>
                <select
                  value={segundo}
                  onChange={(e) => setSegundo(e.target.value)}
                  className="input-field text-sm"
                >
                  <option value={0}>Sin extra</option>
                  {[10, 15, 20, 25].map((p) => (
                    <option key={p} value={p}>
                      {p}%
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-600 block mb-1">
                  Compra mínima
                </label>
                <input
                  type="number"
                  value={minimo}
                  onChange={(e) => setMinimo(e.target.value)}
                  className="input-field text-sm"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-3">
              <button
                onClick={crear}
                disabled={!elegido || generando}
                className="flex-1 bg-brand-blue text-white text-xs font-bold py-2.5 rounded-xl disabled:opacity-50"
              >
                {generando ? "Creando..." : "Crear y enviar por WhatsApp"}
              </button>
              <button
                onClick={() => {
                  setCreando(false);
                  setElegido(null);
                }}
                className="px-3 text-xs font-semibold text-gray-500"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-3">
          {[
            { id: "activos", label: `Activos (${activos.length})` },
            { id: "usados", label: `Usados (${usados.length})` },
            { id: "vencidos", label: `Vencidos (${vencidos.length})` }
          ].map((v) => (
            <button
              key={v.id}
              onClick={() => setVista(v.id)}
              className={`flex-1 py-2 rounded-xl text-[11px] font-bold ${
                vista === v.id
                  ? "bg-gray-800 text-white"
                  : "bg-white text-gray-600 border border-gray-200"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-center text-gray-400 py-10">Cargando...</p>
        ) : lista.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center border border-gray-100">
            <p className="text-sm text-gray-600">No hay cupones en esta categoría.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {lista.map((c) => {
              const info = MOTIVOS[c.motivo] || MOTIVOS.manual;
              const cliente = clientes.find((x) => x.telefono === c.telefono);
              const horas = Math.floor(
                (new Date(c.vence_en) - ahora) / 3600000
              );

              return (
                <div key={c.id} className="bg-white rounded-2xl border border-gray-100 p-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-brand-blue">{c.codigo}</p>
                      <p className="text-xs font-semibold text-gray-800">
                        {cliente?.nombre || c.telefono}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {info.icono} {info.label} · {c.porcentaje}% off
                        {Number(c.porcentaje_segundo) > 0 &&
                          ` (${c.porcentaje_segundo}% con 2+)`}
                      </p>

                      {c.usado_en ? (
                        <p className="text-[11px] text-green-700 font-bold mt-0.5">
                          ✓ Usado el {new Date(c.usado_en).toLocaleDateString("es-AR")}
                        </p>
                      ) : horas > 0 ? (
                        <p
                          className={`text-[11px] font-bold mt-0.5 ${
                            horas < 48 ? "text-amber-600" : "text-gray-500"
                          }`}
                        >
                          ⏰ Vence en{" "}
                          {horas < 24
                            ? `${horas} horas`
                            : `${Math.floor(horas / 24)} día(s)`}
                        </p>
                      ) : (
                        <p className="text-[11px] text-gray-400 mt-0.5">Vencido</p>
                      )}

                      {Number(c.minimo_compra) > 0 && (
                        <p className="text-[10px] text-gray-400">
                          Desde ${formatPrice(c.minimo_compra)}
                        </p>
                      )}
                    </div>

                    {!c.usado_en && (
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <a
                          href={`https://wa.me/${wa(c.telefono)}?text=${encodeURIComponent(
                            `¡Hola! Te recuerdo tu cupón de Bolson Click 🎁\n\n` +
                              `🎟️ Código: *${c.codigo}*\n` +
                              `💰 ${c.porcentaje}% de descuento\n` +
                              `⏰ Vence el ${new Date(c.vence_en).toLocaleDateString("es-AR")}\n\n` +
                              `https://www.bolsonclick.com.ar`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg text-center"
                        >
                          💬 Recordar
                        </a>
                        <button
                          onClick={() => anular(c)}
                          className="text-[10px] font-bold text-red-500"
                        >
                          Anular
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

export default function CuponesPage() {
  return (
    <AdminGuard>
      <Cupones />
    </AdminGuard>
  );
}
