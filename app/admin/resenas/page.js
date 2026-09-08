"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import { supabase } from "@/lib/supabaseClient";

function telefonoWhatsapp(tel) {
  let n = (tel || "").replace(/\D/g, "");
  if (n.startsWith("54")) n = n.slice(2);
  if (n.startsWith("9")) n = n.slice(1);
  return `549${n}`;
}

function Resenas() {
  const [pendientes, setPendientes] = useState([]);
  const [publicadas, setPublicadas] = useState([]);
  const [pendientesAprobar, setPendientesAprobar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState("aprobar");

  async function cargar() {
    setLoading(true);

    // Clientes con pedidos entregados que todavía no dejaron su opinión
    const { data: entregados } = await supabase
      .from("pedidos")
      .select("id, telefono_cliente, nombre_cliente, created_at, items_pedido(producto_id, nombre_producto)")
      .eq("estado", "entregado")
      .order("created_at", { ascending: false });

    const { data: yaOpinaron } = await supabase
      .from("resenas")
      .select("telefono, producto_id");

    const opinados = new Set(
      (yaOpinaron || []).map((r) => `${r.telefono}-${r.producto_id}`)
    );

    const lista = [];
    (entregados || []).forEach((p) => {
      (p.items_pedido || []).forEach((i) => {
        if (!i.producto_id) return;
        const clave = `${p.telefono_cliente}-${i.producto_id}`;
        if (opinados.has(clave)) return;
        if (lista.some((x) => x.clave === clave)) return;

        const dias = Math.floor(
          (Date.now() - new Date(p.created_at)) / (1000 * 60 * 60 * 24)
        );

        lista.push({
          clave,
          telefono: p.telefono_cliente,
          nombre: p.nombre_cliente || "Cliente",
          producto: i.nombre_producto,
          productoId: i.producto_id,
          dias
        });
      });
    });

    // Los de 3 a 15 días primero: es la ventana donde más responden.
    // Antes todavía lo están probando; después ya se olvidaron.
    lista.sort((a, b) => {
      const puntaje = (d) => (d >= 3 && d <= 15 ? 0 : d < 3 ? 1 : 2);
      return puntaje(a.dias) - puntaje(b.dias) || a.dias - b.dias;
    });

    const { data: pub } = await supabase
      .from("resenas")
      .select("*, Productos(nombre)")
      .order("created_at", { ascending: false });

    setPendientes(lista);
    setPendientesAprobar((pub || []).filter((r) => !r.aprobada));
    setPublicadas((pub || []).filter((r) => r.aprobada));
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  function mensajePedido(c) {
    const nombre = (c.nombre || "").split(" ")[0];
    const producto = (c.producto || "").toLowerCase();

    return (
      `¡Hola ${nombre}! 👋 Soy de Bolson Click.\n\n` +
      `¿Cómo te fue con ${producto}? 🙂\n\n` +
      `Si te sirvió, ¿me dejarías una opinión en la app? Le sirve un montón a ` +
      `otros vecinos que están dudando si comprarlo.\n\n` +
      `Entrá acá y tocá "Contá qué te pareció":\n` +
      `https://www.bolsonclick.com.ar/producto/${c.productoId}\n\n` +
      `¡Gracias! 🙌`
    );
  }

  async function aprobar(r) {
    const { error } = await supabase
      .from("resenas")
      .update({ aprobada: true })
      .eq("id", r.id);

    if (error) {
      alert("No se pudo publicar: " + error.message);
      return;
    }
    cargar();
  }

  async function rechazar(r) {
    if (
      !confirm(
        `¿Rechazar esta opinión?\n\nSe borra y el cliente puede volver a escribir otra.\n\n` +
          `Si tiene un error o un malentendido, conviene hablarlo por WhatsApp antes.`
      )
    )
      return;

    const { error } = await supabase.from("resenas").delete().eq("id", r.id);
    if (error) {
      alert("No se pudo rechazar: " + error.message);
      return;
    }
    cargar();
  }

  async function cambiarVisibilidad(r) {
    const { error } = await supabase
      .from("resenas")
      .update({ aprobada: !r.aprobada })
      .eq("id", r.id);

    if (error) {
      alert("No se pudo: " + error.message);
      return;
    }
    cargar();
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/admin" className="text-sm text-brand-blue font-medium">
          ← Panel
        </Link>
        <h1 className="text-2xl font-extrabold text-gray-800 mt-1 mb-1">
          Opiniones de clientes
        </h1>
        <p className="text-xs text-gray-500 mb-4">
          Lo que más ayuda a que alguien se decida a comprarte.
        </p>

        <div className="flex gap-2 mb-4 overflow-x-auto">
          <button
            onClick={() => setVista("aprobar")}
            className={`flex-1 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap px-2 relative ${
              vista === "aprobar"
                ? "bg-amber-600 text-white"
                : "bg-white border border-gray-200 text-gray-600"
            }`}
          >
            Para aprobar ({pendientesAprobar.length})
            {pendientesAprobar.length > 0 && vista !== "aprobar" && (
              <span className="absolute -top-1 -right-1 bg-red-600 w-2.5 h-2.5 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setVista("pedir")}
            className={`flex-1 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap px-2 ${
              vista === "pedir"
                ? "bg-brand-blue text-white"
                : "bg-white border border-gray-200 text-gray-600"
            }`}
          >
            Pedir ({pendientes.length})
          </button>
          <button
            onClick={() => setVista("publicadas")}
            className={`flex-1 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap px-2 ${
              vista === "publicadas"
                ? "bg-brand-blue text-white"
                : "bg-white border border-gray-200 text-gray-600"
            }`}
          >
            Publicadas ({publicadas.length})
          </button>
        </div>

        {loading ? (
          <p className="text-center text-gray-400 py-10">Cargando...</p>
        ) : vista === "aprobar" ? (
          pendientesAprobar.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center border border-gray-100">
              <p className="text-sm text-gray-600">
                No hay opiniones esperando aprobación.
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                Cuando un cliente deje una, te llega una notificación y aparece acá.
              </p>
            </div>
          ) : (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-3">
                <p className="text-[11px] text-gray-700">
                  Estas opiniones <b>todavía no se ven</b> en la app. Revisalas y
                  publicá las que estén bien. Si alguna tiene un error o un
                  malentendido, hablalo por WhatsApp antes de rechazarla.
                </p>
              </div>

              <div className="space-y-3">
                {pendientesAprobar.map((r) => (
                  <div
                    key={r.id}
                    className="bg-white rounded-2xl border-2 border-amber-300 p-4"
                  >
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800">
                          {r.nombre}
                          {r.localidad && (
                            <span className="font-normal text-gray-400">
                              {" "}· {r.localidad}
                            </span>
                          )}
                        </p>
                        <p className="text-amber-400 text-base leading-none mt-0.5">
                          {"★".repeat(r.estrellas)}
                          <span className="text-gray-300">
                            {"★".repeat(5 - r.estrellas)}
                          </span>
                        </p>
                        <p className="text-[11px] text-gray-500 mt-1 line-clamp-1">
                          {r.Productos?.nombre}
                        </p>
                      </div>

                      <span className="text-[10px] text-gray-400 whitespace-nowrap">
                        {new Date(r.created_at).toLocaleDateString("es-AR")}
                      </span>
                    </div>

                    {r.comentario ? (
                      <div className="bg-gray-50 rounded-xl p-3 mb-3">
                        <p className="text-xs text-gray-700 leading-relaxed">
                          &ldquo;{r.comentario}&rdquo;
                        </p>
                      </div>
                    ) : (
                      <p className="text-[11px] text-gray-400 italic mb-3">
                        Sin comentario, solo puntuación.
                      </p>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => aprobar(r)}
                        className="flex-1 bg-green-600 text-white text-xs font-bold py-2.5 rounded-xl"
                      >
                        ✓ Publicar
                      </button>

                      <a
                        href={`https://wa.me/${telefonoWhatsapp(
                          r.telefono
                        )}?text=${encodeURIComponent(
                          `¡Hola ${(r.nombre || "").split(" ")[0]}! 👋 Gracias por dejar tu opinión sobre ${
                            r.Productos?.nombre || "el producto"
                          } 🙌`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-emerald-600 text-white text-xs font-bold px-3 py-2.5 rounded-xl"
                      >
                        💬
                      </a>

                      <button
                        onClick={() => rechazar(r)}
                        className="px-3 text-xs font-semibold text-red-500"
                      >
                        Rechazar
                      </button>
                    </div>

                    {r.estrellas <= 2 && (
                      <p className="text-[10px] text-amber-800 bg-amber-50 rounded-lg p-2 mt-2">
                        Puntuación baja: conviene escribirle antes de publicar,
                        capaz se resuelve y termina cambiándola.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )
        ) : vista === "pedir" ? (
          pendientes.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center border border-gray-100">
              <p className="text-sm text-gray-600">
                No hay opiniones pendientes por ahora.
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Aparecen acá cuando marcás un pedido como entregado.
              </p>
            </div>
          ) : (
            <>
              <div className="bg-blue-50/60 border border-blue-200 rounded-2xl p-3 mb-3">
                <p className="text-[11px] text-gray-700">
                  El mejor momento para pedirla es entre <b>3 y 15 días</b> después
                  de entregar: ya lo probó y todavía lo tiene fresco. Están
                  ordenados así.
                </p>
              </div>

              <div className="space-y-2">
                {pendientes.map((c) => {
                  const enVentana = c.dias >= 3 && c.dias <= 15;
                  return (
                    <div
                      key={c.clave}
                      className={`bg-white rounded-2xl border p-3 ${
                        enVentana ? "border-green-300" : "border-gray-100"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-800">{c.nombre}</p>
                          <p className="text-[11px] text-gray-500 line-clamp-1">
                            {c.producto}
                          </p>
                          <p
                            className={`text-[10px] font-bold mt-0.5 ${
                              enVentana ? "text-green-700" : "text-gray-400"
                            }`}
                          >
                            {c.dias === 0
                              ? "Entregado hoy"
                              : `Hace ${c.dias} día${c.dias === 1 ? "" : "s"}`}
                            {enVentana && " · buen momento"}
                          </p>
                        </div>

                        <a
                          href={`https://wa.me/${telefonoWhatsapp(
                            c.telefono
                          )}?text=${encodeURIComponent(mensajePedido(c))}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-emerald-600 text-white text-[11px] font-bold px-3 py-2 rounded-xl whitespace-nowrap"
                        >
                          💬 Pedir
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )
        ) : publicadas.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center border border-gray-100">
            <p className="text-sm text-gray-600">Todavía no hay opiniones.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {publicadas.map((r) => (
              <div
                key={r.id}
                className={`bg-white rounded-2xl border p-3 ${
                  r.aprobada ? "border-gray-100" : "border-red-200 opacity-60"
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-800">
                      {r.nombre}
                      <span className="text-amber-400 ml-1">
                        {"★".repeat(r.estrellas)}
                      </span>
                    </p>
                    <p className="text-[11px] text-gray-500 line-clamp-1">
                      {r.Productos?.nombre}
                    </p>
                    {r.comentario && (
                      <p className="text-[11px] text-gray-600 mt-1">{r.comentario}</p>
                    )}
                  </div>

                  <button
                    onClick={() => cambiarVisibilidad(r)}
                    className={`text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap ${
                      r.aprobada
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {r.aprobada ? "Visible" : "Oculta"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function ResenasPage() {
  return (
    <AdminGuard>
      <Resenas />
    </AdminGuard>
  );
}
