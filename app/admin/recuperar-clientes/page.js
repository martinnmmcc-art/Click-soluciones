"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import { supabase } from "@/lib/supabaseClient";
import { formatPrice } from "@/lib/whatsapp";

function telefonoWhatsapp(tel) {
  let n = (tel || "").replace(/\D/g, "");
  if (n.startsWith("54")) n = n.slice(2);
  if (n.startsWith("9")) n = n.slice(1);
  return `549${n}`;
}

const FILTROS = [
  { id: "todos", label: "Todos" },
  { id: "sin_cuenta", label: "Sin cuenta" },
  { id: "dormidos", label: "Hace +15 días" },
  { id: "vip", label: "Los que más gastaron" }
];

function RecuperarClientes() {
  const [clientes, setClientes] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("todos");
  const [trabajandoEn, setTrabajandoEn] = useState(null);

  async function cargar() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/recuperar-clientes", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setClientes(data.clientes || []);
        setResumen(data.resumen);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  // Crea la cuenta del cliente y abre WhatsApp con su link de acceso.
  async function darDeAlta(c) {
    setTrabajandoEn(c.telefono);
    try {
      const { data, error } = await supabase.rpc("admin_crear_cuenta_cliente", {
        p_telefono: c.telefono,
        p_nombre: c.nombre,
        p_localidad: c.localidad || "",
        p_dias_acceso: 365
      });

      if (error || !data || data.length === 0) {
        alert("No se pudo crear la cuenta: " + (error?.message || "error desconocido"));
        return;
      }

      const { token } = data[0];
      const link = `https://www.bolsonclick.com.ar/login?acceso=${token}`;

      const mensaje =
        `¡Hola ${c.nombre}! 👋 Soy de Bolson Click.\n\n` +
        `Te armé tu cuenta así ves tus compras y te enterás primero cuando llega mercadería nueva 🛍️\n\n` +
        `Entrá con este link, ya quedás adentro sin poner contraseña:\n${link}\n\n` +
        `Tip: una vez adentro, tocá el menú del navegador y elegí "Instalar app" para tenerla en el celu.`;

      window.open(
        `https://wa.me/${telefonoWhatsapp(c.telefono)}?text=${encodeURIComponent(mensaje)}`,
        "_blank"
      );

      cargar();
    } catch (e) {
      alert("Ocurrió un error: " + e.message);
    } finally {
      setTrabajandoEn(null);
    }
  }

  // Mensaje pensado según hace cuánto no compra y qué se había llevado.
  function mensajeRecompra(c) {
    const productoPrevio = c.productos?.[0];
    const primerNombre = (c.nombre || "").split(" ")[0];

    if (c.diasSinComprar >= 30) {
      return (
        `¡Hola ${primerNombre}! 👋 ¿Cómo va todo?\n\n` +
        `Hace un tiempo que no nos cruzamos. Llegó mercadería nueva a Bolson Click ` +
        `y me acordé de vos 🛍️\n\n` +
        `Pasá a ver: https://www.bolsonclick.com.ar`
      );
    }

    if (productoPrevio) {
      return (
        `¡Hola ${primerNombre}! 👋 ¿Qué tal salió ${productoPrevio.toLowerCase()}?\n\n` +
        `Te cuento que llegaron cosas nuevas que te pueden servir 🛍️\n` +
        `https://www.bolsonclick.com.ar`
      );
    }

    return (
      `¡Hola ${primerNombre}! 👋 Llegó mercadería nueva a Bolson Click 🛍️\n` +
      `Pasá a ver: https://www.bolsonclick.com.ar`
    );
  }

  const filtrados = clientes.filter((c) => {
    if (filtro === "sin_cuenta") return !c.tieneCuenta;
    if (filtro === "dormidos") return c.diasSinComprar >= 15;
    if (filtro === "vip") return c.gastado >= 20000;
    return true;
  });

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <Link href="/admin" className="text-sm text-brand-blue font-medium">
          ← Panel
        </Link>
        <h1 className="text-2xl font-extrabold text-gray-800 mt-1 mb-1">
          Hacer volver clientes
        </h1>
        <p className="text-xs text-gray-500 mb-4">
          Gente que ya te compró. Traerlos de vuelta cuesta mucho menos que conseguir uno nuevo.
        </p>

        {resumen && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white rounded-2xl p-4 border border-gray-100">
              <p className="text-gray-500 text-xs font-semibold">Sin cuenta</p>
              <p className="text-amber-600 text-xl font-extrabold mt-1">{resumen.sinCuenta}</p>
              <p className="text-gray-400 text-[11px] mt-0.5">No podés avisarles nada</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-gray-100">
              <p className="text-gray-500 text-xs font-semibold">Volvieron a comprar</p>
              <p className="text-green-600 text-xl font-extrabold mt-1">
                {resumen.recompraron}
                <span className="text-gray-400 text-sm font-bold">/{resumen.total}</span>
              </p>
              <p className="text-gray-400 text-[11px] mt-0.5">
                {Math.round((resumen.recompraron / Math.max(resumen.total, 1)) * 100)}% de recompra
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-3">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${
                filtro === f.id
                  ? "bg-brand-blue text-white"
                  : "bg-white text-gray-600 border border-gray-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-center text-gray-400 py-10">Cargando...</p>
        ) : filtrados.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center text-gray-500 text-sm border border-gray-100">
            No hay clientes en esta categoría.
          </div>
        ) : (
          <div className="space-y-2">
            {filtrados.map((c) => (
              <div key={c.telefono} className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-gray-800">
                      {c.nombre}
                      {c.compras > 1 && (
                        <span className="ml-1.5 text-[10px] bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full font-extrabold">
                          REPITIÓ
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">{c.telefono}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {c.compras} compra{c.compras === 1 ? "" : "s"} · ${formatPrice(c.gastado)} en total
                    </p>
                    <p
                      className={`text-[11px] font-bold mt-0.5 ${
                        c.diasSinComprar >= 30
                          ? "text-red-600"
                          : c.diasSinComprar >= 15
                          ? "text-amber-600"
                          : "text-gray-400"
                      }`}
                    >
                      {c.diasSinComprar === 0
                        ? "Compró hoy"
                        : `Hace ${c.diasSinComprar} día${c.diasSinComprar === 1 ? "" : "s"} que no compra`}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {!c.tieneCuenta && (
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
                        sin cuenta
                      </span>
                    )}
                    {c.tieneCuenta && !c.recibeAvisos && (
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
                        sin avisos
                      </span>
                    )}
                    {c.recibeAvisos && (
                      <span className="text-[10px] bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
                        🔔 recibe avisos
                      </span>
                    )}
                  </div>
                </div>

                {c.productos?.length > 0 && (
                  <p className="text-[11px] text-gray-400 mt-1.5 line-clamp-1">
                    Se llevó: {c.productos.slice(0, 2).join(", ")}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 mt-3">
                  {!c.tieneCuenta ? (
                    <button
                      onClick={() => darDeAlta(c)}
                      disabled={trabajandoEn === c.telefono}
                      className="bg-brand-blue text-white text-xs font-bold px-3 py-2 rounded-xl disabled:opacity-50"
                    >
                      {trabajandoEn === c.telefono
                        ? "Creando..."
                        : "✨ Crear cuenta y enviar acceso"}
                    </button>
                  ) : (
                    <a
                      href={`https://wa.me/${telefonoWhatsapp(c.telefono)}?text=${encodeURIComponent(
                        mensajeRecompra(c)
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-emerald-600 text-white text-xs font-bold px-3 py-2 rounded-xl"
                    >
                      💬 Invitar a volver
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-blue-50/50 border border-blue-200 rounded-2xl p-4 mt-6">
          <p className="text-xs font-bold text-gray-700 mb-1">Cómo aprovechar esto</p>
          <ul className="text-[11px] text-gray-600 space-y-1 list-disc pl-4">
            <li>
              Empezá por los de <b>&quot;Sin cuenta&quot;</b> que más gastaron: crearles la cuenta
              te habilita a avisarles cada vez que llega mercadería.
            </li>
            <li>
              El mensaje ya viene escrito y menciona lo que se llevaron, que es lo que hace
              que no parezca publicidad.
            </li>
            <li>
              No escribas a todos el mismo día: 3 o 4 por vez alcanza, y podés atender bien
              a los que respondan.
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}

export default function RecuperarClientesPage() {
  return (
    <AdminGuard>
      <RecuperarClientes />
    </AdminGuard>
  );
}
