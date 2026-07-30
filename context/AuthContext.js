"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const AuthContext = createContext(null);
const STORAGE_KEY = "clic_soluciones_user";

function generarCodigo() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw));
    } catch (e) {
      console.warn("No se pudo leer la sesión guardada", e);
    }
    setLoading(false);
  }, []);

  function persistUser(u) {
    setUser(u);
    if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    else localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Paso 1 del registro/login: pide nombre, teléfono y localidad,
   * genera un código de verificación "mock" (simulado) y lo guarda
   * en la tabla usuarios. En una fase futura esto se reemplaza por
   * un envío real de SMS (Twilio / Supabase Phone Auth).
   */
  async function solicitarCodigo({ nombre, telefono, localidad }) {
    const codigo = generarCodigo();

    const { data: existente } = await supabase
      .from("usuarios")
      .select("*")
      .eq("telefono", telefono)
      .maybeSingle();

    if (existente) {
      const { error } = await supabase
        .from("usuarios")
        .update({
          nombre: nombre || existente.nombre,
          localidad: localidad || existente.localidad,
          codigo_verificacion: codigo,
          verificado: false
        })
        .eq("id", existente.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("usuarios").insert({
        nombre,
        telefono,
        localidad,
        codigo_verificacion: codigo,
        verificado: false
      });
      if (error) throw error;
    }

    // MOCK: en vez de enviar SMS real, devolvemos el código para
    // mostrarlo en pantalla (modo demo/desarrollo).
    return codigo;
  }

  /**
   * Paso 2: valida el código ingresado por el usuario contra el
   * guardado en Supabase, y si coincide, inicia sesión.
   */
  async function verificarCodigo({ telefono, codigo }) {
    const { data, error } = await supabase
      .from("usuarios")
      .select("*")
      .eq("telefono", telefono)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("No encontramos una cuenta con ese teléfono.");
    if (data.codigo_verificacion !== codigo) {
      throw new Error("El código ingresado no es correcto.");
    }

    await supabase
      .from("usuarios")
      .update({ verificado: true })
      .eq("id", data.id);

    const sessionUser = {
      id: data.id,
      nombre: data.nombre,
      telefono: data.telefono,
      localidad: data.localidad
    };
    persistUser(sessionUser);
    return sessionUser;
  }

  function logout() {
    persistUser(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, solicitarCodigo, verificarCodigo, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
