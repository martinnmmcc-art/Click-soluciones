"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const isAdmin = ADMIN_EMAILS.includes(session?.user?.email);

  async function logout() {
    await supabase.auth.signOut();
    setSession(null);
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
