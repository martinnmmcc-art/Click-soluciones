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

const SITIO = "https://www.bolsonclick.com.ar";

function Oportunidades() {
  const [vista, setVista] = useState("carritos");
  const [carritos, setCarritos] = useState([]);
  const [favoritos, setFavoritos] = useState([]);
  const [sinComprar, setSinComprar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generando, setGenerando] = useState(null);

  // Envía solo la notificación al celular, sin cupón. Sirve para avisar de
  // una oferta sin tener que resignar margen.
  async function soloNotificar(telefono, titulo, cuerpo, url = "/catalogo?oferta=1") {
    setGenerando(telefono);
    try {
      const res = await fetch("/api/avisar-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefono, titulo, cuerpo, url })
      });
      const data = await res.json();

      alert(
        data.enviados > 0
          ? `✓ Aviso enviado.\n\nLe llegó la notificación al celular (${data.enviados} dispositivo) y también lo va a ver al entrar a la app.`
          : `✓ Aviso dejado en la app.\n\nEste cliente no tiene las notificaciones activadas, así que lo va a ver la próxima vez que entre. Si querés que se entere ahora, mandale un WhatsApp.`
      );
    } catch (e) {
      alert("No se pudo enviar la notificación.");
    } finally {
      setGenerando(null);
    }
  }

  // Genera el cupón y abre WhatsApp con el mensaje que lo incluye.
  // El cupón es de un solo uso y vence: sirve para destrabar una compra,
  // no para que el cliente aprenda a esperar el descuento.
  async function conCupon(persona, motivo, config, armarMensaje) {
    setGenerando(persona.telefono);
    try {
      const { data, error } = await supabase.rpc("generar_cupon", {
        p_telefono: persona.telefono,
        p_motivo: motivo,
        p_porcentaje: config.porcentaje,
        p_dias: config.dias,
        p_porcentaje_segundo: config.segundo || 0,
        p_minimo: config.minimo || 0
      });

      if (error || !data?.[0]) {
        alert("No se pudo generar el cupón: " + (error?.message || ""));
        return;
      }

      const cupon = data[0];
      const vence = new Date(cupon.vence_en).toLocaleDateString("es-AR");

      // Notificación al celular: llega aunque no lea el WhatsApp
      fetch("/api/avisar-cupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telefono: persona.telefono,
          codigo: cupon.codigo,
          porcentaje: config.porcentaje,
          vence_en: cupon.vence_en,
          motivo
        })
      }).catch(() => {});

      window.open(
        `https://wa.me/${wa(persona.telefono)}?text=${encodeURIComponent(
          armarMensaje(cupon.codigo, vence)
        )}`,
        "_blank"
      );
    } finally {
      setGenerando(null);
    }
  }

  async function cargar() {
    setLoading(true);
    const [c, f, s] = await Promise.all([
      supabase
        .from("carritos_abandonados")
        .select("*")
        .eq("recuperado", false)
        .order("actualizado_en", { ascending: false }),
      supabase.rpc("favoritos_en_oferta"),
      supabase.rpc("registrados_sin_comprar")
    ]);

    setCarritos(c.data || []);

    // Agrupamos por cliente: si guardó 3 productos en oferta, le mandamos
    // un mensaje con los 3, no tres mensajes seguidos.
    const porCliente = {};
    (f.data || []).forEach((x) => {
      if (!porCliente[x.telefono]) {
        porCliente[x.telefono] = {
          telefono: x.telefono,
          nombre_cliente: x.nombre_cliente,
          productos: [],
          ahorroTotal: 0
        };
      }
      porCliente[x.telefono].productos.push(x);
      porCliente[x.telefono].ahorroTotal += Number(x.ahorro || 0);
    });

    setFavoritos(Object.values(porCliente));
    setSinComprar(s.data || []);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  // El mensaje reconoce lo que dejó, no es un "volvé a comprar" genérico
  function mensajeCarrito(c) {
    const nombre = (c.nombre || "").split(" ")[0];
    const prods = (c.productos || [])
      .slice(0, 3)
      .map((p) => `• ${p.cantidad}x ${p.nombre}`)
      .join("\n");

    return (
      `¡Hola ${nombre}! 👋 Soy de Bolson Click.\n\n` +
      `Vi que dejaste esto en tu carrito:\n\n${prods}\n\n` +
      `¿Querés que te lo aparte? Tengo stock 🙂\n\n` +
      `Si preferís, completá el pedido acá:\n${SITIO}/carrito`
    );
  }

  // Carrito viejo: descuento para destrabar la compra
  function mensajeCarritoCupon(c, codigo, vence) {
    const nombre = (c.nombre || "").split(" ")[0];
    const prods = (c.productos || [])
      .slice(0, 3)
      .map((p) => `• ${p.cantidad}x ${p.nombre}`)
      .join("\n");

    return (
      `¡Hola ${nombre}! 👋 Soy de Bolson Click.\n\n` +
      `Vi que hace unos días dejaste esto en tu carrito:\n\n${prods}\n\n` +
      `Te dejo un *10% de descuento* para que lo completes 🎁\n\n` +
      `🎟️ Tu código: *${codigo}*\n` +
      `⏰ Válido hasta el ${vence}\n\n` +
      `Es solo para vos y por única vez. Ponelo al finalizar la compra:\n` +
      `${SITIO}/carrito`
    );
  }

  // Favorito: 5% y un extra si lleva más de uno, para subir el ticket
  function mensajeFavoritoCupon(f, codigo, vence) {
    const nombre = (f.nombre_cliente || "").split(" ")[0];
    const lista = f.productos.map((p) => `• ${p.producto}`).join("\n");
    return (
      `¡Hola ${nombre}! 👋\n\n` +
      `Guardaste esto en favoritos:\n${lista}\n\n` +
      `Te preparé un descuento 🎁\n\n` +
      `🎟️ Código: *${codigo}*\n` +
      `💰 *5% off* en tu compra\n` +
      `🎉 Y si llevás 2 productos o más, *10% off*\n` +
      `⏰ Válido hasta el ${vence}\n\n` +
      `Mirá tus favoritos acá:\n${SITIO}/catalogo?oferta=1`
    );
  }

  function mensajeFavorito(f) {
    const nombre = (f.nombre_cliente || "").split(" ")[0];
    const varios = f.productos.length > 1;

    let m = `¡Hola ${nombre}! 👋\n\n`;
    m += varios
      ? `Te aviso porque ${f.productos.length} productos que guardaste en favoritos están en oferta 🔥\n\n`
      : `Te aviso porque habías guardado esto en favoritos y ahora está en oferta 🔥\n\n`;

    f.productos.forEach((p) => {
      m += `*${p.producto}*\n`;
      m += `~$${Number(p.precio).toLocaleString("es-AR")}~ → `;
      m += `*$${Number(p.precio_oferta).toLocaleString("es-AR")}*\n\n`;
    });

    if (varios) {
      m += `💰 Ahorrás $${Number(f.ahorroTotal).toLocaleString("es-AR")} en total\n\n`;
    }

    m += `Es por tiempo limitado:\n${SITIO}/catalogo?oferta=1`;
    return m;
  }

  // Cupón de primera compra con monto mínimo: el descuento vale la pena
  // solo si el pedido justifica el viaje de la entrega.
  function mensajeBienvenidaCupon(c, codigo, vence) {
    const nombre = (c.nombre || "").split(" ")[0];
    return (
      `¡Hola ${nombre}! 👋 Soy de Bolson Click.\n\n` +
      `Vi que te registraste en la app y todavía no hiciste tu primera compra. ` +
      `Te preparé algo para estrenarla 🎁\n\n` +
      `🎟️ Código: *${codigo}*\n` +
      `💰 *10% off* en compras desde $35.000\n` +
      `⏰ Válido hasta el ${vence}\n\n` +
      `Es solo para vos y por única vez. Mirá el catálogo:\n${SITIO}\n\n` +
      `Cualquier cosa que busques y no veas, preguntame que te la consigo 🙌`
    );
  }

  function mensajeBienvenida(c) {
    const nombre = (c.nombre || "").split(" ")[0];
    const miro = Number(c.miro_productos || 0) > 0;

    return (
      `¡Hola ${nombre}! 👋 Soy de Bolson Click.\n\n` +
      (miro
        ? `Vi que estuviste mirando algunas cosas en la app 🙂\n\n`
        : `Te escribo porque te registraste en la app y todavía no hiciste tu primera compra.\n\n`) +
      `¿Hay algo que estés buscando? Decime qué necesitás y te digo si lo tengo ` +
      `o te lo consigo.\n\n` +
      `🛒 ${SITIO}\n🚚 Entrego en El Bolsón y toda la Comarca`
    );
  }

  const vistas = [
    { id: "carritos", label: `🛒 Carritos (${carritos.length})` },
    { id: "favoritos", label: `⭐ Favoritos (${favoritos.length})` },
    { id: "nuevos", label: `👋 Sin comprar (${sinComprar.length})` }
  ];

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/admin" className="text-sm text-brand-blue font-medium">
          ← Panel
        </Link>
        <h1 className="text-2xl font-extrabold text-gray-800 mt-1 mb-1">
          Oportunidades de venta
        </h1>
        <p className="text-xs text-gray-500 mb-4">
          Gente que ya mostró interés. Son las ventas más fáciles.
        </p>

        <div className="flex gap-2 overflow-x-auto pb-3">
          {vistas.map((v) => (
            <button
              key={v.id}
              onClick={() => setVista(v.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${
                vista === v.id
                  ? "bg-brand-blue text-white"
                  : "bg-white text-gray-600 border border-gray-200"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-center text-gray-400 py-10">Cargando...</p>
        ) : vista === "carritos" ? (
          <>
            <div className="bg-blue-50/60 border border-blue-200 rounded-2xl p-3 mb-3">
              <p className="text-[11px] text-gray-700">
                Dejaron productos en el carrito sin comprar. Escribirles al día
                siguiente recupera <b>1 de cada 5</b> en negocios chicos.
              </p>
            </div>

            {carritos.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 text-center border border-gray-100">
                <p className="text-sm text-gray-600">No hay carritos abandonados.</p>
                <p className="text-[11px] text-gray-400 mt-1">
                  Aparecen acá cuando alguien deja algo sin comprar.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {carritos.map((c) => {
                  const horas = Math.floor(
                    (Date.now() - new Date(c.actualizado_en)) / 3600000
                  );
                  return (
                    <div key={c.id} className="bg-white rounded-2xl border border-gray-100 p-3">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-800">
                            {c.nombre || c.telefono}
                          </p>
                          <p className="text-[11px] text-gray-400">
                            {horas < 1
                              ? "Recién ahora"
                              : horas < 24
                              ? `Hace ${horas}h`
                              : `Hace ${Math.floor(horas / 24)} día(s)`}
                          </p>

                          <div className="mt-1">
                            {(c.productos || []).slice(0, 3).map((p, i) => (
                              <p key={i} className="text-[11px] text-gray-600">
                                • {p.cantidad}x {p.nombre}
                              </p>
                            ))}
                          </div>

                          <p className="text-xs font-extrabold text-brand-blue mt-1">
                            ${formatPrice(c.total)}
                          </p>
                        </div>

                        <div className="flex flex-col gap-1.5 flex-shrink-0">
                          <a
                            href={`https://wa.me/${wa(c.telefono)}?text=${encodeURIComponent(
                              mensajeCarrito(c)
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-emerald-600 text-white text-[11px] font-bold px-3 py-2 rounded-xl whitespace-nowrap text-center"
                          >
                            💬 Recordar
                          </a>

                          {/* El descuento recién a la semana: antes alcanza
                              con recordarle, y así no se acostumbra. */}
                          {horas >= 168 && (
                            <button
                              onClick={() =>
                                conCupon(
                                  c,
                                  "carrito",
                                  { porcentaje: 10, dias: 5 },
                                  (cod, ven) => mensajeCarritoCupon(c, cod, ven)
                                )
                              }
                              disabled={generando === c.telefono}
                              className="bg-amber-600 text-white text-[11px] font-bold px-3 py-2 rounded-xl whitespace-nowrap disabled:opacity-50"
                            >
                              {generando === c.telefono ? "..." : "🎁 10% off"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : vista === "favoritos" ? (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-3">
              <p className="text-[11px] text-gray-700">
                Guardaron estos productos y ahora están en oferta. Ya mostraron
                interés: solo falta el empujón.
              </p>
            </div>

            {favoritos.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 text-center border border-gray-100">
                <p className="text-sm text-gray-600">
                  Ningún producto guardado está en oferta.
                </p>
                <Link
                  href="/admin/ofertas"
                  className="text-xs font-bold text-brand-blue underline mt-1 inline-block"
                >
                  Poner productos en oferta →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {favoritos.map((f, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 p-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-800">
                          {f.nombre_cliente}
                          {f.productos.length > 1 && (
                            <span className="ml-1 text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full font-extrabold">
                              {f.productos.length} favoritos
                            </span>
                          )}
                        </p>

                        {f.productos.map((p, j) => (
                          <p key={j} className="text-[11px] text-gray-600 mt-0.5">
                            ⭐ <span className="line-clamp-1 inline">{p.producto}</span>
                            <span className="block text-[10px] ml-3">
                              <span className="text-gray-400 line-through">
                                ${formatPrice(p.precio)}
                              </span>{" "}
                              <b className="text-red-600">
                                ${formatPrice(p.precio_oferta)}
                              </b>
                            </span>
                          </p>
                        ))}

                        <p className="text-[11px] text-green-700 font-bold mt-1">
                          Ahorra ${formatPrice(f.ahorroTotal)} en total
                        </p>
                      </div>

                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <a
                          href={`https://wa.me/${wa(f.telefono)}?text=${encodeURIComponent(
                            mensajeFavorito(f)
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-emerald-600 text-white text-[11px] font-bold px-3 py-2 rounded-xl whitespace-nowrap text-center"
                        >
                          💬 Avisar
                        </a>

                        <button
                          onClick={() =>
                            soloNotificar(
                              f.telefono,
                              "⭐ Tu favorito está en oferta",
                              f.productos.length > 1
                                ? `${f.productos.length} productos que guardaste bajaron de precio`
                                : `${f.productos[0].producto} bajó de precio`
                            )
                          }
                          disabled={generando === f.telefono}
                          className="bg-brand-blue text-white text-[11px] font-bold px-3 py-2 rounded-xl whitespace-nowrap disabled:opacity-50"
                        >
                          🔔 Avisar
                        </button>

                        <button
                          onClick={() =>
                            conCupon(
                              { telefono: f.telefono, nombre: f.nombre_cliente },
                              "favorito",
                              { porcentaje: 5, dias: 7, segundo: 10 },
                              (cod, ven) => mensajeFavoritoCupon(f, cod, ven)
                            )
                          }
                          disabled={generando === f.telefono}
                          className="bg-amber-600 text-white text-[11px] font-bold px-3 py-2 rounded-xl whitespace-nowrap disabled:opacity-50"
                        >
                          {generando === f.telefono ? "..." : "🎁 5% + 10%"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="bg-blue-50/60 border border-blue-200 rounded-2xl p-3 mb-3">
              <p className="text-[11px] text-gray-700">
                Se registraron pero nunca compraron. Algo les interesó: preguntarles
                qué buscan suele destrabar la primera compra.
              </p>
            </div>

            {sinComprar.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 text-center border border-gray-100">
                <p className="text-sm text-gray-600">
                  Todos los registrados ya compraron. 🎉
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {sinComprar.map((c) => (
                  <div
                    key={c.telefono}
                    className="bg-white rounded-2xl border border-gray-100 p-3"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-800">{c.nombre}</p>
                        <p className="text-[11px] text-gray-500">
                          {c.telefono}
                          {c.localidad && ` · ${c.localidad}`}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          Registrado hace {c.dias_registrado} día
                          {c.dias_registrado === 1 ? "" : "s"}
                          {Number(c.miro_productos) > 0 && (
                            <span className="text-green-700 font-bold">
                              {" "}· miró {c.miro_productos} producto(s)
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <a
                          href={`https://wa.me/${wa(c.telefono)}?text=${encodeURIComponent(
                            mensajeBienvenida(c)
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-emerald-600 text-white text-[11px] font-bold px-3 py-2 rounded-xl whitespace-nowrap text-center"
                        >
                          💬 Escribir
                        </a>

                        <button
                          onClick={() =>
                            conCupon(
                              c,
                              "bienvenida",
                              { porcentaje: 10, dias: 15, minimo: 35000 },
                              (cod, ven) => mensajeBienvenidaCupon(c, cod, ven)
                            )
                          }
                          disabled={generando === c.telefono}
                          className="bg-amber-600 text-white text-[11px] font-bold px-3 py-2 rounded-xl whitespace-nowrap disabled:opacity-50"
                        >
                          {generando === c.telefono ? "..." : "🎁 10% desde $35k"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default function OportunidadesPage() {
  return (
    <AdminGuard>
      <Oportunidades />
    </AdminGuard>
  );
}
