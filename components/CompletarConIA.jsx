"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { cabeceraAdmin } from "@/lib/verificarAdmin";

// Botón "Completar con IA" del formulario de producto (solo panel).
//
// Pide un BORRADOR (ver lib/completarIA.js) y lo muestra para revisar:
// cada dato dice de dónde salió. Los datos dudosos vienen destildados.
// Nada se guarda solo: "Usar" copia al formulario y después se toca Guardar.

const ETIQUETA_FUENTE = {
  caja: { texto: "📦 caja", clase: "bg-green-100 text-green-800" },
  proveedor: { texto: "🏷️ proveedor", clase: "bg-blue-100 text-blue-800" },
  internet: { texto: "🌐 internet", clase: "bg-purple-100 text-purple-800" }
};

function dominio(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (e) {
    return url;
  }
}

function ListaRevisable({ titulo, items, elegidos, setElegidos }) {
  if (!items.length) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-bold text-gray-700 mb-1">{titulo}</p>
      <ul className="flex flex-col gap-1">
        {items.map((it, i) => {
          const f = ETIQUETA_FUENTE[it.fuente] || ETIQUETA_FUENTE.internet;
          return (
            <li
              key={i}
              className={`flex items-start gap-2 text-sm rounded-lg px-2 py-1.5 ${
                it.seguro ? "bg-white" : "bg-amber-50 border border-amber-200"
              }`}
            >
              <input
                type="checkbox"
                className="mt-1"
                checked={!!elegidos[i]}
                onChange={(e) => setElegidos({ ...elegidos, [i]: e.target.checked })}
                aria-label={`Usar: ${it.texto}`}
              />
              <span className="flex-1 text-gray-800">
                {it.texto}
                {!it.seguro && <span className="ml-1 text-[11px] font-bold text-amber-700">⚠️ revisar</span>}
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${f.clase}`}>
                {it.url ? (
                  <a href={it.url} target="_blank" rel="noopener noreferrer" className="underline">
                    {f.texto}
                  </a>
                ) : (
                  f.texto
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Los seguros vienen tildados; los dudosos, no
function tildarSeguros(items) {
  const r = {};
  items.forEach((it, i) => (r[i] = !!it.seguro));
  return r;
}

export default function CompletarConIA({ productoId, form, onUsar }) {
  const [estado, setEstado] = useState("listo"); // listo | pensando | error
  const [error, setError] = useState("");
  const [borrador, setBorrador] = useState(null);
  const [selCar, setSelCar] = useState({});
  const [selInc, setSelInc] = useState({});
  const [usado, setUsado] = useState({});

  async function pedir() {
    setEstado("pensando");
    setError("");
    setBorrador(null);
    setUsado({});
    try {
      const res = await fetch("/api/admin/completar-ia", {
        method: "POST",
        headers: await cabeceraAdmin(supabase),
        body: JSON.stringify({
          id: productoId || null,
          form: {
            nombre: form.nombre,
            descripcion: form.descripcion,
            categoria: form.categoria,
            imagen_url: form.imagen_url,
            imagen_url_2: form.imagen_url_2,
            imagen_url_3: form.imagen_url_3
          }
        })
      });
      const datos = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(datos.error || `Error ${res.status}`);
      setBorrador(datos.borrador);
      setSelCar(tildarSeguros(datos.borrador.caracteristicas));
      setSelInc(tildarSeguros(datos.borrador.incluye));
      setEstado("listo");
    } catch (e) {
      setError(
        /Failed to fetch|NetworkError/i.test(e.message) ? "Sin conexión. Probá de nuevo con señal." : e.message
      );
      setEstado("error");
    }
  }

  function elegidos(items, sel) {
    return items.filter((_, i) => sel[i]).map((it) => `• ${it.texto}`).join("\n");
  }

  function usar(campo, valor) {
    onUsar(campo, valor);
    setUsado({ ...usado, [campo]: true });
  }

  return (
    <div className="border border-purple-200 bg-purple-50/50 rounded-xl p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-purple-900">✨ Completar con IA</p>
          <p className="text-[11px] text-purple-800">
            Lee las fotos y el texto del proveedor, busca el modelo en Google y te arma un borrador. Vos revisás y
            elegís qué usar.
          </p>
        </div>
        <button
          type="button"
          onClick={pedir}
          disabled={estado === "pensando"}
          className="text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-60 px-3 py-2 rounded-lg whitespace-nowrap"
        >
          {estado === "pensando" ? "Pensando..." : borrador ? "Volver a pedir" : "Completar"}
        </button>
      </div>

      {estado === "pensando" && (
        <p className="text-xs text-purple-800 mt-2">
          Leyendo fotos y buscando el modelo... puede tardar hasta un minuto.
        </p>
      )}
      {estado === "error" && <p className="text-xs text-red-700 mt-2">⚠️ {error}</p>}

      {borrador && (
        <div className="mt-3 border-t border-purple-200 pt-3">
          <p className="text-[11px] text-gray-600">
            {borrador.marca && (
              <>
                Marca: <b>{borrador.marca}</b> ·{" "}
              </>
            )}
            {borrador.modelo ? (
              <>
                Modelo: <b>{borrador.modelo}</b> ·{" "}
              </>
            ) : (
              "No se leyó un modelo · "
            )}
            Fotos leídas: {borrador.fotosLeidas}
            {!borrador.conBusqueda && " · Sin búsqueda en Google (solo fotos y proveedor)"}
          </p>

          {borrador.advertencias.length > 0 && (
            <ul className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-900 list-disc pl-5">
              {borrador.advertencias.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          )}

          {borrador.descripcion && (
            <div className="mt-3">
              <p className="text-xs font-bold text-gray-700 mb-1">Descripción</p>
              <p className="text-sm text-gray-800 whitespace-pre-line bg-white rounded-lg p-2">{borrador.descripcion}</p>
              <button
                type="button"
                onClick={() => usar("descripcion", borrador.descripcion)}
                className="mt-1 text-xs font-bold text-purple-700 underline"
              >
                {usado.descripcion ? "✓ Copiada a la descripción" : "Usar esta descripción"}
              </button>
            </div>
          )}

          <ListaRevisable
            titulo="Características (tildá las que querés usar)"
            items={borrador.caracteristicas}
            elegidos={selCar}
            setElegidos={setSelCar}
          />
          {borrador.caracteristicas.length > 0 && (
            <button
              type="button"
              onClick={() => usar("caracteristicas", elegidos(borrador.caracteristicas, selCar))}
              className="mt-1 text-xs font-bold text-purple-700 underline"
            >
              {usado.caracteristicas ? "✓ Copiadas a características" : "Usar las tildadas como características"}
            </button>
          )}

          <ListaRevisable
            titulo="Qué incluye la caja"
            items={borrador.incluye}
            elegidos={selInc}
            setElegidos={setSelInc}
          />
          {borrador.incluye.length > 0 && (
            <button
              type="button"
              onClick={() => usar("accesorios", elegidos(borrador.incluye, selInc))}
              className="mt-1 text-xs font-bold text-purple-700 underline"
            >
              {usado.accesorios ? "✓ Copiado a qué incluye" : "Usar las tildadas en \"Qué incluye\""}
            </button>
          )}

          {borrador.fuentesWeb.length > 0 && (
            <details className="mt-3">
              <summary className="text-xs font-bold text-gray-700 cursor-pointer">
                Páginas consultadas ({borrador.fuentesWeb.length})
              </summary>
              <ul className="mt-1 text-xs text-gray-600 list-disc pl-5">
                {borrador.fuentesWeb.map((f, i) => (
                  <li key={i}>
                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="underline">
                      {f.titulo || dominio(f.url)}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <p className="text-[11px] text-gray-500 mt-3">
            Lo que uses se copia al formulario de abajo. Revisalo y tocá <b>Guardar</b> para publicarlo.
          </p>
        </div>
      )}
    </div>
  );
}
