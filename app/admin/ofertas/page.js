"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import { supabase } from "@/lib/supabaseClient";
import { formatPrice } from "@/lib/whatsapp";

const PRESETS = [
  { horas: 24, label: "Solo por hoy", titulo: "SOLO POR HOY" },
  { horas: 48, label: "2 días", titulo: "OFERTA 48 HORAS" },
  { horas: 72, label: "Fin de semana", titulo: "OFERTA FIN DE SEMANA" },
  { horas: 168, label: "1 semana", titulo: "SEMANA DE OFERTAS" }
];

const PORCENTAJES = [10, 15, 20, 25, 30];

function Ofertas() {
  const [campana, setCampana] = useState(null);
  const [productos, setProductos] = useState([]);
  const [productosEnOferta, setProductosEnOferta] = useState([]);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);

  const [porcentaje, setPorcentaje] = useState(20);
  const [preset, setPreset] = useState(PRESETS[0]);
  const [mensaje, setMensaje] = useState("");
  const [alcance, setAlcance] = useState("parados"); // parados | todos | elegidos
  const [elegidos, setElegidos] = useState([]);
  const [busqueda, setBusqueda] = useState("");

  async function cargar() {
    setLoading(true);

    // Traemos también cuánto se vendió cada uno: es lo que permite
    // detectar la mercadería parada, que es la que más conviene liquidar.
    const [{ data: vigente }, { data: prods }, { data: enOferta }] = await Promise.all([
      supabase.rpc("campana_vigente"),
      supabase.rpc("productos_para_oferta"),
      supabase
        .from("Productos")
        .select("id, nombre, precio, precio_oferta, campana_id")
        .not("campana_id", "is", null)
    ]);

    setProductosEnOferta(enOferta || []);

    setCampana(vigente?.[0] || null);
    setProductos(prods || []);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  const conStock = productos.filter((p) => Number(p.stock || 0) > 0);

  // Productos parados: tienen stock pero nunca se vendieron. Son los que
  // más conviene mover: ocupan plata sin generar nada.
  const parados = conStock.filter((p) => Number(p.vendidos || 0) === 0);

  const afectados =
    alcance === "todos"
      ? conStock
      : alcance === "parados"
      ? parados
      : conStock.filter((p) => elegidos.includes(p.id));

  const listaVisible = conStock.filter(
    (p) => !busqueda.trim() || p.nombre?.toLowerCase().includes(busqueda.toLowerCase())
  );

  function alternar(id) {
    setElegidos((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  // Cuánto resignás en total si se vendiera todo lo que está en oferta
  const resignado = afectados.reduce(
    (acc, p) => acc + Number(p.precio) * (porcentaje / 100) * Math.max(Number(p.stock || 0), 0),
    0
  );

  async function lanzar() {
    const texto =
      `¿Lanzar ${porcentaje}% de descuento en ${afectados.length} productos?\n\n` +
      `Dura ${preset.label.toLowerCase()} y después los precios vuelven solos a lo normal.\n\n` +
      `Si se vendiera todo el stock en oferta, resignás $${formatPrice(resignado)} de facturación.`;

    if (!confirm(texto)) return;

    setProcesando(true);
    try {
      const { data, error } = await supabase.rpc("aplicar_campana", {
        p_titulo: preset.titulo,
        p_porcentaje: porcentaje,
        p_horas: preset.horas,
        p_mensaje: mensaje.trim() || null,
        p_solo_con_stock: true,
        // Si es "todos" mandamos null y la base los toma a todos;
        // si no, mandamos exactamente los que elegiste.
        p_ids: alcance === "todos" ? null : afectados.map((p) => p.id)
      });

      if (error) throw new Error(error.message);

      alert(`✓ Oferta activa en ${data?.[0]?.productos || 0} productos.`);
      cargar();
    } catch (e) {
      alert("No se pudo lanzar: " + e.message);
    } finally {
      setProcesando(false);
    }
  }

  async function terminar() {
    if (!confirm("¿Terminar la oferta ahora?\n\nLos precios vuelven a la normalidad enseguida."))
      return;

    setProcesando(true);
    try {
      const { error } = await supabase.rpc("terminar_campanas_activas");
      if (error) throw new Error(error.message);
      cargar();
    } catch (e) {
      alert("No se pudo terminar: " + e.message);
    } finally {
      setProcesando(false);
    }
  }

  function tiempoRestante(hasta) {
    const ms = new Date(hasta) - new Date();
    if (ms <= 0) return "terminada";
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}min` : `${m} minutos`;
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/admin" className="text-sm text-brand-blue font-medium">
          ← Panel
        </Link>
        <h1 className="text-2xl font-extrabold text-gray-800 mt-1 mb-1">Ofertas</h1>
        <p className="text-xs text-gray-500 mb-4">
          Descuento por tiempo limitado. Elegís a qué productos se aplica.
        </p>

        {loading ? (
          <p className="text-center text-gray-400 py-10">Cargando...</p>
        ) : campana ? (
          <>
            <div className="bg-gradient-to-br from-red-500 to-red-700 rounded-2xl p-5 text-white mb-4">
              <p className="text-xs font-bold opacity-90">OFERTA ACTIVA</p>
              <p className="text-2xl font-extrabold mt-1">
                {campana.porcentaje}% OFF · {campana.titulo}
              </p>
              <p className="text-sm mt-2 opacity-95">
                ⏰ Termina en {tiempoRestante(campana.termina)}
              </p>
              <p className="text-[11px] opacity-80 mt-1">
                {productosEnOferta.length} productos con precio rebajado
              </p>

              <button
                onClick={terminar}
                disabled={procesando}
                className="w-full bg-white text-red-700 text-sm font-bold py-2.5 rounded-xl mt-4 disabled:opacity-50"
              >
                {procesando ? "..." : "Terminar la oferta ahora"}
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="font-bold text-sm text-gray-800 mb-2">Productos en oferta</p>
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {productosEnOferta.map((p) => (
                    <div
                      key={p.id}
                      className="flex justify-between items-center text-xs border-b border-gray-50 pb-1.5"
                    >
                      <span className="flex-1 text-gray-700 line-clamp-1 pr-2">
                        {p.nombre}
                      </span>
                      <span className="whitespace-nowrap">
                        <span className="text-gray-400 line-through">
                          ${formatPrice(p.precio)}
                        </span>{" "}
                        <b className="text-red-600">${formatPrice(p.precio_oferta)}</b>
                      </span>
                    </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">
                1. Cuánto descuento
              </p>
              <div className="flex gap-2 mb-4">
                {PORCENTAJES.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPorcentaje(p)}
                    className={`flex-1 py-3 rounded-xl text-sm font-extrabold ${
                      porcentaje === p
                        ? "bg-red-600 text-white"
                        : "bg-gray-50 text-gray-600 border border-gray-200"
                    }`}
                  >
                    {p}%
                  </button>
                ))}
              </div>

              <p className="text-xs font-bold text-gray-500 uppercase mb-2">
                2. Cuánto dura
              </p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {PRESETS.map((pr) => (
                  <button
                    key={pr.horas}
                    onClick={() => setPreset(pr)}
                    className={`py-2.5 rounded-xl text-xs font-bold ${
                      preset.horas === pr.horas
                        ? "bg-brand-blue text-white"
                        : "bg-gray-50 text-gray-600 border border-gray-200"
                    }`}
                  >
                    {pr.label}
                  </button>
                ))}
              </div>

              <p className="text-xs font-bold text-gray-500 uppercase mb-2">
                3. A qué productos
              </p>

              <div className="space-y-2 mb-3">
                <button
                  onClick={() => setAlcance("parados")}
                  className={`w-full text-left p-3 rounded-xl border-2 ${
                    alcance === "parados"
                      ? "border-brand-blue bg-blue-50"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <p className="text-sm font-bold text-gray-800">
                    😴 Los que no se venden ({parados.length})
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Tienen stock pero nunca se vendieron. Son los que más
                    conviene mover: ocupan plata sin generar nada.
                  </p>
                </button>

                <button
                  onClick={() => setAlcance("elegidos")}
                  className={`w-full text-left p-3 rounded-xl border-2 ${
                    alcance === "elegidos"
                      ? "border-brand-blue bg-blue-50"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <p className="text-sm font-bold text-gray-800">
                    ✋ Elijo yo ({elegidos.length} elegidos)
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Marcás uno por uno cuáles entran en la oferta
                  </p>
                </button>

                <button
                  onClick={() => setAlcance("todos")}
                  className={`w-full text-left p-3 rounded-xl border-2 ${
                    alcance === "todos"
                      ? "border-brand-blue bg-blue-50"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <p className="text-sm font-bold text-gray-800">
                    🏷️ Todos los que tengo ({conStock.length})
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Para liquidaciones o fechas especiales
                  </p>
                </button>
              </div>

              {/* LISTA PARA ELEGIR */}
              {alcance === "elegidos" && (
                <div className="border border-gray-200 rounded-xl p-3 mb-3">
                  <input
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mb-2"
                    placeholder="🔍 Buscar producto..."
                  />

                  <div className="flex gap-3 mb-2">
                    <button
                      onClick={() => setElegidos(parados.map((p) => p.id))}
                      className="text-[11px] font-bold text-brand-blue"
                    >
                      Marcar los {parados.length} parados
                    </button>
                    <button
                      onClick={() => setElegidos([])}
                      className="text-[11px] font-bold text-red-500"
                    >
                      Ninguno
                    </button>
                  </div>

                  <div className="max-h-72 overflow-y-auto space-y-1">
                    {listaVisible.map((p) => {
                      const parado = Number(p.vendidos || 0) === 0;
                      return (
                        <label
                          key={p.id}
                          className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer ${
                            elegidos.includes(p.id) ? "bg-blue-50" : "hover:bg-gray-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={elegidos.includes(p.id)}
                            onChange={() => alternar(p.id)}
                            className="mt-0.5 flex-shrink-0"
                          />
                          <span className="flex-1 min-w-0">
                            <span className="text-xs text-gray-800 block line-clamp-2 leading-tight">
                              {p.nombre}
                            </span>
                            <span className="text-[10px] text-gray-500">
                              ${formatPrice(p.precio)} · stock {p.stock}
                              {parado ? (
                                <span className="text-amber-700 font-bold">
                                  {" "}· 😴 nunca se vendió
                                </span>
                              ) : (
                                <span className="text-green-700">
                                  {" "}· vendidos {p.vendidos}
                                </span>
                              )}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mb-3">
                <label className="text-xs font-bold text-gray-600 block mb-1">
                  Mensaje del cartel (opcional)
                </label>
                <input
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                  placeholder="Ej: Aprovechá, envíos gratis en El Bolsón"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
                <p className="text-xs font-bold text-amber-900">
                  Se aplica a {afectados.length} producto{afectados.length === 1 ? "" : "s"}
                </p>
                <p className="text-[11px] text-amber-800 mt-1">
                  Si vendieras todo ese stock con el descuento, resignás{" "}
                  <b>${formatPrice(resignado)}</b> de facturación.
                </p>
                {alcance === "parados" && parados.length > 0 && (
                  <p className="text-[11px] text-amber-800 mt-1">
                    Hoy tenés{" "}
                    <b>
                      $
                      {formatPrice(
                        parados.reduce((a, p) => a + Number(p.plata_parada || 0), 0)
                      )}
                    </b>{" "}
                    inmovilizados en esta mercadería.
                  </p>
                )}
              </div>

              <button
                onClick={lanzar}
                disabled={procesando || afectados.length === 0}
                className="w-full bg-red-600 text-white text-sm font-extrabold py-3 rounded-xl disabled:opacity-50"
              >
                {procesando ? "Aplicando..." : `Lanzar ${porcentaje}% OFF`}
              </button>
            </div>

            <div className="bg-blue-50/50 border border-blue-200 rounded-2xl p-4">
              <p className="text-xs font-bold text-gray-700 mb-1">Cómo usarlo bien</p>
              <ul className="text-[11px] text-gray-600 space-y-1 list-disc pl-4">
                <li>
                  Los precios vuelven solos cuando termina el plazo. No tenés que
                  acordarte de nada.
                </li>
                <li>
                  Al cliente le aparece un cartel en la app y en cada producto ve
                  el precio anterior tachado.
                </li>
                <li>
                  <b>No la uses seguido:</b> si hay oferta todos los meses, la
                  gente deja de comprar a precio normal y espera la próxima.
                </li>
                <li>
                  Después de lanzarla, mandá la promoción por WhatsApp desde
                  &quot;Promocionar producto&quot;.
                </li>
              </ul>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default function OfertasPage() {
  return (
    <AdminGuard>
      <Ofertas />
    </AdminGuard>
  );
}
