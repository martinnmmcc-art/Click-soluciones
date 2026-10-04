"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { correoGuardado } from "@/lib/sesionGuardada";

const AdminContext = createContext(null);

// Correos autorizados como administrador. Agregá más acá si hace falta.
export const ADMIN_EMAILS = [
  "maricelcanumir@gmail.com",
  "martinnm.mcc@gmail.com",
  "patagoniavolt@gmail.com"
];

export function AdminProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  // El correo de la sesión guardada en el celular (se lee sin internet)
  const [correoLocal, setCorreoLocal] = useState(null);

  useEffect(() => {
    const correo = correoGuardado();
    setCorreoLocal(correo);
    // Si en el celular hay una sesión de administrador, no esperamos a
    // internet para mostrar el panel: sin señal la renovación tarda o falla.
    if (ADMIN_EMAILS.includes(correo)) setLoading(false);

    let resuelto = false;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        resuelto = true;
        setSession(data.session);
        setCorreoLocal(correoGuardado());
        setLoading(false);
      })
      .catch(() => {
        resuelto = true;
        setLoading(false);
      });
    // Con poca señal la renovación puede tardar mucho: a los 3 segundos
    // seguimos con lo guardado.
    const espera = setTimeout(() => {
      if (!resuelto) setLoading(false);
    }, 3000);

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      // Al cerrar sesión se borra la guardada: deja de ser admin también acá
      setCorreoLocal(correoGuardado());
    });

    return () => {
      clearTimeout(espera);
      listener?.subscription?.unsubscribe();
    };
  }, []);

  // Administrador: por la sesión activa, o (sin señal, con la sesión vencida
  // sin poder renovarse) por la sesión que sigue guardada en el celular.
  const isAdmin = ADMIN_EMAILS.includes(session?.user?.email) || (!session && ADMIN_EMAILS.includes(correoLocal));

  async function logout() {
    await supabase.auth.signOut();
    setSession(null);
    setCorreoLocal(null);
  }

  return (
    <AdminContext.Provider value={{ isAdmin, loading, session, logout }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin debe usarse dentro de AdminProvider");
  return ctx;
}
