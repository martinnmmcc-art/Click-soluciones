"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import { supabase } from "@/lib/supabaseClient";

const SITIO = "https://www.bolsonclick.com.ar";
const WHATSAPP = "5492944396888";

function Bloque({ titulo, valor, ayuda }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch (e) {
      alert(valor);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3">
      <p className="font-bold text-sm text-gray-800">{titulo}</p>
      {ayuda && <p className="text-[11px] text-gray-500 mt-0.5 mb-2">{ayuda}</p>}

      <div className="bg-gray-50 rounded-xl p-2.5 break-all">
        <p className="text-[11px] text-gray-700 font-mono">{valor}</p>
      </div>

      <button
        onClick={copiar}
        className="w-full bg-brand-blue text-white text-xs font-bold py-2 rounded-xl mt-2"
      >
        {copiado ? "✓ Copiado" : "Copiar"}
      </button>
    </div>
  );
}

function WhatsAppCatalogo() {
  const [conteo, setConteo] = useState(null);

  useEffect(() => {
    async function contar() {
      const [propios, todos] = await Promise.all([
        supabase
          .from("Productos")
          .select("id", { count: "exact", head: true })
          .or("bajo_pedido.is.null,bajo_pedido.eq.false")
          .eq("activo", true)
          .gt("precio", 0)
          .not("imagen_url", "is", null),
        supabase
          .from("Productos")
          .select("id", { count: "exact", head: true })
          .eq("activo", true)
          .gt("precio", 0)
          .not("imagen_url", "is", null)
      ]);
      setConteo({ propios: propios.count || 0, todos: todos.count || 0 });
    }
    contar();
  }, []);

  const mensajeBienvenida =
    `¡Hola! 👋 Gracias por escribir a *Bolson Click*.\n\n` +
    `🛒 Mirá todo el catálogo con precios actualizados acá:\n${SITIO}\n\n` +
    `Ahí podés ver fotos, precios y hacer tu pedido directo. ` +
    `Cualquier duda respondeme por acá que te ayudo 🙌`;

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/admin" className="text-sm text-brand-blue font-medium">
          ← Panel
        </Link>
        <h1 className="text-2xl font-extrabold text-gray-800 mt-1 mb-1">
          Catálogo en WhatsApp
        </h1>
        <p className="text-xs text-gray-500 mb-4">
          Que tus clientes lleguen a la tienda desde WhatsApp.
        </p>

        {/* LO MÁS FÁCIL Y QUE SIRVE YA */}
        <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-4 mb-4">
          <p className="font-bold text-sm text-green-900">
            ✅ Lo más rápido: hacelo hoy
          </p>
          <p className="text-xs text-green-800 mt-1">
            No necesitás nada especial. Con estos dos pasos, cualquiera que te
            escriba llega a tu tienda con precios al día.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3">
          <p className="font-bold text-sm text-gray-800 mb-2">
            1. Poné el link en tu perfil
          </p>
          <p className="text-[11px] text-gray-600 mb-2">
            En WhatsApp Business: <b>Configuración → Herramientas para la
            empresa → Perfil de empresa</b>. Pegá la dirección en &quot;Sitio
            web&quot;. Queda visible para cualquiera que abra tu perfil.
          </p>
          <Bloque titulo="Dirección de tu tienda" valor={SITIO} />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
          <p className="font-bold text-sm text-gray-800 mb-2">
            2. Mensaje de bienvenida automático
          </p>
          <p className="text-[11px] text-gray-600 mb-2">
            En WhatsApp Business: <b>Herramientas para la empresa → Mensaje de
            bienvenida</b>. Activalo y pegá este texto. Se manda solo la primera
            vez que alguien te escribe.
          </p>

          <div className="bg-gray-50 rounded-xl p-3 mb-2">
            <p className="text-[11px] text-gray-700 whitespace-pre-line">
              {mensajeBienvenida}
            </p>
          </div>

          <button
            onClick={() => {
              navigator.clipboard
                .writeText(mensajeBienvenida)
                .then(() => alert("✓ Copiado. Pegalo en el mensaje de bienvenida."))
                .catch(() => alert(mensajeBienvenida));
            }}
            className="w-full bg-[#25D366] text-white text-xs font-bold py-2.5 rounded-xl"
          >
            📋 Copiar mensaje de bienvenida
          </button>
        </div>

        {/* SINCRONIZACIÓN AUTOMÁTICA */}
        <div className="bg-blue-50 border-2 border-blue-300 rounded-2xl p-4 mb-3">
          <p className="font-bold text-sm text-blue-900">
            🔄 Catálogo dentro de WhatsApp que se actualiza solo
          </p>
          <p className="text-xs text-blue-800 mt-1">
            Para que tus productos aparezcan en el catálogo de WhatsApp (y en
            Instagram y Facebook) sin cargarlos a mano, hay que conectar esta
            dirección en Meta Commerce Manager. Meta la lee todos los días y
            actualiza precios y stock solo.
          </p>
        </div>

        <Bloque
          titulo="Dirección del catálogo (solo lo que tengo)"
          ayuda={
            conteo
              ? `${conteo.propios} productos con foto y precio`
              : "Cargando..."
          }
          valor={`${SITIO}/api/catalogo-meta`}
        />

        <Bloque
          titulo="Dirección del catálogo completo"
          ayuda={
            conteo
              ? `${conteo.todos} productos, incluyendo los del proveedor`
              : "Cargando..."
          }
          valor={`${SITIO}/api/catalogo-meta?todos=1`}
        />

        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
          <p className="font-bold text-sm text-gray-800 mb-2">Cómo conectarlo</p>
          <ol className="text-[11px] text-gray-600 space-y-1.5 list-decimal pl-4">
            <li>
              Entrá a <b>business.facebook.com/commerce</b> desde una
              computadora.
            </li>
            <li>Creá un catálogo y elegí &quot;Comercio electrónico&quot;.</li>
            <li>
              En &quot;Agregar artículos&quot; elegí <b>Fuente de datos →
              Carga programada</b>.
            </li>
            <li>Pegá una de las direcciones de arriba y elegí que se actualice a diario.</li>
            <li>Conectá el catálogo a tu cuenta de WhatsApp Business.</li>
          </ol>

          <p className="text-[11px] text-amber-800 bg-amber-50 rounded-lg p-2 mt-3">
            <b>Requisito:</b> Meta pide una cuenta comercial verificada, y para
            eso hace falta CUIT. Es lo mismo que charlamos con Naranja X y
            Mercado Pago: cuando lo tengas, esto queda andando en 15 minutos.
          </p>
        </div>

        {/* LINK DIRECTO PARA COMPARTIR */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="font-bold text-sm text-gray-800 mb-2">
            Link para que te escriban
          </p>
          <p className="text-[11px] text-gray-600 mb-2">
            Poné este enlace en Instagram, Facebook o donde quieras: abre un
            chat con vos y el mensaje ya viene escrito.
          </p>
          <Bloque
            titulo="Chat directo con vos"
            valor={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(
              "¡Hola! Vi el catálogo de Bolson Click y quería consultar por un producto."
            )}`}
          />
        </div>
      </div>
    </main>
  );
}

export default function WhatsAppCatalogoPage() {
  return (
    <AdminGuard>
      <WhatsAppCatalogo />
    </AdminGuard>
  );
}
