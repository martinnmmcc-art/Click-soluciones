"use client";

import { createContext, useContext, useEffect, useState } from "react";

const CartContext = createContext(null);
const STORAGE_KEY = "clic_soluciones_cart";

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [nota, setNota] = useState("");
  const [loaded, setLoaded] = useState(false);

  // Cargar carrito guardado
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setItems(parsed.items || []);
        setNota(parsed.nota || "");
      }
    } catch (e) {
      console.warn("No se pudo leer el carrito guardado", e);
    }
    setLoaded(true);
  }, []);

  // Persistir carrito
  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, nota }));
  }, [items, nota, loaded]);

  function addItem(producto, cantidad = 1) {
    setItems((prev) => {
      const existe = prev.find((i) => i.id === producto.id);
      if (existe) {
        return prev.map((i) =>
          i.id === producto.id ? { ...i, cantidad: i.cantidad + cantidad } : i
        );
      }
      return [
        ...prev,
        {
          id: producto.id,
          nombre: producto.nombre,
          precio: producto.precio_oferta || producto.precio,
          imagen_url: producto.imagen_url,
          cantidad
        }
      ];
    });
  }

  function updateQuantity(id, cantidad) {
    if (cantidad <= 0) {
      removeItem(id);
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, cantidad } : i)));
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function clearCart() {
    setItems([]);
    setNota("");
  }

  const total = items.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
  const cantidadTotal = items.reduce((acc, i) => acc + i.cantidad, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        nota,
        setNota,
        total,
        cantidadTotal
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de CartProvider");
  return ctx;
}
