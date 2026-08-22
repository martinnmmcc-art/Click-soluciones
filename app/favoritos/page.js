"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import BotonFavorito from "@/components/BotonFavorito";
import { supabase } from "@/lib/supabaseClient";
import { useRecordarPosicion } from "@/lib/useRecordarPosicion";
import { formatPrice } from "@/lib/whatsapp";
import { obtenerTelefonoCliente, listarFavoritos } from "@/lib/favoritos";

export default function FavoritosPage() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Vuelve al mismo punto de la lista al regresar de un producto
  const { alSalir, listaLista } = useRecordarPosicion("favoritos");
  const [sinSesion, setSinSesion] = useState(false);

  useEffect(() => {
    async function cargar() {
      const tel = obtenerTelefonoCliente();
      if (!tel) {
        setSinSesion(true);
        setLoading(false);
        return;
      }

      const ids = await listarFavoritos(tel);
      if (ids.length === 0) {
        setProductos([]);
        setLoading(false);
        return;
      }

      const { data } = await supabase.from("Productos").select("*").in("id", ids);
      setProductos(data || []);
      setLoading(false);
      listaLista(data?.length || 0);
    }
    cargar();
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 pb-28">
      <Header showSearch={false} />

      <div className="max-w-md mx-auto px-4 mt-4">
        <h1 className="font-bold text-lg text-gray-800 mb-4">❤️ Mis Favoritos</h1>

        {sinSesion ? (
          <div className="card p-6 text-center">
            <p className="text-sm text-gray-600 mb-3">Iniciá sesión para ver tus favoritos.</p>
            <Link href="/login" className="btn-primary inline-block">
              Iniciar sesión
            </Link>
          </div>
        ) : loading ? (
          <p className="text-center text-gray-400 text-sm py-10">Cargando...</p>
        ) : productos.length === 0 ? (
          <div className="card p-6 text-center text-gray-500 text-sm">
            Todavía no marcaste ningún favorito. Tocá el ❤️ en un producto para guardarlo acá.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {productos.map((prod) => {
              const tieneOferta = prod.precio_oferta && Number(prod.precio_oferta) < Number(prod.precio);
              return (
                <div key={prod.id} className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm relative">
                  <BotonFavorito productoId={prod.id} className="absolute top-4 right-4 w-8 h-8 z-10" />
                  <Link href={`/producto/${prod.id}`} onClick={alSalir}>
                    {prod.imagen_url ? (
                      <img src={prod.imagen_url} alt={prod.nombre} className="w-full h-32 object-cover rounded-xl mb-2 bg-gray-50" />
                    ) : (
                      <div className="w-full h-32 bg-gray-100 rounded-xl mb-2 flex items-center justify-center text-2xl">📦</div>
                    )}
                    <h3 className="font-bold text-xs text-gray-800 line-clamp-2 leading-tight">{prod.nombre}</h3>
                    <p className="font-black text-sm text-brand-blue mt-1">
                      ${formatPrice(tieneOferta ? prod.precio_oferta : prod.precio)}
                    </p>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
