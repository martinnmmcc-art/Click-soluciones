"use client";

import { createContext, useContext, useEffect, useState } from "react";

const AdminContext = createContext(null);
const STORAGE_KEY = "clic_soluciones_admin";

export function AdminProvider({ children }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const flag = localStorage.getItem(STORAGE_KEY);
    setIsAdmin(flag === "true");
    setLoading(false);
  }, []);

  function login(password) {
    const claveCorrecta = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "clicsoluciones2026";
    if (password === claveCorrecta) {
      localStorage.setItem(STORAGE_KEY, "true");
      setIsAdmin(true);
      return true;
    }
    return false;
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setIsAdmin(false);
  }

  return (
    <AdminContext.Provider value={{ isAdmin, loading, login, logout }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin debe usarse dentro de AdminProvider");
  return ctx;
}
